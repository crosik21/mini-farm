import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  farmStateTable,
  shopPurchasesTable,
  promocodesTable,
  promocodeUsesTable,
  referralsTable,
  achievementsTable,
  farmPassTable,
  type PlotState,
  type CropInventory,
  type AnimalState,
  type BuildingState,
  type ProductInventory,
  type QuestState,
  type NpcOrder,
  type Season,
  type ItemInventory,
  type ActiveSprinkler,
  type WorldId,
  type WorldsData,
  type Achievement,
  type ToolTiers,
  type FarmPass,
  type PetsInventory,
  type PetEntry,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getAdminConfig, saveAdminConfig, DEFAULT_SHOP_GLOBAL, type SeasonalEventDef } from "../admin-config";

const router: IRouter = Router();

// ─────────────────────────────────── Constants ────────────────────────────────

type CropEntry = { growSec: number; seedCost: number; sellPrice: number; xp: number; energyCost: number; unlockLevel: number; world?: WorldId };

const BASE_CROP_CONFIG: Record<string, CropEntry> = {
  wheat:        { growSec: 30,   seedCost: 5,   sellPrice: 8,   xp: 5,   energyCost: 2, unlockLevel: 1 },
  carrot:       { growSec: 60,   seedCost: 10,  sellPrice: 16,  xp: 10,  energyCost: 2, unlockLevel: 1 },
  tomato:       { growSec: 120,  seedCost: 20,  sellPrice: 35,  xp: 15,  energyCost: 2, unlockLevel: 2 },
  corn:         { growSec: 300,  seedCost: 35,  sellPrice: 80,  xp: 25,  energyCost: 3, unlockLevel: 3 },
  strawberry:   { growSec: 600,  seedCost: 60,  sellPrice: 180, xp: 40,  energyCost: 3, unlockLevel: 4 },
  sunflower:    { growSec: 900,  seedCost: 80,  sellPrice: 220, xp: 50,  energyCost: 3, unlockLevel: 5 },
  pumpkin:      { growSec: 1800, seedCost: 150, sellPrice: 500, xp: 80,  energyCost: 4, unlockLevel: 7 },
  // 🌲 Лесная ферма
  blueberry:    { growSec: 180,  seedCost: 25,  sellPrice: 65,  xp: 20,  energyCost: 2, unlockLevel: 1, world: "forest" },
  mushroom:     { growSec: 500,  seedCost: 70,  sellPrice: 185, xp: 45,  energyCost: 3, unlockLevel: 1, world: "forest" },
  // 🏜️ Пустыня
  cactus_fruit: { growSec: 1200, seedCost: 110, sellPrice: 330, xp: 60,  energyCost: 3, unlockLevel: 1, world: "desert" },
  dates:        { growSec: 2400, seedCost: 190, sellPrice: 680, xp: 100, energyCost: 4, unlockLevel: 1, world: "desert" },
  // ❄️ Снежная ферма
  cranberry:    { growSec: 400,  seedCost: 45,  sellPrice: 115, xp: 35,  energyCost: 2, unlockLevel: 1, world: "snow" },
  ice_root:     { growSec: 800,  seedCost: 110, sellPrice: 285, xp: 75,  energyCost: 3, unlockLevel: 1, world: "snow" },
  // 🎁 Эксклюзивные (только из кейсов, сажаются на главной ферме)
  rainbow_corn: { growSec: 600,  seedCost: 0, sellPrice: 290,  xp: 48,  energyCost: 3, unlockLevel: 1 },
  lucky_clover: { growSec: 900,  seedCost: 0, sellPrice: 350,  xp: 55,  energyCost: 3, unlockLevel: 1 },
  moonberry:    { growSec: 2400, seedCost: 0, sellPrice: 700,  xp: 80,  energyCost: 3, unlockLevel: 1 },
  starfruit:    { growSec: 3600, seedCost: 0, sellPrice: 900,  xp: 100, energyCost: 4, unlockLevel: 1 },
  dragon_fruit: { growSec: 7200, seedCost: 0, sellPrice: 2000, xp: 200, energyCost: 4, unlockLevel: 1 },
};

// ── Gem case config (mirrors frontend constants) ──────────────────────────────
type CaseRarity = "rare" | "epic" | "legendary";
const CASE_RARITY_CROPS: Record<CaseRarity, string[]> = {
  rare:      ["rainbow_corn", "lucky_clover"],
  epic:      ["moonberry", "starfruit"],
  legendary: ["dragon_fruit"],
};
const GEM_CASES: Record<string, { gemCost: number; weights: { rarity: CaseRarity; chance: number }[]; minSeeds: number; maxSeeds: number }> = {
  green_case:  { gemCost: 25,  minSeeds: 2, maxSeeds: 4, weights: [{ rarity: "rare", chance: 0.70 }, { rarity: "epic", chance: 0.25 }, { rarity: "legendary", chance: 0.05 }] },
  blue_case:   { gemCost: 55,  minSeeds: 3, maxSeeds: 5, weights: [{ rarity: "rare", chance: 0.20 }, { rarity: "epic", chance: 0.60 }, { rarity: "legendary", chance: 0.20 }] },
  golden_case: { gemCost: 110, minSeeds: 5, maxSeeds: 8, weights: [{ rarity: "rare", chance: 0.00 }, { rarity: "epic", chance: 0.35 }, { rarity: "legendary", chance: 0.65 }] },
};

function getActiveCropConfig(): Record<string, CropEntry> {
  const cfg = getAdminConfig();
  const overrides = cfg.cropOverrides ?? {};
  const customCrops = cfg.customCrops ?? {};
  // Merge: base + custom definitions, then apply overrides on top
  const merged: Record<string, CropEntry> = { ...BASE_CROP_CONFIG };
  for (const [id, c] of Object.entries(customCrops)) {
    merged[id] = { growSec: c.growSec, seedCost: c.seedCost, sellPrice: c.sellPrice, xp: c.xp, energyCost: c.energyCost, unlockLevel: c.unlockLevel, world: c.world as WorldId };
  }
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, { ...v, ...overrides[k] }])
  );
}

function getEffectiveWorldConfig() {
  const cfg = getAdminConfig();
  const customCrops = cfg.customCrops ?? {};
  const effective: typeof WORLD_CONFIG = {
    main:   { ...WORLD_CONFIG.main,   crops: [...WORLD_CONFIG.main.crops] },
    forest: { ...WORLD_CONFIG.forest, crops: [...WORLD_CONFIG.forest.crops] },
    desert: { ...WORLD_CONFIG.desert, crops: [...WORLD_CONFIG.desert.crops] },
    snow:   { ...WORLD_CONFIG.snow,   crops: [...WORLD_CONFIG.snow.crops] },
  };
  for (const [cropId, cropDef] of Object.entries(customCrops)) {
    const world = cropDef.world as WorldId;
    if (effective[world] && !effective[world].crops.includes(cropId)) {
      effective[world].crops.push(cropId);
    }
  }
  return effective;
}

// Keep backward-compat alias used in serializer (resolved per-request where needed)
const CROP_CONFIG = BASE_CROP_CONFIG;

const WORLD_CONFIG: Record<WorldId, {
  name: string; emoji: string; bg1: string; bg2: string;
  bonus: string | null; bonusDesc: string;
  crops: string[]; unlockCost: number; growMultiplier: number; xpMultiplier: number; doubleChanceBonus: number;
}> = {
  main:   { name: "Главная ферма",  emoji: "🌾", bg1: "#a8e6a3", bg2: "#d4f1c0", bonus: null,         bonusDesc: "Твоя родная ферма",              crops: ["wheat","carrot","tomato","corn","strawberry","sunflower","pumpkin","rainbow_corn","lucky_clover","moonberry","starfruit","dragon_fruit"], unlockCost: 0,    growMultiplier: 1.0, xpMultiplier: 1.0, doubleChanceBonus: 0 },
  forest: { name: "Лесная ферма",   emoji: "🌲", bg1: "#2d6b3e", bg2: "#4a9e5c", bonus: "fast_growth", bonusDesc: "+50% скорость роста всех культур", crops: ["wheat","carrot","blueberry","mushroom","strawberry"],            unlockCost: 500,  growMultiplier: 0.5, xpMultiplier: 1.0, doubleChanceBonus: 0 },
  desert: { name: "Пустыня",        emoji: "🏜️", bg1: "#c8853c", bg2: "#f0c060", bonus: "rare_drops",  bonusDesc: "30% шанс двойного урожая",        crops: ["corn","cactus_fruit","dates","sunflower"],                       unlockCost: 500,  growMultiplier: 1.0, xpMultiplier: 1.0, doubleChanceBonus: 0.30 },
  snow:   { name: "Снежная ферма",  emoji: "❄️", bg1: "#7ab4d4", bg2: "#c8e8f4", bonus: "double_xp",   bonusDesc: "×2 опыт за каждый урожай",        crops: ["wheat","cranberry","ice_root","pumpkin"],                        unlockCost: 500,  growMultiplier: 1.0, xpMultiplier: 2.0, doubleChanceBonus: 0 },
};

const ANIMAL_CONFIG: Record<string, { cost: number; productType: string; productReadySec: number; xp: number; unlockLevel: number; emoji: string }> = {
  chicken: { cost: 200,  productType: "egg",  productReadySec: 300,  xp: 20, unlockLevel: 2, emoji: "🐔" },
  cow:     { cost: 600,  productType: "milk", productReadySec: 600,  xp: 40, unlockLevel: 4, emoji: "🐄" },
  sheep:   { cost: 400,  productType: "wool", productReadySec: 480,  xp: 30, unlockLevel: 3, emoji: "🐑" },
  pig:     { cost: 800,  productType: "meat", productReadySec: 720,  xp: 50, unlockLevel: 5, emoji: "🐷" },
  bee:     { cost: 1200, productType: "honey",productReadySec: 600,  xp: 45, unlockLevel: 7, emoji: "🐝" },
};

const BUILDING_CONFIG: Record<string, { cost: number; unlockLevel: number; emoji: string; name: string; shelter?: boolean }> = {
  barn:    { cost: 150,  unlockLevel: 1, emoji: "🏚️", name: "Амбар", shelter: true },
  mill:    { cost: 300,  unlockLevel: 3, emoji: "⚙️", name: "Мельница" },
  bakery:  { cost: 600,  unlockLevel: 5, emoji: "🍞", name: "Пекарня" },
  dairy:   { cost: 800,  unlockLevel: 7, emoji: "🧀", name: "Молочный цех" },
  kitchen: { cost: 900,  unlockLevel: 6, emoji: "🍳", name: "Кухня" },
};

const RECIPE_CONFIG: Record<string, { building: string; inputs: { itemId: string; quantity: number }[]; outputId: string; outputQty: number; craftSec: number; sellPrice: number; xp: number }> = {
  // ── Мельница ──────────────────────────────────────────────────────────────
  flour:       { building: "mill",   inputs: [{ itemId: "wheat",     quantity: 2 }],  outputId: "flour",       outputQty: 1, craftSec: 60,   sellPrice: 20,   xp: 10  },
  corn_starch: { building: "mill",   inputs: [{ itemId: "corn",      quantity: 2 }],  outputId: "corn_starch", outputQty: 1, craftSec: 90,   sellPrice: 180,  xp: 30  },
  berry_juice: { building: "mill",   inputs: [{ itemId: "blueberry", quantity: 3 }],  outputId: "berry_juice", outputQty: 1, craftSec: 120,  sellPrice: 160,  xp: 28  },
  // ── Пекарня ───────────────────────────────────────────────────────────────
  bread:       { building: "bakery", inputs: [{ itemId: "flour",      quantity: 1 }, { itemId: "egg",         quantity: 1 }],                                          outputId: "bread",       outputQty: 1, craftSec: 120,  sellPrice: 70,   xp: 25  },
  corn_bread:  { building: "bakery", inputs: [{ itemId: "corn_starch",quantity: 1 }, { itemId: "egg",         quantity: 1 }],                                          outputId: "corn_bread",  outputQty: 1, craftSec: 240,  sellPrice: 380,  xp: 55  },
  pumpkin_pie: { building: "bakery", inputs: [{ itemId: "pumpkin",    quantity: 1 }, { itemId: "flour",       quantity: 2 }, { itemId: "egg", quantity: 1 }],           outputId: "pumpkin_pie", outputQty: 1, craftSec: 1200, sellPrice: 1100, xp: 120 },
  // ── Молочный цех ──────────────────────────────────────────────────────────
  cheese:       { building: "dairy",   inputs: [{ itemId: "milk",       quantity: 2 }],  outputId: "cheese",       outputQty: 1, craftSec: 600,  sellPrice: 90,   xp: 35  },
  berry_jam:    { building: "dairy",   inputs: [{ itemId: "blueberry",  quantity: 4 }],  outputId: "berry_jam",    outputQty: 1, craftSec: 300,  sellPrice: 200,  xp: 40  },
  mushroom_soup:{ building: "dairy",   inputs: [{ itemId: "mushroom",   quantity: 2 }, { itemId: "milk",   quantity: 1 }], outputId: "mushroom_soup",outputQty: 1, craftSec: 600,  sellPrice: 420,  xp: 60  },
  ice_cream:    { building: "dairy",   inputs: [{ itemId: "milk",       quantity: 2 }, { itemId: "ice_root", quantity: 1 }], outputId: "ice_cream",   outputQty: 1, craftSec: 900,  sellPrice: 620,  xp: 80  },
  honey_yogurt: { building: "dairy",   inputs: [{ itemId: "honey",      quantity: 1 }, { itemId: "milk",   quantity: 1 }], outputId: "honey_yogurt", outputQty: 1, craftSec: 400,  sellPrice: 360,  xp: 55  },
  // ── Кухня ─────────────────────────────────────────────────────────────────
  bacon:        { building: "kitchen", inputs: [{ itemId: "meat",       quantity: 1 }],  outputId: "bacon",        outputQty: 1, craftSec: 180,  sellPrice: 220,  xp: 35  },
  honey_bread:  { building: "kitchen", inputs: [{ itemId: "honey",      quantity: 1 }, { itemId: "flour",  quantity: 1 }], outputId: "honey_bread",  outputQty: 1, craftSec: 300,  sellPrice: 400,  xp: 55  },
  roast:        { building: "kitchen", inputs: [{ itemId: "meat",       quantity: 1 }, { itemId: "mushroom", quantity: 1 }], outputId: "roast",        outputQty: 1, craftSec: 480,  sellPrice: 600,  xp: 75  },
  // ── Рыбные рецепты (кухня) ────────────────────────────────────────────────
  fish_soup:    { building: "kitchen", inputs: [{ itemId: "carp",       quantity: 1 }, { itemId: "milk",   quantity: 1 }], outputId: "fish_soup",    outputQty: 1, craftSec: 360,  sellPrice: 280,  xp: 45  },
  grilled_fish: { building: "kitchen", inputs: [{ itemId: "salmon",     quantity: 1 }], outputId: "grilled_fish", outputQty: 1, craftSec: 300,  sellPrice: 420,  xp: 60  },
};

const PRODUCT_SELL_PRICE: Record<string, number> = {
  egg: 15, milk: 25, wool: 22, meat: 35, honey: 50,
  flour: 20, bread: 70, cheese: 90,
  corn_starch: 180, berry_juice: 160, corn_bread: 380,
  pumpkin_pie: 1100, berry_jam: 200, mushroom_soup: 420, ice_cream: 620,
  honey_yogurt: 360, bacon: 220, honey_bread: 400, roast: 600,
  // Fish recipes
  fish_soup: 280, grilled_fish: 420,
};

const SEASON_GROWTH_MULTIPLIER: Record<Season, number> = {
  spring: 0.8, summer: 1.0, autumn: 1.0, winter: 1.5,
};

const SEASON_SELL_MULTIPLIER: Record<Season, number> = {
  spring: 1.0, summer: 1.0, autumn: 1.2, winter: 1.0,
};

const SEASON_NAMES: Record<Season, string> = {
  spring: "🌸 Весна", summer: "☀️ Лето", autumn: "🍂 Осень", winter: "❄️ Зима",
};

const SEASONS_ORDER: Season[] = ["spring", "summer", "autumn", "winter"];
const SEASON_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours per season

const ENERGY_REGEN_INTERVAL_MS = 5 * 60 * 1000; // 1 energy per 5 min

// ─────────────────────────────── Weather System ───────────────────────────────
type WeatherType = "sunny" | "rainy" | "storm";

const WEATHER_EPOCH_MS = 30 * 60 * 1000; // 30-minute weather cycles

const WEATHER_GROW_MULT: Record<WeatherType, number> = {
  sunny: 1.0,
  rainy: 0.8,  // 20% faster growth
  storm: 0.6,  // 40% faster growth
};

