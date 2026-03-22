import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Home, ShoppingBag, User, Shield, Users, Package, Fish, Store, Gift } from "lucide-react";

export type Tab = "farm" | "shop" | "fishing" | "marketplace" | "friends" | "cases" | "profile" | "admin";

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

export function BottomNav({ activeTab, onTabChange, shopBadge, profileBadge, telegramId }: BottomNavProps) {
  const isAdmin = telegramId === ADMIN_TELEGRAM_ID;

  const tabs: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode; badge?: number; isAdmin?: boolean }[] = [
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
      id: "marketplace",
      label: "Рынок",
      icon: (active) => <Store size={20} strokeWidth={active ? 2.5 : 1.7} />,
    },
    {
      id: "cases",
      label: "Кейсы",
      icon: (active) => <Gift size={20} strokeWidth={active ? 2.5 : 1.7} />,
    },
    {
      id: "friends",
      label: "Друзья",
      icon: (active) => <Users size={20} strokeWidth={active ? 2.5 : 1.7} />,
    },
    {
      id: "profile",
      label: "Профиль",
      icon: (active) => <User size={20} strokeWidth={active ? 2.5 : 1.7} />,
      badge: profileBadge,
    },
    ...(isAdmin
      ? [{
          id: "admin" as Tab,
          label: "Админ",
          icon: (active: boolean) => <Shield size={20} strokeWidth={active ? 2.5 : 1.7} />,
          isAdmin: true,
        }]
      : []),
  ];

  return (
    <div
      className="flex-shrink-0"
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
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const colors = tab.isAdmin ? TAB_COLORS.admin : TAB_COLORS.default;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex-1 flex flex-col items-center py-1.5 focus:outline-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Animated sliding pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className={`absolute inset-x-2 top-0.5 bottom-0.5 rounded-2xl ${colors.pill}`}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  style={{ boxShadow: `0 0 16px ${colors.glow}` }}
                />
              )}

              {/* Icon */}
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

              {/* Label */}
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

              {/* Badge */}
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
      </div>
    </div>
  );
}
