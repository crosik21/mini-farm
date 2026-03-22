import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, BarChart3, Cloud, LogOut, Search, Edit2, Trash2,
  ChevronRight, X, Check, AlertTriangle, Coins, Gem, Zap,
  Star, RefreshCw, Gift, Shield,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SECRET_KEY = "admin_secret";

type AdminSection = "players" | "season" | "stats";

interface PlayerRow {
  telegramId: string;
  coins: number;
  gems: number;
  level: number;
  xp: number;
  energy: number;
  maxEnergy: number;
  season: string;
  updatedAt: string;
}

interface Stats {
  totalPlayers: number;
  activeToday: number;
  totalCoins: number;
  totalGems: number;
  avgLevel: string;
  seasonCounts: Record<string, number>;
}

const SEASON_INFO: Record<string, { emoji: string; name: string; color: string; bg: string }> = {
  spring: { emoji: "🌸", name: "Весна", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  summer: { emoji: "☀️", name: "Лето", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  autumn: { emoji: "🍂", name: "Осень", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  winter: { emoji: "❄️", name: "Зима", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
};

function adminFetch(path: string, secret: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-admin-secret": secret, ...(options?.headers ?? {}) },
  });
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (secret: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { "x-admin-secret": value },
    });
    setLoading(false);
    if (res.ok) {
      localStorage.setItem(SECRET_KEY, value);
      onLogin(value);
    } else {
      setError("Неверный пароль");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Админ-панель</h1>
          <p className="text-sm text-gray-500 mt-1">Мини-Ферма</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Пароль</label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Введите пароль"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:border-slate-500 focus:outline-none transition-colors"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading || !value}
            className="bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "Проверка..." : "Войти"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Edit Player Modal ──────────────────────────────────────────────────────────
function EditPlayerModal({
  player,
  secret,
  onClose,
}: {
  player: PlayerRow;
  secret: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    coins: String(player.coins),
    gems: String(player.gems),
    xp: String(player.xp),
    energy: String(player.energy),
    maxEnergy: String(player.maxEnergy),
    season: player.season,
  });

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/players/${player.telegramId}`, secret, {
        method: "PATCH",
        body: JSON.stringify({
          coins: Number(form.coins),
          gems: Number(form.gems),
          xp: Number(form.xp),
          energy: Number(form.energy),
          maxEnergy: Number(form.maxEnergy),
          season: form.season,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      setTimeout(onClose, 800);
    },
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Редактировать игрока</h2>
            <p className="text-slate-300 text-sm">ID: {player.telegramId}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          {[
            { key: "coins" as const, label: "Монеты 🪙", icon: "🪙" },
            { key: "gems" as const, label: "Гемы 💎", icon: "💎" },
            { key: "xp" as const, label: "Опыт (XP) ⭐", icon: "⭐" },
            { key: "energy" as const, label: "Энергия ⚡", icon: "⚡" },
            { key: "maxEnergy" as const, label: "Макс. энергия ⚡", icon: "⚡" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <input
                type="number"
                value={form[key]}
                onChange={f(key)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:border-slate-500 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Сезон</label>
            <select
              value={form.season}
              onChange={f("season")}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:border-slate-500 focus:outline-none bg-white"
            >
              {Object.entries(SEASON_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.name}</option>
              ))}
            </select>
          </div>

          {isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {(error as Error).message}
            </div>
          )}
          {isSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <Check size={16} /> Сохранено!
            </div>
          )}

          <button
            onClick={() => mutate()}
            disabled={isPending || isSuccess}
            className="w-full bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? "Сохранение..." : "Сохранить изменения"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Players Tab ───────────────────────────────────────────────────────────────
function PlayersTab({ secret }: { secret: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlayerRow | null>(null);

  const { data: players = [], isLoading, refetch } = useQuery<PlayerRow[]>({
    queryKey: ["admin-players"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/players", secret);
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { mutate: deletePlayer } = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm(`Удалить игрока ${id}?`)) return;
      await adminFetch(`/api/admin/players/${id}`, secret, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-players"] }),
  });

  const { mutate: giveCoins } = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await adminFetch("/api/admin/give-coins", secret, {
        method: "POST",
        body: JSON.stringify({ telegramId: id, amount }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-players"] }),
  });

  const filtered = players.filter((p) =>
    p.telegramId.toLowerCase().includes(search.toLowerCase())
  );

  const seasonInfo = (s: string) => SEASON_INFO[s] || SEASON_INFO.spring;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ID..."
            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <button onClick={() => refetch()} className="p-2.5 border-2 border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="mb-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">
        {filtered.length} / {players.length} игроков
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((p) => {
          const si = seasonInfo(p.season);
          const lastSeen = new Date(p.updatedAt);
          const hoursAgo = Math.floor((Date.now() - lastSeen.getTime()) / 3600000);
          const isOnline = hoursAgo < 1;

          return (
            <div
              key={p.telegramId}
              className="bg-white border-2 border-gray-100 rounded-2xl p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-400" : "bg-gray-300"}`} />
                  <span className="font-bold text-gray-800 text-sm truncate">{p.telegramId}</span>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => setEditing(p)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => giveCoins({ id: p.telegramId, amount: 100 })}
                    title="Выдать 100 монет"
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500"
                  >
                    <Gift size={14} />
                  </button>
                  <button
                    onClick={() => deletePlayer(p.telegramId)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-bold text-amber-600">🪙 {p.coins.toLocaleString()}</div>
                  <div className="text-gray-400">монет</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-bold text-purple-600">💎 {p.gems}</div>
                  <div className="text-gray-400">гемов</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-bold text-blue-600">⭐ {p.level} ур.</div>
                  <div className="text-gray-400">{p.xp} XP</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${si.bg} ${si.color} font-semibold`}>
                  {si.emoji} {si.name}
                </span>
                <span>
                  {isOnline ? "🟢 онлайн" : hoursAgo < 24 ? `${hoursAgo}ч. назад` : `${Math.floor(hoursAgo / 24)}д. назад`}
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>Игроки не найдены</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <EditPlayerModal player={editing} secret={secret} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Season Tab ─────────────────────────────────────────────────────────────────
interface EventCropRow { id: string; name: string; emoji: string; growSec: string; seedCostCoins: string; sellPrice: string; xp: string; }
interface EventShopRow { id: string; name: string; emoji: string; cost: string; rewardCoins: string; rewardGems: string; }
interface EventFormState {
  id: string; name: string; emoji: string; description: string;
  startAt: string; endAt: string; eventCoinEmoji: string; eventCoinReward: string;
}

function blankCrop(): EventCropRow { return { id: "ev_crop_" + Date.now(), name: "", emoji: "🌿", growSec: "300", seedCostCoins: "20", sellPrice: "60", xp: "15" }; }
function blankShopItem(): EventShopRow { return { id: "ev_item_" + Date.now(), name: "", emoji: "🎁", cost: "10", rewardCoins: "50", rewardGems: "0" }; }

function EventManagementSection({ secret, onMsg }: { secret: string; onMsg: (msg: string) => void }) {
  const defaultForm: EventFormState = {
    id: "event_" + Date.now(), name: "", emoji: "🎉", description: "",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    eventCoinEmoji: "🌟", eventCoinReward: "3",
  };
  const [form, setForm] = useState<EventFormState>(defaultForm);
  const [eventCrops, setEventCrops] = useState<EventCropRow[]>([]);
  const [shopItems, setShopItems] = useState<EventShopRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  const { data: evData, refetch: refetchEv } = useQuery<{ activeEvent: any }>({
    queryKey: ["admin-event"],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/event", secret);
      return r.json();
    },
  });

  const { mutate: startEvent, isPending: isStarting } = useMutation({
    mutationFn: async () => {
      const body = {
        id: form.id, name: form.name, emoji: form.emoji, description: form.description,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        eventCoinEmoji: form.eventCoinEmoji,
        eventCoinReward: Number(form.eventCoinReward) || 3,
        eventCrops: eventCrops.filter((c) => c.name).map((c) => ({
          id: c.id, name: c.name, emoji: c.emoji,
          growSec: Number(c.growSec) || 300, seedCostCoins: Number(c.seedCostCoins) || 20,
          sellPrice: Number(c.sellPrice) || 60, xp: Number(c.xp) || 15,
        })),
        shopItems: shopItems.filter((s) => s.name).map((s) => ({
          id: s.id, name: s.name, emoji: s.emoji, cost: Number(s.cost) || 10,
          rewardCoins: Number(s.rewardCoins) || 0, rewardGems: Number(s.rewardGems) || 0,
        })),
      };
      const r = await adminFetch("/api/admin/event", secret, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { refetchEv(); setShowForm(false); setEventCrops([]); setShopItems([]); onMsg("Ивент запущен!"); },
    onError: (e: Error) => onMsg("Ошибка: " + e.message),
  });

  const { mutate: stopEvent, isPending: isStopping } = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/api/admin/event", secret, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { refetchEv(); onMsg("Ивент остановлен"); },
  });

  const activeEvent = evData?.activeEvent;

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">🎉 Сезонный ивент</h2>
      {activeEvent ? (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{activeEvent.emoji}</span>
            <div className="flex-1">
              <div className="font-bold text-purple-800">{activeEvent.name}</div>
              <div className="text-xs text-purple-500">до {new Date(activeEvent.endAt).toLocaleString("ru")}</div>
              {activeEvent.eventCrops?.length > 0 && (
                <div className="text-xs text-purple-400">{activeEvent.eventCrops.length} культур · {activeEvent.shopItems?.length ?? 0} товаров</div>
              )}
            </div>
            <button
              onClick={() => stopEvent()}
              disabled={isStopping}
              className="bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
            >
              Остановить
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 mb-2">Нет активного ивента</div>
      )}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 w-full bg-purple-50 border-2 border-purple-200 text-purple-700 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-all"
        >
          + Создать ивент
        </button>
      ) : (
        <div className="mt-2 bg-white border-2 border-purple-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded-xl px-3 py-2 text-sm col-span-2" placeholder="Название" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Эмодзи 🎉" value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} />
            <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Монет-эмодзи 🌟" value={form.eventCoinEmoji} onChange={(e) => setForm((f) => ({ ...f, eventCoinEmoji: e.target.value }))} />
            <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Монет/урожай" type="number" value={form.eventCoinReward} onChange={(e) => setForm((f) => ({ ...f, eventCoinReward: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase">Начало</label>
              <input type="datetime-local" className="border rounded-xl px-3 py-2 text-sm w-full" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase">Конец</label>
              <input type="datetime-local" className="border rounded-xl px-3 py-2 text-sm w-full" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
            </div>
          </div>

          {/* Event Crops */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase">Ивентовые культуры</label>
              <button onClick={() => setEventCrops((p) => [...p, blankCrop()])} className="text-xs text-purple-600 font-bold">+ Добавить</button>
            </div>
            {eventCrops.map((crop, i) => (
              <div key={crop.id} className="grid grid-cols-4 gap-1 mb-1 items-center">
                <input className="border rounded-lg px-2 py-1 text-xs col-span-1" placeholder="Эмодзи" value={crop.emoji} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, emoji: e.target.value } : c))} />
                <input className="border rounded-lg px-2 py-1 text-xs col-span-2" placeholder="Название" value={crop.name} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} />
                <button onClick={() => setEventCrops((p) => p.filter((_, j) => j !== i))} className="text-red-400 text-xs font-bold">✕</button>
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Рост (сек)" type="number" value={crop.growSec} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, growSec: e.target.value } : c))} />
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Цена семян" type="number" value={crop.seedCostCoins} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, seedCostCoins: e.target.value } : c))} />
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Продажа" type="number" value={crop.sellPrice} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, sellPrice: e.target.value } : c))} />
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="XP" type="number" value={crop.xp} onChange={(e) => setEventCrops((p) => p.map((c, j) => j === i ? { ...c, xp: e.target.value } : c))} />
              </div>
            ))}
            {eventCrops.length === 0 && <div className="text-xs text-gray-300 italic">Нет культур (базовые культуры тоже дают ивент-монеты)</div>}
          </div>

          {/* Shop Items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase">Товары магазина</label>
              <button onClick={() => setShopItems((p) => [...p, blankShopItem()])} className="text-xs text-purple-600 font-bold">+ Добавить</button>
            </div>
            {shopItems.map((item, i) => (
              <div key={item.id} className="grid grid-cols-4 gap-1 mb-1 items-center">
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Эмодзи" value={item.emoji} onChange={(e) => setShopItems((p) => p.map((s, j) => j === i ? { ...s, emoji: e.target.value } : s))} />
                <input className="border rounded-lg px-2 py-1 text-xs col-span-2" placeholder="Название" value={item.name} onChange={(e) => setShopItems((p) => p.map((s, j) => j === i ? { ...s, name: e.target.value } : s))} />
                <button onClick={() => setShopItems((p) => p.filter((_, j) => j !== i))} className="text-red-400 text-xs font-bold">✕</button>
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Цена (монет)" type="number" value={item.cost} onChange={(e) => setShopItems((p) => p.map((s, j) => j === i ? { ...s, cost: e.target.value } : s))} />
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Награда 🪙" type="number" value={item.rewardCoins} onChange={(e) => setShopItems((p) => p.map((s, j) => j === i ? { ...s, rewardCoins: e.target.value } : s))} />
                <input className="border rounded-lg px-2 py-1 text-xs" placeholder="Награда 💎" type="number" value={item.rewardGems} onChange={(e) => setShopItems((p) => p.map((s, j) => j === i ? { ...s, rewardGems: e.target.value } : s))} />
              </div>
            ))}
            {shopItems.length === 0 && <div className="text-xs text-gray-300 italic">Нет товаров в магазине</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEventCrops([]); setShopItems([]); }} className="flex-1 border border-gray-200 text-gray-500 font-bold py-2.5 rounded-xl text-sm">Отмена</button>
            <button onClick={() => startEvent()} disabled={isStarting || !form.name} className="flex-1 bg-purple-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-50">Запустить</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SeasonTab({ secret }: { secret: string }) {
  const qc = useQueryClient();
  const [success, setSuccess] = useState("");

  const { mutate: setSeason, isPending } = useMutation({
    mutationFn: async (season: string) => {
      const res = await adminFetch("/api/admin/season", secret, {
        method: "POST",
        body: JSON.stringify({ season }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, season) => {
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      setSuccess(`Сезон изменён на ${SEASON_INFO[season]?.name ?? season} для всех игроков!`);
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  const { mutate: giveAll, isPending: isGiving } = useMutation({
    mutationFn: async (amount: number) => {
      const res = await adminFetch("/api/admin/give-coins", secret, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSuccess(data.message);
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  return (
    <div className="p-4 pb-6 flex flex-col gap-5">
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold"
        >
          <Check size={16} /> {success}
        </motion.div>
      )}

      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
          🌍 Глобальный сезон
        </h2>
        <p className="text-xs text-gray-400 mb-3">Изменит сезон для ВСЕХ игроков сразу</p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SEASON_INFO).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setSeason(key)}
              disabled={isPending}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-95 ${s.bg} ${s.color} font-bold`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
          🎁 Выдать монеты всем
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[100, 500, 1000].map((amount) => (
            <button
              key={amount}
              onClick={() => giveAll(amount)}
              disabled={isGiving}
              className="bg-amber-50 border-2 border-amber-200 text-amber-700 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-all"
            >
              +{amount} 🪙
            </button>
          ))}
        </div>
      </section>

      <EventManagementSection
        secret={secret}
        onMsg={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
      />
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ secret }: { secret: string }) {
  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/stats", secret);
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-4 pb-6 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Всего игроков", value: stats.totalPlayers, icon: "👥", bg: "bg-blue-50 border-blue-200", val: "text-blue-700" },
          { label: "Активны сегодня", value: stats.activeToday, icon: "🟢", bg: "bg-green-50 border-green-200", val: "text-green-700" },
          { label: "Монет в игре", value: stats.totalCoins.toLocaleString(), icon: "🪙", bg: "bg-amber-50 border-amber-200", val: "text-amber-700" },
          { label: "Гемов в игре", value: stats.totalGems.toLocaleString(), icon: "💎", bg: "bg-purple-50 border-purple-200", val: "text-purple-700" },
          { label: "Средний уровень", value: stats.avgLevel, icon: "⭐", bg: "bg-yellow-50 border-yellow-200", val: "text-yellow-700" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border-2 rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-bold ${s.val}`}>{s.value}</div>
            <div className="text-xs text-gray-500 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Распределение сезонов</h2>
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 flex flex-col gap-2">
          {Object.entries(SEASON_INFO).map(([key, s]) => {
            const count = stats.seasonCounts[key] ?? 0;
            const pct = stats.totalPlayers > 0 ? (count / stats.totalPlayers) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{s.emoji} {s.name}</span>
                  <span className="text-gray-500">{count} чел.</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${
                      key === "spring" ? "bg-green-400" :
                      key === "summer" ? "bg-yellow-400" :
                      key === "autumn" ? "bg-orange-400" : "bg-blue-400"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <button onClick={() => refetch()} className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
        <RefreshCw size={14} /> Обновить данные
      </button>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
const SECTIONS: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  { id: "players", label: "Игроки", icon: <Users size={20} /> },
  { id: "season", label: "Управление", icon: <Cloud size={20} /> },
  { id: "stats", label: "Статистика", icon: <BarChart3 size={20} /> },
];

function AdminPanel({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [section, setSection] = useState<AdminSection>("players");

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Админ-панель</h1>
            <p className="text-slate-400 text-xs">Мини-Ферма</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          <LogOut size={14} /> Выйти
        </button>
      </div>

      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all relative ${
              section === s.id ? "text-slate-800" : "text-gray-400"
            }`}
          >
            {section === s.id && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-800 rounded-b-full" />
            )}
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          {section === "players" && (
            <motion.div key="players" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <PlayersTab secret={secret} />
            </motion.div>
          )}
          {section === "season" && (
            <motion.div key="season" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <SeasonTab secret={secret} />
            </motion.div>
          )}
          {section === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <StatsTab secret={secret} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Entry Point ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem(SECRET_KEY));

  const handleLogin = (s: string) => setSecret(s);
  const handleLogout = () => {
    localStorage.removeItem(SECRET_KEY);
    setSecret(null);
  };

  if (!secret) return <LoginScreen onLogin={handleLogin} />;
  return <AdminPanel secret={secret} onLogout={handleLogout} />;
}
