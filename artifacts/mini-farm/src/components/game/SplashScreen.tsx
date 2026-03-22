import { useMemo, useCallback, useEffect, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

interface Props {
  onPlay: () => void;
  onSettings?: () => void;
  onAchievements?: () => void;
}

// ── Cloud ─────────────────────────────────────────────────────────────────────
function Cloud({ startX, y, scale = 1, opacity = 0.85, duration, delay }: {
  startX: number; y: number; scale?: number; opacity?: number;
  duration: number; delay: number;
}) {
  return (
    <div style={{
      position: "absolute",
      left: `${startX}%`,
      top: `${y}%`,
      transform: `scale(${scale})`,
      animation: `cloudDrift ${duration}s ${delay}s linear infinite`,
      willChange: "transform",
    }}>
      <div style={{ position: "relative", width: 100, height: 40 }}>
        <div style={{
          position: "absolute", width: 100, height: 30, bottom: 0, left: 0,
          background: `rgba(255,255,255,${opacity})`,
          borderRadius: 18, filter: "blur(2px)",
        }} />
        <div style={{
          position: "absolute", width: 50, height: 44, bottom: 12, left: 16,
          background: `rgba(255,255,255,${opacity})`,
          borderRadius: "50%", filter: "blur(2px)",
        }} />
        <div style={{
          position: "absolute", width: 38, height: 36, bottom: 10, left: 50,
          background: `rgba(255,255,255,${opacity * 0.9})`,
          borderRadius: "50%", filter: "blur(2px)",
        }} />
      </div>
    </div>
  );
}

// ── Grass blade ───────────────────────────────────────────────────────────────
function GrassBlade({ x, h, delay, reverse }: { x: number; h: number; delay: number; reverse: boolean }) {
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      bottom: 0,
      width: 5,
      height: h,
      background: "linear-gradient(to top, #2a7038, #5cc44a)",
      borderRadius: "3px 3px 0 0",
      transformOrigin: "bottom center",
      animation: `${reverse ? "grassSwayR" : "grassSway"} ${2.8 + delay * 0.4}s ${delay}s ease-in-out infinite`,
      willChange: "transform",
    }} />
  );
}

// ── Floating particle ─────────────────────────────────────────────────────────
function Particle({ x, size, delay, duration }: { x: number; size: number; delay: number; duration: number }) {
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      bottom: "33%",
      width: size,
      height: size,
      borderRadius: "50%",
      background: "rgba(255, 240, 120, 0.75)",
      animation: `particleFly ${duration}s ${delay}s ease-out infinite`,
      willChange: "transform, opacity",
    }} />
  );
}

// ── Bee (with direction flip) ─────────────────────────────────────────────────
function Bee({ startX, startY }: { startX: number; startY: number }) {
  const controls = useAnimationControls();
  const [facingLeft, setFacingLeft] = useState(false);

  const fly = useCallback(async () => {
    let curX = 0;
    while (true) {
      const dx = (Math.random() - 0.5) * 100;
      const dy = (Math.random() - 0.5) * 50;
      const dur = 3.5 + Math.random() * 3;

      // Flip emoji based on direction
      setFacingLeft(dx < curX);
      curX = dx;

      await controls.start({
        x: dx, y: dy,
        transition: { duration: dur, ease: "easeInOut" },
      });

      // Hover pause
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 1000));

      // Occasionally dip to a flower
      if (Math.random() < 0.3) {
        await controls.start({ y: dy + 18, transition: { duration: 0.5, ease: "easeIn" } });
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
        await controls.start({ y: dy, transition: { duration: 0.35, ease: "easeOut" } });
      }
    }
  }, [controls]);

  useEffect(() => { fly(); }, [fly]);

  return (
    <motion.div
      animate={controls}
      style={{
        position: "absolute",
        left: `${startX}%`,
        top: `${startY}%`,
        zIndex: 25,
      }}
    >
      <div style={{
        fontSize: 22,
        userSelect: "none",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
        transform: facingLeft ? "scaleX(-1)" : "scaleX(1)",
        transition: "transform 0.2s ease",
        display: "inline-block",
      }}>
        🐝
      </div>
    </motion.div>
  );
}

