import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  farmStateTable,
  friendshipsTable,
  referralsTable,
  tradeOffersTable,
  dailyGiftsTable,
  type TradeItem,
} from "@workspace/db";
import { eq, or, and, sql, inArray, desc } from "drizzle-orm";

const GIFT_CROPS = ["wheat", "carrot", "tomato", "corn", "blueberry", "cranberry", "mushroom"];
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const router: IRouter = Router();

const ADMIN_SECRET = process.env.FARM_ADMIN_SECRET ?? "farm-admin-2024";
const REFERRAL_REWARD = 200;
const REFERRAL_BONUS = 100;

function getTelegramId(req: any): string | null {
  return req.headers["x-telegram-id"] as string || null;
}

// ─── GET /social/users/search?q=username ──────────────────────────────────────
router.get("/users/search", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) return res.status(400).json({ error: "Слишком короткий запрос" });

  const term = q.replace(/^@/, "").toLowerCase().trim();

  const results = await db
    .select({
      telegramId: farmStateTable.telegramId,
      username: farmStateTable.username,
      firstName: farmStateTable.firstName,
      level: farmStateTable.level,
    })
    .from(farmStateTable)
    .where(
      sql`LOWER(${farmStateTable.username}) = ${term}
          OR LOWER(${farmStateTable.username}) LIKE ${term + "%"}
          OR LOWER(${farmStateTable.firstName}) LIKE ${term + "%"}`
    )
    .limit(8);

  const filtered = results.filter((r) => r.telegramId !== me);
  res.json({ users: filtered });
});

// ─── GET /social/friends ──────────────────────────────────────────────────────
router.get("/friends", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(or(eq(friendshipsTable.userId, me), eq(friendshipsTable.friendId, me)));

  const friendIds = rows.map((r) => (r.userId === me ? r.friendId : r.userId));
  const profiles: Record<string, { level: number; coins: number; username?: string; firstName?: string }> = {};

  if (friendIds.length > 0) {
    const farmRows = await db
      .select({
        telegramId: farmStateTable.telegramId,
        level: farmStateTable.level,
        coins: farmStateTable.coins,
        username: farmStateTable.username,
        firstName: farmStateTable.firstName,
      })
      .from(farmStateTable)
      .where(inArray(farmStateTable.telegramId, friendIds));
    for (const f of farmRows) {
      profiles[f.telegramId] = {
        level: f.level,
        coins: f.coins,
        username: f.username ?? undefined,
        firstName: f.firstName ?? undefined,
      };
    }
  }

  const friends = rows.map((r) => {
    const otherId = r.userId === me ? r.friendId : r.userId;
    const direction = r.userId === me ? "outgoing" : "incoming";
    return {
      id: r.id,
      friendId: otherId,
      status: r.status,
      direction,
      profile: profiles[otherId] ?? null,
      createdAt: r.createdAt,
    };
  });

  res.json({ friends });
});

// ─── POST /social/friends/request ────────────────────────────────────────────
router.post("/friends/request", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { targetId, targetUsername } = req.body as { targetId?: string; targetUsername?: string };

  let resolvedId = targetId;

  // Resolve by username if targetId not provided
  if (!resolvedId && targetUsername) {
    const term = targetUsername.replace(/^@/, "").toLowerCase().trim();
    const [found] = await db
      .select({ telegramId: farmStateTable.telegramId })
      .from(farmStateTable)
      .where(sql`LOWER(${farmStateTable.username}) = ${term}`)
      .limit(1);
    if (!found) return res.status(404).json({ error: `Пользователь @${targetUsername.replace(/^@/, "")} не найден` });
    resolvedId = found.telegramId;
  }

  if (!resolvedId || resolvedId === me) return res.status(400).json({ error: "Invalid targetId" });

  // Check target exists
  const target = await db
    .select({ telegramId: farmStateTable.telegramId })
    .from(farmStateTable)
    .where(eq(farmStateTable.telegramId, resolvedId));
  if (!target.length) return res.status(404).json({ error: "Пользователь не найден" });

  // Check existing friendship
  const existing = await db.select().from(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.userId, me), eq(friendshipsTable.friendId, resolvedId)),
      and(eq(friendshipsTable.userId, resolvedId), eq(friendshipsTable.friendId, me))
    )
  );
  if (existing.length > 0) {
    const s = existing[0].status;
    if (s === "accepted") return res.status(400).json({ error: "Уже друзья" });
    if (s === "pending") return res.status(400).json({ error: "Запрос уже отправлен" });
  }

  await db.insert(friendshipsTable).values({ userId: me, friendId: resolvedId, status: "pending" });
  res.json({ ok: true, message: "Запрос отправлен" });
});

