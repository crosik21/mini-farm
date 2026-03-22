import { motion } from "framer-motion";
import { Check, Lock, Palette } from "lucide-react";
import { FarmData } from "@/lib/types";
import { SKINS } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { useToast } from "@/hooks/use-toast";

export function SkinsTab({ farm }: { farm: FarmData }) {
  const { mutate: action, isPending } = useFarmAction();
  const { toast } = useToast();

  const owned = farm.ownedSkins ?? [];
  const active = farm.activeSkin ?? "default";

  const buy = (skinId: string) => {
    action({ action: "buy_skin", skinId }, {
      onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
      onSuccess: () => toast({ title: "✅ Скин куплен и применён!" }),
    });
  };

  const equip = (skinId: string) => {
    action({ action: "equip_skin", skinId }, {
      onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="p-4 pb-10">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={18} className="text-purple-500" />
        <div>
          <h2 className="font-bold text-sm">Скины поля</h2>
          <p className="text-xs text-muted-foreground">Меняют фон вашей фермы</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SKINS.map((skin, i) => {
          const isOwned = skin.free || owned.includes(skin.id);
          const isActive = active === skin.id;
          const canAffordCoin = skin.priceCoin ? farm.coins >= skin.priceCoin : true;
          const canAffordGem  = skin.priceGem  ? farm.gems  >= skin.priceGem  : true;
          const canAfford = isOwned || (skin.priceCoin ? canAffordCoin : canAffordGem);

          return (
            <motion.div
              key={skin.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                isActive
                  ? "border-primary shadow-md shadow-primary/20"
                  : "border-border"
              }`}
            >
              {/* Preview background */}
              <div
                className="h-20 flex items-center justify-center text-3xl relative"
                style={
                  skin.id === "default"
                    ? { background: "linear-gradient(180deg, #d4edbc 0%, #a8d880 100%)" }
                    : { background: `linear-gradient(180deg, ${skin.bg1} 0%, ${skin.bg2} 100%)` }
                }
              >
                <span className="drop-shadow">{skin.emoji}</span>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow">
                    <Check size={10} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Card info */}
              <div className="p-2.5 bg-card">
                <p className="font-bold text-xs leading-tight">{skin.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{skin.description}</p>

                <div className="mt-2">
                  {isOwned ? (
                    isActive ? (
                      <div className="text-[11px] font-bold text-primary text-center py-1">
                        Активен ✓
                      </div>
                    ) : (
                      <button
                        onClick={() => equip(skin.id)}
                        disabled={isPending}
                        className="w-full py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold active:scale-95 transition-all"
                      >
                        Применить
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => buy(skin.id)}
                      disabled={isPending || !canAfford}
                      className={`w-full py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1 ${
                        canAfford
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {!canAfford && <Lock size={10} />}
                      {skin.priceCoin ? `${skin.priceCoin} 🪙` : `${skin.priceGem} 💎`}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
