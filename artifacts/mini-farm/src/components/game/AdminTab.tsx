import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, BarChart3, Cloud, Search, Edit2, Trash2,
  RefreshCw, Gift, Check, AlertTriangle, X, FileEdit,
  Plus, Save, ChevronDown, ChevronUp, Sprout, Store, Tag, Package,
} from "lucide-react";
import { CROPS, EXCLUSIVE_CROPS } from "@/lib/constants";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_SECRET = "farm-admin-2024";

type Section = "players" | "manage" | "crops" | "content" | "stats" | "shop" | "promo" | "cases";

interface PlayerRow {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  coins: number;
  gems: number;
  level: number;
  xp: number;
  energy: number;
  maxEnergy: number;
  season: string;
  createdAt: string;
  updatedAt: string;
  rowNum: number;
  referredBy: string | null;
}

interface Stats {
  totalPlayers: number;
  activeToday: number;
  totalCoins: number;
  totalGems: number;
  avgLevel: string;
  seasonCounts: Record<string, number>;
}

interface NpcTemplate { npcName: string; npcEmoji: string; }
interface DailyQuestTemplate {
  id: string;
  title: string;
  description: string;
  goal: { action: string; target: string; amount: number };
  rewardCoins: number;
  rewardXp: number;
}
interface AdminConfig { npcTemplates: NpcTemplate[]; dailyQuestTemplates: DailyQuestTemplate[]; }

const SEASON_INFO: Record<string, { emoji: string; name: string; bg: string; text: string }> = {
  spring: { emoji: "🌸", name: "Весна", bg: "bg-green-500/15 border-green-500/40",  text: "text-green-600 dark:text-green-400" },
  summer: { emoji: "☀️", name: "Лето",  bg: "bg-yellow-500/15 border-yellow-500/40", text: "text-yellow-600 dark:text-yellow-400" },
  autumn: { emoji: "🍂", name: "Осень", bg: "bg-orange-500/15 border-orange-500/40", text: "text-orange-600 dark:text-orange-400" },
  winter: { emoji: "❄️", name: "Зима",  bg: "bg-blue-500/15 border-blue-500/40",   text: "text-blue-600 dark:text-blue-400" },
};

function adminFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET, ...(options?.headers ?? {}) },
  });
}

