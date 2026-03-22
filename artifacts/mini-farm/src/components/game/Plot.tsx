import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlotState } from "@/lib/types";
import { CROPS } from "@/lib/constants";
import { EmojiImg } from "@/components/ui/emoji-img";

interface PlotProps {
  plot: PlotState;
  onTap: (plot: PlotState, rect: DOMRect) => void;
  selectionMode?: "watering_can" | "sprinkler" | null;
  hasSprinkler?: boolean;
}

function getStage(p: number): 1 | 2 | 3 {
  if (p < 35) return 1;
  if (p < 72) return 2;
  return 3;
}

const STAGE_SCALE = { 1: 0.40, 2: 0.68, 3: 0.88 };
const STAGE_SWAY  = { 1: 2.6, 2: 2.0, 3: 1.7 };

function formatTime(sec: number) {
  if (sec <= 0) return "Готово!";
  if (sec >= 3600) return `${Math.floor(sec / 3600)}ч`;
  if (sec >= 60)   return `${Math.floor(sec / 60)}м ${sec % 60}с`;
  return `${sec}с`;
}

/* ── Static pebble layout per plot ID (deterministic) ── */
function pebbles(id: number) {
  const rng = (n: number) => ((id * 17 + n * 31) % 100) / 100;
  return [
    { top: 18 + rng(1) * 20, left: 12 + rng(2) * 18, w: 3 + rng(3) * 3, h: 2 + rng(4) * 2 },
    { top: 50 + rng(5) * 18, left: 58 + rng(6) * 22, w: 2 + rng(7) * 3, h: 2 + rng(8) * 2 },
    { top: 72 + rng(9) * 14, left: 28 + rng(10) * 20, w: 4 + rng(11) * 2, h: 2 + rng(12) * 2 },
    { top: 30 + rng(13) * 10, left: 72 + rng(14) * 16, w: 2 + rng(15) * 2, h: 1.5 },
  ];
}

