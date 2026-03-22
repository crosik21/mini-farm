import { motion, AnimatePresence } from "framer-motion";
import { FarmData, AnimalState } from "@/lib/types";
import { ANIMALS, PRODUCTS, formatTime, type AnimalConfig } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { useState, useEffect } from "react";
import { EmojiImg } from "@/components/ui/emoji-img";

interface AnimalsTabProps {
  farm: FarmData;
}

function ProductionBar({ animal, cfg }: { animal: AnimalState; cfg: AnimalConfig }) {
  const [pct, setPct] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (animal.status !== "happy" || !animal.productReadyAt) { setPct(0); setTimeLeft(""); return; }
    const totalMs = cfg.productReadySec * 1000;
    const tick = () => {
      const now = Date.now();
      const ready = new Date(animal.productReadyAt!).getTime();
      const remaining = Math.max(0, ready - now);
      const elapsed = totalMs - remaining;
      setPct(Math.min(100, Math.round((elapsed / totalMs) * 100)));
      setTimeLeft(remaining === 0 ? "Готово!" : formatTime(Math.ceil(remaining / 1000)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [animal.productReadyAt, animal.status, cfg.productReadySec]);

  if (animal.status !== "happy") return null;

  return (
    <div className="mt-2 mb-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-blue-600 font-semibold">Производит {PRODUCTS[cfg.productType]?.emoji ?? "📦"}</span>
        <span className="text-[10px] font-bold text-blue-700">{timeLeft}</span>
      </div>
      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function AnimalCard({ animal, onFeed, onCollect, isPending }: {
  animal: AnimalState;
  onFeed: () => void;
  onCollect: () => void;
  isPending: boolean;
}) {
  const cfg = ANIMALS[animal.type];
  const product = PRODUCTS[cfg.productType];

  const isReady = animal.status === "ready";
  const isHappy = animal.status === "happy";
  const isHungry = animal.status === "hungry";

  const cardClass = isReady
    ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300"
    : isHappy
    ? "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200"
    : "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl border-2 p-3 relative overflow-hidden ${cardClass}`}
    >
      {isReady && (
        <motion.div
          className="absolute inset-0 bg-green-400/10 rounded-2xl pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative">
          <motion.div
            animate={isHungry ? { rotate: [-3, 3, -3] } : {}}
            transition={{ duration: 0.5, repeat: isHungry ? Infinity : 0, repeatDelay: 2 }}
          >
            <EmojiImg emoji={cfg.emoji} size={44} />
          </motion.div>
          {isReady && (
            <motion.div
              className="absolute -top-1 -right-1 text-base leading-none"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              ✨
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm truncate">{animal.name}</div>
          <div className="text-[10px] text-muted-foreground">{cfg.name} · Ур.{animal.level}</div>
          <div className="text-[10px] mt-0.5">
            {product && (
              <span className="text-muted-foreground">{product.emoji} {product.name} · 🪙{product.sellPrice}</span>
            )}
          </div>
        </div>
      </div>

      <ProductionBar animal={animal} cfg={cfg} />

      {isReady ? (
        <motion.button
          onClick={onCollect} disabled={isPending}
          whileTap={{ scale: 0.95 }}
          className="w-full py-2 font-bold text-sm bg-green-500 text-white rounded-xl border-b-2 border-green-700 disabled:opacity-50 mt-1"
        >
          Собрать {product?.emoji}
        </motion.button>
      ) : isHungry ? (
        <motion.button
          onClick={onFeed} disabled={isPending}
          whileTap={{ scale: 0.95 }}
          className="w-full py-2 font-bold text-sm bg-orange-400 text-white rounded-xl border-b-2 border-orange-600 disabled:opacity-50 mt-1"
        >
          Покормить ⚡
        </motion.button>
      ) : (
        <div className="text-center text-[11px] text-blue-600 font-semibold py-1.5">Производит…</div>
      )}
    </motion.div>
  );
}

export function AnimalsTab({ farm }: AnimalsTabProps) {
  const { mutate, isPending } = useFarmAction();
  const [showBuy, setShowBuy] = useState(false);

  const availableAnimalTypes = Object.values(ANIMALS).filter((a) => a.unlockLevel <= farm.level);
  const lockedAnimalTypes = Object.values(ANIMALS).filter((a) => a.unlockLevel > farm.level);

  const readyCount = farm.animals.filter((a) => a.status === "ready").length;
  const hungryCount = farm.animals.filter((a) => a.status === "hungry").length;

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-bold text-xl">🐾 Животные</h2>
          {farm.animals.length > 0 && (
            <div className="flex gap-2 mt-0.5">
              {readyCount > 0 && (
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                  ✅ {readyCount} готово
                </span>
              )}
              {hungryCount > 0 && (
                <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">
                  😢 {hungryCount} голодает
                </span>
              )}
            </div>
          )}
        </div>
        {farm.level >= 2 && (
          <button onClick={() => setShowBuy(!showBuy)}
            className="px-3 py-1.5 text-sm font-bold bg-primary text-white rounded-xl border-b-2 border-green-700 active:translate-y-0.5">
            {showBuy ? "✕" : "+ Купить"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showBuy && (
          <motion.div
            key="buy-panel"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-card border-2 border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Купить животное</h3>
                <span className="text-xs text-muted-foreground">🪙 {farm.coins}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availableAnimalTypes.map((cfg) => {
                  const canAfford = farm.coins >= cfg.cost;
                  const owned = farm.animals.filter((a) => a.type === cfg.type).length;
                  const product = PRODUCTS[cfg.productType];
                  return (
                    <motion.button key={cfg.type}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { mutate({ action: "buy_animal", cropType: cfg.type }); setShowBuy(false); }}
                      disabled={!canAfford || isPending || farm.animals.length >= 8}
                      className="flex items-center gap-2 p-3 rounded-xl border-2 text-left
                        bg-card border-card-border hover:border-primary active:translate-y-0.5
                        disabled:opacity-40 disabled:cursor-not-allowed">
                      <EmojiImg emoji={cfg.emoji} size={32} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{cfg.name}</div>
                        <div className="text-[10px] text-muted-foreground">{product?.emoji} · {formatTime(cfg.productReadySec)}</div>
                        <div className="text-[11px] text-amber-600 font-bold">🪙 {cfg.cost}</div>
                        <div className="text-[10px] text-muted-foreground">Есть: {owned}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {farm.animals.length >= 8 && (
                <p className="text-center text-xs text-muted-foreground mt-2">Максимум 8 животных</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {farm.animals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4 opacity-40">🐾</div>
          <h3 className="font-display font-bold text-xl mb-2">Нет животных</h3>
          <p className="text-muted-foreground text-sm mb-4">Купите курицу, корову, овцу, свинью или пчелу.</p>
          {farm.level < 2 && (
            <div className="text-xs bg-amber-100 text-amber-700 rounded-xl px-4 py-2">
              🔒 Откроется на 2 уровне
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {farm.animals.map((animal) => (
            <AnimalCard key={animal.id} animal={animal}
              onFeed={() => mutate({ action: "feed_animal", animalId: animal.id })}
              onCollect={() => mutate({ action: "collect_product", animalId: animal.id })}
              isPending={isPending} />
          ))}
        </div>
      )}

      {lockedAnimalTypes.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔒 Скоро</p>
          <div className="grid grid-cols-2 gap-2">
            {lockedAnimalTypes.map((cfg) => {
              const product = PRODUCTS[cfg.productType];
              return (
                <div key={cfg.type} className="flex items-center gap-2 bg-muted/40 p-3 rounded-xl border border-muted opacity-60">
                  <EmojiImg emoji={cfg.emoji} size={28} className="grayscale" />
                  <div>
                    <div className="font-bold text-xs">{cfg.name}</div>
                    {product && <div className="text-[10px] text-muted-foreground">{product.emoji} {product.name}</div>}
                    <div className="text-[10px] text-amber-600">Ур. {cfg.unlockLevel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
