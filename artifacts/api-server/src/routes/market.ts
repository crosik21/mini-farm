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

type OkResult<T> = { ok: true } & T;
type ErrResult = { ok: false; status: number; error: string };
type TxResult<T> = OkResult<T> | ErrResult;

function errResult(error: string, status = 400): ErrResult {
  return { ok: false, status, error };
}

/**
 * Expire old listings and return unsold items to sellers.
 *
 * Concurrency-safe approach:
 * 1. SELECT expired active listings (no lock — just a snapshot).
 * 2. Per seller, open a TX and immediately UPDATE listings WHERE id IN (...) AND status='active'
 *    returning the rows that were actually transitioned.
 * 3. Only restore inventory for rows returned from step 2 (prevents double-credit
 *    from a concurrent cancel that already processed a listing before us).
 */
async function expireOldListings() {
  const candidates = await db
    .select()
    .from(marketListingsTable)
    .where(
      and(
        eq(marketListingsTable.status, "active"),
        lt(marketListingsTable.expiresAt, new Date()),
      )
    );

  if (candidates.length === 0) return;

  const bySeller: Record<string, typeof candidates> = {};
  for (const l of candidates) {
    if (!bySeller[l.sellerId]) bySeller[l.sellerId] = [];
    bySeller[l.sellerId].push(l);
  }

  for (const [sellerId, listings] of Object.entries(bySeller)) {
    const ids = listings.map((l) => l.id);

    await db.transaction(async (tx) => {
      // Atomically cancel only rows still active — returns actually-transitioned rows.
      const transitioned = await tx
        .update(marketListingsTable)
        .set({ status: "cancelled" })
        .where(
          and(
            inArray(marketListingsTable.id, ids),
            eq(marketListingsTable.status, "active"),
          )
        )
        .returning();

      if (transitioned.length === 0) return; // Nothing to restore

      const [farm] = await tx
        .select()
        .from(farmStateTable)
        .where(eq(farmStateTable.telegramId, sellerId))
        .for("update");

      if (!farm) return;

      const inv = { ...(farm.inventory as Record<string, number>) };
      const prod = { ...(farm.products as Record<string, number>) };
      const fish = { ...(farm.fishInventory as Record<string, number> ?? {}) };

      for (const l of transitioned) {
        if (l.itemType === "crop") {
          inv[l.itemId] = (inv[l.itemId] ?? 0) + l.quantity;
        } else if (l.itemType === "product") {
          prod[l.itemId] = (prod[l.itemId] ?? 0) + l.quantity;
        } else if (l.itemType === "fish") {
          fish[l.itemId] = (fish[l.itemId] ?? 0) + l.quantity;
        }
      }

      await tx
        .update(farmStateTable)
        .set({ inventory: inv, products: prod, fishInventory: fish, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, sellerId));
    });
  }
}

function getItemInventory(farm: { inventory: unknown; products: unknown; fishInventory: unknown }, itemType: string, itemId: string): number {
  if (itemType === "crop") return (farm.inventory as Record<string, number>)?.[itemId] ?? 0;
  if (itemType === "product") return (farm.products as Record<string, number>)?.[itemId] ?? 0;
  if (itemType === "fish") return (farm.fishInventory as Record<string, number>)?.[itemId] ?? 0;
  return 0;
}

function deductItemInventory(
  farm: { inventory: unknown; products: unknown; fishInventory: unknown },
  itemType: string,
  itemId: string,
  qty: number,
): Partial<{ inventory: Record<string, number>; products: Record<string, number>; fishInventory: Record<string, number> }> {
  if (itemType === "crop") {
    const inv = { ...(farm.inventory as Record<string, number>) };
    inv[itemId] = (inv[itemId] ?? 0) - qty;
    return { inventory: inv };
  }
  if (itemType === "product") {
    const p = { ...(farm.products as Record<string, number>) };
    p[itemId] = (p[itemId] ?? 0) - qty;
    return { products: p };
  }
  if (itemType === "fish") {
    const f = { ...(farm.fishInventory as Record<string, number> ?? {}) };
    f[itemId] = (f[itemId] ?? 0) - qty;
    return { fishInventory: f };
  }
  return {};
}

