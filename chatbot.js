import { createClient } from "@retconned/kick-js";
import dotenv from "dotenv";
import {
  checkToken,
  getChannelInfo,
  sendChatMessage,
  refreshToken,
} from "./api.js";
import { handleCommand } from "./commands.js";
import { REQUIRED_ENV, CACHE_CONFIG, BOT_CONFIG } from "./config.js";
import { appendToMentionsFile } from "./utils/saveToken.js";

dotenv.config();

// Кеш для відстеження оброблених повідомлень і згадок
const processedMessages = new Set();
const processedMentions = new Set();

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

async function retryGetChannelInfo(slug, token, retries = 1) {
  let attempt = 0;
  while (attempt < retries) {
    console.log(
      `📡 Attempt ${attempt + 1} to fetch channelInfo for slug: ${slug}`
    );
    const channelInfo = await getChannelInfo(slug, token);
    if (channelInfo) return channelInfo;
    attempt++;
    if (attempt < retries) {
      console.log("⏳ Waiting 5ms before retry...");
      await new Promise((resolve) => setTimeout(resolve, 5));
      const newToken = await refreshToken();
      if (newToken) {
        currentAccessToken = newToken;
        token = newToken;
      } else {
        tokenInvalid = true;
      }
    }
  }
  console.error("❌ Failed to fetch channelInfo after retries.");
  return null;
}

export async function startServer(accessToken) {
  console.log(
    "🚀 Starting server with token:",
    accessToken.slice(0, 10) + "..."
  );
  currentAccessToken = accessToken;
  tokenInvalid = false;

  // Перевірка змінних середовища
  for (const envVar of REQUIRED_ENV) {
    if (!process.env[envVar]) {
      console.error(`❌ ${envVar} not set in .env`);
      return;
    }
  }

  if (!accessToken) {
    console.error("❌ No accessToken provided");
    return;
  }

  console.log(
    `🤖 Initializing bot for channel: ${process.env.KICK_CHANNEL_NAME}`
  );

  // Перевірка токена
  const userData = await checkToken(accessToken);
  if (!userData) {
    console.error("⚠️ Continuing without user data due to invalid token");
  }

  // Отримання інформації про канал
  const channelInfo = await retryGetChannelInfo(
    process.env.KICK_CHANNEL_SLUG,
    accessToken
  );
  if (!channelInfo) {
    console.error("❌ Stopping bot due to failure to fetch channelInfo");
    return;
  }
  const {
    broadcaster_user_id: broadcasterUserId,
    chatroom_id: chatroomId,
    bot_user_id: botUserId,
    channel_id: channelId,
  } = channelInfo;

  // Тестове повідомлення
  await sendChatMessage(
    broadcasterUserId,
    "[emote:39251:beeBobble]",
    currentAccessToken
  );

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
      `ℹ️ Checking periodic message: isConnected=${isConnected}, broadcasterUserId=${broadcasterUserId}, tokenInvalid=${tokenInvalid}`
    );
    if (!isConnected || !broadcasterUserId || tokenInvalid) {
      console.log(
        "ℹ️ Periodic message skipped: bot not connected, no broadcasterUserId, or invalid token"
      );
      if (tokenInvalid) {
        console.error("⚠️ Token is invalid. Please reauthorize via /login.");
      }
      return;
    }
    try {
      const result = await sendChatMessage(
        broadcasterUserId,
        BOT_CONFIG.PERIODIC_MESSAGE_TEXT,
        currentAccessToken
      );
      if (!result) {
        console.log("ℹ️ Attempting token refresh due to failed message...");
        const newToken = await refreshToken();
        if (newToken) {
          currentAccessToken = newToken;
          await attemptLogin(client, newToken);
          await sendChatMessage(
            broadcasterUserId,
            BOT_CONFIG.PERIODIC_MESSAGE_TEXT,
            currentAccessToken
          );
        } else {
          tokenInvalid = true;
        }
      }
      console.log(
        `ℹ️ Periodic message sent: "${BOT_CONFIG.PERIODIC_MESSAGE_TEXT}"`
      );
    } catch (error) {
      console.error("❌ Error sending periodic message:", error.message);
    }
  }, BOT_CONFIG.PERIODIC_MESSAGE_INTERVAL);

  // Обробники подій
  client.on("ready", () => {
    console.log(`✅ Bot connected as ${client.user?.tag || "unknown user"}`);
    console.log(`Connected to channel: ${process.env.KICK_CHANNEL_NAME}`);
    isConnected = true;
  });

  client.on("ChatMessage", async (message) => {
    console.log(
      `${message.sender.username}: ${message.content}, chatroom_id: ${message.chatroom_id}, message_id: ${message.id}, sender_id: ${message.sender.id}`
    );

    // Ігнорування власних повідомлень
    if (message.sender.id === botUserId) {
      console.log(`ℹ️ Ignoring own message from ${message.sender.username}`);
      return;
    }

    // Перевірка на дублювання
    const messageKey = `${message.sender.id}:${message.content}:${message.created_at}`;
    if (processedMessages.has(messageKey)) {
      console.log(`ℹ️ Message ${messageKey} already processed, ignoring`);
      return;
    }
    processedMessages.add(messageKey);
    setTimeout(
      () => processedMessages.delete(messageKey),
      CACHE_CONFIG.MESSAGE_TTL
    );

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
        appendToMentionsFile("Hunt3R_WTF", message.sender.username, timestamp);
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
      console.error("❌ Error processing command:", error.message);
      if (error.response?.status === 401) {
        console.log("ℹ️ Attempting token refresh due to 401 in command...");
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
    console.log(`ℹ️ Unknown event: ${event.type}`);
  });

  client.on("error", async (error) => {
    console.error("❌ Client error:", error.message);
    isConnected = false;
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      console.log("ℹ️ Attempting token refresh due to client error...");
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

  // Очищення інтервалу при відключенні
  client.on("close", async () => {
    console.log("ℹ️ Bot disconnected, clearing periodic message");
    clearInterval(periodicMessageInterval);
    isConnected = false;
    if (!tokenInvalid) {
      console.log("ℹ️ Attempting reconnect in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      if (await attemptLogin(client, currentAccessToken)) {
        isConnected = true;
      }
    } else {
      console.error(
        "⚠️ Reconnect skipped due to invalid token. Please reauthorize via /login."
      );
    }
  });
}
