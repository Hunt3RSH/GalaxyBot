import { createClient } from "@retconned/kick-js";
import dotenv from "dotenv";
import { checkToken, getChannelInfo, sendChatMessage } from "./api.js";
import { handleCommand } from "./commands.js";
import { REQUIRED_ENV, CACHE_CONFIG } from "./config.js";

dotenv.config();

// Кеш для відстеження оброблених повідомлень
const processedMessages = new Set();

/**
 * Ініціалізація та запуск бота
 * @param {string} accessToken - Токен доступу
 */
export async function startServer(accessToken) {
  console.log(
    "🚀 Виклик startServer з токеном:",
    accessToken.slice(0, 10) + "..."
  );

  // Перевірка змінних середовища
  for (const envVar of REQUIRED_ENV) {
    if (!process.env[envVar]) {
      console.error(`❌ ${envVar} не встановлено в .env`);
      return;
    }
  }

  if (!accessToken) {
    console.error("❌ accessToken не надано");
    return;
  }

  console.log(
    `🤖 Ініціалізація бота для каналу: ${process.env.KICK_CHANNEL_NAME}`
  );

  // Перевірка токена
  const userData = await checkToken(accessToken);
  if (!userData) {
    console.error(
      "⚠️ Продовжуємо без даних користувача через невалідний токен"
    );
  }

  // Отримання інформації про канал
  const channelInfo = await getChannelInfo(
    process.env.KICK_CHANNEL_SLUG,
    accessToken
  );
  if (!channelInfo) {
    console.error(
      "⚠️ Не вдалося отримати інформацію про канал, але продовжуємо"
    );
  }
  const {
    broadcaster_user_id: broadcasterUserId,
    chatroom_id: chatroomId,
    bot_user_id: botUserId,
  } = channelInfo || {};

  // Тестове повідомлення
  if (broadcasterUserId) {
    await sendChatMessage(
      broadcasterUserId,
      "Бот запущено! Напишіть !hello, щоб привітатися.",
      accessToken
    );
  }

  // Ініціалізація клієнта
  const client = createClient(process.env.KICK_CHANNEL_NAME, {
    logger: true,
    readOnly: false,
  });

  console.log("Спроба авторизації з токеном...");

  try {
    await client.login({
      type: "tokens",
      credentials: { bearerToken: accessToken },
    });
  } catch (error) {
    console.error("❌ Помилка авторизації:", error.message);
    return;
  }

  // Обробники подій
  client.on("ready", () => {
    console.log(
      `✅ Бот підключений як ${client.user?.tag || "невідомий користувач"}`
    );
    console.log(`Підключено до каналу: ${process.env.KICK_CHANNEL_NAME}`);
  });

  client.on("ChatMessage", async (message) => {
    console.log(
      `${message.sender.username}: ${message.content}, chatroom_id: ${message.chatroom_id}, message_id: ${message.id}, sender_id: ${message.sender.id}`
    );

    // Ігнорування власних повідомлень
    if (message.sender.id === botUserId) {
      console.log(
        `ℹ️ Ігноруємо власне повідомлення від ${message.sender.username}`
      );
      return;
    }

    // Перевірка на дублювання
    const messageKey = `${message.sender.id}:${message.content}:${message.created_at}`;
    if (processedMessages.has(messageKey)) {
      console.log(`ℹ️ Повідомлення ${messageKey} уже оброблено, ігноруємо`);
      return;
    }
    processedMessages.add(messageKey);
    setTimeout(
      () => processedMessages.delete(messageKey),
      CACHE_CONFIG.MESSAGE_TTL
    );

    // Обробка команд
    await handleCommand(message, broadcasterUserId, accessToken);
  });

  client.on("pusher:connection_established", () => {});
  client.on("pusher_internal:subscription_succeeded", () => {});
  client.on("unknown", (event) => {
    console.log(`ℹ️ Невідома подія: ${event.type}`);
  });

  client.on("error", (error) => {
    console.error("❌ Помилка клієнта:", error.message);
  });
}
