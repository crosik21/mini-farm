import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { CROPS } from "@/lib/constants";
import { EmojiImg } from "@/components/ui/emoji-img";
import { FarmData } from "@/lib/types";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TELEGRAM_ID = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? "";

type Rarity = "common" | "rare" | "epic" | "legendary";

interface ShopSlot {
  slotIndex: number;
  cropId: string;
  rarity: Rarity;
  price: number;
  stock: number;
  bought: number;
  isSeedOfDay?: boolean;
  discountPct?: number;
  outOfStock?: boolean;
}

interface ShopData {
  epoch: number;
  nextRefreshMs: number;
  slots: ShopSlot[];
}

// ── Rarity config ─────────────────────────────────────────────────────────────
const RARITY_LABEL: Record<Rarity, string> = {
  common: "Обычное",
  rare: "Редкое",
  epic: "Эпическое",
  legendary: "Легендарное",
};

const RARITY_STYLES: Record<Rarity, {
  border: string;
  bg: string;
  badge: string;
  glow: string;
  labelColor: string;
}> = {
  common: {
    border: "border-border",
    bg: "bg-card",
    badge: "bg-muted text-muted-foreground",
    glow: "",
    labelColor: "text-muted-foreground",
  },
  rare: {
    border: "border-blue-400",
    bg: "bg-blue-50/30",
    badge: "bg-blue-100 text-blue-700",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.25)]",
    labelColor: "text-blue-600",
  },
  epic: {
    border: "border-purple-500",
    bg: "bg-purple-50/30",
    badge: "bg-purple-100 text-purple-700",
    glow: "shadow-[0_0_16px_rgba(168,85,247,0.30)]",
    labelColor: "text-purple-600",
  },
  legendary: {
    border: "border-amber-500",
    bg: "bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.40)]",
    labelColor: "text-amber-600",
  },
};

const RARITY_EMOJI: Record<Rarity, string> = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🌟",
};

