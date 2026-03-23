import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useFarm, useFarmAction } from "@/hooks/use-farm";
import { PlotState, FarmData, WorldId } from "@/lib/types";
import { CROPS, PRODUCTS, SEASON_CONFIG } from "@/lib/constants";
import { EmojiImg } from "@/components/ui/emoji-img";

import { TopBar } from "@/components/game/TopBar";
import { IsometricField } from "@/components/game/IsometricField";
import { BottomNav, Tab } from "@/components/game/BottomNav";
import { PlantModal } from "@/components/game/PlantModal";
import { AnimalsTab } from "@/components/game/AnimalsTab";
import { BuildingsTab } from "@/components/game/BuildingsTab";
import { ShopTab } from "@/components/game/ShopTab";
import { SeedShopTab } from "@/components/game/SeedShopTab";
import { ProfileTab } from "@/components/game/ProfileTab";
import { EnergyModal } from "@/components/game/EnergyModal";
import { AdminTab } from "@/components/game/AdminTab";
import { FriendsTab } from "@/components/game/FriendsTab";
import { CasesTab } from "@/components/game/CasesTab";
import { StreakModal } from "@/components/game/StreakModal";
import { FishingTab } from "@/components/game/FishingTab";
import { MarketplaceTab } from "@/components/game/MarketplaceTab";
import { FarmPassTab } from "@/components/game/FarmPassTab";
import PetsTab from "@/components/game/PetsTab";
import SkillTreeTab from "@/components/game/SkillTreeTab";
import { OnboardingOverlay, useOnboarding } from "@/components/game/OnboardingOverlay";
import { SKINS } from "@/lib/constants";
import { Sprout, Cat, Factory } from "lucide-react";

interface FloatingReward {
  id: number;
  x: number;
  y: number;
  lines: string[];
}

type FarmSection = "field" | "animals" | "buildings";

const SECTION_EXPAND_TIERS = [
  { maxPlots: 12, cost: 150 },
  { maxPlots: 15, cost: 300 },
  { maxPlots: 18, cost: 600 },
  { maxPlots: 21, cost: 1200 },
  { maxPlots: 25, cost: 2500 },
];

const SEASON_STYLES: Record<string, {
  bg1: string; bg2: string; badge: string; badgeBg: string; hint: string;
}> = {
  spring: { bg1: "#d4edbc", bg2: "#a8d880", badge: "text-green-800",  badgeBg: "#bbde90", hint: "рост ускорен на 20%" },
  summer: { bg1: "#c8e888", bg2: "#90c840", badge: "text-lime-900",   badgeBg: "#aedc6a", hint: "жаркое лето" },
  autumn: { bg1: "#f0d8a0", bg2: "#d4a050", badge: "text-amber-900",  badgeBg: "#e8c06a", hint: "цена продажи +20%" },
  winter: { bg1: "#d0dce8", bg2: "#9ab4cc", badge: "text-slate-800",  badgeBg: "#b8ccdc", hint: "рост замедлен" },
};

// ── Drag state type ─────────────────────────────────────────────────────────────
interface DragItemState {
  type: "seed" | "booster";
  cropId?: string;
  boosterType?: "watering_can" | "sprinkler" | "fertilizer" | "lightning";
  emoji: string;
  x: number;
  y: number;
}

