import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { farmStateTable, marketListingsTable } from "@workspace/db";
import { eq, and, inArray, sql, desc, lt, gte, lte } from "drizzle-orm";
import { FISH_META } from "./fishing";

const router: IRouter = Router();

function getTelegramId(req: any): string | null {
  return req.headers["x-telegram-id"] as string || null;
}

const LISTING_DURATION_H = 24;
const MAX_ACTIVE_LISTINGS = 5;

/**
 * Expire old listings and return unsold items to sellers.
 * Must be called inside a transaction or standalone — here we run it standalone
 * before reads. Item return is done per-seller in a loop with per-row locking.
 */
async function expireOldListings() {
  // Find all expired active listings
  const expired = await db
    .select()
    .from(marketListingsTable)
    .where(
      and(
        eq(marketListingsTable.status, "active"),
        lt(marketListingsTable.expiresAt, new Date()),
      )
    );

  if (expired.length === 0) return;

  // Group by seller so we can batch the updates
  const bySeller: Record<string, typeof expired> = {};
  for (const l of expired) {
    if (!bySeller[l.sellerId]) bySeller[l.sellerId] = [];
    bySeller[l.sellerId].push(l);
  }

  // For each seller, fetch their farm and return items
  for (const [sellerId, listings] of Object.entries(bySeller)) {
    await db.transaction(async (tx) => {
      const [farm] = await tx
        .select()
        .from(farmStateTable)
        .where(eq(farmStateTable.telegramId, sellerId))
        .for("update");

      if (!farm) return;

      let update: Record<string, any> = {
        inventory: { ...(farm.inventory as Record<string, number>) },
        products: { ...(farm.products as Record<string, number>) },
        fishInventory: { ...(farm.fishInventory as Record<string, number> ?? {}) },
        updatedAt: new Date(),
      };

      for (const l of listings) {
        const qty = l.quantity;
        if (l.itemType === "crop") {
          (update.inventory as Record<string, number>)[l.itemId] =
            ((update.inventory as Record<string, number>)[l.itemId] ?? 0) + qty;
        } else if (l.itemType === "product") {
          (update.products as Record<string, number>)[l.itemId] =
            ((update.products as Record<string, number>)[l.itemId] ?? 0) + qty;
        } else if (l.itemType === "fish") {
          (update.fishInventory as Record<string, number>)[l.itemId] =
            ((update.fishInventory as Record<string, number>)[l.itemId] ?? 0) + qty;
        }
      }

      await tx
        .update(farmStateTable)
        .set(update)
        .where(eq(farmStateTable.telegramId, sellerId));

      // Mark all those listings as cancelled
      const ids = listings.map((l) => l.id);
      await tx
        .update(marketListingsTable)
        .set({ status: "cancelled" })
        .where(inArray(marketListingsTable.id, ids));
    });
  }
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

// GET /api/market/listings?itemType=&minPrice=&maxPrice=&page=
router.get("/listings", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  await expireOldListings();

  const { itemType, minPrice, maxPrice, page = "1" } = req.query as {
    itemType?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  };
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 20;
  const offset = (pageNum - 1) * pageSize;

  const conditions = [eq(marketListingsTable.status, "active")];
  if (itemType && ["crop", "product", "fish"].includes(itemType)) {
    conditions.push(eq(marketListingsTable.itemType, itemType));
  }
  if (minPrice) {
    const min = parseInt(minPrice);
    if (!isNaN(min)) conditions.push(gte(marketListingsTable.pricePerUnit, min));
  }
  if (maxPrice) {
    const max = parseInt(maxPrice);
    if (!isNaN(max)) conditions.push(lte(marketListingsTable.pricePerUnit, max));
  }

  const listings = await db
    .select()
    .from(marketListingsTable)
    .where(and(...conditions))
    .orderBy(desc(marketListingsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

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

  const enriched = listings.map(l => ({
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

  const result = await db.transaction(async (tx) => {
    const [farm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!farm) return { error: "Ферма не найдена", status: 404 };

    const [countRow] = await tx
      .select({ cnt: sql<number>`count(*)` })
      .from(marketListingsTable)
      .where(and(eq(marketListingsTable.sellerId, me), eq(marketListingsTable.status, "active")));
    if (Number(countRow.cnt) >= MAX_ACTIVE_LISTINGS) {
      return { error: `Максимум ${MAX_ACTIVE_LISTINGS} активных лотов`, status: 400 };
    }

    const have = getItemInventory(farm, itemType, itemId);
    if (have < quantity) {
      return { error: `Недостаточно ${itemId} (есть: ${have})`, status: 400 };
    }

    const deducted = deductItemInventory(farm, itemType, itemId, quantity);
    await tx.update(farmStateTable).set({ ...deducted, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me));

    const expiresAt = new Date(Date.now() + LISTING_DURATION_H * 3600 * 1000);
    const [listing] = await tx.insert(marketListingsTable).values({
      sellerId: me,
      itemType,
      itemId,
      quantity,
      pricePerUnit,
      status: "active",
      expiresAt,
    }).returning();

    return { ok: true, listing };
  });

  if ("error" in result) return res.status((result as any).status ?? 400).json({ error: (result as any).error });
  res.json(result);
});

// POST /api/market/listings/:id/buy
router.post("/listings/:id/buy", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);
  const { quantity } = req.body as { quantity?: number };

  const result = await db.transaction(async (tx) => {
    // Lock the listing row first
    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, id))
      .for("update");

    if (!listing) return { error: "Лот не найден", status: 404 };
    if (listing.status !== "active") return { error: "Лот недоступен", status: 400 };
    if (listing.sellerId === me) return { error: "Нельзя покупать собственный лот", status: 400 };
    if (new Date() > new Date(listing.expiresAt)) return { error: "Лот истёк", status: 400 };

    const buyQty = quantity && quantity > 0 && quantity <= listing.quantity ? quantity : listing.quantity;
    const totalCost = buyQty * listing.pricePerUnit;

    // Lock buyer and seller rows
    const [buyerFarm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!buyerFarm) return { error: "Ферма не найдена", status: 404 };
    if (buyerFarm.coins < totalCost) return { error: `Недостаточно монет (нужно ${totalCost})`, status: 400 };

    const [sellerFarm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, listing.sellerId))
      .for("update");
    if (!sellerFarm) return { error: "Продавец не найден", status: 404 };

    const buyerInventoryUpdate = addItemInventory(buyerFarm, listing.itemType, listing.itemId, buyQty);

    const newQty = listing.quantity - buyQty;
    const newStatus = newQty <= 0 ? "sold" : "active";

    // Update buyer, seller, and listing in the same transaction
    await tx
      .update(farmStateTable)
      .set({ ...buyerInventoryUpdate, coins: buyerFarm.coins - totalCost, updatedAt: new Date() })
      .where(eq(farmStateTable.telegramId, me));

    await tx
      .update(farmStateTable)
      .set({ coins: sellerFarm.coins + totalCost, updatedAt: new Date() })
      .where(eq(farmStateTable.telegramId, listing.sellerId));

    await tx
      .update(marketListingsTable)
      .set({ quantity: newQty, status: newStatus })
      .where(eq(marketListingsTable.id, id));

    return { ok: true, bought: buyQty, totalCost, newInventory: buyerInventoryUpdate };
  });

  if ("error" in result) return res.status((result as any).status ?? 400).json({ error: (result as any).error });
  res.json(result);
});

// DELETE /api/market/listings/:id — cancel own listing
router.delete("/listings/:id", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);

  const result = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, id))
      .for("update");

    if (!listing) return { error: "Лот не найден", status: 404 };
    if (listing.sellerId !== me) return { error: "Нет доступа", status: 403 };
    if (listing.status !== "active") return { error: "Лот уже закрыт", status: 400 };

    const [farm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!farm) return { error: "Ферма не найдена", status: 404 };

    const restored = addItemInventory(farm, listing.itemType, listing.itemId, listing.quantity);

    await tx.update(marketListingsTable).set({ status: "cancelled" }).where(eq(marketListingsTable.id, id));
    await tx.update(farmStateTable).set({ ...restored, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me));

    return { ok: true };
  });

  if ("error" in result) return res.status((result as any).status ?? 400).json({ error: (result as any).error });
  res.json(result);
});

export default router;