// ── Edit Player Modal ──────────────────────────────────────────────────────────
function EditModal({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    coins: String(player.coins),
    gems: String(player.gems),
    xp: String(player.xp),
    energy: String(player.energy),
    maxEnergy: String(player.maxEnergy),
    season: player.season,
  });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/players/${player.telegramId}`, {
        method: "PATCH",
        body: JSON.stringify({
          coins: Number(form.coins), gems: Number(form.gems), xp: Number(form.xp),
          energy: Number(form.energy), maxEnergy: Number(form.maxEnergy), season: form.season,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-players"] }); setOk(true); setTimeout(onClose, 700); },
    onError: (e) => setErr((e as Error).message),
  });

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 22 }}
        className="bg-card border-t-2 border-border rounded-t-3xl w-full max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-border">
          <div>
            <h2 className="font-bold text-lg text-foreground">✏️ Редактировать</h2>
            <p className="text-xs text-muted-foreground">ID: {player.telegramId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-6 flex flex-col gap-3 pt-4">
          {[
            { k: "coins" as const, label: "Монеты 🪙" },
            { k: "gems"  as const, label: "Гемы 💎" },
            { k: "xp"    as const, label: "Опыт XP ⭐" },
            { k: "energy" as const, label: "Энергия ⚡" },
            { k: "maxEnergy" as const, label: "Макс. энергия" },
          ].map(({ k, label }) => (
            <div key={k}>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
              <input type="number" value={form[k]} onChange={f(k)}
                className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground focus:border-primary focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Сезон</label>
            <select value={form.season} onChange={f("season")}
              className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground focus:border-primary focus:outline-none">
              {Object.entries(SEASON_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.name}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-red-500 text-sm flex items-center gap-1"><AlertTriangle size={14} />{err}</p>}
          {ok  && <p className="text-green-500 text-sm flex items-center gap-1"><Check size={14} />Сохранено!</p>}
          <button onClick={() => mutate()} disabled={isPending || ok}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-2xl disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Player detail info row (mimics screenshot style) ──────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] font-medium text-white/40 flex-shrink-0 w-28">{label}</span>
      <span className="text-[12px] font-semibold text-white/90 text-right truncate max-w-[55%]">{value}</span>
    </div>
  );
}

// ── Players Section ────────────────────────────────────────────────────────────
function PlayersSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: players = [], isLoading, refetch } = useQuery<PlayerRow[]>({
    queryKey: ["admin-players"],
    queryFn: async () => { const res = await adminFetch("/api/admin/players"); return res.json(); },
    refetchInterval: 20000,
  });

  const { mutate: del } = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm(`Удалить игрока ${id}?`)) return;
      await adminFetch(`/api/admin/players/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-players"] }),
  });

  const { mutate: giveCoins } = useMutation({
    mutationFn: async (id: string) => {
      await adminFetch("/api/admin/give-coins", { method: "POST", body: JSON.stringify({ telegramId: id, amount: 100 }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-players"] }),
  });

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.telegramId.toLowerCase().includes(q) ||
      (p.username ?? "").toLowerCase().includes(q) ||
      (p.firstName ?? "").toLowerCase().includes(q)
    );
  });

  if (isLoading) return (
    <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по ID, username, имени…"
            className="w-full pl-8 pr-3 py-2 border-2 border-border rounded-xl text-sm bg-muted text-foreground focus:border-primary focus:outline-none" />
        </div>
        <button onClick={() => refetch()} className="p-2 border-2 border-border rounded-xl bg-muted">
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} из {players.length} игроков</div>

      {filtered.map((p) => {
        const si = SEASON_INFO[p.season] || SEASON_INFO.spring;
        const hoursAgo = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 3600000);
        const isExpanded = expanded === p.telegramId;
        const registeredAt = new Date(p.createdAt);
        const regStr = registeredAt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const displayName = p.firstName ?? p.username ?? p.telegramId;

        return (
          <div key={p.telegramId} className="bg-card border-2 border-border rounded-2xl shadow-sm overflow-hidden">
            {/* ─ Card header ─ */}
            <button
              className="w-full flex items-center justify-between p-3"
              onClick={() => setExpanded(isExpanded ? null : p.telegramId)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hoursAgo < 1 ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-foreground truncate">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono">#{p.rowNum}</span>
                  </div>
                  {p.username && (
                    <span className="text-[11px] text-muted-foreground">@{p.username}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-500">🪙{p.coins.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">⭐{p.level}ур.</div>
                </div>
                {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </div>
            </button>

            {/* ─ Stats row ─ */}
            <div className="grid grid-cols-3 gap-1.5 text-xs px-3 pb-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center">
                <div className="font-bold text-amber-500">🪙{p.coins.toLocaleString()}</div>
                <div className="text-muted-foreground">монет</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-1.5 text-center">
                <div className="font-bold text-purple-500">💎{p.gems}</div>
                <div className="text-muted-foreground">гемов</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-1.5 text-center">
                <div className="font-bold text-blue-500">⭐{p.level}ур.</div>
                <div className="text-muted-foreground">{p.xp} XP</div>
              </div>
            </div>

            {/* ─ Footer row ─ */}
            <div className="flex justify-between items-center text-xs px-3 pb-3">
              <span className={`px-2 py-0.5 rounded-full border font-semibold ${si.bg} ${si.text}`}>{si.emoji} {si.name}</span>
              <span className="text-muted-foreground">
                {hoursAgo < 1 ? "🟢 онлайн" : hoursAgo < 24 ? `${hoursAgo}ч. назад` : `${Math.floor(hoursAgo / 24)}д. назад`}
              </span>
            </div>

            {/* ─ Expanded detail panel ─ */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  {/* Dark info table */}
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden bg-[#1a1a1f] border border-white/8">
                    <InfoRow label="ID" value={<span className="font-mono text-white/60">#{p.rowNum}</span>} />
                    <InfoRow label="Имя" value={p.firstName ? p.firstName : <span className="text-white/30">—</span>} />
                    <InfoRow label="Telegram ID" value={<span className="font-mono">{p.telegramId}</span>} />
                    <InfoRow label="Telegram @" value={p.username ? `@${p.username}` : <span className="text-white/30">—</span>} />
                    <InfoRow label="Роль" value="Пользователь" />
                    <InfoRow label="Пришёл от" value={p.referredBy ? <span className="font-mono text-xs">{p.referredBy}</span> : <span className="text-white/30">—</span>} />
                    <InfoRow label="Регистрация" value={regStr} />
                    <InfoRow label="Энергия" value={`${p.energy} / ${p.maxEnergy} ⚡`} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 px-3 pb-3">
                    <button onClick={() => { setEditing(p); setExpanded(null); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/15 text-blue-500 font-bold text-xs rounded-xl border border-blue-500/20 active:scale-95 transition-all">
                      <Edit2 size={13} /> Редактировать
                    </button>
                    <button onClick={() => giveCoins(p.telegramId)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/15 text-amber-500 font-bold text-xs rounded-xl border border-amber-500/20 active:scale-95 transition-all">
                      <Gift size={13} /> +100🪙
                    </button>
                    <button onClick={() => del(p.telegramId)}
                      className="flex items-center justify-center px-3 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 active:scale-95 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      {filtered.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">Нет игроков</div>}
      <AnimatePresence>{editing && <EditModal player={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}

// ── Manage Section ─────────────────────────────────────────────────────────────
function ManageSection() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const toast = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const { mutate: setSeason, isPending: sLoading } = useMutation({
    mutationFn: async (s: string) => {
      const res = await adminFetch("/api/admin/season", { method: "POST", body: JSON.stringify({ season: s }) });
      return res.json();
    },
    onSuccess: (_, s) => { qc.invalidateQueries({ queryKey: ["admin-players"] }); toast(`✅ Сезон изменён: ${SEASON_INFO[s]?.name}`); },
  });

  const { mutate: giveAll, isPending: gLoading } = useMutation({
    mutationFn: async (amount: number) => {
      const res = await adminFetch("/api/admin/give-coins", { method: "POST", body: JSON.stringify({ amount }) });
      return res.json();
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["admin-players"] }); toast(`✅ ${d.message}`); },
  });

  return (
    <div className="p-4 pb-6 flex flex-col gap-5">
      {msg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
          {msg}
        </motion.div>
      )}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">🌍 Сезон для всех</p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SEASON_INFO).map(([k, s]) => (
            <button key={k} onClick={() => setSeason(k)} disabled={sLoading}
              className={`flex items-center gap-2 p-3.5 rounded-2xl border-2 font-bold active:scale-95 transition-all ${s.bg} ${s.text}`}>
              <span className="text-xl">{s.emoji}</span> {s.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">🎁 Монеты всем игрокам</p>
        <div className="grid grid-cols-3 gap-2">
          {[100, 500, 1000].map((amt) => (
            <button key={amt} onClick={() => giveAll(amt)} disabled={gLoading}
              className="bg-amber-500/15 border-2 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-all">
              +{amt} 🪙
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Content Section ────────────────────────────────────────────────────────────
function ContentSection() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [expandedQuest, setExpandedQuest] = useState<number | null>(null);

  const { data: cfg, isLoading } = useQuery<AdminConfig>({
    queryKey: ["admin-content-config"],
    queryFn: async () => { const r = await adminFetch("/api/admin/content-config"); return r.json(); },
  });

  const [npcs, setNpcs] = useState<NpcTemplate[]>([]);
  const [quests, setQuests] = useState<DailyQuestTemplate[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (cfg && !initialized) {
      setNpcs(cfg.npcTemplates.map((n) => ({ ...n })));
      setQuests(cfg.dailyQuestTemplates.map((q) => ({ ...q })));
      setInitialized(true);
    }
  }, [cfg, initialized]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/content-config", {
        method: "POST",
        body: JSON.stringify({ npcTemplates: npcs, dailyQuestTemplates: quests }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-content-config"] });
      setSaved(true); setErr("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setErr((e as Error).message),
  });

  const GOAL_ACTIONS = [
    { value: "harvest",       label: "Сбор урожая" },
    { value: "plant",         label: "Посадка" },
    { value: "sell_crops",    label: "Продать культуры" },
    { value: "sell_any",      label: "Продать что-угодно" },
    { value: "buy_animal",    label: "Купить животное" },
    { value: "collect_craft", label: "Собрать продукт" },
    { value: "feed_animal",   label: "Накормить животное" },
  ];

  if (isLoading) return (
    <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-4 pb-8 flex flex-col gap-5">

      {/* ── Status bar ── */}
      <AnimatePresence>
        {(saved || err) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2
              ${saved ? "bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-500"}`}>
            {saved ? <><Check size={14} /> Сохранено!</> : <><AlertTriangle size={14} />{err}</>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NPC персонажи ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">👥 NPC персонажи</p>
          <button onClick={() => setNpcs((p) => [...p, { npcName: "Новый NPC", npcEmoji: "🙂" }])}
            className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full active:scale-95 transition-all">
            <Plus size={13} /> Добавить
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {npcs.map((npc, i) => (
            <div key={i} className="flex items-center gap-2 bg-card border-2 border-border rounded-2xl px-3 py-2.5">
              <input
                value={npc.npcEmoji}
                onChange={(e) => setNpcs((p) => p.map((n, j) => j === i ? { ...n, npcEmoji: e.target.value } : n))}
                className="w-12 text-center text-xl border-2 border-border rounded-xl px-1 py-1 bg-muted focus:border-primary focus:outline-none"
                placeholder="😊"
              />
              <input
                value={npc.npcName}
                onChange={(e) => setNpcs((p) => p.map((n, j) => j === i ? { ...n, npcName: e.target.value } : n))}
                className="flex-1 border-2 border-border rounded-xl px-3 py-2 bg-muted text-foreground text-sm focus:border-primary focus:outline-none"
                placeholder="Имя персонажа"
              />
              <button onClick={() => setNpcs((p) => p.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {npcs.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed border-border rounded-2xl">
              Нет NPC — нажми «Добавить»
            </div>
          )}
        </div>
      </div>

      {/* ── Ежедневные квесты ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">📋 Ежедневные квесты</p>
          <button
            onClick={() => setQuests((p) => [...p, {
              id: `daily_custom_${Date.now()}`,
              title: "Новый квест",
              description: "Описание квеста",
              goal: { action: "harvest", target: "any", amount: 1 },
              rewardCoins: 30,
              rewardXp: 15,
            }])}
            className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full active:scale-95 transition-all">
            <Plus size={13} /> Добавить
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {quests.map((q, i) => {
            const open = expandedQuest === i;
            return (
              <div key={i} className="bg-card border-2 border-border rounded-2xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => setExpandedQuest(open ? null : i)}>
                  <span className="text-base">📋</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">{q.title || "Без названия"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{q.description}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] text-amber-500 font-bold">{q.rewardCoins}🪙</span>
                    <button onClick={(e) => { e.stopPropagation(); setQuests((p) => p.filter((_, j) => j !== i)); }}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 ml-1">
                      <Trash2 size={14} />
                    </button>
                    {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded form */}
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="px-3 pb-3 pt-2 flex flex-col gap-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Заголовок</label>
                            <input value={q.title}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">ID</label>
                            <input value={q.id}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Описание</label>
                          <input value={q.description}
                            onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                            className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Действие</label>
                            <select value={q.goal.action}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, goal: { ...x.goal, action: e.target.value } } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-xs focus:border-primary focus:outline-none">
                              {GOAL_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Цель</label>
                            <input value={q.goal.target}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, goal: { ...x.goal, target: e.target.value } } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none"
                              placeholder="any / wheat" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Кол-во</label>
                            <input type="number" value={q.goal.amount} min={1}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, goal: { ...x.goal, amount: Number(e.target.value) } } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Монеты 🪙</label>
                            <input type="number" value={q.rewardCoins} min={0}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, rewardCoins: Number(e.target.value) } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Опыт ⭐</label>
                            <input type="number" value={q.rewardXp} min={0}
                              onChange={(e) => setQuests((p) => p.map((x, j) => j === i ? { ...x, rewardXp: Number(e.target.value) } : x))}
                              className="mt-1 w-full border-2 border-border rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {quests.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed border-border rounded-2xl">
              Нет квестов — нажми «Добавить»
            </div>
          )}
        </div>
      </div>

      {/* ── Сохранить ── */}
      <button onClick={() => save()} disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-95 transition-all text-sm">
        <Save size={16} />
        {isPending ? "Сохранение…" : "Сохранить изменения"}
      </button>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Изменения вступят в силу при следующей генерации заказов / квестов.
      </p>
    </div>
  );
}

// ── Stats Section ──────────────────────────────────────────────────────────────
function StatsSection() {
  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => { const res = await adminFetch("/api/admin/stats"); return res.json(); },
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>
  );
  if (!stats) return null;

  return (
    <div className="p-4 pb-6 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Всего игроков",   value: stats.totalPlayers,               icon: "👥", bg: "bg-blue-500/12 border-blue-500/30",   val: "text-blue-600 dark:text-blue-400" },
          { label: "Активны сегодня", value: stats.activeToday,                icon: "🟢", bg: "bg-green-500/12 border-green-500/30",  val: "text-green-600 dark:text-green-400" },
          { label: "Монет в игре",    value: stats.totalCoins.toLocaleString(), icon: "🪙", bg: "bg-amber-500/12 border-amber-500/30",  val: "text-amber-600 dark:text-amber-400" },
          { label: "Гемов в игре",    value: stats.totalGems,                  icon: "💎", bg: "bg-purple-500/12 border-purple-500/30", val: "text-purple-600 dark:text-purple-400" },
          { label: "Средний уровень", value: stats.avgLevel,                   icon: "⭐", bg: "bg-yellow-500/12 border-yellow-500/30", val: "text-yellow-600 dark:text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border-2 rounded-2xl p-3.5`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-bold ${s.val}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Распределение сезонов</p>
        <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-2.5">
          {Object.entries(SEASON_INFO).map(([k, s]) => {
            const count = stats.seasonCounts[k] ?? 0;
            const pct   = stats.totalPlayers > 0 ? (count / stats.totalPlayers) * 100 : 0;
            return (
              <div key={k}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-foreground">{s.emoji} {s.name}</span>
                  <span className="text-muted-foreground">{count} чел.</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${k === "spring" ? "bg-green-400" : k === "summer" ? "bg-yellow-400" : k === "autumn" ? "bg-orange-400" : "bg-blue-400"}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={() => refetch()} className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
        <RefreshCw size={14} /> Обновить
      </button>
    </div>
  );
}

// ── Crops Section ──────────────────────────────────────────────────────────────
const CROP_WORLDS: { id: string; emoji: string; name: string; crops: string[] }[] = [
  { id: "main",   emoji: "🌾", name: "Главная ферма", crops: ["wheat","carrot","tomato","corn","strawberry","sunflower","pumpkin"] },
  { id: "forest", emoji: "🌲", name: "Лесная ферма",  crops: ["blueberry","mushroom"] },
  { id: "desert", emoji: "🏜️", name: "Пустыня",       crops: ["cactus_fruit","dates"] },
  { id: "snow",   emoji: "❄️", name: "Снежная ферма", crops: ["cranberry","ice_root"] },
];

const CROP_FIELDS: { apiKey: string; label: string; icon: string; min: number }[] = [
  { apiKey: "seedCost",    label: "Цена семени",     icon: "🪙", min: 1 },
  { apiKey: "sellPrice",   label: "Цена урожая",     icon: "💰", min: 1 },
  { apiKey: "growSec",     label: "Рост (сек)",      icon: "⏱️", min: 1 },
  { apiKey: "xp",          label: "XP за сбор",      icon: "⭐", min: 0 },
  { apiKey: "energyCost",  label: "Энергия",         icon: "⚡", min: 1 },
  { apiKey: "unlockLevel", label: "Уровень открытия",icon: "🔓", min: 1 },
];

interface CustomCropDef {
  id: string; name: string; emoji: string; world: string;
  seedCost: number; sellPrice: number; growSec: number;
  xp: number; energyCost: number; unlockLevel: number; description: string;
}

type CropOverrides = Record<string, Record<string, number>>;
type CropBaseEntry = { seedCost: number; sellPrice: number; growSec: number; xp: number; energyCost: number; unlockLevel: number; emoji: string; name: string; description: string };
type CropsApiData = {
  baseCropConfig: Record<string, CropBaseEntry>;
  cropOverrides: CropOverrides;
  effectiveCropConfig: Record<string, CropBaseEntry>;
  customCrops: Record<string, CustomCropDef>;
};

const WORLD_OPTIONS = [
  { id: "main",   emoji: "🌾", name: "Главная ферма" },
  { id: "forest", emoji: "🌲", name: "Лесная ферма" },
  { id: "desert", emoji: "🏜️", name: "Пустыня" },
  { id: "snow",   emoji: "❄️", name: "Снежная ферма" },
];

const DEFAULT_NEW_CROP: Omit<CustomCropDef, "id"> = {
  name: "", emoji: "🌱", world: "main",
  seedCost: 10, sellPrice: 25, growSec: 120,
  xp: 10, energyCost: 2, unlockLevel: 1, description: "",
};

function AddCropModal({ onClose, onAdd }: { onClose: () => void; onAdd: (crop: CustomCropDef) => void }) {
  const [form, setForm] = useState<Omit<CustomCropDef, "id">>({ ...DEFAULT_NEW_CROP });
  const [err, setErr] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleAdd() {
    if (!form.name.trim()) { setErr("Введите название культуры"); return; }
    if (!form.emoji.trim()) { setErr("Введите эмодзи"); return; }
    const id = `custom_${form.name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "_").slice(0, 20)}_${Date.now()}`;
    onAdd({ id, ...form, name: form.name.trim(), description: form.description.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 22 }}
        className="bg-card border-t-2 border-border rounded-t-3xl w-full max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-border">
          <div>
            <h2 className="font-bold text-lg text-foreground">🌱 Новая культура</h2>
            <p className="text-xs text-muted-foreground">Добавится во все игровые сессии</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-6 pt-4 flex flex-col gap-3">
          {/* Name + emoji */}
          <div className="flex gap-2">
            <div className="w-16">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Эмодзи</label>
              <input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={4}
                className="mt-1 w-full text-center text-2xl border-2 border-border rounded-xl px-2 py-2 bg-muted focus:border-primary focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Название *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Например: Манго"
                className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>

          {/* World */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Территория</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {WORLD_OPTIONS.map((w) => (
                <button key={w.id} type="button"
                  onClick={() => set("world", w.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                    form.world === w.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}>
                  <span>{w.emoji}</span> {w.name}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-2 gap-2">
            {CROP_FIELDS.map(({ apiKey, label, icon, min }) => (
              <div key={apiKey}>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{icon} {label}</label>
                <input type="number" min={min}
                  value={(form as any)[apiKey]}
                  onChange={(e) => set(apiKey as keyof typeof form, Math.max(min, Number(e.target.value)) as any)}
                  className="mt-1 w-full border-2 border-border rounded-xl px-2 py-2 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Описание (необязательно)</label>
            <input value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Краткое описание культуры"
              className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground text-sm focus:border-primary focus:outline-none" />
          </div>

          {err && <p className="text-red-500 text-sm flex items-center gap-1"><AlertTriangle size={14} />{err}</p>}

          <button onClick={handleAdd}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
            <Plus size={16} className="inline mr-1" /> Добавить культуру
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CropsSection() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<CropOverrides>({});
  const [customCrops, setCustomCrops] = useState<Record<string, CustomCropDef>>({});
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery<CropsApiData>({
    queryKey: ["admin-crops-config"],
    queryFn: async () => { const r = await adminFetch("/api/admin/crops-config"); return r.json(); },
  });

  useEffect(() => {
    if (data && !initialized) {
      setOverrides(data.cropOverrides ?? {});
      setCustomCrops(data.customCrops ?? {});
      setInitialized(true);
    }
  }, [data, initialized]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/crops-config", {
        method: "POST",
        body: JSON.stringify({ cropOverrides: overrides, customCrops }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crops-config"] });
      setSaved(true); setErr("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setErr((e as Error).message),
  });

  const baseCfg = data?.baseCropConfig ?? {};

  function getEffective(cropId: string, apiKey: string): number {
    if (overrides[cropId]?.[apiKey] !== undefined) return overrides[cropId][apiKey];
    const custom = customCrops[cropId];
    if (custom) return (custom as any)[apiKey] ?? 0;
    return (baseCfg[cropId] as any)?.[apiKey] ?? 0;
  }

  function setField(cropId: string, apiKey: string, value: number) {
    const baseVal = customCrops[cropId]
      ? (customCrops[cropId] as any)[apiKey] ?? 0
      : (baseCfg[cropId] as any)?.[apiKey] ?? 0;
    setOverrides((prev) => {
      const crop = { ...(prev[cropId] ?? {}) };
      if (value === baseVal) { delete crop[apiKey]; }
      else { crop[apiKey] = value; }
      const next = { ...prev };
      if (Object.keys(crop).length === 0) delete next[cropId];
      else next[cropId] = crop;
      return next;
    });
  }

  function isModified(cropId: string): boolean {
    return Object.keys(overrides[cropId] ?? {}).length > 0;
  }

  function resetCrop(cropId: string) {
    setOverrides((prev) => { const next = { ...prev }; delete next[cropId]; return next; });
  }

  function deleteCrop(cropId: string) {
    setCustomCrops((prev) => { const next = { ...prev }; delete next[cropId]; return next; });
    setOverrides((prev) => { const next = { ...prev }; delete next[cropId]; return next; });
  }

  function handleAddCrop(crop: CustomCropDef) {
    setCustomCrops((prev) => ({ ...prev, [crop.id]: crop }));
  }

  function renderCropCard(cropId: string, emoji: string, name: string, description: string, isCustom = false) {
    const isOpen = expanded === cropId;
    const modified = isModified(cropId);
    return (
      <div key={cropId}
        className={`bg-card rounded-2xl border-2 overflow-hidden transition-colors ${
          modified ? "border-amber-400/60" : isCustom ? "border-primary/40" : "border-border"
        }`}>
        <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer active:bg-muted/50"
          onClick={() => setExpanded(isOpen ? null : cropId)}>
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground">{name}</span>
              {isCustom && (
                <span className="text-[9px] font-black bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">своя</span>
              )}
              {modified && (
                <span className="text-[9px] font-black bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                  изменено
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>🪙{getEffective(cropId, "seedCost")} семя</span>
              <span>→ 💰{getEffective(cropId, "sellPrice")}</span>
              <span>⏱️{getEffective(cropId, "growSec")}с</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {modified && (
              <button onClick={(e) => { e.stopPropagation(); resetCrop(cropId); }}
                className="text-[10px] text-muted-foreground hover:text-red-500 px-1.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                Сброс
              </button>
            )}
            {isCustom && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить культуру «${name}»?`)) deleteCrop(cropId); }}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
            {isOpen ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border">
              <div className="px-3 pb-3 pt-2.5 grid grid-cols-2 gap-2">
                {CROP_FIELDS.map(({ apiKey, label, icon, min }) => {
                  const effective = getEffective(cropId, apiKey);
                  const isOverridden = overrides[cropId]?.[apiKey] !== undefined;
                  return (
                    <div key={apiKey}>
                      <label className={`text-[9px] font-bold uppercase tracking-wide flex items-center gap-0.5 ${
                        isOverridden ? "text-amber-500" : "text-muted-foreground"
                      }`}>
                        {icon} {label} {isOverridden && "✏️"}
                      </label>
                      <input type="number" min={min} value={effective}
                        onChange={(e) => setField(cropId, apiKey, Math.max(min, Number(e.target.value)))}
                        className={`mt-0.5 w-full border-2 rounded-xl px-2 py-1.5 bg-muted text-foreground text-sm focus:outline-none transition-colors ${
                          isOverridden ? "border-amber-400/60 focus:border-amber-500" : "border-border focus:border-primary"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-3">
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      {/* Status bar */}
      <AnimatePresence>
        {(saved || err) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2
              ${saved ? "bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-500"}`}>
            {saved ? <><Check size={14} /> Сохранено! Изменения сразу в игре.</> : <><AlertTriangle size={14} />{err}</>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* World groups: base + custom crops per world */}
      {CROP_WORLDS.map((world) => {
        const customInWorld = Object.values(customCrops).filter((c) => c.world === world.id);
        return (
          <div key={world.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{world.emoji}</span>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{world.name}</p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              {world.crops.map((cropId) => {
                const crop = CROPS[cropId];
                if (!crop) return null;
                return renderCropCard(cropId, crop.emoji, crop.name, baseCfg[cropId]?.description ?? "");
              })}
              {customInWorld.map((c) =>
                renderCropCard(c.id, c.emoji, c.name, c.description, true)
              )}
            </div>
          </div>
        );
      })}

      {/* Add crop button */}
      <button onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 text-primary font-bold py-3.5 rounded-2xl active:scale-95 transition-all text-sm hover:bg-primary/5">
        <Plus size={18} /> Добавить новую культуру
      </button>

      {/* Save button */}
      <button onClick={() => save()} disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-95 transition-all text-sm sticky bottom-2">
        <Save size={16} />
        {isPending ? "Сохранение…" : "Сохранить каталог"}
      </button>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Изменения применяются сразу — новые игровые сессии получат обновлённые цены.
      </p>

      <AnimatePresence>
        {showAddModal && <AddCropModal onClose={() => setShowAddModal(false)} onAdd={handleAddCrop} />}
      </AnimatePresence>
    </div>
  );
}

// ── Shop Admin Section ────────────────────────────────────────────────────────
const RARITY_LABEL: Record<string, string> = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };
const RARITY_COLOR: Record<string, string> = {
  common:    "bg-gray-500/15 text-gray-500 border-gray-500/30",
  rare:      "bg-blue-500/15 text-blue-500 border-blue-500/30",
  epic:      "bg-purple-500/15 text-purple-500 border-purple-500/30",
  legendary: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};
const RARITY_EMOJI: Record<string, string> = { common: "⬜", rare: "🔵", epic: "🟣", legendary: "🌟" };

interface AdminShopSlot {
  slotIndex: number;
  cropId: string;
  rarity: string;
  price: number;
  stock: number;
  isSeedOfDay?: boolean;
  discountPct?: number;
  totalBought: number;
}
interface AdminShopData {
  epoch: number;
  epochOffset: number;
  nextRefreshMs: number;
  slots: AdminShopSlot[];
}

const BASE_RARITY: Record<string, string> = {
  wheat: "common", carrot: "common", tomato: "common",
  corn: "rare", blueberry: "rare", cranberry: "rare", mushroom: "rare",
  sunflower: "epic", strawberry: "epic", cactus_fruit: "epic", ice_root: "epic",
  pumpkin: "legendary", dates: "legendary",
};
const DEFAULT_CHANCE: Record<string, number> = { common: 100, rare: 85, epic: 70, legendary: 55 };

interface ShopCropOvLocal {
  enabled: boolean;
  rarity: string;        // "" = auto
  appearChance: string;  // "" = auto, or "0"-"100"
  shopPriceMult: string; // "" = 1.0, number string
  shopPrice: string;     // "" = off, else fixed price
}

interface ShopCropOverridesData { shopCropOverrides: Record<string, { enabled?: boolean; rarity?: string; appearChance?: number; shopPriceMult?: number; shopPrice?: number | null }> }

interface ShopGlobalDraft {
  rareAppearChance: string; epicAppearChance: string; legAppearChance: string;
  commonStock: string; rareStock: string; epicStock: string; legStock: string;
  commonPriceMult: string; rarePriceMult: string; epicPriceMult: string; legPriceMult: string;
  sodDiscount: string; sodStock: string;
  epochOffset: string;
}
const GLOBAL_DEFAULTS: ShopGlobalDraft = {
  rareAppearChance: "85", epicAppearChance: "70", legAppearChance: "55",
  commonStock: "10", rareStock: "5", epicStock: "2", legStock: "1",
  commonPriceMult: "1.0", rarePriceMult: "1.2", epicPriceMult: "1.6", legPriceMult: "2.2",
  sodDiscount: "25", sodStock: "3", epochOffset: "0",
};

function ShopAdminSection() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [countdown, setCountdown] = useState("");
  const deadlineRef = useRef<number>(0);
  const [subTab, setSubTab] = useState<"rotation" | "crops" | "settings">("rotation");
  const [cropDraft, setCropDraft] = useState<Record<string, ShopCropOvLocal>>({});
  const [cropSaving, setCropSaving] = useState(false);
  const [globalDraft, setGlobalDraft] = useState<ShopGlobalDraft>(GLOBAL_DEFAULTS);
  const [globalSaving, setGlobalSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery<AdminShopData>({
    queryKey: ["admin-seed-shop"],
    queryFn: async () => { const r = await adminFetch("/api/admin/seed-shop"); return r.json(); },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!data) return;
    deadlineRef.current = Date.now() + data.nextRefreshMs;
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [data]);

  // Fetch crop overrides
  const { data: cropOvData } = useQuery<ShopCropOverridesData>({
    queryKey: ["admin-shop-crop-ov"],
    queryFn: async () => { const r = await adminFetch("/api/admin/seed-shop/crop-overrides"); return r.json(); },
  });

  // Fetch global settings
  const { data: globalData } = useQuery<{ settings: Record<string, number>; epochOffset: number }>({
    queryKey: ["admin-shop-settings"],
    queryFn: async () => { const r = await adminFetch("/api/admin/seed-shop/settings"); return r.json(); },
  });

  useEffect(() => {
    if (!globalData) return;
    const s = globalData.settings;
    setGlobalDraft({
      rareAppearChance: String(Math.round((s.rareAppearChance ?? 0.85) * 100)),
      epicAppearChance: String(Math.round((s.epicAppearChance ?? 0.70) * 100)),
      legAppearChance:  String(Math.round((s.legAppearChance  ?? 0.55) * 100)),
      commonStock:      String(s.commonStock ?? 10),
      rareStock:        String(s.rareStock   ?? 5),
      epicStock:        String(s.epicStock   ?? 2),
      legStock:         String(s.legStock    ?? 1),
      commonPriceMult:  String(s.commonPriceMult ?? 1.0),
      rarePriceMult:    String(s.rarePriceMult   ?? 1.2),
      epicPriceMult:    String(s.epicPriceMult   ?? 1.6),
      legPriceMult:     String(s.legPriceMult    ?? 2.2),
      sodDiscount:      String(s.sodDiscount ?? 25),
      sodStock:         String(s.sodStock    ?? 3),
      epochOffset:      String(globalData.epochOffset ?? 0),
    });
  }, [globalData]);

  // Initialise draft from server data
  useEffect(() => {
    if (!cropOvData) return;
    const serverOv = cropOvData.shopCropOverrides ?? {};
    const allCropIds = CROP_WORLDS.flatMap((w) => w.crops);
    const draft: Record<string, ShopCropOvLocal> = {};
    for (const id of allCropIds) {
      const ov = serverOv[id] ?? {};
      draft[id] = {
        enabled: ov.enabled !== false,
        rarity: ov.rarity ?? "",
        appearChance: ov.appearChance != null ? String(Math.round(ov.appearChance * 100)) : "",
        shopPriceMult: ov.shopPriceMult != null && ov.shopPriceMult !== 1.0 ? String(ov.shopPriceMult) : "",
        shopPrice: ov.shopPrice != null ? String(ov.shopPrice) : "",
      };
    }
    setCropDraft(draft);
  }, [cropOvData]);

  const saveCropOverrides = async () => {
    setCropSaving(true);
    try {
      const payload: Record<string, Record<string, unknown>> = {};
      for (const [id, ov] of Object.entries(cropDraft)) {
        const entry: Record<string, unknown> = {};
        if (!ov.enabled) entry.enabled = false;
        if (ov.rarity) entry.rarity = ov.rarity;
        if (ov.appearChance !== "") entry.appearChance = Math.min(1, Math.max(0, Number(ov.appearChance) / 100));
        if (ov.shopPriceMult !== "") entry.shopPriceMult = Math.max(0.1, Number(ov.shopPriceMult));
        if (ov.shopPrice !== "") entry.shopPrice = Math.max(1, Number(ov.shopPrice));
        if (Object.keys(entry).length > 0) payload[id] = entry;
      }
      const r = await adminFetch("/api/admin/seed-shop/crop-overrides", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopCropOverrides: payload }) });
      if (!r.ok) throw new Error((await r.json()).error);
      qc.invalidateQueries({ queryKey: ["admin-shop-crop-ov"] });
      qc.invalidateQueries({ queryKey: ["admin-seed-shop"] });
      qc.invalidateQueries({ queryKey: ["seed-shop"] });
      showMsg("✅ Настройки культур сохранены");
    } catch (e) {
      showMsg(`❌ ${(e as Error).message}`);
    } finally {
      setCropSaving(false);
    }
  };

  const saveGlobalSettings = async () => {
    setGlobalSaving(true);
    try {
      const g = globalDraft;
      const settings = {
        rareAppearChance: Math.min(1, Math.max(0, Number(g.rareAppearChance) / 100)),
        epicAppearChance: Math.min(1, Math.max(0, Number(g.epicAppearChance) / 100)),
        legAppearChance:  Math.min(1, Math.max(0, Number(g.legAppearChance)  / 100)),
        commonStock:      Math.max(1, Math.round(Number(g.commonStock))),
        rareStock:        Math.max(1, Math.round(Number(g.rareStock))),
        epicStock:        Math.max(1, Math.round(Number(g.epicStock))),
        legStock:         Math.max(1, Math.round(Number(g.legStock))),
        commonPriceMult:  Math.max(0.1, Number(g.commonPriceMult)),
        rarePriceMult:    Math.max(0.1, Number(g.rarePriceMult)),
        epicPriceMult:    Math.max(0.1, Number(g.epicPriceMult)),
        legPriceMult:     Math.max(0.1, Number(g.legPriceMult)),
        sodDiscount:      Math.min(99, Math.max(0, Math.round(Number(g.sodDiscount)))),
        sodStock:         Math.max(1, Math.round(Number(g.sodStock))),
      };
      const epochOffset = Math.max(0, Math.round(Number(g.epochOffset)));
      const r = await adminFetch("/api/admin/seed-shop/settings", {
        method: "PUT",
        body: JSON.stringify({ settings, epochOffset }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      qc.invalidateQueries({ queryKey: ["admin-shop-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-seed-shop"] });
      qc.invalidateQueries({ queryKey: ["seed-shop"] });
      showMsg("✅ Глобальные настройки магазина сохранены");
    } catch (e) {
      showMsg(`❌ ${(e as Error).message}`);
    } finally {
      setGlobalSaving(false);
    }
  };

  const patchCrop = (id: string, patch: Partial<ShopCropOvLocal>) =>
    setCropDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const patchGlobal = (patch: Partial<ShopGlobalDraft>) =>
    setGlobalDraft((prev) => ({ ...prev, ...patch }));

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const { mutate: forceRefresh, isPending: refreshing } = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/api/admin/seed-shop/refresh", { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-seed-shop"] }); qc.invalidateQueries({ queryKey: ["seed-shop"] }); showMsg("✅ Ротация принудительно обновлена"); },
    onError: (e) => showMsg(`❌ ${(e as Error).message}`),
  });

  const { mutate: resetStock, isPending: resetting } = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/api/admin/seed-shop/purchases", { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["admin-seed-shop"] }); qc.invalidateQueries({ queryKey: ["seed-shop"] }); showMsg(`✅ ${d.message}`); },
    onError: (e) => showMsg(`❌ ${(e as Error).message}`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="pb-8">
      {/* Sub-tabs */}
      <div className="flex border-b border-border sticky top-[100px] z-10 bg-background">
        {(["rotation", "crops", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${subTab === t ? "text-foreground" : "text-muted-foreground"}`}>
            {subTab === t && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-t-full" />}
            {t === "rotation" ? "🏪 Ротация" : t === "crops" ? "🌱 Культуры" : "⚙️ Параметры"}
          </button>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-4">
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2 ${
                msg.startsWith("✅") ? "bg-green-500/10 border border-green-500/30 text-green-600"
                                    : "bg-red-500/10 border border-red-500/30 text-red-500"}`}>
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {subTab === "rotation" && (
          <>
            {/* Info + controls */}
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">🏪 Текущая ротация</p>
                  <p className="text-xs text-muted-foreground">Эпоха #{data?.epoch} · смещение +{data?.epochOffset ?? 0}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-muted rounded-xl px-3 py-1.5 text-sm font-mono font-bold">
                  ⏱ {countdown || "..."}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => forceRefresh()} disabled={refreshing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-500/15 border border-blue-500/30 text-blue-500 font-bold text-xs rounded-xl active:scale-95 transition-all disabled:opacity-50">
                  <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                  Принудит. обновление
                </button>
                <button onClick={() => { if (confirm("Сбросить сток текущей эпохи?")) resetStock(); }} disabled={resetting}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs rounded-xl active:scale-95 transition-all disabled:opacity-50">
                  <Trash2 size={13} />
                  Сброс стока
                </button>
                <button onClick={() => refetch()} className="p-2.5 border-2 border-border rounded-xl bg-muted">
                  <RefreshCw size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Slots */}
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Слоты ({data?.slots.length ?? 0})</p>
            <div className="flex flex-col gap-2">
              {data?.slots.map((slot) => {
                const crop = CROPS[slot.cropId];
                const soldPct = slot.stock > 0 ? Math.min(1, slot.totalBought / slot.stock) : 0;
                return (
                  <div key={slot.slotIndex} className={`bg-card border-2 rounded-2xl p-3 flex items-center gap-3 ${slot.isSeedOfDay ? "border-amber-400/50" : "border-border"}`}>
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">
                      {crop?.emoji ?? "❓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm">{crop?.name ?? slot.cropId}</span>
                        {slot.isSeedOfDay && <span className="text-[9px] font-black bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded-full">⭐ СЕМЯ ДНЯ</span>}
                        {slot.discountPct && <span className="text-[9px] font-black bg-red-500/15 text-red-500 px-1.5 py-0.5 rounded-full">-{slot.discountPct}%</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${RARITY_COLOR[slot.rarity]}`}>
                          {RARITY_EMOJI[slot.rarity]} {RARITY_LABEL[slot.rarity]}
                        </span>
                        <span className="text-xs text-muted-foreground">🪙{slot.price}</span>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                          <span>Куплено: {slot.totalBought}</span>
                          <span>Лимит: {slot.stock}/игр.</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${soldPct * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-muted-foreground flex-shrink-0">#{slot.slotIndex + 1}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {subTab === "crops" && (
          <>
            {/* Save button */}
            <button onClick={saveCropOverrides} disabled={cropSaving}
              className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-2xl active:scale-95 transition-all disabled:opacity-60">
              <Save size={15} className={cropSaving ? "animate-spin" : ""} />
              {cropSaving ? "Сохранение…" : "Сохранить настройки"}
            </button>

            <p className="text-[11px] text-muted-foreground -mt-2">
              Обычные (common) культуры всегда появляются. Шанс появления влияет только на редкие+.
            </p>

            {CROP_WORLDS.map((world) => (
              <div key={world.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{world.emoji}</span>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{world.name}</p>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex flex-col gap-2">
                  {world.crops.map((cropId) => {
                    const crop = CROPS[cropId];
                    if (!crop) return null;
                    const ov = cropDraft[cropId] ?? { enabled: true, rarity: "", appearChance: "", shopPriceMult: "", shopPrice: "" };
                    const effectiveRarity = ov.rarity || BASE_RARITY[cropId] || "common";
                    const defaultChance = DEFAULT_CHANCE[effectiveRarity] ?? 100;
                    return (
                      <div key={cropId} className={`bg-card border-2 rounded-2xl p-3 flex flex-col gap-2.5 ${!ov.enabled ? "opacity-50" : "border-border"}`}>
                        {/* Header row */}
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{crop.emoji}</span>
                          <div className="flex-1">
                            <p className="font-bold text-sm">{crop.name}</p>
                            <p className="text-[10px] text-muted-foreground">База: 🪙{crop.seedCost}</p>
                          </div>
                          {/* Enabled toggle */}
                          <button onClick={() => patchCrop(cropId, { enabled: !ov.enabled })}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                              ov.enabled ? "bg-green-500/15 border-green-500/30 text-green-600" : "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}>
                            {ov.enabled ? "✓ В магазине" : "✗ Скрыт"}
                          </button>
                        </div>

                        {ov.enabled && (
                          <div className="grid grid-cols-2 gap-2">
                            {/* Rarity */}
                            <div>
                              <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Редкость</label>
                              <select value={ov.rarity} onChange={(e) => patchCrop(cropId, { rarity: e.target.value })}
                                className="w-full mt-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none">
                                <option value="">Авто ({RARITY_LABEL[BASE_RARITY[cropId]] ?? "—"})</option>
                                <option value="common">⬜ Обычный</option>
                                <option value="rare">🔵 Редкий</option>
                                <option value="epic">🟣 Эпический</option>
                                <option value="legendary">🌟 Легендарный</option>
                              </select>
                            </div>

                            {/* Appear chance */}
                            <div>
                              <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                                Шанс появления {effectiveRarity === "common" ? "(всегда)" : `(авто: ${defaultChance}%)`}
                              </label>
                              <div className="flex items-center gap-1 mt-1">
                                <input type="number" min="0" max="100" step="5"
                                  value={ov.appearChance}
                                  placeholder={effectiveRarity === "common" ? "100" : String(defaultChance)}
                                  onChange={(e) => patchCrop(cropId, { appearChance: e.target.value })}
                                  disabled={effectiveRarity === "common"}
                                  className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none disabled:opacity-40" />
                                <span className="text-xs text-muted-foreground font-bold">%</span>
                              </div>
                            </div>

                            {/* Price multiplier */}
                            <div>
                              <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Ценовой множитель</label>
                              <div className="flex items-center gap-1 mt-1">
                                <input type="number" min="0.1" max="10" step="0.1"
                                  value={ov.shopPriceMult}
                                  placeholder="1.0"
                                  onChange={(e) => patchCrop(cropId, { shopPriceMult: e.target.value })}
                                  className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                                <span className="text-xs text-muted-foreground font-bold">×</span>
                              </div>
                            </div>

                            {/* Fixed price */}
                            <div>
                              <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Фикс. цена (🪙)</label>
                              <input type="number" min="1" step="1"
                                value={ov.shopPrice}
                                placeholder="Авто"
                                onChange={(e) => patchCrop(cropId, { shopPrice: e.target.value })}
                                className="w-full mt-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button onClick={saveCropOverrides} disabled={cropSaving}
              className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-2xl active:scale-95 transition-all disabled:opacity-60">
              <Save size={15} className={cropSaving ? "animate-spin" : ""} />
              {cropSaving ? "Сохранение…" : "Сохранить настройки"}
            </button>
          </>
        )}

        {subTab === "settings" && (
          <>
            <button onClick={saveGlobalSettings} disabled={globalSaving}
              className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-2xl active:scale-95 transition-all disabled:opacity-60">
              <Save size={15} className={globalSaving ? "animate-spin" : ""} />
              {globalSaving ? "Сохранение…" : "Сохранить все параметры"}
            </button>

            {/* Epoch offset */}
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3">
              <p className="font-bold text-sm">🔄 Смещение эпохи</p>
              <p className="text-[11px] text-muted-foreground -mt-2">Каждое нажатие «Принудит. обновления» увеличивает это число. Можно задать вручную.</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="1"
                  value={globalDraft.epochOffset}
                  onChange={(e) => patchGlobal({ epochOffset: e.target.value })}
                  className="w-24 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none" />
                <span className="text-xs text-muted-foreground">текущее значение</span>
              </div>
            </div>

            {/* Appear chances */}
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3">
              <p className="font-bold text-sm">🎲 Шансы появления по умолчанию</p>
              <p className="text-[11px] text-muted-foreground -mt-2">Базовые шансы для слотов. Можно переопределить для каждой культуры в «🌱 Культуры».</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "🔵 Редкий", key: "rareAppearChance" as const, def: "85" },
                  { label: "🟣 Эпический", key: "epicAppearChance" as const, def: "70" },
                  { label: "🌟 Легенд.", key: "legAppearChance" as const, def: "55" },
                ].map(({ label, key, def }) => (
                  <div key={key}>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" step="5"
                        value={globalDraft[key]} placeholder={def}
                        onChange={(e) => patchGlobal({ [key]: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock per player */}
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3">
              <p className="font-bold text-sm">📦 Лимит покупок (на игрока/ротацию)</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "⬜ Обычный", key: "commonStock" as const, def: "10" },
                  { label: "🔵 Редкий",  key: "rareStock"   as const, def: "5"  },
                  { label: "🟣 Эпич.",   key: "epicStock"   as const, def: "2"  },
                  { label: "🌟 Легенд.", key: "legStock"    as const, def: "1"  },
                ].map(({ label, key, def }) => (
                  <div key={key}>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{label}</label>
                    <input type="number" min="1" step="1"
                      value={globalDraft[key]} placeholder={def}
                      onChange={(e) => patchGlobal({ [key]: e.target.value })}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Price multipliers */}
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3">
              <p className="font-bold text-sm">💰 Ценовая наценка по редкости</p>
              <p className="text-[11px] text-muted-foreground -mt-2">Базовая цена семени × множитель редкости × множитель культуры.</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "⬜ Обычный", key: "commonPriceMult" as const, def: "1.0" },
                  { label: "🔵 Редкий",  key: "rarePriceMult"   as const, def: "1.2" },
                  { label: "🟣 Эпич.",   key: "epicPriceMult"   as const, def: "1.6" },
                  { label: "🌟 Легенд.", key: "legPriceMult"    as const, def: "2.2" },
                ].map(({ label, key, def }) => (
                  <div key={key}>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0.1" max="20" step="0.1"
                        value={globalDraft[key]} placeholder={def}
                        onChange={(e) => patchGlobal({ [key]: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                      <span className="text-xs text-muted-foreground">×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seed of Day */}
            <div className="bg-card border-2 border-amber-400/40 rounded-2xl p-4 flex flex-col gap-3">
              <p className="font-bold text-sm">🌟 Семя Дня</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-bold block mb-1">Скидка (%)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="99" step="5"
                      value={globalDraft.sodDiscount} placeholder="25"
                      onChange={(e) => patchGlobal({ sodDiscount: e.target.value })}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-bold block mb-1">Лимит (на игрока)</label>
                  <input type="number" min="1" step="1"
                    value={globalDraft.sodStock} placeholder="3"
                    onChange={(e) => patchGlobal({ sodStock: e.target.value })}
                    className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none" />
                </div>
              </div>
            </div>

            <button onClick={saveGlobalSettings} disabled={globalSaving}
              className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-2xl active:scale-95 transition-all disabled:opacity-60">
              <Save size={15} className={globalSaving ? "animate-spin" : ""} />
              {globalSaving ? "Сохранение…" : "Сохранить все параметры"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── PromoSection ──────────────────────────────────────────────────────────────
interface Promocode {
  id: number;
  code: string;
  rewardCoins: number;
  rewardGems: number;
  maxUses: number | null;
  usedCount: number;
  active: number;
  expiresAt: string | null;
  createdAt: string;
}

const EMPTY_FORM = { code: "", rewardCoins: "", rewardGems: "", maxUses: "", expiresAt: "" };

interface PlayerRefCode {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  refCode: string | null;
  level: number;
  usedCount: number;
}

function PromoSection() {
  const qc = useQueryClient();
  const [promoSubTab, setPromoSubTab] = useState<"promo" | "refcodes">("promo");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [formOk, setFormOk] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null);

  const { data: playerRefCodes = [], isLoading: refLoading } = useQuery<PlayerRefCode[]>({
    queryKey: ["admin-ref-codes"],
    queryFn: () => adminFetch("/api/admin/ref-codes").then((r) => r.json()).then((d) => d.codes ?? []),
    enabled: promoSubTab === "refcodes",
    refetchInterval: 20000,
  });

  const clearRefCodeMutation = useMutation({
    mutationFn: async (telegramId: string) => {
      const res = await adminFetch(`/api/admin/ref-codes/${telegramId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ref-codes"] }); setDeletingRefId(null); },
  });

  const { data: codes = [], isLoading } = useQuery<Promocode[]>({
    queryKey: ["admin-promos"],
    queryFn: () => adminFetch("/api/admin/promocodes").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim()) throw new Error("Введите код");
      const res = await adminFetch("/api/admin/promocodes", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim(),
          rewardCoins: Number(form.rewardCoins) || 0,
          rewardGems: Number(form.rewardGems) || 0,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
      setForm(EMPTY_FORM);
      setFormOk(true);
      setFormErr("");
      setTimeout(() => setFormOk(false), 2000);
    },
    onError: (e) => { setFormErr((e as Error).message); setFormOk(false); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ code, active }: { code: string; active: number }) => {
      const res = await adminFetch(`/api/admin/promocodes/${code}`, { method: "PATCH", body: JSON.stringify({ active }) });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promos"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await adminFetch(`/api/admin/promocodes/${code}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); setDeletingCode(null); },
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-4 space-y-4">
      {/* Sub-tab switcher */}
      <div className="bg-muted/40 rounded-xl p-1 flex gap-1 border border-border">
        {([["promo", "🎟 Промокоды"], ["refcodes", "🔗 Реф. коды"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPromoSubTab(id)}
            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${promoSubTab === id ? "bg-white shadow text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ref codes list */}
      {promoSubTab === "refcodes" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-black text-sm">Персональные реф. коды</span>
            <span className="text-xs text-muted-foreground">{playerRefCodes.length} шт.</span>
          </div>
          {refLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>
          ) : playerRefCodes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Ни один игрок ещё не создал код</div>
          ) : (
            <div className="divide-y divide-border">
              {playerRefCodes.map((p) => {
                const isConfirm = deletingRefId === p.telegramId;
                const name = p.firstName || p.username || `ID ${p.telegramId}`;
                return (
                  <div key={p.telegramId} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-green-700 tracking-wider">{p.refCode}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Lv.{p.level}</span>
                        {p.usedCount > 0 && <span className="text-[10px] font-bold text-amber-600">×{p.usedCount} использ.</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{name}</p>
                    </div>
                    {isConfirm ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => setDeletingRefId(null)} className="px-2 py-1 text-xs bg-muted rounded-lg font-bold">Отмена</button>
                        <button onClick={() => clearRefCodeMutation.mutate(p.telegramId)} disabled={clearRefCodeMutation.isPending} className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg font-bold disabled:opacity-40">Удалить</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingRefId(p.telegramId)} className="shrink-0 text-xs text-red-500 font-bold flex items-center gap-1">
                        <Trash2 size={12} /> Очистить
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Promo content */}
      {promoSubTab === "promo" && <>
      {/* Create form */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={16} className="text-violet-500" />
          <h3 className="font-black text-base">Новый промокод</h3>
        </div>

        <div className="space-y-2.5">
          {/* Code */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">Код *</label>
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
              placeholder="SUMMER2024"
              maxLength={32}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-violet-400 transition-colors"
            />
          </div>

          {/* Rewards row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">🪙 Монеты</label>
              <input type="number" min="0" value={form.rewardCoins} onChange={f("rewardCoins")} placeholder="0"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">💎 Гемы</label>
              <input type="number" min="0" value={form.rewardGems} onChange={f("rewardGems")} placeholder="0"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 transition-colors" />
            </div>
          </div>

          {/* Max uses + Expires */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">Макс. использований</label>
              <input type="number" min="1" value={form.maxUses} onChange={f("maxUses")} placeholder="∞"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">Срок до</label>
              <input type="date" value={form.expiresAt} onChange={f("expiresAt")}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 transition-colors" />
            </div>
          </div>

          {/* Feedback */}
          {formErr && <p className="text-xs text-red-500 font-bold">{formErr}</p>}
          {formOk && <p className="text-xs text-green-600 font-bold">✓ Промокод создан!</p>}

          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.code.trim()}
            className="w-full py-3 rounded-xl bg-violet-500 text-white font-black text-sm border-b-2 border-violet-700 active:translate-y-0.5 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            {createMutation.isPending ? "Создаём..." : "Создать промокод"}
          </button>
        </div>
      </div>

      {/* Codes list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-black text-sm">Все промокоды</span>
          <span className="text-xs text-muted-foreground">{codes.length} шт.</span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>
        ) : codes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Нет промокодов. Создайте первый!</div>
        ) : (
          <div className="divide-y divide-border">
            {codes.map((promo) => {
              const isExpired = promo.expiresAt ? new Date(promo.expiresAt) < new Date() : false;
              const isFull = promo.maxUses !== null && promo.usedCount >= promo.maxUses;
              const isConfirmDelete = deletingCode === promo.code;

              return (
                <div key={promo.code} className="px-4 py-3 space-y-2">
                  {/* Top row: code + status + toggle */}
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm tracking-wider flex-1 text-violet-600 dark:text-violet-400">{promo.code}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      !promo.active || isExpired || isFull
                        ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:border-red-800"
                        : "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:border-green-800"
                    }`}>
                      {!promo.active ? "ВЫКЛ" : isExpired ? "ПРОСРОЧЕН" : isFull ? "ЛИМИТ" : "АКТИВЕН"}
                    </span>
                    <button
                      onClick={() => toggleMutation.mutate({ code: promo.code, active: promo.active ? 0 : 1 })}
                      disabled={toggleMutation.isPending}
                      className={`w-10 h-5 rounded-full transition-colors relative ${promo.active ? "bg-green-500" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${promo.active ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>

                  {/* Rewards + usage */}
                  <div className="flex items-center gap-3 text-xs">
                    {promo.rewardCoins > 0 && <span className="font-bold text-amber-600">🪙 {promo.rewardCoins}</span>}
                    {promo.rewardGems > 0 && <span className="font-bold text-purple-600">💎 {promo.rewardGems}</span>}
                    <span className="text-muted-foreground ml-auto">
                      Использовано: {promo.usedCount}{promo.maxUses !== null ? `/${promo.maxUses}` : ""}
                    </span>
                    {promo.expiresAt && (
                      <span className="text-muted-foreground">
                        до {new Date(promo.expiresAt).toLocaleDateString("ru")}
                      </span>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="flex justify-end">
                    {isConfirmDelete ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingCode(null)}
                          className="px-3 py-1 text-xs bg-muted rounded-lg font-bold"
                        >Отмена</button>
                        <button
                          onClick={() => deleteMutation.mutate(promo.code)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg font-bold border-b border-red-700 disabled:opacity-40"
                        >Удалить</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingCode(promo.code)}
                        className="flex items-center gap-1 text-xs text-red-500 font-bold"
                      >
                        <Trash2 size={12} /> Удалить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ── Cases Section ─────────────────────────────────────────────────────────────
const CASE_COLOR_PRESETS = [
  { value: "from-emerald-500 to-green-600",    glow: "rgba(52,211,153,0.5)",   label: "Зелёный" },
  { value: "from-blue-500 to-indigo-600",      glow: "rgba(99,102,241,0.5)",   label: "Синий" },
  { value: "from-amber-400 to-orange-500",     glow: "rgba(251,191,36,0.6)",   label: "Золотой" },
  { value: "from-purple-500 to-pink-600",      glow: "rgba(168,85,247,0.5)",   label: "Фиолетовый" },
  { value: "from-red-500 to-rose-600",         glow: "rgba(239,68,68,0.5)",    label: "Красный" },
  { value: "from-cyan-400 to-teal-500",        glow: "rgba(34,211,238,0.5)",   label: "Бирюзовый" },
  { value: "from-fuchsia-500 to-purple-700",   glow: "rgba(217,70,239,0.5)",   label: "Маджента" },
  { value: "from-lime-400 to-green-500",       glow: "rgba(163,230,53,0.5)",   label: "Лаймовый" },
];

const STATIC_GEM_CASES = [
  { id: "green_case",  name: "Зелёный кейс",  emoji: "🌿", gemCost: 25,  color: "from-emerald-500 to-green-600",  weights: [{ r: "Редкое 70%" }, { r: "Эпик 25%" }, { r: "Легенда 5%" }] },
  { id: "blue_case",   name: "Синий кейс",    emoji: "💠", gemCost: 55,  color: "from-blue-500 to-indigo-600",    weights: [{ r: "Редкое 20%" }, { r: "Эпик 60%" }, { r: "Легенда 20%" }] },
  { id: "golden_case", name: "Золотой кейс",  emoji: "👑", gemCost: 110, color: "from-amber-400 to-orange-500",  weights: [{ r: "Эпик 35%" }, { r: "Легенда 65%" }] },
];

type DropRow = { cropId: string; chancePercent: string; minQty: string; maxQty: string };

function emptyCaseForm() {
  return { name: "", emoji: "📦", gemCost: "50", description: "", color: CASE_COLOR_PRESETS[0].value, drops: [{ cropId: "wheat", chancePercent: "100", minQty: "2", maxQty: "4" }] as DropRow[] };
}

type CaseDef = { id: string; name: string; emoji: string; gemCost: number; description: string; color: string; glowColor: string; active: boolean; drops: { cropId: string; chance: number; minQty: number; maxQty: number }[] };

const ALL_CROP_OPTIONS = [
  ...Object.values(CROPS).map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
  ...Object.values(EXCLUSIVE_CROPS).map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
];

function CasesSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"builtin" | "custom">("custom");
  const [editingCase, setEditingCase] = useState<CaseDef | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyCaseForm());
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const { data, isLoading } = useQuery<{ cases: Record<string, CaseDef> }>({
    queryKey: ["admin-cases"],
    queryFn: async () => { const r = await adminFetch("/api/admin/cases"); return r.json(); },
  });

  const { data: cropsData } = useQuery<{ customCrops: Record<string, { id: string; name: string; emoji: string }> }>({
    queryKey: ["admin-crops-config"],
    queryFn: async () => { const r = await adminFetch("/api/admin/crops-config"); return r.json(); },
  });

  const allCropOptions = [
    ...ALL_CROP_OPTIONS,
    ...Object.values(cropsData?.customCrops ?? {}).map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
  ];

  const { mutate: saveCase, isPending: saving } = useMutation({
    mutationFn: async () => {
      const dropsTotal = form.drops.reduce((s, d) => s + Number(d.chancePercent), 0);
      if (Math.abs(dropsTotal - 100) > 0.5) throw new Error(`Сумма шансов ${dropsTotal}% ≠ 100%`);
      const drops = form.drops.map((d) => ({ cropId: d.cropId, chance: Number(d.chancePercent) / 100, minQty: Number(d.minQty), maxQty: Number(d.maxQty) }));
      const glowColor = CASE_COLOR_PRESETS.find((p) => p.value === form.color)?.glow ?? "rgba(168,85,247,0.5)";
      const body = { name: form.name, emoji: form.emoji, gemCost: Number(form.gemCost), description: form.description, color: form.color, glowColor, drops };
      const url = editingCase ? `/api/admin/cases/${editingCase.id}` : "/api/admin/cases";
      const method = editingCase ? "PATCH" : "POST";
      const r = await adminFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cases"] }); setOk("Кейс сохранён!"); setErr(""); setCreating(false); setEditingCase(null); setForm(emptyCaseForm()); setTimeout(() => setOk(""), 2500); },
    onError: (e) => { setErr((e as Error).message); setOk(""); },
  });

  const { mutate: toggleCase } = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const r = await adminFetch(`/api/admin/cases/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cases"] }),
  });

  const { mutate: deleteCase } = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("Удалить кейс?")) return;
      const r = await adminFetch(`/api/admin/cases/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cases"] }),
  });

  function openCreate() { setEditingCase(null); setForm(emptyCaseForm()); setErr(""); setOk(""); setCreating(true); }
  function openEdit(c: CaseDef) {
    setEditingCase(c);
    setForm({
      name: c.name, emoji: c.emoji, gemCost: String(c.gemCost),
      description: c.description, color: c.color,
      drops: c.drops.map((d) => ({ cropId: d.cropId, chancePercent: String(Math.round(d.chance * 100)), minQty: String(d.minQty), maxQty: String(d.maxQty) })),
    });
    setErr(""); setOk(""); setCreating(true);
  }

  const customList = Object.values(data?.cases ?? {});
  const dropsTotal = form.drops.reduce((s, d) => s + Number(d.chancePercent || 0), 0);
  const dropsTotalOk = Math.abs(dropsTotal - 100) < 0.5;

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      {/* Status bar */}
      <AnimatePresence>
        {(ok || err) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2 ${ok ? "bg-green-500/10 border border-green-500/30 text-green-600" : "bg-red-500/10 border border-red-500/30 text-red-500"}`}>
            {ok ? <><Check size={14} /> {ok}</> : <><AlertTriangle size={14} /> {err}</>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-tabs */}
      <div className="flex bg-muted rounded-2xl p-1 gap-1">
        {[{ id: "builtin" as const, label: "🎁 Базовые" }, { id: "custom" as const, label: "✨ Кастомные" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Builtin cases (read-only) ── */}
      {tab === "builtin" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Встроенные кейсы — только для просмотра. Для изменения создай кастомный кейс.</p>
          {STATIC_GEM_CASES.map((c) => (
            <div key={c.id} className={`rounded-2xl p-4 bg-gradient-to-r ${c.color} text-white shadow-md`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{c.emoji}</span>
                <div className="flex-1">
                  <div className="font-bold text-base">{c.name}</div>
                  <div className="text-xs text-white/80">💎 {c.gemCost} кристаллов</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.weights.map((w, i) => (
                  <span key={i} className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full">{w.r}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Custom cases ── */}
      {tab === "custom" && !creating && (
        <div className="flex flex-col gap-3">
          <button onClick={openCreate}
            className="flex items-center justify-center gap-2 py-3 bg-primary/10 border-2 border-primary/30 border-dashed rounded-2xl text-primary font-bold text-sm active:scale-95 transition-all">
            <Plus size={16} /> Создать новый кейс
          </button>

          {isLoading && <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>}

          {customList.length === 0 && !isLoading && (
            <div className="text-center py-10 text-muted-foreground text-sm">Кастомных кейсов пока нет</div>
          )}

          {customList.map((c) => (
            <div key={c.id} className="bg-card border-2 border-border rounded-2xl overflow-hidden shadow-sm">
              <div className={`h-1.5 w-full bg-gradient-to-r ${c.color}`} />
              <div className="p-3 flex items-start gap-3">
                <span className="text-2xl mt-0.5">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{c.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      {c.active ? "Активен" : "Скрыт"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">💎 {c.gemCost} · {c.drops.length} вариантов дропа</div>
                  {c.description && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.description}</div>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.drops.map((d, i) => {
                      const crop = allCropOptions.find((o) => o.id === d.cropId);
                      return (
                        <span key={i} className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                          {crop?.emoji ?? "🌱"} {crop?.name ?? d.cropId} {Math.round(d.chance * 100)}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 px-3 pb-3">
                <button onClick={() => openEdit(c)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20 active:scale-95 transition-all">
                  <Edit2 size={12} /> Изменить
                </button>
                <button onClick={() => toggleCase({ id: c.id, active: !c.active })}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border active:scale-95 transition-all ${c.active ? "bg-muted text-muted-foreground border-border" : "bg-green-500/10 text-green-600 border-green-500/20"}`}>
                  {c.active ? "Скрыть" : "Показать"}
                </button>
                <button onClick={() => deleteCase(c.id)}
                  className="flex items-center justify-center px-3 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 active:scale-95 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit form ── */}
      {tab === "custom" && creating && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">{editingCase ? "✏️ Редактировать кейс" : "➕ Новый кейс"}</h3>
            <button onClick={() => { setCreating(false); setEditingCase(null); setForm(emptyCaseForm()); }}
              className="p-2 rounded-full bg-muted text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          {/* Name + Emoji */}
          <div className="flex gap-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Эмодзи</label>
              <input value={form.emoji} onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))} maxLength={4}
                className="mt-1 w-14 text-center text-2xl border-2 border-border rounded-xl px-1 py-2 bg-muted focus:border-primary focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Название</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Мой кейс"
                className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground focus:border-primary focus:outline-none text-sm" />
            </div>
          </div>

          {/* Gem cost + Description */}
          <div className="flex gap-2">
            <div className="w-28">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">💎 Стоимость</label>
              <input type="number" value={form.gemCost} min={1} onChange={(e) => setForm((p) => ({ ...p, gemCost: e.target.value }))}
                className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground focus:border-primary focus:outline-none text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Описание</label>
              <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Краткое описание"
                className="mt-1 w-full border-2 border-border rounded-xl px-3 py-2.5 bg-muted text-foreground focus:border-primary focus:outline-none text-sm" />
            </div>
          </div>

          {/* Color preset */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Цвет</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CASE_COLOR_PRESETS.map((p) => (
                <button key={p.value} onClick={() => setForm((f) => ({ ...f, color: p.value }))}
                  className={`rounded-xl h-10 bg-gradient-to-r ${p.value} relative ${form.color === p.value ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                  {form.color === p.value && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Drops editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Дропы</label>
              <span className={`text-xs font-bold ${dropsTotalOk ? "text-green-600" : "text-red-500"}`}>
                Итого: {dropsTotal}% {dropsTotalOk ? "✓" : "(нужно 100%)"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {form.drops.map((drop, i) => {
                const crop = allCropOptions.find((o) => o.id === drop.cropId);
                return (
                  <div key={i} className="bg-muted rounded-2xl p-3 flex flex-col gap-2">
                    {/* Crop selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{crop?.emoji ?? "🌱"}</span>
                      <select
                        value={drop.cropId}
                        onChange={(e) => setForm((f) => ({ ...f, drops: f.drops.map((d, j) => j === i ? { ...d, cropId: e.target.value } : d) }))}
                        className="flex-1 border-2 border-border rounded-xl px-2 py-1.5 bg-card text-foreground text-sm focus:border-primary focus:outline-none"
                      >
                        {allCropOptions.map((o) => (
                          <option key={o.id} value={o.id}>{o.emoji} {o.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setForm((f) => ({ ...f, drops: f.drops.filter((_, j) => j !== i) }))}
                        className="p-1.5 rounded-lg text-red-400 bg-red-500/10 flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                    {/* Chance + qty */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground font-bold mb-1">Шанс %</div>
                        <input type="number" value={drop.chancePercent} min={0} max={100}
                          onChange={(e) => setForm((f) => ({ ...f, drops: f.drops.map((d, j) => j === i ? { ...d, chancePercent: e.target.value } : d) }))}
                          className="w-full border-2 border-border rounded-xl px-2 py-1.5 bg-card text-foreground text-sm focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground font-bold mb-1">Мин. кол.</div>
                        <input type="number" value={drop.minQty} min={1}
                          onChange={(e) => setForm((f) => ({ ...f, drops: f.drops.map((d, j) => j === i ? { ...d, minQty: e.target.value } : d) }))}
                          className="w-full border-2 border-border rounded-xl px-2 py-1.5 bg-card text-foreground text-sm focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground font-bold mb-1">Макс. кол.</div>
                        <input type="number" value={drop.maxQty} min={1}
                          onChange={(e) => setForm((f) => ({ ...f, drops: f.drops.map((d, j) => j === i ? { ...d, maxQty: e.target.value } : d) }))}
                          className="w-full border-2 border-border rounded-xl px-2 py-1.5 bg-card text-foreground text-sm focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setForm((f) => ({ ...f, drops: [...f.drops, { cropId: "wheat", chancePercent: "0", minQty: "1", maxQty: "3" }] }))}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground active:scale-95 transition-all">
              <Plus size={13} /> Добавить дроп
            </button>
          </div>

          {/* Save button */}
          <button onClick={() => saveCase()} disabled={saving || !form.name.trim() || form.drops.length === 0}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
            <Save size={16} /> {saving ? "Сохранение…" : (editingCase ? "Сохранить изменения" : "Создать кейс")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main AdminTab ─────────────────────────────────────────────────────────────
const SECTIONS: { id: Section; icon: React.ReactNode; label: string }[] = [
  { id: "players", icon: <Users     size={15} />, label: "Игроки" },
  { id: "manage",  icon: <Cloud     size={15} />, label: "Управление" },
  { id: "crops",   icon: <Sprout    size={15} />, label: "Культуры" },
  { id: "cases",   icon: <Package   size={15} />, label: "Кейсы" },
  { id: "content", icon: <FileEdit  size={15} />, label: "Контент" },
  { id: "shop",    icon: <Store     size={15} />, label: "Магазин" },
  { id: "promo",   icon: <Tag      size={15} />, label: "Промо" },
  { id: "stats",   icon: <BarChart3 size={15} />, label: "Статы" },
];

export function AdminTab() {
  const [section, setSection] = useState<Section>("players");

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-white font-bold text-base">🛡️ Админ-панель</h1>
        <p className="text-slate-400 text-xs">Мини-Ферма</p>
      </div>

      <div className="flex bg-card border-b-2 border-border sticky top-[52px] z-10">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-bold transition-all relative ${
              section === s.id ? "text-foreground" : "text-muted-foreground"}`}>
            {section === s.id && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-b-full" />}
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {section === "players" && (
          <motion.div key="pl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <PlayersSection />
          </motion.div>
        )}
        {section === "manage" && (
          <motion.div key="mn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <ManageSection />
          </motion.div>
        )}
        {section === "crops" && (
          <motion.div key="cr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <CropsSection />
          </motion.div>
        )}
        {section === "cases" && (
          <motion.div key="ca" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <CasesSection />
          </motion.div>
        )}
        {section === "content" && (
          <motion.div key="ct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <ContentSection />
          </motion.div>
        )}
        {section === "shop" && (
          <motion.div key="sh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <ShopAdminSection />
          </motion.div>
        )}
        {section === "promo" && (
          <motion.div key="pr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <PromoSection />
          </motion.div>
        )}
        {section === "stats" && (
          <motion.div key="st" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <StatsSection />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
