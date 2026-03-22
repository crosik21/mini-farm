import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { farmStateTable, fishingTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function getTelegramId(req: any): string | null {
  return req.headers["x-telegram-id"] as string || null;
}

const FISH_TYPES = [
  { id: "bass",           name: "Окунь",            emoji: "🐟", weight: 40, minWaitSec: 30,  maxWaitSec: 60  },
  { id: "carp",           name: "Карп",              emoji: "🐠", weight: 30, minWaitSec: 45,  maxWaitSec: 90  },
  { id: "pike",           name: "Щука",              emoji: "🐡", weight: 18, minWaitSec: 60,  maxWaitSec: 100 },
  { id: "salmon",         name: "Лосось",            emoji: "🐟", weight: 10, minWaitSec: 80,  maxWaitSec: 120 },
  { id: "legendary_fish", name: "Легендарная рыба",  emoji: "✨", weight: 2,  minWaitSec: 100, maxWaitSec: 120 },
];

const TOTAL_WEIGHT = FISH_TYPES.reduce((s, f) => s + f.weight, 0);

function pickFish(): typeof FISH_TYPES[number] {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const f of FISH_TYPES) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return FISH_TYPES[0];
}

export const FISH_META: Record<string, { name: string; emoji: string; sellPrice: number }> = {
  bass:           { name: "Окунь",           emoji: "🐟", sellPrice: 25  },
  carp:           { name: "Карп",            emoji: "🐠", sellPrice: 40  },
  pike:           { name: "Щука",            emoji: "🐡", sellPrice: 70  },
  salmon:         { name: "Лосось",          emoji: "🐟", sellPrice: 120 },
  legendary_fish: { name: "Легендарная рыба",emoji: "✨", sellPrice: 500 },
};

const FISHING_ENERGY_COST = 3;

// GET /api/fishing/status — current session for caller
router.get("/status", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const [session] = await db
    .select()
    .from(fishingTable)
    .where(and(eq(fishingTable.telegramId, me), eq(fishingTable.claimed, 0)))
    .orderBy(desc(fishingTable.id))
    .limit(1);

  res.json({ session: session ?? null, fishMeta: FISH_META });
});

// POST /api/fishing/start — cast rod (costs 3 energy)
router.post("/start", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  // Check for unclaimed session
  const [existing] = await db
    .select()
    .from(fishingTable)
    .where(and(eq(fishingTable.telegramId, me), eq(fishingTable.claimed, 0)))
    .limit(1);
  if (existing) return res.status(400).json({ error: "Удочка уже заброшена!" });

  if (farm.energy < FISHING_ENERGY_COST) {
    return res.status(400).json({ error: `Недостаточно энергии (нужно ${FISHING_ENERGY_COST})` });
  }

  const fish = pickFish();
  const waitSec = Math.floor(Math.random() * (fish.maxWaitSec - fish.minWaitSec + 1)) + fish.minWaitSec;
  const now = new Date();
  const catchAt = new Date(now.getTime() + waitSec * 1000);

  await db.update(farmStateTable)
    .set({ energy: farm.energy - FISHING_ENERGY_COST })
    .where(eq(farmStateTable.telegramId, me));

  const [session] = await db.insert(fishingTable).values({
    telegramId: me,
    baitUsedAt: now,
    catchAt,
    fishType: fish.id,
    claimed: 0,
  }).returning();

  res.json({ ok: true, session, waitSec, fishMeta: FISH_META });
});

// POST /api/fishing/collect — collect ready fish
router.post("/collect", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const [session] = await db
    .select()
    .from(fishingTable)
    .where(and(eq(fishingTable.telegramId, me), eq(fishingTable.claimed, 0)))
    .orderBy(desc(fishingTable.id))
    .limit(1);

  if (!session) return res.status(400).json({ error: "Нет активной рыбалки" });
  if (new Date() < new Date(session.catchAt)) {
    return res.status(400).json({ error: "Рыба ещё не поймана, подождите!" });
  }

  const fishType = session.fishType!;
  const fishMeta = FISH_META[fishType];

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  const fishInv = { ...(farm.fishInventory ?? {}) } as Record<string, number>;
  fishInv[fishType] = (fishInv[fishType] ?? 0) + 1;

  await Promise.all([
    db.update(fishingTable).set({ claimed: 1 }).where(eq(fishingTable.id, session.id)),
    db.update(farmStateTable).set({ fishInventory: fishInv, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me)),
  ]);

  const [updatedFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));

  res.json({ ok: true, fishType, fishMeta, fishInventory: fishInv });
});

// POST /api/fishing/sell — sell fish from inventory
router.post("/sell", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { fishType, quantity } = req.body as { fishType: string; quantity: number };
  if (!fishType || !quantity || quantity < 1) return res.status(400).json({ error: "Укажите тип и количество" });

  const meta = FISH_META[fishType];
  if (!meta) return res.status(400).json({ error: "Неизвестный тип рыбы" });

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  const fishInv = { ...(farm.fishInventory ?? {}) } as Record<string, number>;
  if ((fishInv[fishType] ?? 0) < quantity) return res.status(400).json({ error: "Недостаточно рыбы" });

  fishInv[fishType] -= quantity;
  const earned = meta.sellPrice * quantity;

  await db.update(farmStateTable)
    .set({ fishInventory: fishInv, coins: farm.coins + earned, updatedAt: new Date() })
    .where(eq(farmStateTable.telegramId, me));

  res.json({ ok: true, earned, fishInventory: fishInv, coins: farm.coins + earned });
});

export default router;
