export interface PlotState {
  id: number;
  cropType: string | null;
  status: "empty" | "growing" | "ready";
  plantedAt: string | null;
  readyAt: string | null;
  doubleHarvest?: boolean;
}

export interface ItemInventory {
  wateringCans: number;
  sprinklers: number;
}

export interface ActiveSprinkler {
  id: string;
  centerPlotId: number;
  affectedPlotIds: number[];
  placedAt: string;
  expiresAt: string;
}

export interface AnimalState {
  id: number;
  type: "chicken" | "cow" | "sheep" | "pig" | "bee";
  name: string;
  fed: boolean;
  lastFedAt: string | null;
  productReadyAt: string | null;
  status: "hungry" | "happy" | "ready";
  level: number;
}

export interface BuildingState {
  id: number;
  type: "mill" | "bakery" | "dairy" | "kitchen";
  level: number;
  crafting: CraftingSlot | null;
}

export interface CraftingSlot {
  recipe: string;
  startedAt: string;
  readyAt: string;
}

export interface CropInventory extends Record<string, number> {
  wheat: number;
  carrot: number;
  tomato: number;
  corn: number;
  strawberry: number;
  pumpkin: number;
  sunflower: number;
  blueberry?: number;
  mushroom?: number;
  cactus_fruit?: number;
  dates?: number;
  cranberry?: number;
  ice_root?: number;
}

export interface ProductInventory extends Record<string, number> {
  egg: number;
  milk: number;
  wool: number;
  flour: number;
  bread: number;
  cheese: number;
  corn_starch?: number;
  berry_juice?: number;
  corn_bread?: number;
  pumpkin_pie?: number;
  berry_jam?: number;
  mushroom_soup?: number;
  ice_cream?: number;
}

export interface QuestState {
  id: string;
  type: "daily" | "story";
  title: string;
  description: string;
  goal: { action: string; target: string; amount: number };
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
  rewardGems?: number;
}

export interface NpcOrder {
  id: string;
  npcName: string;
  npcEmoji: string;
  items: { itemId: string; quantity: number }[];
  reward: { coins: number; xp: number };
  expiresAt: string;
  completed: boolean;
}

export type WorldId = "main" | "forest" | "desert" | "snow";

export interface WorldData {
  plots: PlotState[];
  unlocked: boolean;
  unlockedAt?: string;
}

export interface WorldConfig {
  name: string;
  emoji: string;
  bg1: string;
  bg2: string;
  bonus: string | null;
  bonusDesc: string;
  crops: string[];
  unlockCost: number;
  growMultiplier: number;
  xpMultiplier: number;
  doubleChanceBonus: number;
}

export interface CustomCropMeta {
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
  chance: number;
  minQty: number;
  maxQty: number;
}

export interface CustomCaseMeta {
  id: string;
  name: string;
  emoji: string;
  gemCost: number;
  description: string;
  color: string;
  glowColor: string;
  active: boolean;
  drops: CustomCaseDrop[];
}

export interface StreakReward {
  day: number;
  label: string;
  type: "coins" | "gems" | "seed" | "animal";
  coins?: number;
  gems?: number;
  seedType?: string;
  seedQty?: number;
  animalType?: string;
}

export interface AchievementState {
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
}

export type WeatherType = "sunny" | "rainy" | "storm";

export interface WeatherConfig {
  label: string;
  emoji: string;
  tip: string;
}

export interface EventCropDef {
  id: string;
  name: string;
  emoji: string;
  growSec: number;
  seedCostCoins: number;
  sellPrice: number;
  xp: number;
  world: string;
}

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

export interface ActiveEventInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  startAt: string;
  endAt: string;
  eventCoinEmoji: string;
  eventCoinReward: number;
  eventCrops: EventCropDef[];
  shopItems: EventShopItem[];
  isActive: boolean;
  msLeft: number;
}

export type FishType = "bass" | "carp" | "pike" | "salmon" | "legendary_fish";

export interface FishMeta {
  name: string;
  emoji: string;
  sellPrice: number;
}

export interface FishingSession {
  id: number;
  telegramId: string;
  baitUsedAt: string;
  catchAt: string;
  fishType: string | null;
  claimed: number;
  createdAt: string;
}

export interface MarketListing {
  id: number;
  sellerId: string;
  itemType: "crop" | "product" | "fish";
  itemId: string;
  quantity: number;
  pricePerUnit: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  sellerName?: string;
  isOwn?: boolean;
}

