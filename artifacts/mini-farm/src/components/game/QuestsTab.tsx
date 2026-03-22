import { motion } from "framer-motion";
import { FarmData, QuestState } from "@/lib/types";
import { useFarmAction } from "@/hooks/use-farm";
import { CheckCircle2, Circle, Gift } from "lucide-react";

interface QuestsTabProps {
  farm: FarmData;
}

function QuestCard({ quest, onClaim, isPending }: { quest: QuestState; onClaim: () => void; isPending: boolean }) {
  const progressPct = Math.min(100, (quest.progress / quest.goal.amount) * 100);
  const isReady = quest.completed && !quest.claimed;
  const isDone = quest.completed && quest.claimed;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 p-4 ${isDone ? "bg-muted/40 border-muted opacity-60" : isReady ? "bg-green-50 border-green-300" : "bg-card border-card-border"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isDone ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
            isReady ? <Gift className="w-5 h-5 text-green-600" /> :
              <Circle className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm">{quest.title}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${quest.type === "daily" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {quest.type === "daily" ? "Ежедневное" : "Сюжет"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{quest.description}</p>

          {!isDone && (
            <div className="mb-2">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Прогресс</span>
                <span>{quest.progress}/{quest.goal.amount}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs">
            <span className="text-amber-600 font-bold">🪙 +{quest.rewardCoins}</span>
            <span className="text-blue-600 font-bold">⭐ +{quest.rewardXp} XP</span>
            {quest.rewardGems && <span className="text-purple-600 font-bold">💎 +{quest.rewardGems}</span>}
          </div>
        </div>
      </div>

      {isReady && (
        <button onClick={onClaim} disabled={isPending}
          className="mt-3 w-full py-2 font-bold text-sm bg-green-500 text-white rounded-xl border-b-2 border-green-700 active:translate-y-0.5 disabled:opacity-50">
          Получить награду! 🎁
        </button>
      )}
    </motion.div>
  );
}

export function QuestsTab({ farm }: QuestsTabProps) {
  const { mutate, isPending } = useFarmAction();

  const daily = farm.quests.filter((q) => q.type === "daily");
  const story = farm.quests.filter((q) => q.type === "story");
  const claimable = farm.quests.filter((q) => q.completed && !q.claimed).length;

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl">📋 Задания</h2>
        {claimable > 0 && (
          <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-600 rounded-full">
            {claimable} готово!
          </span>
        )}
      </div>

      {daily.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">📅 Ежедневные</h3>
          <div className="flex flex-col gap-2">
            {daily.map((q) => (
              <QuestCard key={q.id} quest={q}
                onClaim={() => mutate({ action: "claim_quest", questId: q.id })}
                isPending={isPending} />
            ))}
          </div>
        </div>
      )}

      {story.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">📖 Сюжетные</h3>
          <div className="flex flex-col gap-2">
            {story.map((q) => (
              <QuestCard key={q.id} quest={q}
                onClaim={() => mutate({ action: "claim_quest", questId: q.id })}
                isPending={isPending} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
