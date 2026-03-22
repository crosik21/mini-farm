import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFarmAction } from "@/hooks/use-farm";
import { FarmData } from "@/lib/types";
import { Droplets, Wind, ShoppingCart, Info } from "lucide-react";

interface PremiumShopTabProps {
  farm: FarmData;
  onActivateItem: (itemType: "watering_can" | "sprinkler") => void;
}

interface ItemCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  effects: string[];
  count: number;
  singleGems: number;
  packGems: number;
  packQty: number;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  onBuy: (qty: number) => void;
  onUse: () => void;
  isPending: boolean;
  gems: number;
}

function ItemCard({
  icon, name, description, effects, count, singleGems, packGems, packQty,
  accentColor, bgColor, borderColor, onBuy, onUse, isPending, gems,
}: ItemCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <motion.div
      layout
      className={`${bgColor} ${borderColor} border-2 rounded-3xl overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 ${accentColor} rounded-2xl flex items-center justify-center shadow-md`}>
              <div className="text-3xl">{icon}</div>
            </div>
            <div>
              <h3 className="font-black text-base text-foreground">{name}</h3>
              <p className="text-xs text-muted-foreground leading-tight">{description}</p>
            </div>
          </div>
          <button onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <Info size={16} />
          </button>
        </div>

        {/* Effects */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-card/60 rounded-xl p-3 mb-3 border border-border/40">
                {effects.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground/80 mb-1 last:mb-0">
                    <span className="mt-0.5 flex-shrink-0">✦</span>
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Count badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">В инвентаре:</span>
            <span className={`font-black text-sm ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {count} шт.
            </span>
          </div>
          {count > 0 && (
            <motion.button
              onClick={onUse}
              whileTap={{ scale: 0.92 }}
              className={`px-4 py-1.5 rounded-full text-xs font-black text-white shadow-md ${accentColor} active:opacity-80`}
            >
              Использовать
            </motion.button>
          )}
        </div>
      </div>

      {/* Buy section */}
      <div className="bg-card/40 border-t border-border/30 px-4 py-3 flex gap-2">
        <motion.button
          onClick={() => onBuy(1)}
          disabled={isPending || gems < singleGems}
          whileTap={{ scale: 0.93 }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border-2 font-bold text-sm transition-all
            ${gems >= singleGems
              ? "border-purple-400/60 bg-purple-500/10 text-purple-600 dark:text-purple-400 active:bg-purple-500/20"
              : "border-border bg-muted text-muted-foreground opacity-50"}`}
        >
          <ShoppingCart size={13} />
          <span>×1</span>
          <span className="flex items-center gap-0.5">💎{singleGems}</span>
        </motion.button>

        <motion.button
          onClick={() => onBuy(packQty)}
          disabled={isPending || gems < packGems}
          whileTap={{ scale: 0.93 }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border-2 font-bold text-sm transition-all relative
            ${gems >= packGems
              ? "border-amber-400/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 active:bg-amber-500/20"
              : "border-border bg-muted text-muted-foreground opacity-50"}`}
        >
          <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            ВЫГОДА
          </span>
          <span>×{packQty}</span>
          <span className="flex items-center gap-0.5">💎{packGems}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export function PremiumShopTab({ farm, onActivateItem }: PremiumShopTabProps) {
  const { mutate: performAction, isPending } = useFarmAction();
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const handleBuy = (itemType: "watering_can" | "sprinkler", quantity: number) => {
    performAction(
      { action: "buy_item", itemType, quantity },
      {
        onSuccess: () => {
          setFeedback({ msg: `Куплено! ✓`, ok: true });
          setTimeout(() => setFeedback(null), 2000);
        },
        onError: (e: any) => {
          setFeedback({ msg: e?.message || "Ошибка", ok: false });
          setTimeout(() => setFeedback(null), 2500);
        },
      }
    );
  };

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      {/* Header hint */}
      <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl px-4 py-3 text-sm text-foreground/80 leading-snug">
        <span className="font-bold text-purple-500 dark:text-purple-400">✨ Премиум предметы</span> покупаются за 💎 кристаллы.
        Используй их прямо с поля — выбери предмет и нажми на грядку.
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`rounded-2xl px-4 py-3 text-sm font-bold text-center
              ${feedback.ok ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-500"}`}
          >
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watering Can */}
      <ItemCard
        icon="🪣"
        name="Лейка"
        description="Ускоряет рост на одной грядке"
        effects={[
          "Уменьшает время роста на 50% для выбранной грядки",
          "20% шанс двойного урожая — соберёшь вдвое больше!",
          "Работает только на растущих культурах",
        ]}
        count={farm.items?.wateringCans ?? 0}
        singleGems={3}
        packGems={7}
        packQty={3}
        accentColor="bg-blue-500"
        bgColor="bg-blue-500/8"
        borderColor="border-blue-500/30"
        onBuy={(qty) => handleBuy("watering_can", qty)}
        onUse={() => onActivateItem("watering_can")}
        isPending={isPending}
        gems={farm.gems}
      />

      {/* Sprinkler */}
      <ItemCard
        icon="💦"
        name="Спринклер"
        description="Поливает 5 грядок крестом"
        effects={[
          "Уменьшает время роста на 40% для 5 грядок (центр + 4 соседние)",
          "15% шанс двойного урожая на каждой грядке",
          "Остаётся активным 5 минут (виден на поле)",
          "Работает только на растущих культурах",
        ]}
        count={farm.items?.sprinklers ?? 0}
        singleGems={6}
        packGems={10}
        packQty={2}
        accentColor="bg-cyan-500"
        bgColor="bg-cyan-500/8"
        borderColor="border-cyan-500/30"
        onBuy={(qty) => handleBuy("sprinkler", qty)}
        onUse={() => onActivateItem("sprinkler")}
        isPending={isPending}
        gems={farm.gems}
      />

      {/* Active sprinklers */}
      {(farm.activeSprinklers?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Активные спринклеры</p>
          <div className="flex flex-col gap-2">
            {farm.activeSprinklers.map((sp) => {
              const remaining = Math.max(0, Math.ceil((new Date(sp.expiresAt).getTime() - Date.now()) / 1000));
              const mins = Math.floor(remaining / 60);
              const secs = remaining % 60;
              return (
                <div key={sp.id}
                  className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl px-4 py-2.5">
                  <span className="text-xl">💦</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-foreground">Спринклер активен</div>
                    <div className="text-[10px] text-muted-foreground">Грядки: {sp.affectedPlotIds.join(", ")}</div>
                  </div>
                  <div className="text-xs font-black text-cyan-500">
                    {mins}:{String(secs).padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gem balance */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        Твой баланс: <span className="font-black text-purple-500">💎 {farm.gems}</span> кристаллов
      </div>
    </div>
  );
}
