import { motion, AnimatePresence } from "framer-motion";
import { FarmData, BuildingState } from "@/lib/types";
import { BUILDINGS, RECIPES, ITEM_EMOJIS, ITEM_NAMES, formatTime } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { useState, useEffect } from "react";
import { EmojiImg } from "@/components/ui/emoji-img";

interface BuildingsTabProps {
  farm: FarmData;
}

function CraftingProgress({ building }: { building: BuildingState }) {
  const [pct, setPct] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");

  const recipe = building.crafting ? RECIPES[building.crafting.recipe] : null;
  const totalSec = recipe?.craftSec ?? 60;

  useEffect(() => {
    if (!building.crafting) { setPct(0); setTimeLeft(""); return; }
    const totalMs = totalSec * 1000;
    const tick = () => {
      const now = Date.now();
      const ready = new Date(building.crafting!.readyAt).getTime();
      const remaining = Math.max(0, ready - now);
      const elapsed = totalMs - remaining;
      setPct(Math.min(100, Math.round((elapsed / totalMs) * 100)));
      setTimeLeft(remaining === 0 ? "Готово!" : formatTime(Math.ceil(remaining / 1000)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [building.crafting?.readyAt, totalSec]);

  if (!building.crafting) return null;

  const craftReady = pct >= 100;

  return (
    <div className={`rounded-xl p-3 ${craftReady ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{ITEM_EMOJIS[recipe?.outputId ?? ""] ?? "📦"}</span>
        <div className="flex-1">
          <div className="text-sm font-bold">{recipe ? ITEM_NAMES[recipe.outputId] ?? recipe.outputId : building.crafting.recipe}</div>
          <div className={`text-xs font-semibold ${craftReady ? "text-green-600" : "text-blue-600"}`}>
            {craftReady ? "✅ Готово!" : `⏱ ${timeLeft}`}
          </div>
        </div>
        {!craftReady && (
          <div className="text-xs font-bold text-blue-500">{pct}%</div>
        )}
      </div>
      {!craftReady && (
        <div className="h-2.5 bg-blue-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </div>
  );
}

function BuildingCard({ building, farm, onStartCraft, onCollect, isPending }: {
  building: BuildingState;
  farm: FarmData;
  onStartCraft: (recipe: string) => void;
  onCollect: () => void;
  isPending: boolean;
}) {
  const cfg = BUILDINGS[building.type];
  const recipes = Object.values(RECIPES).filter((r) => r.building === building.type);

  const craftReady = building.crafting && new Date() >= new Date(building.crafting.readyAt);

  const getAvailable = (itemId: string): number => {
    if (itemId in farm.inventory) return (farm.inventory as any)[itemId] ?? 0;
    return (farm.products as any)[itemId] ?? 0;
  };

  const craftableCount = recipes.filter((r) =>
    r.inputs.every((inp) => getAvailable(inp.itemId) >= inp.quantity)
  ).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border-2 border-card-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <EmojiImg emoji={cfg.emoji} size={36} />
        <div className="flex-1">
          <div className="font-display font-bold">{cfg.name}</div>
          <div className="text-xs text-muted-foreground">Уровень {building.level}</div>
        </div>
        {!building.crafting && craftableCount > 0 && (
          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
            {craftableCount} доступно
          </span>
        )}
      </div>

      {building.crafting ? (
        <div>
          <CraftingProgress building={building} />
          {craftReady && (
            <motion.button
              onClick={onCollect} disabled={isPending}
              whileTap={{ scale: 0.95 }}
              className="mt-2 w-full py-2.5 font-bold text-sm bg-green-500 text-white rounded-xl border-b-2 border-green-700 disabled:opacity-50"
            >
              Забрать {building.crafting ? (ITEM_EMOJIS[RECIPES[building.crafting.recipe]?.outputId ?? ""] ?? "📦") : "📦"}
            </motion.button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Рецепты</p>
          <div className="flex flex-col gap-2">
            {recipes.map((recipe) => {
              const canCraft = recipe.inputs.every((inp) => getAvailable(inp.itemId) >= inp.quantity);
              return (
                <motion.button key={recipe.id}
                  onClick={() => onStartCraft(recipe.id)}
                  disabled={!canCraft || isPending}
                  whileTap={canCraft ? { scale: 0.97 } : {}}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all
                    ${canCraft
                      ? "bg-green-50 border-green-200 hover:border-green-400"
                      : "bg-muted/40 border-muted opacity-50 cursor-not-allowed"}`}
                >
                  <span className="text-2xl shrink-0">{ITEM_EMOJIS[recipe.outputId] ?? "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{ITEM_NAMES[recipe.outputId]}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {recipe.inputs.map((inp) => {
                        const have = getAvailable(inp.itemId);
                        const enough = have >= inp.quantity;
                        return (
                          <span key={inp.itemId} className={`mr-1.5 ${enough ? "" : "text-red-500"}`}>
                            {ITEM_EMOJIS[inp.itemId]}{inp.quantity}
                            <span className="text-[9px] opacity-70">({have})</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-green-700">🪙{recipe.sellPrice}</div>
                    <div className="text-[10px] text-muted-foreground">{formatTime(recipe.craftSec)}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function BuildingsTab({ farm }: BuildingsTabProps) {
  const { mutate, isPending } = useFarmAction();
  const [showBuy, setShowBuy] = useState(false);

  const farmBuildings = farm.buildings ?? [];
  const unbuiltBuildings = Object.values(BUILDINGS).filter(
    (b) => !farmBuildings.some((fb) => fb.type === b.type) && b.unlockLevel <= farm.level
  );
  const lockedBuildings = Object.values(BUILDINGS).filter((b) => b.unlockLevel > farm.level);

  const readyBuildings = farmBuildings.filter(
    (b) => b.crafting && new Date() >= new Date(b.crafting.readyAt)
  ).length;

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-bold text-xl">🏭 Производство</h2>
          {readyBuildings > 0 && (
            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block">
              ✅ {readyBuildings} готово к сбору
            </span>
          )}
        </div>
        {unbuiltBuildings.length > 0 && (
          <button onClick={() => setShowBuy(!showBuy)}
            className="px-3 py-1.5 text-sm font-bold bg-primary text-white rounded-xl border-b-2 border-green-700 active:translate-y-0.5">
            {showBuy ? "✕" : "+ Построить"}
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
                <h3 className="font-bold">Построить здание</h3>
                <span className="text-xs text-muted-foreground">🪙 {farm.coins}</span>
              </div>
              <div className="flex flex-col gap-2">
                {unbuiltBuildings.map((cfg) => {
                  const canAfford = farm.coins >= cfg.cost;
                  const buildingRecipes = Object.values(RECIPES).filter((r) => r.building === cfg.type);
                  return (
                    <motion.button key={cfg.type}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { mutate({ action: "build_building", cropType: cfg.type }); setShowBuy(false); }}
                      disabled={!canAfford || isPending}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 bg-card border-card-border hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed">
                      <EmojiImg emoji={cfg.emoji} size={36} />
                      <div className="flex-1 text-left">
                        <div className="font-bold text-sm">{cfg.name}</div>
                        {cfg.shelter ? (
                          <div className="text-[10px] text-blue-600">☔ Защита от бури (−10% потерь)</div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">
                            {buildingRecipes.slice(0, 3).map((r) => ITEM_EMOJIS[r.outputId]).join(" ")}
                            {buildingRecipes.length > 3 && ` +${buildingRecipes.length - 3}`}
                          </div>
                        )}
                        <div className="text-xs text-amber-600 font-bold mt-0.5">🪙 {cfg.cost}</div>
                      </div>
                      {!canAfford && <span className="text-[10px] text-red-500 font-bold">Нет монет</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {farmBuildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4 opacity-40">🏭</div>
          <h3 className="font-display font-bold text-xl mb-2">Нет зданий</h3>
          <p className="text-muted-foreground text-sm mb-4">Постройте амбар для защиты от бурь или производственные здания.</p>
          {farm.level < 3 && (
            <div className="text-xs bg-amber-100 text-amber-700 rounded-xl px-4 py-2">
              🔒 Мельница откроется на 3 уровне
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {farmBuildings.map((building) => (
            <BuildingCard key={building.id} building={building} farm={farm}
              onStartCraft={(recipe) => mutate({ action: "start_craft", recipe, buildingId: building.id })}
              onCollect={() => mutate({ action: "collect_craft", buildingId: building.id })}
              isPending={isPending} />
          ))}
        </div>
      )}

      {lockedBuildings.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔒 Скоро</p>
          <div className="grid grid-cols-2 gap-2">
            {lockedBuildings.map((cfg) => {
              const buildingRecipes = Object.values(RECIPES).filter((r) => r.building === cfg.type);
              return (
                <div key={cfg.type} className="flex items-center gap-2 bg-muted/40 p-3 rounded-xl border border-muted opacity-60">
                  <EmojiImg emoji={cfg.emoji} size={28} className="grayscale" />
                  <div>
                    <div className="font-bold text-xs">{cfg.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {buildingRecipes.slice(0, 3).map((r) => ITEM_EMOJIS[r.outputId]).join(" ")}
                    </div>
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
