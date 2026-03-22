import { Router } from "express";

const router = Router();

router.get("/:telegramId", async (req, res) => {
  const { telegramId } = req.params;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) return res.status(503).json({ error: "Bot token not configured" });
  if (telegramId.startsWith("demo_") || !telegramId.match(/^\d+$/)) {
    return res.status(404).json({ error: "No avatar" });
  }

  try {
    const photosRes = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${telegramId}&limit=1`
    );
    const photosData = await photosRes.json() as any;

    if (!photosData.ok || !photosData.result?.photos?.length) {
      return res.status(404).json({ error: "No photos" });
    }

    const photos: Array<{ file_id: string; width: number }> = photosData.result.photos[0];
    const selected = photos.length > 1 ? photos[photos.length - 2] : photos[0];

    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${selected.file_id}`
    );
    const fileData = await fileRes.json() as any;

    if (!fileData.ok || !fileData.result?.file_path) {
      return res.status(404).json({ error: "No file path" });
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
    res.redirect(302, fileUrl);
  } catch (err) {
    console.error("Avatar fetch error:", err);
    res.status(500).json({ error: "Failed to fetch avatar" });
  }
});

export default router;
