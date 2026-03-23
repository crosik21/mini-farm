import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFarmAction } from "@/hooks/use-farm";
import { FarmData, FarmPass, PassLevelReward, PassReward } from "@/lib/types";
import { Lock, Star, CheckCircle } from "lucide-react";

interface FarmPassTabProps {
  farm: FarmData;
}

function formatReward(reward: PassReward): string {
  if (reward.type === "coins") return `🪙 ${reward.amount}`;
  if (reward.type === "gems") return `💎 ${reward.amount}`;
  if (reward.type === "seeds") return `🌱 ${reward.seedQty} ${reward.seedType}`;
  if (reward.type === "pet") return `🦄 Единорог`;
  return "?";
}

function getRewardEmoji(reward: PassReward): string {
  if (reward.type === "coins") return "🪙";
  if (reward.type === "gems") return "💎";
  if (reward.type === "seeds") return "🌱";
  if (reward.type === "pet") return "🦄";
  return "🎁";
}

function XpBar({ xp, level, xpPerLevel, maxLevel }: { xp: number; level: number; xpPerLevel: number; maxLevel: number }) {
  const levelXp = xp % xpPerLevel;
  const pct = level >= maxLevel ? 100 : Math.min(100, (levelXp / xpPerLevel) * 100);
  const toNext = level >= maxLevel ? 0 : xpPerLevel - levelXp;

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{level >= maxLevel ? "Максимальный уровень!" : `До следующего уровня: ${toNext} XP`}</span>
        <span>Всего XP: {xp}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

interface RewardCellProps {
  reward: PassReward;
  level: number;
  track: "free" | "premium";
  isPremium: boolean;
  passLevel: number;
  claimed: boolean;
  maxLevel: number;
  onClaim: (level: number, track: "free" | "premium") => void;
  isPending: boolean;
}

function RewardCell({ reward, level, track, isPremium, passLevel, claimed, maxLevel, onClaim, isPending }: RewardCellProps) {
  const reached = passLevel >= level;
  const locked = track === "premium" && !isPremium;
  const canClaim = reached && !claimed && !locked;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[68px]">
      <motion.button
        onClick={() => canClaim && onClaim(level, track)}
        whileTap={canClaim ? { scale: 0.9 } : {}}
        disabled={!canClaim || isPending}
        className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center relative transition-all
          ${claimed
            ? "bg-green-500/20 border-green-400/60"
            : locked
              ? "bg-gray-800/30 border-gray-600/30 dark:bg-gray-900/50"
              : canClaim
                ? "bg-amber-400/20 border-amber-400/70 shadow-md animate-pulse"
                : reached
                  ? "bg-card border-border"
                  : "bg-muted/50 border-border/40 opacity-60"
          }`}
      >
        {claimed ? (
          <CheckCircle size={20} className="text-green-500" />
        ) : locked ? (
          <div className="flex flex-col items-center">
            <span className="text-lg opacity-40">{getRewardEmoji(reward)}</span>
            <Lock size={10} className="text-muted-foreground" />
          </div>
        ) : (
          <span className="text-xl">{getRewardEmoji(reward)}</span>
        )}
      </motion.button>
      <div className="text-[9px] text-center text-muted-foreground leading-tight px-0.5 max-w-[64px]">
        {locked ? "Пасс" : formatReward(reward)}
      </div>
    </div>
  );
}

function LevelMarker({ level, passLevel, maxLevel }: { level: number; passLevel: number; maxLevel: number }) {
  const reached = passLevel >= level;
  return (
    <div className={`min-w-[68px] flex flex-col items-center gap-1`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all
        ${level === maxLevel
          ? "bg-amber-400 border-amber-500 text-black"
          : reached
            ? "bg-green-500 border-green-600 text-white"
            : "bg-muted border-border text-muted-foreground"
        }`}
      >
        {level}
      </div>
      {level < maxLevel && (
        <div className={`h-0.5 w-full ${reached ? "bg-green-400" : "bg-border"} transition-colors`} />
      )}
    </div>
  );
}

