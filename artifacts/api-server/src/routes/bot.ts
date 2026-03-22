import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function getWebAppUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return "https://localhost";
}

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || "";
      const firstName = msg.from?.first_name || "Фермер";

      if (text === "/start") {
        const webAppUrl = getWebAppUrl();
        await callTelegram("sendMessage", {
          chat_id: chatId,
          text: `🌾 Привет, ${firstName}!\n\nДобро пожаловать в *Мини-Ферму*!\n\n🌱 Сажай культуры\n🕐 Жди пока они вырастут\n🌾 Собирай урожай\n🪙 Продавай за монеты\n⭐ Прокачивай уровень\n\nНажми кнопку ниже, чтобы начать!`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "🌾 Открыть ферму",
                web_app: { url: webAppUrl },
              },
            ]],
          },
        });
      } else if (text === "/help") {
        await callTelegram("sendMessage", {
          chat_id: chatId,
          text: `📖 *Как играть в Мини-Ферму:*\n\n1️⃣ Нажми на пустую грядку чтобы посадить семена\n2️⃣ Жди пока культура вырастет\n3️⃣ Нажми на готовую культуру чтобы собрать урожай\n4️⃣ Продай урожай в Амбаре за монеты 🪙\n5️⃣ Купи больше семян в Магазине 🛒\n\n🌾 Пшеница — 30 сек\n🥕 Морковь — 1 мин\n🍅 Помидор — 2 мин\n🌽 Кукуруза — 5 мин\n🍓 Клубника — 10 мин`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "🌾 Играть",
                web_app: { url: getWebAppUrl() },
              },
            ]],
          },
        });
      } else {
        await callTelegram("sendMessage", {
          chat_id: chatId,
          text: `Нажми /start чтобы открыть ферму! 🌾`,
          reply_markup: {
            inline_keyboard: [[
              {
                text: "🌾 Открыть ферму",
                web_app: { url: getWebAppUrl() },
              },
            ]],
          },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Bot webhook error:", err);
    res.status(200).json({ ok: true });
  }
});

router.get("/setup", async (_req: Request, res: Response) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
    }

    const webAppUrl = getWebAppUrl();
    const webhookUrl = `${webAppUrl}/api/bot/webhook`;

    const [webhookResult, menuResult, commandsResult] = await Promise.all([
      callTelegram("setWebhook", {
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
      callTelegram("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "🌾 Играть",
          web_app: { url: webAppUrl },
        },
      }),
      callTelegram("setMyCommands", {
        commands: [
          { command: "start", description: "Открыть Мини-Ферму 🌾" },
          { command: "help", description: "Как играть 📖" },
        ],
      }),
    ]);

    res.json({
      webhook: webhookResult,
      menuButton: menuResult,
      commands: commandsResult,
      webhookUrl,
      webAppUrl,
    });
  } catch (err) {
    console.error("Bot setup error:", err);
    res.status(500).json({ error: String(err) });
  }
});

router.get("/info", async (_req: Request, res: Response) => {
  try {
    const [botInfo, webhookInfo] = await Promise.all([
      callTelegram("getMe", {}),
      callTelegram("getWebhookInfo", {}),
    ]);
    res.json({ bot: botInfo, webhook: webhookInfo });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