export interface FarmData {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  refCode: string | null;
  coins: number;
  gems: number;
  level: number;
  xp: number;
  energy: number;
  maxEnergy: number;
  season: string;
  seasonName: string;
  plots: PlotState[];
  inventory: CropInventory;
  seeds: CropInventory;
  animals: AnimalState[];
  buildings: BuildingState[];
  products: ProductInventory;
  quests: QuestState[];
  npcOrders: NpcOrder[];
  items: ItemInventory;
  activeSprinklers: ActiveSprinkler[];
  activeWorldId: WorldId;
  worlds: Record<WorldId, WorldData>;
  worldConfig: Record<WorldId, WorldConfig>;
  customCropMeta?: Record<string, CustomCropMeta>;
  customCaseMeta?: Record<string, CustomCaseMeta>;
  loginStreak: number;
  lastLoginDate: string;
  streakRewardDay: number;
  streakRewards: StreakReward[];
  achievements: AchievementState[];
  eventCoins: number;
  currentWeather: WeatherType;
  weatherConfig: WeatherConfig;
  weatherGrowMult: number;
  activeEvent: ActiveEventInfo | null;
  fishInventory: Record<string, number>;
  toolTiers: ToolTiers;
  toolTierConfig: Record<"watering_can" | "sprinkler", ToolTierDef[]>;
  farmPass: FarmPass | null;
  pets: PetsInventory;
  activeSkin: string;
  ownedSkins: string[];
  totalPlaySeconds: number;
  medals: { earned: { id: string; earnedAt: string }[]; equipped: string | null };
  skillPoints: number;
  unlockedSkills: string[];
  npcRefreshesLeft: number;
  updatedAt: string;
}

export type ToolTierDef = {
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

export type ToolTiers = {
  watering_can: 0 | 1 | 2;
  sprinkler: 0 | 1 | 2;
};

export type PetEntry = {
  type: string;
  active: boolean;
};

export type PetsInventory = {
  owned: PetEntry[];
};

export type PassReward = {
  type: "coins" | "gems" | "seeds" | "pet";
  amount?: number;
  seedType?: string;
  seedQty?: number;
  petType?: string;
};

export type PassLevelReward = {
  level: number;
  free: PassReward;
  premium: PassReward;
};

export interface FarmPass {
  seasonId: string;
  xp: number;
  level: number;
  isPremium: boolean;
  freeTrackClaimed: number[];
  premiumTrackClaimed: number[];
  rewards: PassLevelReward[];
  xpPerLevel: number;
  maxLevel: number;
  seasonStartAt: string;
  seasonEndAt: string;
}

export type FarmAction =
  | { action: "plant"; plotId: number; cropType: string }
  | { action: "harvest"; plotId: number }
  | { action: "buy_seeds"; cropType: string; quantity: number }
  | { action: "sell_crops"; cropType: string; quantity: number }
  | { action: "buy_animal"; cropType: string }
  | { action: "feed_animal"; animalId: number }
  | { action: "collect_product"; animalId: number }
  | { action: "build_building"; cropType: string }
  | { action: "start_craft"; recipe: string; buildingId: number }
  | { action: "collect_craft"; buildingId: number }
  | { action: "sell_product"; cropType: string; quantity: number }
  | { action: "sell_all" }
  | { action: "redeem_promo"; promoCode: string }
  | { action: "complete_npc_order"; orderId: string }
  | { action: "claim_quest"; questId: string }
  | { action: "claim_all_quests" }
  | { action: "refresh_orders"; useGems?: boolean }
  | { action: "buy_energy"; amount: number }
  | { action: "expand_plots" }
  | { action: "harvest_all" }
  | { action: "unlock_world"; worldId: WorldId }
  | { action: "switch_world"; worldId: WorldId }
  | { action: "buy_item"; itemType: "watering_can" | "sprinkler"; quantity: number }
  | { action: "use_item"; itemType: "watering_can" | "sprinkler"; plotId: number }
  | { action: "open_case"; caseId: string }
  | { action: "set_ref_code"; code: string }
  | { action: "claim_streak_reward" }
  | { action: "claim_achievement"; achievementId: string }
  | { action: "buy_event_crop_seed"; cropType: string; quantity: number }
  | { action: "spend_event_coins"; itemId: string }
  | { action: "upgrade_tool"; toolType: "watering_can" | "sprinkler" }
  | { action: "buy_premium_pass" }
  | { action: "claim_pass_reward"; passLevel: number; track: "free" | "premium" }
  | { action: "buy_skin"; skinId: string }
  | { action: "equip_skin"; skinId: string }
  | { action: "record_playtime"; seconds: number }
  | { action: "equip_medal"; medalId: string | null }
  | { action: "buy_pet"; petType: string; priceGem?: number }
  | { action: "activate_pet"; petType: string | null }
  | { action: "unlock_skill"; skillId: string };
