import { motion } from "framer-motion";
import { FarmData } from "@/lib/types";
import { SKILL_NODES, SKILL_BRANCH_META, SkillNode } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { cn } from "@/lib/utils";

interface Props {
  farm: FarmData;
}

type Branch = SkillNode["branch"];
const BRANCHES: Branch[] = ["farm", "trade", "energy", "fishing"];

export default function SkillTreeTab({ farm }: Props) {
  const { mutate: performAction, isPending } = useFarmAction();
  const unlocked = new Set(farm.unlockedSkills ?? []);
  const skillPoints = farm.skillPoints ?? 0;

  const nodesByBranch = (branch: Branch) =>
    SKILL_NODES.filter((n) => n.branch === branch).sort((a, b) => a.row - b.row);

  const canUnlock = (node: SkillNode) => {
    if (unlocked.has(node.id)) return false;
    if (skillPoints < node.cost) return false;
    if (node.prereq && !unlocked.has(node.prereq)) return false;
    return true;
  };

  const handleUnlock = (skillId: string) => {
    performAction({ action: "unlock_skill", skillId });
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">🧠 Дерево навыков</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Очки за каждый уровень</p>
        </div>
        <motion.div
          key={skillPoints}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl px-4 py-2"
        >
          <span className="text-lg">⭐</span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300 text-lg">{skillPoints}</span>
          <span className="text-sm text-indigo-500 dark:text-indigo-400">очков</span>
        </motion.div>
      </div>

      {/* Branches */}
      <div className="flex flex-col gap-5">
        {BRANCHES.map((branch) => {
          const meta = SKILL_BRANCH_META[branch];
          const nodes = nodesByBranch(branch);
          const branchUnlockedCount = nodes.filter((n) => unlocked.has(n.id)).length;

          return (
            <div key={branch} className={cn("rounded-2xl border p-4", meta.bg, meta.border)}>
              {/* Branch header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{meta.emoji}</span>
                <div className="flex-1">
                  <div className={cn("font-bold text-base", meta.text)}>{meta.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{branchUnlockedCount}/{nodes.length} изучено</div>
                </div>
                {/* progress bar */}
                <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", `bg-${meta.color}-400`)}
                    style={{ width: `${(branchUnlockedCount / nodes.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Nodes */}
              <div className="flex flex-col gap-3">
                {nodes.map((node, idx) => {
                  const isUnlocked = unlocked.has(node.id);
                  const available = canUnlock(node);
                  const prereqMissing = !isUnlocked && node.prereq && !unlocked.has(node.prereq);
                  const notEnoughPoints = !isUnlocked && skillPoints < node.cost;

                  return (
                    <div key={node.id}>
                      {/* Connector arrow */}
                      {idx > 0 && (
                        <div className="flex justify-center mb-1">
                          <span className={cn(
                            "text-lg transition-colors",
                            unlocked.has(nodes[idx - 1].id) ? "text-gray-400 dark:text-gray-500" : "text-gray-200 dark:text-gray-700"
                          )}>↓</span>
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        onClick={() => available && !isPending && handleUnlock(node.id)}
                        className={cn(
                          "rounded-xl p-3 flex items-center gap-3 border transition-all duration-200 select-none",
                          isUnlocked
                            ? `bg-${meta.color}-100 dark:bg-${meta.color}-900/30 border-${meta.color}-300 dark:border-${meta.color}-700`
                            : available
                            ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-pointer hover:shadow-md active:scale-98"
                            : "bg-gray-50/80 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/50 opacity-60"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-all",
                          isUnlocked
                            ? `bg-${meta.color}-200 dark:bg-${meta.color}-800/40`
                            : available
                            ? "bg-gray-100 dark:bg-gray-700"
                            : "bg-gray-100/60 dark:bg-gray-700/40 grayscale opacity-60"
                        )}>
                          {node.emoji}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-semibold text-sm",
                              isUnlocked ? meta.text : "text-gray-700 dark:text-gray-200"
                            )}>{node.name}</span>
                            {isUnlocked && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5">✓ Изучено</span>}
                          </div>
                          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{node.bonusLabel}</div>
                          {prereqMissing && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">🔒 Требует предыдущий навык</div>
                          )}
                        </div>

                        {/* Cost / action */}
                        {!isUnlocked && (
                          <div className="flex-shrink-0 text-right">
                            <div className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold transition-all",
                              available
                                ? "bg-indigo-500 text-white shadow-sm"
                                : notEnoughPoints
                                ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                            )}>
                              <span>⭐</span>
                              <span>{node.cost}</span>
                            </div>
                            {notEnoughPoints && !prereqMissing && (
                              <div className="text-xs text-red-400 mt-0.5">не хватает</div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-2">
        +1 очко за каждый уровень фермы
      </p>
    </div>
  );
}
