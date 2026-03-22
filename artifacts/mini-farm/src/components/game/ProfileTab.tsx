import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FarmData, AchievementState } from "@/lib/types";
import { getLevelProgress, SEASON_CONFIG, ITEM_NAMES, ITEM_EMOJIS, MEDALS, MEDAL_RARITY_STYLE } from "@/lib/constants";
import { Star, Wheat, Cat, Factory, Zap, Gem, Trophy, Sprout, Copy, ChevronDown, ChevronUp, Globe, Package, Tag, Flame, Clock, Medal } from "lucide-react";
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

const CATEGORY_LABELS: Record<string, string> = {
  harvest: "Урожай",
  coins: "Монеты",
  animals: "Животные",
  buildings: "Здания",
  level: "Уровень",
  quests: "Задания",
  trading: "Торговля",
  worlds: "Миры",
  streak: "Стрик",
  crafting: "Крафт",
};

export function ProfileTab({ farm }: { farm: FarmData }) {
  const { toast } = useToast();
  const { progress, current, needed } = getLevelProgress(farm.xp, farm.level);
  const season = SEASON_CONFIG[farm.season] || SEASON_CONFIG.spring;

  const [showSeeds, setShowSeeds] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(true);
  const [achFilter, setAchFilter] = useState<"all" | "available" | "claimed">("all");
  const [promoCode, setPromoCode] = useState("");
  const { mutate: farmMutate, isPending: promoLoading } = useFarmAction();
  const { mutate: claimAch, isPending: claimingAch } = useFarmAction();
  const { mutate: claimStreak, isPending: claimingStreak } = useFarmAction();
  const { mutate: equipMedal, isPending: equipingMedal } = useFarmAction();
  const [showMedals, setShowMedals] = useState(true);
  const [equipPending, setEquipPending] = useState<string | null>(null);

  const medals = farm.medals ?? { earned: [], equipped: null };
  const earnedIds = new Set(medals.earned.map((m) => m.id));
  const equippedMedalDef = medals.equipped ? MEDALS.find((m) => m.id === medals.equipped) : null;

  const handleEquipMedal = (medalId: string | null) => {
    if (equipingMedal) return;
    setEquipPending(medalId);
    equipMedal(
      { action: "equip_medal", medalId },
      {
        onSuccess: () => { setEquipPending(null); toast({ title: medalId ? "🏅 Медаль экипирована!" : "Медаль снята" }); },
        onError: () => { setEquipPending(null); toast({ title: "Ошибка", variant: "destructive" }); },
      }
    );
  };

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

  const totalPlayHours = Math.floor((farm.totalPlaySeconds ?? 0) / 3600);
  const totalPlayMinutes = Math.floor(((farm.totalPlaySeconds ?? 0) % 3600) / 60);
  const playtimeLabel = totalPlayHours > 0
    ? `${totalPlayHours}ч ${totalPlayMinutes}м`
    : `${totalPlayMinutes}м`;

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
    { icon: <Clock size={17} />,   label: "В игре",    value: playtimeLabel,                  color: "text-teal-500" },
  ];

  const achievements = farm.achievements ?? [];
  const doneCount = achievements.filter((a) => a.completed).length;
  const claimableCount = achievements.filter((a) => a.completed && !a.claimed).length;

  const filteredAchs = achievements.filter((a) => {
    if (achFilter === "available") return !a.claimed;
    if (achFilter === "claimed") return a.claimed;
    return true;
  });

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

        {/* Equipped medal badge */}
        {equippedMedalDef && (
          <div className={`mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full border-2 shadow-md ${MEDAL_RARITY_STYLE[equippedMedalDef.rarity].border} ${MEDAL_RARITY_STYLE[equippedMedalDef.rarity].bg}`}>
            <span className="text-lg leading-none">{equippedMedalDef.emoji}</span>
            <span className={`text-xs font-black ${MEDAL_RARITY_STYLE[equippedMedalDef.rarity].text}`}>{equippedMedalDef.name}</span>
          </div>
        )}

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

      {/* ── Medals section ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.115 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-3"
      >
        <SectionHeader open={showMedals} onToggle={() => setShowMedals(!showMedals)}>
          <Medal size={14} className="text-yellow-500" /> Медали ({medals.earned.length}/{MEDALS.length})
        </SectionHeader>
        <AnimatePresence initial={false}>
          {showMedals && (
            <motion.div
              key="medals-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              {medals.equipped && (
                <button
                  onClick={() => handleEquipMedal(null)}
                  className="mt-2 mb-3 w-full text-[10px] text-muted-foreground underline underline-offset-2"
                  disabled={equipingMedal}
                >
                  Снять медаль
                </button>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {MEDALS.map((medal) => {
                  const has = earnedIds.has(medal.id);
                  const isEquipped = medals.equipped === medal.id;
                  const style = MEDAL_RARITY_STYLE[medal.rarity];
                  return (
                    <button
                      key={medal.id}
                      disabled={!has || equipingMedal}
                      onClick={() => has && !isEquipped && handleEquipMedal(medal.id)}
                      className={`relative flex items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all
                        ${has ? `${style.border} ${style.bg} ${isEquipped ? "ring-2 ring-offset-1 ring-yellow-400" : "hover:brightness-95"}` : "border-border bg-muted/30 opacity-50 cursor-default"}`}
                    >
                      <div className={`text-2xl leading-none mt-0.5 ${!has ? "grayscale" : ""}`}>{medal.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-black leading-tight ${has ? style.text : "text-muted-foreground"}`}>{medal.name}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{has ? medal.description : medal.hint}</p>
                        <p className={`text-[9px] font-bold mt-1 ${style.text}`}>{style.label}</p>
                      </div>
                      {isEquipped && (
                        <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-yellow-900 text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">
                          ✓
                        </div>
                      )}
                      {equipPending === medal.id && (
                        <div className="absolute inset-0 rounded-xl bg-white/40 dark:bg-black/30 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* ── Login Streak ── */}
      {(farm.loginStreak ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 shadow-sm mb-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Ежедневный стрик</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-2xl text-orange-600 dark:text-orange-400">{farm.loginStreak}</span>
                <span className="text-sm font-bold text-orange-700 dark:text-orange-300">дн. подряд</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {(farm.streakRewards ?? []).map((r) => {
                  const cycleDay = ((farm.loginStreak - 1) % 7) + 1;
                  const isPast = r.day < cycleDay;
                  const isToday = r.day === cycleDay;
                  return (
                    <div
                      key={r.day}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border
                        ${isToday ? "bg-amber-400 border-amber-600 text-white" :
                          isPast ? "bg-green-400 border-green-600 text-white" :
                          "bg-muted border-muted-foreground/20 text-muted-foreground"}`}
                    >
                      {isPast ? "✓" : r.day}
                    </div>
                  );
                })}
              </div>
            </div>
            {farm.streakRewardDay > 0 ? (
              <button
                onClick={() => claimStreak({ action: "claim_streak_reward" }, {
                  onSuccess: () => toast({ title: "🔥 Награда за стрик получена!" }),
                  onError: () => toast({ title: "Ошибка получения награды", variant: "destructive" }),
                })}
                disabled={claimingStreak}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-black px-3 py-2 rounded-xl shadow active:scale-95 transition-transform disabled:opacity-60"
              >
                {claimingStreak ? "..." : "🎁 Получить"}
              </button>
            ) : (
              <div className="text-center">
                <div className="text-xs text-orange-600 dark:text-orange-400 font-bold">Следующая</div>
                <div className="text-xs text-muted-foreground">Зайди завтра!</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Achievements ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="bg-card border border-border rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Достижения</p>
            {claimableCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {claimableCount} новых
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-amber-600">{doneCount}/{achievements.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700"
            style={{ width: `${achievements.length > 0 ? (doneCount / achievements.length) * 100 : 0}%` }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3">
          {(["all", "available", "claimed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setAchFilter(f)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all
                ${achFilter === f ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {f === "all" ? "Все" : f === "available" ? "Доступные" : "Получено"}
            </button>
          ))}
        </div>

        {/* Achievement list */}
        <div className="flex flex-col gap-2">
          {filteredAchs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Нет достижений в этой категории</p>
          ) : (
            filteredAchs.map((ach) => {
              const progressPct = Math.min(100, (ach.progress / ach.goal) * 100);
              const canClaim = ach.completed && !ach.claimed;
              return (
                <div
                  key={ach.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all
                    ${ach.claimed ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 opacity-70" :
                      canClaim ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700" :
                      "bg-muted/30 border-muted"}`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ach.claimed ? "bg-green-100 dark:bg-green-900" : canClaim ? "bg-amber-100 dark:bg-amber-900" : "bg-muted"}`}>
                    <EmojiImg emoji={ach.emoji} size={22} className={!ach.completed ? "grayscale opacity-40" : ""} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{ach.title}</p>
                      {ach.claimed && <span className="text-green-500 text-[10px]">✓</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight mb-1">{ach.description}</p>
                    {!ach.claimed && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${canClaim ? "bg-amber-500" : "bg-green-500/60"}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{ach.progress}/{ach.goal}</span>
                      </div>
                    )}
                    {/* Reward preview */}
                    <div className="flex items-center gap-1 mt-0.5">
                      {ach.rewardCoins > 0 && <span className="text-[9px] text-amber-600 font-bold">🪙{ach.rewardCoins}</span>}
                      {ach.rewardGems > 0 && <span className="text-[9px] text-purple-600 font-bold">💎{ach.rewardGems}</span>}
                    </div>
                  </div>

                  {/* Claim button */}
                  {canClaim && (
                    <button
                      onClick={() => claimAch({ action: "claim_achievement", achievementId: ach.id }, {
                        onSuccess: () => {},
                      })}
                      disabled={claimingAch}
                      className="px-3 py-2 bg-amber-500 text-white text-[10px] font-black rounded-xl border-b-2 border-amber-700 active:translate-y-0.5 active:border-b disabled:opacity-50 shrink-0"
                    >
                      Забрать
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