const WEATHER_CONFIG: Record<WeatherType, { label: string; emoji: string; tip: string }> = {
  sunny: { label: "Солнечно",  emoji: "☀️",  tip: "Стандартные условия" },
  rainy: { label: "Дождь",     emoji: "🌧️",  tip: "+20% скорость роста" },
  storm: { label: "Гроза",     emoji: "⛈️",  tip: "+40% скорость роста, 10% шанс потери урожая" },
};

const STORM_SPOIL_CHANCE = 0.10;

function getCurrentWeather(): WeatherType {
  const epoch = Math.floor(Date.now() / WEATHER_EPOCH_MS);
  const rng = seededRand(epoch * 31337 + 99991);
  const roll = rng();
  if (roll < 0.50) return "sunny";
  if (roll < 0.80) return "rainy";
  return "storm";
}

function getActiveEvent(): (SeasonalEventDef & { isActive: boolean; msLeft: number }) | null {
  const ev = getAdminConfig().activeEvent;
  if (!ev) return null;
  const now = Date.now();
  const start = new Date(ev.startAt).getTime();
  const end = new Date(ev.endAt).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const isActive = now >= start && now <= end;
  return { ...ev, isActive, msLeft: Math.max(0, end - now) };
}

// ─────────────────────────────── Premium Item Config ──────────────────────────
const ITEM_CONFIG = {
  watering_can: {
    name: "Лейка",
    gemCostSingle: 3,
    gemCostPack: 7,   // pack of 3
    packQty: 3,
    growthReduction: 0.50,  // reduces remaining grow time by 50%
    doubleHarvestChance: 0.20,
  },
  sprinkler: {
    name: "Спринклер",
    gemCostSingle: 6,
    gemCostPack: 10,  // pack of 2
    packQty: 2,
    growthReduction: 0.40,  // reduces remaining grow time by 40% per plot
    doubleHarvestChance: 0.15,
    durationMs: 5 * 60 * 1000, // 5 minutes active
  },
};

function emptyItems(): ItemInventory {
  return { wateringCans: 0, sprinklers: 0 };
}

function emptyToolTiers(): ToolTiers {
  return { watering_can: 0, sprinkler: 0 };
}

// ─────────────────────────────── Tool Tier Config ─────────────────────────────

type ToolTierDef = {
  name: string;
  emoji: string;
  coinCost: number;
  gemCost: number;
  growthReduction: number;
  doubleChance: number;
  plotsAffected?: number;
  durationMs?: number;
  bonusDesc: string;
};

const TOOL_TIER_CONFIG: Record<"watering_can" | "sprinkler", ToolTierDef[]> = {
  watering_can: [
    { name: "Обычная лейка",    emoji: "🪣", coinCost: 0,   gemCost: 0, growthReduction: 0.50, doubleChance: 0.20, bonusDesc: "−50% время роста, 20% двойной урожай" },
    { name: "Серебряная лейка", emoji: "🪣", coinCost: 300, gemCost: 0, growthReduction: 0.65, doubleChance: 0.25, bonusDesc: "−65% время роста, 25% двойной урожай" },
    { name: "Золотая лейка",    emoji: "✨", coinCost: 0,   gemCost: 5, growthReduction: 0.80, doubleChance: 0.30, plotsAffected: 3, bonusDesc: "−80% время роста, 30% двойной урожай, поливает 3 грядки" },
  ],
  sprinkler: [
    { name: "Обычный спринклер",    emoji: "💦", coinCost: 0,   gemCost: 0, growthReduction: 0.40, doubleChance: 0.15, durationMs: 5 * 60 * 1000,  bonusDesc: "−40% время роста, 15% двойной урожай, 5 мин" },
    { name: "Серебряный спринклер", emoji: "💦", coinCost: 400, gemCost: 0, growthReduction: 0.55, doubleChance: 0.20, durationMs: 7 * 60 * 1000,  bonusDesc: "−55% время роста, 20% двойной урожай, 7 мин" },
    { name: "Золотой спринклер",    emoji: "⚡", coinCost: 0,   gemCost: 8, growthReduction: 0.70, doubleChance: 0.25, durationMs: 10 * 60 * 1000, bonusDesc: "−70% время роста, 25% двойной урожай, 10 мин" },
  ],
};

// ─────────────────────────────── Farm Pass Config ─────────────────────────────

const PASS_SEASON_DURATION_DAYS = 30;
const PASS_EPOCH = new Date("2026-03-01T00:00:00Z"); // First season start

function getCurrentPassSeason(): { seasonId: string; seasonStart: Date; seasonEnd: Date } {
  const now = Date.now();
  const epochMs = PASS_EPOCH.getTime();
  const durationMs = PASS_SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const seasonIndex = Math.max(0, Math.floor((now - epochMs) / durationMs));
  const seasonId = `season_${seasonIndex + 1}`;
  const seasonStart = new Date(epochMs + seasonIndex * durationMs);
  const seasonEnd = new Date(epochMs + (seasonIndex + 1) * durationMs - 1);
  return { seasonId, seasonStart, seasonEnd };
}

const PASS_XP_PER_LEVEL = 50;
const PASS_MAX_LEVEL = 20;

type PassReward = {
  type: "coins" | "gems" | "seeds" | "pet";
  amount?: number;
  seedType?: string;
  seedQty?: number;
  petType?: string;
};

type PassLevelReward = {
  level: number;
  free: PassReward;
  premium: PassReward;
};

// Free track: coins only. Premium track: gems + rare seeds + pet at level 20.
const PASS_REWARDS: PassLevelReward[] = [
  { level: 1,  free: { type: "coins", amount: 50   }, premium: { type: "gems",  amount: 2  } },
  { level: 2,  free: { type: "coins", amount: 75   }, premium: { type: "seeds", seedType: "rainbow_corn",  seedQty: 2 } },
  { level: 3,  free: { type: "coins", amount: 100  }, premium: { type: "gems",  amount: 3  } },
  { level: 4,  free: { type: "coins", amount: 125  }, premium: { type: "seeds", seedType: "lucky_clover",  seedQty: 2 } },
  { level: 5,  free: { type: "coins", amount: 150  }, premium: { type: "gems",  amount: 5  } },
  { level: 6,  free: { type: "coins", amount: 175  }, premium: { type: "seeds", seedType: "rainbow_corn",  seedQty: 3 } },
  { level: 7,  free: { type: "coins", amount: 200  }, premium: { type: "gems",  amount: 5  } },
  { level: 8,  free: { type: "coins", amount: 225  }, premium: { type: "seeds", seedType: "moonberry",     seedQty: 1 } },
  { level: 9,  free: { type: "coins", amount: 250  }, premium: { type: "gems",  amount: 7  } },
  { level: 10, free: { type: "coins", amount: 300  }, premium: { type: "seeds", seedType: "lucky_clover",  seedQty: 3 } },
  { level: 11, free: { type: "coins", amount: 325  }, premium: { type: "gems",  amount: 7  } },
  { level: 12, free: { type: "coins", amount: 350  }, premium: { type: "seeds", seedType: "moonberry",     seedQty: 2 } },
  { level: 13, free: { type: "coins", amount: 400  }, premium: { type: "gems",  amount: 10 } },
  { level: 14, free: { type: "coins", amount: 450  }, premium: { type: "seeds", seedType: "starfruit",     seedQty: 1 } },
  { level: 15, free: { type: "coins", amount: 500  }, premium: { type: "gems",  amount: 10 } },
  { level: 16, free: { type: "coins", amount: 550  }, premium: { type: "seeds", seedType: "starfruit",     seedQty: 2 } },
  { level: 17, free: { type: "coins", amount: 600  }, premium: { type: "gems",  amount: 15 } },
  { level: 18, free: { type: "coins", amount: 700  }, premium: { type: "seeds", seedType: "dragon_fruit",  seedQty: 1 } },
  { level: 19, free: { type: "coins", amount: 850  }, premium: { type: "gems",  amount: 20 } },
  { level: 20, free: { type: "coins", amount: 1000 }, premium: { type: "pet",   petType: "unicorn" } },
];

function getPassLevelFromXp(xp: number): number {
  return Math.min(PASS_MAX_LEVEL, Math.floor(xp / PASS_XP_PER_LEVEL) + 1);
}

async function getOrCreateFarmPass(telegramId: string): Promise<FarmPass> {
  const { seasonId } = getCurrentPassSeason();
  const existing = await db
    .select()
    .from(farmPassTable)
    .where(and(eq(farmPassTable.telegramId, telegramId), eq(farmPassTable.passSeasonId, seasonId)))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const inserted = await db.insert(farmPassTable).values({
    telegramId,
    passSeasonId: seasonId,
    xp: 0,
    level: 1,
    freeTrackClaimed: [],
    premiumTrackClaimed: [],
    isPremium: false,
  }).returning();
  return inserted[0];
}

function serializeFarmPass(pass: FarmPass) {
  const { seasonStart, seasonEnd } = getCurrentPassSeason();
  return {
    seasonId: pass.passSeasonId,
    xp: pass.xp,
    level: pass.level,
    isPremium: pass.isPremium,
    freeTrackClaimed: (pass.freeTrackClaimed as number[]) || [],
    premiumTrackClaimed: (pass.premiumTrackClaimed as number[]) || [],
    rewards: PASS_REWARDS,
    xpPerLevel: PASS_XP_PER_LEVEL,
    maxLevel: PASS_MAX_LEVEL,
    seasonStartAt: seasonStart.toISOString(),
    seasonEndAt: seasonEnd.toISOString(),
  };
}

const PASS_XP_ACTIONS: Record<string, number> = {
  plant: 1,
  harvest: 3,
  feed_animal: 2,
  collect_craft: 5,
};

async function addPassXp(telegramId: string, actionType: string): Promise<void> {
  const xpGain = PASS_XP_ACTIONS[actionType];
  if (!xpGain) return;
  const { seasonId, seasonEnd } = getCurrentPassSeason();
  // No XP after season ends
  if (Date.now() > seasonEnd.getTime()) return;
  const pass = await getOrCreateFarmPass(telegramId);
  const newXp = pass.xp + xpGain;
  const newLevel = getPassLevelFromXp(newXp);
  await db.update(farmPassTable)
    .set({ xp: newXp, level: newLevel, updatedAt: new Date() })
    .where(and(eq(farmPassTable.telegramId, telegramId), eq(farmPassTable.passSeasonId, seasonId)));
}

// ─────────────────────────────── Rotating Seed Shop ───────────────────────────

export type ShopRarity = "common" | "rare" | "epic" | "legendary";

export interface ShopSlot {
  slotIndex: number;
  cropId: string;
  rarity: ShopRarity;
  price: number;
  stock: number;          // max per player per rotation
  isSeedOfDay?: boolean;
  discountPct?: number;
  outOfStock?: boolean;   // slot exists but not available this rotation
}

export const SHOP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function currentEpoch(): number {
  const offset = getAdminConfig().shopEpochOffset ?? 0;
  return Math.floor(Date.now() / SHOP_INTERVAL_MS) + offset;
}

export function nextRefreshMs(): number {
  const offset = getAdminConfig().shopEpochOffset ?? 0;
  const naturalEpoch = Math.floor(Date.now() / SHOP_INTERVAL_MS);
  return (naturalEpoch + 1) * SHOP_INTERVAL_MS - Date.now();
}

// Lightweight seeded PRNG (Mulberry32)
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const BASE_SHOP_POOLS: Record<ShopRarity, string[]> = {
  common:    ["wheat", "carrot", "tomato"],
  rare:      ["corn", "blueberry", "cranberry", "mushroom"],
  epic:      ["sunflower", "strawberry", "cactus_fruit", "ice_root"],
  legendary: ["pumpkin", "dates"],
};

const RARITY_PRICE_MULT: Record<ShopRarity, number> = {
  common:    1.0,
  rare:      1.2,
  epic:      1.6,
  legendary: 2.2,
};

const RARITY_STOCK: Record<ShopRarity, number> = {
  common:    10,
  rare:      5,
  epic:      2,
  legendary: 1,
};

// Default probability that a non-common slot is active (has stock) per rotation
const DEFAULT_APPEAR_CHANCE: Record<ShopRarity, number> = {
  common:    1.00,
  rare:      0.85,
  epic:      0.70,
  legendary: 0.55,
};

function getEffectiveShopPools(): Record<ShopRarity, string[]> {
  const overrides = getAdminConfig().shopCropOverrides ?? {};
  const pools: Record<ShopRarity, string[]> = { common: [], rare: [], epic: [], legendary: [] };

  // Start from all known crops (base + custom)
  const allCrops = Object.keys(getActiveCropConfig());

  for (const cropId of allCrops) {
    const ov = overrides[cropId];
    if (ov?.enabled === false) continue; // excluded

    // Determine which pool this crop belongs to
    let rarity: ShopRarity | null = null;
    if (ov?.rarity) {
      rarity = ov.rarity;
    } else {
      // Find base pool
      for (const [r, ids] of Object.entries(BASE_SHOP_POOLS)) {
        if (ids.includes(cropId)) { rarity = r as ShopRarity; break; }
      }
    }
    if (rarity) pools[rarity].push(cropId);
  }

  // Fallback: ensure common pool is never empty
  if (pools.common.length === 0) pools.common = ["wheat", "carrot", "tomato"];

  return pools;
}

export function generateShopSlots(epoch: number): ShopSlot[] {
  const cfg = getAdminConfig();
  const shopOv = cfg.shopCropOverrides ?? {};
  const gs = { ...DEFAULT_SHOP_GLOBAL, ...(cfg.shopGlobalSettings ?? {}) };
  const pools = getEffectiveShopPools();
  const cropCfgs = getActiveCropConfig();

  const rng      = seededRand(epoch * 2654435761);
  const stockRng = seededRand(epoch * 3141592653);
  const dayRng   = seededRand(Math.floor(epoch / 12) * 1234567891);

  // Per-rarity price multipliers from global settings
  const globalPriceMult: Record<ShopRarity, number> = {
    common:    gs.commonPriceMult,
    rare:      gs.rarePriceMult,
    epic:      gs.epicPriceMult,
    legendary: gs.legPriceMult,
  };

  // Per-rarity stock from global settings
  const rarityStock: Record<ShopRarity, number> = {
    common:    gs.commonStock,
    rare:      gs.rareStock,
    epic:      gs.epicStock,
    legendary: gs.legStock,
  };

  // Per-rarity default appear chance from global settings
  const defaultAppearChance: Record<ShopRarity, number> = {
    common:    1.00,
    rare:      gs.rareAppearChance,
    epic:      gs.epicAppearChance,
    legendary: gs.legAppearChance,
  };

  const computePrice = (cropId: string, rarity: ShopRarity, discountPct = 0): number => {
    const ov = shopOv[cropId];
    if (ov?.shopPrice != null) return Math.max(1, ov.shopPrice);
    const basePrice = cropCfgs[cropId]?.seedCost ?? 10;
    const cropMult = ov?.shopPriceMult ?? 1.0;
    return Math.max(1, Math.round(basePrice * globalPriceMult[rarity] * cropMult * (1 - discountPct / 100)));
  };

  const isSlotActive = (cropId: string, rarity: ShopRarity): boolean => {
    if (rarity === "common") return true;
    const chance = shopOv[cropId]?.appearChance ?? defaultAppearChance[rarity];
    return stockRng() < chance;
  };

  // Seed of the Day
  const sodPool = [...(pools.rare.length ? pools.rare : BASE_SHOP_POOLS.rare),
                   ...(pools.epic.length ? pools.epic : BASE_SHOP_POOLS.epic)];
  const sodCrop = pick(sodPool, dayRng);
  const sodRarity: ShopRarity = (pools.epic.includes(sodCrop) || BASE_SHOP_POOLS.epic.includes(sodCrop)) ? "epic" : "rare";
  const sodPrice = computePrice(sodCrop, sodRarity, gs.sodDiscount);

  const usedCrops = new Set<string>([sodCrop]);

  function pickUnique(pool: string[], rngFn: () => number): string {
    const available = pool.filter((c) => !usedCrops.has(c));
    const src = available.length > 0 ? available : (pool.length > 0 ? pool : BASE_SHOP_POOLS.common);
    const chosen = pick(src, rngFn);
    usedCrops.add(chosen);
    return chosen;
  }

  const makeSlot = (slotIndex: number, rarity: ShopRarity): ShopSlot => {
    const pool = pools[rarity].length > 0 ? pools[rarity] : BASE_SHOP_POOLS[rarity];
    const cropId = pickUnique(pool, rng);
    const active = isSlotActive(cropId, rarity);
    return {
      slotIndex,
      cropId,
      rarity,
      price: computePrice(cropId, rarity),
      stock: rarityStock[rarity],
      ...(active ? {} : { outOfStock: true }),
    };
  };

  const r3 = rng();
  const slot3Rarity: ShopRarity = r3 < 0.55 ? "rare" : r3 < 0.85 ? "epic" : "legendary";
  const r4 = rng();
  const slot4Rarity: ShopRarity = r4 < 0.45 ? "epic" : r4 < 0.80 ? "legendary" : "rare";
  const r5 = rng();
  const slot5Rarity: ShopRarity = r5 < 0.60 ? "epic" : "legendary";

  return [
    makeSlot(0, "common"),
    makeSlot(1, "common"),
    makeSlot(2, "rare"),
    makeSlot(3, slot3Rarity),
    makeSlot(4, slot4Rarity),
    makeSlot(5, slot5Rarity),
    { slotIndex: 6, cropId: sodCrop, rarity: sodRarity, price: sodPrice, stock: gs.sodStock, isSeedOfDay: true, discountPct: gs.sodDiscount },
  ];
}

