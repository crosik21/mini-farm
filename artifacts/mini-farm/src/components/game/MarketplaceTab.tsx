import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FarmData, MarketListing } from "@/lib/types";
import { ITEM_NAMES, ITEM_EMOJIS, FISH_META } from "@/lib/constants";
import { getTelegramId } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, X, Plus } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MarketplaceTabProps {
  farm: FarmData;
}

type FilterType = "all" | "crop" | "product" | "fish";

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (rem === 0) { setText("Истёк"); return; }
      const h = Math.floor(rem / 3600);
      const m = Math.floor((rem % 3600) / 60);
      setText(h > 0 ? `${h}ч ${m}м` : `${m}м`);
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  return <span className="text-[10px] text-muted-foreground">⏱ {text}</span>;
}

function getItemEmoji(itemType: string, itemId: string): string {
  if (itemType === "fish") return FISH_META[itemId]?.emoji ?? "🐟";
  return ITEM_EMOJIS[itemId] ?? "📦";
}

function getItemName(itemType: string, itemId: string): string {
  if (itemType === "fish") return FISH_META[itemId]?.name ?? itemId;
  return ITEM_NAMES[itemId] ?? itemId;
}

function ListingCard({
  listing,
  onBuy,
  onCancel,
  isPending,
}: {
  listing: MarketListing;
  onBuy: (id: number, qty: number) => void;
  onCancel: (id: number) => void;
  isPending: boolean;
}) {
  const [buyQty, setBuyQty] = useState(1);
  const expired = new Date() > new Date(listing.expiresAt);
  const emoji = getItemEmoji(listing.itemType, listing.itemId);
  const name = getItemName(listing.itemType, listing.itemId);
  const totalCost = buyQty * listing.pricePerUnit;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={`bg-card border-2 rounded-2xl p-3 ${listing.isOwn ? "border-blue-200 bg-blue-50/50" : "border-card-border"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{name}</div>
          <div className="text-[10px] text-muted-foreground">
            {listing.sellerName ?? "Игрок"}
            {listing.isOwn && <span className="ml-1 text-blue-600 font-bold">(мой лот)</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black text-amber-600 text-sm">{listing.pricePerUnit} 🪙</div>
          <div className="text-[10px] text-muted-foreground">за шт</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground">Доступно: <b>{listing.quantity} шт</b></span>
        <CountdownBadge expiresAt={listing.expiresAt} />
      </div>

      {listing.isOwn ? (
        <button
          onClick={() => onCancel(listing.id)}
          disabled={isPending}
          className="w-full py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
        >
          Отменить лот
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button onClick={() => setBuyQty(Math.max(1, buyQty - 1))} className="px-2 py-1 text-xs bg-muted font-bold">−</button>
            <span className="px-2 text-xs font-bold min-w-[24px] text-center">{Math.min(buyQty, listing.quantity)}</span>
            <button onClick={() => setBuyQty(Math.min(listing.quantity, buyQty + 1))} className="px-2 py-1 text-xs bg-muted font-bold">+</button>
          </div>
          <button
            onClick={() => onBuy(listing.id, Math.min(buyQty, listing.quantity))}
            disabled={isPending || expired}
            className="flex-1 py-1.5 bg-primary text-white text-xs font-bold rounded-xl border-b border-green-700 active:translate-y-0.5 transition-all disabled:opacity-50"
          >
            {expired ? "Истёк" : `Купить 🪙${totalCost}`}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CreateListingModal({
  farm,
  onClose,
  onCreated,
}: {
  farm: FarmData;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const telegramId = getTelegramId();
  const [itemType, setItemType] = useState<"crop" | "product" | "fish">("crop");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(10);
  const [loading, setLoading] = useState(false);

  const cropEntries = Object.entries(farm.inventory as Record<string, number>).filter(([, q]) => q > 0);
  const productEntries = Object.entries(farm.products as Record<string, number>).filter(([, q]) => q > 0);
  const fishEntries = Object.entries(farm.fishInventory ?? {}).filter(([, q]) => q > 0);

  const currentEntries =
    itemType === "crop" ? cropEntries :
    itemType === "product" ? productEntries :
    fishEntries;

  const maxQty = currentEntries.find(([id]) => id === itemId)?.[1] ?? 0;

  async function create() {
    if (!itemId) return toast({ variant: "destructive", title: "Выберите товар" });
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/market/listings`, {
        method: "POST",
        headers: { "x-telegram-id": telegramId, "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, quantity: qty, pricePerUnit: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast({ title: "Лот создан! ✅", description: "Он появится в общем списке" });
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="w-full bg-background rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Разместить лот</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Item type tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {(["crop", "product", "fish"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setItemType(t); setItemId(""); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${itemType === t ? "bg-white shadow text-primary" : "text-muted-foreground"}`}
            >
              {t === "crop" ? "🌾 Урожай" : t === "product" ? "🥛 Продукты" : "🐟 Рыба"}
            </button>
          ))}
        </div>

        {/* Item selector */}
        <div className="mb-3">
          <label className="text-xs font-bold text-muted-foreground mb-1 block">Товар</label>
          {currentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">Нет доступных товаров</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {currentEntries.map(([id, q]) => {
                const emoji = getItemEmoji(itemType, id);
                const name = getItemName(itemType, id);
                return (
                  <button
                    key={id}
                    onClick={() => setItemId(id)}
                    className={`flex flex-col items-center p-2 border-2 rounded-xl transition-all ${itemId === id ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className="text-[10px] font-bold mt-0.5 leading-tight text-center">{name}</span>
                    <span className="text-[9px] text-muted-foreground">×{q}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {itemId && (
          <>
            <div className="mb-3">
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Количество (макс. {maxQty})</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-xl bg-muted font-bold text-lg">−</button>
                <input
                  type="number" min={1} max={maxQty} value={qty}
                  onChange={(e) => setQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 text-center border rounded-xl py-2 font-bold text-lg"
                />
                <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-9 h-9 rounded-xl bg-muted font-bold text-lg">+</button>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Цена за штуку 🪙</label>
              <input
                type="number" min={1} value={price}
                onChange={(e) => setPrice(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border rounded-xl py-2 px-3 font-bold text-lg text-center"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Итого: <b className="text-amber-600">{price * qty} 🪙</b>
              </p>
            </div>

            <button
              onClick={create}
              disabled={loading}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl border-b-2 border-green-700 active:translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? "Создаём..." : "Разместить лот"}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export function MarketplaceTab({ farm }: MarketplaceTabProps) {
  const { toast } = useToast();
  const telegramId = getTelegramId();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<"all" | "mine">("all");
  const [filter, setFilter] = useState<FilterType>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("itemType", filter);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const [allRes, myRes] = await Promise.all([
        fetch(`${API_BASE}/api/market/listings${qs}`, { headers: { "x-telegram-id": telegramId } }),
        fetch(`${API_BASE}/api/market/my-listings`, { headers: { "x-telegram-id": telegramId } }),
      ]);
      const allData = await allRes.json();
      const myData = await myRes.json();
      setListings(allData.listings ?? []);
      setMyListings(myData.listings ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [telegramId, filter, minPrice, maxPrice]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function buyListing(id: number, qty: number) {
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/market/listings/${id}/buy`, {
        method: "POST",
        headers: { "x-telegram-id": telegramId, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast({ title: "Куплено! 🛒", description: `Потрачено ${data.totalCost} 🪙` });
      queryClient.invalidateQueries({ queryKey: ["farm", telegramId] });
      fetchAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setActionPending(false);
    }
  }

  async function cancelListing(id: number) {
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/market/listings/${id}`, {
        method: "DELETE",
        headers: { "x-telegram-id": telegramId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast({ title: "Лот отменён", description: "Товар возвращён в инвентарь" });
      queryClient.invalidateQueries({ queryKey: ["farm", telegramId] });
      fetchAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setActionPending(false);
    }
  }

  const filteredListings = listings;

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-bold text-xl">🏪 Рынок игроков</h2>
        <button onClick={fetchAll} disabled={loading} className="text-primary">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        <button
          onClick={() => setActiveSection("all")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeSection === "all" ? "bg-white shadow text-primary" : "text-muted-foreground"}`}
        >
          Все лоты
        </button>
        <button
          onClick={() => setActiveSection("mine")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeSection === "mine" ? "bg-white shadow text-primary" : "text-muted-foreground"}`}
        >
          Мои лоты
          {myListings.length > 0 && (
            <span className="bg-primary text-white text-[9px] px-1 rounded-full">{myListings.length}</span>
          )}
        </button>
      </div>

      {activeSection === "all" && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(["all", "crop", "product", "fish"] as FilterType[]).map((f) => {
              const labels: Record<FilterType, string> = { all: "Все", crop: "🌾 Урожай", product: "🥛 Продукты", fish: "🐟 Рыба" };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 px-3 py-1 text-xs font-bold rounded-xl border transition-all ${filter === f ? "bg-primary text-white border-primary" : "bg-card border-card-border text-muted-foreground"}`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Price filter */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground shrink-0">🪙 Цена:</span>
            <input
              type="number" min={1} placeholder="от"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="flex-1 border rounded-xl px-2 py-1 text-xs text-center"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <input
              type="number" min={1} placeholder="до"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="flex-1 border rounded-xl px-2 py-1 text-xs text-center"
            />
            {(minPrice || maxPrice) && (
              <button
                onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                className="text-xs text-muted-foreground px-2 py-1 rounded-xl border"
              >
                ✕
              </button>
            )}
          </div>

          {loading && <p className="text-center text-sm text-muted-foreground py-4">Загрузка...</p>}

          {!loading && filteredListings.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🏪</div>
              <p className="text-sm text-muted-foreground">Активных лотов нет</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filteredListings.map((l) => (
              <ListingCard key={l.id} listing={l} onBuy={buyListing} onCancel={cancelListing} isPending={actionPending} />
            ))}
          </div>
        </>
      )}

      {activeSection === "mine" && (
        <>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white font-bold rounded-xl border-b-2 border-green-700 active:translate-y-0.5 transition-all"
          >
            <Plus size={16} /> Разместить лот
          </button>

          {myListings.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-sm text-muted-foreground">У вас нет активных лотов</p>
              <p className="text-xs text-muted-foreground mt-1">Разместите товар из инвентаря</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myListings.map((l) => (
                <ListingCard key={l.id} listing={{ ...l, isOwn: true }} onBuy={buyListing} onCancel={cancelListing} isPending={actionPending} />
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateListingModal
            farm={farm}
            onClose={() => setShowCreate(false)}
            onCreated={fetchAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
