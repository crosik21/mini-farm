import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLevelProgress, SEASON_CONFIG } from "@/lib/constants";
import { FarmData } from "@/lib/types";
import { Zap, Gem, Plus } from "lucide-react";

interface TopBarProps {
  farm: FarmData;
  onEnergyClick?: () => void;
}

const WEATHER_CHIP_STYLE: Record<string, string> = {
  sunny: "bg-amber-50 border-amber-200 text-amber-700",
  rainy: "bg-blue-50 border-blue-200 text-blue-700",
  storm: "bg-gray-100 border-gray-300 text-gray-700",
};

export function TopBar({ farm, onEnergyClick }: TopBarProps) {
  const { progress, current, needed } = getLevelProgress(farm.xp, farm.level);
  const season = SEASON_CONFIG[farm.season] || SEASON_CONFIG.spring;
  const energyPct = Math.min(100, (farm.energy / farm.maxEnergy) * 100);
  const energyLow = farm.energy < 5;
  const [showWeatherTip, setShowWeatherTip] = useState(false);
  const weather = farm.currentWeather ?? "sunny";
  const weatherCfg = farm.weatherConfig ?? { emoji: "☀️", label: "Солнечно", tip: "" };

  return (
    <div
      className="top-bar sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border shadow-sm px-3 pb-1.5"
    >
      {/* ── Row 1: Level + XP bar + Season + Weather ── */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-bold text-white text-[11px] shadow border-[1.5px] border-amber-600 flex-shrink-0">
          {farm.level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between mb-0.5">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Уровень {farm.level}</span>
            <span className="text-[9px] text-gray-400">{current}/{needed} XP</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Season + Weather together */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowWeatherTip((v) => !v)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-all active:scale-95 ${season.bgColor} ${season.color}`}
            style={{ borderColor: "currentColor", borderOpacity: 0.25 }}
          >
            <span>{season.emoji}</span>
            <span className="opacity-40 text-[8px]">|</span>
            <span>{weatherCfg.emoji}</span>
          </button>
          <AnimatePresence>
            {showWeatherTip && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                className="absolute top-full right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 w-48 text-xs"
                onClick={() => setShowWeatherTip(false)}
              >
                <div className="flex items-center gap-1 font-bold mb-1 text-[11px]">
                  <span>{season.emoji}</span>
                  <span className={season.color}>{season.name}</span>
                  <span className="text-gray-300 mx-0.5">·</span>
                  <span>{weatherCfg.emoji}</span>
                  <span>{weatherCfg.label}</span>
                </div>
                <div className="text-gray-500 leading-snug">{weatherCfg.tip}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Row 2: Coins + Gems + Energy ── */}
      <div className="flex items-center gap-1.5">
        <motion.div key={farm.coins} initial={{ scale: 1.12 }} animate={{ scale: 1 }}
          className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          <span className="text-xs">🪙</span>
          <span className="font-bold text-amber-700 text-xs">{(farm.coins ?? 0).toLocaleString()}</span>
        </motion.div>

        <motion.div key={farm.gems} initial={{ scale: 1.12 }} animate={{ scale: 1 }}
          className="flex items-center gap-0.5 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
          <Gem className="w-2.5 h-2.5 text-purple-500" />
          <span className="font-bold text-purple-700 text-xs">{farm.gems}</span>
        </motion.div>

        <button
          onClick={onEnergyClick}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 flex-1 border transition-all active:scale-95 ${
            energyLow ? "bg-red-50 border-red-200" : "bg-sky-50 border-sky-200"
          }`}
        >
          <Zap className={`w-3 h-3 flex-shrink-0 ${energyLow ? "text-red-500" : "text-sky-500"}`} />
          <div className="flex-1 h-1 bg-white/70 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${energyLow ? "bg-red-400" : "bg-sky-400"}`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
          <span className={`text-[11px] font-bold flex-shrink-0 ${energyLow ? "text-red-600" : "text-sky-700"}`}>
            {farm.energy}/{farm.maxEnergy}
          </span>
          <Plus className={`w-2.5 h-2.5 flex-shrink-0 ${energyLow ? "text-red-400" : "text-sky-400"}`} />
        </button>
      </div>
    </div>
  );
}