export function FarmPassTab({ farm }: FarmPassTabProps) {
  const { mutate: performAction, isPending } = useFarmAction();
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);

  const pass: FarmPass | null = farm.farmPass ?? null;
  const passLevel = pass?.level ?? 1;
  const passXp = pass?.xp ?? 0;
  const isPremium = pass?.isPremium ?? false;
  const freeTrackClaimed = pass?.freeTrackClaimed ?? [];
  const premiumTrackClaimed = pass?.premiumTrackClaimed ?? [];
  const rewards = pass?.rewards ?? [];
  const xpPerLevel = pass?.xpPerLevel ?? 50;
  const maxLevel = pass?.maxLevel ?? 20;

  const seasonEndAt = pass?.seasonEndAt ? new Date(pass.seasonEndAt) : null;
  const msLeft = seasonEndAt ? Math.max(0, seasonEndAt.getTime() - Date.now()) : 0;
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  const handleClaim = (level: number, track: "free" | "premium") => {
    performAction({ action: "claim_pass_reward", passLevel: level, track });
  };

  const handleBuyPass = () => {
    performAction({ action: "buy_premium_pass" }, {
      onSuccess: () => setShowBuyConfirm(false),
      onError: () => setShowBuyConfirm(false),
    });
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-400/30 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-black text-lg text-foreground">🏆 Фарм-Пасс</h2>
              <p className="text-xs text-muted-foreground">
                {daysLeft > 0 ? `Осталось ${daysLeft} дн.` : "Сезон завершён"}
                {" · "}Уровень {passLevel}/{maxLevel}
              </p>
            </div>
            {isPremium ? (
              <div className="bg-amber-400 text-black text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
                ✨ ПРЕМИУМ
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowBuyConfirm(true)}
                className="bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black px-3 py-2 rounded-2xl shadow-md"
              >
                Купить 💎99
              </motion.button>
            )}
          </div>

          <XpBar xp={passXp} level={passLevel} xpPerLevel={xpPerLevel} maxLevel={maxLevel} />

          <div className="mt-2.5 flex gap-3 text-[10px] text-muted-foreground">
            <span>🌱 Посев +1 XP</span>
            <span>🌾 Сбор +3 XP</span>
            <span>🐔 Корм +2 XP</span>
            <span>⚙️ Крафт +5 XP</span>
          </div>
        </div>
      </div>

      {/* Reward tracks - horizontal scroll */}
      <div className="px-4 pb-8">
        {/* Premium track label */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`text-[10px] font-black px-2 py-1 rounded-full ${isPremium ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
            {isPremium ? "✨ ПРЕМИУМ" : "🔒 ПРЕМИУМ"}
          </div>
          {!isPremium && (
            <span className="text-[10px] text-muted-foreground">Купи пасс, чтобы разблокировать</span>
          )}
        </div>

        {/* Horizontal scroll reward grid */}
        <div className="overflow-x-auto">
          <div className="inline-flex gap-0 min-w-max pb-2">
            {rewards.map((r) => (
              <div key={r.level} className="flex flex-col items-center">
                {/* Premium row */}
                <RewardCell
                  reward={r.premium}
                  level={r.level}
                  track="premium"
                  isPremium={isPremium}
                  passLevel={passLevel}
                  claimed={premiumTrackClaimed.includes(r.level)}
                  maxLevel={maxLevel}
                  onClaim={handleClaim}
                  isPending={isPending}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Level markers */}
        <div className="overflow-x-auto mt-1">
          <div className="inline-flex gap-0 min-w-max">
            {rewards.map((r) => (
              <LevelMarker key={r.level} level={r.level} passLevel={passLevel} maxLevel={maxLevel} />
            ))}
          </div>
        </div>

        {/* Free track label */}
        <div className="flex items-center gap-2 mt-1 mb-2">
          <div className="text-[10px] font-black px-2 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
            ✅ БЕСПЛАТНО
          </div>
        </div>

        {/* Free track */}
        <div className="overflow-x-auto">
          <div className="inline-flex gap-0 min-w-max pb-2">
            {rewards.map((r) => (
              <div key={r.level} className="flex flex-col items-center">
                <RewardCell
                  reward={r.free}
                  level={r.level}
                  track="free"
                  isPremium={isPremium}
                  passLevel={passLevel}
                  claimed={freeTrackClaimed.includes(r.level)}
                  maxLevel={maxLevel}
                  onClaim={handleClaim}
                  isPending={isPending}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Premium benefits card */}
        {!isPremium && (
          <div className="mt-4 bg-amber-500/8 border border-amber-400/30 rounded-3xl p-4">
            <h3 className="font-black text-base text-foreground mb-3">💎 Преимущества Пасса</h3>
            <div className="space-y-2">
              {[
                "💎 Эксклюзивные награды на каждом уровне",
                "🌱 Редкие семена (тыква, подсолнух, клубника)",
                "🦄 Эксклюзивный питомец-единорог на уровне 20",
                "⭐ Вдвое больше гемов за прохождение пасса",
              ].map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="flex-shrink-0 mt-0.5">✦</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowBuyConfirm(true)}
              className="mt-4 w-full bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black py-3.5 rounded-2xl shadow-md text-sm"
            >
              Купить Пасс — 💎 99 кристаллов
            </motion.button>
          </div>
        )}
      </div>

      {/* Buy pass confirmation */}
      <AnimatePresence>
        {showBuyConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
            onClick={() => setShowBuyConfirm(false)}
          >
            <motion.div
              initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
              className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏆</div>
                <h3 className="font-black text-xl text-foreground">Фарм-Пасс Премиум</h3>
                <p className="text-sm text-muted-foreground mt-1">Разблокируй 20 уровней эксклюзивных наград</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3 mb-4">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">Включает:</div>
                {["Редкие семена и гемы на каждом уровне", "Питомец-единорог 🦄 на уровне 20", "Действует весь сезон"].map((b, i) => (
                  <div key={i} className="text-xs text-foreground/80 flex items-start gap-1.5 mb-1">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-muted-foreground">Твой баланс:</span>
                <span className={`font-black ${farm.gems >= 99 ? "text-purple-500" : "text-red-500"}`}>💎 {farm.gems} кристаллов</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowBuyConfirm(false)} className="flex-1 py-3 rounded-2xl bg-muted text-muted-foreground font-bold text-sm">
                  Отмена
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBuyPass}
                  disabled={isPending || farm.gems < 99}
                  className={`flex-1 py-3 rounded-2xl font-black text-sm shadow-md
                    ${farm.gems >= 99 ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black" : "bg-muted text-muted-foreground opacity-50"}`}
                >
                  {farm.gems >= 99 ? "Купить 💎99" : "Мало кристаллов"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