// ── Hot air balloon ───────────────────────────────────────────────────────────
function Balloon() {
  return (
    <div style={{
      position: "absolute",
      left: "72%",
      top: "50%",
      zIndex: 15,
      animation: "balloonFloat 6s ease-in-out infinite",
    }}>
      <div style={{ fontSize: 44, lineHeight: 1, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>🎈</div>
    </div>
  );
}

// ── Hills ────────────────────────────────────────────────────────────────────
function Hills() {
  return (
    <svg viewBox="0 0 400 100" preserveAspectRatio="none"
      style={{ position: "absolute", bottom: "31%", left: 0, width: "100%", height: 100, zIndex: 4 }}>
      <path d="M0,75 Q60,20 130,55 Q190,5 265,48 Q320,12 400,42 L400,100 L0,100 Z"
        fill="#1a6030" opacity="0.88" />
      <path d="M0,85 Q80,45 160,72 Q230,28 305,68 Q355,38 400,62 L400,100 L0,100 Z"
        fill="#238038" opacity="0.82" />
    </svg>
  );
}

// ── Main SplashScreen ─────────────────────────────────────────────────────────
export function SplashScreen({ onPlay, onSettings, onAchievements }: Props) {
  const grassBlades = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      x: 0.5 + i * 4.5 + Math.random() * 2,
      h: 16 + Math.floor(Math.random() * 18),
      delay: i * 0.15,
      reverse: i % 2 === 0,
    })), []);

  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x: 5 + i * 12 + Math.random() * 6,
      size: 3 + Math.random() * 4,
      delay: i * 1.0 + Math.random() * 1.5,
      duration: 4 + Math.random() * 3,
    })), []);

  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #0b0820 0%, #18104a 18%, #2e1870 38%, #6040b0 58%, #3a9050 76%, #1e6a32 100%)",
      zIndex: 100,
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Sun ── */}
      <div style={{
        position: "absolute", top: "7%", right: "10%",
        width: 60, height: 60, borderRadius: "50%",
        background: "radial-gradient(circle, #ffe566 30%, #ffce45 70%)",
        animation: "sunGlow 4s ease-in-out infinite",
        zIndex: 5,
      }} />

      {/* ── Stars ── */}
      {[{x:8,y:5},{x:22,y:9},{x:42,y:3.5},{x:67,y:8},{x:83,y:4.5},{x:52,y:11},{x:35,y:6}].map((s,i) => (
        <div key={i} style={{
          position:"absolute", left:`${s.x}%`, top:`${s.y}%`,
          width: 2 + i%2, height: 2 + i%2, borderRadius:"50%",
          background:"rgba(255,255,255,0.65)", zIndex:3,
        }} />
      ))}

      {/* ── Far clouds (38-45s) ── */}
      <Cloud startX={-20} y={8}  scale={1.1}  opacity={0.55} duration={42} delay={0}   />
      <Cloud startX={25}  y={13} scale={0.8}  opacity={0.45} duration={38} delay={-16} />

      {/* ── Near clouds (20-28s) ── */}
      <Cloud startX={50}  y={5}  scale={1.3}  opacity={0.82} duration={24} delay={0}   />
      <Cloud startX={-8}  y={17} scale={0.95} opacity={0.72} duration={21} delay={-9}  />
      <Cloud startX={72}  y={20} scale={0.75} opacity={0.60} duration={27} delay={-4}  />

      {/* ── Hills ── */}
      <Hills />

      {/* ── Hot air balloon ── */}
      <Balloon />

      {/* ── Horizon glow ── */}
      <div style={{
        position: "absolute", bottom: "34%", left: 0, right: 0, height: 140,
        background: "radial-gradient(ellipse 85% 85% at 50% 100%, rgba(100,200,90,0.2) 0%, transparent 100%)",
        zIndex: 6, pointerEvents: "none",
      }} />

      {/* ── Scene (trees, house, crops, animals) ── */}
      <div style={{ position: "absolute", bottom: "34%", left: 0, right: 0, zIndex: 8 }}>

        {/* Back left trees */}
        <div style={{ position: "absolute", left: "1%", bottom: -8, fontSize: 58,
          animation: "treeSway 5s 0.5s ease-in-out infinite",
          transformOrigin: "bottom center" }}>🌲</div>
        <div style={{ position: "absolute", left: "13%", bottom: -10, fontSize: 46,
          animation: "treeSway 5.5s 1.2s ease-in-out infinite",
          transformOrigin: "bottom center" }}>🌳</div>

        {/* Back right trees */}
        <div style={{ position: "absolute", right: "1%", bottom: -8, fontSize: 60,
          animation: "treeSwayR 5.2s 0.3s ease-in-out infinite",
          transformOrigin: "bottom center" }}>🌲</div>
        <div style={{ position: "absolute", right: "13%", bottom: -10, fontSize: 48,
          animation: "treeSwayR 4.8s 0.9s ease-in-out infinite",
          transformOrigin: "bottom center" }}>🌳</div>

        {/* House */}
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          bottom: 6, textAlign: "center",
        }}>
          <div style={{ fontSize: 78, lineHeight: 1, filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.5))" }}>🏡</div>
        </div>

        {/* Crops left */}
        <div style={{ position: "absolute", left: "21%", bottom: 8, display: "flex", gap: 6 }}>
          {["🌾","🌻"].map((e,i) => (
            <div key={i} style={{
              fontSize: 26,
              animation: `grassSway ${3.2+i*0.3}s ${i*0.5}s ease-in-out infinite`,
              transformOrigin: "bottom center",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
            }}>{e}</div>
          ))}
        </div>

        {/* Crops right */}
        <div style={{ position: "absolute", right: "21%", bottom: 8, display: "flex", gap: 6 }}>
          {["🍅","🌽"].map((e,i) => (
            <div key={i} style={{
              fontSize: 26,
              animation: `grassSwayR ${3+i*0.35}s ${i*0.4+0.3}s ease-in-out infinite`,
              transformOrigin: "bottom center",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
            }}>{e}</div>
          ))}
        </div>

        {/* Animals — subtle breathing scale, no Y jump */}
        <div style={{
          position: "absolute", left: "34%", bottom: 4, fontSize: 34,
          animation: "animalBreath 3s ease-in-out infinite",
          transformOrigin: "bottom center",
        }}>🐄</div>
        <div style={{
          position: "absolute", right: "32%", bottom: 4, fontSize: 30,
          animation: "animalBreath 3.5s 0.8s ease-in-out infinite",
          transformOrigin: "bottom center",
        }}>🐑</div>
      </div>

      {/* ── Ground strip ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "35%",
        background: "linear-gradient(180deg, #2a8c3e 0%, #196228 100%)",
        zIndex: 10,
      }}>
        {/* Grass blades at top edge */}
        <div style={{ position: "absolute", top: -12, left: 0, right: 0, height: 28, overflow: "hidden" }}>
          {grassBlades.map((b, i) => (
            <GrassBlade key={i} x={b.x} h={b.h} delay={b.delay} reverse={b.reverse} />
          ))}
        </div>

        {/* Multiple grass rows filling the field */}
        {[
          { top: "10%", count: 32, hBase: 18, color1: "#1f6b2e", color2: "#52c444" },
          { top: "22%", count: 28, hBase: 14, color1: "#1a5c28", color2: "#45b038" },
          { top: "34%", count: 30, hBase: 12, color1: "#174f22", color2: "#3a9e30" },
          { top: "46%", count: 26, hBase: 10, color1: "#143d1c", color2: "#318a28" },
          { top: "58%", count: 24, hBase: 8,  color1: "#10301600", color2: "#287520" },
        ].map(({ top, count, hBase, color1, color2 }, ri) =>
          Array.from({ length: count }, (_, i) => ({
            x: 0.5 + i * (99 / count) + (i % 3) * 0.4,
            h: hBase + (i % 5) * 3,
            delay: ri * 0.07 + i * 0.11,
            reverse: (ri + i) % 2 === 1,
          })).map((b, i) => (
            <div key={`gr-${ri}-${i}`} style={{
              position: "absolute",
              left: `${b.x}%`,
              top,
              width: 4,
              height: b.h,
              background: `linear-gradient(to top, ${color1}, ${color2})`,
              borderRadius: "3px 3px 0 0",
              transformOrigin: "bottom center",
              animation: `${b.reverse ? "grassSwayR" : "grassSway"} ${2.4 + b.delay * 0.25}s ${b.delay}s ease-in-out infinite`,
            }} />
          ))
        )}

        {/* Scattered items on the ground */}
        {[
          { e: "🥕", left: "5%",  top: "8%"  },
          { e: "🌿", left: "13%", top: "14%" },
          { e: "🌿", left: "20%", top: "7%"  },
          { e: "🍓", left: "30%", top: "9%"  },
          { e: "🌼", left: "40%", top: "18%" },
          { e: "🌿", left: "47%", top: "11%" },
          { e: "🌿", left: "54%", top: "6%"  },
          { e: "🥕", left: "63%", top: "15%" },
          { e: "🌿", left: "70%", top: "8%"  },
          { e: "🍓", left: "77%", top: "10%" },
          { e: "🌼", left: "85%", top: "17%" },
          { e: "🌿", left: "92%", top: "7%"  },
        ].map(({ e, left, top }, i) => (
          <div key={i} style={{
            position: "absolute", left, top,
            fontSize: 18,
            animation: `grassSway ${3.5 + i * 0.25}s ${i * 0.35}s ease-in-out infinite`,
            transformOrigin: "bottom center",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
          }}>{e}</div>
        ))}
      </div>

      {/* ── Particles ── */}
      {particles.map((p, i) => <Particle key={i} {...p} />)}

      {/* ── Bees (near the field) ── */}
      <Bee startX={18} startY={55} />
      <Bee startX={55} startY={60} />
      <Bee startX={80} startY={52} />

      {/* ── Logo — mid-sky ── */}
      <div style={{
        position: "absolute",
        top: "22%", left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        zIndex: 30, animation: "splashFadeIn 0.8s ease both",
      }}>
        <div style={{ fontSize: 46, lineHeight: 1, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>🌾</div>
        <div style={{
          fontFamily: "Fredoka, sans-serif",
          fontSize: 32, fontWeight: 700, letterSpacing: "0.02em",
          color: "#fff",
          textShadow: "0 2px 14px rgba(0,0,0,0.6), 0 0 40px rgba(255,220,80,0.35)",
          marginTop: 6,
        }}>Мини-Ферма</div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.55)",
          fontFamily: "Nunito, sans-serif",
          letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3,
        }}>Твоя ферма ждёт!</div>
      </div>

      {/* ── Buttons ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingBottom: "calc(var(--safe-bottom, 0px) + 24px)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        zIndex: 30, animation: "splashFadeIn 0.9s 0.15s ease both",
      }}>
        <button onClick={onPlay} style={{
          background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
          border: "none", borderRadius: 20,
          padding: "15px 52px",
          fontSize: 19, fontWeight: 800,
          fontFamily: "Fredoka, sans-serif",
          color: "#fff", letterSpacing: "0.04em",
          boxShadow: "0 5px 0 #15803d, 0 8px 20px rgba(0,0,0,0.35)",
          cursor: "pointer", minWidth: 210,
          transition: "all 0.1s",
        }}
          onPointerDown={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.transform = "translateY(3px)";
            b.style.boxShadow = "0 2px 0 #15803d, 0 4px 10px rgba(0,0,0,0.2)";
          }}
          onPointerUp={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.transform = "";
            b.style.boxShadow = "0 5px 0 #15803d, 0 8px 20px rgba(0,0,0,0.35)";
          }}
        >
          ▶️&nbsp; Играть
        </button>

        <div style={{ display: "flex", gap: 14 }}>
          {[
            { emoji: "⚙️", label: "Настройки", fn: onSettings },
            { emoji: "🏆", label: "Достижения", fn: onAchievements },
          ].map(({ emoji, label, fn }) => (
            <button key={label} onClick={fn} style={{
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(10px)",
              border: "1.5px solid rgba(255,255,255,0.22)",
              borderRadius: 14, padding: "10px 18px",
              fontSize: 14, fontWeight: 700,
              fontFamily: "Nunito, sans-serif",
              color: "rgba(255,255,255,0.88)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>{emoji} {label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