// ── Countdown timer ───────────────────────────────────────────────────────────
function useCountdown(initialMs: number, onEnd: () => void) {
  const [ms, setMs] = useState(initialMs);

  useEffect(() => {
    setMs(initialMs);
  }, [initialMs]);

  useEffect(() => {
    if (ms <= 0) {
      onEnd();
      return;
    }
    const iv = setInterval(() => {
      setMs((prev) => {
        if (prev <= 1000) { onEnd(); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [ms, onEnd]);

  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}м ${s.toString().padStart(2, "0")}с` : `${s}с`;
}

// ── Shimmer animation for epic/legendary ─────────────────────────────────────
function RarityShimmer({ rarity }: { rarity: Rarity }) {
  if (rarity === "common" || rarity === "rare") return null;
  const color = rarity === "legendary" ? "from-amber-300/0 via-amber-200/60 to-amber-300/0" : "from-purple-300/0 via-purple-200/50 to-purple-300/0";
  return (
    <motion.div
      className={`absolute inset-0 bg-gradient-to-r ${color} rounded-2xl pointer-events-none`}
      animate={{ x: ["-100%", "200%"] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1.5 }}
    />
  );
}

// ── Crop name helper ─────────────────────────────────────────────────────────
function cropName(cropId: string, farm: FarmData): string {
  const base = CROPS[cropId as keyof typeof CROPS];
  if (base) return base.name;
  const custom = (farm.customCropMeta ?? {})[cropId];
  return custom?.name ?? cropId;
}

function cropEmoji(cropId: string, farm: FarmData): string {
  const base = CROPS[cropId as keyof typeof CROPS];
  if (base) return base.emoji;
  const custom = (farm.customCropMeta ?? {})[cropId];
  return custom?.emoji ?? "🌱";
}

// ── Single slot card ─────────────────────────────────────────────────────────
function SlotCard({ slot, farm, onBuy }: {
  slot: ShopSlot;
  farm: FarmData;
  onBuy: (slotIndex: number, silent?: boolean) => void;
}) {
  const styles = RARITY_STYLES[slot.rarity];
  const outOfStock = slot.outOfStock === true;
  const soldOut = !outOfStock && slot.bought >= slot.stock;
  const canBuy = !outOfStock && !soldOut && farm.coins >= slot.price;
  const noMoney = !outOfStock && !soldOut && farm.coins < slot.price;

  // ── Hold-to-buy state ──
  const [holdCount, setHoldCount] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdCountRef = useRef(0);
  const maxBuysRef   = useRef(0);
  const initDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = useCallback(() => {
    if (initDelayRef.current) { clearTimeout(initDelayRef.current); initDelayRef.current = null; }
    if (repeatRef.current)    { clearInterval(repeatRef.current);   repeatRef.current    = null; }
    setIsHolding(false);
    holdCountRef.current = 0;
    setHoldCount(0);
  }, []);

  const startHold = useCallback(() => {
    if (!canBuy) return;
    // Capture the max buys allowed at hold start
    maxBuysRef.current = slot.stock - slot.bought;
    onBuy(slot.slotIndex, false);
    holdCountRef.current = 1;
    setHoldCount(1);
    setIsHolding(true);

    initDelayRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => {
        if (holdCountRef.current >= maxBuysRef.current) {
          stopHold();
          return;
        }
        onBuy(slot.slotIndex, true);
        holdCountRef.current += 1;
        setHoldCount(holdCountRef.current);
      }, 150);
    }, 420);
  }, [canBuy, onBuy, slot.slotIndex, slot.stock, slot.bought, stopHold]);

  useEffect(() => () => stopHold(), [stopHold]);

  const btnColor = soldOut || noMoney
    ? "bg-muted text-muted-foreground border-muted opacity-60 cursor-not-allowed"
    : slot.rarity === "legendary" ? "bg-amber-500 text-white border-amber-700 shadow-sm"
    : slot.rarity === "epic"      ? "bg-purple-500 text-white border-purple-700 shadow-sm"
    : slot.rarity === "rare"      ? "bg-blue-500   text-white border-blue-700 shadow-sm"
    :                                "bg-green-500  text-white border-green-700";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`relative rounded-2xl border-2
        ${outOfStock ? "border-border bg-muted/40 opacity-60 grayscale" : `${styles.border} ${styles.bg} ${styles.glow}`}
        ${slot.isSeedOfDay ? "col-span-2" : ""}`}
    >
      {/* Out-of-stock overlay label */}
      {outOfStock && (
        <div className="absolute top-0 left-0 right-0 flex justify-center z-10">
          <span className="bg-slate-700 text-white text-[9px] font-black px-3 py-0.5 rounded-b-lg tracking-wide">
            🚫 НЕТ В НАЛИЧИИ
          </span>
        </div>
      )}

      {/* Seed of the Day banner */}
      {slot.isSeedOfDay && !outOfStock && (
        <div className="absolute top-0 right-0 bg-amber-400 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-xl rounded-tr-xl tracking-wide z-10">
          🌟 СЕМЯ ДНЯ
        </div>
      )}

      {/* Discount badge */}
      {slot.discountPct && !outOfStock && (
        <div className="absolute top-0 left-0 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-tr-xl rounded-bl-xl tracking-wide z-10">
          -{slot.discountPct}%
        </div>
      )}

      {/* Inner container — overflow-hidden clips the shimmer animation only */}
      <div className="relative overflow-hidden rounded-2xl p-3">
        {!outOfStock && <RarityShimmer rarity={slot.rarity} />}

        <div className={`flex ${slot.isSeedOfDay ? "gap-4 items-center" : "flex-col items-center gap-1"} ${outOfStock ? "mt-3" : ""}`}>
          {/* Emoji */}
          <div className="flex items-center justify-center">
            <EmojiImg emoji={cropEmoji(slot.cropId, farm)} size={slot.isSeedOfDay ? 44 : 36} />
          </div>

          <div className={`flex-1 ${slot.isSeedOfDay ? "" : "w-full"}`}>
            {/* Name + rarity */}
            <p className={`font-bold text-foreground truncate ${slot.isSeedOfDay ? "text-base" : "text-xs text-center"}`}>
              {cropName(slot.cropId, farm)}
            </p>
            <div className={`flex items-center ${slot.isSeedOfDay ? "gap-2 mt-0.5" : "justify-center mt-0.5"}`}>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${outOfStock ? "bg-muted text-muted-foreground" : styles.badge}`}>
                {RARITY_EMOJI[slot.rarity]} {RARITY_LABEL[slot.rarity]}
              </span>
            </div>

            {/* Stock */}
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {outOfStock ? "Появится в следующей ротации" : soldOut ? "Раскуплено" : `Осталось: ${slot.stock - slot.bought}/${slot.stock}`}
            </p>
          </div>
        </div>

        {/* Price + Buy button */}
        {!outOfStock && (
          <div className={`mt-2 ${slot.isSeedOfDay ? "flex items-center gap-3" : ""}`}>
            <div className={`text-center font-black text-sm text-amber-600 ${slot.isSeedOfDay ? "" : "mb-1.5"}`}>
              🪙 {slot.price}
            </div>

            {/* Hold-to-buy button */}
            <div className="relative w-full select-none">
              <button
                disabled={!canBuy && !isHolding}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(); }}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-full py-1.5 rounded-xl text-xs font-bold transition-colors border-b-2 touch-none
                  ${isHolding ? "scale-95 brightness-90" : "active:translate-y-0.5"}
                  ${btnColor}`}
              >
                {soldOut ? "Раскуплено" : noMoney ? "Мало монет" : "Купить"}
              </button>

              {/* Held-count badge */}
              <AnimatePresence>
                {isHolding && holdCount > 0 && (
                  <motion.div
                    key="hold-badge"
                    initial={{ opacity: 0, scale: 0.5, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 4 }}
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-black px-2 py-0.5 rounded-full pointer-events-none whitespace-nowrap z-20 shadow-md"
                  >
                    ×{holdCount} — 🪙{holdCount * slot.price}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main SeedShopTab ──────────────────────────────────────────────────────────
export function SeedShopTab({ farm }: { farm: FarmData }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<ShopData>({
    queryKey: ["seed-shop"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/farm/seed-shop`, {
        headers: { "x-telegram-id": TELEGRAM_ID },
      });
      if (!res.ok) throw new Error("Ошибка загрузки магазина");
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const handleRefreshEnd = useCallback(() => {
    refetch();
  }, [refetch]);

  const countdown = useCountdown(data?.nextRefreshMs ?? 300000, handleRefreshEnd);

  const buyMutation = useMutation({
    mutationFn: async ({ slotIndex }: { slotIndex: number; silent?: boolean }) => {
      const telegramId = TELEGRAM_ID;
      const res = await fetch(`${API_BASE}/api/farm/${telegramId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-id": telegramId },
        body: JSON.stringify({ action: "buy_shop_seed", slotIndex }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Ошибка покупки");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["farm"] });
      refetch();
      if (!vars.silent) toast({ title: "✅ Семя добавлено!" });
    },
    onError: (_e: Error, vars) => {
      if (!vars.silent) toast({ title: "❌ " + _e.message, variant: "destructive" });
    },
  });

  const handleBuy = useCallback((slotIndex: number, silent = false) => {
    buyMutation.mutate({ slotIndex, silent });
  }, [buyMutation]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="mb-3 animate-spin"><EmojiImg emoji="🌱" size={40} /></div>
        <p className="text-sm font-semibold">Загружаем магазин…</p>
      </div>
    );
  }

  const slots = data?.slots ?? [];
  const sodSlot = slots.find((s) => s.isSeedOfDay);
  const regularSlots = slots.filter((s) => !s.isSeedOfDay);

  return (
    <div className="px-4 py-4 pb-6">
      {/* Header with timer */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg text-foreground">🏪 Семенной рынок</h2>
          <p className="text-xs text-muted-foreground">Ассортимент обновляется каждые 5 минут</p>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-3 py-2">
          <span className="text-sm">⏱</span>
          <span className="font-mono text-sm font-bold text-foreground">{countdown}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(["common", "rare", "epic", "legendary"] as Rarity[]).map((r) => (
          <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RARITY_STYLES[r].badge}`}>
            {RARITY_EMOJI[r]} {RARITY_LABEL[r]}
          </span>
        ))}
      </div>

      {/* Seed of the Day */}
      {sodSlot && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">🌟 Семя дня (−25%)</p>
          <SlotCard slot={sodSlot} farm={farm} onBuy={handleBuy} />
        </div>
      )}

      {/* Regular slots grid */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Текущий ассортимент</p>
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-2 gap-3">
          {regularSlots.map((slot) => (
            <SlotCard
              key={`${data?.epoch}_${slot.slotIndex}`}
              slot={slot}
              farm={farm}
              onBuy={handleBuy}
            />
          ))}
        </div>
      </AnimatePresence>

      {/* Info footer */}
      <div className="mt-6 bg-muted/30 border border-border rounded-2xl p-4">
        <p className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-widest">Как работает магазин</p>
        <div className="space-y-1">
          {[
            "⏱ Ассортимент у всех игроков одинаковый",
            "🟣 Эпические и 🌟 Легендарные — строго ограничены",
            "🌟 Семя дня — скидка 25%, меняется каждый час",
            "🔒 Лимит покупок защищён сервером",
          ].map((tip, i) => (
            <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