export function Plot({ plot, onTap, selectionMode, hasSprinkler }: PlotProps) {
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [flashing, setFlashing] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const crop    = plot.cropType ? CROPS[plot.cropType] : null;
  const isReady = plot.status === "ready";
  const isGrow  = plot.status === "growing";
  const isEmpty = plot.status === "empty";

  useEffect(() => {
    if (!isGrow || !plot.plantedAt || !plot.readyAt) {
      setProgress(isReady ? 100 : 0);
      setTimeLeft("");
      return;
    }
    const start = new Date(plot.plantedAt).getTime();
    const end   = new Date(plot.readyAt).getTime();
    const total = end - start;
    const tick = () => {
      const now = Date.now();
      setProgress(Math.min(100, Math.max(0, ((now - start) / total) * 100)));
      setTimeLeft(formatTime(Math.max(0, Math.ceil((end - now) / 1000))));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [plot.status, plot.plantedAt, plot.readyAt]);

  const stage = isGrow ? getStage(progress) : 3;

  const handleTap = () => {
    if (isReady) { setFlashing(true); setTimeout(() => setFlashing(false), 380); }
    onTap(plot, btnRef.current?.getBoundingClientRect() ?? new DOMRect());
  };

  /* ── Soil colours by state ── */
  const soilGrad = isEmpty
    ? "from-[#c8966e] via-[#b07848] to-[#9a6838]"      // dry/light
    : isGrow
    ? "from-[#5e3820] via-[#4a2c16] to-[#38220e]"      // moist/dark
    : "from-[#c87832] via-[#b06428] to-[#8a4e1e]";     // ready / golden

  const soilShadow = isReady
    ? "shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),inset_0_-3px_0_rgba(0,0,0,0.4),0_4px_10px_rgba(0,0,0,0.35)]"
    : "shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),inset_0_-3px_0_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.25)]";

  const stones = pebbles(plot.id);

  return (
    <motion.button
      ref={btnRef}
      onClick={handleTap}
      whileTap={{ scale: 0.83 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="relative aspect-square w-full rounded-2xl overflow-visible focus:outline-none select-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* ── Selection mode ring ── */}
      {selectionMode && (
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          className={`absolute inset-0 rounded-2xl border-[3px] z-50 pointer-events-none
            ${selectionMode === "watering_can" ? "border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.7)]"
                                               : "border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.7)]"}`}
        />
      )}
      {selectionMode === "watering_can" && (
        <div className="absolute inset-0 rounded-2xl z-40 flex items-center justify-center pointer-events-none">
          <motion.span
            animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="text-2xl drop-shadow">🪣</motion.span>
        </div>
      )}
      {selectionMode === "sprinkler" && (
        <div className="absolute inset-0 rounded-2xl z-40 flex items-center justify-center pointer-events-none">
          <motion.span
            animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="text-2xl drop-shadow">💦</motion.span>
        </div>
      )}

      {/* ── Active sprinkler droplets ── */}
      {hasSprinkler && (
        <div className="absolute inset-0 rounded-2xl z-30 pointer-events-none overflow-hidden">
          {[0, 1, 2].map((i) => (
            <motion.div key={i}
              className="absolute text-[10px]"
              style={{ left: `${20 + i * 28}%` }}
              initial={{ y: "-10%", opacity: 0 }}
              animate={{ y: "110%", opacity: [0, 0.9, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.4, ease: "easeIn" }}
            >💧</motion.div>
          ))}
          <div className="absolute inset-0 rounded-2xl border border-cyan-400/40" />
        </div>
      )}

      {/* ── Soil base ── */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${soilGrad} ${soilShadow}`} />

      {/* ── Noise / grain texture ── */}
      <div className="absolute inset-0 rounded-2xl opacity-[0.09] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='1' height='1' x='0' y='0' fill='white'/%3E%3Crect width='1' height='1' x='2' y='2' fill='white'/%3E%3Crect width='1' height='1' x='1' y='3' fill='white' opacity='0.5'/%3E%3C/svg%3E\")" }} />

      {/* ══════ EMPTY state ══════ */}
      {isEmpty && (
        <>
          {/* Furrow lines */}
          <svg className="absolute inset-0 w-full h-full rounded-2xl" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="8" y1="32" x2="92" y2="36" stroke="rgba(0,0,0,0.28)" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="8" y1="51" x2="92" y2="55" stroke="rgba(0,0,0,0.22)" strokeWidth="2"   strokeLinecap="round"/>
            <line x1="8" y1="70" x2="92" y2="74" stroke="rgba(0,0,0,0.26)" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Furrow ridges (highlights) */}
            <line x1="8" y1="30" x2="92" y2="34" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="8" y1="49" x2="92" y2="53" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="8" y1="68" x2="92" y2="72" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeLinecap="round"/>
          </svg>

          {/* Pebbles */}
          {stones.map((s, i) => (
            <div key={i} className="absolute rounded-full"
              style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.w, height: s.h,
                background: "rgba(0,0,0,0.28)", transform: "translate(-50%,-50%)" }} />
          ))}

          {/* Tap hint */}
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.65, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="w-7 h-7 rounded-full bg-white/22 border-[1.5px] border-white/40 flex items-center justify-center"
            >
              <span className="text-white/90 text-sm font-bold leading-none">+</span>
            </motion.div>
          </div>
        </>
      )}

      {/* ══════ GROWING state ══════ */}
      {isGrow && crop && (
        <>
          {/* Moist soil sheen */}
          <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-2xl bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />

          {/* Moist furrows (subtle) */}
          <svg className="absolute inset-0 w-full h-full rounded-2xl opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="8" y1="70" x2="92" y2="74" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="8" y1="80" x2="92" y2="84" stroke="rgba(255,255,255,0.10)" strokeWidth="1"   strokeLinecap="round"/>
          </svg>

          {/* Plant */}
          <motion.div
            key={`g-${stage}`}
            initial={{ scale: 0, y: 14, opacity: 0 }}
            animate={{ scale: STAGE_SCALE[stage], y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="absolute inset-0 flex items-end justify-center pb-3 z-10"
          >
            <motion.span
              animate={{ rotate: [-2.5, 2.5, -2.5] }}
              transition={{ repeat: Infinity, duration: STAGE_SWAY[stage], ease: "easeInOut" }}
              className="drop-shadow select-none origin-bottom"
              style={{ display: "inline-block" }}
            >
              <EmojiImg emoji={stage === 1 ? "🌱" : crop.emoji} size={44} />
            </motion.span>
          </motion.div>

          {/* Progress bar */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 flex flex-col gap-0.5">
            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-[8px] font-bold text-white/85 text-center drop-shadow leading-none">{timeLeft}</span>
          </div>
        </>
      )}

      {/* ══════ READY state ══════ */}
      {isReady && crop && (
        <>
          {/* Outer wide glow */}
          <motion.div
            animate={{ scale: [1, 1.55, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ repeat: Infinity, duration: 1.7, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl bg-yellow-300/50 z-0"
          />
          {/* Inner tight ring */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ repeat: Infinity, duration: 2.3, ease: "easeInOut", delay: 0.5 }}
            className="absolute inset-0 rounded-2xl bg-yellow-400/40 z-0"
          />
          {/* Golden soil shimmer */}
          <div className="absolute inset-0 rounded-2xl z-0 overflow-hidden">
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 0.8 }}
              className="absolute inset-0"
              style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,220,80,0.18) 50%, transparent 70%)" }}
            />
          </div>

          {/* Bouncing emoji */}
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="absolute inset-0 flex items-end justify-center pb-3 z-10"
          >
            <EmojiImg emoji={crop.emoji} size={44}
              style={{ filter: "drop-shadow(0 0 8px rgba(255,200,40,0.9))" }} />
          </motion.div>

          {/* ✅ badge */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute -top-2 -right-2 z-30 w-6 h-6 bg-yellow-400 border-2 border-yellow-600 rounded-full shadow-lg flex items-center justify-center"
          >
            <span className="text-[10px]">✅</span>
          </motion.div>
          {/* ×2 double harvest badge */}
          {plot.doubleHarvest && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -left-2 z-30 px-1.5 py-0.5 bg-purple-500 border-2 border-purple-700 rounded-full shadow-lg flex items-center justify-center"
            >
              <span className="text-[9px] font-black text-white leading-none">×2</span>
            </motion.div>
          )}
        </>
      )}

      {/* ── Harvest flash ── */}
      <AnimatePresence>
        {flashing && (
          <motion.div key="flash"
            initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            className="absolute inset-0 rounded-2xl bg-yellow-200 z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
