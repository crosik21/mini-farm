import { motion, AnimatePresence } from "framer-motion";
import { useFarmAction } from "@/hooks/use-farm";
import { FarmData, StreakReward } from "@/lib/types";
import { EmojiImg } from "@/components/ui/emoji-img";
import { Flame } from "lucide-react";

function rewardEmoji(reward: StreakReward): string {
  if (reward.type === "animal") return "🐔";
  if (reward.type === "seed") return "🌱";
  if (reward.type === "gems") return "💎";
  return "🪙";
}

function rewardPreview(reward: StreakReward): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`🪙${reward.coins}`);
  if (reward.gems) parts.push(`💎${reward.gems}`);
  if (reward.seedType && reward.seedQty) {
    const names: Record<string, string> = { corn: "кукуруза", strawberry: "клубника", wheat: "пшеница", carrot: "морковь" };
    parts.push(`🌱${reward.seedQty} ${names[reward.seedType] ?? reward.seedType}`);
  }
  if (reward.animalType) parts.push(`🐔 курица`);
  return parts.join(" + ") || reward.label;
}

export function StreakModal({ farm, onClose }: { farm: FarmData; onClose: () => void }) {
  const { mutate, isPending } = useFarmAction();
  const streakDay = farm.streakRewardDay;
  const rewards = farm.streakRewards ?? [];
  const currentReward = rewards.find((r) => r.day === streakDay);

  const handleClaim = () => {
    mutate({ action: "claim_streak_reward" }, { onSuccess: onClose });
  };

  if (!currentReward || streakDay === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-end pb-6 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-background rounded-3xl overflow-hidden shadow-2xl"
          initial={{ y: 120, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 120, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          {/* Header gradient */}
          <div className="relative bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-400 px-6 pt-7 pb-6 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  style={{ left: `${(i * 17) % 90}%`, top: `${(i * 23) % 80}%` }}
                  animate={{ y: [-4, 4, -4], rotate: [-5, 5, -5] }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
                >
                  ⭐
                </motion.div>
              ))}
            </div>

            <motion.div
              className="relative flex items-center justify-center gap-2 mb-2"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Flame className="w-7 h-7 text-white" />
              <span className="text-white font-black text-2xl">Стрик: {farm.loginStreak} дней!</span>
              <Flame className="w-7 h-7 text-white" />
            </motion.div>
            <p className="text-white/80 text-sm font-medium">Ты заходишь каждый день — держи свою награду!</p>
          </div>

          <div className="px-5 py-5">
            {/* 7-day progress */}
            <div className="grid grid-cols-7 gap-1.5 mb-5">
              {rewards.map((r) => {
                const isToday = r.day === streakDay;
                const isPast = r.day < streakDay;
                return (
                  <div
                    key={r.day}
                    className={`relative flex flex-col items-center gap-1 rounded-xl py-2 px-1 border-2 transition-all
                      ${isToday ? "bg-amber-50 border-amber-400 dark:bg-amber-950 dark:border-amber-500 scale-105 shadow-md" :
                        isPast ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-700 opacity-70" :
                        "bg-muted/30 border-muted opacity-40"
                      }`}
                  >
                    {isPast && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px] font-black">✓</span>
                      </div>
                    )}
                    <span className="text-lg">{rewardEmoji(r)}</span>
                    <span className={`text-[8px] font-black ${isToday ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                      День {r.day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Today's reward highlight */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 mb-4 text-center">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">Награда за день {streakDay}</p>
              <div className="flex items-center justify-center gap-2">
                <EmojiImg emoji={rewardEmoji(currentReward)} size={32} />
                <div className="text-left">
                  <p className="font-black text-base text-foreground">{currentReward.label}</p>
                  <p className="text-xs text-muted-foreground">{rewardPreview(currentReward)}</p>
                </div>
              </div>
            </div>

            {/* Claim button */}
            <motion.button
              onClick={handleClaim}
              disabled={isPending}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg shadow-lg border-b-4 border-orange-700 active:translate-y-0.5 active:border-b-2 disabled:opacity-60 transition-all"
              whileTap={{ scale: 0.97 }}
            >
              {isPending ? "Получаю..." : "🎁 Забрать награду!"}
            </motion.button>
            <button onClick={onClose} className="w-full text-center mt-3 text-xs text-muted-foreground">Пропустить</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