// GET /seed-shop (query param telegramId passed via header x-telegram-id)
router.get("/seed-shop", async (req, res) => {
  try {
    const telegramId = req.headers["x-telegram-id"] as string;
    if (!telegramId) return res.status(401).json({ error: "No telegram id" });

    const epoch = currentEpoch();
    const slots = generateShopSlots(epoch);

    // Fetch how many the player has already bought in this rotation
    const slotKeys = slots.map((s) => `${epoch}_${s.slotIndex}`);
    const purchases = await db
      .select()
      .from(shopPurchasesTable)
      .where(
        and(
          eq(shopPurchasesTable.telegramId, telegramId),
          inArray(shopPurchasesTable.slotKey, slotKeys)
        )
      );

    const boughtMap: Record<string, number> = {};
    for (const p of purchases) {
      boughtMap[p.slotKey] = p.quantity;
    }

    const slotsWithBought = slots.map((s) => ({
      ...s,
      bought: boughtMap[`${epoch}_${s.slotIndex}`] ?? 0,
    }));

    // Include active event crops in seed shop response
    const activeEvent = getActiveEvent();
    res.json({
      epoch,
      nextRefreshMs: nextRefreshMs(),
      slots: slotsWithBought,
      eventCrops: (activeEvent?.isActive && activeEvent.eventCrops.length > 0) ? activeEvent.eventCrops : [],
      activeEvent: activeEvent?.isActive ? { id: activeEvent.id, name: activeEvent.name, emoji: activeEvent.emoji, eventCoinEmoji: activeEvent.eventCoinEmoji } : null,
    });
  } catch (err) {
    console.error("seed-shop error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Gets plus-shape plot IDs centered on centerPlotId
function getSprinklerAffected(centerPlotId: number, plots: PlotState[]): number[] {
  const cols = plots.length <= 9 ? 3 : plots.length <= 16 ? 4 : 5;
  const plotIds = new Set(plots.map((p) => p.id));
  const row = Math.floor(centerPlotId / cols);
  const col = centerPlotId % cols;
  const affected = [centerPlotId];
  if (col > 0           && plotIds.has(centerPlotId - 1))    affected.push(centerPlotId - 1);
  if (col < cols - 1    && plotIds.has(centerPlotId + 1))    affected.push(centerPlotId + 1);
  if (row > 0           && plotIds.has(centerPlotId - cols)) affected.push(centerPlotId - cols);
  if (plotIds.has(centerPlotId + cols))                      affected.push(centerPlotId + cols);
  return affected;
}

function applyWateringEffect(plot: PlotState, reductionFactor: number, doubleChance: number): PlotState {
  if (plot.status !== "growing" || !plot.readyAt) return plot;
  const now = Date.now();
  const readyAt = new Date(plot.readyAt).getTime();
  const remaining = Math.max(0, readyAt - now);
  if (remaining <= 0) return plot;
  const reduction = remaining * reductionFactor;
  const newReadyAt = new Date(readyAt - reduction).toISOString();
  const doubleHarvest = Math.random() < doubleChance;
  return { ...plot, readyAt: newReadyAt, doubleHarvest: doubleHarvest || plot.doubleHarvest };
}
const HARVEST_ENERGY = 1;
const PLANT_ENERGY = 2;
const FEED_ENERGY = 1;

// ─────────────────────────────── NPC Order Templates ──────────────────────────

const ORDER_ITEMS = ["wheat", "carrot", "tomato", "corn", "egg", "milk", "flour", "bread"];

function generateNpcOrders(level: number): NpcOrder[] {
  const count = 3;
  const orders: NpcOrder[] = [];
  const now = new Date();
  const npcTemplates = getAdminConfig().npcTemplates;
  const templates = npcTemplates.length > 0 ? npcTemplates : [{ npcName: "Торговец", npcEmoji: "🧑‍💼" }];

  for (let i = 0; i < count; i++) {
    const npc = templates[i % templates.length];
    const itemPool = ORDER_ITEMS.slice(0, Math.min(ORDER_ITEMS.length, 2 + Math.floor(level / 2)));
    const itemId = itemPool[Math.floor(Math.random() * itemPool.length)];
    const quantity = 1 + Math.floor(Math.random() * 3);
    const basePrice = (getActiveCropConfig()[itemId]?.sellPrice || PRODUCT_SELL_PRICE[itemId] || 10);
    const rewardCoins = Math.floor(basePrice * quantity * 1.5);
    const rewardXp = Math.floor(rewardCoins / 3);

    orders.push({
      id: `order_${now.getTime()}_${i}`,
      npcName: npc.npcName,
      npcEmoji: npc.npcEmoji,
      items: [{ itemId, quantity }],
      reward: { coins: rewardCoins, xp: rewardXp },
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      completed: false,
    });
  }

  return orders;
}

// ─────────────────────────────── Quest Templates ──────────────────────────────

const STORY_QUESTS: QuestState[] = [
  {
    id: "story_first_harvest",
    type: "story",
    title: "Первый урожай",
    description: "Собери свой первый урожай",
    goal: { action: "harvest", target: "any", amount: 1 },
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: 50,
    rewardXp: 30,
  },
  {
    id: "story_first_animal",
    type: "story",
    title: "Животновод",
    description: "Купи своё первое животное",
    goal: { action: "buy_animal", target: "any", amount: 1 },
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: 100,
    rewardXp: 50,
  },
  {
    id: "story_first_building",
    type: "story",
    title: "Строитель",
    description: "Построй своё первое здание",
    goal: { action: "build_building", target: "any", amount: 1 },
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: 150,
    rewardXp: 80,
  },
  {
    id: "story_first_craft",
    type: "story",
    title: "Мастер-крафтер",
    description: "Скрафти свой первый продукт",
    goal: { action: "collect_craft", target: "any", amount: 1 },
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: 200,
    rewardXp: 100,
    rewardGems: 2,
  },
  {
    id: "story_sell_100",
    type: "story",
    title: "Торгаш",
    description: "Заработай 100 монет от продаж",
    goal: { action: "sell_any", target: "coins", amount: 100 },
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: 200,
    rewardXp: 50,
    rewardGems: 1,
  },
];

function generateDailyQuests(): QuestState[] {
  const today = getTodayDate();
  const templates = getAdminConfig().dailyQuestTemplates;
  return templates.map((tpl) => ({
    id: `${tpl.id}_${today}`,
    type: "daily" as const,
    title: tpl.title,
    description: tpl.description,
    goal: tpl.goal,
    progress: 0,
    completed: false,
    claimed: false,
    rewardCoins: tpl.rewardCoins,
    rewardXp: tpl.rewardXp,
  }));
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────── Login Streak ─────────────────────────────────

export type StreakReward = {
  day: number;
  label: string;
  type: "coins" | "gems" | "seed" | "animal";
  coins?: number;
  gems?: number;
  seedType?: string;
  seedQty?: number;
  animalType?: string;
};

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, label: "50 монет",         type: "coins", coins: 50 },
  { day: 2, label: "100 монет",        type: "coins", coins: 100 },
  { day: 3, label: "2 семени кукурузы",type: "seed",  seedType: "corn",       seedQty: 2 },
  { day: 4, label: "200 монет + 1 💎",  type: "coins", coins: 200, gems: 1 },
  { day: 5, label: "2 семени клубники",type: "seed",  seedType: "strawberry", seedQty: 2 },
  { day: 6, label: "2 кристалла",      type: "gems",  gems: 2 },
  { day: 7, label: "Курица + 300 монет",type: "animal",animalType: "chicken", coins: 300 },
];

function applyStreakReward(farm: any, reward: StreakReward) {
  const seeds = { ...(farm.seeds as CropInventory) };
  let coins = farm.coins;
  let gems = farm.gems;
  let animals: AnimalState[] = [...(farm.animals as AnimalState[])];

  if (reward.coins) coins += reward.coins;
  if (reward.gems) gems += reward.gems;
  if (reward.seedType && reward.seedQty) {
    seeds[reward.seedType as keyof CropInventory] = ((seeds[reward.seedType as keyof CropInventory] as number) ?? 0) + reward.seedQty;
  }
  if (reward.animalType) {
    const animalCfg = ANIMAL_CONFIG[reward.animalType];
    if (animalCfg) {
      const newAnimal: AnimalState = {
        id: Date.now(),
        type: reward.animalType as AnimalState["type"],
        name: reward.animalType === "chicken" ? "Пеструшка" : reward.animalType,
        fed: false,
        lastFedAt: null,
        productReadyAt: null,
        status: "hungry",
        level: 1,
      };
      animals = [...animals, newAnimal];
    }
  }

  return { coins, gems, seeds, animals };
}

// ─────────────────────────────── Achievements ─────────────────────────────────

export type AchievementDef = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  goal: number;
  category: "harvest" | "coins" | "animals" | "buildings" | "level" | "quests" | "trading" | "worlds" | "streak" | "crafting";
  trackAction: string;
  rewardCoins: number;
  rewardGems: number;
  rewardSeedType?: string;
  rewardSeedQty?: number;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Урожай ──────────────────────────────────────────────────────────────────
  { id: "harvest_10",    emoji: "🌾", title: "Первый урожай",     description: "Собери 10 раз урожай",      goal: 10,   category: "harvest",   trackAction: "harvest", rewardCoins: 50,   rewardGems: 0 },
  { id: "harvest_50",    emoji: "🌾", title: "Заядлый фермер",    description: "Собери 50 раз урожай",      goal: 50,   category: "harvest",   trackAction: "harvest", rewardCoins: 150,  rewardGems: 1 },
  { id: "harvest_200",   emoji: "🌾", title: "Мастер жатвы",      description: "Собери 200 раз урожай",     goal: 200,  category: "harvest",   trackAction: "harvest", rewardCoins: 400,  rewardGems: 2 },
  { id: "harvest_1000",  emoji: "🏆", title: "Легенда жатвы",     description: "Собери 1000 раз урожай",    goal: 1000, category: "harvest",   trackAction: "harvest", rewardCoins: 1000, rewardGems: 5 },
  // ── Монеты ──────────────────────────────────────────────────────────────────
  { id: "coins_500",     emoji: "🪙", title: "Первые сбережения", description: "Заработай 500 монет",       goal: 500,  category: "coins",     trackAction: "earn_coins", rewardCoins: 50,  rewardGems: 0 },
  { id: "coins_2000",    emoji: "💰", title: "Богатый фермер",    description: "Заработай 2000 монет",      goal: 2000, category: "coins",     trackAction: "earn_coins", rewardCoins: 200, rewardGems: 1 },
  { id: "coins_10000",   emoji: "💰", title: "Фермер-миллионер", description: "Заработай 10000 монет",     goal: 10000,category: "coins",     trackAction: "earn_coins", rewardCoins: 500, rewardGems: 3 },
  // ── Животные ────────────────────────────────────────────────────────────────
  { id: "first_animal",  emoji: "🐾", title: "Зоофермер",         description: "Купи первое животное",      goal: 1,    category: "animals",   trackAction: "buy_animal", rewardCoins: 100, rewardGems: 0 },
  { id: "animals_3",     emoji: "🐄", title: "Мини-зоопарк",      description: "Вырасти 3 животных",        goal: 3,    category: "animals",   trackAction: "buy_animal", rewardCoins: 200, rewardGems: 1 },
  { id: "animals_5",     emoji: "🐑", title: "Большой зоопарк",   description: "Вырасти 5 животных",        goal: 5,    category: "animals",   trackAction: "buy_animal", rewardCoins: 400, rewardGems: 2 },
  // ── Здания ──────────────────────────────────────────────────────────────────
  { id: "first_building",emoji: "🏭", title: "Строитель",         description: "Построй первое здание",     goal: 1,    category: "buildings", trackAction: "build_building", rewardCoins: 150, rewardGems: 0 },
  { id: "buildings_3",   emoji: "🏗️", title: "Промышленник",      description: "Построй 3 здания",          goal: 3,    category: "buildings", trackAction: "build_building", rewardCoins: 300, rewardGems: 2 },
  // ── Уровень ─────────────────────────────────────────────────────────────────
  { id: "level_3",       emoji: "⭐", title: "Начинающий",         description: "Достигни 3 уровня",         goal: 3,    category: "level",     trackAction: "level_up", rewardCoins: 100, rewardGems: 0 },
  { id: "level_5",       emoji: "🌟", title: "Опытный",            description: "Достигни 5 уровня",         goal: 5,    category: "level",     trackAction: "level_up", rewardCoins: 200, rewardGems: 1 },
  { id: "level_7",       emoji: "✨", title: "Ветеран",            description: "Достигни 7 уровня",         goal: 7,    category: "level",     trackAction: "level_up", rewardCoins: 300, rewardGems: 2 },
  { id: "level_10",      emoji: "👑", title: "Великий фермер",    description: "Достигни 10 уровня",        goal: 10,   category: "level",     trackAction: "level_up", rewardCoins: 500, rewardGems: 5 },
  // ── Торговля ────────────────────────────────────────────────────────────────
  { id: "sell_10",       emoji: "🛒", title: "Продавец",           description: "Продай 10 товаров",          goal: 10,   category: "trading",   trackAction: "sell_item", rewardCoins: 80,   rewardGems: 0 },
  { id: "sell_50",       emoji: "🏪", title: "Торговец",           description: "Продай 50 товаров",          goal: 50,   category: "trading",   trackAction: "sell_item", rewardCoins: 200,  rewardGems: 1, rewardSeedType: "corn",       rewardSeedQty: 3 },
  { id: "sell_200",      emoji: "💹", title: "Биржевой магнат",    description: "Продай 200 товаров",         goal: 200,  category: "trading",   trackAction: "sell_item", rewardCoins: 600,  rewardGems: 3, rewardSeedType: "strawberry", rewardSeedQty: 5 },
  { id: "npc_orders_5",  emoji: "📦", title: "Надёжный поставщик", description: "Выполни 5 заказов НПС",      goal: 5,    category: "trading",   trackAction: "npc_order", rewardCoins: 150,  rewardGems: 1 },
  { id: "npc_orders_20", emoji: "🚚", title: "Логистик",           description: "Выполни 20 заказов НПС",     goal: 20,   category: "trading",   trackAction: "npc_order", rewardCoins: 400,  rewardGems: 2, rewardSeedType: "sunflower",  rewardSeedQty: 3 },
  // ── Квесты ──────────────────────────────────────────────────────────────────
  { id: "quests_5",      emoji: "📋", title: "Добросовестный",    description: "Выполни 5 заданий",         goal: 5,    category: "quests",    trackAction: "claim_quest", rewardCoins: 100, rewardGems: 0 },
  { id: "quests_20",     emoji: "📜", title: "Исполнитель",       description: "Выполни 20 заданий",        goal: 20,   category: "quests",    trackAction: "claim_quest", rewardCoins: 250, rewardGems: 2 },
  // ── Стрик ───────────────────────────────────────────────────────────────────
  { id: "streak_3",      emoji: "🔥", title: "На волне",          description: "3 дня подряд входи в игру", goal: 3,    category: "streak",    trackAction: "login_streak", rewardCoins: 100, rewardGems: 0 },
  { id: "streak_7",      emoji: "🔥", title: "Недельный стрик",   description: "7 дней подряд входи в игру",goal: 7,    category: "streak",    trackAction: "login_streak", rewardCoins: 250, rewardGems: 2, rewardSeedType: "pumpkin", rewardSeedQty: 2 },
  // ── Миры ────────────────────────────────────────────────────────────────────
  { id: "unlock_world",  emoji: "🌍", title: "Путешественник",    description: "Разблокируй другой мир",    goal: 1,    category: "worlds",    trackAction: "unlock_world", rewardCoins: 200, rewardGems: 1 },
  // ── Крафт ───────────────────────────────────────────────────────────────────
  { id: "craft_5",       emoji: "⚙️", title: "Ремесленник",       description: "Собери 5 крафт-предметов",  goal: 5,    category: "crafting",  trackAction: "collect_craft", rewardCoins: 150, rewardGems: 1 },
  { id: "craft_20",      emoji: "🔧", title: "Мастер крафта",     description: "Собери 20 крафт-предметов", goal: 20,   category: "crafting",  trackAction: "collect_craft", rewardCoins: 350, rewardGems: 2, rewardSeedType: "sunflower", rewardSeedQty: 2 },
  // ── Урожай (расширенные) ────────────────────────────────────────────────────
  { id: "harvest_first", emoji: "🌱", title: "Первый росток",     description: "Собери 1 урожай",           goal: 1,    category: "harvest",   trackAction: "harvest", rewardCoins: 20,  rewardGems: 0, rewardSeedType: "carrot", rewardSeedQty: 3 },
];

async function getPlayerAchievements(telegramId: string): Promise<Achievement[]> {
  return db.select().from(achievementsTable).where(eq(achievementsTable.telegramId, telegramId));
}

async function updateAchievementProgress(telegramId: string, trackAction: string, amount: number): Promise<void> {
  const defs = ACHIEVEMENT_DEFS.filter((d) => d.trackAction === trackAction);
  if (defs.length === 0) return;

  // Atomic upsert — no separate read, no race condition
  // ON CONFLICT DO UPDATE advances progress (capped at goal) only when not yet claimed
  await Promise.all(defs.map((def) =>
    db.insert(achievementsTable)
      .values({ telegramId, achievementId: def.id, progress: Math.min(def.goal, amount), claimed: 0 })
      .onConflictDoUpdate({
        target: [achievementsTable.telegramId, achievementsTable.achievementId],
        set: {
          progress: sql`CASE WHEN ${achievementsTable.claimed} = 0 THEN LEAST(${def.goal}, ${achievementsTable.progress} + ${amount}) ELSE ${achievementsTable.progress} END`,
          updatedAt: sql`CASE WHEN ${achievementsTable.claimed} = 0 THEN now() ELSE ${achievementsTable.updatedAt} END`,
        },
      })
  ));
}

async function setAchievementAbsolute(telegramId: string, trackAction: string, absoluteValue: number): Promise<void> {
  const defs = ACHIEVEMENT_DEFS.filter((d) => d.trackAction === trackAction);
  if (defs.length === 0) return;

  // Atomic upsert — set progress to the higher of current or absoluteValue (only when not claimed)
  await Promise.all(defs.map((def) => {
    const capped = Math.min(def.goal, absoluteValue);
    return db.insert(achievementsTable)
      .values({ telegramId, achievementId: def.id, progress: capped, claimed: 0 })
      .onConflictDoUpdate({
        target: [achievementsTable.telegramId, achievementsTable.achievementId],
        set: {
          progress: sql`CASE WHEN ${achievementsTable.claimed} = 0 THEN GREATEST(${achievementsTable.progress}, ${capped}) ELSE ${achievementsTable.progress} END`,
          updatedAt: sql`CASE WHEN ${achievementsTable.claimed} = 0 THEN now() ELSE ${achievementsTable.updatedAt} END`,
        },
      });
  }));
}

// ─────────────────────────────── Helper Functions ─────────────────────────────

function getLevelFromXp(xp: number): number {
  const levels = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6000, 10000, 15000];
  let level = 1;
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i]) level = i + 1;
  }
  return level;
}

