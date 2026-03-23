import { motion, AnimatePresence } from "framer-motion";
import { useFarmAction } from "@/hooks/use-farm";
import { FarmData } from "@/lib/types";
import { X, Zap } from "lucide-react";
import { useExpandableSheet } from "@/hooks/use-expandable-sheet";

const PACKS = [
  { amount: 10,  cost: 40,  label: "+10 энергии",   sub: "Восстановит 10 ед." },
  { amount: 30,  cost: 100, label: "+30 энергии",   sub: "Восстановит 30 ед." },
  { amount: 999, cost: 250, label: "До максимума",  sub: "" },
];

interface EnergyModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: FarmData;
}

export function EnergyModal({ isOpen, onClose, farm }: EnergyModalProps) {
  const { mutate: performAction, isPending } = useFarmAction();
  const { sheetProps, handlePointerDownHandle } = useExpandableSheet(onClose);
  const handleBuy = (amount: number) => performAction({ action: "buy_energy", amount }, { onSuccess: onClose });
  const missingEnergy = farm.maxEnergy - farm.energy;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            {...sheetProps}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-2 border-border rounded-t-3xl overflow-hidden flex flex-col"
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-1 touch-none cursor-grab active:cursor-grabbing flex-shrink-0"
              onPointerDown={handlePointerDownHandle}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-10" style={{ touchAction: "pan-y" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl flex items-center gap-2 text-foreground">
                  <Zap className="text-yellow-500" size={22} /> Пополнить энергию
                </h2>
                <button onClick={onClose}
                  className="p-2 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Current energy */}
              <div className="flex items-center gap-3 mb-5 bg-orange-500/10 border border-orange-400/30 rounded-2xl p-3">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Текущая энергия</div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all"
                      style={{ width: `${(farm.energy / farm.maxEnergy) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-orange-500 mt-1">
                    ⚡ {farm.energy} / {farm.maxEnergy}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {PACKS.map((pack) => {
                  const canAfford = farm.coins >= pack.cost;
                  const noNeed   = pack.amount !== 999 && pack.amount > missingEnergy && missingEnergy <= 0;
                  return (
                    <button
                      key={pack.amount}
                      onClick={() => handleBuy(pack.amount)}
                      disabled={isPending || !canAfford || noNeed}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                        canAfford && !noNeed
                          ? "border-yellow-400/60 bg-yellow-400/10 hover:bg-yellow-400/20"
                          : "border-border bg-muted opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Zap size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-foreground">{pack.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {pack.amount === 999 ? `Заполнит до ${farm.maxEnergy}` : pack.sub}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-400/15 px-3 py-1.5 rounded-full border border-amber-400/30">
                        🪙 {pack.cost}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-xs text-muted-foreground mt-4">
                Энергия восстанавливается автоматически: +3 каждые 2 минуты
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