function addItemInventory(
  farm: { inventory: unknown; products: unknown; fishInventory: unknown },
  itemType: string,
  itemId: string,
  qty: number,
): Partial<{ inventory: Record<string, number>; products: Record<string, number>; fishInventory: Record<string, number> }> {
  if (itemType === "crop") {
    const inv = { ...(farm.inventory as Record<string, number>) };
    inv[itemId] = (inv[itemId] ?? 0) + qty;
    return { inventory: inv };
  }
  if (itemType === "product") {
    const p = { ...(farm.products as Record<string, number>) };
    p[itemId] = (p[itemId] ?? 0) + qty;
    return { products: p };
  }
  if (itemType === "fish") {
    const f = { ...(farm.fishInventory as Record<string, number> ?? {}) };
    f[itemId] = (f[itemId] ?? 0) + qty;
    return { fishInventory: f };
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

  type CreateResult = TxResult<{ listing: typeof marketListingsTable.$inferSelect }>;

  const result: CreateResult = await db.transaction(async (tx): Promise<CreateResult> => {
    const [farm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!farm) return errResult("Ферма не найдена", 404);

    const [countRow] = await tx
      .select({ cnt: sql<number>`count(*)` })
      .from(marketListingsTable)
      .where(and(eq(marketListingsTable.sellerId, me), eq(marketListingsTable.status, "active")));
    if (Number(countRow.cnt) >= MAX_ACTIVE_LISTINGS) {
      return errResult(`Максимум ${MAX_ACTIVE_LISTINGS} активных лотов`);
    }

    const have = getItemInventory(farm, itemType, itemId);
    if (have < quantity) {
      return errResult(`Недостаточно ${itemId} (есть: ${have})`);
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

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, listing: result.listing });
});

// POST /api/market/listings/:id/buy
router.post("/listings/:id/buy", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);
  const { quantity } = req.body as { quantity?: number };

  type BuyResult = TxResult<{
    bought: number;
    totalCost: number;
    newInventory: Partial<{ inventory: Record<string, number>; products: Record<string, number>; fishInventory: Record<string, number> }>;
  }>;

  const result: BuyResult = await db.transaction(async (tx): Promise<BuyResult> => {
    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, id))
      .for("update");

    if (!listing) return errResult("Лот не найден", 404);
    if (listing.status !== "active") return errResult("Лот недоступен");
    if (listing.sellerId === me) return errResult("Нельзя покупать собственный лот");
    if (new Date() > new Date(listing.expiresAt)) return errResult("Лот истёк");

    const buyQty = quantity && quantity > 0 && quantity <= listing.quantity ? quantity : listing.quantity;
    const totalCost = buyQty * listing.pricePerUnit;

    const [buyerFarm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!buyerFarm) return errResult("Ферма не найдена", 404);
    if (buyerFarm.coins < totalCost) return errResult(`Недостаточно монет (нужно ${totalCost})`);

    const [sellerFarm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, listing.sellerId))
      .for("update");
    if (!sellerFarm) return errResult("Продавец не найден", 404);

    const buyerInventoryUpdate = addItemInventory(buyerFarm, listing.itemType, listing.itemId, buyQty);

    const newQty = listing.quantity - buyQty;
    const newStatus = newQty <= 0 ? "sold" : "active";

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

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, bought: result.bought, totalCost: result.totalCost, newInventory: result.newInventory });
});

// DELETE /api/market/listings/:id — cancel own listing
router.delete("/listings/:id", async (req, res) => {
  const me = getTelegramId(req);
  if (!me) return res.status(401).json({ error: "No telegram id" });

  const id = parseInt(req.params.id);

  type CancelResult = TxResult<Record<never, never>>;

  const result: CancelResult = await db.transaction(async (tx): Promise<CancelResult> => {
    const [listing] = await tx
      .select()
      .from(marketListingsTable)
      .where(eq(marketListingsTable.id, id))
      .for("update");

    if (!listing) return errResult("Лот не найден", 404);
    if (listing.sellerId !== me) return errResult("Нет доступа", 403);
    if (listing.status !== "active") return errResult("Лот уже закрыт");

    const [farm] = await tx
      .select()
      .from(farmStateTable)
      .where(eq(farmStateTable.telegramId, me))
      .for("update");
    if (!farm) return errResult("Ферма не найдена", 404);

    const restored = addItemInventory(farm, listing.itemType, listing.itemId, listing.quantity);

    await tx.update(marketListingsTable).set({ status: "cancelled" }).where(eq(marketListingsTable.id, id));
    await tx.update(farmStateTable).set({ ...restored, updatedAt: new Date() }).where(eq(farmStateTable.telegramId, me));

    return { ok: true };
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

export default router;
