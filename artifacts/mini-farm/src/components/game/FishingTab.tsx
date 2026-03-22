import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FarmData, FishingSession, FishMeta } from "@/lib/types";
import { FISH_META } from "@/lib/constants";
import { getTelegramId } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FishingTabProps {
  farm: FarmData;
}

function CountdownTimer({ catchAt, onReady }: { catchAt: string; onReady: () => void }) {
  const [rem, setRem] = useState(0);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, new Date(catchAt).getTime() - Date.now());
      setRem(Math.ceil(ms / 1000));
      if (ms <= 0 && !notified) {
        setNotified(true);
        onReady();
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [catchAt, notified, onReady]);

  if (rem <= 0) return <span className="text-green-600 font-bold">Готово! Тяни! 🎣</span>;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return <span className="font-mono font-bold text-blue-700">{m > 0 ? `${m}м ${s}с` : `${s}с`}</span>;
}

export function FishingTab({ farm }: FishingTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const telegramId = getTelegramId();

  const [session, setSession] = useState<FishingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [catching, setCatching] = useState(false);
  const [catchResult, setCatchResult] = useState<{ fishType: string; meta: FishMeta } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sellLoading, setSellLoading] = useState<string | null>(null);

  const fishInv = farm.fishInventory ?? {};

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/fishing/status`, {
        headers: { "x-telegram-id": telegramId },
      });
      const data = await res.json();
      setSession(data.session);
      if (data.session) {
        const isNowReady = new Date() >= new Date(data.session.catchAt);
        setIsReady(isNowReady);
      }
    } catch {
      // ignore
    }
  }

  async function startFishing() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/fishing/start`, {
        method: "POST",
        headers: { "x-telegram-id": telegramId, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setSession(data.session);
      setIsReady(false);
      toast({ title: "Удочка заброшена! 🎣", description: `Ждите ~${data.waitSec}с` });
      queryClient.invalidateQueries({ queryKey: ["farm", telegramId] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function collectFish() {
    setCatching(true);
    try {
      const res = await fetch(`${API_BASE}/api/fishing/collect`, {
        method: "POST",
        headers: { "x-telegram-id": telegramId, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCatchResult({ fishType: data.fishType, meta: data.fishMeta[data.fishType] });
      setSession(null);
      setIsReady(false);
      queryClient.invalidateQueries({ queryKey: ["farm", telegramId] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setCatching(false);
    }
  }

  async function sellFish(fishType: string, qty: number) {
    setSellLoading(fishType);
    try {
      const res = await fetch(`${API_BASE}/api/fishing/sell`, {
        method: "POST",
        headers: { "x-telegram-id": telegramId, "Content-Type": "application/json" },
        body: JSON.stringify({ fishType, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      toast({ title: `Продано! 🪙 +${data.earned}` });
      queryClient.invalidateQueries({ queryKey: ["farm", telegramId] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setSellLoading(null);
    }
  }

  const fishEntries = Object.entries(fishInv).filter(([, q]) => q > 0);

  return (
    <div className="p-4 pb-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-display font-bold text-xl">🎣 Рыбалка</h2>
        <span className="text-xs text-muted-foreground ml-auto">⚡ {farm.energy}/{farm.maxEnergy}</span>
      </div>

      {/* Fishing area */}
      <motion.div
        className="bg-gradient-to-b from-sky-100 to-blue-200 rounded-2xl p-5 border-2 border-blue-300 relative overflow-hidden"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center">
          {!session && (
            <>
              <div className="text-5xl mb-3 select-none">🌊</div>
              <p className="text-sm text-blue-800 mb-4">Закиньте удочку и поймайте рыбу!<br/><span className="font-bold">Стоимость: 3 ⚡</span></p>
              <button
                onClick={startFishing}
                disabled={loading || farm.energy < 3}
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl border-b-2 border-blue-800 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Закидываем..." : farm.energy < 3 ? "Мало энергии" : "🎣 Закинуть удочку"}
              </button>
            </>
          )}

          {session && !isReady && (
            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="text-5xl"
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                🎣
              </motion.div>
              <p className="text-sm font-semibold text-blue-800">Ожидание клёва...</p>
              <CountdownTimer catchAt={session.catchAt} onReady={() => setIsReady(true)} />
            </div>
          )}

          {session && isReady && (
            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="text-5xl"
                animate={{ scale: [1, 1.3, 1], rotate: [-10, 10, -10] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              >
                🐟
              </motion.div>
              <p className="text-sm font-bold text-green-700">Клюёт! Тяни скорее!</p>
              <button
                onClick={collectFish}
                disabled={catching}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl border-b-2 border-green-800 active:translate-y-0.5 transition-all"
              >
                {catching ? "Тянем..." : "🎣 Тянуть!"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Catch result popup */}
      <AnimatePresence>
        {catchResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="bg-white border-2 border-green-400 rounded-2xl p-5 text-center shadow-lg"
          >
            <div className="text-5xl mb-2">{catchResult.meta.emoji}</div>
            <h3 className="font-bold text-lg text-green-700">Поймана: {catchResult.meta.name}!</h3>
            <p className="text-sm text-muted-foreground mt-1">Цена продажи: {catchResult.meta.sellPrice} 🪙</p>
            <button onClick={() => setCatchResult(null)} className="mt-3 text-xs text-blue-600 underline">Закрыть</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fish probability table */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Таблица улова</h3>
        <div className="flex flex-col gap-2">
          {Object.entries(FISH_META).map(([id, meta]) => {
            const chances: Record<string, string> = {
              bass: "40%", carp: "30%", pike: "18%", salmon: "10%", legendary_fish: "2%",
            };
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className="text-xl">{meta.emoji}</span>
                <span className="font-medium flex-1">{meta.name}</span>
                <span className="text-xs text-muted-foreground">{chances[id]}</span>
                <span className="font-bold text-amber-600">{meta.sellPrice} 🪙</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fish inventory */}
      {fishEntries.length > 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <h3 className="font-bold text-sm mb-3">🐟 Моя рыба</h3>
          <div className="flex flex-col gap-2">
            {fishEntries.map(([fishType, qty]) => {
              const meta = FISH_META[fishType];
              if (!meta) return null;
              return (
                <div key={fishType} className="flex items-center gap-2">
                  <span className="text-xl">{meta.emoji}</span>
                  <span className="font-medium flex-1">{meta.name}</span>
                  <span className="font-bold text-blue-700">×{qty}</span>
                  <button
                    onClick={() => sellFish(fishType, qty)}
                    disabled={sellLoading === fishType}
                    className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-lg border-b border-amber-700 active:translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {sellLoading === fishType ? "..." : `Продать 🪙${meta.sellPrice * qty}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fishEntries.length === 0 && !session && (
        <p className="text-center text-sm text-muted-foreground py-2">
          Пока улов пустой. Закидывайте удочку! 🎣
        </p>
      )}
    </div>
  );
}