// ─── POST /social/friends/respond ────────────────────────────────────────────
router.post("/friends/respond", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });
  const { friendshipId, action } = req.body as { friendshipId: number; action: "accept" | "decline" };

  const [row] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
  if (!row) return res.status(404).json({ error: "Запрос не найден" });
  if (row.friendId !== me) return res.status(403).json({ error: "Не ваш запрос" });
  if (row.status !== "pending") return res.status(400).json({ error: "Уже обработан" });

  const newStatus = action === "accept" ? "accepted" : "declined";
  await db.update(friendshipsTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(friendshipsTable.id, friendshipId));

  res.json({ ok: true, status: newStatus });
});

// ─── DELETE /social/friends/:id ───────────────────────────────────────────────
router.delete("/friends/:id", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });
  const id = parseInt(req.params.id);

  const [row] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, id));
  if (!row) return res.status(404).json({ error: "Не найдено" });
  if (row.userId !== me && row.friendId !== me) return res.status(403).json({ error: "Нет доступа" });

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.json({ ok: true });
});

// ─── GET /social/referral ─────────────────────────────────────────────────────
router.get("/referral", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const referred = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, me));
  const totalEarned = referred.reduce((s, r) => s + r.rewardCoins, 0);

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gallte_bot";
  const link = `https://t.me/${botUsername}/start?startapp=ref_${me}`;

  res.json({
    link,
    referralCount: referred.length,
    totalEarned,
    referrals: referred.map((r) => ({ referredId: r.referredId, reward: r.rewardCoins, createdAt: r.createdAt })),
  });
});

// ─── POST /social/referral/claim ──────────────────────────────────────────────
router.post("/referral/claim", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });

  const { referrerId, referredId } = req.body as { referrerId: string; referredId: string };
  if (!referrerId || !referredId) return res.status(400).json({ error: "Missing fields" });

  const existing = await db.select().from(referralsTable).where(eq(referralsTable.referredId, referredId));
  if (existing.length > 0) return res.status(400).json({ error: "Already claimed" });

  await db.update(farmStateTable).set({ coins: sql`${farmStateTable.coins} + ${REFERRAL_REWARD}` }).where(eq(farmStateTable.telegramId, referrerId));
  await db.update(farmStateTable).set({ coins: sql`${farmStateTable.coins} + ${REFERRAL_BONUS}` }).where(eq(farmStateTable.telegramId, referredId));

  await db.insert(referralsTable).values({ referrerId, referredId, rewardCoins: REFERRAL_REWARD });
  res.json({ ok: true, referrerReward: REFERRAL_REWARD, referredBonus: REFERRAL_BONUS });
});

// ─── GET /social/trades ───────────────────────────────────────────────────────
router.get("/trades", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const rows = await db
    .select()
    .from(tradeOffersTable)
    .where(or(eq(tradeOffersTable.senderId, me), eq(tradeOffersTable.receiverId, me)));

  const counterpartIds = [...new Set(rows.map((r) => (r.senderId === me ? r.receiverId : r.senderId)))];
  const profiles: Record<string, { level: number; username?: string; firstName?: string }> = {};
  if (counterpartIds.length > 0) {
    const farmRows = await db
      .select({
        telegramId: farmStateTable.telegramId,
        level: farmStateTable.level,
        username: farmStateTable.username,
        firstName: farmStateTable.firstName,
      })
      .from(farmStateTable)
      .where(inArray(farmStateTable.telegramId, counterpartIds));
    for (const f of farmRows) profiles[f.telegramId] = {
      level: f.level,
      username: f.username ?? undefined,
      firstName: f.firstName ?? undefined,
    };
  }

  const trades = rows.map((r) => ({
    ...r,
    direction: r.senderId === me ? "outgoing" : "incoming",
    counterpartId: r.senderId === me ? r.receiverId : r.senderId,
    counterpartProfile: profiles[r.senderId === me ? r.receiverId : r.senderId] ?? null,
  }));

  res.json({ trades });
});

