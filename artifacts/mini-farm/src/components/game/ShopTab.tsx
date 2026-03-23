import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ClipboardList, Sprout, Palette } from "lucide-react";
import { FarmData } from "@/lib/types";
import { MarketTab } from "./MarketTab";
import { QuestsTab } from "./QuestsTab";
import { SeedShopTab } from "./SeedShopTab";
import { SkinsTab } from "./SkinsTab";

type ShopSection = "seeds" | "market" | "quests" | "skins";

interface ShopTabProps {
  farm: FarmData;
  onActivateItem?: (itemType: "watering_can" | "sprinkler" | "fertilizer" | "lightning") => void;
}

export function ShopTab({ farm }: ShopTabProps) {
  const [section, setSection] = useState<ShopSection>("seeds");
  const claimable = (farm.quests ?? []).filter((q) => q.completed && !q.claimed).length;

  const tabs: { id: ShopSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "seeds",  label: "Семена",  icon: <Sprout size={15} /> },
    { id: "market", label: "НПС",     icon: <ShoppingBag size={15} /> },
    { id: "quests", label: "Задания", icon: <ClipboardList size={15} />, badge: claimable },
    { id: "skins",  label: "Скины",   icon: <Palette size={15} /> },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Sticky sub-nav ── */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 pt-3 pb-2">
        <div className="flex gap-1 bg-muted rounded-2xl p-1">
          {tabs.map((tab) => {
            const isActive = section === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all duration-200
                  ${isActive ? "bg-card text-green-700 shadow-sm" : "text-muted-foreground"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="shop-tab-pill"
                    className="absolute inset-0 bg-card rounded-xl shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {tab.icon}
                  {tab.label}
                  {(tab.badge ?? 0) > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {section === "seeds" && (
          <motion.div
            key="seeds"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
          >
            <SeedShopTab farm={farm} />
          </motion.div>
        )}
        {section === "market" && (
          <motion.div
            key="market"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
          >
            <MarketTab farm={farm} />
          </motion.div>
        )}
        {section === "quests" && (
          <motion.div
            key="quests"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
          >
            <QuestsTab farm={farm} />
          </motion.div>
        )}
        {section === "skins" && (
          <motion.div
            key="skins"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
          >
            <SkinsTab farm={farm} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