function getCurrentSeason(seasonUpdatedAt: Date): Season {
  const elapsed = Date.now() - seasonUpdatedAt.getTime();
  const idx = Math.floor(elapsed / SEASON_DURATION_MS) % 4;
  return SEASONS_ORDER[idx];
}

function regenEnergy(energy: number, maxEnergy: number, lastRegen: Date): { energy: number; lastRegen: Date } {
  const elapsed = Date.now() - lastRegen.getTime();
  const intervals = Math.floor(elapsed / ENERGY_REGEN_INTERVAL_MS);
  if (intervals <= 0) return { energy, lastRegen };
  const newEnergy = Math.min(maxEnergy, energy + intervals);
  const newLastRegen = new Date(lastRegen.getTime() + intervals * ENERGY_REGEN_INTERVAL_MS);
  return { energy: newEnergy, lastRegen: newLastRegen };
}

function updatePlotStatuses(plots: PlotState[], currentWeather: WeatherType = "sunny"): PlotState[] {
  const now = new Date();
  const weatherMult = WEATHER_GROW_MULT[currentWeather];
  return plots.map((plot) => {
    if (plot.status === "growing" && plot.plantedAt) {
      // Dynamic weather recalculation: if baseGrowMs is stored, recompute readyAt with current weather
      let effectiveReadyAt: Date;
      if (plot.baseGrowMs) {
        effectiveReadyAt = new Date(new Date(plot.plantedAt).getTime() + plot.baseGrowMs * weatherMult);
      } else if (plot.readyAt) {
        effectiveReadyAt = new Date(plot.readyAt);
      } else {
        return plot;
      }
      if (now >= effectiveReadyAt) {
        return { ...plot, readyAt: effectiveReadyAt.toISOString(), status: "ready" };
      }
      // Update readyAt in plot to reflect current weather
      return { ...plot, readyAt: effectiveReadyAt.toISOString() };
    }
    return plot;
  });
}

function updateAnimalStatuses(animals: AnimalState[]): AnimalState[] {
  const now = new Date();
  return animals.map((a) => {
    if (a.status === "happy" && a.productReadyAt && now >= new Date(a.productReadyAt)) {
      return { ...a, status: "ready" };
    }
    return a;
  });
}

function updateCraftStatuses(buildings: BuildingState[]): BuildingState[] {
  const now = new Date();
  return buildings.map((b) => {
    if (b.crafting && now >= new Date(b.crafting.readyAt)) {
      return b;
    }
    return b;
  });
}

function updateQuestProgress(quests: QuestState[], action: string, target: string, amount: number): QuestState[] {
  return quests.map((q) => {
    if (q.completed) return q;
    const goalAction = q.goal.action;
    const goalTarget = q.goal.target;

    let matches = false;
    if (goalAction === action && (goalTarget === "any" || goalTarget === target)) {
      matches = true;
    }
    if (goalAction === "sell_any" && (action === "sell_crops" || action === "sell_product")) {
      matches = true;
    }

    if (!matches) return q;

    const newProgress = Math.min(q.goal.amount, q.progress + amount);
    const completed = newProgress >= q.goal.amount;
    return { ...q, progress: newProgress, completed };
  });
}

function emptyInventory(): CropInventory {
  return { wheat: 0, carrot: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0, sunflower: 0, blueberry: 0, mushroom: 0, cactus_fruit: 0, dates: 0, cranberry: 0, ice_root: 0 };
}

function defaultWorlds(): WorldsData {
  return {
    main:   { plots: [], unlocked: true },
    forest: { plots: Array.from({ length: 9 }, (_, i) => ({ id: i, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null })), unlocked: false },
    desert: { plots: Array.from({ length: 9 }, (_, i) => ({ id: i, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null })), unlocked: false },
    snow:   { plots: Array.from({ length: 9 }, (_, i) => ({ id: i, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null })), unlocked: false },
  };
}

function emptyProducts(): ProductInventory {
  return { egg: 0, milk: 0, wool: 0, flour: 0, bread: 0, cheese: 0 };
}

async function getOrCreateFarm(telegramId: string) {
  const existing = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, telegramId)).limit(1);

  if (existing.length > 0) {
    const farm = existing[0];
    const currentWeatherForNorm = getCurrentWeather();
    const plots = updatePlotStatuses(farm.plots as PlotState[], currentWeatherForNorm);
    const animals = updateAnimalStatuses((farm.animals as AnimalState[]) || []);
    const buildings = updateCraftStatuses((farm.buildings as BuildingState[]) || []);
    const season = getCurrentSeason(farm.seasonUpdatedAt instanceof Date ? farm.seasonUpdatedAt : new Date(farm.seasonUpdatedAt));
    const { energy, lastRegen } = regenEnergy(
      farm.energy,
      farm.maxEnergy,
      farm.lastEnergyRegen instanceof Date ? farm.lastEnergyRegen : new Date(farm.lastEnergyRegen),
    );

    let quests = (farm.quests as QuestState[]) || [];
    const today = getTodayDate();
    if (farm.dailyQuestsDate !== today) {
      const existingStory = quests.filter((q) => q.type === "story");
      quests = [...existingStory, ...generateDailyQuests()];
    }

    let npcOrders = (farm.npcOrders as NpcOrder[]) || [];
    if (npcOrders.length === 0 || npcOrders.every((o) => o.completed || new Date(o.expiresAt) < new Date())) {
      npcOrders = generateNpcOrders(farm.level);
    }

    // ── Login Streak logic ───────────────────────────────────────────────────
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const lastLogin = farm.lastLoginDate || "";
    let loginStreak = farm.loginStreak || 0;
    let streakRewardDay = farm.streakRewardDay || 0;

    if (lastLogin !== today) {
      if (lastLogin === yesterdayStr) {
        loginStreak = loginStreak + 1;
      } else if (lastLogin !== "") {
        loginStreak = 1;
      } else {
        loginStreak = 1;
      }
      // Cap at 7 for reward cycle
      const cycleDay = ((loginStreak - 1) % 7) + 1;
      streakRewardDay = cycleDay;
      // Update streak in DB immediately
      await db.update(farmStateTable).set({
        loginStreak,
        lastLoginDate: today,
        streakRewardDay,
        updatedAt: new Date(),
      }).where(eq(farmStateTable.telegramId, telegramId));
      // Update streak achievement
      await setAchievementAbsolute(telegramId, "login_streak", loginStreak);
    }

    const rawWorlds = (farm.worlds as WorldsData) || defaultWorlds();
    const activeWorldId = (farm.activeWorldId as WorldId) || "main";
    return {
      ...farm,
      plots,
      animals,
      buildings,
      season,
      energy,
      lastEnergyRegen: lastRegen,
      quests,
      npcOrders,
      products: (farm.products as ProductInventory) || emptyProducts(),
      inventory: (farm.inventory as CropInventory) || emptyInventory(),
      seeds: (farm.seeds as CropInventory) || emptyInventory(),
      worlds: rawWorlds,
      activeWorldId,
      loginStreak,
      lastLoginDate: lastLogin !== today ? today : lastLogin,
      streakRewardDay,
    };
  }

  const now = new Date();
  const initPlots = Array.from({ length: 9 }, (_, i) => ({ id: i, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null }));
  const initWorlds = defaultWorlds();
  initWorlds.main = { plots: initPlots, unlocked: true };
  const today = getTodayDate();
  const newFarm = {
    telegramId,
    coins: 150,
    gems: 5,
    level: 1,
    xp: 0,
    energy: 30,
    maxEnergy: 30,
    lastEnergyRegen: now,
    season: "spring" as Season,
    seasonUpdatedAt: now,
    plots: initPlots,
    inventory: emptyInventory(),
    seeds: { wheat: 5, carrot: 2, tomato: 1, corn: 0, strawberry: 0, pumpkin: 0, sunflower: 0 } as CropInventory,
    animals: [] as AnimalState[],
    buildings: [] as BuildingState[],
    products: emptyProducts(),
    quests: [...STORY_QUESTS, ...generateDailyQuests()] as QuestState[],
    dailyQuestsDate: today,
    npcOrders: generateNpcOrders(1),
    worlds: initWorlds,
    activeWorldId: "main" as WorldId,
    loginStreak: 1,
    lastLoginDate: today,
    streakRewardDay: 1,
    updatedAt: now,
  };

  await db.insert(farmStateTable).values(newFarm);
  return newFarm;
}

// ─────────────────────────────────── GET Current Weather & Event ──────────────

router.get("/current-event", (_req, res) => {
  const weather = getCurrentWeather();
  const event = getActiveEvent();
  return res.json({
    currentWeather: weather,
    weatherConfig: WEATHER_CONFIG[weather],
    weatherGrowMult: WEATHER_GROW_MULT[weather],
    activeEvent: event?.isActive ? event : null,
  });
});

// ─────────────────────────────────── GET Farm State ───────────────────────────

