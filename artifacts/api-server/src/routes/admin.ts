import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { farmStateTable, referralsTable, shopPurchasesTable, promocodesTable, promocodeUsesTable } from "@workspace/db";
import { eq, desc, sql, like, count } from "drizzle-orm";
import { getAdminConfig, saveAdminConfig, type AdminConfig, type ShopCropOverride, type ShopGlobalSettings, DEFAULT_SHOP_GLOBAL, type CustomCaseDef, type CustomCaseDrop, type SeasonalEventDef, type EventCropDef, type EventShopItem } from "../admin-config";
import { generateShopSlots, currentEpoch, SHOP_INTERVAL_MS } from "./farm";

const router: IRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "farm-admin-2024";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["x-admin-secret"] || req.query.secret;
  if (auth !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdmin);

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const rows = await db.select().from(farmStateTable);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const activeToday = rows.filter((r) => now - new Date(r.updatedAt).getTime() < oneDayMs).length;
    const totalCoins = rows.reduce((s, r) => s + r.coins, 0);
    const totalGems = rows.reduce((s, r) => s + r.gems, 0);
    const avgLevel = rows.length ? (rows.reduce((s, r) => s + r.level, 0) / rows.length).toFixed(1) : "0";

    const seasonCounts: Record<string, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    for (const r of rows) seasonCounts[r.season] = (seasonCounts[r.season] ?? 0) + 1;

    res.json({
      totalPlayers: rows.length,
      activeToday,
      totalCoins,
      totalGems,
      avgLevel,
      seasonCounts,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/players ────────────────────────────────────────────────────
router.get("/players", async (_req, res) => {
  try {
    const rows = await db
      .select({
        telegramId: farmStateTable.telegramId,
        username: farmStateTable.username,
        firstName: farmStateTable.firstName,
        coins: farmStateTable.coins,
        gems: farmStateTable.gems,
        level: farmStateTable.level,
        xp: farmStateTable.xp,
        energy: farmStateTable.energy,
        maxEnergy: farmStateTable.maxEnergy,
        season: farmStateTable.season,
        createdAt: farmStateTable.createdAt,
        updatedAt: farmStateTable.updatedAt,
      })
      .from(farmStateTable)
      .orderBy(desc(farmStateTable.createdAt));

    // Fetch referral info: who referred each player
    const referrals = await db.select().from(referralsTable);
    const referredByMap: Record<string, string> = {};
    for (const r of referrals) referredByMap[r.referredId] = r.referrerId;

    const enriched = rows.map((r, i) => ({
      ...r,
      rowNum: i + 1,
      referredBy: referredByMap[r.telegramId] ?? null,
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/players/:telegramId ────────────────────────────────────────
router.get("/players/:telegramId", async (req, res) => {
  try {
    const [row] = await db.select().from(farmStateTable).where(eq(farmStateTable.telegramId, req.params.telegramId));
    if (!row) return res.status(404).json({ error: "Игрок не найден" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── PATCH /api/admin/players/:telegramId ──────────────────────────────────────
router.patch("/players/:telegramId", async (req, res) => {
  try {
    const { coins, gems, level, xp, energy, maxEnergy, season } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (coins !== undefined) updates.coins = Math.max(0, Number(coins));
    if (gems !== undefined) updates.gems = Math.max(0, Number(gems));
    if (level !== undefined) updates.level = Math.max(1, Number(level));
    if (xp !== undefined) updates.xp = Math.max(0, Number(xp));
    if (energy !== undefined) updates.energy = Math.max(0, Number(energy));
    if (maxEnergy !== undefined) updates.maxEnergy = Math.max(1, Number(maxEnergy));
    if (season !== undefined && ["spring", "summer", "autumn", "winter"].includes(season)) {
      updates.season = season;
      updates.seasonUpdatedAt = new Date();
    }

    const [updated] = await db
      .update(farmStateTable)
      .set(updates)
      .where(eq(farmStateTable.telegramId, req.params.telegramId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Игрок не найден" });
    res.json({ ok: true, player: updated });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/players/:telegramId ─────────────────────────────────────
router.delete("/players/:telegramId", async (req, res) => {
  try {
    await db.delete(farmStateTable).where(eq(farmStateTable.telegramId, req.params.telegramId));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/season ────────────────────────────────────────────────────
router.post("/season", async (req, res) => {
  try {
    const { season } = req.body;
    if (!["spring", "summer", "autumn", "winter"].includes(season)) {
      return res.status(400).json({ error: "Неверный сезон" });
    }
    await db.update(farmStateTable).set({ season, seasonUpdatedAt: new Date(), updatedAt: new Date() });
    res.json({ ok: true, season });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/give-coins ────────────────────────────────────────────────
router.post("/give-coins", async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    if (telegramId) {
      await db
        .update(farmStateTable)
        .set({ coins: sql`${farmStateTable.coins} + ${Number(amount)}`, updatedAt: new Date() })
        .where(eq(farmStateTable.telegramId, telegramId));
      res.json({ ok: true, message: `Выдано ${amount} монет игроку ${telegramId}` });
    } else {
      await db
        .update(farmStateTable)
        .set({ coins: sql`${farmStateTable.coins} + ${Number(amount)}`, updatedAt: new Date() });
      res.json({ ok: true, message: `Выдано ${amount} монет всем игрокам` });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/content-config ─────────────────────────────────────────────
router.get("/content-config", (_req, res) => {
  try {
    res.json(getAdminConfig());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/content-config ────────────────────────────────────────────
router.post("/content-config", (req, res) => {
  try {
    const { npcTemplates, dailyQuestTemplates } = req.body as Partial<AdminConfig>;
    const current = getAdminConfig();
    const updated: AdminConfig = {
      ...current,
      npcTemplates: Array.isArray(npcTemplates) ? npcTemplates : current.npcTemplates,
      dailyQuestTemplates: Array.isArray(dailyQuestTemplates) ? dailyQuestTemplates : current.dailyQuestTemplates,
    };
    saveAdminConfig(updated);
    res.json({ ok: true, config: updated });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/crops-config ───────────────────────────────────────────────
const ADMIN_BASE_CROPS: Record<string, { seedCost: number; sellPrice: number; growSec: number; xp: number; energyCost: number; unlockLevel: number; emoji: string; name: string; description: string; world?: string }> = {
  wheat:        { seedCost: 5,   sellPrice: 8,   growSec: 30,   xp: 5,   energyCost: 2, unlockLevel: 1, emoji: "🌾", name: "Пшеница",        description: "Быстро растёт, идеально для начала." },
  carrot:       { seedCost: 10,  sellPrice: 16,  growSec: 60,   xp: 10,  energyCost: 2, unlockLevel: 1, emoji: "🥕", name: "Морковь",         description: "Хрустящая и прибыльная." },
  tomato:       { seedCost: 20,  sellPrice: 35,  growSec: 120,  xp: 15,  energyCost: 2, unlockLevel: 2, emoji: "🍅", name: "Помидор",         description: "Сочный и выгодный." },
  corn:         { seedCost: 35,  sellPrice: 80,  growSec: 300,  xp: 25,  energyCost: 3, unlockLevel: 3, emoji: "🌽", name: "Кукуруза",        description: "Золото полей." },
  strawberry:   { seedCost: 60,  sellPrice: 180, growSec: 600,  xp: 40,  energyCost: 3, unlockLevel: 4, emoji: "🍓", name: "Клубника",        description: "Сладкий и дорогой ягодный." },
  sunflower:    { seedCost: 80,  sellPrice: 220, growSec: 900,  xp: 50,  energyCost: 3, unlockLevel: 5, emoji: "🌻", name: "Подсолнух",       description: "Яркий символ лета." },
  pumpkin:      { seedCost: 150, sellPrice: 500, growSec: 1800, xp: 80,  energyCost: 4, unlockLevel: 7, emoji: "🎃", name: "Тыква",           description: "Осенняя королева." },
  blueberry:    { seedCost: 25,  sellPrice: 65,  growSec: 180,  xp: 20,  energyCost: 2, unlockLevel: 1, emoji: "🫐", name: "Голубика",        description: "Лесная ягода, растёт быстро.", world: "forest" },
  mushroom:     { seedCost: 70,  sellPrice: 185, growSec: 500,  xp: 45,  energyCost: 3, unlockLevel: 1, emoji: "🍄", name: "Гриб",            description: "Дикий гриб, редкий и ценный.", world: "forest" },
  cactus_fruit: { seedCost: 110, sellPrice: 330, growSec: 1200, xp: 60,  energyCost: 3, unlockLevel: 1, emoji: "🌵", name: "Плод кактуса",   description: "Медленно, но очень выгодно.", world: "desert" },
  dates:        { seedCost: 190, sellPrice: 680, growSec: 2400, xp: 100, energyCost: 4, unlockLevel: 1, emoji: "🌴", name: "Финики",          description: "Редкий деликатес пустыни.", world: "desert" },
  cranberry:    { seedCost: 45,  sellPrice: 115, growSec: 400,  xp: 35,  energyCost: 2, unlockLevel: 1, emoji: "🍒", name: "Клюква",          description: "Кислая ягода севера.", world: "snow" },
  ice_root:     { seedCost: 110, sellPrice: 285, growSec: 800,  xp: 75,  energyCost: 3, unlockLevel: 1, emoji: "🌿", name: "Ледяной корень",  description: "Мистический корень тундры.", world: "snow" },
};

router.get("/crops-config", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    const cropOverrides = cfg.cropOverrides ?? {};
    const customCrops = cfg.customCrops ?? {};
    const effectiveCropConfig = Object.fromEntries(
      Object.entries(ADMIN_BASE_CROPS).map(([k, v]) => [k, { ...v, ...cropOverrides[k] }])
    );
    res.json({ baseCropConfig: ADMIN_BASE_CROPS, cropOverrides, effectiveCropConfig, customCrops });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/crops-config ──────────────────────────────────────────────
router.post("/crops-config", (req, res) => {
  try {
    const { cropOverrides, customCrops } = req.body as {
      cropOverrides?: Record<string, Record<string, number>>;
      customCrops?: Record<string, import("../admin-config.js").CustomCropDef>;
    };
    if (!cropOverrides || typeof cropOverrides !== "object") {
      return res.status(400).json({ error: "cropOverrides must be an object" });
    }
    const current = getAdminConfig();
    const updated: AdminConfig = {
      ...current,
      cropOverrides,
      customCrops: customCrops ?? current.customCrops ?? {},
    };
    saveAdminConfig(updated);
    res.json({ ok: true, cropOverrides, customCrops: updated.customCrops });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/seed-shop ───────────────────────────────────────────────────
router.get("/seed-shop", async (_req, res) => {
  try {
    const epoch = currentEpoch();
    const slots = generateShopSlots(epoch);

    // Count total purchases per slot across ALL players
    const purchaseRows = await db
      .select({ slotKey: shopPurchasesTable.slotKey, total: sql<number>`sum(${shopPurchasesTable.quantity})` })
      .from(shopPurchasesTable)
      .where(like(shopPurchasesTable.slotKey, `${epoch}_%`))
      .groupBy(shopPurchasesTable.slotKey);

    const totalBySlot: Record<string, number> = {};
    for (const row of purchaseRows) totalBySlot[row.slotKey] = Number(row.total);

    const cfg = getAdminConfig();
    const offset = cfg.shopEpochOffset ?? 0;
    const naturalEpoch = Math.floor(Date.now() / SHOP_INTERVAL_MS);
    const nextRefreshMs = (naturalEpoch + 1) * SHOP_INTERVAL_MS - Date.now();

    res.json({
      epoch,
      epochOffset: offset,
      nextRefreshMs,
      slots: slots.map((s) => ({
        ...s,
        totalBought: totalBySlot[`${epoch}_${s.slotIndex}`] ?? 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/seed-shop/refresh ─────────────────────────────────────────
router.post("/seed-shop/refresh", async (_req, res) => {
  try {
    const current = getAdminConfig();
    const newOffset = (current.shopEpochOffset ?? 0) + 1;
    saveAdminConfig({ ...current, shopEpochOffset: newOffset });
    res.json({ ok: true, newEpochOffset: newOffset, newEpoch: currentEpoch() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/seed-shop/purchases ─────────────────────────────────────
router.delete("/seed-shop/purchases", async (_req, res) => {
  try {
    const epoch = currentEpoch();
    await db.delete(shopPurchasesTable).where(like(shopPurchasesTable.slotKey, `${epoch}_%`));
    res.json({ ok: true, message: `Покупки эпохи ${epoch} удалены (сток сброшен)` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/seed-shop/crop-overrides ────────────────────────────────────
router.get("/seed-shop/crop-overrides", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    res.json({ shopCropOverrides: cfg.shopCropOverrides ?? {} });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── PUT /api/admin/seed-shop/crop-overrides ────────────────────────────────────
router.put("/seed-shop/crop-overrides", (req, res) => {
  try {
    const { shopCropOverrides } = req.body as { shopCropOverrides: Record<string, ShopCropOverride> };
    if (!shopCropOverrides || typeof shopCropOverrides !== "object")
      return res.status(400).json({ error: "shopCropOverrides объект обязателен" });
    const cfg = getAdminConfig();
    saveAdminConfig({ ...cfg, shopCropOverrides });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/seed-shop/settings ─────────────────────────────────────────
router.get("/seed-shop/settings", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    const settings: ShopGlobalSettings = { ...DEFAULT_SHOP_GLOBAL, ...(cfg.shopGlobalSettings ?? {}) };
    res.json({ settings, epochOffset: cfg.shopEpochOffset ?? 0 });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── PUT /api/admin/seed-shop/settings ─────────────────────────────────────────
router.put("/seed-shop/settings", (req, res) => {
  try {
    const { settings, epochOffset } = req.body as { settings: Partial<ShopGlobalSettings>; epochOffset?: number };
    const cfg = getAdminConfig();
    const updated: typeof cfg = { ...cfg, shopGlobalSettings: { ...(cfg.shopGlobalSettings ?? {}), ...settings } };
    if (typeof epochOffset === "number") updated.shopEpochOffset = Math.max(0, Math.round(epochOffset));
    saveAdminConfig(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/promocodes ─────────────────────────────────────────────────
router.get("/promocodes", async (_req, res) => {
  try {
    const rows = await db.select().from(promocodesTable).orderBy(desc(promocodesTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/promocodes ────────────────────────────────────────────────
router.post("/promocodes", async (req, res) => {
  try {
    const { code, rewardCoins, rewardGems, maxUses, expiresAt } = req.body as {
      code: string;
      rewardCoins?: number;
      rewardGems?: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    };
    if (!code || typeof code !== "string" || !code.trim())
      return res.status(400).json({ error: "Код обязателен" });
    const normalized = code.trim().toUpperCase();
    await db.insert(promocodesTable).values({
      code: normalized,
      rewardCoins: rewardCoins ?? 0,
      rewardGems: rewardGems ?? 0,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: 1,
    });
    const created = await db.select().from(promocodesTable).where(eq(promocodesTable.code, normalized));
    res.json(created[0]);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Такой промокод уже существует" });
    res.status(500).json({ error: String(e) });
  }
});

// ── PATCH /api/admin/promocodes/:code ────────────────────────────────────────
router.patch("/promocodes/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { active, rewardCoins, rewardGems, maxUses, expiresAt } = req.body as {
      active?: number;
      rewardCoins?: number;
      rewardGems?: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    };
    const updates: Record<string, any> = {};
    if (active !== undefined) updates.active = active;
    if (rewardCoins !== undefined) updates.rewardCoins = rewardCoins;
    if (rewardGems !== undefined) updates.rewardGems = rewardGems;
    if (maxUses !== undefined) updates.maxUses = maxUses;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    await db.update(promocodesTable).set(updates).where(eq(promocodesTable.code, code));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/promocodes/:code ────────────────────────────────────────
router.delete("/promocodes/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    await db.delete(promocodeUsesTable).where(eq(promocodeUsesTable.code, code));
    await db.delete(promocodesTable).where(eq(promocodesTable.code, code));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/ref-codes — list player referral codes ─────────────────────
router.get("/ref-codes", async (_req, res) => {
  try {
    const rows = await db
      .select({
        telegramId: farmStateTable.telegramId,
        username: farmStateTable.username,
        firstName: farmStateTable.firstName,
        refCode: farmStateTable.refCode,
        level: farmStateTable.level,
      })
      .from(farmStateTable)
      .where(sql`${farmStateTable.refCode} IS NOT NULL`)
      .orderBy(farmStateTable.createdAt);

    // Join with referrals to get usage count per code
    const allReferrals = await db.select().from(referralsTable);
    const usageByReferrer: Record<string, number> = {};
    for (const r of allReferrals) usageByReferrer[r.referrerId] = (usageByReferrer[r.referrerId] ?? 0) + 1;

    res.json({
      codes: rows.map((r) => ({
        telegramId: r.telegramId,
        username: r.username,
        firstName: r.firstName,
        refCode: r.refCode,
        level: r.level,
        usedCount: usageByReferrer[r.telegramId] ?? 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/ref-codes/:telegramId — clear player ref code ───────────
router.delete("/ref-codes/:telegramId", async (req, res) => {
  try {
    await db.update(farmStateTable)
      .set({ refCode: null })
      .where(eq(farmStateTable.telegramId, req.params.telegramId));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/cases ───────────────────────────────────────────────────────
router.get("/cases", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    res.json({ cases: cfg.customCases ?? {} });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/cases — create a new custom case ──────────────────────────
router.post("/cases", (req, res) => {
  try {
    const { name, emoji, gemCost, description, color, glowColor, drops } = req.body as Partial<CustomCaseDef>;
    if (!name || !name.trim()) return res.status(400).json({ error: "Название обязательно" });
    if (!Array.isArray(drops) || drops.length === 0) return res.status(400).json({ error: "Добавь хотя бы один дроп" });

    const total = drops.reduce((s: number, d: CustomCaseDrop) => s + d.chance, 0);
    if (Math.abs(total - 1) > 0.01) return res.status(400).json({ error: "Сумма шансов должна быть 100%" });

    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newCase: CustomCaseDef = {
      id, name: name.trim(),
      emoji: emoji || "📦",
      gemCost: Math.max(1, Number(gemCost) || 50),
      description: description?.trim() || "",
      color: color || "from-purple-500 to-pink-600",
      glowColor: glowColor || "rgba(168,85,247,0.5)",
      active: true,
      drops: drops.map((d: CustomCaseDrop) => ({
        cropId: d.cropId,
        chance: Number(d.chance),
        minQty: Math.max(1, Number(d.minQty) || 1),
        maxQty: Math.max(1, Number(d.maxQty) || 1),
      })),
    };

    const cfg = getAdminConfig();
    saveAdminConfig({ ...cfg, customCases: { ...(cfg.customCases ?? {}), [id]: newCase } });
    res.json({ ok: true, case: newCase });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── PATCH /api/admin/cases/:id — update a custom case ─────────────────────────
router.patch("/cases/:id", (req, res) => {
  try {
    const { id } = req.params;
    const cfg = getAdminConfig();
    const existing = (cfg.customCases ?? {})[id];
    if (!existing) return res.status(404).json({ error: "Кейс не найден" });

    const { name, emoji, gemCost, description, color, glowColor, active, drops } = req.body as Partial<CustomCaseDef>;

    if (drops !== undefined) {
      if (!Array.isArray(drops) || drops.length === 0)
        return res.status(400).json({ error: "Добавь хотя бы один дроп" });
      const total = drops.reduce((s: number, d: CustomCaseDrop) => s + d.chance, 0);
      if (Math.abs(total - 1) > 0.01) return res.status(400).json({ error: "Сумма шансов должна быть 100%" });
    }

    const updated: CustomCaseDef = {
      ...existing,
      ...(name !== undefined && { name: name.trim() }),
      ...(emoji !== undefined && { emoji }),
      ...(gemCost !== undefined && { gemCost: Math.max(1, Number(gemCost)) }),
      ...(description !== undefined && { description: description.trim() }),
      ...(color !== undefined && { color }),
      ...(glowColor !== undefined && { glowColor }),
      ...(active !== undefined && { active: Boolean(active) }),
      ...(drops !== undefined && { drops: drops.map((d: CustomCaseDrop) => ({
        cropId: d.cropId,
        chance: Number(d.chance),
        minQty: Math.max(1, Number(d.minQty) || 1),
        maxQty: Math.max(1, Number(d.maxQty) || 1),
      })) }),
    };

    saveAdminConfig({ ...cfg, customCases: { ...(cfg.customCases ?? {}), [id]: updated } });
    res.json({ ok: true, case: updated });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/cases/:id ────────────────────────────────────────────────
router.delete("/cases/:id", (req, res) => {
  try {
    const { id } = req.params;
    const cfg = getAdminConfig();
    const cases = { ...(cfg.customCases ?? {}) };
    if (!cases[id]) return res.status(404).json({ error: "Кейс не найден" });
    delete cases[id];
    saveAdminConfig({ ...cfg, customCases: cases });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/admin/event ──────────────────────────────────────────────────────
router.get("/event", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    res.json({ activeEvent: cfg.activeEvent ?? null });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /api/admin/event ─────────────────────────────────────────────────────
router.post("/event", (req, res) => {
  try {
    const body = req.body as Partial<SeasonalEventDef>;
    if (!body.id || !body.name || !body.startAt || !body.endAt) {
      return res.status(400).json({ error: "id, name, startAt, endAt обязательны" });
    }
    const ev: SeasonalEventDef = {
      id: body.id,
      name: body.name,
      emoji: body.emoji ?? "🎉",
      startAt: body.startAt,
      endAt: body.endAt,
      eventCoinName: body.eventCoinName ?? "Ивент-монеты",
      eventCoinEmoji: body.eventCoinEmoji ?? "🪙",
      eventCoinReward: Number(body.eventCoinReward) || 1,
      eventCrops: (body.eventCrops ?? []) as EventCropDef[],
      shopItems: (body.shopItems ?? []) as EventShopItem[],
    };
    const cfg = getAdminConfig();
    saveAdminConfig({ ...cfg, activeEvent: ev });
    res.json({ ok: true, activeEvent: ev });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /api/admin/event ───────────────────────────────────────────────────
router.delete("/event", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    saveAdminConfig({ ...cfg, activeEvent: null });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
