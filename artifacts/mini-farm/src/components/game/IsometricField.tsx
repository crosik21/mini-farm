import { useEffect, useState } from "react";
import { PlotState } from "@/lib/types";
import { CROPS, formatTime } from "@/lib/constants";
import { EmojiSvgImage } from "@/components/ui/emoji-img";

interface TileCfg { TW: number; TH: number; DEPTH: number; emoji: number; text: number; }
const TILE_CFG: Record<number, TileCfg> = {
  3: { TW: 110, TH: 95, DEPTH: 13, emoji: 38, text: 11 },
  4: { TW: 81,  TH: 70, DEPTH: 10, emoji: 28, text: 9  },
  5: { TW: 63,  TH: 54, DEPTH: 8,  emoji: 21, text: 8  },
};

// ── Cell content (overlays + emoji — no own background) ───────────────────────
function CellContent({
  plot, x, y, cfg, onTap, selectionMode, hasSprinkler,
}: {
  plot: PlotState; x: number; y: number; cfg: TileCfg;
  onTap: (p: PlotState, r: DOMRect) => void;
  selectionMode?: "watering_can" | "sprinkler" | null;
  hasSprinkler?: boolean;
}) {
  const { TW, TH, emoji: emojiSize, text: textSize } = cfg;

  const [progress, setProgress]   = useState(0);
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    if (plot.status !== "growing" || !plot.plantedAt || !plot.readyAt) return;
    const tick = () => {
      const now   = Date.now();
      const start = new Date(plot.plantedAt!).getTime();
      const end   = new Date(plot.readyAt!).getTime();
      setProgress(Math.min(1, Math.max(0, (now - start) / (end - start))));
      const secs = Math.max(0, Math.ceil((end - now) / 1000));
      setTimeLabel(formatTime(secs));
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [plot.plantedAt, plot.readyAt, plot.status]);

  const crop = plot.cropType ? CROPS[plot.cropType] : null;
  const glowColor = selectionMode === "watering_can" ? "#60a5fa" : "#22d3ee";

  return (
    <g
      onClick={(e) => onTap(plot, e.currentTarget.getBoundingClientRect())}
      onPointerDown={(e) => { e.currentTarget.style.opacity = "0.75"; }}
      onPointerUp={(e)   => { e.currentTarget.style.opacity = ""; }}
      onPointerLeave={(e) => { e.currentTarget.style.opacity = ""; }}
      style={{ cursor: "pointer" }}
    >
      {/* Status tint overlay */}
      {plot.status === "growing" && (
        <rect x={x} y={y} width={TW} height={TH} fill="rgba(30,12,0,0.28)" />
      )}
      {plot.status === "ready" && (
        <rect x={x} y={y} width={TW} height={TH} fill="rgba(255,195,40,0.22)" />
      )}

      {/* Furrow lines on empty */}
      {plot.status === "empty" && (
        <g stroke="rgba(255,255,255,0.13)" strokeWidth="1">
          <line x1={x + TW*0.2} y1={y + TH*0.18} x2={x + TW*0.2} y2={y + TH*0.82} />
          <line x1={x + TW*0.4} y1={y + TH*0.13} x2={x + TW*0.4} y2={y + TH*0.87} />
          <line x1={x + TW*0.6} y1={y + TH*0.13} x2={x + TW*0.6} y2={y + TH*0.87} />
          <line x1={x + TW*0.8} y1={y + TH*0.18} x2={x + TW*0.8} y2={y + TH*0.82} />
        </g>
      )}

      {/* Crop image */}
      {crop && (
        <EmojiSvgImage emoji={crop.emoji} x={x + TW/2} y={y + TH/2 + 2} size={emojiSize} />
      )}

      {/* Time label */}
      {plot.status === "growing" && timeLabel && (
        <text x={x + TW/2} y={y + TH * 0.2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={textSize} fill="rgba(255,255,255,0.85)" fontWeight="bold"
          style={{ pointerEvents: "none" }}>
          {timeLabel}
        </text>
      )}

      {/* Progress bar */}
      {plot.status === "growing" && (
        <>
          <rect x={x + TW*0.1} y={y + TH - 11} width={TW*0.8} height={6} rx={3} fill="rgba(0,0,0,0.35)" />
          <rect x={x + TW*0.1} y={y + TH - 11} width={TW*0.8*progress} height={6} rx={3} fill="#4ade80" />
        </>
      )}

      {/* ✅ badge */}
      {plot.status === "ready" && (
        <text x={x + TW - 3} y={y + 4}
          textAnchor="end" dominantBaseline="hanging"
          fontSize={Math.max(10, emojiSize * 0.52)}
          style={{ pointerEvents: "none" }}>✅</text>
      )}

      {/* Sparkles on ready crops */}
      {plot.status === "ready" && (() => {
        const cx = x + TW / 2;
        const cy = y + TH / 2 + 2;
        const r  = emojiSize * 0.72;
        const sparkles = [
          { dx: 0,    dy: -r,   dur: 1.6, delay: 0,    anim: "ambSparkle",  color: "#fcd34d", size: 4 },
          { dx: r,    dy: -r*0.6, dur: 2.0, delay: 0.4, anim: "ambSparkleB", color: "#a78bfa", size: 3 },
          { dx: -r,   dy: -r*0.5, dur: 1.8, delay: 0.8, anim: "ambSparkle",  color: "#34d399", size: 3.5 },
          { dx: r*0.7,dy: r*0.4,  dur: 1.5, delay: 0.2, anim: "ambSparkleB", color: "#fcd34d", size: 2.5 },
          { dx: -r*0.6,dy: r*0.5, dur: 2.2, delay: 1.0, anim: "ambSparkle",  color: "#f472b6", size: 3 },
        ];
        return sparkles.map((s, i) => (
          <g key={i} style={{ transformOrigin: `${cx + s.dx}px ${cy + s.dy}px`, animation: `${s.anim} ${s.dur}s ${s.delay}s ease-in-out infinite`, pointerEvents: "none" }}>
            {/* Star shape: two overlapping rects rotated */}
            <rect
              x={cx + s.dx - s.size / 2}
              y={cy + s.dy - s.size * 1.5}
              width={s.size}
              height={s.size * 3}
              rx={s.size * 0.4}
              fill={s.color}
              opacity={0.9}
            />
            <rect
              x={cx + s.dx - s.size * 1.5}
              y={cy + s.dy - s.size / 2}
              width={s.size * 3}
              height={s.size}
              rx={s.size * 0.4}
              fill={s.color}
              opacity={0.9}
            />
          </g>
        ));
      })()}

      {/* ×2 badge */}
      {plot.doubleHarvest && plot.status === "ready" && (
        <>
          <rect x={x + 3} y={y + 4} width={22} height={13} rx={6} fill="#9333ea" />
          <text x={x + 14} y={y + 10.5} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill="white" fontWeight="bold" style={{ pointerEvents: "none" }}>×2</text>
        </>
      )}

      {/* Selection overlay */}
      {selectionMode && (
        <>
          <rect x={x} y={y} width={TW} height={TH} fill={`${glowColor}28`} />
          <rect x={x} y={y} width={TW} height={TH} fill="none"
            stroke={glowColor} strokeWidth={2.5} />
        </>
      )}

      {/* Sprinkler indicator */}
      {hasSprinkler && !selectionMode && (
        <rect x={x} y={y} width={TW} height={TH} fill="none"
          stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 3" opacity={0.85} />
      )}

      {/* Hit rect — carries plot identity for drag-drop detection */}
      <rect x={x} y={y} width={TW} height={TH} fill="transparent" pointerEvents="all"
        data-plot-id={plot.id} data-plot-status={plot.status} />
    </g>
  );
}

// ── Expand cell ───────────────────────────────────────────────────────────────
function ExpandCell({
  x, y, cfg, cost, canAfford, onClick,
}: {
  x: number; y: number; cfg: TileCfg;
  cost: number; canAfford: boolean; onClick: () => void;
}) {
  const { TW, TH, emoji: emojiSize, text: textSize } = cfg;

  if (!canAfford) {
    return (
      <g opacity={0.55}>
        <rect x={x} y={y} width={TW} height={TH} fill="rgba(0,0,0,0.25)" />
        <EmojiSvgImage emoji="🔒" x={x+TW/2} y={y+TH/2-4} size={emojiSize*0.72} />
        <text x={x+TW/2} y={y+TH/2+emojiSize*0.52} textAnchor="middle" dominantBaseline="middle"
          fontSize={textSize} fill="#ddd" fontWeight="bold" style={{ pointerEvents: "none" }}>{cost}🪙</text>
        <rect x={x} y={y} width={TW} height={TH} fill="transparent" />
      </g>
    );
  }

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={TW} height={TH} fill="rgba(200,145,20,0.55)" />
      <rect x={x} y={y} width={TW} height={TH} fill="none" stroke="#fbbf24" strokeWidth={2}>
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />
      </rect>
      <EmojiSvgImage emoji="🌾" x={x+TW/2} y={y+TH/2-5} size={emojiSize*0.82} />
      <text x={x+TW/2} y={y+TH/2+emojiSize*0.6} textAnchor="middle" dominantBaseline="middle"
        fontSize={textSize} fill="#fef3c7" fontWeight="bold" style={{ pointerEvents: "none" }}>
        {cost}🪙
      </text>
      <rect x={x} y={y} width={TW} height={TH} fill="transparent" pointerEvents="all" />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export interface IsometricFieldProps {
  plots: PlotState[];
  cols: number;
  onTap: (plot: PlotState, rect: DOMRect) => void;
  onExpand: () => void;
  nextTier?: { cost: number; maxPlots: number } | null;
  coins: number;
  activeSprinklers?: Array<{ affectedPlotIds: number[]; expiresAt: string }>;
  selectionMode?: "watering_can" | "sprinkler" | null;
  weather?: "sunny" | "rainy" | "storm";
}

export function IsometricField({
  plots, cols, onTap, onExpand, nextTier, coins, activeSprinklers, selectionMode, weather = "sunny",
}: IsometricFieldProps) {
  const cfg = TILE_CFG[cols as keyof typeof TILE_CFG] ?? TILE_CFG[3];
  const { TW, TH, DEPTH } = cfg;

  const atMax     = plots.length >= 25;
  const hasExpand = !atMax && !!nextTier;
  const total     = hasExpand ? plots.length + 1 : plots.length;
  const numRows   = Math.ceil(total / cols);
  const canAfford = !!nextTier && coins >= nextTier.cost;

  const fieldW = cols * TW;
  const fieldH = numRows * TH;
  const svgW   = fieldW;
  const svgH   = fieldH + DEPTH;

  const cellPos = (i: number) => ({
    x: (i % cols) * TW,
    y: Math.floor(i / cols) * TH,
  });

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      width={svgW}
      height={svgH}
      className="w-full"
      style={{ height: "auto", overflow: "hidden", touchAction: "manipulation" }}
    >
      <defs>
        <clipPath id="fieldClip">
          <rect x={0} y={0} width={svgW} height={svgH} rx={12} ry={12} />
        </clipPath>
      </defs>

      <g clipPath="url(#fieldClip)">

      {/* ── Single unified soil surface ── */}
      <rect x={0} y={0} width={fieldW} height={fieldH} fill="#c0845a" />

      {/* Subtle top highlight across whole field */}
      <rect x={0} y={0} width={fieldW} height={5} fill="rgba(255,255,255,0.12)" />

      {/* ── Grid dividers ── */}
      {/* Vertical lines */}
      {Array.from({ length: cols - 1 }, (_, c) => (
        <line key={`v${c}`}
          x1={(c + 1) * TW} y1={0} x2={(c + 1) * TW} y2={fieldH}
          stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
      ))}
      {/* Horizontal lines */}
      {Array.from({ length: numRows - 1 }, (_, r) => (
        <line key={`h${r}`}
          x1={0} y1={(r + 1) * TH} x2={fieldW} y2={(r + 1) * TH}
          stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
      ))}

      {/* ── Cell contents ── */}
      {plots.map((plot, i) => {
        const { x, y } = cellPos(i);
        const hasSprinkler = (activeSprinklers ?? []).some(
          (s) => s.affectedPlotIds.includes(plot.id) && new Date(s.expiresAt) > new Date()
        );
        return (
          <CellContent
            key={plot.id}
            plot={plot} x={x} y={y}
            cfg={cfg}
            onTap={onTap}
            selectionMode={selectionMode}
            hasSprinkler={hasSprinkler}
          />
        );
      })}

      {hasExpand && (() => {
        const { x, y } = cellPos(plots.length);
        return (
          <ExpandCell
            key="expand"
            x={x} y={y} cfg={cfg}
            cost={nextTier!.cost}
            canAfford={canAfford}
            onClick={onExpand}
          />
        );
      })()}

      {/* ── Single bottom depth strip for whole field ── */}
      <rect x={0} y={fieldH} width={fieldW} height={DEPTH} fill="#7a4e28" />
      {/* depth highlight */}
      <rect x={0} y={fieldH} width={fieldW} height={1} fill="rgba(255,255,255,0.08)" />

      {/* ── Weather overlay ── */}
      {weather === "rainy" && (
        <rect x={0} y={0} width={svgW} height={svgH} fill="rgba(100,150,220,0.10)" pointerEvents="none" />
      )}
      {weather === "storm" && (
        <rect x={0} y={0} width={svgW} height={svgH} fill="rgba(60,60,100,0.18)" pointerEvents="none" />
      )}

      </g>
    </svg>
  );
}