router.get("/:telegramId", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const farm = await getOrCreateFarm(telegramId);

    const cleanedSprinklers = ((farm.activeSprinklers as ActiveSprinkler[]) || [])
      .filter((s) => new Date(s.expiresAt) > new Date());

    const decodeHeader = (v: string | undefined) => {
      if (v === undefined) return undefined;
      try { return decodeURIComponent(v) || null; } catch { return v || null; }
    };
    const usernameHeader = decodeHeader(req.headers["x-telegram-username"] as string | undefined);
    const firstNameHeader = decodeHeader(req.headers["x-telegram-firstname"] as string | undefined);
    const updatePayload: Record<string, unknown> = {
      plots: farm.plots,
      animals: farm.animals,
      buildings: farm.buildings,
      energy: farm.energy,
      lastEnergyRegen: farm.lastEnergyRegen,
      season: farm.season,
      quests: farm.quests,
      dailyQuestsDate: getTodayDate(),
      npcOrders: farm.npcOrders,
      items: (farm.items as ItemInventory) || emptyItems(),
      activeSprinklers: cleanedSprinklers,
      updatedAt: new Date(),
    };
    if (usernameHeader !== undefined) updatePayload.username = usernameHeader || null;
    if (firstNameHeader !== undefined) updatePayload.firstName = firstNameHeader || null;
    await db.update(farmStateTable).set(updatePayload).where(eq(farmStateTable.telegramId, telegramId));

    // Update level achievement
    await setAchievementAbsolute(telegramId, "level_up", farm.level);

    const playerAchs = await getPlayerAchievements(telegramId);
    const farmPassData = await getOrCreateFarmPass(telegramId);
    const initMedals = await checkAndAwardMedals(telegramId, farm);
    res.json({ ...serializeFarm({ ...farm, medals: initMedals }, telegramId), farmPass: serializeFarmPass(farmPassData), achievements: buildAchievementsResponse(playerAchs) });
  } catch (err) {
    console.error("getFarmState error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────── POST Action ──────────────────────────────

router.post("/:telegramId/action", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { action, plotId, cropType, quantity, animalId, buildingId, recipe } = req.body;

    const farm = await getOrCreateFarm(telegramId);

    let plots = farm.plots as PlotState[];
    let coins = farm.coins;
    let gems = farm.gems;
    let xp = farm.xp;
    let energy = farm.energy;
    let maxEnergy = farm.maxEnergy;
    let animals = [...(farm.animals as AnimalState[])];
    let buildings = [...(farm.buildings as BuildingState[])];
    let quests = [...(farm.quests as QuestState[])];
    let npcOrders = [...(farm.npcOrders as NpcOrder[])];
    const inventory = { ...(farm.inventory as CropInventory) };
    const seeds = { ...(farm.seeds as CropInventory) };
    const products = { ...(farm.products as ProductInventory) };
    const season = farm.season as Season;
    const items: ItemInventory = { ...(farm.items as ItemInventory || emptyItems()) };
    const toolTiers: ToolTiers = { ...(farm.toolTiers as ToolTiers || emptyToolTiers()) };
    let activeSprinklers: ActiveSprinkler[] = [...((farm.activeSprinklers as ActiveSprinkler[]) || [])];
    // Clean up expired sprinklers
    activeSprinklers = activeSprinklers.filter((s) => new Date(s.expiresAt) > new Date());
    let worlds: WorldsData = JSON.parse(JSON.stringify((farm.worlds as WorldsData) || defaultWorlds()));
    let activeWorldId: WorldId = (farm.activeWorldId as WorldId) || "main";
    const worldCfg = WORLD_CONFIG[activeWorldId];
    const currentWeather = getCurrentWeather();
    const activeEvent = getActiveEvent();
    let eventCoins: number = (farm.eventCoins as number) ?? 0;
    // Storm shelter: barn building converts storm 10% spoil into 10% potent harvest (+50% coins)
    const hasShelter = buildings.some((b) => BUILDING_CONFIG[b.type]?.shelter === true);

    // ── PLANT ──────────────────────────────────────────────────────────────────
    if (action === "plant") {
      if (plotId === undefined || !cropType) return res.status(400).json({ error: "plotId и cropType обязательны" });
      const plot = plots.find((p) => p.id === plotId);
      if (!plot || plot.status !== "empty") return res.status(400).json({ error: "Грядка не пустая" });
      if ((seeds[cropType as keyof CropInventory] ?? 0) <= 0) return res.status(400).json({ error: "Нет семян" });

      // Look up crop config — also check active event crops
      let cfg = getActiveCropConfig()[cropType];
      if (!cfg && activeEvent?.isActive) {
        const evCropDef = activeEvent.eventCrops.find((c) => c.id === cropType);
        if (evCropDef) {
          cfg = { growSec: evCropDef.growSec, seedCost: evCropDef.seedCostCoins, sellPrice: evCropDef.sellPrice, xp: evCropDef.xp, energyCost: 2, unlockLevel: 1 };
        }
      }
      if (!cfg) return res.status(400).json({ error: "Неизвестная культура" });
      if (energy < PLANT_ENERGY) return res.status(400).json({ error: `Нужно ${PLANT_ENERGY} энергии для посадки` });

      // baseGrowMs = season+world mult applied, weather excluded — used for dynamic weather recalculation
      const baseMultiplier = (SEASON_GROWTH_MULTIPLIER[season] ?? 1) * worldCfg.growMultiplier;
      const baseGrowMs = Math.ceil(cfg.growSec * baseMultiplier) * 1000;
      const growMult = baseMultiplier * WEATHER_GROW_MULT[currentWeather];
      const growSec = Math.ceil(cfg.growSec * growMult);
      const now = new Date();
      const readyAt = new Date(now.getTime() + growSec * 1000);

      energy -= PLANT_ENERGY;
      seeds[cropType as keyof CropInventory] -= 1;
      plots = plots.map((p) => p.id === plotId ? { ...p, cropType, status: "growing" as const, plantedAt: now.toISOString(), readyAt: readyAt.toISOString(), baseGrowMs } : p);
      quests = updateQuestProgress(quests, "plant", cropType, 1);

    // ── HARVEST ────────────────────────────────────────────────────────────────
    } else if (action === "harvest") {
      if (plotId === undefined) return res.status(400).json({ error: "plotId обязателен" });
      const plot = plots.find((p) => p.id === plotId);
      if (!plot || plot.status !== "ready" || !plot.cropType) return res.status(400).json({ error: "Урожай ещё не готов" });
      if (energy < HARVEST_ENERGY) return res.status(400).json({ error: `Нужно ${HARVEST_ENERGY} энергии для сбора` });

      let cfg = getActiveCropConfig()[plot.cropType];
      if (!cfg && activeEvent?.isActive) {
        const evCropDef = activeEvent.eventCrops.find((c) => c.id === plot.cropType);
        if (evCropDef) cfg = { growSec: evCropDef.growSec, seedCost: evCropDef.seedCostCoins, sellPrice: evCropDef.sellPrice, xp: evCropDef.xp, energyCost: 2, unlockLevel: 1 };
      }
      const sellMult = SEASON_SELL_MULTIPLIER[season] ?? 1;

      // Storm mechanic: 10% chance rolls
      //   - No barn (no shelter): spoil — crop is destroyed
      //   - Barn (shelter): potent — crop yields +50% coin bonus
      if (currentWeather === "storm" && Math.random() < STORM_SPOIL_CHANCE) {
        if (hasShelter) {
          // Potent harvest: crop → inventory + 50% bonus coins
          const extraDouble = worldCfg.doubleChanceBonus > 0 && Math.random() < worldCfg.doubleChanceBonus;
          const harvestQty = (plot.doubleHarvest || extraDouble) ? 2 : 1;
          inventory[plot.cropType as keyof CropInventory] = (inventory[plot.cropType as keyof CropInventory] ?? 0) + harvestQty;
          xp += Math.ceil((cfg?.xp ?? 5) * sellMult * harvestQty * worldCfg.xpMultiplier);
          coins += Math.ceil((cfg?.sellPrice ?? 10) * sellMult * harvestQty * 0.5);
          energy -= HARVEST_ENERGY;
          plots = plots.map((p) => p.id === plotId ? { ...p, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null, doubleHarvest: undefined } : p);
          quests = updateQuestProgress(quests, "harvest", plot.cropType, harvestQty);
          await updateAchievementProgress(telegramId, "harvest", harvestQty);
          if (activeEvent?.isActive && activeEvent.eventCrops.some((c) => c.id === plot.cropType)) {
            eventCoins += activeEvent.eventCoinReward * harvestQty;
          }
        } else {
          // Spoil path: crop destroyed by storm (no shelter)
          energy -= HARVEST_ENERGY;
          plots = plots.map((p) => p.id === plotId ? { ...p, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null, doubleHarvest: undefined } : p);
        }
      } else {
        // Normal harvest (90% of storm, or any non-storm weather)
        const extraDouble = worldCfg.doubleChanceBonus > 0 && Math.random() < worldCfg.doubleChanceBonus;
        const harvestQty = (plot.doubleHarvest || extraDouble) ? 2 : 1;
        inventory[plot.cropType as keyof CropInventory] = (inventory[plot.cropType as keyof CropInventory] ?? 0) + harvestQty;
        xp += Math.ceil((cfg?.xp ?? 5) * sellMult * harvestQty * worldCfg.xpMultiplier);
        energy -= HARVEST_ENERGY;
        plots = plots.map((p) => p.id === plotId ? { ...p, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null, doubleHarvest: undefined } : p);
        quests = updateQuestProgress(quests, "harvest", plot.cropType, harvestQty);
        await updateAchievementProgress(telegramId, "harvest", harvestQty);
        if (activeEvent?.isActive && activeEvent.eventCrops.some((c) => c.id === plot.cropType)) {
          eventCoins += activeEvent.eventCoinReward * harvestQty;
        }
      }

    // ── HARVEST ALL ────────────────────────────────────────────────────────────
    } else if (action === "harvest_all") {
      const readyPlots = plots.filter((p) => p.status === "ready" && p.cropType);
      if (readyPlots.length === 0) return res.status(400).json({ error: "Нет готового урожая" });
      const sellMult = SEASON_SELL_MULTIPLIER[season] ?? 1;
      const harvestedIds: number[] = [];
      let totalHarvested = 0;
      for (const plot of readyPlots) {
        if (energy < HARVEST_ENERGY) break;
        energy -= HARVEST_ENERGY;
        let cfg = getActiveCropConfig()[plot.cropType!];
        if (!cfg && activeEvent?.isActive) {
          const evCropDef = activeEvent.eventCrops.find((c) => c.id === plot.cropType);
          if (evCropDef) cfg = { growSec: evCropDef.growSec, seedCost: evCropDef.seedCostCoins, sellPrice: evCropDef.sellPrice, xp: evCropDef.xp, energyCost: 2, unlockLevel: 1 };
        }
        // Storm mechanic: 10% chance — spoil (no barn) or potent +50% coins (barn)
        if (currentWeather === "storm" && Math.random() < STORM_SPOIL_CHANCE) {
          if (hasShelter) {
            // Potent harvest
            const extraDouble = worldCfg.doubleChanceBonus > 0 && Math.random() < worldCfg.doubleChanceBonus;
            const harvestQty = (plot.doubleHarvest || extraDouble) ? 2 : 1;
            inventory[plot.cropType as keyof CropInventory] = (inventory[plot.cropType as keyof CropInventory] ?? 0) + harvestQty;
            xp += Math.ceil((cfg?.xp ?? 5) * sellMult * harvestQty * worldCfg.xpMultiplier);
            coins += Math.ceil((cfg?.sellPrice ?? 10) * sellMult * harvestQty * 0.5);
            quests = updateQuestProgress(quests, "harvest", plot.cropType!, harvestQty);
            harvestedIds.push(plot.id);
            totalHarvested += harvestQty;
            if (activeEvent?.isActive && activeEvent.eventCrops.some((c) => c.id === plot.cropType)) {
              eventCoins += activeEvent.eventCoinReward * harvestQty;
            }
          } else {
            // Spoil path: crop destroyed
            harvestedIds.push(plot.id);
          }
          continue;
        }
        // Normal harvest
        const extraDouble = worldCfg.doubleChanceBonus > 0 && Math.random() < worldCfg.doubleChanceBonus;
        const harvestQty = (plot.doubleHarvest || extraDouble) ? 2 : 1;
        inventory[plot.cropType as keyof CropInventory] = (inventory[plot.cropType as keyof CropInventory] ?? 0) + harvestQty;
        xp += Math.ceil((cfg?.xp ?? 5) * sellMult * harvestQty * worldCfg.xpMultiplier);
        quests = updateQuestProgress(quests, "harvest", plot.cropType!, harvestQty);
        harvestedIds.push(plot.id);
        totalHarvested += harvestQty;
        if (activeEvent?.isActive && activeEvent.eventCrops.some((c) => c.id === plot.cropType)) {
          eventCoins += activeEvent.eventCoinReward * harvestQty;
        }
      }
      if (totalHarvested > 0) await updateAchievementProgress(telegramId, "harvest", totalHarvested);
      plots = plots.map((p) =>
        harvestedIds.includes(p.id)
          ? { ...p, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null, doubleHarvest: undefined }
          : p
      );

    // ── UNLOCK WORLD ───────────────────────────────────────────────────────────
    } else if (action === "unlock_world") {
      const targetWorldId = req.body.worldId as WorldId;
      if (!targetWorldId || !WORLD_CONFIG[targetWorldId]) return res.status(400).json({ error: "Неизвестный мир" });
      if (targetWorldId === "main") return res.status(400).json({ error: "Главная ферма уже разблокирована" });
      const mainWorld = worlds.main || { plots, unlocked: true };
      const canUnlock = mainWorld.plots.length >= 25 || plots.length >= 25;
      if (!canUnlock) return res.status(400).json({ error: "Нужно 25 грядок на главной ферме" });
      const wCost = WORLD_CONFIG[targetWorldId].unlockCost;
      if (coins < wCost) return res.status(400).json({ error: `Нужно ${wCost} монет` });
      if (worlds[targetWorldId]?.unlocked) return res.status(400).json({ error: "Мир уже разблокирован" });
      coins -= wCost;
      worlds[targetWorldId] = {
        plots: Array.from({ length: 9 }, (_, i) => ({ id: i, cropType: null, status: "empty" as const, plantedAt: null, readyAt: null })),
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      };
      await updateAchievementProgress(telegramId, "unlock_world", 1);

    // ── SWITCH WORLD ────────────────────────────────────────────────────────────
    } else if (action === "switch_world") {
      const targetWorldId = req.body.worldId as WorldId;
      if (!targetWorldId || !WORLD_CONFIG[targetWorldId]) return res.status(400).json({ error: "Неизвестный мир" });
      if (targetWorldId === activeWorldId) return res.status(400).json({ error: "Уже на этом поле" });
      if (!worlds[targetWorldId]?.unlocked) return res.status(400).json({ error: "Мир не разблокирован" });
      // Save current world's plots
      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };
      // Load target world's plots
      const targetWorld = worlds[targetWorldId]!;
      plots = updatePlotStatuses(targetWorld.plots, currentWeather);
      activeWorldId = targetWorldId;

    // ── BUY SEEDS ──────────────────────────────────────────────────────────────
    } else if (action === "buy_seeds") {
      if (!cropType || !quantity) return res.status(400).json({ error: "cropType и quantity обязательны" });
      const cfg = getActiveCropConfig()[cropType];
      if (!cfg) return res.status(400).json({ error: "Неизвестная культура" });
      const cost = cfg.seedCost * quantity;
      if (coins < cost) return res.status(400).json({ error: "Недостаточно монет" });
      coins -= cost;
      seeds[cropType as keyof CropInventory] = (seeds[cropType as keyof CropInventory] ?? 0) + quantity;

    // ── BUY FROM ROTATING SHOP ─────────────────────────────────────────────────
    } else if (action === "buy_shop_seed") {
      const { slotIndex } = req.body as { slotIndex: number };
      if (slotIndex === undefined) return res.status(400).json({ error: "slotIndex обязателен" });
      const epoch = currentEpoch();
      const slots = generateShopSlots(epoch);
      const slot = slots.find((s) => s.slotIndex === slotIndex);
      if (!slot) return res.status(400).json({ error: "Слот не найден" });
      if (slot.outOfStock) return res.status(400).json({ error: "Эта культура недоступна в текущей ротации" });
      const slotKey = `${epoch}_${slotIndex}`;
      // Check existing purchases
      const existing = await db
        .select()
        .from(shopPurchasesTable)
        .where(
          and(
            eq(shopPurchasesTable.telegramId, telegramId),
            eq(shopPurchasesTable.slotKey, slotKey)
          )
        );
      const alreadyBought = existing[0]?.quantity ?? 0;
      if (alreadyBought >= slot.stock) return res.status(400).json({ error: "Лимит покупок исчерпан" });
      if (coins < slot.price) return res.status(400).json({ error: "Недостаточно монет" });
      coins -= slot.price;
      seeds[slot.cropId as keyof CropInventory] = (seeds[slot.cropId as keyof CropInventory] ?? 0) + 1;
      // Record purchase
      if (existing.length > 0) {
        await db
          .update(shopPurchasesTable)
          .set({ quantity: alreadyBought + 1 })
          .where(
            and(
              eq(shopPurchasesTable.telegramId, telegramId),
              eq(shopPurchasesTable.slotKey, slotKey)
            )
          );
      } else {
        await db.insert(shopPurchasesTable).values({ telegramId, slotKey, quantity: 1 });
      }

    // ── SELL CROPS ─────────────────────────────────────────────────────────────
    } else if (action === "sell_crops") {
      if (!cropType || !quantity) return res.status(400).json({ error: "cropType и quantity обязательны" });
      let cfg = getActiveCropConfig()[cropType];
      // Fallback: check active event crops so harvested event crops can be sold
      if (!cfg && activeEvent?.isActive) {
        const evCropDef = activeEvent.eventCrops.find((c) => c.id === cropType);
        if (evCropDef) cfg = { growSec: evCropDef.growSec, seedCost: evCropDef.seedCostCoins, sellPrice: evCropDef.sellPrice, xp: evCropDef.xp, energyCost: 2, unlockLevel: 1 };
      }
      if (!cfg) return res.status(400).json({ error: "Неизвестная культура" });
      const available = inventory[cropType as keyof CropInventory] ?? 0;
      if (available < quantity) return res.status(400).json({ error: "Недостаточно урожая" });
      const sellMult = SEASON_SELL_MULTIPLIER[season] ?? 1;
      const earned = Math.floor(cfg.sellPrice * sellMult) * quantity;
      coins += earned;
      inventory[cropType as keyof CropInventory] -= quantity;
      quests = updateQuestProgress(quests, "sell_crops", cropType, quantity);
      quests = updateQuestProgress(quests, "sell_any", "coins", earned);
      await updateAchievementProgress(telegramId, "earn_coins", earned);
      await updateAchievementProgress(telegramId, "sell_item", quantity);

    // ── BUY ANIMAL ─────────────────────────────────────────────────────────────
    } else if (action === "buy_animal") {
      if (!cropType) return res.status(400).json({ error: "Тип животного обязателен (cropType)" });
      const animalType = cropType as "chicken" | "cow" | "sheep";
      const cfg = ANIMAL_CONFIG[animalType];
      if (!cfg) return res.status(400).json({ error: "Неизвестный тип животного" });
      if (getLevelFromXp(xp) < cfg.unlockLevel) return res.status(400).json({ error: `Нужен ${cfg.unlockLevel} уровень` });
      if (coins < cfg.cost) return res.status(400).json({ error: "Недостаточно монет" });
      if (animals.length >= 6) return res.status(400).json({ error: "Максимум 6 животных" });
      coins -= cfg.cost;
      const newId = animals.length > 0 ? Math.max(...animals.map((a) => a.id)) + 1 : 0;
      const names: Record<string, string> = { chicken: "Курочка", cow: "Бурёнка", sheep: "Овечка" };
      animals.push({ id: newId, type: animalType, name: names[animalType] || animalType, fed: false, lastFedAt: null, productReadyAt: null, status: "hungry", level: 1 });
      quests = updateQuestProgress(quests, "buy_animal", animalType, 1);
      await updateAchievementProgress(telegramId, "buy_animal", 1);

    // ── FEED ANIMAL ────────────────────────────────────────────────────────────
    } else if (action === "feed_animal") {
      if (animalId === undefined) return res.status(400).json({ error: "animalId обязателен" });
      const idx = animals.findIndex((a) => a.id === animalId);
      if (idx === -1) return res.status(400).json({ error: "Животное не найдено" });
      const animal = animals[idx];
      if (animal.status === "ready") return res.status(400).json({ error: "Сначала собери продукт!" });
      if (energy < FEED_ENERGY) return res.status(400).json({ error: `Нужно ${FEED_ENERGY} энергии` });
      const cfg = ANIMAL_CONFIG[animal.type];
      const now = new Date();
      energy -= FEED_ENERGY;
      animals[idx] = { ...animal, fed: true, lastFedAt: now.toISOString(), productReadyAt: new Date(now.getTime() + cfg.productReadySec * 1000).toISOString(), status: "happy" };

    // ── COLLECT PRODUCT (from animal) ──────────────────────────────────────────
    } else if (action === "collect_product") {
      if (animalId === undefined) return res.status(400).json({ error: "animalId обязателен" });
      const idx = animals.findIndex((a) => a.id === animalId);
      if (idx === -1) return res.status(400).json({ error: "Животное не найдено" });
      const animal = animals[idx];
      if (animal.status !== "ready") return res.status(400).json({ error: "Продукт ещё не готов" });
      const cfg = ANIMAL_CONFIG[animal.type];
      products[cfg.productType as keyof ProductInventory] = (products[cfg.productType as keyof ProductInventory] ?? 0) + 1;
      xp += cfg.xp;
      animals[idx] = { ...animal, fed: false, lastFedAt: null, productReadyAt: null, status: "hungry" };

    // ── BUILD BUILDING ─────────────────────────────────────────────────────────
    } else if (action === "build_building") {
      if (!cropType) return res.status(400).json({ error: "Тип здания обязателен (cropType)" });
      const buildingType = cropType as "mill" | "bakery" | "dairy";
      const cfg = BUILDING_CONFIG[buildingType];
      if (!cfg) return res.status(400).json({ error: "Неизвестный тип здания" });
      if (getLevelFromXp(xp) < cfg.unlockLevel) return res.status(400).json({ error: `Нужен ${cfg.unlockLevel} уровень` });
      if (coins < cfg.cost) return res.status(400).json({ error: "Недостаточно монет" });
      if (buildings.some((b) => b.type === buildingType)) return res.status(400).json({ error: "Здание уже построено" });
      coins -= cfg.cost;
      const newId = buildings.length > 0 ? Math.max(...buildings.map((b) => b.id)) + 1 : 0;
      buildings.push({ id: newId, type: buildingType, level: 1, crafting: null });
      quests = updateQuestProgress(quests, "build_building", buildingType, 1);
      await updateAchievementProgress(telegramId, "build_building", 1);

    // ── START CRAFT ────────────────────────────────────────────────────────────
    } else if (action === "start_craft") {
      if (!recipe || buildingId === undefined) return res.status(400).json({ error: "recipe и buildingId обязательны" });
      const bIdx = buildings.findIndex((b) => b.id === buildingId);
      if (bIdx === -1) return res.status(400).json({ error: "Здание не найдено" });
      const building = buildings[bIdx];
      if (building.crafting) {
        const isReady = new Date() >= new Date(building.crafting.readyAt);
        if (!isReady) return res.status(400).json({ error: "Здание уже занято" });
      }
      const rcfg = RECIPE_CONFIG[recipe];
      if (!rcfg) return res.status(400).json({ error: "Неизвестный рецепт" });
      if (rcfg.building !== building.type) return res.status(400).json({ error: "Неверное здание для рецепта" });

      const fishInv: Record<string, number> = { ...((farm.fishInventory as Record<string, number>) ?? {}) };
      const FISH_IDS = new Set(["bass", "carp", "pike", "salmon", "legendary_fish"]);

      for (const input of rcfg.inputs) {
        const isFish = FISH_IDS.has(input.itemId);
        const available = isFish
          ? (fishInv[input.itemId] ?? 0)
          : input.itemId in inventory
            ? (inventory[input.itemId as keyof CropInventory] ?? 0)
            : (products[input.itemId as keyof ProductInventory] ?? 0);
        if (available < input.quantity) return res.status(400).json({ error: `Нужно ${input.quantity} ${input.itemId}` });
      }
      for (const input of rcfg.inputs) {
        const isFish = FISH_IDS.has(input.itemId);
        if (isFish) {
          fishInv[input.itemId] = (fishInv[input.itemId] ?? 0) - input.quantity;
        } else if (input.itemId in inventory) {
          inventory[input.itemId as keyof CropInventory] -= input.quantity;
        } else {
          products[input.itemId as keyof ProductInventory] -= input.quantity;
        }
      }
      // Persist fish inventory changes if any fish was used
      const fishUsed = rcfg.inputs.some((inp) => FISH_IDS.has(inp.itemId));
      if (fishUsed) {
        await db.update(farmStateTable).set({ fishInventory: fishInv }).where(eq(farmStateTable.telegramId, telegramId));
        farm.fishInventory = fishInv;
      }
      const now = new Date();
      buildings[bIdx] = { ...building, crafting: { recipe, startedAt: now.toISOString(), readyAt: new Date(now.getTime() + rcfg.craftSec * 1000).toISOString() } };

    // ── COLLECT CRAFT ──────────────────────────────────────────────────────────
    } else if (action === "collect_craft") {
      if (buildingId === undefined) return res.status(400).json({ error: "buildingId обязателен" });
      const bIdx = buildings.findIndex((b) => b.id === buildingId);
      if (bIdx === -1) return res.status(400).json({ error: "Здание не найдено" });
      const building = buildings[bIdx];
      if (!building.crafting) return res.status(400).json({ error: "Ничего не крафтится" });
      if (new Date() < new Date(building.crafting.readyAt)) return res.status(400).json({ error: "Ещё не готово" });
      const rcfg = RECIPE_CONFIG[building.crafting.recipe];
      if (!rcfg) return res.status(400).json({ error: "Неизвестный рецепт" });
      products[rcfg.outputId as keyof ProductInventory] = (products[rcfg.outputId as keyof ProductInventory] ?? 0) + rcfg.outputQty;
      xp += rcfg.xp;
      buildings[bIdx] = { ...building, crafting: null };
      quests = updateQuestProgress(quests, "collect_craft", rcfg.outputId, 1);
      await updateAchievementProgress(telegramId, "collect_craft", 1);

    // ── SELL PRODUCT ───────────────────────────────────────────────────────────
    } else if (action === "sell_product") {
      if (!cropType || !quantity) return res.status(400).json({ error: "cropType и quantity обязательны" });
      const productKey = cropType as keyof ProductInventory;
      const available = products[productKey] ?? 0;
      if (available < quantity) return res.status(400).json({ error: "Недостаточно продуктов" });
      const sellMult = SEASON_SELL_MULTIPLIER[season] ?? 1;
      const price = PRODUCT_SELL_PRICE[cropType] ?? 10;
      const earned = Math.floor(price * sellMult) * quantity;
      coins += earned;
      products[productKey] -= quantity;
      quests = updateQuestProgress(quests, "sell_product", cropType, quantity);
      quests = updateQuestProgress(quests, "sell_any", "coins", earned);
      await updateAchievementProgress(telegramId, "earn_coins", earned);
      await updateAchievementProgress(telegramId, "sell_item", quantity);

    // ── SELL ALL ───────────────────────────────────────────────────────────────
    } else if (action === "sell_all") {
      const sellMult = SEASON_SELL_MULTIPLIER[season] ?? 1;
      const activeCfg = getActiveCropConfig();
      let totalEarned = 0;
      let totalSoldQty = 0;

      for (const [cropId, qty] of Object.entries(inventory)) {
        const n = (qty as number) ?? 0;
        if (n <= 0) continue;
        const cfg = activeCfg[cropId];
        if (!cfg) continue;
        const earned = Math.floor(cfg.sellPrice * sellMult) * n;
        coins += earned;
        totalEarned += earned;
        totalSoldQty += n;
        (inventory as Record<string, number>)[cropId] = 0;
        quests = updateQuestProgress(quests, "sell_crops", cropId, n);
        quests = updateQuestProgress(quests, "sell_any", "coins", earned);
      }

      for (const [prodId, qty] of Object.entries(products)) {
        const n = (qty as number) ?? 0;
        if (n <= 0) continue;
        const price = PRODUCT_SELL_PRICE[prodId] ?? 10;
        const earned = Math.floor(price * sellMult) * n;
        coins += earned;
        totalEarned += earned;
        totalSoldQty += n;
        (products as Record<string, number>)[prodId] = 0;
        quests = updateQuestProgress(quests, "sell_product", prodId, n);
        quests = updateQuestProgress(quests, "sell_any", "coins", earned);
      }

      if (totalEarned === 0) return res.status(400).json({ error: "Амбар уже пуст!" });

      await updateAchievementProgress(telegramId, "earn_coins", totalEarned);
      if (totalSoldQty > 0) await updateAchievementProgress(telegramId, "sell_item", totalSoldQty);

    // ── REDEEM PROMO CODE ──────────────────────────────────────────────────────
    } else if (action === "redeem_promo") {
      const { promoCode } = req.body as { promoCode?: string };
      if (!promoCode) return res.status(400).json({ error: "Введите промокод" });
      const normalized = promoCode.trim().toUpperCase();

      // ── Try admin promo codes first ─────────────────────────────────────────
      const [promo] = await db.select().from(promocodesTable).where(eq(promocodesTable.code, normalized));
      if (promo) {
        if (!promo.active) return res.status(400).json({ error: "Промокод деактивирован" });
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date())
          return res.status(400).json({ error: "Срок действия промокода истёк" });
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses)
          return res.status(400).json({ error: "Промокод уже использован максимальное количество раз" });

        const [alreadyUsed] = await db
          .select()
          .from(promocodeUsesTable)
          .where(and(eq(promocodeUsesTable.code, normalized), eq(promocodeUsesTable.telegramId, telegramId)));
        if (alreadyUsed) return res.status(400).json({ error: "Вы уже использовали этот промокод" });

        coins += promo.rewardCoins;
        gems += promo.rewardGems;
        await db.insert(promocodeUsesTable).values({ code: normalized, telegramId });
        await db.update(promocodesTable).set({ usedCount: promo.usedCount + 1 }).where(eq(promocodesTable.code, normalized));
      } else {
        // ── Try player referral codes ─────────────────────────────────────────
        const [refOwner] = await db
          .select({ telegramId: farmStateTable.telegramId })
          .from(farmStateTable)
          .where(eq(farmStateTable.refCode, normalized));

        if (!refOwner) return res.status(404).json({ error: "Промокод не найден" });
        if (refOwner.telegramId === telegramId) return res.status(400).json({ error: "Нельзя использовать свой реферальный код" });

        // Check if current player already used any ref code
        const [alreadyReferred] = await db
          .select()
          .from(referralsTable)
          .where(eq(referralsTable.referredId, telegramId));
        if (alreadyReferred) return res.status(400).json({ error: "Вы уже использовали реферальный код" });

        const REF_PROMO_COINS = 50;
        const REF_PROMO_GEMS = 5;

        coins += REF_PROMO_COINS;
        gems += REF_PROMO_GEMS;

        // Give reward to code owner too
        await db.update(farmStateTable)
          .set({ coins: sql`${farmStateTable.coins} + ${REF_PROMO_COINS}`, gems: sql`${farmStateTable.gems} + ${REF_PROMO_GEMS}` })
          .where(eq(farmStateTable.telegramId, refOwner.telegramId));

        await db.insert(referralsTable).values({ referrerId: refOwner.telegramId, referredId: telegramId, rewardCoins: REF_PROMO_COINS });
      }

    // ── SET REF CODE ───────────────────────────────────────────────────────────
    } else if (action === "set_ref_code") {
      const { code } = req.body as { code?: string };
      if (!code) return res.status(400).json({ error: "Введите код" });
      const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (normalized.length < 3 || normalized.length > 15)
        return res.status(400).json({ error: "Код от 3 до 15 символов (буквы, цифры, _)" });

      // Check not taken by someone else
      const [existing] = await db
        .select({ tid: farmStateTable.telegramId })
        .from(farmStateTable)
        .where(eq(farmStateTable.refCode, normalized));
      if (existing && existing.tid !== telegramId)
        return res.status(400).json({ error: "Этот код уже занят, придумайте другой" });

      await db.update(farmStateTable).set({ refCode: normalized }).where(eq(farmStateTable.telegramId, telegramId));

    // ── COMPLETE NPC ORDER ─────────────────────────────────────────────────────
    } else if (action === "complete_npc_order") {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "orderId обязателен" });
      const orderIdx = npcOrders.findIndex((o) => o.id === orderId);
      if (orderIdx === -1) return res.status(400).json({ error: "Заказ не найден" });
      const order = npcOrders[orderIdx];
      if (order.completed) return res.status(400).json({ error: "Заказ уже выполнен" });
      if (new Date() > new Date(order.expiresAt)) return res.status(400).json({ error: "Заказ истёк" });

      for (const item of order.items) {
        const inInv = item.itemId in inventory;
        const available = inInv
          ? (inventory[item.itemId as keyof CropInventory] ?? 0)
          : (products[item.itemId as keyof ProductInventory] ?? 0);
        if (available < item.quantity) return res.status(400).json({ error: `Нужно ${item.quantity} ${item.itemId}` });
      }
      for (const item of order.items) {
        const inInv = item.itemId in inventory;
        if (inInv) inventory[item.itemId as keyof CropInventory] -= item.quantity;
        else products[item.itemId as keyof ProductInventory] -= item.quantity;
      }
      coins += order.reward.coins;
      xp += order.reward.xp;
      npcOrders[orderIdx] = { ...order, completed: true };
      await updateAchievementProgress(telegramId, "npc_order", 1);
      await updateAchievementProgress(telegramId, "earn_coins", order.reward.coins);

      if (npcOrders.every((o) => o.completed)) {
        npcOrders = generateNpcOrders(getLevelFromXp(xp));
      }

    // ── CLAIM QUEST ────────────────────────────────────────────────────────────
    } else if (action === "claim_quest") {
      const { questId } = req.body;
      if (!questId) return res.status(400).json({ error: "questId обязателен" });
      const qIdx = quests.findIndex((q) => q.id === questId);
      if (qIdx === -1) return res.status(400).json({ error: "Задание не найдено" });
      const quest = quests[qIdx];
      if (!quest.completed) return res.status(400).json({ error: "Задание не выполнено" });
      if (quest.claimed) return res.status(400).json({ error: "Награда уже получена" });
      coins += quest.rewardCoins;
      xp += quest.rewardXp;
      if (quest.rewardGems) gems += quest.rewardGems;
      quests[qIdx] = { ...quest, claimed: true };
      await updateAchievementProgress(telegramId, "claim_quest", 1);

    // ── REFRESH ORDERS ─────────────────────────────────────────────────────────
    } else if (action === "refresh_orders") {
      npcOrders = generateNpcOrders(getLevelFromXp(xp));

    // ── BUY ENERGY ─────────────────────────────────────────────────────────────
    } else if (action === "buy_energy") {
      const { amount: energyAmount } = req.body;
      const ENERGY_PACKS: Record<number, number> = { 10: 40, 30: 100, 999: 250 };
      const packAmount = Number(energyAmount);
      const cost = ENERGY_PACKS[packAmount];
      if (!cost) return res.status(400).json({ error: "Неверный пакет энергии" });
      if (coins < cost) return res.status(400).json({ error: "Недостаточно монет" });
      coins -= cost;
      energy = Math.min(maxEnergy, energy + (packAmount === 999 ? maxEnergy : packAmount));

    // ── EXPAND PLOTS ────────────────────────────────────────────────────────────
    } else if (action === "expand_plots") {
      const EXPAND_TIERS: { maxPlots: number; cost: number }[] = [
        { maxPlots: 12, cost: 150 },
        { maxPlots: 15, cost: 300 },
        { maxPlots: 18, cost: 600 },
        { maxPlots: 21, cost: 1200 },
        { maxPlots: 25, cost: 2500 },
      ];
      const currentCount = plots.length;
      const next = EXPAND_TIERS.find((t) => t.maxPlots > currentCount);
      if (!next) return res.status(400).json({ error: "Достигнут максимум грядок" });
      if (coins < next.cost) return res.status(400).json({ error: `Нужно ${next.cost} монет` });
      coins -= next.cost;
      const addCount = next.maxPlots - currentCount;
      const maxId = plots.length > 0 ? Math.max(...plots.map((p) => p.id)) : -1;
      for (let i = 1; i <= addCount; i++) {
        plots.push({ id: maxId + i, cropType: null, status: "empty", plantedAt: null, readyAt: null });
      }

    // ── BUY ITEM (premium) ─────────────────────────────────────────────────────
    } else if (action === "buy_item") {
      const { itemType, quantity: qty = 1 } = req.body;
      if (!itemType || !["watering_can", "sprinkler"].includes(itemType)) {
        return res.status(400).json({ error: "Неверный тип предмета" });
      }
      const cfg = ITEM_CONFIG[itemType as keyof typeof ITEM_CONFIG];
      const isPack = qty === cfg.packQty;
      const gemCost = isPack ? cfg.gemCostPack : cfg.gemCostSingle * qty;
      if (gems < gemCost) return res.status(400).json({ error: "Недостаточно 💎 кристаллов" });
      gems -= gemCost;
      if (itemType === "watering_can") {
        items.wateringCans = (items.wateringCans ?? 0) + qty;
      } else {
        items.sprinklers = (items.sprinklers ?? 0) + qty;
      }

    // ── USE ITEM ────────────────────────────────────────────────────────────────
    } else if (action === "use_item") {
      const { itemType, plotId: targetPlotId } = req.body;
      if (!itemType || targetPlotId === undefined) {
        return res.status(400).json({ error: "itemType и plotId обязательны" });
      }

      if (itemType === "watering_can") {
        if ((items.wateringCans ?? 0) <= 0) return res.status(400).json({ error: "Нет леек в инвентаре" });
        const plot = plots.find((p) => p.id === targetPlotId);
        if (!plot || plot.status !== "growing") return res.status(400).json({ error: "Грядка не растёт" });
        const wcTier = toolTiers.watering_can ?? 0;
        const wcTierDef = TOOL_TIER_CONFIG.watering_can[wcTier];
        // Gold tier (tier 2): water 3 adjacent plots instead of 1
        if (wcTier === 2 && wcTierDef.plotsAffected && wcTierDef.plotsAffected >= 3) {
          const affected3 = getSprinklerAffected(targetPlotId, plots).slice(0, 3);
          plots = plots.map((p) => affected3.includes(p.id) ? applyWateringEffect(p, wcTierDef.growthReduction, wcTierDef.doubleChance) : p);
        } else {
          plots = plots.map((p) => p.id === targetPlotId ? applyWateringEffect(p, wcTierDef.growthReduction, wcTierDef.doubleChance) : p);
        }
        items.wateringCans -= 1;

      } else if (itemType === "sprinkler") {
        if ((items.sprinklers ?? 0) <= 0) return res.status(400).json({ error: "Нет спринклеров в инвентаре" });
        const spTier = toolTiers.sprinkler ?? 0;
        const spTierDef = TOOL_TIER_CONFIG.sprinkler[spTier];
        const spDuration = spTierDef.durationMs ?? ITEM_CONFIG.sprinkler.durationMs;
        const affectedIds = getSprinklerAffected(targetPlotId, plots);
        plots = plots.map((p) =>
          affectedIds.includes(p.id) ? applyWateringEffect(p, spTierDef.growthReduction, spTierDef.doubleChance) : p
        );
        const now = new Date();
        const newSprinkler: ActiveSprinkler = {
          id: `sp_${now.getTime()}`,
          centerPlotId: targetPlotId,
          affectedPlotIds: affectedIds,
          placedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + spDuration).toISOString(),
        };
        activeSprinklers.push(newSprinkler);
        items.sprinklers -= 1;

      } else {
        return res.status(400).json({ error: "Неверный тип предмета" });
      }

    // ── CLAIM STREAK REWARD ─────────────────────────────────────────────────────
    } else if (action === "claim_streak_reward") {
      const streakDay = farm.streakRewardDay || 0;
      if (streakDay === 0) return res.status(400).json({ error: "Нет награды за стрик" });

      const reward = STREAK_REWARDS.find((r) => r.day === streakDay);
      if (!reward) return res.status(400).json({ error: "Неизвестная награда стрика" });

      // Apply reward amounts (compute before transaction)
      const applied = applyStreakReward({ ...farm, coins, gems, seeds, animals }, reward);
      coins = applied.coins;
      gems = applied.gems;
      Object.assign(seeds, applied.seeds);
      animals = applied.animals;

      const level = getLevelFromXp(xp);
      if (level > farm.level) maxEnergy = Math.min(60, 30 + level * 2);
      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };

      // Single atomic transaction: claim flag + full reward state in one commit
      const streakClaimResult = await db.transaction(async (tx) => {
        const claimed = await tx
          .update(farmStateTable)
          .set({
            plots, coins, gems, xp, level, energy, maxEnergy,
            animals, buildings, products, inventory, seeds,
            quests, npcOrders, items, activeSprinklers,
            worlds, activeWorldId,
            streakRewardDay: 0,
            updatedAt: new Date(),
          })
          .where(and(eq(farmStateTable.telegramId, telegramId), sql`"streak_reward_day" > 0`))
          .returning({ id: farmStateTable.telegramId });
        return claimed;
      });

      if (streakClaimResult.length === 0) {
        return res.status(409).json({ error: "Награда уже была получена" });
      }

      const farmOutStreak = serializeFarm({ ...farm, plots, coins, gems, xp, level, energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, streakRewardDay: 0, loginStreak: farm.loginStreak, lastLoginDate: farm.lastLoginDate }, telegramId);
      const playerAchsStreak = await getPlayerAchievements(telegramId);
      const streakPassData = await getOrCreateFarmPass(telegramId);
      return res.json({ ...farmOutStreak, farmPass: serializeFarmPass(streakPassData), achievements: buildAchievementsResponse(playerAchsStreak) });

    // ── CLAIM ACHIEVEMENT ───────────────────────────────────────────────────────
    } else if (action === "claim_achievement") {
      const { achievementId } = req.body as { achievementId?: string };
      if (!achievementId) return res.status(400).json({ error: "achievementId обязателен" });

      const def = ACHIEVEMENT_DEFS.find((d) => d.id === achievementId);
      if (!def) return res.status(400).json({ error: "Неизвестное достижение" });

      // Compute rewards before the transaction (needed in SET clause)
      const newCoinsAch = coins + def.rewardCoins;
      const newGemsAch = gems + def.rewardGems;
      const newSeedsAch = { ...seeds };
      if (def.rewardSeedType && def.rewardSeedQty) {
        newSeedsAch[def.rewardSeedType as keyof CropInventory] = ((newSeedsAch[def.rewardSeedType as keyof CropInventory] as number) ?? 0) + def.rewardSeedQty;
      }
      const levelAch = getLevelFromXp(xp);
      if (levelAch > farm.level) maxEnergy = Math.min(60, 30 + levelAch * 2);
      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };

      // Single transaction: mark achievement claimed AND credit farm rewards atomically
      const achResult = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(achievementsTable)
          .where(and(eq(achievementsTable.telegramId, telegramId), eq(achievementsTable.achievementId, achievementId)));

        if (!existing) return { status: "not_found" as const };
        if (existing.progress < def.goal) return { status: "not_completed" as const };
        if (existing.claimed === 1) return { status: "already_claimed" as const };

        // Atomically mark as claimed (WHERE claimed = 0 guards concurrent requests)
        const updated = await tx
          .update(achievementsTable)
          .set({ claimed: 1, claimedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(achievementsTable.id, existing.id), eq(achievementsTable.claimed, 0)))
          .returning({ id: achievementsTable.id });

        if (updated.length === 0) return { status: "already_claimed" as const };

        // Credit rewards to farm state inside the same transaction
        await tx.update(farmStateTable).set({
          plots, coins: newCoinsAch, gems: newGemsAch, xp, level: levelAch, energy, maxEnergy,
          animals, buildings, products, inventory, seeds: newSeedsAch,
          quests, npcOrders, items, activeSprinklers,
          worlds, activeWorldId,
          updatedAt: new Date(),
        }).where(eq(farmStateTable.telegramId, telegramId));

        return { status: "ok" as const };
      });

      if (achResult.status === "not_found") return res.status(400).json({ error: "Достижение ещё не выполнено" });
      if (achResult.status === "not_completed") return res.status(400).json({ error: "Достижение ещё не выполнено" });
      if (achResult.status === "already_claimed") return res.status(409).json({ error: "Награда уже получена" });

      coins = newCoinsAch;
      gems = newGemsAch;
      Object.assign(seeds, newSeedsAch);

      const farmOutAch = serializeFarm({ ...farm, plots, coins, gems, xp, level: levelAch, energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId }, telegramId);
      const playerAchsAch = await getPlayerAchievements(telegramId);
      const achPassData = await getOrCreateFarmPass(telegramId);
      return res.json({ ...farmOutAch, farmPass: serializeFarmPass(achPassData), achievements: buildAchievementsResponse(playerAchsAch) });

    // ── BUY EVENT CROP SEED ────────────────────────────────────────────────────
    } else if (action === "buy_event_crop_seed") {
      const { cropType: eventCropId, quantity: qty } = req.body as { cropType: string; quantity?: number };
      const ev = getActiveEvent();
      if (!ev?.isActive) return res.status(400).json({ error: "Ивент не активен" });
      const evCrop = ev.eventCrops.find((c) => c.id === eventCropId);
      if (!evCrop) return res.status(400).json({ error: "Культура недоступна в ивенте" });
      const buyQty = Math.max(1, Math.min(qty ?? 1, 99));
      const totalCost = evCrop.seedCostCoins * buyQty;
      if (coins < totalCost) return res.status(400).json({ error: `Нужно ${totalCost} монет` });
      coins -= totalCost;
      seeds[eventCropId as keyof CropInventory] = ((seeds[eventCropId as keyof CropInventory] as number) ?? 0) + buyQty;

    // ── SPEND EVENT COINS ────────────────────────────────────────────────────────
    } else if (action === "spend_event_coins") {
      const { itemId } = req.body as { itemId: string };
      const ev = getActiveEvent();
      if (!ev?.isActive) return res.status(400).json({ error: "Ивент не активен" });
      const shopItem = ev.shopItems.find((i) => i.id === itemId);
      if (!shopItem) return res.status(400).json({ error: "Товар не найден" });
      if (eventCoins < shopItem.cost) return res.status(400).json({ error: `Нужно ${shopItem.cost} ${ev.eventCoinEmoji} event-монет` });
      eventCoins -= shopItem.cost;
      if (shopItem.rewardCoins) coins += shopItem.rewardCoins;
      if (shopItem.rewardGems) gems += shopItem.rewardGems;
      if (shopItem.rewardSeedType && shopItem.rewardSeedQty) {
        seeds[shopItem.rewardSeedType as keyof CropInventory] = ((seeds[shopItem.rewardSeedType as keyof CropInventory] as number) ?? 0) + shopItem.rewardSeedQty;
      }

    // ── UPGRADE TOOL ────────────────────────────────────────────────────────────
    } else if (action === "upgrade_tool") {
      const { toolType } = req.body as { toolType?: "watering_can" | "sprinkler" };
      if (!toolType || !TOOL_TIER_CONFIG[toolType]) return res.status(400).json({ error: "Неверный тип инструмента" });
      const currentTier = toolTiers[toolType] ?? 0;
      if (currentTier >= 2) return res.status(400).json({ error: "Инструмент уже на максимальном уровне" });
      const nextTierDef = TOOL_TIER_CONFIG[toolType][currentTier + 1];
      if (nextTierDef.coinCost > 0 && coins < nextTierDef.coinCost) {
        return res.status(400).json({ error: `Нужно ${nextTierDef.coinCost} монет для улучшения` });
      }
      if (nextTierDef.gemCost > 0 && gems < nextTierDef.gemCost) {
        return res.status(400).json({ error: `Нужно ${nextTierDef.gemCost} 💎 кристаллов для улучшения` });
      }
      coins -= nextTierDef.coinCost;
      gems -= nextTierDef.gemCost;
      toolTiers[toolType] = (currentTier + 1) as 0 | 1 | 2;

      // Save toolTiers and redirect response early (toolTiers is saved in the final db.update below)
      // No early return - falls through to final save

    // ── BUY PREMIUM PASS ────────────────────────────────────────────────────────
    } else if (action === "buy_premium_pass") {
      const PREMIUM_PASS_COST_GEMS = 99;
      if (gems < PREMIUM_PASS_COST_GEMS) return res.status(400).json({ error: `Нужно ${PREMIUM_PASS_COST_GEMS} 💎 кристаллов` });

      const { seasonId: curSeasonId, seasonEnd: curSeasonEnd } = getCurrentPassSeason();
      if (Date.now() > curSeasonEnd.getTime()) return res.status(400).json({ error: "Сезон завершён, ждите следующего" });

      const passResult = await db.transaction(async (tx) => {
        const [existingPass] = await tx
          .select()
          .from(farmPassTable)
          .where(and(eq(farmPassTable.telegramId, telegramId), eq(farmPassTable.passSeasonId, curSeasonId)));
        if (existingPass?.isPremium) return { status: "already_premium" as const };

        if (existingPass) {
          await tx.update(farmPassTable)
            .set({ isPremium: true, updatedAt: new Date() })
            .where(eq(farmPassTable.id, existingPass.id));
        } else {
          await tx.insert(farmPassTable).values({
            telegramId, passSeasonId: curSeasonId, xp: 0, level: 1,
            freeTrackClaimed: [], premiumTrackClaimed: [], isPremium: true,
          });
        }
        await tx.update(farmStateTable)
          .set({ gems: gems - PREMIUM_PASS_COST_GEMS, updatedAt: new Date() })
          .where(eq(farmStateTable.telegramId, telegramId));
        return { status: "ok" as const };
      });

      if (passResult.status === "already_premium") return res.status(409).json({ error: "Пасс уже активен" });
      gems -= PREMIUM_PASS_COST_GEMS;

      const passForResp = await getOrCreateFarmPass(telegramId);
      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };
      const farmOutPass = serializeFarm({ ...farm, plots, coins, gems, xp, level: getLevelFromXp(xp), energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, eventCoins, toolTiers }, telegramId);
      const playerAchsPass = await getPlayerAchievements(telegramId);
      return res.json({ ...farmOutPass, farmPass: serializeFarmPass(passForResp), achievements: buildAchievementsResponse(playerAchsPass) });

    // ── CLAIM PASS REWARD ────────────────────────────────────────────────────────
    } else if (action === "claim_pass_reward") {
      const { passLevel, track } = req.body as { passLevel?: number; track?: "free" | "premium" };
      if (!passLevel || !track || !["free", "premium"].includes(track)) {
        return res.status(400).json({ error: "passLevel и track обязательны" });
      }
      if (passLevel < 1 || passLevel > PASS_MAX_LEVEL) return res.status(400).json({ error: "Неверный уровень" });

      const reward = PASS_REWARDS.find((r) => r.level === passLevel);
      if (!reward) return res.status(400).json({ error: "Награда не найдена" });

      const { seasonId: claimSeasonId } = getCurrentPassSeason();

      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };
      const claimLevel = getLevelFromXp(xp);
      if (claimLevel > farm.level) maxEnergy = Math.min(60, 30 + claimLevel * 2);

      const passClaimResult = await db.transaction(async (tx) => {
        // Lock farm pass row for update
        const [pass] = await tx
          .select()
          .from(farmPassTable)
          .where(and(eq(farmPassTable.telegramId, telegramId), eq(farmPassTable.passSeasonId, claimSeasonId)))
          .for("update");

        if (!pass) return { status: "no_pass" as const };
        if (pass.level < passLevel) return { status: "not_reached" as const };
        if (track === "premium" && !pass.isPremium) return { status: "not_premium" as const };

        const claimedArr = track === "free"
          ? (pass.freeTrackClaimed as number[]) || []
          : (pass.premiumTrackClaimed as number[]) || [];

        if (claimedArr.includes(passLevel)) return { status: "already_claimed" as const };

        const rewardDef = track === "free" ? reward.free : reward.premium;
        const newClaimed = [...claimedArr, passLevel];

        const updateSet = track === "free"
          ? { freeTrackClaimed: newClaimed as number[], updatedAt: new Date() }
          : { premiumTrackClaimed: newClaimed as number[], updatedAt: new Date() };

        const [updatedPass] = await tx
          .update(farmPassTable)
          .set(updateSet)
          .where(eq(farmPassTable.id, pass.id))
          .returning();

        // Compute new farm values from reward
        let newCoins = coins;
        let newGems = gems;
        const newSeeds = { ...seeds };
        const currentPets = (farm.pets as PetsInventory | null) ?? { owned: [] };
        const newPets: PetsInventory = { owned: [...currentPets.owned] };

        if (rewardDef.type === "coins" && rewardDef.amount) newCoins += rewardDef.amount;
        if (rewardDef.type === "gems" && rewardDef.amount) newGems += rewardDef.amount;
        if (rewardDef.type === "seeds" && rewardDef.seedType && rewardDef.seedQty) {
          newSeeds[rewardDef.seedType as keyof CropInventory] = ((newSeeds[rewardDef.seedType as keyof CropInventory] as number) ?? 0) + rewardDef.seedQty;
        }
        if (rewardDef.type === "pet" && rewardDef.petType) {
          const already = newPets.owned.some((p) => p.type === rewardDef.petType);
          if (!already) {
            newPets.owned.push({ type: rewardDef.petType!, obtainedAt: new Date().toISOString(), source: "farm_pass" });
          }
        }

        // Apply reward and farm state in the same transaction
        await tx.update(farmStateTable).set({
          plots, coins: newCoins, gems: newGems, xp, level: claimLevel, energy, maxEnergy,
          animals, buildings, products, inventory, seeds: newSeeds,
          quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, eventCoins, toolTiers, pets: newPets,
          updatedAt: new Date(),
        }).where(eq(farmStateTable.telegramId, telegramId));

        return { status: "ok" as const, rewardDef, updatedPass, newCoins, newGems, newSeeds, newPets };
      });

      if (passClaimResult.status === "no_pass") return res.status(400).json({ error: "Пасс не найден" });
      if (passClaimResult.status === "not_reached") return res.status(400).json({ error: "Уровень ещё не достигнут" });
      if (passClaimResult.status === "not_premium") return res.status(400).json({ error: "Необходим платный пасс" });
      if (passClaimResult.status === "already_claimed") return res.status(409).json({ error: "Награда уже получена" });

      coins = passClaimResult.newCoins;
      gems = passClaimResult.newGems;
      Object.assign(seeds, passClaimResult.newSeeds);
      const updatedPass = passClaimResult.updatedPass;
      const farmOutClaim = serializeFarm({ ...farm, plots, coins, gems, xp, level: claimLevel, energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, eventCoins, toolTiers, pets: passClaimResult.newPets }, telegramId);
      const playerAchsClaim = await getPlayerAchievements(telegramId);
      return res.json({ ...farmOutClaim, farmPass: serializeFarmPass(updatedPass), achievements: buildAchievementsResponse(playerAchsClaim) });

    // ── OPEN CASE ───────────────────────────────────────────────────────────────
    } else if (action === "open_case") {
      const { caseId } = req.body;

      let cropId: string;
      let qty: number;
      let rarity: CaseRarity;

      const staticCaseCfg = GEM_CASES[caseId as string];
      const customCaseCfg = (getAdminConfig().customCases ?? {})[caseId as string];

      if (staticCaseCfg) {
        // ── Static (built-in) case ──
        if (gems < staticCaseCfg.gemCost) return res.status(400).json({ error: `Нужно ${staticCaseCfg.gemCost} 💎 кристаллов` });

        const roll = Math.random();
        let cumulative = 0;
        rarity = "rare";
        for (const w of staticCaseCfg.weights) {
          cumulative += w.chance;
          if (roll < cumulative) { rarity = w.rarity; break; }
        }

        const pool = CASE_RARITY_CROPS[rarity];
        cropId = pool[Math.floor(Math.random() * pool.length)];
        qty = staticCaseCfg.minSeeds + Math.floor(Math.random() * (staticCaseCfg.maxSeeds - staticCaseCfg.minSeeds + 1));
        gems -= staticCaseCfg.gemCost;

      } else if (customCaseCfg) {
        // ── Custom (admin-created) case ──
        if (!customCaseCfg.active) return res.status(400).json({ error: "Кейс недоступен" });
        if (gems < customCaseCfg.gemCost) return res.status(400).json({ error: `Нужно ${customCaseCfg.gemCost} 💎 кристаллов` });

        const roll = Math.random();
        let cumulative = 0;
        let selectedDrop = customCaseCfg.drops[customCaseCfg.drops.length - 1];
        for (const drop of customCaseCfg.drops) {
          cumulative += drop.chance;
          if (roll < cumulative) { selectedDrop = drop; break; }
        }

        cropId = selectedDrop.cropId;
        qty = selectedDrop.minQty + Math.floor(Math.random() * (selectedDrop.maxQty - selectedDrop.minQty + 1));
        // Determine display rarity for the reveal animation
        rarity = CASE_RARITY_CROPS.legendary.includes(cropId) ? "legendary"
               : CASE_RARITY_CROPS.epic.includes(cropId)      ? "epic"
               : "rare";
        gems -= customCaseCfg.gemCost;

      } else {
        return res.status(400).json({ error: "Неизвестный кейс" });
      }

      seeds[cropId as keyof CropInventory] = ((seeds[cropId as keyof CropInventory] as number) ?? 0) + qty;

      // Store result in response extras (attach to the farm response)
      const caseResult = { cropId, qty, rarity };
      const level = getLevelFromXp(xp);
      if (level > farm.level) maxEnergy = Math.min(60, 30 + level * 2);
      worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };
      await db.update(farmStateTable).set({
        plots, coins, gems, xp, level, energy, maxEnergy,
        animals, buildings, products, inventory, seeds,
        quests, npcOrders, items, activeSprinklers,
        worlds, activeWorldId, toolTiers,
        updatedAt: new Date(),
      }).where(eq(farmStateTable.telegramId, telegramId));
      const farmOut = serializeFarm({ ...farm, plots, coins, gems, xp, level, energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, toolTiers }, telegramId);
      const playerAchsCase = await getPlayerAchievements(telegramId);
      const farmPassCase = await getOrCreateFarmPass(telegramId);
      return res.json({ ...farmOut, caseResult, farmPass: serializeFarmPass(farmPassCase), achievements: buildAchievementsResponse(playerAchsCase) });

    } else if (action === "buy_skin") {
      const { skinId } = body;
      const SKIN_DEFS: Record<string, { priceCoin?: number; priceGem?: number; free?: boolean }> = {
        default:  { free: true },
        green:    { priceCoin: 800 },
        desert:   { priceCoin: 1200 },
        snow:     { priceCoin: 2000 },
        tropical: { priceGem: 40 },
        night:    { priceGem: 60 },
        golden:   { priceGem: 100 },
      };
      const skinDef = SKIN_DEFS[skinId];
      if (!skinDef) return res.status(400).json({ error: "Скин не найден" });
      const owned: string[] = (farm.ownedSkins as string[]) ?? [];
      if (owned.includes(skinId) || skinDef.free) return res.status(400).json({ error: "Уже куплен" });
      if (skinDef.priceCoin) {
        if (coins < skinDef.priceCoin) return res.status(400).json({ error: "Недостаточно монет" });
        coins -= skinDef.priceCoin;
      } else if (skinDef.priceGem) {
        if (gems < skinDef.priceGem) return res.status(400).json({ error: "Недостаточно кристаллов" });
        gems -= skinDef.priceGem;
      }
      const newOwned = [...owned, skinId];
      await db.update(farmStateTable).set({ coins, gems, ownedSkins: newOwned, activeSkin: skinId, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, telegramId));
      const playerAchsBs = await getPlayerAchievements(telegramId);
      const farmPassBs = await getOrCreateFarmPass(telegramId);
      const medalsBs = await checkAndAwardMedals(telegramId, { ...farm, coins, gems, ownedSkins: newOwned });
      return res.json({ ...serializeFarm({ ...farm, coins, gems, ownedSkins: newOwned, activeSkin: skinId, medals: medalsBs }, telegramId), farmPass: serializeFarmPass(farmPassBs), achievements: buildAchievementsResponse(playerAchsBs) });

    } else if (action === "equip_skin") {
      const { skinId } = body;
      const owned: string[] = (farm.ownedSkins as string[]) ?? [];
      if (skinId !== "default" && !owned.includes(skinId)) return res.status(400).json({ error: "Скин не куплен" });
      await db.update(farmStateTable).set({ activeSkin: skinId, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, telegramId));
      const playerAchsEs = await getPlayerAchievements(telegramId);
      const farmPassEs = await getOrCreateFarmPass(telegramId);
      return res.json({ ...serializeFarm({ ...farm, activeSkin: skinId }, telegramId), farmPass: serializeFarmPass(farmPassEs), achievements: buildAchievementsResponse(playerAchsEs) });

    } else if (action === "record_playtime") {
      const { seconds } = body;
      if (typeof seconds !== "number" || seconds <= 0 || seconds > 600) return res.status(400).json({ error: "Invalid seconds" });
      const newTotal = (farm.totalPlaySeconds ?? 0) + Math.floor(seconds);
      await db.update(farmStateTable).set({ totalPlaySeconds: newTotal, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, telegramId));
      const updatedMedalsRp = await checkAndAwardMedals(telegramId, { ...farm, totalPlaySeconds: newTotal });
      return res.json({ ok: true, totalPlaySeconds: newTotal, medals: updatedMedalsRp });

    } else if (action === "equip_medal") {
      const { medalId } = body;
      const medalsData: MedalData = (farm.medals as MedalData) ?? emptyMedals();
      if (medalId !== null && !medalsData.earned.some((m) => m.id === medalId)) {
        return res.status(400).json({ error: "Медаль не получена" });
      }
      const updated: MedalData = { ...medalsData, equipped: medalId ?? null };
      await db.update(farmStateTable).set({ medals: updated, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, telegramId));
      const playerAchsEm = await getPlayerAchievements(telegramId);
      const farmPassEm = await getOrCreateFarmPass(telegramId);
      return res.json({ ...serializeFarm({ ...farm, medals: updated }, telegramId), farmPass: serializeFarmPass(farmPassEm), achievements: buildAchievementsResponse(playerAchsEm) });

    } else {
      return res.status(400).json({ error: "Неизвестное действие" });
    }

    const level = getLevelFromXp(xp);
    if (level > farm.level) {
      maxEnergy = Math.min(60, 30 + level * 2);
      xp = xp;
    }

    // Keep worlds in sync with active plots
    worlds[activeWorldId] = { ...(worlds[activeWorldId] || { unlocked: true }), plots };

    await db.update(farmStateTable).set({
      plots, coins, gems, xp, level, energy, maxEnergy,
      animals, buildings, products, inventory, seeds,
      quests, npcOrders, items, activeSprinklers,
      worlds, activeWorldId,
      eventCoins,
      toolTiers,
      weatherType: currentWeather,
      weatherUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(farmStateTable.telegramId, telegramId));

    // Add Farm Pass XP for key actions
    await addPassXp(telegramId, action);

    // Update level achievement after any action
    await setAchievementAbsolute(telegramId, "level_up", level);

    const playerAchs = await getPlayerAchievements(telegramId);
    const farmPass = await getOrCreateFarmPass(telegramId);
    const updatedFarmForMedals = { ...farm, plots, coins, gems, xp, level, energy, maxEnergy, animals, buildings, products, inventory, seeds, quests, npcOrders, items, activeSprinklers, worlds, activeWorldId, eventCoins, toolTiers };
    const updatedMedals = await checkAndAwardMedals(telegramId, updatedFarmForMedals);
    res.json({ ...serializeFarm({ ...updatedFarmForMedals, medals: updatedMedals }, telegramId), farmPass: serializeFarmPass(farmPass), achievements: buildAchievementsResponse(playerAchs) });
  } catch (err) {
    console.error("performFarmAction error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────── Serializer ───────────────────────────────

export type AchievementState = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  goal: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  category: string;
  rewardCoins: number;
  rewardGems: number;
};

function buildAchievementsResponse(playerAchs: Achievement[]): AchievementState[] {
  const map = new Map(playerAchs.map((a) => [a.achievementId, a]));
  return ACHIEVEMENT_DEFS.map((def) => {
    const pa = map.get(def.id);
    const progress = pa?.progress ?? 0;
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      description: def.description,
      goal: def.goal,
      progress,
      completed: progress >= def.goal,
      claimed: pa?.claimed === 1,
      category: def.category,
      rewardCoins: def.rewardCoins,
      rewardGems: def.rewardGems,
    };
  });
}

