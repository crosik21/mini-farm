import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useExpandableSheet } from "@/hooks/use-expandable-sheet";
import { UserPlus, Link2, ArrowRightLeft, Check, X, Trash2, Copy, ChevronDown, ChevronUp, Search, Clock, Trophy, Gift, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFarmAction } from "@/hooks/use-farm";
import type { FarmData } from "@/lib/types";
import { ITEM_EMOJIS } from "@/lib/constants";
import { FriendProfileModal } from "./FriendProfileModal";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TELEGRAM_ID = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? "";

async function socialFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}/api/social${path}`, {
    headers: { "x-telegram-id": TELEGRAM_ID, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Ошибка сервера");
  }
  return res.json();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ telegramId, size = 40 }: { telegramId: string; size?: number }) {
  const [error, setError] = useState(false);
  const isDemo = telegramId.startsWith("demo_") || !/^\d+$/.test(telegramId);

  if (isDemo || error) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-green-200 to-emerald-300 border-2 border-green-300 flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        🧑‍🌾
      </div>
    );
  }

  return (
    <img
      src={`${API_BASE}/api/avatar/${telegramId}`}
      alt="avatar"
      className="rounded-full object-cover border-2 border-green-200 flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Friend {
  id: number;
  friendId: string;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  profile: { level: number; coins: number; username?: string; firstName?: string } | null;
  createdAt: string;
}

interface TradeOffer {
  id: number;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  senderItems: TradeItem[];
  receiverItems: TradeItem[];
  message: string | null;
  direction: "incoming" | "outgoing";
  counterpartId: string;
  counterpartProfile: { level: number; username?: string; firstName?: string } | null;
  createdAt: string;
}

interface TradeItem {
  type: "crop" | "product" | "coins";
  id: string;
  quantity: number;
}

interface ReferralData {
  link: string;
  referralCount: number;
  totalEarned: number;
  referrals: { referredId: string; reward: number; createdAt: string }[];
}

interface SearchUser {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  level: number;
}

// ─── Display name helpers ─────────────────────────────────────────────────────
function displayName(profile: { username?: string; firstName?: string } | null, fallbackId: string): string {
  if (profile?.firstName) return profile.firstName + (profile.username ? ` @${profile.username}` : "");
  if (profile?.username) return `@${profile.username}`;
  return `ID ${fallbackId}`;
}

function shortName(profile: { username?: string; firstName?: string } | null, fallbackId: string): string {
  if (profile?.firstName) return profile.firstName;
  if (profile?.username) return `@${profile.username}`;
  return `ID ${fallbackId.slice(-4)}`;
}

// ─── Item label helper ────────────────────────────────────────────────────────
const CROP_EMOJI: Record<string, string> = {
  wheat: "🌾", carrot: "🥕", tomato: "🍅", corn: "🌽", strawberry: "🍓",
  sunflower: "🌻", pumpkin: "🎃", blueberry: "🫐", mushroom: "🍄",
  cactus_fruit: "🌵", dates: "🌴", cranberry: "🍒", ice_root: "🧊",
};
const PRODUCT_EMOJI: Record<string, string> = {
  flour: "🌾", bread: "🍞", milk: "🥛", butter: "🧈", cheese: "🧀", wool: "🧶",
};

function itemLabel(item: TradeItem): string {
  if (item.type === "coins") return `${item.quantity} 🪙`;
  const emoji = item.type === "crop" ? (CROP_EMOJI[item.id] ?? "📦") : (PRODUCT_EMOJI[item.id] ?? "📦");
  return `${emoji} ${item.id} ×${item.quantity}`;
}

// ─── Секция-заголовок ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{children}</p>
  );
}

// ─── Trade Builder ────────────────────────────────────────────────────────────
function TradeBuilder({ farm, friend, onClose }: { farm: FarmData; friend: Friend; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [senderItems, setSenderItems] = useState<TradeItem[]>([]);
  const [receiverItems, setReceiverItems] = useState<TradeItem[]>([]);
  const [message, setMessage] = useState("");
  const [addingFor, setAddingFor] = useState<"sender" | "receiver" | null>(null);
  const [newType, setNewType] = useState<"crop" | "product" | "coins">("crop");
  const [newId, setNewId] = useState("");
  const [newQty, setNewQty] = useState(1);

  const inv = farm.inventory as Record<string, number>;
  const prod = farm.products as Record<string, number>;
  const availableCoins = farm.coins;

  const createMutation = useMutation({
    mutationFn: () => socialFetch("/trades", {
      method: "POST",
      body: JSON.stringify({ receiverId: friend.friendId, senderItems, receiverItems, message: message || undefined }),
    }),
    onSuccess: () => {
      toast({ title: "✅ Предложение отправлено!" });
      qc.invalidateQueries({ queryKey: ["social-trades"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const addItem = () => {
    if (!addingFor) return;
    if (!newId && newType !== "coins") return;
    const item: TradeItem = { type: newType, id: newType === "coins" ? "coins" : newId, quantity: newQty };
    if (addingFor === "sender") setSenderItems((p) => [...p, item]);
    else setReceiverItems((p) => [...p, item]);
    setAddingFor(null);
    setNewId("");
    setNewQty(1);
  };

  const cropOptions = Object.entries(inv).filter(([, c]) => c > 0).map(([k]) => k);
  const prodOptions = Object.entries(prod).filter(([, c]) => c > 0).map(([k]) => k);
  const friendNameShort = shortName(friend.profile, friend.friendId);

  const { sheetProps: tradeSheetProps, handlePointerDownHandle: tradeHandlePointerDown } = useExpandableSheet(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <motion.div
        {...tradeSheetProps}
        className="w-full bg-card rounded-t-3xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={tradeHandlePointerDown}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-black text-foreground">🤝 Предложение обмена</h2>
          <button onClick={onClose} className="p-1 rounded-full bg-muted"><X size={18} className="text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ touchAction: "pan-y" }}>

        <div className="flex items-center gap-3 bg-muted/40 rounded-2xl p-3 mb-4">
          <Avatar telegramId={friend.friendId} size={40} />
          <div>
            <p className="font-bold text-foreground text-sm">{friendNameShort}</p>
            <p className="text-xs text-muted-foreground">Уровень {friend.profile?.level ?? "?"}</p>
          </div>
        </div>

        {/* Sender items */}
        <div className="mb-4">
          <p className="text-sm font-bold text-foreground mb-2">Вы отдаёте:</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {senderItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 rounded-xl px-3 py-1 text-sm font-semibold">
                {itemLabel(item)}
                <button onClick={() => setSenderItems((p) => p.filter((_, j) => j !== i))}><X size={12} /></button>
              </span>
            ))}
            <button onClick={() => setAddingFor("sender")} className="inline-flex items-center gap-1 bg-muted text-muted-foreground rounded-xl px-3 py-1 text-sm font-semibold">
              <UserPlus size={13} /> Добавить
            </button>
          </div>
        </div>

        {/* Receiver items */}
        <div className="mb-4">
          <p className="text-sm font-bold text-foreground mb-2">Вы получаете:</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {receiverItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-green-50 text-green-700 rounded-xl px-3 py-1 text-sm font-semibold">
                {itemLabel(item)}
                <button onClick={() => setReceiverItems((p) => p.filter((_, j) => j !== i))}><X size={12} /></button>
              </span>
            ))}
            <button onClick={() => setAddingFor("receiver")} className="inline-flex items-center gap-1 bg-muted text-muted-foreground rounded-xl px-3 py-1 text-sm font-semibold">
              <UserPlus size={13} /> Добавить
            </button>
          </div>
        </div>

        {/* Add item form */}
        {addingFor && (
          <div className="bg-muted/30 rounded-2xl p-4 mb-4 border border-border">
            <p className="text-sm font-bold text-foreground mb-3">Добавить предмет ({addingFor === "sender" ? "от вас" : "от друга"})</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(["crop", "product", "coins"] as const).map((t) => (
                <button key={t} onClick={() => setNewType(t)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${newType === t ? "bg-green-500 text-white" : "bg-card text-muted-foreground border border-border"}`}>
                  {t === "crop" ? "🌾 Урожай" : t === "product" ? "🏭 Продукт" : "🪙 Монеты"}
                </button>
              ))}
            </div>
            {newType !== "coins" && (
              <select value={newId} onChange={(e) => setNewId(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm mb-3 bg-card text-foreground">
                <option value="">— выбрать —</option>
                {(newType === "crop" ? (addingFor === "sender" ? cropOptions : Object.keys(CROP_EMOJI)) :
                  (addingFor === "sender" ? prodOptions : Object.keys(PRODUCT_EMOJI))).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm text-muted-foreground flex-shrink-0">Кол-во:</label>
              <input type="number" min={1} max={addingFor === "sender" && newType === "coins" ? availableCoins : 9999}
                value={newQty} onChange={(e) => setNewQty(Number(e.target.value))}
                className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground" />
            </div>
            <div className="flex gap-2">
              <button onClick={addItem} className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm">Добавить</button>
              <button onClick={() => setAddingFor(null)} className="flex-1 bg-muted text-muted-foreground font-bold py-2 rounded-xl text-sm">Отмена</button>
            </div>
          </div>
        )}

        <input
          placeholder="Сообщение (необязательно)"
          value={message} onChange={(e) => setMessage(e.target.value)}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm mb-4 bg-card text-foreground"
        />

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || (senderItems.length === 0 && receiverItems.length === 0)}
          className="w-full bg-green-500 text-white font-black py-3.5 rounded-2xl text-base disabled:opacity-50"
        >
          {createMutation.isPending ? "Отправка…" : "Отправить предложение"}
        </button>
        </div>{/* end scroll wrapper */}
      </motion.div>
    </div>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ trade, onRespond, onCancel }: {
  trade: TradeOffer;
  onRespond: (id: number, action: "accept" | "decline") => void;
  onCancel: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const statusColor = {
    pending: "text-yellow-600 bg-yellow-50",
    accepted: "text-green-600 bg-green-50",
    declined: "text-red-600 bg-red-50",
    cancelled: "text-muted-foreground bg-muted/40",
  }[trade.status];
  const statusLabel = { pending: "⏳ Ожидает", accepted: "✅ Принята", declined: "❌ Отклонена", cancelled: "🚫 Отменена" }[trade.status];
  const cpName = shortName(trade.counterpartProfile, trade.counterpartId);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-3">
      <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <Avatar telegramId={trade.counterpartId} size={36} />
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">
              {trade.direction === "incoming" ? "От" : "Для"} {cpName} (ур. {trade.counterpartProfile?.level ?? "?"})
            </p>
            <p className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border">
          {trade.message && <p className="text-sm text-muted-foreground italic mt-2 mb-3">"{trade.message}"</p>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs font-bold text-red-700 mb-1">Отдаёт отправитель:</p>
              {trade.senderItems.map((item, i) => <p key={i} className="text-sm text-red-800">{itemLabel(item)}</p>)}
              {trade.senderItems.length === 0 && <p className="text-xs text-muted-foreground">Ничего</p>}
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs font-bold text-green-700 mb-1">Отдаёт получатель:</p>
              {trade.receiverItems.map((item, i) => <p key={i} className="text-sm text-green-800">{itemLabel(item)}</p>)}
              {trade.receiverItems.length === 0 && <p className="text-xs text-muted-foreground">Ничего</p>}
            </div>
          </div>

          {trade.status === "pending" && trade.direction === "incoming" && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => onRespond(trade.id, "accept")} className="flex-1 bg-green-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                <Check size={15} /> Принять
              </button>
              <button onClick={() => onRespond(trade.id, "decline")} className="flex-1 bg-red-100 text-red-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                <X size={15} /> Отклонить
              </button>
            </div>
          )}
          {trade.status === "pending" && trade.direction === "outgoing" && (
            <button onClick={() => onCancel(trade.id)} className="w-full mt-3 bg-muted text-muted-foreground font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
              <Trash2 size={14} /> Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Friend Panel ─────────────────────────────────────────────────────────
function AddFriendPanel({ onSend }: { onSend: (query: string) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const isUsername = query.trim().startsWith("@") || (query.trim().length > 0 && !/^\d+$/.test(query.trim()));
  const searchQ = debouncedQ.replace(/^@/, "");

  const { data: searchResults, isFetching } = useQuery<{ users: SearchUser[] }>({
    queryKey: ["user-search", searchQ],
    queryFn: () =>
      fetch(`${API_BASE}/api/social/users/search?q=${encodeURIComponent(searchQ)}`, {
        headers: { "x-telegram-id": TELEGRAM_ID, "Content-Type": "application/json" },
      }).then(async (r) => {
        if (!r.ok) throw new Error("search failed");
        return r.json();
      }),
    enabled: isUsername && searchQ.length >= 2,
    staleTime: 10000,
  });

  const users = searchResults?.users ?? [];

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm mb-4">
      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <UserPlus size={15} className="text-green-500" /> Добавить друга
      </p>
      <div className="relative">
        <div className="flex gap-2 mb-1">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              placeholder="@username или Telegram ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-border rounded-xl pl-8 pr-3 py-2.5 text-sm bg-muted/30 text-foreground focus:outline-none focus:border-green-400"
            />
          </div>
          {!isUsername && query.trim() && (
            <button
              onClick={() => { onSend(query.trim()); setQuery(""); }}
              className="bg-green-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm"
            >
              Добавить
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {isUsername && searchQ.length >= 2 && (
          <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
            {isFetching ? (
              <div className="py-3 px-4 text-xs text-muted-foreground text-center">Поиск…</div>
            ) : users.length === 0 ? (
              <div className="py-3 px-4 text-xs text-muted-foreground text-center">Пользователи не найдены</div>
            ) : (
              users.map((u) => (
                <button
                  key={u.telegramId}
                  onClick={() => { onSend(u.telegramId); setQuery(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 transition-colors border-b border-border last:border-0"
                >
                  <Avatar telegramId={u.telegramId} size={32} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-foreground">
                      {u.firstName || u.username
                        ? (u.firstName ?? "") + (u.username ? ` @${u.username}` : "")
                        : `ID ${u.telegramId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Уровень {u.level}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+ Добавить</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Введите @username или числовой Telegram ID</p>
    </div>
  );
}

// ─── Gift Slider Modal ────────────────────────────────────────────────────────
interface GiftSliderModalProps {
  friendId: string;
  friendName: string;
  myCoins: number;
  onConfirm: (coins: number) => void;
  onClose: () => void;
  isPending: boolean;
}

function GiftSliderModal({ friendId, friendName, myCoins, onConfirm, onClose, isPending }: GiftSliderModalProps) {
  const [amount, setAmount] = useState(Math.min(100, myCoins));
  const { sheetProps: giftSheetProps, handlePointerDownHandle: giftHandlePointerDown } = useExpandableSheet(onClose);
  const MAX = 500;
  const canAfford = myCoins >= amount;

  const pct = ((amount - 1) / (MAX - 1)) * 100;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        {...giftSheetProps}
        className="relative bg-background rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Handle */}
        <div
          className="flex justify-center pt-3 pb-1 touch-none cursor-grab active:cursor-grabbing flex-shrink-0"
          onPointerDown={giftHandlePointerDown}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 mb-5">
          <div className="flex items-center gap-3">
            <Avatar telegramId={friendId} size={44} />
            <div>
              <p className="font-bold text-foreground text-base">{friendName}</p>
              <p className="text-xs text-muted-foreground">Ежедневный подарок</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-muted">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5">

        {/* Amount display */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border-2 border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-3 mb-1">
            <span className="text-2xl">🪙</span>
            <span className="font-black text-3xl text-amber-700 dark:text-amber-400 tabular-nums">{amount}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            У вас: <span className="font-bold text-foreground">{(myCoins ?? 0).toLocaleString()} 🪙</span>
          </p>
        </div>

        {/* Slider */}
        <div className="mb-6 px-1">
          <div className="relative">
            <input
              type="range"
              min={1}
              max={MAX}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.min(Number(e.target.value), myCoins, MAX))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f59e0b ${pct}%, #e5e7eb ${pct}%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
            <span>1</span>
            <span>250</span>
            <span>500</span>
          </div>
        </div>

        {/* Quick buttons */}
        <div className="flex gap-2 mb-5">
          {[50, 100, 250, 500].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(Math.min(v, myCoins, MAX))}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                amount === Math.min(v, myCoins, MAX)
                  ? "bg-amber-400 border-amber-400 text-white"
                  : "bg-card border-border text-muted-foreground hover:border-amber-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-border font-bold text-sm text-muted-foreground"
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirm(amount)}
            disabled={isPending || !canAfford || amount < 1}
            className="flex-[2] py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow"
          >
            <Gift size={16} />
            {!canAfford ? "Недостаточно монет" : isPending ? "Отправка…" : `Подарить ${amount} 🪙`}
          </button>
        </div>
        </div>{/* end px-5 */}
      </motion.div>
    </motion.div>
  );
}

// ─── Types for Leaderboard & Gifts ───────────────────────────────────────────
interface LeaderboardEntry {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  level: number;
  xp: number;
  coins: number;
}
interface IncomingGift {
  id: number;
  senderId: string;
  giftCropId: string | null;
  giftQty: number;
  giftCoins: number;
  createdAt: string;
  senderProfile: { username?: string; firstName?: string; level: number } | null;
}

// ─── Main FriendsTab ──────────────────────────────────────────────────────────
export function FriendsTab({ farm }: { farm: FarmData }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { mutate: farmMutate, isPending: farmPending } = useFarmAction();
  const [activeSection, setActiveSection] = useState<"friends" | "trades" | "referral" | "leaderboard" | "gifts">("friends");
  const [tradeTarget, setTradeTarget] = useState<Friend | null>(null);
  const [refCodeInput, setRefCodeInput] = useState("");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<{ friendId: string; name: string } | null>(null);

  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["social-friends"],
    queryFn: () => socialFetch("/friends"),
    refetchInterval: 15000,
  });

  const { data: tradesData, isLoading: loadingTrades } = useQuery({
    queryKey: ["social-trades"],
    queryFn: () => socialFetch("/trades"),
    refetchInterval: 15000,
  });

  const { data: referralData } = useQuery<ReferralData>({
    queryKey: ["social-referral"],
    queryFn: () => socialFetch("/referral"),
  });

  const sendRequest = useMutation({
    mutationFn: (payload: { targetId?: string; targetUsername?: string }) =>
      socialFetch("/friends/request", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: "✅ Запрос отправлен!" });
      qc.invalidateQueries({ queryKey: ["social-friends"] });
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const respondFriend = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      socialFetch("/friends/respond", { method: "POST", body: JSON.stringify({ friendshipId: id, action }) }),
    onSuccess: (_, { action }) => {
      toast({ title: action === "accept" ? "🤝 Вы теперь друзья!" : "❌ Запрос отклонён" });
      qc.invalidateQueries({ queryKey: ["social-friends"] });
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const removeFriend = useMutation({
    mutationFn: (id: number) => socialFetch(`/friends/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Удалено" }); qc.invalidateQueries({ queryKey: ["social-friends"] }); },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const respondTrade = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      socialFetch(`/trades/${id}/respond`, { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: (_, { action }) => {
      toast({ title: action === "accept" ? "🤝 Обмен завершён!" : "❌ Сделка отклонена" });
      qc.invalidateQueries({ queryKey: ["social-trades"] });
      qc.invalidateQueries({ queryKey: ["farm"] });
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const cancelTrade = useMutation({
    mutationFn: (id: number) => socialFetch(`/trades/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Сделка отменена" }); qc.invalidateQueries({ queryKey: ["social-trades"] }); },
  });

  // ── Leaderboard ──
  const { data: lbData, isLoading: loadingLb } = useQuery<{ leaderboard: LeaderboardEntry[]; myRank: number | null }>({
    queryKey: ["social-leaderboard"],
    queryFn: () => socialFetch("/leaderboard"),
    enabled: activeSection === "leaderboard",
    staleTime: 60000,
  });

  // ── Gifts ──
  const { data: giftsData, isLoading: loadingGifts } = useQuery<{ incoming: IncomingGift[]; sentToFriendIds: string[] }>({
    queryKey: ["social-gifts"],
    queryFn: () => socialFetch("/gifts"),
    enabled: activeSection === "gifts",
    refetchInterval: activeSection === "gifts" ? 20000 : false,
  });

  const sendGift = useMutation({
    mutationFn: ({ receiverId, coins }: { receiverId: string; coins: number }) =>
      socialFetch("/gifts/send", { method: "POST", body: JSON.stringify({ receiverId, coins }) }),
    onSuccess: (_data: any, { coins }) => {
      toast({ title: `🎁 Подарок ${coins} 🪙 отправлен!` });
      setGiftTarget(null);
      qc.invalidateQueries({ queryKey: ["social-gifts"] });
      qc.invalidateQueries({ queryKey: ["farm"] });
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const claimGift = useMutation({
    mutationFn: (id: number) => socialFetch(`/gifts/${id}/claim`, { method: "POST" }),
    onSuccess: (data: any) => {
      if (data.coins) {
        toast({ title: `✅ Получено ${data.coins} 🪙` });
      } else {
        toast({ title: `✅ Получено ${data.qty} × ${ITEM_EMOJIS[data.cropId] ?? "🌱"}` });
      }
      qc.invalidateQueries({ queryKey: ["social-gifts"] });
      qc.invalidateQueries({ queryKey: ["farm"] });
    },
    onError: (e: Error) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const friends: Friend[] = friendsData?.friends ?? [];
  const trades: TradeOffer[] = tradesData?.trades ?? [];

  const accepted = friends.filter((f) => f.status === "accepted");
  const incoming = friends.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = friends.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const pendingTrades = trades.filter((t) => t.status === "pending");

  const copyReferral = () => {
    if (referralData?.link) {
      navigator.clipboard.writeText(referralData.link).then(() => toast({ title: "✅ Ссылка скопирована!" }));
    }
  };

  const handleAddFriend = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (/^\d+$/.test(trimmed)) {
      sendRequest.mutate({ targetId: trimmed });
    } else {
      sendRequest.mutate({ targetUsername: trimmed.replace(/^@/, "") });
    }
  };

  const unclaimedGifts = giftsData?.incoming.length ?? 0;

  const sections = [
    { id: "friends" as const, label: "Друзья", badge: incoming.length },
    { id: "trades" as const, label: "Обмен", badge: pendingTrades.filter(t => t.direction === "incoming").length },
    { id: "gifts" as const, label: "Подарки", badge: unclaimedGifts },
    { id: "leaderboard" as const, label: "Рейтинг", badge: 0 },
    { id: "referral" as const, label: "Рефералы", badge: 0 },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Section tabs */}
      <div className="flex bg-card border-b border-border overflow-x-auto scrollbar-hide px-1 pt-2 gap-0">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`relative flex-shrink-0 px-3.5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${activeSection === s.id ? "text-green-600 border-b-2 border-green-500" : "text-muted-foreground"}`}>
            {s.label}
            {s.badge > 0 && (
              <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">

          {/* ── FRIENDS ── */}
          {activeSection === "friends" && (
            <motion.div key="friends" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>

              {/* Add friend */}
              <AddFriendPanel onSend={handleAddFriend} />

              {/* Incoming requests */}
              {incoming.length > 0 && (
                <div className="mb-4">
                  <SectionLabel>Входящие запросы ({incoming.length})</SectionLabel>
                  {incoming.map((f) => (
                    <div key={f.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3 mb-2">
                      <Avatar telegramId={f.friendId} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{displayName(f.profile, f.friendId)}</p>
                        <p className="text-xs text-muted-foreground">Уровень {f.profile?.level ?? "?"}</p>
                      </div>
                      <button
                        onClick={() => respondFriend.mutate({ id: f.id, action: "accept" })}
                        className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0"
                        title="Принять"
                      >
                        <Check size={16} className="text-green-600" />
                      </button>
                      <button
                        onClick={() => respondFriend.mutate({ id: f.id, action: "decline" })}
                        className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"
                        title="Отклонить"
                      >
                        <X size={16} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Outgoing requests */}
              {outgoing.length > 0 && (
                <div className="mb-4">
                  <SectionLabel>Отправленные запросы ({outgoing.length})</SectionLabel>
                  {outgoing.map((f) => (
                    <div key={f.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3 mb-2">
                      <Avatar telegramId={f.friendId} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{displayName(f.profile, f.friendId)}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Ожидает ответа</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFriend.mutate(f.id)}
                        disabled={removeFriend.isPending}
                        className="w-9 h-9 bg-muted rounded-full flex items-center justify-center flex-shrink-0 hover:bg-red-100 transition-colors"
                        title="Отменить запрос"
                      >
                        <X size={15} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Friends list */}
              {!loadingFriends && (
                <>
                  <SectionLabel>Друзья {accepted.length > 0 && `(${accepted.length})`}</SectionLabel>
                  {accepted.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-5xl mb-3">👥</div>
                      <p className="text-muted-foreground font-semibold">Пока нет друзей</p>
                      <p className="text-muted-foreground text-sm mt-1">Добавьте друга по @username или ID</p>
                    </div>
                  ) : (
                    accepted.map((f) => (
                      <div key={f.id} className="bg-card rounded-2xl p-3.5 border border-border shadow-sm flex items-center gap-3 mb-2">
                        <button onClick={() => setViewingProfileId(f.friendId)} className="flex-shrink-0">
                          <Avatar telegramId={f.friendId} size={44} />
                        </button>
                        <button className="flex-1 min-w-0 text-left" onClick={() => setViewingProfileId(f.friendId)}>
                          <p className="font-bold text-foreground text-sm truncate">{displayName(f.profile, f.friendId)}</p>
                          <p className="text-xs text-muted-foreground">Ур. {f.profile?.level ?? "?"} · {(f.profile?.coins ?? 0).toLocaleString()} 🪙</p>
                        </button>
                        <button
                          onClick={() => setViewingProfileId(f.friendId)}
                          className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950 rounded-full flex items-center justify-center flex-shrink-0"
                          title="Посмотреть профиль"
                        >
                          <Eye size={14} className="text-indigo-500" />
                        </button>
                        <button
                          onClick={() => setTradeTarget(f)}
                          className="w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center flex-shrink-0"
                          title="Предложить обмен"
                        >
                          <ArrowRightLeft size={14} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => removeFriend.mutate(f.id)}
                          className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0"
                          title="Удалить"
                        >
                          <Trash2 size={13} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {loadingFriends && (
                <div className="text-center py-8 text-muted-foreground text-sm">Загрузка…</div>
              )}
            </motion.div>
          )}

          {/* ── TRADES ── */}
          {activeSection === "trades" && (
            <motion.div key="trades" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              {loadingTrades ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Загрузка…</div>
              ) : trades.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🤝</div>
                  <p className="text-muted-foreground font-semibold">Нет предложений обмена</p>
                  <p className="text-muted-foreground text-sm mt-1">Начните торговлю с другом через вкладку «Друзья»</p>
                </div>
              ) : (
                trades.map((t) => (
                  <TradeCard
                    key={t.id}
                    trade={t}
                    onRespond={(id, action) => respondTrade.mutate({ id, action })}
                    onCancel={(id) => cancelTrade.mutate(id)}
                  />
                ))
              )}
            </motion.div>
          )}

          {/* ── REFERRAL ── */}
          {activeSection === "referral" && (
            <motion.div key="referral" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>

              {/* My referral code card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4 shadow-sm mb-4">
                <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                  <Link2 size={14} className="text-green-500" /> Мой реферальный код
                </p>
                <p className="text-xs text-muted-foreground mb-3">Поделись кодом — оба получите 🪙50 + 💎5</p>

                {farm.refCode ? (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 bg-white border-2 border-green-300 rounded-xl px-4 py-2.5 text-center">
                      <span className="font-black text-green-700 text-lg tracking-widest">{farm.refCode}</span>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(farm.refCode!).then(() => toast({ title: "✅ Код скопирован!" })); }}
                      className="shrink-0 bg-green-500 text-white rounded-xl px-3 py-2.5 text-xs font-bold flex items-center gap-1"
                    >
                      <Copy size={13} /> Копировать
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 font-semibold mb-3">Код ещё не создан. Придумай свой!</p>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refCodeInput}
                    onChange={(e) => setRefCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15))}
                    placeholder={farm.refCode ? "Изменить код…" : "Придумай код (напр. IVAN2025)"}
                    className="flex-1 bg-white border-2 border-green-200 rounded-xl px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:border-green-400 focus:outline-none"
                  />
                  <button
                    disabled={refCodeInput.length < 3 || farmPending}
                    onClick={() => {
                      farmMutate({ action: "set_ref_code", code: refCodeInput }, {
                        onSuccess: () => setRefCodeInput(""),
                      });
                    }}
                    className="shrink-0 bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    {farm.refCode ? "Изменить" : "Создать"}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">3–15 символов: буквы, цифры, _</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center">
                  <p className="text-3xl font-black text-green-600">{referralData?.referralCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">Приглашено</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center">
                  <p className="text-3xl font-black text-yellow-500">{(referralData?.referralCount ?? 0) * 50}</p>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">🪙 заработано</p>
                </div>
              </div>

              {/* Telegram link */}
              <div className="bg-card rounded-2xl p-4 border border-border shadow-sm mb-4">
                <p className="text-sm font-bold text-foreground mb-1">📲 Реферальная ссылка</p>
                <p className="text-xs text-muted-foreground mb-3">Или поделись ссылкой на бота с кодом</p>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-2 border border-border">
                  <p className="flex-1 text-xs text-muted-foreground font-mono truncate">{referralData?.link ?? "Загрузка…"}</p>
                  <button onClick={copyReferral} className="flex-shrink-0 bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                    <Copy size={11} /> Копировать
                  </button>
                </div>
              </div>

              {referralData && referralData.referrals.length > 0 && (
                <div>
                  <SectionLabel>Приглашённые</SectionLabel>
                  {referralData.referrals.map((r, i) => (
                    <div key={i} className="bg-card rounded-xl p-3 border border-border shadow-sm flex items-center gap-3 mb-2">
                      <Avatar telegramId={r.referredId} size={36} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">ID {r.referredId}</p>
                        <p className="text-xs text-muted-foreground">+50 🪙 · +5 💎 заработано</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── LEADERBOARD ── */}
          {activeSection === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              {loadingLb ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Загрузка…</div>
              ) : !lbData?.leaderboard.length ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🏆</div>
                  <p className="text-muted-foreground font-semibold">Таблица пуста</p>
                </div>
              ) : (
                <>
                  {lbData.myRank && (
                    <div className="mb-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                      <Trophy size={15} className="text-yellow-500" />
                      <span className="text-sm font-bold text-green-700 dark:text-green-300">Ваше место: #{lbData.myRank}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {lbData.leaderboard.map((entry, i) => {
                      const isMe = entry.telegramId === TELEGRAM_ID;
                      const isFriend = accepted.some((f) => f.friendId === entry.telegramId);
                      const canView = isMe || isFriend;
                      const rank = i + 1;
                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      return (
                        <div
                          key={entry.telegramId}
                          onClick={() => canView && setViewingProfileId(entry.telegramId)}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border shadow-sm transition-colors ${
                            isMe ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700" : "bg-card border-border"
                          } ${canView ? "cursor-pointer active:opacity-80" : ""}`}
                        >
                          <div className="w-7 text-center flex-shrink-0">
                            {medal ? <span className="text-lg">{medal}</span> : <span className="text-sm font-black text-muted-foreground">#{rank}</span>}
                          </div>
                          <Avatar telegramId={entry.telegramId} size={36} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${isMe ? "text-green-700 dark:text-green-300" : "text-foreground"}`}>
                              {entry.firstName ?? entry.username ?? `ID ${entry.telegramId}`}
                              {isMe && <span className="ml-1 text-xs font-normal text-green-500">(вы)</span>}
                              {isFriend && !isMe && <span className="ml-1 text-xs font-normal text-blue-400">🤝</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">Ур. {entry.level} · {entry.xp.toLocaleString()} XP</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <p className="text-xs font-bold text-yellow-600">{entry.coins.toLocaleString()} 🪙</p>
                            {canView && <Eye size={13} className="text-muted-foreground" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── GIFTS ── */}
          {activeSection === "gifts" && (
            <motion.div key="gifts" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              {loadingGifts ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Загрузка…</div>
              ) : (
                <>
                  {/* Incoming gifts */}
                  <SectionLabel>Входящие подарки {giftsData?.incoming.length ? `(${giftsData.incoming.length})` : ""}</SectionLabel>
                  {!giftsData?.incoming.length ? (
                    <div className="text-center py-6 bg-card rounded-2xl border border-border mb-4">
                      <div className="text-4xl mb-2">🎁</div>
                      <p className="text-sm text-muted-foreground">Нет новых подарков</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {giftsData.incoming.map((g) => (
                        <div key={g.id} className="bg-card rounded-2xl p-4 border border-green-200 dark:border-green-800 shadow-sm flex items-center gap-3">
                          <Avatar telegramId={g.senderId} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-sm truncate">
                              {g.senderProfile?.firstName ?? g.senderProfile?.username ?? `ID ${g.senderId}`}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {g.giftCoins > 0 ? (
                                <><span className="text-amber-500 font-bold">+{g.giftCoins} 🪙</span></>
                              ) : (
                                <>{g.giftQty}× {ITEM_EMOJIS[g.giftCropId ?? ""] ?? "🌱"} {g.giftCropId}</>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => claimGift.mutate(g.id)}
                            disabled={claimGift.isPending}
                            className="flex-shrink-0 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                          >
                            <Gift size={13} /> Забрать
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Send gifts to friends */}
                  {(() => {
                    const sentIds = giftsData?.sentToFriendIds ?? [];
                    const acceptedFriends = friends.filter((f) => f.status === "accepted");
                    if (acceptedFriends.length === 0) return (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Добавьте друзей, чтобы дарить подарки</p>
                      </div>
                    );
                    return (
                      <>
                        <SectionLabel>Отправить подарок</SectionLabel>
                        <div className="space-y-2">
                          {acceptedFriends.map((f) => {
                            const alreadySent = sentIds.includes(f.friendId);
                            return (
                              <div key={f.id} className="bg-card rounded-2xl p-3.5 border border-border shadow-sm flex items-center gap-3">
                                <Avatar telegramId={f.friendId} size={38} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-foreground text-sm truncate">{displayName(f.profile, f.friendId)}</p>
                                  <p className="text-xs text-muted-foreground">Уровень {f.profile?.level ?? "?"}</p>
                                </div>
                                {alreadySent ? (
                                  <span className="text-xs text-green-600 font-bold flex items-center gap-1 flex-shrink-0">
                                    <Check size={12} /> Отправлено
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setGiftTarget({ friendId: f.friendId, name: displayName(f.profile, f.friendId) })}
                                    className="flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                  >
                                    <Gift size={13} /> Подарить
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Trade builder modal */}
      <AnimatePresence>
        {tradeTarget && (
          <TradeBuilder farm={farm} friend={tradeTarget} onClose={() => setTradeTarget(null)} />
        )}
      </AnimatePresence>

      {/* Friend profile modal */}
      <AnimatePresence>
        {viewingProfileId && (() => {
          const friendRecord = accepted.find((f) => f.friendId === viewingProfileId);
          const isAccepted = !!friendRecord;
          return (
            <FriendProfileModal
              key={viewingProfileId}
              telegramId={viewingProfileId}
              onClose={() => setViewingProfileId(null)}
              isFriendAccepted={isAccepted}
              onTrade={friendRecord ? () => {
                setViewingProfileId(null);
                setTradeTarget(friendRecord);
              } : undefined}
              onGift={isAccepted && friendRecord ? () => {
                setViewingProfileId(null);
                setGiftTarget({
                  friendId: viewingProfileId,
                  name: displayName(friendRecord.profile, viewingProfileId),
                });
              } : undefined}
            />
          );
        })()}
      </AnimatePresence>

      {/* Gift slider modal */}
      <AnimatePresence>
        {giftTarget && (
          <GiftSliderModal
            key={giftTarget.friendId}
            friendId={giftTarget.friendId}
            friendName={giftTarget.name}
            myCoins={farm.coins}
            isPending={sendGift.isPending}
            onConfirm={(coins) => sendGift.mutate({ receiverId: giftTarget.friendId, coins })}
            onClose={() => setGiftTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
