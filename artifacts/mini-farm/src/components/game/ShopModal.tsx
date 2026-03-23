import { DrawerModal } from "@/components/ui/drawer-modal";
import { FarmData } from "@/lib/types";
import { CROPS } from "@/lib/constants";
import { Store } from "lucide-react";
import { useFarmAction } from "@/hooks/use-farm";
import { EmojiImg } from "@/components/ui/emoji-img";

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: FarmData;
}

export function ShopModal({ isOpen, onClose, farm }: ShopModalProps) {
  const { mutate, isPending } = useFarmAction();

  const handleBuy = (cropId: string, quantity: number) => {
    mutate({ action: "buy_seeds", cropType: cropId, quantity });
  };

  const available = Object.values(CROPS).filter((c) => c.unlockLevel <= farm.level);
  const locked = Object.values(CROPS).filter((c) => c.unlockLevel > farm.level);

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Магазин семян" icon={<Store className="text-secondary" />}>
      <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-xl">
        <span className="font-bold text-amber-800">Баланс:</span>
        <span className="font-display font-bold text-amber-600 text-lg">🪙 {(farm.coins ?? 0).toLocaleString()}</span>
      </div>

      <div className="flex flex-col gap-3 pb-8">
        {available.map((crop) => {
          const can1 = farm.coins >= crop.seedCost;
          const can5 = farm.coins >= crop.seedCost * 5;
          return (
            <div key={crop.id} className="flex items-center bg-card p-3 rounded-2xl border-2 border-border shadow-sm">
              <EmojiImg emoji={crop.emoji} size={32} className="mr-3 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold">{crop.name}</div>
                <div className="text-xs text-muted-foreground">
                  🪙 {crop.seedCost} семя · продажа 🪙 {crop.sellPrice}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                <button onClick={() => handleBuy(crop.id, 1)} disabled={!can1 || isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg border-b-2 border-green-700 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  Купить 1
                </button>
                <button onClick={() => handleBuy(crop.id, 5)} disabled={!can5 || isPending}
                  className="px-3 py-1 text-[11px] font-bold bg-secondary text-white rounded-lg border-b-2 border-orange-700 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  х5 (🪙{crop.seedCost * 5})
                </button>
              </div>
            </div>
          );
        })}

        {locked.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔒 Ещё не открыто</p>
            {locked.map((crop) => (
              <div key={crop.id} className="flex items-center bg-muted/40 p-3 rounded-xl border border-muted mb-2 opacity-60">
                <EmojiImg emoji={crop.emoji} size={28} className="mr-3 flex-shrink-0 grayscale" />
                <div className="flex-1">
                  <div className="font-bold text-sm">{crop.name}</div>
                  <div className="text-xs text-muted-foreground">Открывается на уровне {crop.unlockLevel}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DrawerModal>
  );
}
