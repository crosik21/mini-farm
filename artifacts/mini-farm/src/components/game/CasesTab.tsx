import { useState } from "react";
import { motion, AnimatePresence, useAnimate } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTelegramId, hapticFeedback } from "@/lib/telegram";
import { FarmData, CustomCaseMeta } from "@/lib/types";
import {
  GEM_CASES, EXCLUSIVE_CROPS, CASE_RARITY_CROPS,
  CASE_RARITY_LABELS, CASE_RARITY_COLORS, CASE_CROP_RARITY,
  ITEM_EMOJIS, ITEM_NAMES,
} from "@/lib/constants";
import { Sparkles, Package, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CaseResult {
  cropId: string;
  qty: number;
  rarity: "rare" | "epic" | "legendary";
}

type Phase = "idle" | "loading" | "spinning" | "flash" | "reveal";

const ALL_EXCLUSIVE_IDS = Object.keys(EXCLUSIVE_CROPS);

// Horizontal reel constants
const ITEM_W = 100;
const REEL_COUNT = 30;
const VIEWPORT_W = 320;
const SELECTOR_CENTER = VIEWPORT_W / 2;

// ── Floating star particles (overlay bg) ─────────────────────────────────────
function FloatingStars() {
  const stars = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    dur: 2 + Math.random() * 3,
    delay: Math.random() * 2,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Confetti burst ─────────────────────────────────────────────────────────────
function Confetti({ rarity }: { rarity: "rare" | "epic" | "legendary" }) {
  const palettes = {
    rare: ["#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe", "#ffffff"],
    epic: ["#a855f7", "#c084fc", "#e879f9", "#fae8ff", "#ffffff"],
    legendary: ["#f59e0b", "#fbbf24", "#fde68a", "#fffbeb", "#ffffff"],
  };
  const colors = palettes[rarity];
  const particles = Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2;
    const dist = 120 + Math.random() * 140;
    return {
      id: i,
      x: Math.cos(angle) * dist * (0.7 + Math.random() * 0.6),
      y: Math.sin(angle) * dist * (0.7 + Math.random() * 0.6) - 40,
      rotate: Math.random() * 720 - 360,
      scale: 0.5 + Math.random() * 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? "rounded-sm" : "rounded-full",
      dur: 0.9 + Math.random() * 0.8,
      delay: Math.random() * 0.25,
    };
  });
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute w-2.5 h-2.5 ${p.shape}`}
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: p.scale, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: p.scale * 0.3 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ── Light rays (reveal bg) ────────────────────────────────────────────────────
function LightRays({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ opacity: [0, 0.6, 0.3], rotate: 30 }}
      transition={{ duration: 2.5, ease: "easeOut" }}
      style={{
        background: `conic-gradient(from 0deg, transparent 0deg, ${color}22 10deg, transparent 20deg, transparent 40deg, ${color}22 50deg, transparent 60deg, transparent 80deg, ${color}22 90deg, transparent 100deg, transparent 120deg, ${color}22 130deg, transparent 140deg, transparent 160deg, ${color}22 170deg, transparent 180deg, transparent 200deg, ${color}22 210deg, transparent 220deg, transparent 240deg, ${color}22 250deg, transparent 260deg, transparent 280deg, ${color}22 290deg, transparent 300deg, transparent 320deg, ${color}22 330deg, transparent 340deg, transparent 360deg)`,
      }}
    />
  );
}

// ── Reel item card ─────────────────────────────────────────────────────────────
function ReelItem({ cropId, isCenter }: { cropId: string; isCenter: boolean }) {
  const rarity = CASE_CROP_RARITY[cropId] ?? "rare";
  const colors = CASE_RARITY_COLORS[rarity];
  return (
    <div
      className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl border-2 mx-1 transition-all ${
        isCenter ? `${colors.bg} ${colors.border} shadow-lg scale-105` : "bg-white/5 border-white/10"
      }`}
      style={{ width: ITEM_W - 8, height: 110 }}
    >
      <span className="text-4xl leading-none">{ITEM_EMOJIS[cropId] ?? "🌱"}</span>
      <span className={`text-[9px] font-black text-center leading-tight px-1 ${isCenter ? colors.text : "text-white/50"}`}>
        {ITEM_NAMES[cropId] ?? cropId}
      </span>
    </div>
  );
}

