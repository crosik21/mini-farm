import { pgTable, text, integer, jsonb, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const farmStateTable = pgTable("farm_states", {
  telegramId: text("telegram_id").primaryKey(),
  coins: integer("coins").notNull().default(100),
  gems: integer("gems").notNull().default(5),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  energy: integer("energy").notNull().default(30),
  maxEnergy: integer("max_energy").notNull().default(30),
  lastEnergyRegen: timestamp("last_energy_regen").notNull().defaultNow(),
  season: text("season").notNull().default("spring"),
  seasonUpdatedAt: timestamp("season_updated_at").notNull().defaultNow(),
  plots: jsonb("plots").notNull().$type<PlotState[]>(),
  inventory: jsonb("inventory").notNull().$type<CropInventory>(),
  seeds: jsonb("seeds").notNull().$type<CropInventory>(),
  animals: jsonb("animals").notNull().$type<AnimalState[]>(),
  buildings: jsonb("buildings").notNull().$type<BuildingState[]>(),
  products: jsonb("products").notNull().$type<ProductInventory>(),
  quests: jsonb("quests").notNull().$type<QuestState[]>(),
  dailyQuestsDate: text("daily_quests_date").notNull().default(""),
  npcOrders: jsonb("npc_orders").notNull().$type<NpcOrder[]>(),
  items: jsonb("items").$type<ItemInventory>(),
  activeSprinklers: jsonb("active_sprinklers").$type<ActiveSprinkler[]>(),
  worlds: jsonb("worlds").$type<WorldsData>(),
  activeWorldId: text("active_world_id").default("main"),
  username: text("username"),
  firstName: text("first_name"),
  refCode: text("ref_code").unique(),
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: text("last_login_date").notNull().default(""),
  streakRewardDay: integer("streak_reward_day").notNull().default(0),
  eventCoins: integer("event_coins").notNull().default(0),
  weatherType: text("weather_type").notNull().default("sunny"),
  weatherUpdatedAt: timestamp("weather_updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFarmStateSchema = createInsertSchema(farmStateTable, {
  telegramId: z.string(),
  coins: z.number().int().min(0),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
});

export type PlotState = {
  id: number;
  cropType: string | null;
  status: "empty" | "growing" | "ready";
  plantedAt: string | null;
  readyAt: string | null;
  doubleHarvest?: boolean;
};

export type WorldId = "main" | "forest" | "desert" | "snow";

export type WorldsData = {
  [key in WorldId]?: {
    plots: PlotState[];
    unlocked: boolean;
    unlockedAt?: string;
  };
};

export type ItemInventory = {
  wateringCans: number;
  sprinklers: number;
};

export type ActiveSprinkler = {
  id: string;
  centerPlotId: number;
  affectedPlotIds: number[];
  placedAt: string;
  expiresAt: string;
};

export type CropInventory = {
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
};

export type AnimalState = {
  id: number;
  type: "chicken" | "cow" | "sheep" | "pig" | "bee";
  name: string;
  fed: boolean;
  lastFedAt: string | null;
  productReadyAt: string | null;
  status: "hungry" | "happy" | "ready";
  level: number;
};

export type BuildingState = {
  id: number;
  type: "mill" | "bakery" | "dairy" | "kitchen";
  level: number;
  crafting: CraftingSlot | null;
};

export type CraftingSlot = {
  recipe: string;
  startedAt: string;
  readyAt: string;
};

export type ProductInventory = {
  egg: number;
  milk: number;
  wool: number;
  flour: number;
  bread: number;
  cheese: number;
};

export type QuestState = {
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
};

export type NpcOrder = {
  id: string;
  npcName: string;
  npcEmoji: string;
  items: { itemId: string; quantity: number }[];
  reward: { coins: number; xp: number };
  expiresAt: string;
  completed: boolean;
};

export type Season = "spring" | "summer" | "autumn" | "winter";

export type FarmState = typeof farmStateTable.$inferSelect;
export type InsertFarmState = typeof farmStateTable.$inferInsert;

// ─────────────────────── Social Tables ────────────────────────────────────────

export type TradeItem = {
  type: "crop" | "product" | "coins";
  id: string;
  quantity: number;
};

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  friendId: text("friend_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredId: text("referred_id").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tradeOffersTable = pgTable("trade_offers", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | cancelled
  senderItems: jsonb("sender_items").notNull().$type<TradeItem[]>(),
  receiverItems: jsonb("receiver_items").notNull().$type<TradeItem[]>(),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Friendship = typeof friendshipsTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
export type TradeOffer = typeof tradeOffersTable.$inferSelect;

// ─────────────────────── Rotating Seed Shop ───────────────────────────────────

export const shopPurchasesTable = pgTable("shop_purchases", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull(),
  slotKey: text("slot_key").notNull(), // "{epoch5min}_{slotIndex}"
  quantity: integer("quantity").notNull().default(0),
});

export type ShopPurchase = typeof shopPurchasesTable.$inferSelect;

// ─────────────────────── Daily Gifts ──────────────────────────────────────────

export const dailyGiftsTable = pgTable("daily_gifts", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  dayKey: text("day_key").notNull(),      // YYYY-MM-DD — 1 gift per sender per receiver per day
  giftCropId: text("gift_crop_id"),       // nullable — legacy seed gifts
  giftQty: integer("gift_qty").notNull().default(0),
  giftCoins: integer("gift_coins").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DailyGift = typeof dailyGiftsTable.$inferSelect;

// ─────────────────────── Promo Codes ──────────────────────────────────────────

export const promocodesTable = pgTable("promocodes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  maxUses: integer("max_uses"),           // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  active: integer("active").notNull().default(1),  // 1 = active
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promocodeUsesTable = pgTable("promocode_uses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  telegramId: text("telegram_id").notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

export type Promocode = typeof promocodesTable.$inferSelect;
export type PromocodeUse = typeof promocodeUsesTable.$inferSelect;

// ─────────────────────── Achievements ─────────────────────────────────────────

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  progress: integer("progress").notNull().default(0),
  claimed: integer("claimed").notNull().default(0),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueAch: uniqueIndex("achievements_telegram_achievement_unique").on(table.telegramId, table.achievementId),
}));

export type Achievement = typeof achievementsTable.$inferSelect;
