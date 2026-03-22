import { motion } from "framer-motion";
import { FarmData, NpcOrder } from "@/lib/types";
import { ITEM_EMOJIS, ITEM_NAMES } from "@/lib/constants";
import { useFarmAction } from "@/hooks/use-farm";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { EmojiImg } from "@/components/ui/emoji-img";

interface MarketTabProps {
  farm: FarmData;
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (rem === 0) { setText("Истёк"); return; }
      const h = Math.floor(rem / 3600);
      const m = Math.floor((rem % 3600) / 60);
      const s = rem % 60;
      setText(h > 0 ? `${h}ч ${m}м` : m > 0 ? `${m}м ${s}с` : `${s}с`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  return <span className="text-[10px] text-muted-foreground">⏱ {text}</span>;
}

function NpcOrderCard({ order, farm, onComplete, isPending }: {
  order: NpcOrder;
  farm: FarmData;
  onComplete: () => void;
  isPending: boolean;
}) {
  const expired = new Date() > new Date(order.expiresAt);
  const canComplete = !expired && !order.completed && order.items.every(({ itemId, quantity }) => {
    const inInv = itemId in farm.inventory;
    const have = inInv ? (farm.inventory as any)[itemId] ?? 0 : (farm.products as any)[itemId] ?? 0;
    return have >= quantity;
  });

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={`bg-card border-2 rounded-2xl p-4 ${order.completed ? "border-muted opacity-50" : expired ? "border-red-200 bg-red-50/50" : "border-card-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <EmojiImg emoji={order.npcEmoji} size={28} />
        <div className="flex-1">
          <div className="font-bold text-sm">{order.npcName}</div>
          <CountdownBadge expiresAt={order.expiresAt} />
        </div>
        {order.completed && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Выполнен ✅</span>}
        {expired && !order.completed && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Истёк</span>}
      </div>

      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-1">Нужно:</p>
        {order.items.map(({ itemId, quantity }) => {
          const inInv = itemId in farm.inventory;
          const have = inInv ? (farm.inventory as any)[itemId] ?? 0 : (farm.products as any)[itemId] ?? 0;
          const ok = have >= quantity;
          return (
            <div key={itemId} className={`flex items-center gap-2 text-sm font-semibold ${ok ? "text-green-700" : "text-red-600"}`}>
              <EmojiImg emoji={ITEM_EMOJIS[itemId] || "📦"} size={18} />
              <span>{ITEM_NAMES[itemId] || itemId}</span>
              <span className="ml-auto">{have}/{quantity}</span>
              {ok ? <span>✅</span> : <span>❌</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs font-bold mb-3">
        <span className="text-amber-600">🪙 +{order.reward.coins}</span>
        <span className="text-blue-600">⭐ +{order.reward.xp} XP</span>
      </div>

      {!order.completed && !expired && (
        <button onClick={onComplete} disabled={!canComplete || isPending}
          className={`w-full py-2 font-bold text-sm rounded-xl border-b-2 transition-all active:translate-y-0.5
            ${canComplete ? "bg-primary text-white border-green-700" : "bg-muted text-muted-foreground border-muted-foreground/30 cursor-not-allowed opacity-60"}`}>
          {canComplete ? "Выполнить заказ!" : "Не хватает товаров"}
        </button>
      )}
    </motion.div>
  );
}

export function MarketTab({ farm }: MarketTabProps) {
  const { mutate, isPending } = useFarmAction();

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl">🏪 Заказы НПС</h2>
        <button onClick={() => mutate({ action: "refresh_orders" })} disabled={isPending}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50">
          <RefreshCw className="w-3 h-3" /> Обновить
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {farm.npcOrders.map((order) => (
          <NpcOrderCard key={order.id} order={order} farm={farm}
            onComplete={() => mutate({ action: "complete_npc_order", orderId: order.id } as any)}
            isPending={isPending} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Заказы автоматически обновляются после выполнения всех
      </p>
    </div>
  );
}
