import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "admin-config.json");

export interface NpcTemplate {
  npcName: string;
  npcEmoji: string;
}

export interface DailyQuestTemplate {
  id: string;
  title: string;
  description: string;
  goal: { action: string; target: string; amount: number };
  rewardCoins: number;
  rewardXp: number;
}

export interface CropOverride {
  seedCost?: number;
  sellPrice?: number;
  growSec?: number;
  xp?: number;
  energyCost?: number;
  unlockLevel?: number;
}

export interface ShopCropOverride {
  enabled?: boolean;                                        // false = excluded from shop entirely
  rarity?: "common" | "rare" | "epic" | "legendary";      // override pool assignment
  appearChance?: number;                                    // 0..1 probability slot is active per rotation
  shopPriceMult?: number;                                   // price multiplier (1.0 = normal, 0.8 = -20%)
  shopPrice?: number | null;                               // fixed absolute price (null = use formula)
}

export interface CustomCropDef {
  id: string;
  name: string;
  emoji: string;
  world: string;
  seedCost: number;
  sellPrice: number;
  growSec: number;
  xp: number;
  energyCost: number;
  unlockLevel: number;
  description: string;
}

export interface CustomCaseDrop {
  cropId: string;
  chance: number;   // 0.0 – 1.0, sum of all drops should equal 1.0
  minQty: number;
  maxQty: number;
}

export interface CustomCaseDef {
  id: string;
  name: string;
  emoji: string;
  gemCost: number;
  description: string;
  color: string;      // tailwind gradient e.g. "from-purple-500 to-pink-600"
  glowColor: string;  // rgba string for glow effect
  active: boolean;
  drops: CustomCaseDrop[];
}

export interface ShopGlobalSettings {
  rareAppearChance: number;    // 0..1, default 0.85
  epicAppearChance: number;    // 0..1, default 0.70
  legAppearChance: number;     // 0..1, default 0.55
  commonStock: number;         // per player per rotation, default 10
  rareStock: number;           // default 5
  epicStock: number;           // default 2
  legStock: number;            // default 1
  commonPriceMult: number;     // price markup, default 1.0
  rarePriceMult: number;       // default 1.2
  epicPriceMult: number;       // default 1.6
  legPriceMult: number;        // default 2.2
  sodDiscount: number;         // Seed of Day discount %, default 25
  sodStock: number;            // Seed of Day stock per player, default 3
}

export const DEFAULT_SHOP_GLOBAL: ShopGlobalSettings = {
  rareAppearChance: 0.85,
  epicAppearChance: 0.70,
  legAppearChance:  0.55,
  commonStock:      10,
  rareStock:        5,
  epicStock:        2,
  legStock:         1,
  commonPriceMult:  1.0,
  rarePriceMult:    1.2,
  epicPriceMult:    1.6,
  legPriceMult:     2.2,
  sodDiscount:      25,
  sodStock:         3,
};

export interface EventShopItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  rewardCoins?: number;
  rewardGems?: number;
  rewardSeedType?: string;
  rewardSeedQty?: number;
}

export interface EventCropDef {
  id: string;
  name: string;
  emoji: string;
  growSec: number;
  seedCostCoins: number;
  sellPrice: number;
  xp: number;
}

export interface SeasonalEventDef {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  startAt: string;
  endAt: string;
  eventCoinName: string;
  eventCoinEmoji: string;
  eventCoinReward: number;
  eventCrops: EventCropDef[];
  shopItems: EventShopItem[];
}

export interface AdminConfig {
  npcTemplates: NpcTemplate[];
  dailyQuestTemplates: DailyQuestTemplate[];
  cropOverrides?: Record<string, CropOverride>;
  customCrops?: Record<string, CustomCropDef>;
  shopEpochOffset?: number;
  shopCropOverrides?: Record<string, ShopCropOverride>;
  shopGlobalSettings?: Partial<ShopGlobalSettings>;
  customCases?: Record<string, CustomCaseDef>;
  activeEvent?: SeasonalEventDef | null;
}

export const DEFAULT_CONFIG: AdminConfig = {
  npcTemplates: [
    { npcName: "Бабушка Маша",   npcEmoji: "👵" },
    { npcName: "Фермер Иван",    npcEmoji: "👨‍🌾" },
    { npcName: "Торговец Борис", npcEmoji: "🧑‍💼" },
    { npcName: "Повар Никита",   npcEmoji: "👨‍🍳" },
    { npcName: "Покупатель Аня", npcEmoji: "👩" },
  ],
  dailyQuestTemplates: [
    {
      id: "daily_harvest_wheat",
      title: "Сбор пшеницы",
      description: "Собери 5 пшеницы",
      goal: { action: "harvest", target: "wheat", amount: 5 },
      rewardCoins: 40,
      rewardXp: 20,
    },
    {
      id: "daily_harvest_3",
      title: "Трудяга",
      description: "Собери 3 любых урожая",
      goal: { action: "harvest", target: "any", amount: 3 },
      rewardCoins: 30,
      rewardXp: 15,
    },
    {
      id: "daily_sell_50",
      title: "Торговый день",
      description: "Продай урожай на 50 монет",
      goal: { action: "sell_any", target: "coins", amount: 50 },
      rewardCoins: 50,
      rewardXp: 25,
    },
    {
      id: "daily_plant_5",
      title: "Сей больше",
      description: "Посади 5 любых культур",
      goal: { action: "plant", target: "any", amount: 5 },
      rewardCoins: 35,
      rewardXp: 18,
    },
  ],
  cropOverrides: {},
  customCrops: {},
};

let cachedConfig: AdminConfig | null = null;

export function getAdminConfig(): AdminConfig {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      cachedConfig = {
        npcTemplates: DEFAULT_CONFIG.npcTemplates,
        dailyQuestTemplates: DEFAULT_CONFIG.dailyQuestTemplates,
        cropOverrides: {},
        customCrops: {},
        ...JSON.parse(raw),
      };
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  return cachedConfig!;
}

export function saveAdminConfig(config: AdminConfig): void {
  cachedConfig = config;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save admin config:", e);
  }
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
}
