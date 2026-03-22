import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Home, ShoppingBag, User, Shield, Users, Fish, Gift, Trophy, Store, MoreHorizontal, X, Package } from "lucide-react";

export type Tab = "farm" | "shop" | "fishing" | "marketplace" | "friends" | "cases" | "pass" | "profile" | "admin";

const ADMIN_TELEGRAM_ID = "1335699132";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  shopBadge?: number;
  profileBadge?: number;
  telegramId?: string;
}

const TAB_COLORS = {
  default: {
    pill: "bg-green-500/15",
    text: "text-green-600",
    glow: "rgba(34,197,94,0.35)",
  },
  admin: {
    pill: "bg-slate-500/12",
    text: "text-slate-600",
    glow: "rgba(100,116,139,0.3)",
  },
};

// Tabs in the "More" tray
const MORE_TABS: Tab[] = ["marketplace", "cases", "friends", "pass"];

export function BottomNav({ activeTab, onTabChange, shopBadge, profileBadge, telegramId }: BottomNavProps) {
  const isAdmin = telegramId === ADMIN_TELEGRAM_ID;
  const [morOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_TABS.includes(activeTab) || (isAdmin && activeTab === "admin");

  function handleTabChange(tab: Tab) {
    onTabChange(tab);
    setMoreOpen(false);
  }

  const mainTabs: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode; badge?: number }[] = [
    {
      id: "farm",
      label: "Ферма",
      icon: (active) => <Home size={20} strokeWidth={active ? 2.5 : 1.7} />,
    },
    {
      id: "shop",
      label: "Магазин",
      icon: (active) => <ShoppingBag size={20} strokeWidth={active ? 2.5 : 1.7} />,
      badge: shopBadge,
    },
    {
      id: "fishing",
      label: "Рыбалка",
      icon: (active) => <Fish size={20} strokeWidth={active ? 2.5 : 1.7} />,
    },
    {
      id: "profile",
      label: "Профиль",
      icon: (active) => <User size={20} strokeWidth={active ? 2.5 : 1.7} />,
      badge: profileBadge,
    },
  ];

  const moreTabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number; isAdmin?: boolean }[] = [
    {
      id: "marketplace",
      label: "Рынок",
      icon: <Store size={22} strokeWidth={1.7} />,
    },
    {
      id: "cases",
      label: "Кейсы",
      icon: <Gift size={22} strokeWidth={1.7} />,
    },
    {
      id: "friends",
      label: "Друзья",
      icon: <Users size={22} strokeWidth={1.7} />,
    },
    {
      id: "pass",
      label: "Пасс",
      icon: <Trophy size={22} strokeWidth={1.7} />,
    },
    ...(isAdmin
      ? [{
          id: "admin" as Tab,
          label: "Админ",
          icon: <Shield size={22} strokeWidth={1.7} />,
          isAdmin: true,
        }]
      : []),
  ];

  return (
    <>
      {/* More tray backdrop */}
      <AnimatePresence>
        {morOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More tray */}
      <AnimatePresence>
        {morOpen && (
          <motion.div
            key="tray"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="fixed left-0 right-0 z-50 mx-3 rounded-3xl overflow-hidden"
            style={{
              bottom: "calc(var(--safe-bottom, 0px) + 74px)",
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ещё</span>
              <button onClick={() => setMoreOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 px-2 pb-3">
              {moreTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const colors = tab.isAdmin ? TAB_COLORS.admin : TAB_COLORS.default;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition-colors",
                      isActive ? colors.pill : "hover:bg-gray-50"
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    <span className={cn("transition-colors", isActive ? colors.text : "text-gray-400")}>
                      {tab.icon}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold leading-none",
                      isActive ? colors.text : "text-gray-400"
                    )}>
                      {tab.label}
                    </span>
                    {(tab.badge ?? 0) > 0 && (
                      <span className="absolute top-1.5 right-3 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                        {tab.badge! > 9 ? "9+" : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main nav bar */}
      <div
        className="flex-shrink-0 relative z-30"
        style={{
          background: "var(--nav-bg, rgba(255,255,255,0.94))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid var(--nav-border, rgba(0,0,0,0.07))",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
          paddingBottom: "calc(var(--safe-bottom, 0px) + 10px)",
        }}
      >
        <div className="flex items-center justify-around px-1 pt-1.5 pb-1">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const colors = TAB_COLORS.default;
            return (
              <button
                key={tab.id}
                onClick={() => { handleTabChange(tab.id); }}
                className="relative flex-1 flex flex-col items-center py-1.5 focus:outline-none"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className={`absolute inset-x-2 top-0.5 bottom-0.5 rounded-2xl ${colors.pill}`}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    style={{ boxShadow: `0 0 16px ${colors.glow}` }}
                  />
                )}
                <motion.span
                  animate={{ scale: isActive ? 1.18 : 1, y: isActive ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className={cn(
                    "relative z-10 transition-colors duration-150",
                    isActive ? colors.text : "text-gray-400"
                  )}
                  style={{ filter: isActive ? `drop-shadow(0 0 6px ${colors.glow})` : "none" }}
                >
                  {tab.icon(isActive)}
                </motion.span>
                <motion.span
                  animate={{ opacity: isActive ? 1 : 0.5 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "relative z-10 text-[10px] font-black mt-0.5 leading-none tracking-wide",
                    isActive ? colors.text : "text-gray-400"
                  )}
                >
                  {tab.label}
                </motion.span>
                {(tab.badge ?? 0) > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0 right-[calc(50%-22px)] min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center z-20 shadow-sm"
                  >
                    {tab.badge! > 9 ? "9+" : tab.badge}
                  </motion.span>
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="relative flex-1 flex flex-col items-center py-1.5 focus:outline-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isMoreActive && !morOpen && (
              <motion.div
                layoutId="nav-active-pill"
                className={`absolute inset-x-2 top-0.5 bottom-0.5 rounded-2xl ${TAB_COLORS.default.pill}`}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                style={{ boxShadow: `0 0 16px ${TAB_COLORS.default.glow}` }}
              />
            )}
            <motion.span
              animate={{ scale: (isMoreActive || morOpen) ? 1.18 : 1, y: (isMoreActive || morOpen) ? -1 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className={cn(
                "relative z-10 transition-colors duration-150",
                (isMoreActive || morOpen) ? TAB_COLORS.default.text : "text-gray-400"
              )}
              style={{ filter: (isMoreActive || morOpen) ? `drop-shadow(0 0 6px ${TAB_COLORS.default.glow})` : "none" }}
            >
              {morOpen ? <X size={20} strokeWidth={2.5} /> : <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.7} />}
            </motion.span>
            <motion.span
              animate={{ opacity: (isMoreActive || morOpen) ? 1 : 0.5 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "relative z-10 text-[10px] font-black mt-0.5 leading-none tracking-wide",
                (isMoreActive || morOpen) ? TAB_COLORS.default.text : "text-gray-400"
              )}
            >
              Ещё
            </motion.span>
          </button>
        </div>
      </div>
    </>
  );
}