function serializeFarm(farm: any, telegramId: string) {
  const season = typeof farm.season === "string" ? farm.season as Season : "spring";
  const now = new Date();
  const activeSprinklers = ((farm.activeSprinklers as ActiveSprinkler[]) || [])
    .filter((s) => new Date(s.expiresAt) > now);
  const weather = getCurrentWeather();
  const event = getActiveEvent();
  return {
    telegramId,
    coins: farm.coins,
    gems: farm.gems,
    level: farm.level,
    xp: farm.xp,
    energy: farm.energy,
    maxEnergy: farm.maxEnergy,
    season,
    seasonName: SEASON_NAMES[season],
    plots: farm.plots,
    inventory: farm.inventory,
    seeds: farm.seeds,
    animals: farm.animals,
    buildings: farm.buildings,
    products: farm.products,
    quests: farm.quests,
    npcOrders: farm.npcOrders,
    items: (farm.items as ItemInventory) || emptyItems(),
    activeSprinklers,
    activeWorldId: (farm.activeWorldId as WorldId) || "main",
    worlds: (farm.worlds as WorldsData) || defaultWorlds(),
    worldConfig: getEffectiveWorldConfig(),
    itemConfig: ITEM_CONFIG,
    cropConfig: getActiveCropConfig(),
    customCropMeta: getAdminConfig().customCrops ?? {},
    customCaseMeta: getAdminConfig().customCases ?? {},
    animalConfig: ANIMAL_CONFIG,
    buildingConfig: BUILDING_CONFIG,
    recipeConfig: RECIPE_CONFIG,
    username: farm.username ?? null,
    firstName: farm.firstName ?? null,
    refCode: farm.refCode ?? null,
    loginStreak: farm.loginStreak ?? 0,
    lastLoginDate: farm.lastLoginDate ?? "",
    streakRewardDay: farm.streakRewardDay ?? 0,
    streakRewards: STREAK_REWARDS,
    eventCoins: farm.eventCoins ?? 0,
    currentWeather: weather,
    weatherConfig: WEATHER_CONFIG[weather],
    weatherGrowMult: WEATHER_GROW_MULT[weather],
    activeEvent: event?.isActive ? event : null,
    fishInventory: (farm.fishInventory as Record<string, number>) ?? {},
    toolTiers: (farm.toolTiers as ToolTiers) || emptyToolTiers(),
    toolTierConfig: TOOL_TIER_CONFIG,
    pets: (farm.pets as PetsInventory) ?? { owned: [] },
    activeSkin: (farm.activeSkin as string) ?? "default",
    ownedSkins: (farm.ownedSkins as string[]) ?? [],
    totalPlaySeconds: (farm.totalPlaySeconds as number) ?? 0,
    medals: (farm.medals as { earned: { id: string; earnedAt: string }[]; equipped: string | null }) ?? { earned: [], equipped: null },
    updatedAt: farm.updatedAt instanceof Date ? farm.updatedAt.toISOString() : farm.updatedAt,
  };
}