// ─── POST /social/trades ──────────────────────────────────────────────────────
router.post("/trades", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { receiverId, senderItems, receiverItems, message } = req.body as {
    receiverId: string;
    senderItems: TradeItem[];
    receiverItems: TradeItem[];
    message?: string;
  };

  if (!receiverId || !senderItems || !receiverItems) return res.status(400).json({ error: "Missing fields" });
  if (receiverId === me) return res.status(400).json({ error: "Нельзя торговать с собой" });

  const friendship = await db.select().from(friendshipsTable).where(
    and(
      or(
        and(eq(friendshipsTable.userId, me), eq(friendshipsTable.friendId, receiverId)),
        and(eq(friendshipsTable.userId, receiverId), eq(friendshipsTable.friendId, me))
      ),
      eq(friendshipsTable.status, "accepted")
    )
  );
  if (!friendship.length) return res.status(403).json({ error: "Можно торговать только с друзьями" });

  const [myFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!myFarm) return res.status(404).json({ error: "Ферма не найдена" });

  for (const item of senderItems) {
    if (item.type === "coins") {
      if (myFarm.coins < item.quantity) return res.status(400).json({ error: `Недостаточно монет (нужно ${item.quantity})` });
    } else if (item.type === "crop") {
      const inv = myFarm.inventory as Record<string, number>;
      if ((inv[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `Недостаточно ${item.id} (нужно ${item.quantity})` });
    } else if (item.type === "product") {
      const prod = myFarm.products as Record<string, number>;
      if ((prod[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `Недостаточно ${item.id} (нужно ${item.quantity})` });
    }
  }

  const [offer] = await db.insert(tradeOffersTable).values({
    senderId: me,
    receiverId,
    senderItems,
    receiverItems,
    message: message ?? null,
    status: "pending",
  }).returning();

  res.json({ ok: true, trade: offer });
});

// ─── POST /social/trades/:id/respond ─────────────────────────────────────────
router.post("/trades/:id/respond", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });
  const id = parseInt(req.params.id);
  const { action } = req.body as { action: "accept" | "decline" };

  const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, id));
  if (!trade) return res.status(404).json({ error: "Сделка не найдена" });
  if (trade.receiverId !== me) return res.status(403).json({ error: "Не ваша сделка" });
  if (trade.status !== "pending") return res.status(400).json({ error: "Сделка уже закрыта" });

  if (action === "decline") {
    await db.update(tradeOffersTable).set({ status: "declined", updatedAt: new Date() }).where(eq(tradeOffersTable.id, id));
    return res.json({ ok: true, status: "declined" });
  }

  const [myFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  const [theirFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, trade.senderId));
  if (!myFarm || !theirFarm) return res.status(404).json({ error: "Ферма не найдена" });

  const myInv = { ...(myFarm.inventory as Record<string, number>) };
  const myProd = { ...(myFarm.products as Record<string, number>) };
  let myCoins = myFarm.coins;

  const theirInv = { ...(theirFarm.inventory as Record<string, number>) };
  const theirProd = { ...(theirFarm.products as Record<string, number>) };
  let theirCoins = theirFarm.coins;

  const senderItems = trade.senderItems as TradeItem[];
  const receiverItems = trade.receiverItems as TradeItem[];

  for (const item of senderItems) {
    if (item.type === "coins" && theirCoins < item.quantity) return res.status(400).json({ error: "У отправителя не хватает монет" });
    if (item.type === "crop" && (theirInv[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `У отправителя не хватает ${item.id}` });
    if (item.type === "product" && (theirProd[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `У отправителя не хватает ${item.id}` });
  }
  for (const item of receiverItems) {
    if (item.type === "coins" && myCoins < item.quantity) return res.status(400).json({ error: "У вас не хватает монет" });
    if (item.type === "crop" && (myInv[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `У вас не хватает ${item.id}` });
    if (item.type === "product" && (myProd[item.id] ?? 0) < item.quantity) return res.status(400).json({ error: `У вас не хватает ${item.id}` });
  }

  for (const item of senderItems) {
    if (item.type === "coins") { theirCoins -= item.quantity; myCoins += item.quantity; }
    else if (item.type === "crop") {
      theirInv[item.id] = (theirInv[item.id] ?? 0) - item.quantity;
      myInv[item.id] = (myInv[item.id] ?? 0) + item.quantity;
    } else if (item.type === "product") {
      theirProd[item.id] = (theirProd[item.id] ?? 0) - item.quantity;
      myProd[item.id] = (myProd[item.id] ?? 0) + item.quantity;
    }
  }
  for (const item of receiverItems) {
    if (item.type === "coins") { myCoins -= item.quantity; theirCoins += item.quantity; }
    else if (item.type === "crop") {
      myInv[item.id] = (myInv[item.id] ?? 0) - item.quantity;
      theirInv[item.id] = (theirInv[item.id] ?? 0) + item.quantity;
    } else if (item.type === "product") {
      myProd[item.id] = (myProd[item.id] ?? 0) - item.quantity;
      theirProd[item.id] = (theirProd[item.id] ?? 0) + item.quantity;
    }
  }

  await Promise.all([
    db.update(farmStateTable).set({ coins: myCoins, inventory: myInv, products: myProd }).where(eq(farmStateTable.telegramId, me)),
    db.update(farmStateTable).set({ coins: theirCoins, inventory: theirInv, products: theirProd }).where(eq(farmStateTable.telegramId, trade.senderId)),
    db.update(tradeOffersTable).set({ status: "accepted", updatedAt: new Date() }).where(eq(tradeOffersTable.id, id)),
  ]);

  res.json({ ok: true, status: "accepted" });
});

// ─── DELETE /social/trades/:id ────────────────────────────────────────────────
router.delete("/trades/:id", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });
  const id = parseInt(req.params.id);

  const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, id));
  if (!trade) return res.status(404).json({ error: "Не найдено" });
  if (trade.senderId !== me) return res.status(403).json({ error: "Нет доступа" });
  if (trade.status !== "pending") return res.status(400).json({ error: "Нельзя отменить" });

  await db.update(tradeOffersTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(tradeOffersTable.id, id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /social/profile/:telegramId ─────────────────────────────────────────
router.get("/profile/:telegramId", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const targetId = req.params.telegramId;

  // Allow viewing own profile or any friend's profile
  let isFriend = targetId === me;
  if (!isFriend) {
    const fs = await db.select().from(friendshipsTable).where(
      and(
        or(
          and(eq(friendshipsTable.userId, me), eq(friendshipsTable.friendId, targetId)),
          and(eq(friendshipsTable.userId, targetId), eq(friendshipsTable.friendId, me)),
        ),
        eq(friendshipsTable.status, "accepted"),
      )
    );
    isFriend = fs.length > 0;
  }
  if (!isFriend) return res.status(403).json({ error: "Профиль доступен только друзьям" });

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, targetId));
  if (!farm) return res.status(404).json({ error: "Игрок не найден" });

  // Compute derived stats
  const plots = (farm.plots as any[]) ?? [];
  const animals = (farm.animals as any[]) ?? [];
  const buildings = (farm.buildings as any[]) ?? [];
  const quests = (farm.quests as any[]) ?? [];
  const seeds = (farm.seeds as Record<string, number>) ?? {};
  const products = (farm.products as Record<string, number>) ?? {};
  const worlds = (farm.worldsData as any) ?? {};

  const completedQuests = quests.filter((q: any) => q.claimed).length;
  const totalSeeds = Object.values(seeds).reduce((s: number, v: any) => s + (v || 0), 0);
  const totalProducts = Object.values(products).reduce((s: number, v: any) => s + (v || 0), 0);
  const unlockedWorlds = Object.keys(worlds).length;

  // Compute leaderboard rank
  const rankRow = await db.select({ cnt: sql<number>`count(*)` }).from(farmStateTable)
    .where(sql`(${farmStateTable.level} > ${farm.level}) OR (${farmStateTable.level} = ${farm.level} AND ${farmStateTable.xp} > ${farm.xp})`);
  const rank = Number(rankRow[0]?.cnt ?? 0) + 1;

  res.json({
    telegramId: farm.telegramId,
    username: farm.username,
    firstName: farm.firstName,
    level: farm.level,
    xp: farm.xp,
    coins: farm.coins,
    gems: farm.gems,
    plotCount: plots.length,
    animalCount: animals.length,
    buildingCount: buildings.length,
    completedQuests,
    totalQuests: quests.length,
    totalSeeds,
    totalProducts,
    unlockedWorlds,
    rank,
    season: farm.season,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /social/leaderboard ──────────────────────────────────────────────────
router.get("/leaderboard", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const rows = await db
    .select({
      telegramId: farmStateTable.telegramId,
      username: farmStateTable.username,
      firstName: farmStateTable.firstName,
      level: farmStateTable.level,
      xp: farmStateTable.xp,
      coins: farmStateTable.coins,
    })
    .from(farmStateTable)
    .orderBy(desc(farmStateTable.level), desc(farmStateTable.xp))
    .limit(50);

  const myIdx = rows.findIndex((r) => r.telegramId === me);
  res.json({ leaderboard: rows, myRank: myIdx >= 0 ? myIdx + 1 : null });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY GIFTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /social/gifts ────────────────────────────────────────────────────────
router.get("/gifts", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const today = todayKey();

  const [incoming, sentToday] = await Promise.all([
    db.select().from(dailyGiftsTable)
      .where(and(eq(dailyGiftsTable.receiverId, me), eq(dailyGiftsTable.claimed, 0))),
    db.select({ receiverId: dailyGiftsTable.receiverId })
      .from(dailyGiftsTable)
      .where(and(eq(dailyGiftsTable.senderId, me), eq(dailyGiftsTable.dayKey, today))),
  ]);

  const sentToFriendIds = sentToday.map((g) => g.receiverId);

  const enriched = await Promise.all(incoming.map(async (g) => {
    const [sender] = await db.select({ username: farmStateTable.username, firstName: farmStateTable.firstName, level: farmStateTable.level })
      .from(farmStateTable).where(eq(farmStateTable.telegramId, g.senderId));
    return { ...g, senderProfile: sender ?? null };
  }));

  res.json({ incoming: enriched, sentToFriendIds });
});

// ─── POST /social/gifts/send ──────────────────────────────────────────────────
router.post("/gifts/send", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { receiverId, coins } = req.body as { receiverId: string; coins?: number };
  if (!receiverId) return res.status(400).json({ error: "receiverId обязателен" });
  if (receiverId === me) return res.status(400).json({ error: "Нельзя отправить самому себе" });

  const giftCoins = Math.round(Number(coins ?? 100));
  if (!giftCoins || giftCoins < 1 || giftCoins > 500) {
    return res.status(400).json({ error: "Сумма должна быть от 1 до 500 монет" });
  }

  const today = todayKey();

  const friendship = await db.select().from(friendshipsTable)
    .where(and(
      or(
        and(eq(friendshipsTable.userId, me), eq(friendshipsTable.friendId, receiverId)),
        and(eq(friendshipsTable.userId, receiverId), eq(friendshipsTable.friendId, me)),
      ),
      eq(friendshipsTable.status, "accepted"),
    ));
  if (friendship.length === 0) return res.status(403).json({ error: "Вы не друзья" });

  const existing = await db.select().from(dailyGiftsTable)
    .where(and(
      eq(dailyGiftsTable.senderId, me),
      eq(dailyGiftsTable.receiverId, receiverId),
      eq(dailyGiftsTable.dayKey, today),
    ));
  if (existing.length > 0) return res.status(400).json({ error: "Вы уже отправили подарок сегодня" });

  // Check & deduct coins from sender immediately
  const [senderFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!senderFarm) return res.status(404).json({ error: "Ферма не найдена" });
  if (senderFarm.coins < giftCoins) return res.status(400).json({ error: "Недостаточно монет" });

  await db.update(farmStateTable).set({ coins: senderFarm.coins - giftCoins }).where(eq(farmStateTable.telegramId, me));

  const [gift] = await db.insert(dailyGiftsTable).values({
    senderId: me,
    receiverId,
    dayKey: today,
    giftCoins,
  }).returning();

  res.json({ ok: true, gift });
});

// ─── POST /social/gifts/:id/claim ────────────────────────────────────────────
router.post("/gifts/:id/claim", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });
  const id = parseInt(req.params.id);

  const [gift] = await db.select().from(dailyGiftsTable).where(eq(dailyGiftsTable.id, id));
  if (!gift) return res.status(404).json({ error: "Подарок не найден" });
  if (gift.receiverId !== me) return res.status(403).json({ error: "Не ваш подарок" });
  if (gift.claimed) return res.status(400).json({ error: "Уже забран" });

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  // Coins gift
  if (gift.giftCoins > 0) {
    await Promise.all([
      db.update(farmStateTable).set({ coins: farm.coins + gift.giftCoins }).where(eq(farmStateTable.telegramId, me)),
      db.update(dailyGiftsTable).set({ claimed: 1, claimedAt: new Date() }).where(eq(dailyGiftsTable.id, id)),
    ]);
    return res.json({ ok: true, coins: gift.giftCoins });
  }

  // Legacy seed gift
  const seeds = { ...(farm.seeds as Record<string, number>) };
  if (gift.giftCropId) seeds[gift.giftCropId] = (seeds[gift.giftCropId] ?? 0) + gift.giftQty;

  await Promise.all([
    db.update(farmStateTable).set({ seeds }).where(eq(farmStateTable.telegramId, me)),
    db.update(dailyGiftsTable).set({ claimed: 1, claimedAt: new Date() }).where(eq(dailyGiftsTable.id, id)),
  ]);

  res.json({ ok: true, cropId: gift.giftCropId, qty: gift.giftQty });
});

export default router;
