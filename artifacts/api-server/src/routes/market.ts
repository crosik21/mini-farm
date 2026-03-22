import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { farmStateTable, marketListingsTable } from "@workspace/db";
import { eq, and, inArray, sql, desc, lt } from "drizzle-orm";
import { FISH_META } from "./fishing";

const router: IRouter = Router();

function getTelegramId(req: any): string | null {
  return req.headers["x-telegram-id"] as string || null;
}

const LISTING_DURATION_H = 24;
const MAX_ACTIVE_LISTINGS = 5;

async function expireOldListings() {
  await db
    .update(marketListingsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(marketListingsTable.status, "active"),
        lt(marketListingsTable.expiresAt, new Date()),
      )
    );
}

function getItemInventory(farm: any, itemType: string, itemId: string): number {
  if (itemType === "crop") return (farm.inventory as Record<string, number>)?.[itemId] ?? 0;
  if (itemType === "product") return (farm.products as Record<string, number>)?.[itemId] ?? 0;
  if (itemType === "fish") return (farm.fishInventory as Record<string, number>)?.[itemId] ?? 0;
  return 0;
}

function deductItemInventory(farm: any, itemType: string, itemId: string, qty: number) {
  if (itemType === "crop") {
    const inv = { ...(farm.inventory as Record<string, number>) };
    inv[itemId] = (inv[itemId] ?? 0) - qty;
    return { inventory: inv };
  }
  if (itemType === "product") {
    const prod = { ...(farm.products as Record<string, number>) };
    prod[itemId] = (prod[itemId] ?? 0) - qty;
    return { products: prod };
  }
  if (itemType === "fish") {
    const fish = { ...(farm.fishInventory as Record<string, number> ?? {}) };
    fish[itemId] = (fish[itemId] ?? 0) - qty;
    return { fishInventory: fish };
  }
  return {};
}

function addItemInventory(farm: any, itemType: string, itemId: string, qty: number) {
  if (itemType === "crop") {
    const inv = { ...(farm.inventory as Record<string, number>) };
    inv[itemId] = (inv[itemId] ?? 0) + qty;
    return { inventory: inv };
  }
  if (itemType === "product") {
    const prod = { ...(farm.products as Record<string, number>) };
    prod[itemId] = (prod[itemId] ?? 0) + qty;
    return { products: prod };
  }
  if (itemType === "fish") {
    const fish = { ...(farm.fishInventory as Record<string, number> ?? {}) };
    fish[itemId] = (fish[itemId] ?? 0) + qty;
    return { fishInventory: fish };
  }
  return {};
}

// GET /api/market/listings?itemType=&page=
router.get("/listings", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  await expireOldListings();

  const { itemType, page = "1" } = req.query as { itemType?: string; page?: string };
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 20;
  const offset = (pageNum - 1) * pageSize;

  let query = db
    .select()
    .from(marketListingsTable)
    .where(eq(marketListingsTable.status, "active"))
    .orderBy(desc(marketListingsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  const listings = await query;

  // Enrich with seller name
  const sellerIds = [...new Set(listings.map(l => l.sellerId))];
  const sellers: Record<string, { username?: string | null; firstName?: string | null }> = {};
  if (sellerIds.length > 0) {
    const rows = await db
      .select({ telegramId: farmStateTable.telegramId, username: farmStateTable.username, firstName: farmStateTable.firstName })
      .from(farmStateTable)
      .where(inArray(farmStateTable.telegramId, sellerIds));
    for (const r of rows) sellers[r.telegramId] = { username: r.username, firstName: r.firstName };
  }

  const enriched = listings
    .filter(l => itemType ? l.itemType === itemType : true)
    .map(l => ({
      ...l,
      sellerName: sellers[l.sellerId]?.username
        ? `@${sellers[l.sellerId]?.username}`
        : sellers[l.sellerId]?.firstName ?? "Игрок",
      isOwn: l.sellerId === me,
    }));

  res.json({ listings: enriched, page: pageNum, pageSize, fishMeta: FISH_META });
});

// GET /api/market/my-listings
router.get("/my-listings", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  await expireOldListings();

  const listings = await db
    .select()
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.sellerId, me), eq(marketListingsTable.status, "active")))
    .orderBy(desc(marketListingsTable.createdAt));

  res.json({ listings, fishMeta: FISH_META });
});