// ── Medal award logic ──────────────────────────────────────────────────────────
type MedalData = { earned: { id: string; earnedAt: string }[]; equipped: string | null };

function emptyMedals(): MedalData { return { earned: [], equipped: null }; }

async function checkAndAwardMedals(
  telegramId: string,
  farm: any,
  { harvestTotal, fishTotal }: { harvestTotal?: number; fishTotal?: number } = {}
): Promise<MedalData> {
  const medals: MedalData = (farm.medals as MedalData) ?? emptyMedals();
  const earned = new Set(medals.earned.map((m) => m.id));
  const newMedals: { id: string; earnedAt: string }[] = [];

  const award = (id: string) => {
    if (!earned.has(id)) {
      earned.add(id);
      newMedals.push({ id, earnedAt: new Date().toISOString() });
    }
  };

  // Harvest first
  const achievements: any[] = (await db.select().from(achievementsTable)
    .where(eq(achievementsTable.telegramId, telegramId))).map((a) => a);
  const harvestAch = achievements.find((a) => a.achievementId === "harvest_first");
  if (harvestAch?.progress >= 1 || (harvestTotal ?? 0) >= 1) award("first_harvest");
  const harvest200Ach = achievements.find((a) => a.achievementId === "harvest_200");
  if (harvest200Ach?.progress >= 200 || (harvestTotal ?? 0) >= 200) award("harvest_200");

  // Streak
  if ((farm.loginStreak ?? 0) >= 7)  award("streak_7");
  if ((farm.loginStreak ?? 0) >= 30) award("streak_30");

  // Coins & gems (real-time)
  if ((farm.coins ?? 0) >= 5000)  award("coins_5000");
  if ((farm.gems ?? 0)  >= 100)   award("gems_100");

  // Level
  if ((farm.level ?? 1) >= 5)  award("level_5");
  if ((farm.level ?? 1) >= 10) award("level_10");

  // Fish
  const fishInventory: Record<string, number> = (farm.fishInventory as Record<string, number>) ?? {};
  const totalFish = (fishTotal ?? 0) + Object.values(fishInventory).reduce((s, v) => s + v, 0);
  if (totalFish >= 10) award("fish_10");

  // Playtime
  if ((farm.totalPlaySeconds ?? 0) >= 3 * 3600) award("playtime_3h");

  // Golden skin
  const ownedSkins: string[] = (farm.ownedSkins as string[]) ?? [];
  if (ownedSkins.includes("golden")) award("golden_skin");

  if (newMedals.length === 0) return medals;

  const updated: MedalData = { earned: [...medals.earned, ...newMedals], equipped: medals.equipped };
  await db.update(farmStateTable).set({ medals: updated }).where(eq(farmStateTable.telegramId, telegramId));
  return updated;
}

export default router;
