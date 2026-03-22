import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FarmData } from "@/lib/types";
import { getLevelProgress, SEASON_CONFIG, ITEM_NAMES, ITEM_EMOJIS } from "@/lib/constants";
import { Star, Wheat, Cat, Factory, Zap, Gem, Trophy, Sprout, Copy, ChevronDown, ChevronUp, Globe, Package, Tag } from "lucide-react";
import { EmojiImg } from "@/components/ui/emoji-img";
import { useToast } from "@/hooks/use-toast";
import { useFarmAction } from "@/hooks/use-farm";
import { getTelegramId } from "@/lib/telegram";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const LEVEL_TITLES: Record<number, string> = {
  1: "Начинающий фермер",
  2: "Юный фермер",
  3: "Умелый фермер",
  4: "Опытный фермер",
  5: "Мастер фермы",
  6: "Знаток урожая",
  7: "Фермер-ветеран",
  8: "Легенда полей",
  9: "Повелитель грядок",
  10: "Великий фермер",
};

function TelegramAvatar({ telegramId, size = 96 }: { telegramId: string; size?: number }) {
  const [error, setError] = useState(false);
  const isDemo = telegramId.startsWith("demo_") || !/^\d+$/.test(telegramId);
  if (isDemo || error) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 border-4 border-amber-600 shadow-xl flex items-center justify-center select-none"
        style={{ width: size, height: size, fontSize: size * 0.52 }}
      >
        🧑‍🌾
      </div>
    );
  }
  return (
    <img
      src={`${API_BASE}/api/avatar/${telegramId}`}
      alt="Аватар"
      className="rounded-full object-cover border-4 border-amber-600 shadow-xl"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-0.5 shadow-sm">
      <div className={color}>{icon}</div>
      <div className="font-black text-lg leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground text-center leading-tight">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground/70 text-center">{sub}</div>}
    </div>
  );
}

