import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useExpandableSheet } from "@/hooks/use-expandable-sheet";
import { X, Star, Wheat, Cat, Factory, Trophy, Globe, Package, Gem, ArrowRightLeft, Gift } from "lucide-react";
import { EmojiImg } from "@/components/ui/emoji-img";
import { getLevelProgress } from "@/lib/constants";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TELEGRAM_ID = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? "";

const LEVEL_TITLES: Record<number, string> = {
  1: "Начинающий фермер", 2: "Юный фермер", 3: "Умелый фермер",
  4: "Опытный фермер",    5: "Мастер фермы", 6: "Знаток урожая",
  7: "Фермер-ветеран",    8: "Легенда полей", 9: "Повелитель грядок",
  10: "Великий фермер",
};

async function fetchProfile(telegramId: string) {
  const res = await fetch(`${API_BASE}/api/social/profile/${telegramId}`, {
    headers: { "x-telegram-id": TELEGRAM_ID },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Ошибка загрузки профиля");
  }
  return res.json();
}

interface PublicProfile {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  plotCount: number;
  animalCount: number;
  buildingCount: number;
  completedQuests: number;
  totalQuests: number;
  totalSeeds: number;
  totalProducts: number;
  unlockedWorlds: number;
  rank: number;
  season: string;
}

function AvatarLarge({ telegramId }: { telegramId: string }) {
  const [err, setErr] = useState(false);
  const isDemo = telegramId.startsWith("demo_") || !/^\d+$/.test(telegramId);
  if (isDemo || err) {
    return (
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-200 to-emerald-400 border-4 border-green-300 shadow-lg flex items-center justify-center text-4xl">
        🧑‍🌾
      </div>
    );
  }
  return (
    <img
      src={`${API_BASE}/api/avatar/${telegramId}`}
      alt="avatar"
      className="w-20 h-20 rounded-full object-cover border-4 border-green-300 shadow-lg"
      onError={() => setErr(true)}
    />
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-muted/40 rounded-2xl p-3 flex flex-col items-center gap-0.5">
      <div className={color}>{icon}</div>
      <div className="font-black text-base leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground text-center leading-tight">{label}</div>
    </div>
  );
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface Props {
  telegramId: string;
  onClose: () => void;
  onTrade?: () => void;
  onGift?: () => void;
  isFriendAccepted?: boolean;
}

export function FriendProfileModal({ telegramId, onClose, onTrade, onGift, isFriendAccepted }: Props) {
  const { sheetProps, handlePointerDownHandle } = useExpandableSheet(onClose);
  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ["friend-profile", telegramId],
    queryFn: () => fetchProfile(telegramId),
    staleTime: 30000,
  });

  const displayName = profile
    ? (profile.firstName
        ? profile.firstName + (profile.username ? ` @${profile.username}` : "")
        : profile.username ? `@${profile.username}` : `ID ${profile.telegramId}`)
    : "";

  const title = profile ? (LEVEL_TITLES[Math.min(profile.level, 10)] ?? "Легенда") : "";
  const { progress, current, needed } = profile
    ? getLevelProgress(profile.xp, profile.level)
    : { progress: 0, current: 0, needed: 100 };

  const ACHIEVEMENTS = profile ? [
    { emoji: "🌱", label: "Первый посев",  done: profile.level >= 1 },
    { emoji: "🌾", label: "Первый урожай", done: profile.xp >= 10 },
    { emoji: "🪙", label: "Монеты",        done: profile.coins >= 10 },
    { emoji: "🐄", label: "Зоофермер",     done: profile.animalCount > 0 },
    { emoji: "🏭", label: "Строитель",     done: profile.buildingCount > 0 },
    { emoji: "⭐", label: "Уровень 3",     done: profile.level >= 3 },
    { emoji: "💎", label: "Кристалл",      done: profile.gems > 0 },
    { emoji: "🌻", label: "Уровень 5",     done: profile.level >= 5 },
    { emoji: "🏆", label: "Уровень 7",     done: profile.level >= 7 },
    { emoji: "🌍", label: "Путешественник",done: profile.plotCount >= 8 },
    { emoji: "🧑‍🍳", label: "Кулинар",      done: profile.totalProducts >= 5 },
    { emoji: "👑", label: "Уровень 10",    done: profile.level >= 10 },
  ] : [];
  const doneCount = ACHIEVEMENTS.filter((a) => a.done).length;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        {...sheetProps}
        className="relative bg-background rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Handle — triggers drag */}
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDownHandle}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"
        >
          <X size={16} className="text-muted-foreground" />
        </button>

        <div className="overflow-y-auto flex-1 px-4 pb-8">

          {isLoading && (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="w-32 h-4 bg-muted rounded animate-pulse" />
              <div className="w-24 h-3 bg-muted rounded animate-pulse" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center py-16 gap-2 text-center">
              <div className="text-4xl">🔒</div>
              <p className="font-bold text-foreground">Профиль недоступен</p>
              <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
          )}

          {profile && (
            <>
              {/* ── Hero ── */}
              <div className="flex flex-col items-center pt-2 pb-5">
                {/* Rank badge */}
                {profile.rank <= 50 && (
                  <div className="mb-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-[11px] font-black px-3 py-1 rounded-full shadow">
                    {RANK_MEDAL[profile.rank] ?? "🏅"} #{profile.rank} в рейтинге
                  </div>
                )}

                {/* Avatar */}
                <div className="relative mb-3">
                  <div className="p-1 rounded-full bg-gradient-to-br from-green-300 to-emerald-500 shadow-md">
                    <AvatarLarge telegramId={telegramId} />
                  </div>
                  <div className="absolute -bottom-2 -right-2 min-w-[30px] h-[30px] rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-amber-700 shadow flex items-center justify-center px-1">
                    <span className="font-black text-white text-xs leading-none">{profile.level}</span>
                  </div>
                </div>

                {/* Name */}
                <h2 className="font-display font-bold text-xl text-center leading-tight">{displayName}</h2>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">{title}</p>

                {/* Coins & Gems */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 rounded-full px-3 py-1.5">
                    <span className="text-sm">🪙</span>
                    <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{profile.coins.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 dark:bg-purple-950 dark:border-purple-800 rounded-full px-3 py-1.5">
                    <Gem className="w-3.5 h-3.5 text-purple-500" />
                    <span className="font-black text-purple-700 dark:text-purple-400 text-sm">{profile.gems}</span>
                  </div>
                </div>
              </div>

              {/* ── XP bar ── */}
              <div className="bg-card border border-border rounded-2xl p-4 mb-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-sm">Уровень {profile.level}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-bold tabular-nums">{current.toLocaleString()} / {needed.toLocaleString()} XP</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-end text-[10px] text-muted-foreground mt-1">
                  <span className="font-bold">{Math.round(progress)}%</span>
                </div>
              </div>

              {/* ── Stats ── */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MiniStat icon={<Wheat size={16} />}   label="Грядок"     value={profile.plotCount}     color="text-amber-600" />
                <MiniStat icon={<Cat size={16} />}     label="Животных"   value={profile.animalCount}   color="text-pink-500" />
                <MiniStat icon={<Factory size={16} />} label="Зданий"     value={profile.buildingCount} color="text-slate-500" />
                <MiniStat icon={<Trophy size={16} />}  label="Заданий"    value={`${profile.completedQuests}/${profile.totalQuests}`} color="text-yellow-500" />
                <MiniStat icon={<Globe size={16} />}   label="Семян"      value={profile.totalSeeds}    color="text-green-600" />
                <MiniStat icon={<Package size={16} />} label="Продуктов"  value={profile.totalProducts} color="text-blue-500" />
              </div>

              {/* ── Achievements ── */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Достижения</p>
                  <span className="text-xs font-bold text-amber-600">{doneCount}/{ACHIEVEMENTS.length}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${(doneCount / ACHIEVEMENTS.length) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ACHIEVEMENTS.map((ach) => (
                    <div
                      key={ach.label}
                      title={ach.label}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border ${
                        ach.done
                          ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                          : "bg-muted/30 border-muted opacity-35"
                      }`}
                    >
                      <EmojiImg emoji={ach.emoji} size={24} className={!ach.done ? "grayscale" : ""} />
                      <span className="text-[8px] text-center leading-tight font-semibold">{ach.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Actions ── */}
              {isFriendAccepted && (onTrade || onGift) && (
                <div className="flex gap-3">
                  {onTrade && (
                    <button
                      onClick={onTrade}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm py-3 rounded-2xl transition-colors shadow"
                    >
                      <ArrowRightLeft size={16} /> Обмен
                    </button>
                  )}
                  {onGift && (
                    <button
                      onClick={onGift}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-bold text-sm py-3 rounded-2xl transition-colors shadow"
                    >
                      <Gift size={16} /> Подарить
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