// POST /api/market/listings — create listing
router.post("/listings", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const { itemType, itemId, quantity, pricePerUnit } = req.body as {
    itemType: string;
    itemId: string;
    quantity: number;
    pricePerUnit: number;
  };

  if (!itemType || !itemId || !quantity || !pricePerUnit) {
    return res.status(400).json({ error: "Заполните все поля" });
  }
  if (!["crop", "product", "fish"].includes(itemType)) {
    return res.status(400).json({ error: "Недопустимый тип товара" });
  }
  if (quantity < 1 || pricePerUnit < 1) {
    return res.status(400).json({ error: "Количество и цена должны быть > 0" });
  }

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  // Check active listings count
  const [countRow] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(marketListingsTable)
    .where(and(eq(marketListingsTable.sellerId, me), eq(marketListingsTable.status, "active")));
  if (Number(countRow.cnt) >= MAX_ACTIVE_LISTINGS) {
    return res.status(400).json({ error: `Максимум ${MAX_ACTIVE_LISTINGS} активных лотов` });
  }

  const have = getItemInventory(farm, itemType, itemId);
  if (have < quantity) {
    return res.status(400).json({ error: `Недостаточно ${itemId} (есть: ${have})` });
  }

  const deducted = deductItemInventory(farm, itemType, itemId, quantity);
  await db.update(farmStateTable).set({ ...deducted, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me));

  const expiresAt = new Date(Date.now() + LISTING_DURATION_H * 3600 * 1000);
  const [listing] = await db.insert(marketListingsTable).values({
    sellerId: me,
    itemType,
    itemId,
    quantity,
    pricePerUnit,
    status: "active",
    expiresAt,
  }).returning();

  res.json({ ok: true, listing });
});

// POST /api/market/listings/:id/buy
router.post("/listings/:id/buy", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);
  const { quantity } = req.body as { quantity?: number };

  const [listing] = await db.select().from(marketListingsTable).where(eq(marketListingsTable.id, id));
  if (!listing) return res.status(404).json({ error: "Лот не найден" });
  if (listing.status !== "active") return res.status(400).json({ error: "Лот недоступен" });
  if (listing.sellerId === me) return res.status(400).json({ error: "Нельзя покупать собственный лот" });
  if (new Date() > new Date(listing.expiresAt)) return res.status(400).json({ error: "Лот истёк" });

  const buyQty = quantity && quantity > 0 && quantity <= listing.quantity ? quantity : listing.quantity;
  const totalCost = buyQty * listing.pricePerUnit;

  const [buyerFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!buyerFarm) return res.status(404).json({ error: "Ферма не найдена" });
  if (buyerFarm.coins < totalCost) return res.status(400).json({ error: `Недостаточно монет (нужно ${totalCost})` });

  const [sellerFarm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, listing.sellerId));
  if (!sellerFarm) return res.status(404).json({ error: "Продавец не найден" });

  const buyerUpdate = addItemInventory(buyerFarm, listing.itemType, listing.itemId, buyQty);
  const sellerCoinsGain = totalCost;

  const newQty = listing.quantity - buyQty;
  const newStatus = newQty <= 0 ? "sold" : "active";

  await Promise.all([
    db.update(farmStateTable)
      .set({ ...buyerUpdate, coins: buyerFarm.coins - totalCost, updatedAt: new Date() })
      .where(eq(farmStateTable.telegramId, me)),
    db.update(farmStateTable)
      .set({ coins: sellerFarm.coins + sellerCoinsGain, updatedAt: new Date() })
      .where(eq(farmStateTable.telegramId, listing.sellerId)),
    db.update(marketListingsTable)
      .set({ quantity: newQty, status: newStatus })
      .where(eq(marketListingsTable.id, id)),
  ]);

  res.json({ ok: true, bought: buyQty, totalCost, newInventory: buyerUpdate });
});

// DELETE /api/market/listings/:id — cancel own listing
router.delete("/listings/:id", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);
  const [listing] = await db.select().from(marketListingsTable).where(eq(marketListingsTable.id, id));
  if (!listing) return res.status(404).json({ error: "Лот не найден" });
  if (listing.sellerId !== me) return res.status(403).json({ error: "Нет доступа" });
  if (listing.status !== "active") return res.status(400).json({ error: "Лот уже закрыт" });

  const [farm] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, me));
  if (!farm) return res.status(404).json({ error: "Ферма не найдена" });

  const restored = addItemInventory(farm, listing.itemType, listing.itemId, listing.quantity);

  await Promise.all([
    db.update(marketListingsTable).set({ status: "cancelled" }).where(eq(marketListingsTable.id, id)),
    db.update(farmStateTable).set({ ...restored, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me)),
  ]);

  res.json({ ok: true });
});

export default router;