function SectionHeader({ children, open, onToggle }: { children: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between mb-2 text-left"
    >
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{children}</p>
      {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
    </button>
  );
}

export function ProfileTab({ farm }: { farm: FarmData }) {
  const { toast } = useToast();
  const { progress, current, needed } = getLevelProgress(farm.xp, farm.level);
  const season = SEASON_CONFIG[farm.season] || SEASON_CONFIG.spring;

  const [showSeeds, setShowSeeds] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const { mutate: farmMutate, isPending: promoLoading } = useFarmAction();

  const completedQuests = farm.quests.filter((q) => q.claimed).length;
  const totalQuests = farm.quests.length;
  const readyPlots = farm.plots.filter((p) => p.status === "ready").length;
  const happyAnimals = farm.animals.filter((a) => a.status === "happy" || a.status === "ready").length;

  const seeds = farm.seeds ?? {};
  const products = farm.products ?? {};
  const totalSeeds = Object.values(seeds).reduce((s, v) => s + (v || 0), 0);
  const totalProducts = Object.values(products).reduce((s, v) => s + (v || 0), 0);

  const seedEntries = Object.entries(seeds).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const productEntries = Object.entries(products).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  const title = LEVEL_TITLES[Math.min(farm.level, 10)] ?? "Легенда";
  const displayName = farm.firstName
    ? farm.firstName + (farm.username ? ` @${farm.username}` : "")
    : farm.username ? `@${farm.username}` : null;

  const copyId = () => {
    navigator.clipboard.writeText(farm.telegramId).then(() => toast({ title: "✅ ID скопирован!" }));
  };

  const statCards = [
    { icon: <Wheat size={17} />,   label: "Грядок",    value: farm.plots.length,             color: "text-amber-600" },
    { icon: <Cat size={17} />,     label: "Животных",  value: farm.animals.length,            color: "text-pink-500" },
    { icon: <Factory size={17} />, label: "Зданий",    value: farm.buildings.length,          color: "text-slate-500" },
    { icon: <Trophy size={17} />,  label: "Заданий",   value: `${completedQuests}/${totalQuests}`, color: "text-yellow-500" },
    { icon: <Globe size={17} />,   label: "Семян",     value: totalSeeds,                     color: "text-green-600" },
    { icon: <Package size={17} />, label: "Продуктов", value: totalProducts,                  color: "text-blue-500" },
    { icon: <Zap size={17} />,     label: "Энергия",   value: `${farm.energy}/${farm.maxEnergy}`, color: "text-sky-500" },
    { icon: <Gem size={17} />,     label: "Кристаллы", value: farm.gems,                      color: "text-purple-500" },
    { icon: <Star size={17} />,    label: "Очки опыта",value: farm.xp.toLocaleString(),       color: "text-orange-400" },
  ];

  const achievements = [
    { emoji: "🌱", label: "Первый посев",    done: farm.level >= 1 },
    { emoji: "🌾", label: "Первый урожай",   done: farm.xp >= 10 },
    { emoji: "🪙", label: "Первые монеты",   done: farm.coins >= 10 || farm.xp >= 5 },
    { emoji: "🐄", label: "Зоофермер",       done: farm.animals.length > 0 },
    { emoji: "🏭", label: "Строитель",       done: farm.buildings.length > 0 },
    { emoji: "⭐", label: "Уровень 3",       done: farm.level >= 3 },
    { emoji: "💎", label: "Кристалл",        done: farm.gems > 0 },
    { emoji: "🌻", label: "Уровень 5",       done: farm.level >= 5 },
    { emoji: "🏆", label: "Уровень 7",       done: farm.level >= 7 },
    { emoji: "🌍", label: "Путешественник",  done: farm.plots.length >= 8 },
    { emoji: "🧑‍🍳", label: "Кулинар",         done: totalProducts >= 5 },
    { emoji: "👑", label: "Уровень 10",      done: farm.level >= 10 },
  ];
  const doneCount = achievements.filter((a) => a.done).length;

  return (
    <div className="p-4 pb-10">

      {/* ── Hero header ── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col items-center pt-2 pb-5"
      >
        {/* Rank ribbon */}
        <div className="absolute top-2 right-0 bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow">
          {season.emoji} {season.name}
        </div>

        {/* Avatar with level badge */}
        <div className="relative mb-3">
          <div className="p-1 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg">
            <TelegramAvatar telegramId={farm.telegramId} size={88} />
          </div>
          <div className="absolute -bottom-2 -right-2 min-w-[34px] h-[34px] rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-amber-700 shadow-lg flex items-center justify-center px-1">
            <span className="font-black text-white text-sm leading-none">{farm.level}</span>
          </div>
        </div>

        {/* Name & title */}
        {displayName ? (
          <>
            <h1 className="font-display font-bold text-xl text-center leading-tight">{displayName}</h1>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">{title}</p>
          </>
        ) : (
          <h1 className="font-display font-bold text-xl text-center">{title}</h1>
        )}

        {/* Copy ID */}
        <button
          onClick={copyId}
          className="flex items-center gap-1.5 mt-2 bg-muted hover:bg-muted/80 transition-colors rounded-full px-3 py-1 text-[11px] text-muted-foreground font-mono"
        >
          <Copy size={10} /> ID: {farm.telegramId}
        </button>

        {/* Coins & Gems */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 rounded-full px-3.5 py-1.5">
            <span className="text-base">🪙</span>
            <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{farm.coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 dark:bg-purple-950 dark:border-purple-800 rounded-full px-3.5 py-1.5">
            <Gem className="w-3.5 h-3.5 text-purple-500" />
            <span className="font-black text-purple-700 dark:text-purple-400 text-sm">{farm.gems}</span>
          </div>
        </div>
      </motion.div>

      {/* ── XP bar ── */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-2xl p-4 mb-3 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="font-bold text-sm">Уровень {farm.level}</span>
            <span className="text-xs text-muted-foreground ml-1">— {title}</span>
          </div>
          <span className="text-xs text-muted-foreground font-bold tabular-nums">{current.toLocaleString()} / {needed.toLocaleString()} XP</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
          <span>До следующего уровня: {(needed - current).toLocaleString()} XP</span>
          <span className="font-bold">{Math.round(progress)}%</span>
        </div>
      </motion.div>

      {/* ── Needs attention banner ── */}
      {(readyPlots > 0 || happyAnimals > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-3 mb-3"
        >
          <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-1">🌟 Требует внимания:</p>
          <div className="flex flex-wrap gap-2">
            {readyPlots > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-800 dark:text-green-200">
                <Sprout className="w-3.5 h-3.5" />
                <span className="font-semibold">{readyPlots} грядок готово</span>
              </div>
            )}
            {happyAnimals > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-800 dark:text-green-200">
                <span>🐾</span>
                <span className="font-semibold">{happyAnimals} животных ждут</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Stats grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-3"
      >
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Статистика</p>
        <div className="grid grid-cols-3 gap-2">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </motion.div>

      {/* ── Seeds inventory ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-3"
      >
        <SectionHeader open={showSeeds} onToggle={() => setShowSeeds(!showSeeds)}>
          Семена ({totalSeeds} шт.)
        </SectionHeader>
        <AnimatePresence initial={false}>
          {showSeeds && (
            <motion.div
              key="seeds"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              {seedEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Нет семян</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {seedEntries.map(([cropId, qty]) => (
                    <div key={cropId} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                      <span className="text-base">{ITEM_EMOJIS[cropId] ?? "🌱"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{ITEM_NAMES[cropId] ?? cropId}</p>
                        <p className="text-[10px] text-muted-foreground">{qty} шт.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!showSeeds && seedEntries.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {seedEntries.slice(0, 6).map(([cropId, qty]) => (
              <span key={cropId} className="text-sm bg-muted/40 rounded-lg px-2 py-0.5 flex items-center gap-1">
                {ITEM_EMOJIS[cropId] ?? "🌱"}<span className="text-[10px] font-bold text-muted-foreground">{qty}</span>
              </span>
            ))}
            {seedEntries.length > 6 && <span className="text-[10px] text-muted-foreground self-center">+{seedEntries.length - 6}</span>}
          </div>
        )}
      </motion.div>

      {/* ── Products inventory ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-3"
      >
        <SectionHeader open={showProducts} onToggle={() => setShowProducts(!showProducts)}>
          Продукты ({totalProducts} шт.)
        </SectionHeader>
        <AnimatePresence initial={false}>
          {showProducts && (
            <motion.div
              key="products"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              {productEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Нет продуктов</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {productEntries.map(([id, qty]) => (
                    <div key={id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                      <span className="text-base">{ITEM_EMOJIS[id] ?? "📦"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{ITEM_NAMES[id] ?? id}</p>
                        <p className="text-[10px] text-muted-foreground">{qty} шт.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!showProducts && productEntries.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {productEntries.slice(0, 6).map(([id, qty]) => (
              <span key={id} className="text-sm bg-muted/40 rounded-lg px-2 py-0.5 flex items-center gap-1">
                {ITEM_EMOJIS[id] ?? "📦"}<span className="text-[10px] font-bold text-muted-foreground">{qty}</span>
              </span>
            ))}
            {productEntries.length > 6 && <span className="text-[10px] text-muted-foreground self-center">+{productEntries.length - 6}</span>}
          </div>
        )}
      </motion.div>

      {/* ── Promo Code ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Tag size={14} className="text-violet-500" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Промокод</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && promoCode.trim() && !promoLoading) {
                farmMutate({ action: "redeem_promo", promoCode: promoCode.trim() }, {
                  onSuccess: () => setPromoCode(""),
                });
              }
            }}
            placeholder="ВВЕДИ КОД"
            maxLength={32}
            className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wider placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-violet-400 transition-colors"
          />
          <button
            disabled={!promoCode.trim() || promoLoading}
            onClick={() => {
              farmMutate({ action: "redeem_promo", promoCode: promoCode.trim() }, {
                onSuccess: () => setPromoCode(""),
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-violet-500 text-white font-black text-sm border-b-2 border-violet-700 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {promoLoading ? "..." : "OK"}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Введи промокод, чтобы получить монеты или гемы</p>
      </motion.div>

      {/* ── Achievements ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Достижения</p>
          <span className="text-xs font-bold text-amber-600">{doneCount}/{achievements.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700"
            style={{ width: `${(doneCount / achievements.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {achievements.map((ach) => (
            <div
              key={ach.label}
              title={ach.label}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                ach.done
                  ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                  : "bg-muted/30 border-muted opacity-35"
              }`}
            >
              <EmojiImg emoji={ach.emoji} size={28} className={!ach.done ? "grayscale" : ""} />
              <span className="text-[8px] text-center leading-tight font-semibold">{ach.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
