import { motion } from "framer-motion";
import { FarmData } from "@/lib/types";
import { PET_DEFS } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { cn } from "@/lib/utils";

interface Props {
  farm: FarmData;
}

export default function PetsTab({ farm }: Props) {
  const { mutate: performAction, isPending } = useFarmAction();

  const ownedSet = new Set(farm.pets.owned.map((p) => p.type));
  const activePetType = farm.pets.owned.find((p) => p.active)?.type ?? null;

  const handleBuy = (petType: string, priceGem: number) => {
    performAction({ action: "buy_pet", petType, priceGem });
  };

  const handleActivate = (petType: string) => {
    if (activePetType === petType) {
      performAction({ action: "activate_pet", petType: null });
    } else {
      performAction({ action: "activate_pet", petType });
    }
  };

  const activePet = PET_DEFS.find((p) => p.id === activePetType);

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">🐾 Питомцы</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Активный питомец даёт постоянный бонус</p>
        </div>
        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
          <div>💎 {farm.gems}</div>
        </div>
      </div>

      {/* Active pet banner */}
      {activePet && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", border: "1.5px solid #f59e0b" }}
        >
          <span className="text-4xl">{activePet.emoji}</span>
          <div className="flex-1">
            <div className="font-bold text-amber-800">{activePet.name} <span className="text-xs font-normal bg-amber-200 text-amber-700 rounded-full px-2 py-0.5 ml-1">Активен</span></div>
            <div className="text-sm text-amber-700 mt-0.5">{activePet.bonusLabel}</div>
          </div>
        </motion.div>
      )}

      {/* Pet grid */}
      <div className="grid grid-cols-1 gap-3">
        {PET_DEFS.map((pet, i) => {
          const isOwned = ownedSet.has(pet.id);
          const isActive = activePetType === pet.id;
          const isPassOnly = pet.source === "pass";
          const hasCoin = "priceCoin" in pet && pet.priceCoin !== undefined;
          const hasGem = "priceGem" in pet && pet.priceGem !== undefined;

          return (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "rounded-2xl p-4 flex items-center gap-4 border transition-all",
                isActive
                  ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-600"
                  : isOwned
                  ? "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                  : "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/50 opacity-80"
              )}
            >
              <div className="relative">
                <span className="text-4xl">{pet.emoji}</span>
                {isActive && (
                  <span className="absolute -top-1 -right-1 text-xs">✨</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800 dark:text-gray-100">{pet.name}</span>
                  {isActive && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full px-2 py-0.5 font-medium">Активен</span>}
                  {isOwned && !isActive && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full px-2 py-0.5 font-medium">Есть</span>}
                  {isPassOnly && !isOwned && <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 rounded-full px-2 py-0.5 font-medium">🏆 Пасс</span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{pet.description}</div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{pet.bonusLabel}</div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {isOwned ? (
                  <button
                    onClick={() => handleActivate(pet.id)}
                    disabled={isPending}
                    className={cn(
                      "text-sm font-semibold rounded-xl px-4 py-2 transition-all active:scale-95",
                      isActive
                        ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        : "bg-amber-400 text-white hover:bg-amber-500"
                    )}
                  >
                    {isActive ? "Убрать" : "Активировать"}
                  </button>
                ) : isPassOnly ? (
                  <div className="text-xs text-gray-400 text-right leading-tight max-w-[80px]">Получи в Ферм-Пассе</div>
                ) : (
                  <button
                    onClick={() => hasGem ? handleBuy(pet.id, pet.priceGem!) : undefined}
                    disabled={isPending || (hasGem && farm.gems < (pet.priceGem ?? 0))}
                    className={cn(
                      "text-sm font-semibold rounded-xl px-4 py-2 transition-all active:scale-95",
                      hasGem && farm.gems >= (pet.priceGem ?? 0)
                        ? "bg-indigo-500 text-white hover:bg-indigo-600"
                        : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {hasGem ? (
                      <span>💎 {pet.priceGem}</span>
                    ) : hasCoin ? (
                      <span>🪙 {pet.priceCoin}</span>
                    ) : (
                      "?"
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-2">
        Только один питомец может быть активен одновременно
      </p>
    </div>
  );
}