// ── Inventory bottom sheet ─────────────────────────────────────────────────────
function InventorySheet({
  farm, onClose, onActivateItem, onStartDrag,
}: {
  farm: FarmData;
  onClose: () => void;
  onActivateItem: (item: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => void;
  onStartDrag: (item: DragItemState) => void;
}) {
  const seedEntries = Object.entries(farm.seeds).filter(([, c]) => c > 0);
  const cropEntries = Object.entries(farm.inventory as Record<string, number>).filter(([, c]) => c > 0);

  // ── Swipe-to-close via handle (pointer-captured, no framer drag interference) ──
  const dragControls = useDragControls();

  // ── Long-press for drag-to-field ─────────────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);

  const startLongPress = useCallback((e: React.PointerEvent, item: DragItemState) => {
    e.stopPropagation();
    setPressingId(item.cropId ?? item.boosterType ?? "");
    const cx = e.clientX, cy = e.clientY;
    longPressTimer.current = setTimeout(() => {
      setPressingId(null);
      // DON'T call onClose here — parent will close after overlay captures pointer
      onStartDrag({ ...item, x: cx, y: cy });
    }, 380);
  }, [onStartDrag]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setPressingId(null);
  }, []);

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 bg-black/40 z-40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        {/* Sheet — drag only via handle using dragControls */}
        <motion.div
          className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 flex flex-col"
          style={{
            maxHeight: "76vh",
            paddingBottom: "calc(var(--safe-bottom, 0px) + 12px)",
          }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.35 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 250) onClose();
          }}
        >
          {/* ── Drag handle — only this area initiates sheet-swipe ── */}
          <div
            className="flex justify-center pt-3 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-0 pb-3 shrink-0">
            <h2 className="font-black text-lg">🎒 Инвентарь</h2>
            <button onClick={onClose} className="text-gray-400 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 pb-4" style={{ touchAction: "pan-y" }}>

            {/* ── Семена ── */}
            <section className="px-5 mb-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Семена <span className="normal-case font-normal text-gray-300">— удержи и перенеси на поле</span>
              </p>
              {seedEntries.length === 0
                ? <p className="text-sm text-gray-400">Нет семян — купи на Рынке!</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {seedEntries.map(([cropId, count]) => {
                      const crop = CROPS[cropId]; if (!crop) return null;
                      const pressing = pressingId === cropId;
                      return (
                        <motion.div
                          key={cropId}
                          animate={{ scale: pressing ? 1.14 : 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-3 py-2 select-none"
                          style={{ touchAction: "none", cursor: "grab" }}
                          onPointerDown={e => startLongPress(e, { type: "seed", cropId, emoji: crop.emoji, x: e.clientX, y: e.clientY })}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                        >
                          <EmojiImg emoji={crop.emoji} size={22} />
                          <div>
                            <p className="text-xs font-bold text-gray-700 leading-tight">{crop.name}</p>
                            <p className="text-[10px] text-gray-400">{count} шт.</p>
                          </div>
                          {pressing && <span className="w-2 h-2 rounded-full bg-green-500 animate-ping ml-1 shrink-0" />}
                        </motion.div>
                      );
                    })}
                  </div>
                )
              }
            </section>

            {/* ── Урожай ── */}
            {cropEntries.length > 0 && (
              <section className="px-5 mb-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Урожай в хранилище</p>
                <div className="flex flex-wrap gap-2">
                  {cropEntries.map(([cropId, count]) => {
                    const crop = CROPS[cropId]; if (!crop) return null;
                    return (
                      <div key={cropId} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2">
                        <EmojiImg emoji={crop.emoji} size={22} />
                        <div>
                          <p className="text-xs font-bold text-gray-700 leading-tight">{crop.name}</p>
                          <p className="text-[10px] text-gray-400">{count} шт.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Бустеры ── */}
            <section className="px-5 mb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Бустеры <span className="normal-case font-normal text-gray-300">— удержи и перенеси на поле</span>
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { key: "watering_can" as const, emoji: "🪣", name: "Лейка", desc: "Ускоряет рост · шанс двойного урожая", count: farm.items.wateringCans ?? 0, color: "blue" },
                  { key: "sprinkler"    as const, emoji: "💦", name: "Спринклер", desc: "Поливает несколько клеток сразу",        count: farm.items.sprinklers ?? 0,   color: "cyan" },
                  { key: "fertilizer"  as const, emoji: "🌱", name: "Удобрение", desc: "100% двойной урожай с грядки",          count: farm.items.fertilizers ?? 0,  color: "green" },
                  { key: "lightning"   as const, emoji: "⚡", name: "Молния",    desc: "Мгновенное созревание грядки",           count: farm.items.lightnings ?? 0,   color: "yellow" },
                ].map(({ key, emoji, name, desc, count, color }) => {
                  const pressing = pressingId === key;
                  return (
                    <motion.div
                      key={key}
                      animate={{ scale: pressing ? 1.04 : 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className={`flex items-center gap-3 bg-${color}-50 border border-${color}-200 rounded-2xl px-4 py-3 select-none`}
                      style={count > 0 ? { touchAction: "none", cursor: "grab" } : undefined}
                      onPointerDown={count > 0 ? e => startLongPress(e, { type: "booster", boosterType: key, emoji, x: e.clientX, y: e.clientY }) : undefined}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                    >
                      <EmojiImg emoji={emoji} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700">{name}</p>
                        <p className="text-[10px] text-gray-400">{desc}</p>
                      </div>
                      <span className={`text-sm font-black text-${color}-600 mr-1`}>{count} шт.</span>
                      {count > 0 && (
                        <button
                          onClick={() => { onActivateItem(key); onClose(); }}
                          className={`px-3 py-1.5 bg-${color}-600 text-white text-xs font-bold rounded-xl shrink-0`}
                        >
                          Исп.
                        </button>
                      )}
                      {pressing && <span className={`w-2 h-2 rounded-full bg-${color}-500 animate-ping ml-1 shrink-0`} />}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ── Seed shop bottom sheet ──────────────────────────────────────────────────────
function SeedShopSheet({
  farm, onClose, onActivateItem,
}: {
  farm: FarmData;
  onClose: () => void;
  onActivateItem: (item: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => void;
}) {
  const { mutate, isPending } = useFarmAction();
  const dragControls = useDragControls();
  const [tab, setTab] = useState<"seeds" | "boosters" | "sell">("seeds");

  const cropSellItems = Object.entries(farm.inventory as Record<string, number>).filter(([, c]) => c > 0);
  const productSellItems = Object.entries(farm.products).filter(([, c]) => c > 0);

  const tabs = [
    { id: "seeds"   as const, label: "Семена",  emoji: "🌱" },
    { id: "boosters"as const, label: "Бустеры", emoji: "✨" },
    { id: "sell"    as const, label: "Продать",  emoji: "🪙" },
  ];

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 bg-black/40 z-40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 flex flex-col"
          style={{
            maxHeight: "80vh",
            paddingBottom: "calc(var(--safe-bottom, 0px) + 12px)",
          }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.35 }}
          onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 250) onClose(); }}
        >
          {/* Handle */}
          <div
            className="flex justify-center pt-3 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 shrink-0">
            <h2 className="font-black text-lg">🛒 Магазин</h2>
            <div className="text-sm font-bold text-amber-600">🪙 {farm.coins.toLocaleString()} · 💎 {farm.gems}</div>
          </div>
          {/* Sub-tabs */}
          <div className="flex gap-1.5 mx-5 mb-3 bg-muted rounded-2xl p-1 shrink-0">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-all
                    ${isActive ? "bg-card text-green-700 shadow-sm" : "text-muted-foreground"}`}
                >
                  {isActive && (
                    <motion.div layoutId="seedshop-pill"
                      className="absolute inset-0 bg-card rounded-xl shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                  )}
                  <span className="relative z-10 flex items-center gap-1"><EmojiImg emoji={t.emoji} size={14} /> {t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 px-5 pb-4" style={{ touchAction: "pan-y" }}>
            {/* ── Семена (ротирующий магазин) ── */}
            {tab === "seeds" && <div className="-mx-5"><SeedShopTab farm={farm} /></div>}

            {/* ── Бустеры ── */}
            {tab === "boosters" && (
              <div className="flex flex-col gap-4">
                <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl px-4 py-3 text-sm text-foreground/80 leading-snug">
                  <span className="font-bold text-purple-500">✨ Премиум предметы</span> покупаются за 💎 кристаллы. Используй с поля или через инвентарь.
                </div>
                {[
                  { key: "watering_can" as const, emoji: "🪣", name: "Лейка",      desc: "×2–×4 скорость роста + шанс двойного урожая", subdesc: "Уровень прокачки влияет на мощность", single: 3, pack: 7,  packQty: 3, accent: "blue",   count: farm.items?.wateringCans ?? 0 },
                  { key: "sprinkler"    as const, emoji: "💦", name: "Спринклер",  desc: "×1.5–×3 скорость, несколько клеток сразу",    subdesc: "Золотой — зона 3×3, 12 минут",         single: 6, pack: 10, packQty: 2, accent: "cyan",   count: farm.items?.sprinklers ?? 0 },
                  { key: "fertilizer"  as const, emoji: "🌱", name: "Удобрение",  desc: "100% гарантия двойного урожая с грядки",      subdesc: "Применить — нажми на растущую грядку", single: 2, pack: 5,  packQty: 3, accent: "green",  count: farm.items?.fertilizers ?? 0 },
                  { key: "lightning"   as const, emoji: "⚡", name: "Молния",     desc: "Мгновенно созревает одна грядка",             subdesc: "Применить — нажми на растущую грядку", single: 5, pack: 12, packQty: 3, accent: "amber",  count: farm.items?.lightnings ?? 0 },
                ].map((item) => (
                  <div key={item.key} className={`bg-${item.accent}-500/8 border-2 border-${item.accent}-500/30 rounded-2xl overflow-hidden`}>
                    <div className="p-4 flex items-center gap-3">
                      <div className={`w-12 h-12 bg-${item.accent}-500 rounded-xl flex items-center justify-center shadow-md shrink-0`}><EmojiImg emoji={item.emoji} size={26} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-base">{item.name}</div>
                        <div className="text-xs text-muted-foreground leading-snug">{item.desc}</div>
                        <div className="text-[10px] text-muted-foreground/70 leading-snug">{item.subdesc}</div>
                        <div className="text-xs font-bold mt-0.5">В инвентаре: <span className="font-black">{item.count} шт.</span></div>
                      </div>
                      {item.count > 0 && (
                        <button onClick={() => { onActivateItem(item.key); onClose(); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-${item.accent}-500 shrink-0`}>
                          Исп.
                        </button>
                      )}
                    </div>
                    <div className="bg-card/40 border-t border-border/30 px-4 py-2.5 flex gap-2">
                      <button onClick={() => mutate({ action: "buy_item", itemType: item.key, quantity: 1 } as any)}
                        disabled={isPending || farm.gems < item.single}
                        className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm text-center
                          ${farm.gems >= item.single ? `border-${item.accent}-400/60 bg-${item.accent}-500/10 text-${item.accent}-600 active:opacity-80` : "border-border bg-muted text-muted-foreground opacity-50"}`}>
                        ×1 · 💎{item.single}
                      </button>
                      <button onClick={() => mutate({ action: "buy_item", itemType: item.key, quantity: item.packQty } as any)}
                        disabled={isPending || farm.gems < item.pack}
                        className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm text-center relative
                          ${farm.gems >= item.pack ? `border-amber-400/60 bg-amber-500/10 text-amber-600 active:opacity-80` : "border-border bg-muted text-muted-foreground opacity-50"}`}>
                        <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">ВЫГОДА</span>
                        ×{item.packQty} · 💎{item.pack}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-center text-xs text-muted-foreground">Баланс: <span className="font-black text-purple-500">💎 {farm.gems}</span></div>
              </div>
            )}

            {/* ── Продать ── */}
            {tab === "sell" && (
              <div>
                {cropSellItems.length === 0 && productSellItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mb-3 opacity-40 flex justify-center"><EmojiImg emoji="🌾" size={52} /></div>
                    <p className="text-muted-foreground text-sm">Нет товаров для продажи. Соберите урожай!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cropSellItems.map(([id, count]) => {
                      const crop = CROPS[id]; if (!crop) return null;
                      return (
                        <div key={id} className="flex items-center bg-card p-3 rounded-xl border border-border gap-3">
                          <EmojiImg emoji={crop.emoji} size={24} />
                          <div className="flex-1">
                            <div className="font-bold text-sm">{crop.name}</div>
                            <div className="text-xs text-muted-foreground">×{count} · итого 🪙{count * crop.sellPrice}</div>
                          </div>
                          <button onClick={() => mutate({ action: "sell_crops", cropType: id, quantity: count })}
                            disabled={isPending}
                            className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg border-b-2 border-orange-700 active:translate-y-0.5 disabled:opacity-40">
                            Продать
                          </button>
                        </div>
                      );
                    })}
                    {productSellItems.map(([id, count]) => {
                      const prod = PRODUCTS[id]; if (!prod) return null;
                      return (
                        <div key={id} className="flex items-center bg-card p-3 rounded-xl border border-border gap-3">
                          <EmojiImg emoji={prod.emoji} size={24} />
                          <div className="flex-1">
                            <div className="font-bold text-sm">{prod.name}</div>
                            <div className="text-xs text-muted-foreground">×{count} · итого 🪙{count * prod.sellPrice}</div>
                          </div>
                          <button onClick={() => mutate({ action: "sell_product", cropType: id, quantity: count })}
                            disabled={isPending}
                            className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg border-b-2 border-orange-700 active:translate-y-0.5 disabled:opacity-40">
                            Продать
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ── Map Modal ──────────────────────────────────────────────────────────────────
const WORLD_ORDER: WorldId[] = ["main", "forest", "desert", "snow"];

function MapModal({ farm, onClose, onUnlock, onSwitch }: {
  farm: FarmData;
  onClose: () => void;
  onUnlock: (worldId: WorldId) => void;
  onSwitch: (worldId: WorldId) => void;
}) {
  const dragControls = useDragControls();
  const mainPlots = farm.activeWorldId === "main"
    ? farm.plots.length
    : (farm.worlds?.["main"] as { plots?: unknown[] } | undefined)?.plots?.length ?? 0;
  const mainAtMax = mainPlots >= 25;

  return (
    <AnimatePresence>
      <>
        <motion.div className="fixed inset-0 bg-black/40 z-40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 flex flex-col"
          style={{ maxHeight: "82vh", paddingBottom: "calc(var(--safe-bottom, 0px) + 12px)" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          drag="y" dragControls={dragControls} dragListener={false}
          dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.35 }}
          onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 250) onClose(); }}
        >
          <div className="flex justify-center pt-3 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}>
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-5 pt-0 pb-3 shrink-0">
            <h2 className="font-black text-lg">🌍 Карта миров</h2>
            <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 pb-2" style={{ touchAction: "pan-y" }}>
            <div className="flex flex-col gap-3 pb-4">
              {WORLD_ORDER.map((wid) => {
                const cfg = farm.worldConfig?.[wid];
                if (!cfg) return null;
                const isActive = farm.activeWorldId === wid;
                const isUnlocked = wid === "main" || (farm.worlds?.[wid]?.unlocked ?? false);
                const canAfford = farm.coins >= (cfg.unlockCost ?? 0);
                const canUnlock = mainAtMax && canAfford;

                return (
                  <div key={wid}
                    className={`rounded-2xl border-2 overflow-hidden ${isActive ? "border-green-500 ring-2 ring-green-400/40" : isUnlocked ? "border-green-300/40" : "border-gray-200"}`}
                  >
                    <div
                      className={`flex items-center gap-3 px-4 py-3 ${!isUnlocked ? "opacity-60" : ""}`}
                      style={isUnlocked ? { background: `linear-gradient(90deg, ${cfg.bg1}66, ${cfg.bg2}33)` } : { background: "#f5f5f5" }}
                    >
                      <EmojiImg emoji={cfg.emoji} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-base">{cfg.name}</div>
                        {cfg.bonus && (
                          <div className="text-xs font-bold text-green-700 mt-0.5">✨ {cfg.bonusDesc}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Культуры: {(cfg.crops as string[]).map((id: string) => CROPS[id]?.emoji ?? "?").join(" ")}
                        </div>
                      </div>
                      {isActive && (
                        <span className="bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-full shrink-0">ЗДЕСЬ</span>
                      )}
                      {!isUnlocked && (
                        <span className="text-2xl shrink-0">🔒</span>
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-border/30 bg-card/40 flex items-center gap-2">
                      {isUnlocked ? (
                        isActive ? (
                          <span className="text-xs text-muted-foreground">Вы сейчас здесь</span>
                        ) : (
                          <button onClick={() => { onSwitch(wid); onClose(); }}
                            className="flex-1 py-2 bg-green-500 text-white font-bold rounded-xl text-sm active:opacity-80">
                            Перейти →
                          </button>
                        )
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          {!mainAtMax ? (
                            <span className="text-xs text-muted-foreground flex-1">
                              🔒 Расширьте главную ферму до 25 грядок
                            </span>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground flex-1">Открыть территорию</span>
                              <button
                                onClick={() => { if (canUnlock) { onUnlock(wid); onClose(); } }}
                                disabled={!canUnlock}
                                className={`px-4 py-2 rounded-xl font-bold text-sm shrink-0 ${canUnlock ? "bg-amber-500 text-white active:opacity-80" : "bg-muted text-muted-foreground opacity-50"}`}
                              >
                                {cfg.unlockCost} 🪙
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ── Field view ─────────────────────────────────────────────────────────────────
function FieldView({
  farm,
  onPlotTap,
  onExpandPlots,
  isExpanding,
  floatingRewards,
  onRewardDone,
  activeItemMode,
  onCancelItemMode,
  onActivateItem,
  onPlantDirect,
  onUseItemDirect,
  onHarvestAll,
  onOpenMap,
  onSwitchWorld,
  onOpenEventShop,
}: {
  farm: FarmData;
  onPlotTap: (plot: PlotState, rect: DOMRect) => void;
  onExpandPlots: () => void;
  isExpanding: boolean;
  floatingRewards: FloatingReward[];
  onRewardDone: (id: number) => void;
  activeItemMode?: "watering_can" | "sprinkler" | "fertilizer" | "lightning" | null;
  onCancelItemMode?: () => void;
  onActivateItem: (item: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => void;
  onPlantDirect: (plotId: number, cropId: string) => void;
  onUseItemDirect: (plotId: number, itemType: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => void;
  onHarvestAll: () => void;
  onOpenMap: () => void;
  onSwitchWorld: (worldId: WorldId) => void;
  onOpenEventShop?: () => void;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [dragItem, setDragItem] = useState<DragItemState | null>(null);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const dragItemRef = useRef<DragItemState | null>(null);
  const rafRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // After drag ends, block ghost clicks for 400 ms
  const blockClickRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => { dragItemRef.current = dragItem; }, [dragItem]);

  // ── World swipe detection ────────────────────────────────────────────────────
  const unlockedWorlds = WORLD_ORDER.filter(
    (w) => w === "main" || (farm.worlds?.[w]?.unlocked ?? false)
  );
  const currentWorldIdx = unlockedWorlds.indexOf((farm.activeWorldId ?? "main") as WorldId);

  const handleSwipeStart = useCallback((e: React.PointerEvent) => {
    if (dragItemRef.current || activeItemMode) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  }, [activeItemMode]);

  const handleSwipeEnd = useCallback((e: React.PointerEvent) => {
    if (!swipeStartRef.current || dragItemRef.current || activeItemMode) {
      swipeStartRef.current = null;
      return;
    }
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return;

    if (dx < 0 && currentWorldIdx < unlockedWorlds.length - 1) {
      setSwipeDir("left");
      onSwitchWorld(unlockedWorlds[currentWorldIdx + 1]);
      setTimeout(() => setSwipeDir(null), 350);
    } else if (dx > 0 && currentWorldIdx > 0) {
      setSwipeDir("right");
      onSwitchWorld(unlockedWorlds[currentWorldIdx - 1]);
      setTimeout(() => setSwipeDir(null), 350);
    }
  }, [activeItemMode, currentWorldIdx, unlockedWorlds, onSwitchWorld]);

  // ── Drag overlay handlers (no global listeners — overlay div receives events) ─
  const handleOverlayMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const cx = e.clientX, cy = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      setDragItem(prev => prev ? { ...prev, x: cx, y: cy } : null);
      rafRef.current = null;
    });
  }, []);

  const handleOverlayUp = useCallback((e: React.PointerEvent) => {
    const cur = dragItemRef.current;
    if (!cur) return;

    // Disable overlay pointer-events momentarily so elementFromPoint
    // sees the field SVG elements beneath (hit rects have data-plot-id)
    const overlay = e.currentTarget as HTMLElement;
    overlay.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    // No need to re-enable — overlay unmounts when dragItem → null

    const plotIdStr  = el?.getAttribute("data-plot-id");
    const plotStatus = el?.getAttribute("data-plot-status");

    if (plotIdStr) {
      const plotId = parseInt(plotIdStr);
      if (cur.type === "seed" && cur.cropId && plotStatus === "empty") {
        onPlantDirect(plotId, cur.cropId);
      } else if (cur.type === "booster" && cur.boosterType) {
        onUseItemDirect(plotId, cur.boosterType);
      }
    }
    setDragItem(null);
    setInventoryOpen(false);
    // Block the synthetic ghost-click that fires ~16-300ms after pointer-up
    blockClickRef.current = true;
    setTimeout(() => { blockClickRef.current = false; }, 400);
  }, [onPlantDirect, onUseItemDirect]);

  const season = SEASON_CONFIG[farm.season] || SEASON_CONFIG.spring;
  const style  = SEASON_STYLES[farm.season] || SEASON_STYLES.spring;

  // World-specific background overrides for non-main worlds; skin overrides for main world
  const worldId  = farm.activeWorldId ?? "main";
  const worldCfg = farm.worldConfig?.[worldId];
  const activeSkinDef = SKINS.find((s) => s.id === (farm.activeSkin ?? "default"));
  const hasSkinOverride = worldId === "main" && activeSkinDef && activeSkinDef.id !== "default" && activeSkinDef.bg1;
  const bg1 = hasSkinOverride ? activeSkinDef!.bg1 : (worldId !== "main" && worldCfg ? worldCfg.bg1 : style.bg1);
  const bg2 = hasSkinOverride ? activeSkinDef!.bg2 : (worldId !== "main" && worldCfg ? worldCfg.bg2 : style.bg2);

  const readyCount   = farm.plots.filter((p) => p.status === "ready").length;
  const growingCount = farm.plots.filter((p) => p.status === "growing").length;
  const emptyCount   = farm.plots.filter((p) => p.status === "empty").length;

  const nextTier = SECTION_EXPAND_TIERS.find((t) => t.maxPlots > farm.plots.length);
  const atMax    = farm.plots.length >= 25;
  const hasLockedWorlds = worldId === "main" && atMax &&
    WORLD_ORDER.filter((w) => w !== "main").some((w) => !(farm.worlds?.[w]?.unlocked));

  const cols = farm.plots.length <= 9 ? 3 : farm.plots.length <= 16 ? 4 : 5;

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: `linear-gradient(180deg, ${bg1} 0%, ${bg2} 100%)` }}
      onPointerDown={handleSwipeStart}
      onPointerUp={handleSwipeEnd}
      onPointerCancel={() => { swipeStartRef.current = null; }}
      onClickCapture={(e) => {
        // Swallow the synthetic ghost-click that fires after a drag ends
        if (blockClickRef.current) { e.stopPropagation(); e.preventDefault(); }
      }}
    >
      {/* ── Top bar: season + stats ── */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        {/* Season badge */}
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm"
          style={{ background: style.badgeBg }}
        >
          <EmojiImg emoji={season.emoji} size={14} />
          <span className={style.badge}>{season.name}</span>
          <span className={`${style.badge} opacity-60`}>· {style.hint}</span>
        </div>

        <div className="flex-1" />

        {/* 🌍 Map button */}
        <button
          onClick={onOpenMap}
          className="flex items-center gap-1 bg-white/30 backdrop-blur-sm text-gray-800 text-[11px] font-black px-2 py-1 rounded-full shadow-sm active:scale-95 transition-transform mr-1"
        >
          {worldId !== "main" && worldCfg ? `${worldCfg.emoji}` : "🌍"} Карта
        </button>

        {/* Stats pills */}
        <div className="flex items-center gap-1.5">
          {readyCount > 0 && (
            <span className="flex items-center gap-0.5 bg-green-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              ✅ {readyCount}
            </span>
          )}
          {growingCount > 0 && (
            <span className="flex items-center gap-0.5 bg-sky-500/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              🌱 {growingCount}
            </span>
          )}
          <span className="flex items-center gap-0.5 bg-black/10 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
            ◻️ {emptyCount}
          </span>
        </div>
      </div>

      {/* ── Unlock worlds banner ── */}
      <AnimatePresence>
        {hasLockedWorlds && !activeItemMode && readyCount === 0 && (
          <motion.div
            key="worlds-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mb-1.5 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl shadow-md overflow-hidden"
          >
            <span className="flex-1 text-xs font-bold px-3 py-2">
              🗺️ Доступны новые территории!
            </span>
            <button
              onClick={onOpenMap}
              className="shrink-0 bg-white/25 hover:bg-white/35 active:bg-white/20 text-white text-xs font-black px-3 py-2 transition-colors"
            >
              Открыть 🌍
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Item mode / harvest banners ── */}
      <AnimatePresence>
        {activeItemMode && (
          <motion.div
            key="item-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mb-1.5 flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded-xl shadow-lg"
          >
            <span className="text-lg">
              {activeItemMode === "watering_can" ? "🪣" : activeItemMode === "sprinkler" ? "💦" : activeItemMode === "fertilizer" ? "🌱" : "⚡"}
            </span>
            <span className="flex-1 text-xs">
              {activeItemMode === "watering_can"
                ? "Выбери грядку — ускорит рост и даст шанс ×2"
                : activeItemMode === "sprinkler"
                ? "Выбери грядку — спринклер польёт несколько клеток"
                : activeItemMode === "fertilizer"
                ? "Выбери растущую грядку — 100% двойной урожай"
                : "Выбери растущую грядку — мгновенное созревание!"}
            </span>
            <button onClick={onCancelItemMode} className="text-white/80 font-bold text-lg leading-none">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {readyCount > 0 && !activeItemMode && (
          <motion.div
            key="ready-banner"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="mx-3 mb-1.5 flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-md overflow-hidden"
          >
            <span className="flex-1 text-xs font-bold px-3 py-2">
              🎉 {readyCount} {readyCount === 1 ? "грядка готова" : "грядки готовы"}
            </span>
            <button
              onClick={onHarvestAll}
              className="shrink-0 bg-white/25 hover:bg-white/35 active:bg-white/20 text-white text-xs font-black px-3 py-2 transition-colors"
            >
              Собрать всё ✅
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Event Banner ── */}
      {farm.activeEvent && (
        <motion.div
          key="event-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 mb-1.5 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-md overflow-hidden cursor-pointer active:scale-95 transition-transform"
          onClick={() => onOpenEventShop?.()}
        >
          <span className="text-lg px-2 py-2">{farm.activeEvent.emoji}</span>
          <div className="flex-1 py-2">
            <div className="text-xs font-black leading-tight">{farm.activeEvent.name}</div>
            <div className="text-[10px] text-white/80">{farm.eventCoins} {farm.activeEvent.eventCoinEmoji} · {Math.ceil(farm.activeEvent.msLeft / 60000)} мин. осталось</div>
          </div>
          <span className="text-white/90 text-xs font-bold px-3">Магазин →</span>
        </motion.div>
      )}

      {/* ── Field grid — full width, no box ── */}
      <div className="flex flex-col justify-center items-center px-2 pb-1">

        {/* Desktop world nav + field row */}
        <div className="flex items-center w-full justify-center gap-2">

          {/* Desktop: prev world button (left side) */}
          {unlockedWorlds.length > 1 && currentWorldIdx > 0 ? (() => {
            const prevId = unlockedWorlds[currentWorldIdx - 1];
            const cfg = farm.worldConfig?.[prevId];
            return (
              <button
                key="nav-left"
                className="hidden md:flex flex-col items-center justify-center gap-1.5 w-[72px] shrink-0 self-stretch rounded-2xl bg-black/10 hover:bg-black/18 active:scale-95 transition-all border border-white/10"
                onClick={() => { setSwipeDir("right"); onSwitchWorld(prevId); setTimeout(() => setSwipeDir(null), 350); }}
              >
                <span className="text-white/60 text-xl font-black leading-none">‹</span>
                <span className="text-2xl">{cfg?.emoji}</span>
                <span className="text-[9px] font-bold text-center text-white/65 leading-tight px-1 max-w-full break-words">{cfg?.name}</span>
              </button>
            );
          })() : (
            <div className="hidden md:block w-[72px] shrink-0" />
          )}

          {/* Soil-patch with mobile swipe arrows */}
          <div className="relative flex-1 max-w-[520px]">
            {/* Mobile-only left arrow hint */}
            {unlockedWorlds.length > 1 && currentWorldIdx > 0 && (
              <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 pointer-events-none">
                <div className="w-6 h-10 flex items-center justify-center rounded-r-xl bg-black/12 text-white/70 text-sm font-black">‹</div>
              </div>
            )}
            {/* Mobile-only right arrow hint */}
            {unlockedWorlds.length > 1 && currentWorldIdx < unlockedWorlds.length - 1 && (
              <div className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 pointer-events-none">
                <div className="w-6 h-10 flex items-center justify-center rounded-l-xl bg-black/12 text-white/70 text-sm font-black">›</div>
              </div>
            )}

            {/* Soil-patch background strip */}
            <motion.div
              key={farm.activeWorldId}
              className="w-full rounded-2xl overflow-hidden py-3 px-2"
              initial={{ opacity: 0, x: swipeDir === "left" ? 40 : swipeDir === "right" ? -40 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              style={{
                background: "rgba(0,0,0,0.07)",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.12), inset 0 2px 4px rgba(0,0,0,0.08)",
              }}
            >
              <IsometricField
                plots={farm.plots}
                cols={cols}
                onTap={onPlotTap}
                onExpand={onExpandPlots}
                nextTier={nextTier}
                coins={farm.coins}
                activeSprinklers={farm.activeSprinklers}
                selectionMode={activeItemMode}
                weather={farm.currentWeather}
              />
            </motion.div>
          </div>

          {/* Desktop: next world button (right side) */}
          {unlockedWorlds.length > 1 && currentWorldIdx < unlockedWorlds.length - 1 ? (() => {
            const nextId = unlockedWorlds[currentWorldIdx + 1];
            const cfg = farm.worldConfig?.[nextId];
            return (
              <button
                key="nav-right"
                className="hidden md:flex flex-col items-center justify-center gap-1.5 w-[72px] shrink-0 self-stretch rounded-2xl bg-black/10 hover:bg-black/18 active:scale-95 transition-all border border-white/10"
                onClick={() => { setSwipeDir("left"); onSwitchWorld(nextId); setTimeout(() => setSwipeDir(null), 350); }}
              >
                <span className="text-white/60 text-xl font-black leading-none">›</span>
                <span className="text-2xl">{cfg?.emoji}</span>
                <span className="text-[9px] font-bold text-center text-white/65 leading-tight px-1 max-w-full break-words">{cfg?.name}</span>
              </button>
            );
          })() : (
            <div className="hidden md:block w-[72px] shrink-0" />
          )}

        </div>

        {/* World dot indicators */}
        {unlockedWorlds.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2">
            {unlockedWorlds.map((wid, i) => {
              const cfg = farm.worldConfig?.[wid];
              return (
                <motion.div
                  key={wid}
                  animate={{ width: i === currentWorldIdx ? 20 : 6, opacity: i === currentWorldIdx ? 1 : 0.45 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="h-1.5 rounded-full bg-white/80 cursor-pointer"
                  title={cfg?.name}
                />
              );
            })}
          </div>
        )}

        {atMax && unlockedWorlds.length <= 1 && (
          <p className="mt-1.5 text-center text-[11px] text-gray-600 font-semibold">
            🌟 Поле достигло максимума
          </p>
        )}
      </div>

      {/* ── FAB buttons: [🛒 Shop] [🎒 Inventory] ── */}
      {(() => {
        const totalItems = Object.values(farm.seeds).reduce((a, b) => a + b, 0)
          + Object.values(farm.inventory as Record<string, number>).reduce((a, b) => a + b, 0)
          + (farm.items.wateringCans ?? 0) + (farm.items.sprinklers ?? 0) + (farm.items.fertilizers ?? 0) + (farm.items.lightnings ?? 0);
        const totalSeeds = Object.values(farm.seeds).reduce((a, b) => a + b, 0);
        return (
          <div className="sticky flex justify-end gap-2.5 px-3 pb-2 pt-1 pointer-events-none" style={{ bottom: "calc(var(--safe-bottom, 0px) + 72px)" }}>
            <div className="flex gap-2.5 pointer-events-auto">
            {/* Shop FAB */}
            <button
              onClick={() => setShopOpen(true)}
              className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.7)" }}
            >
              <span className="text-xl">🛒</span>
              {totalSeeds > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow">
                  {totalSeeds > 99 ? "99+" : totalSeeds}
                </span>
              )}
            </button>
            {/* Inventory FAB */}
            <button
              onClick={() => setInventoryOpen(true)}
              className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.7)" }}
            >
              <span className="text-xl">🎒</span>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-green-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
            </div>
          </div>
        );
      })()}

      {/* ── Inventory sheet ── */}
      {inventoryOpen && !dragItem && (
        <InventorySheet
          farm={farm}
          onClose={() => setInventoryOpen(false)}
          onActivateItem={(item) => { onActivateItem(item); setInventoryOpen(false); }}
          onStartDrag={(item) => { setDragItem(item); }}
        />
      )}

      {/* ── Seed shop sheet ── */}
      {shopOpen && !dragItem && (
        <SeedShopSheet
          farm={farm}
          onClose={() => setShopOpen(false)}
          onActivateItem={(item) => { onActivateItem(item); setShopOpen(false); }}
        />
      )}

      {/* ── Drag: full-screen capture overlay + floating ghost ── */}
      {dragItem && (
        <>
          {/* Full-screen overlay captures all touch events during drag */}
          <div
            className="fixed inset-0 z-[195] select-none"
            style={{ touchAction: "none", cursor: "grabbing" }}
            onPointerMove={handleOverlayMove}
            onPointerUp={handleOverlayUp}
            onPointerCancel={() => {
              setDragItem(null); setInventoryOpen(false);
              blockClickRef.current = true;
              setTimeout(() => { blockClickRef.current = false; }, 400);
            }}
          />
          {/* Ghost follows the finger — pointer-events:none so overlay stays on top */}
          <motion.div
            className="fixed z-[200] pointer-events-none select-none"
            style={{ left: dragItem.x - 28, top: dragItem.y - 28 }}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.25, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
          >
            <div
              className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(255,255,255,0.7)" }}
            >
              <EmojiImg emoji={dragItem.emoji} size={30} />
            </div>
          </motion.div>
        </>
      )}

      {/* ── Floating reward popups (fixed overlay) ── */}
      <AnimatePresence>
        {floatingRewards.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 1, y: r.y, x: r.x, scale: 0.6 }}
            animate={{ opacity: 0, y: r.y - 100, x: r.x, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            onAnimationComplete={() => onRewardDone(r.id)}
            className="fixed z-[100] pointer-events-none flex flex-col items-center gap-0.5"
            style={{ top: 0, left: 0 }}
          >
            {r.lines.map((line, i) => (
              <div key={i} className={`font-black text-sm drop-shadow-lg px-2 py-0.5 rounded-full
                ${i === 0 ? "bg-yellow-400 text-yellow-900" : "bg-white text-green-700"}`}>
                {line}
              </div>
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function FarmSectionNav({
  active,
  onChange,
  farm,
}: {
  active: FarmSection;
  onChange: (s: FarmSection) => void;
  farm: FarmData;
}) {
  const readyAnimals = farm.animals?.filter((a) => a.status === "ready").length ?? 0;
  const readyCrafts =
    farm.buildings?.filter((b) => b.crafting && new Date() >= new Date(b.crafting.readyAt)).length ?? 0;

  const sections: { id: FarmSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "field", label: "Поле", icon: <Sprout size={16} /> },
    { id: "animals", label: "Животные", icon: <Cat size={16} />, badge: readyAnimals },
    { id: "buildings", label: "Производство", icon: <Factory size={16} />, badge: readyCrafts },
  ];

  return (
    <div className="flex gap-1 bg-muted rounded-2xl p-1 mx-3 mt-1.5 mb-0.5">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`relative flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200 ${
            active === s.id
              ? "bg-card text-green-700 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {s.icon}
          {s.label}
          {(s.badge ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {s.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function FarmGame() {
  const { data: farm, isError, refetch, isFetching } = useFarm();
  const { mutate: performAction, isPending } = useFarmAction();

  const [activeTab, setActiveTab] = useState<Tab>("farm");
  const [farmSection, setFarmSection] = useState<FarmSection>("field");
  const [activePlotId, setActivePlotId] = useState<number | null>(null);
  const [energyModalOpen, setEnergyModalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [showEventShop, setShowEventShop] = useState(false);
  const [floatingRewards, setFloatingRewards] = useState<FloatingReward[]>([]);
  const [activeItemMode, setActiveItemMode] = useState<"watering_can" | "sprinkler" | "fertilizer" | "lightning" | null>(null);
  const rewardIdRef = useRef(0);
  const streakShownRef = useRef(false);
  const { showOnboarding, finishOnboarding } = useOnboarding();

  // ── Playtime tracking refs (must be before early returns) ─────────────────
  const sessionSecondsRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  // Show streak modal once on first load if there's a pending reward
  useEffect(() => {
    if (farm && !streakShownRef.current && farm.streakRewardDay > 0) {
      streakShownRef.current = true;
      setStreakModalOpen(true);
    }
  }, [farm]);

  // Playtime tracking — send accumulated seconds every 30s or on page hide
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      sessionSecondsRef.current += Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (sessionSecondsRef.current >= 60) {
        const toSend = Math.min(sessionSecondsRef.current, 600);
        sessionSecondsRef.current = 0;
        performAction({ action: "record_playtime", seconds: toSend });
      }
    }, 30_000);
    const flush = () => {
      const now = Date.now();
      sessionSecondsRef.current += Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (sessionSecondsRef.current >= 5) {
        const toSend = Math.min(sessionSecondsRef.current, 600);
        sessionSecondsRef.current = 0;
        performAction({ action: "record_playtime", seconds: toSend });
      }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  // Telegram init is handled in App.tsx on mount — nothing to do here

  const handlePlotTap = (plot: PlotState, rect: DOMRect) => {
    if (activeItemMode) {
      const needsGrowing = activeItemMode === "fertilizer" || activeItemMode === "lightning";
      const canApply = needsGrowing ? plot.status === "growing" : (plot.status === "growing" || plot.status === "empty");
      if (canApply) {
        performAction({ action: "use_item", itemType: activeItemMode, plotId: plot.id });
        const cx = rect.left + rect.width / 2;
        const cy = rect.top;
        const id = ++rewardIdRef.current;
        const label =
          activeItemMode === "watering_can" ? "🪣 Полито!" :
          activeItemMode === "sprinkler" ? "💦 Спринклер!" :
          activeItemMode === "fertilizer" ? "🌱 Удобрено!" :
          "⚡ Мгновенный рост!";
        setFloatingRewards((prev) => [...prev, { id, x: cx - 44, y: cy - 16, lines: [label] }]);
      }
      setActiveItemMode(null);
      return;
    }
    if (plot.status === "empty") {
      setActivePlotId(plot.id);
    } else if (plot.status === "ready") {
      const crop = plot.cropType ? CROPS[plot.cropType] : null;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top;
      const id = ++rewardIdRef.current;
      const lines: string[] = [];
      if (crop) lines.push(`${crop.emoji} +${crop.sellPrice ?? 10} 🪙`);
      lines.push(`+XP ⭐`);
      setFloatingRewards((prev) => [...prev, { id, x: cx - 44, y: cy - 16, lines }]);
      performAction({ action: "harvest", plotId: plot.id });
    }
  };

  const handleActivateItem = (itemType: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => {
    setActiveItemMode(itemType);
    setActiveTab("farm");
    setFarmSection("field");
  };

  const handleRewardDone = (id: number) => {
    setFloatingRewards((prev) => prev.filter((r) => r.id !== id));
  };

  const handleExpandPlots = () => {
    performAction({ action: "expand_plots" });
  };

  const handlePlantDirect = (plotId: number, cropId: string) => {
    performAction({ action: "plant", plotId, cropType: cropId });
  };

  const handleUseItemDirect = (plotId: number, itemType: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => {
    performAction({ action: "use_item", itemType, plotId });
  };

  if (!farm) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-4 right-4 flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 shadow-sm z-50">
          <span className="text-sm animate-spin">🌱</span>
          <span className="text-xs text-muted-foreground">Загрузка…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🥀</div>
        <h1 className="font-bold text-2xl text-red-500 mb-2">Ошибка!</h1>
        <p className="text-gray-500 mb-6">Не удалось подключиться к ферме.</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-60"
        >
          {isFetching ? "Подключение…" : "Попробовать снова"}
        </button>
      </div>
    );
  }

  // Guard against stale/malformed data (e.g. cached from a broken API response)
  if (!farm || typeof farm.coins !== "number") {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-4 right-4 flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 shadow-sm z-50">
          <span className="text-sm animate-spin">🌱</span>
          <span className="text-xs text-muted-foreground">Загрузка…</span>
        </div>
      </div>
    );
  }

  const claimableQuests = (farm.quests ?? []).filter((q) => q.completed && !q.claimed).length;
  const claimableAchievements = (farm.achievements ?? []).filter((a) => a.completed && !a.claimed).length;
  const profileBadge = claimableAchievements + (farm.streakRewardDay > 0 ? 1 : 0);
  const telegramId = farm.telegramId;


  return (
    <div
      className="bg-background flex flex-col overflow-hidden w-full"
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      {activeTab !== "admin" && (
        <TopBar farm={farm} onEnergyClick={() => setEnergyModalOpen(true)} />
      )}

      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 72px)" }}
      >
        <AnimatePresence mode="wait">
          {activeTab === "farm" && (
            <motion.div key="farm-wrapper" className="flex flex-col min-h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <FarmSectionNav active={farmSection} onChange={setFarmSection} farm={farm} />
              <AnimatePresence mode="wait">
                {farmSection === "field" && (
                  <motion.div key="field" className="flex flex-col flex-1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>
                    <FieldView farm={farm} onPlotTap={handlePlotTap} onExpandPlots={handleExpandPlots} isExpanding={isPending}
                      floatingRewards={floatingRewards} onRewardDone={handleRewardDone}
                      activeItemMode={activeItemMode} onCancelItemMode={() => setActiveItemMode(null)}
                      onActivateItem={handleActivateItem}
                      onPlantDirect={handlePlantDirect} onUseItemDirect={handleUseItemDirect}
                      onHarvestAll={() => performAction({ action: "harvest_all" })}
                      onOpenMap={() => setMapOpen(true)}
                      onSwitchWorld={(worldId) => performAction({ action: "switch_world", worldId })}
                      onOpenEventShop={() => setShowEventShop(true)} />
                  </motion.div>
                )}
                {farmSection === "animals" && (
                  <motion.div key="animals" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>
                    <AnimalsTab farm={farm} />
                  </motion.div>
                )}
                {farmSection === "buildings" && (
                  <motion.div key="buildings" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>
                    <BuildingsTab farm={farm} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "shop" && (
            <motion.div key="shop" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
              <ShopTab farm={farm} onActivateItem={handleActivateItem} />
            </motion.div>
          )}

          {activeTab === "cases" && (
            <motion.div key="cases" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <CasesTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "fishing" && (
            <motion.div key="fishing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <FishingTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "marketplace" && (
            <motion.div key="marketplace" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <MarketplaceTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "pass" && (
            <motion.div key="pass" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col flex-1 min-h-full">
              <FarmPassTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "friends" && (
            <motion.div key="friends" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col flex-1 min-h-full">
              <FriendsTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <ProfileTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "admin" && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <AdminTab />
            </motion.div>
          )}

          {activeTab === "pets" && (
            <motion.div key="pets" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <PetsTab farm={farm} />
            </motion.div>
          )}

          {activeTab === "skills" && (
            <motion.div key="skills" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <SkillTreeTab farm={farm} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} shopBadge={claimableQuests} profileBadge={profileBadge} telegramId={telegramId} />

      <PlantModal
        isOpen={activePlotId !== null}
        onClose={() => setActivePlotId(null)}
        plotId={activePlotId}
        farm={farm}
      />

      <EnergyModal
        isOpen={energyModalOpen}
        onClose={() => setEnergyModalOpen(false)}
        farm={farm}
      />

      {mapOpen && (
        <MapModal
          farm={farm}
          onClose={() => setMapOpen(false)}
          onUnlock={(worldId) => performAction({ action: "unlock_world", worldId })}
          onSwitch={(worldId) => performAction({ action: "switch_world", worldId })}
        />
      )}

      {streakModalOpen && (
        <StreakModal
          farm={farm}
          onClose={() => setStreakModalOpen(false)}
        />
      )}

      {/* ── Event Shop Modal ── */}
      <AnimatePresence>
        {showEventShop && farm.activeEvent && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEventShop(false)} />
            <motion.div
              className="relative w-full max-w-md bg-card rounded-t-2xl shadow-2xl pb-safe overflow-hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 flex items-center gap-2">
                <span className="text-2xl">{farm.activeEvent.emoji}</span>
                <div className="flex-1">
                  <div className="font-black text-white text-sm">{farm.activeEvent.name}</div>
                  <div className="text-white/80 text-[10px]">{farm.activeEvent.description}</div>
                </div>
                <button onClick={() => setShowEventShop(false)} className="text-white/80 text-xl leading-none font-bold">✕</button>
              </div>
              {/* Balance */}
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <span className="text-lg">{farm.activeEvent.eventCoinEmoji}</span>
                <span className="font-black text-purple-700">{farm.eventCoins}</span>
                <span className="text-xs text-purple-500 ml-1">ивент-монет</span>
                <span className="ml-auto text-[10px] text-gray-400">{Math.ceil(farm.activeEvent.msLeft / 60000)} мин. осталось</span>
              </div>
              {/* Event crops */}
              {farm.activeEvent.eventCrops.length > 0 && (
                <div className="px-4 pt-3">
                  <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">🌱 Ивент-культуры</div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {farm.activeEvent.eventCrops.map((crop) => (
                      <button
                        key={crop.id}
                        onClick={() => performAction({ action: "buy_event_crop_seed", cropType: crop.id, quantity: 1 })}
                        className="flex flex-col items-center bg-white border border-purple-200 rounded-xl p-2 active:scale-95 transition-transform"
                      >
                        <span className="text-2xl mb-1">{crop.emoji}</span>
                        <span className="text-xs font-bold">{crop.name}</span>
                        <span className="text-[10px] text-gray-500">{crop.growSec >= 60 ? `${Math.floor(crop.growSec/60)}мин` : `${crop.growSec}сек`}</span>
                        <span className="text-[11px] font-black text-amber-700 mt-1">🪙{crop.seedCostCoins}/шт</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Shop items */}
              {farm.activeEvent.shopItems.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">🎁 Награды</div>
                  <div className="flex flex-col gap-2">
                    {farm.activeEvent.shopItems.map((item) => (
                      <button
                        key={item.id}
                        disabled={farm.eventCoins < item.cost}
                        onClick={() => performAction({ action: "spend_event_coins", itemId: item.id })}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-95 ${
                          farm.eventCoins >= item.cost
                            ? "bg-white border-purple-200 hover:border-purple-400"
                            : "bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-xl">{item.emoji}</span>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-bold">{item.name}</div>
                          {item.rewardCoins && <div className="text-[10px] text-amber-600">+{item.rewardCoins} 🪙</div>}
                          {item.rewardGems && <div className="text-[10px] text-purple-600">+{item.rewardGems} 💎</div>}
                          {item.rewardSeedType && <div className="text-[10px] text-green-600">+{item.rewardSeedQty} семян</div>}
                        </div>
                        <span className="font-black text-purple-700 text-sm">{item.cost} {farm.activeEvent?.eventCoinEmoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-time onboarding */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay onFinish={finishOnboarding} />
        )}
      </AnimatePresence>
    </div>
  );
}