// ── Unified case type ──────────────────────────────────────────────────────────
type UnifiedCase = {
  id: string; name: string; emoji: string; gemCost: number;
  description: string; color: string; glowColor: string;
  borderColor: string; textColor: string; isCustom: boolean;
  weights?: { rarity: CaseRarity; chance: number }[];
  minSeeds?: number; maxSeeds?: number;
  drops?: CustomCaseMeta["drops"];
};

function buildUnifiedCases(customCaseMeta: Record<string, CustomCaseMeta>): UnifiedCase[] {
  const staticCases: UnifiedCase[] = GEM_CASES.map((c) => ({
    id: c.id, name: c.name, emoji: c.emoji, gemCost: c.gemCost,
    description: c.description, color: c.color, glowColor: c.glowColor,
    borderColor: c.borderColor, textColor: c.textColor,
    isCustom: false, weights: c.weights, minSeeds: c.minSeeds, maxSeeds: c.maxSeeds,
  }));
  const customCases: UnifiedCase[] = Object.values(customCaseMeta)
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id, name: c.name, emoji: c.emoji, gemCost: c.gemCost,
      description: c.description, color: c.color, glowColor: c.glowColor,
      borderColor: "border-purple-400", textColor: "text-purple-600",
      isCustom: true, drops: c.drops,
    }));
  return [...staticCases, ...customCases];
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CasesTab({ farm }: { farm: FarmData }) {
  const telegramId = getTelegramId();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [reelItems, setReelItems] = useState<string[]>([]);
  const [result, setResult] = useState<CaseResult | null>(null);
  const [showInventory, setShowInventory] = useState(true);
  const [centerIdx, setCenterIdx] = useState<number | null>(null);
  const [reelScope, animateReel] = useAnimate();

  const allCases = buildUnifiedCases((farm.customCaseMeta ?? {}) as Record<string, CustomCaseMeta>);
  const [selectedCaseId, setSelectedCaseId] = useState(allCases[0]?.id ?? GEM_CASES[0].id);

  const selectedCase = allCases.find((c) => c.id === selectedCaseId) ?? allCases[0];
  const canAfford = selectedCase ? farm.gems >= selectedCase.gemCost : false;

  const exclusiveSeeds = ALL_EXCLUSIVE_IDS
    .map((id) => ({ id, qty: (farm.seeds as Record<string, number>)[id] ?? 0 }))
    .filter((s) => s.qty > 0);

  const openCaseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/farm/${telegramId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open_case", caseId: selectedCaseId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка" }));
        throw new Error(err.error || "Ошибка открытия кейса");
      }
      return res.json() as Promise<FarmData & { caseResult: CaseResult }>;
    },
    onError: (err: Error) => {
      hapticFeedback("error");
      setPhase("idle");
      alert(err.message);
    },
  });

  const handleOpen = async () => {
    if (!canAfford || phase !== "idle" || !selectedCase) return;
    hapticFeedback("medium");
    setPhase("loading"); // show overlay immediately with case shake

    try {
      const data = await openCaseMutation.mutateAsync();
      queryClient.setQueryData(["farm", telegramId], data);
      const caseResult = data.caseResult;

      // Build horizontal reel strip — use drop cropIds for custom cases
      const pool = selectedCase?.isCustom && selectedCase.drops && selectedCase.drops.length > 0
        ? selectedCase.drops.map((d) => d.cropId)
        : [...ALL_EXCLUSIVE_IDS];
      const strip: string[] = [];
      for (let i = 0; i < REEL_COUNT - 1; i++) {
        strip.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      strip.push(caseResult.cropId);
      setReelItems(strip);
      setCenterIdx(null);
      setPhase("spinning");

      // Wait one frame for DOM to mount
      await new Promise((r) => setTimeout(r, 60));

      // Compute start & end x so winner ends up centered under selector
      const winnerCenter = (REEL_COUNT - 1) * ITEM_W + ITEM_W / 2;
      const startX = SELECTOR_CENTER - ITEM_W / 2; // center on first item
      const endX = SELECTOR_CENTER - winnerCenter;   // center on winner

      // Phase 1: fast rush (0→1.8s)
      // Phase 2: slow down + arrive (1.8→3.8s)
      await animateReel(
        reelScope.current,
        { x: [startX, endX + ITEM_W * 4, endX] },
        {
          duration: 3.8,
          times: [0, 0.55, 1],
          ease: ["easeIn", [0.22, 0.61, 0.36, 1]],
        }
      );

      // Haptic as reel arrives
      hapticFeedback("success");
      setCenterIdx(REEL_COUNT - 1);

      // Brief pause with winner highlighted, then flash & reveal
      await new Promise((r) => setTimeout(r, 400));
      setPhase("flash");
      await new Promise((r) => setTimeout(r, 200));

      setResult(caseResult);
      setPhase("reveal");
    } catch {
      // errors handled in onError
    }
  };

  const handleClose = () => {
    setPhase("idle");
    setResult(null);
    setReelItems([]);
    setCenterIdx(null);
  };

  const rarityGlowColor = result
    ? result.rarity === "legendary" ? "#f59e0b"
      : result.rarity === "epic" ? "#a855f7"
      : "#3b82f6"
    : "#3b82f6";

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Sparkles size={20} className="text-amber-500" />
        <h2 className="text-lg font-black text-foreground">Гем-кейсы</h2>
        <div className="ml-auto flex items-center gap-1 bg-purple-100 dark:bg-purple-900/40 px-3 py-1 rounded-full">
          <span className="text-purple-600 font-black text-sm">💎 {farm.gems}</span>
        </div>
      </div>

      {/* Case selector cards */}
      <div className={`px-3 grid gap-2.5 mb-4 ${allCases.length <= 3 ? "grid-cols-3" : "grid-cols-3"}`}>
        {allCases.map((gc) => {
          const isSelected = gc.id === selectedCaseId;
          return (
            <motion.button
              key={gc.id}
              whileTap={{ scale: 0.93 }}
              onClick={() => { setSelectedCaseId(gc.id); setPhase("idle"); setResult(null); }}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl py-3.5 px-2 border-2 transition-all
                ${isSelected
                  ? `${gc.borderColor} bg-gradient-to-b ${gc.color} shadow-lg`
                  : "border-border bg-card"
                }`}
              style={isSelected ? { boxShadow: `0 4px 20px ${gc.glowColor}` } : {}}
            >
              {gc.isCustom && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full">✨NEW</span>
              )}
              <motion.span
                className="text-3xl"
                animate={isSelected ? { rotate: [-4, 4, -4], scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              >
                {gc.emoji}
              </motion.span>
              <span className={`text-[10px] font-black leading-tight text-center ${isSelected ? "text-white" : "text-foreground"}`}>
                {gc.name}
              </span>
              <span className={`text-xs font-black ${isSelected ? "text-white/90" : "text-purple-600"}`}>
                💎 {gc.gemCost}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Selected case detail card */}
      <div className="mx-3 rounded-2xl bg-card border border-border p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedCase.color} flex items-center justify-center text-2xl shadow`}>
            {selectedCase.emoji}
          </div>
          <div>
            <p className="font-black text-foreground">{selectedCase.name}</p>
            <p className="text-xs text-muted-foreground">{selectedCase.description}</p>
          </div>
        </div>

        {/* Odds */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-2">Шансы</p>

          {selectedCase.isCustom ? (
            // ── Custom case drops ──
            (selectedCase.drops ?? []).map((drop, i) => {
              const emoji = ITEM_EMOJIS[drop.cropId] ?? (farm.customCropMeta?.[drop.cropId]?.emoji ?? "🌱");
              const name  = ITEM_NAMES[drop.cropId]  ?? (farm.customCropMeta?.[drop.cropId]?.name  ?? drop.cropId);
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2 border bg-muted/40 border-border">
                  <span className="text-base leading-none">{emoji}</span>
                  <span className="text-xs font-bold flex-1 text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">{drop.minQty}–{drop.maxQty} шт.</span>
                  <span className="text-sm font-black text-primary">{Math.round(drop.chance * 100)}%</span>
                </div>
              );
            })
          ) : (
            // ── Static case rarities ──
            (selectedCase.weights ?? []).filter(w => w.chance > 0).map((w) => {
              const colors = CASE_RARITY_COLORS[w.rarity];
              const cropIds = CASE_RARITY_CROPS[w.rarity];
              return (
                <div key={w.rarity} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${colors.bg} ${colors.border}`}>
                  <div className="flex gap-1">
                    {cropIds.map((id) => (
                      <span key={id} className="text-base leading-none">{ITEM_EMOJIS[id]}</span>
                    ))}
                  </div>
                  <span className={`text-xs font-bold flex-1 ${colors.text}`}>
                    {CASE_RARITY_LABELS[w.rarity]}
                  </span>
                  <span className={`text-sm font-black ${colors.text}`}>{Math.round(w.chance * 100)}%</span>
                </div>
              );
            })
          )}

          {!selectedCase.isCustom && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Количество семян: {selectedCase.minSeeds}–{selectedCase.maxSeeds} шт.
            </p>
          )}
        </div>

        {/* Open button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleOpen}
          disabled={!canAfford || phase !== "idle"}
          className={`w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all
            ${canAfford && phase === "idle"
              ? `bg-gradient-to-r ${selectedCase.color} text-white shadow-md`
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
            }`}
          style={canAfford && phase === "idle" ? { boxShadow: `0 4px 16px ${selectedCase.glowColor}` } : {}}
        >
          <Package size={18} />
          Открыть за 💎 {selectedCase.gemCost}
        </motion.button>

        {!canAfford && (
          <p className="text-center text-xs text-red-500 mt-2 font-bold">
            Нужно ещё 💎 {selectedCase.gemCost - farm.gems}
          </p>
        )}
      </div>

      {/* Exclusive crops catalog */}
      <div className="mx-3 rounded-2xl bg-card border border-border overflow-hidden shadow-sm mb-2">
        <button
          onClick={() => setShowInventory(!showInventory)}
          className="w-full flex items-center gap-2 px-4 py-3"
        >
          <span className="text-sm font-black text-foreground flex-1 text-left">🌟 Эксклюзивные культуры</span>
          {showInventory ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
        {showInventory && (
          <div className="px-3 pb-3 grid grid-cols-1 gap-2">
            {ALL_EXCLUSIVE_IDS.map((id) => {
              const crop = EXCLUSIVE_CROPS[id];
              const rarity = CASE_CROP_RARITY[id];
              const colors = CASE_RARITY_COLORS[rarity];
              const owned = (farm.seeds as Record<string, number>)[id] ?? 0;
              return (
                <div key={id} className={`flex items-center gap-3 rounded-xl p-3 border ${colors.bg} ${colors.border}`}>
                  <span className="text-2xl">{crop.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-foreground">{crop.name}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {CASE_RARITY_LABELS[rarity].toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      🪙 {crop.sellPrice} · ⏱ {crop.growTimeSec >= 3600 ? `${crop.growTimeSec / 3600}ч` : `${crop.growTimeSec / 60}м`}
                    </p>
                  </div>
                  {owned > 0 ? (
                    <span className={`text-sm font-black ${colors.text}`}>×{owned}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-bold">Нет</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exclusive inventory tip */}
      {exclusiveSeeds.length > 0 && (
        <div className="mx-3 rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-2">
          <span className="text-lg">🎁</span>
          <div className="flex-1">
            <p className="text-xs font-black text-amber-800">У вас есть эксклюзивные семена</p>
            <p className="text-[10px] text-amber-600">Перейдите на ферму, чтобы посадить их!</p>
          </div>
          <div className="flex gap-1">
            {exclusiveSeeds.slice(0, 3).map((s) => (
              <span key={s.id} className="text-base">{ITEM_EMOJIS[s.id]}</span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          OPENING OVERLAY
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            key="case-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(ellipse at center, #1a0a2e 0%, #0a0014 100%)" }}
          >
            <FloatingStars />

            {/* ── LOADING: case shaking eagerly ──────────────────── */}
            {phase === "loading" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <motion.div
                  animate={{
                    rotate: [-8, 8, -8, 8, -5, 5, 0],
                    scale: [1, 1.05, 1, 1.05, 1],
                    y: [0, -6, 0, -4, 0],
                  }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${selectedCase.color} flex items-center justify-center text-6xl shadow-2xl`}
                  style={{ boxShadow: `0 0 60px ${selectedCase.glowColor}` }}
                >
                  {selectedCase.emoji}
                </motion.div>
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="text-white/70 font-bold text-base"
                >
                  Открываем кейс...
                </motion.p>
              </motion.div>
            )}

            {/* ── SPINNING: horizontal reel ──────────────────────── */}
            {phase === "spinning" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-5 w-full"
              >
                {/* Case badge */}
                <div className={`px-5 py-2 rounded-full bg-gradient-to-r ${selectedCase.color} text-white font-black text-sm shadow-lg`}
                  style={{ boxShadow: `0 0 20px ${selectedCase.glowColor}` }}>
                  {selectedCase.emoji} {selectedCase.name}
                </div>

                {/* Reel viewport */}
                <div className="relative" style={{ width: VIEWPORT_W }}>
                  {/* Top triangle selector */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30 pointer-events-none">
                    <div className="w-0 h-0" style={{
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderTop: "14px solid #fbbf24",
                    }} />
                  </div>
                  {/* Bottom triangle */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 z-30 pointer-events-none">
                    <div className="w-0 h-0" style={{
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderBottom: "14px solid #fbbf24",
                    }} />
                  </div>

                  {/* Left & right fade */}
                  <div className="absolute inset-y-0 left-0 w-16 z-20 pointer-events-none"
                    style={{ background: "linear-gradient(to right, #0a0014, transparent)" }} />
                  <div className="absolute inset-y-0 right-0 w-16 z-20 pointer-events-none"
                    style={{ background: "linear-gradient(to left, #0a0014, transparent)" }} />

                  {/* Center line glow */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 z-10 pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, transparent, #fbbf24, transparent)", boxShadow: "0 0 12px 4px #fbbf2466" }} />

                  {/* Reel strip */}
                  <div className="overflow-hidden rounded-2xl border border-white/10"
                    style={{ height: 128 }}>
                    <div
                      ref={reelScope}
                      className="flex items-center h-full"
                      style={{ willChange: "transform" }}
                    >
                      {reelItems.map((cropId, i) => (
                        <ReelItem key={i} cropId={cropId} isCenter={centerIdx === i} />
                      ))}
                    </div>
                  </div>
                </div>

                <motion.p
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="text-white/50 text-xs font-bold tracking-widest uppercase"
                >
                  Крутим...
                </motion.p>
              </motion.div>
            )}

            {/* ── FLASH: white flash between spin → reveal ─────── */}
            {phase === "flash" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-white"
              />
            )}

            {/* ── REVEAL: winner card ────────────────────────────── */}
            {phase === "reveal" && result && (() => {
              const colors = CASE_RARITY_COLORS[result.rarity];
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative flex flex-col items-center gap-5 px-6 w-full max-w-xs"
                >
                  {/* Light rays */}
                  <LightRays color={rarityGlowColor} />

                  {/* Confetti burst */}
                  <Confetti rarity={result.rarity} />

                  {/* Rarity badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, type: "spring", stiffness: 400, damping: 22 }}
                    className={`px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    ✨ {CASE_RARITY_LABELS[result.rarity]} ✨
                  </motion.div>

                  {/* Glow ring + crop icon */}
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ring */}
                    <motion.div
                      className="absolute rounded-full"
                      animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      style={{
                        width: 160, height: 160,
                        background: `radial-gradient(circle, ${rarityGlowColor}55 0%, transparent 70%)`,
                      }}
                    />
                    <motion.div
                      initial={{ scale: 0.3, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                      className={`relative w-36 h-36 rounded-[2rem] flex items-center justify-center text-7xl border-4 shadow-2xl ${colors.bg} ${colors.border}`}
                      style={{ boxShadow: `0 0 48px ${rarityGlowColor}88, 0 0 96px ${rarityGlowColor}44` }}
                    >
                      {ITEM_EMOJIS[result.cropId] ?? "🌱"}
                    </motion.div>
                  </div>

                  {/* Name + qty */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 22 }}
                    className="text-center"
                  >
                    <p className="text-white font-black text-2xl leading-tight">{ITEM_NAMES[result.cropId]}</p>
                    <p className="text-white/60 text-base font-bold mt-1">×{result.qty} семян</p>
                  </motion.div>

                  {/* Stats row */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 22 }}
                    className={`rounded-2xl px-6 py-3 border ${colors.bg} ${colors.border} flex gap-8`}
                  >
                    <div className="text-center">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Продажа</p>
                      <p className={`font-black text-base ${colors.text}`}>🪙 {EXCLUSIVE_CROPS[result.cropId]?.sellPrice ?? "—"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Рост</p>
                      <p className={`font-black text-base ${colors.text}`}>
                        {(() => {
                          const s = EXCLUSIVE_CROPS[result.cropId]?.growTimeSec ?? 0;
                          return s >= 3600 ? `${s / 3600}ч` : `${s / 60}м`;
                        })()}
                      </p>
                    </div>
                  </motion.div>

                  {/* Claim button */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 22 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className={`w-full py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r ${selectedCase.color}`}
                    style={{ boxShadow: `0 6px 28px ${selectedCase.glowColor}` }}
                  >
                    Забрать! 🎉
                  </motion.button>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
