import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DrawerModal } from "@/components/ui/drawer-modal";
import { FarmData } from "@/lib/types";
import { CROPS, PRODUCTS, EXCLUSIVE_CROPS } from "@/lib/constants";
import { PackageOpen } from "lucide-react";
import { useFarmAction } from "@/hooks/use-farm";
import { EmojiImg } from "@/components/ui/emoji-img";

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: FarmData;
}

export function InventoryModal({ isOpen, onClose, farm }: InventoryModalProps) {
  const { mutate, isPending } = useFarmAction();
  const [confirmSellAll, setConfirmSellAll] = useState(false);

  const cropItems = Object.entries(farm.inventory).filter(([, count]) => count > 0);
  const productItems = Object.entries(farm.products).filter(([, count]) => count > 0);
  const hasAnything = cropItems.length > 0 || productItems.length > 0;

  // Compute approximate total (client-side, without season multiplier)
  const totalApprox = cropItems.reduce((sum, [cropId, count]) => {
    const price = CROPS[cropId]?.sellPrice ?? EXCLUSIVE_CROPS[cropId]?.sellPrice ?? 0;
    return sum + price * count;
  }, 0) + productItems.reduce((sum, [prodId, count]) => {
    return sum + (PRODUCTS[prodId]?.sellPrice ?? 0) * count;
  }, 0);

  const handleSellAll = () => {
    if (!confirmSellAll) {
      setConfirmSellAll(true);
      // Auto-reset confirmation after 3s
      setTimeout(() => setConfirmSellAll(false), 3000);
      return;
    }
    setConfirmSellAll(false);
    mutate({ action: "sell_all" }, { onSuccess: () => onClose() });
  };

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Амбар" icon={<PackageOpen className="text-orange-600" />}>
      {!hasAnything ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <EmojiImg emoji="🌾" size={52} className="mb-3 opacity-40" />
          <h3 className="font-display font-bold text-lg mb-1">Амбар пуст!</h3>
          <p className="text-muted-foreground text-sm">Собирайте урожай и продукты животных, чтобы продать их.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-8">

          {/* Sell all button */}
          <AnimatePresence mode="wait">
            {confirmSellAll ? (
              <motion.button
                key="confirm"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleSellAll}
                disabled={isPending}
                className="w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 bg-red-500 text-white border-b-4 border-red-700 active:translate-y-0.5 active:border-b-2 transition-all shadow-md"
              >
                ⚠️ Точно продать всё?
              </motion.button>
            ) : (
              <motion.button
                key="sellall"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleSellAll}
                disabled={isPending}
                className="w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white border-b-4 border-orange-700 active:translate-y-0.5 active:border-b-2 transition-all shadow-md"
                style={{ boxShadow: "0 4px 16px rgba(251,146,60,0.4)" }}
              >
                🛒 Продать всё · 🪙 {totalApprox.toLocaleString()}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Individual crop items */}
          {cropItems.map(([cropId, count]) => {
            const crop = CROPS[cropId] ?? EXCLUSIVE_CROPS[cropId];
            if (!crop) return null;
            const total = count * crop.sellPrice;
            return (
              <div key={cropId} className="flex items-center bg-card p-3 rounded-2xl border-2 border-border shadow-sm">
                <EmojiImg emoji={crop.emoji} size={32} className="mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-bold">{crop.name}</div>
                  <div className="text-xs text-muted-foreground">×{count} · 🪙 {crop.sellPrice} за шт.</div>
                </div>
                <button
                  onClick={() => mutate({ action: "sell_crops", cropType: cropId, quantity: count })}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg border-b-2 border-orange-700 active:translate-y-0.5 disabled:opacity-40"
                >
                  🪙{total}
                </button>
              </div>
            );
          })}

          {/* Individual product items */}
          {productItems.map(([prodId, count]) => {
            const prod = PRODUCTS[prodId];
            if (!prod) return null;
            const total = count * prod.sellPrice;
            return (
              <div key={prodId} className="flex items-center bg-card p-3 rounded-2xl border-2 border-border shadow-sm">
                <EmojiImg emoji={prod.emoji} size={32} className="mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-bold">{prod.name}</div>
                  <div className="text-xs text-muted-foreground">×{count} · 🪙 {prod.sellPrice} за шт.</div>
                </div>
                <button
                  onClick={() => mutate({ action: "sell_product", cropType: prodId, quantity: count })}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg border-b-2 border-orange-700 active:translate-y-0.5 disabled:opacity-40"
                >
                  🪙{total}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </DrawerModal>
  );
}
