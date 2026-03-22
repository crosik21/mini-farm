import { motion } from "framer-motion";
import { DrawerModal } from "@/components/ui/drawer-modal";
import { FarmData } from "@/lib/types";
import { CROPS, EXCLUSIVE_CROPS, CropConfig } from "@/lib/constants";
import { Sprout, Zap } from "lucide-react";
import { useFarmAction } from "@/hooks/use-farm";
import { EmojiImg } from "@/components/ui/emoji-img";

interface PlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  plotId: number | null;
  farm: FarmData;
}

export function PlantModal({ isOpen, onClose, plotId, farm }: PlantModalProps) {
  const { mutate, isPending } = useFarmAction();

  const handlePlant = (cropId: string) => {
    if (plotId === null) return;
    mutate({ action: "plant", plotId, cropType: cropId }, { onSuccess: () => onClose() });
  };

  const activeWorldId = farm.activeWorldId ?? "main";

  // Merge static CROPS with custom crops + exclusive case crops
  const allCrops: Record<string, CropConfig> = { ...CROPS };
  for (const [id, c] of Object.entries(farm.customCropMeta ?? {})) {
    allCrops[id] = {
      id: c.id, name: c.name, emoji: c.emoji,
      seedCost: c.seedCost, sellPrice: c.sellPrice,
      growTimeSec: c.growSec,
      unlockLevel: c.unlockLevel, description: c.description,
    };
  }
  // Add exclusive crops — show only if player has seeds (exclusive = seedCost 0)
  for (const [id, c] of Object.entries(EXCLUSIVE_CROPS)) {
    allCrops[id] = c;
  }
  // Add active event crops — show only if player has seeds
  if (farm.activeEvent?.isActive) {
    for (const evCrop of farm.activeEvent.eventCrops) {
      allCrops[evCrop.id] = {
        id: evCrop.id, name: evCrop.name, emoji: evCrop.emoji,
        seedCost: 0,
        sellPrice: evCrop.sellPrice,
        growTimeSec: evCrop.growSec,
        unlockLevel: 1,
        description: `Ивентовая культура · ${farm.activeEvent.eventCoinEmoji}`,
      };
    }
  }

  const worldCropIds: string[] | null = activeWorldId !== "main"
    ? ((farm.worldConfig?.[activeWorldId]?.crops as string[]) ?? null)
    : null;
  const availableCrops = Object.values(allCrops).filter((c) => {
    // Exclusive crops (seedCost=0): only show if player has seeds (includes event crops)
    if (c.seedCost === 0) return ((farm.seeds as Record<string, number>)[c.id] ?? 0) > 0;
    return worldCropIds ? worldCropIds.includes(c.id) : c.unlockLevel <= farm.level;
  });
  const noEnergy = farm.energy < 2;

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Посадить" icon={<Sprout className="text-primary" />}>
      {/* Energy info */}
      <div className={`flex items-center gap-2 mb-4 rounded-xl px-3 py-2 border ${noEnergy ? "bg-red-50 border-red-200" : "bg-sky-50 border-sky-200"}`}>
        <Zap className={`w-4 h-4 flex-shrink-0 ${noEnergy ? "text-red-500" : "text-sky-500"}`} />
        <span className={`text-sm font-semibold ${noEnergy ? "text-red-700" : "text-sky-700"}`}>
          {noEnergy ? "Закончилась энергия! Пополни на панели сверху." : `Посадка: 2 ⚡ · У тебя: ${farm.energy}/${farm.maxEnergy}`}
        </span>
      </div>

      {/* Crop grid */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        {availableCrops.map((crop) => {
          const seedCount = (farm.seeds as Record<string, number>)[crop.id] ?? 0;
          const hasSeeds = seedCount > 0;
          const canPlant = hasSeeds && !noEnergy && !isPending;

          return (
            <motion.div
              key={crop.id}
              layout
              className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-200
                ${hasSeeds && !noEnergy
                  ? "bg-card border-card-border shadow-sm"
                  : "bg-muted/40 border-muted"
                }
              `}
            >
              {/* Plant button */}
              <button
                onClick={() => canPlant && handlePlant(crop.id)}
                disabled={!canPlant}
                className={`flex flex-col items-center p-3 text-center w-full ${!canPlant ? "cursor-not-allowed" : "active:scale-95 transition-transform"}`}
              >
                <EmojiImg emoji={crop.emoji} size={40} className={`mb-1 ${!hasSeeds ? "opacity-40 grayscale" : ""}`} />
                <span className={`font-display font-bold text-sm ${!hasSeeds ? "text-muted-foreground" : ""}`}>{crop.name}</span>

                {/* Seed count pill */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                  hasSeeds ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {hasSeeds ? `${seedCount} шт.` : "Нет семян"}
                </span>

                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {(() => {
                    const wMult = farm.weatherGrowMult ?? 1;
                    const adjSec = Math.ceil(crop.growTimeSec * wMult);
                    const label = adjSec >= 60 ? `${Math.floor(adjSec / 60)} мин` : `${adjSec} сек`;
                    const weatherIcon = (farm.currentWeather === "rainy" ? "🌧️" : farm.currentWeather === "storm" ? "⛈️" : null);
                    return <>{weatherIcon}{weatherIcon ? " " : ""}{label}{" · "}→🪙{crop.sellPrice}</>;
                  })()}
                </span>

                {hasSeeds && noEnergy && (
                  <span className="text-[10px] text-red-500 font-bold mt-1">⚡ Нет энергии</span>
                )}
              </button>

              {/* No seeds hint — redirect to shop */}
              {!hasSeeds && (
                <div className="border-t border-dashed border-border px-3 py-1.5 text-center">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    🛒 Купи в Рынке · 🪙{crop.seedCost}/шт
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {activeWorldId === "main" && Object.values(allCrops).some((c) => c.unlockLevel > farm.level) && (
        <div className="mt-1 text-center text-xs text-muted-foreground">
          🔒 Другие культуры откроются на следующих уровнях
        </div>
      )}
    </DrawerModal>
  );
}
