import { createClient } from "@retconned/kick-js";
import dotenv from "dotenv";
import { checkToken, getChannelInfo, sendChatMessage } from "./api.js";
import { refreshToken } from "./auth.js";
import { handleCommand } from "./commands.js";
import { REQUIRED_ENV, CACHE_CONFIG, BOT_CONFIG } from "./config.js";
import { appendToMentionsFile } from "./utils/saveToken.js";

dotenv.config();

// Перевірка імпорту handleCommand

// Кеш для відстеження оброблених повідомлень, згадок, відповідей і ID повідомлень бота
const processedMessages = new Set();
const processedMentions = new Set();
const processedReplies = new Set();
const botMessageIds = new Set();

// Змінна для зберігання поточного токена
let currentAccessToken = process.env.ACCESS_TOKEN;
let tokenInvalid = false;

async function attemptLogin(client, token) {
  try {
    await client.login({
      type: "tokens",
      credentials: { bearerToken: token },
    });
    console.log("✅ Авторизація успішна");
    return true;
  } catch (error) {
    console.error("❌ Помилка авторизації:", error.message);
    return false;
  }
}

async function retryGetChannelInfo(slug, token, retries = 3) {
  let attempt = 0;
  while (attempt < retries) {
    console.log(
      `ℹ️ Спроба ${attempt + 1} отримати channelInfo для slug: ${slug}`
    );
    const channelInfo = await getChannelInfo(slug, token);
    if (channelInfo) return channelInfo;
    attempt++;
    if (attempt < retries) {
      console.log("ℹ️ Чекаємо 5 секунд перед повторною спробою...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const newToken = await refreshToken();
      if (newToken) {
        currentAccessToken = newToken;
        token = newToken;
      } else {
        tokenInvalid = true;
      }
    }
  }
  console.error("❌ Не вдалося отримати channelInfo після всіх спроб");
  return null;
}

export async function startServer(accessToken) {
  console.log(
    "🚀 Виклик startServer з токеном:",
    accessToken.slice(0, 10) + "..."
  );
  currentAccessToken = accessToken;
  tokenInvalid = false;

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
  const channelInfo = await retryGetChannelInfo(
    process.env.KICK_CHANNEL_SLUG,
    accessToken
  );
  if (!channelInfo) {
    console.error("❌ Зупиняємо бот через неможливість отримати channelInfo");
    return;
  }
  const {
    broadcaster_user_id: broadcasterUserId,
    chatroom_id: chatroomId,
    bot_user_id: botUserId,
    channel_id: channelId,
  } = channelInfo;

  // Тестове повідомлення
  const testMessageResult = await sendChatMessage(
    broadcasterUserId,
    "[emote:39251:beeBobble]",
    currentAccessToken
  );
  if (testMessageResult?.data?.message_id) {
    botMessageIds.add(testMessageResult.data.message_id);
    console.log(
      `ℹ️ Збережено ID тестового повідомлення: ${testMessageResult.data.message_id}`
    );
  } else {
    console.error(
      "❌ Не вдалося відправити тестове повідомлення або отримати message_id"
    );
  }

  // Ініціалізація клієнта
  const client = createClient(process.env.KICK_CHANNEL_NAME, {
    logger: true,
    readOnly: false,
  });

  // Спроба авторизації
  if (!(await attemptLogin(client, accessToken))) {
    return;
  }

  // Періодичне повідомлення кожні 7 хвилин
  let isConnected = false;
  const periodicMessageInterval = setInterval(async () => {
    console.log(
      `ℹ️ Перевірка періодичного повідомлення: isConnected=${isConnected}, broadcasterUserId=${broadcasterUserId}, tokenInvalid=${tokenInvalid}`
    );
    if (!isConnected || !broadcasterUserId || tokenInvalid) {
      console.log(
        "ℹ️ Періодичне повідомлення пропущено: бот не підключений, відсутній broadcasterUserId або невалідний токен"
      );
      if (tokenInvalid) {
        console.error(
          "⚠️ Токен невалідний. Пройдіть авторизацію через /login."
        );
      }
      return;
    }
    try {
      console.log(`ℹ️ Спроба відправки: "${BOT_CONFIG.PERIODIC_MESSAGE_TEXT}"`);
      let result = await sendChatMessage(
        broadcasterUserId,
        BOT_CONFIG.PERIODIC_MESSAGE_TEXT,
        currentAccessToken
      );
      if (result?.data?.message_id) {
        botMessageIds.add(result.data.message_id);
        console.log(
          `ℹ️ Збережено ID періодичного повідомлення: ${result.data.message_id}`
        );
      }
      if (!result) {
        console.log("ℹ️ Спроба оновлення токена через невдале повідомлення...");
        const newToken = await refreshToken();
        if (newToken) {
          currentAccessToken = newToken;
          await attemptLogin(client, newToken);
          console.log("ℹ️ Повторна спроба відправки після оновлення токена...");
          result = await sendChatMessage(
            broadcasterUserId,
            BOT_CONFIG.PERIODIC_MESSAGE_TEXT,
            currentAccessToken
          );
          if (result?.data?.message_id) {
            botMessageIds.add(result.data.message_id);
            console.log(
              `ℹ️ Збережено ID періодичного повідомлення після оновлення: ${result.data.message_id}`
            );
          }
        } else {
          tokenInvalid = true;
          console.error(
            "⚠️ Токен невалідний. Пройдіть авторизацію через /login."
          );
        }
      }
      if (result) {
        console.log(
          `✅ Періодичне повідомлення відправлено: "${BOT_CONFIG.PERIODIC_MESSAGE_TEXT}"`
        );
      } else {
        console.error(
          "❌ Не вдалося відправити періодичне повідомлення після всіх спроб"
        );
      }
    } catch (error) {
      console.error(
        "❌ Помилка відправки періодичного повідомлення:",
        error.message
      );
      if (error.response?.status === 401) {
        console.log("ℹ️ Спроба оновлення токена через 401...");
        const newToken = await refreshToken();
        if (newToken) {
          currentAccessToken = newToken;
          await attemptLogin(client, newToken);
          const result = await sendChatMessage(
            broadcasterUserId,
            BOT_CONFIG.PERIODIC_MESSAGE_TEXT,
            currentAccessToken
          );
          if (result?.data?.message_id) {
            botMessageIds.add(result.data.message_id);
            console.log(
              `ℹ️ Збережено ID періодичного повідомлення після 401: ${result.data.message_id}`
            );
          }
        } else {
          tokenInvalid = true;
        }
      }
    }
  }, BOT_CONFIG.PERIODIC_MESSAGE_INTERVAL);

  // Обробники подій
  client.on("ready", () => {
    console.log(
      `✅ Бот підключений як ${client.user?.tag || "невідомий користувач"}`
    );
    console.log(`Підключено до каналу: ${process.env.KICK_CHANNEL_NAME}`);
    isConnected = true;
  });

  client.on("ChatMessage", async (message) => {
    console.log(
      `${message.sender.username}: ${message.content}, chatroom_id: ${
        message.chatroom_id
      }, message_id: ${message.id}, sender_id: ${
        message.sender.id
      }, reply_to_message_id: ${message.reply_to_message_id || "none"}`
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

    // Обробка відповідей на повідомлення бота
    if (
      message.reply_to_message_id &&
      botMessageIds.has(message.reply_to_message_id)
    ) {
      const replyKey = `${message.sender.id}:${message.created_at}`;
      if (!processedReplies.has(replyKey)) {
        processedReplies.add(replyKey);
        setTimeout(
          () => processedReplies.delete(replyKey),
          CACHE_CONFIG.MESSAGE_TTL
        );

        const timestamp = new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, 19);
        console.log(
          `ℹ️ Підготовка до збереження відповіді: replyKey=${replyKey}, timestamp=${timestamp}`
        );
        appendToMentionsFile(
          "Reply_to_Bot",
          message.sender.username,
          timestamp,
          message.content
        );
      }
    }

    // Обробка згадок @Hunt3R_WTF
    if (message.content.toLowerCase().includes("@hunt3r_wtf")) {
      const mentionKey = `${message.sender.id}:${message.created_at}`;
      if (!processedMentions.has(mentionKey)) {
        processedMentions.add(mentionKey);
        setTimeout(
          () => processedMentions.delete(mentionKey),
          CACHE_CONFIG.MESSAGE_TTL
        );

        const timestamp = new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, 19);
        console.log(
          `ℹ️ Підготовка до збереження згадки: mentionKey=${mentionKey}, timestamp=${timestamp}`
        );
        appendToMentionsFile(
          "Hunt3R_WTF",
          message.sender.username,
          timestamp,
          message.content
        );
      }
    }

    // Обробка команд
    try {
      await handleCommand(
        message,
        broadcasterUserId,
        currentAccessToken,
        channelId
      );
    } catch (error) {
      console.error("❌ Помилка обробки команди:", error.message);
      if (error.response?.status === 401) {
        console.log("ℹ️ Спроба оновлення токена через 401 у команді...");
        const newToken = await refreshToken();
        if (newToken) {
          currentAccessToken = newToken;
          await attemptLogin(client, newToken);
          await handleCommand(
            message,
            broadcasterUserId,
            currentAccessToken,
            channelId
          );
        } else {
          tokenInvalid = true;
        }
      }
    }
  });

  client.on("pusher:connection_established", () => {});
  client.on("pusher_internal:subscription_succeeded", () => {});
  client.on("unknown", (event) => {
    console.log(`ℹ️ Невідома подія: ${event.type}`);
  });

  client.on("error", async (error) => {
    console.error("❌ Помилка клієнта:", error.message);
    isConnected = false;
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      console.log("ℹ️ Спроба оновлення токена через помилку клієнта...");
      const newToken = await refreshToken();
      if (newToken) {
        currentAccessToken = newToken;
        if (await attemptLogin(client, newToken)) {
          isConnected = true;
        }
      } else {
        tokenInvalid = true;
      }
    }
  });

  client.on("close", async () => {
    console.log("ℹ️ Бот відключений, очищаємо періодичне повідомлення");
    clearInterval(periodicMessageInterval);
    isConnected = false;
    if (!tokenInvalid) {
      console.log("ℹ️ Спроба повторного підключення через 10 секунд...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      if (await attemptLogin(client, currentAccessToken)) {
        isConnected = true;
      }
    } else {
      console.error(
        "⚠️ Повторне підключення пропущено через невалідний токен. Пройдіть авторизацію через /login."
      );
    }
  });
}
