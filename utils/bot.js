import { createClient } from "@retconned/kick-js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// Кеш для відстеження оброблених повідомлень
const processedMessages = new Set();

async function checkToken(accessToken) {
  try {
    const response = await axios.get("https://api.kick.com/api/v2/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    console.log("✅ Дані користувача:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Помилка перевірки токена:",
      error.response?.data || error.message
    );
    console.error(
      "Токен, що використовується:",
      accessToken.slice(0, 10) + "..."
    );
    return null;
  }
}

async function getChannelInfo(slug, accessToken) {
  try {
    const response = await axios.get(
      `https://api.kick.com/public/v1/channels?slug=${slug}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );
    const channel = response.data.data?.[0];
    if (!channel) {
      console.error("❌ Канал не знайдено");
      return null;
    }
    console.log("Отримано broadcaster_user_id:", channel.broadcaster_user_id);
    console.log("Отримано chatroom_id:", channel.chatroom?.id);
    return {
      broadcaster_user_id: channel.broadcaster_user_id,
      chatroom_id: channel.chatroom?.id,
      bot_user_id: channel.user_id,
    };
  } catch (error) {
    console.error(
      "❌ Помилка отримання каналу:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function sendChatMessage(
  broadcasterUserId,
  content,
  accessToken,
  replyToMessageId = null
) {
  console.log(
    "Надсилаємо повідомлення з broadcaster_user_id:",
    broadcasterUserId,
    "Вміст:",
    content
  );
  try {
    const body = {
      broadcaster_user_id: broadcasterUserId,
      content: content,
      type: "user",
    };
    if (replyToMessageId) {
      body.reply_to_message_id = replyToMessageId;
    }

    const response = await axios.post(
      "https://api.kick.com/public/v1/chat",
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    if (response.data.data?.is_sent) {
      console.log(`✅ Повідомлення відправлено: "${content}"`);
      return response.data;
    } else {
      console.warn(
        "⚠️ Сервер прийняв запит, але is_sent !== true:",
        response.data
      );
      return null;
    }
  } catch (error) {
    console.error(
      "❌ Помилка надсилання повідомлення:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function updateChannel(streamTitle, categoryId, accessToken) {
  try {
    const response = await axios.patch(
      `https://api.kick.com/api/v2/channels/${process.env.KICK_CHANNEL_SLUG}`,
      {
        category_id: categoryId,
        stream_title: streamTitle,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    console.log("✅ Канал оновлено:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Помилка при оновленні каналу:",
      error.response?.data || error.message
    );
    if (error.response?.status === 401) {
      console.log("Спроба оновлення токена...");
      const newToken = await refreshToken();
      if (newToken) {
        try {
          const retryResponse = await axios.patch(
            `https://api.kick.com/api/v2/channels/${process.env.KICK_CHANNEL_SLUG}`,
            {
              category_id: categoryId,
              stream_title: streamTitle,
            },
            {
              headers: {
                Authorization: `Bearer ${newToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );
          console.log(
            "✅ Канал оновлено після оновлення токена:",
            retryResponse.data
          );
          return retryResponse.data;
        } catch (retryError) {
          console.error(
            "❌ Помилка після оновлення токена:",
            retryError.response?.data || retryError.message
          );
          return null;
        }
      }
    }
    return null;
  }
}

export async function startServer(accessToken) {
  console.log(
    "🚀 Виклик startServer з токеном:",
    accessToken.slice(0, 10) + "..."
  );

  if (!process.env.KICK_CHANNEL_NAME) {
    console.error("❌ KICK_CHANNEL_NAME не встановлено в .env");
    return;
  }
  if (!process.env.KICK_CHANNEL_SLUG) {
    console.error("❌ KICK_CHANNEL_SLUG не встановлено в .env");
    return;
  }
  if (!accessToken) {
    console.error("❌ accessToken не надано");
    return;
  }

  console.log(
    `🤖 Ініціалізація бота для каналу: ${process.env.KICK_CHANNEL_NAME}`
  );

  const userData = await checkToken(accessToken);
  if (!userData) {
    console.error(
      "⚠️ Продовжуємо без даних користувача через невалідний токен"
    );
  }

  const channelInfo = await getChannelInfo(
    process.env.KICK_CHANNEL_SLUG,
    accessToken
  );
  if (!channelInfo) {
    console.error(
      "⚠️ Не вдалося отримати інформацію про канал, але продовжуємо"
    );
  }
  const broadcasterUserId = channelInfo?.broadcaster_user_id;
  const chatroomId = channelInfo?.chatroom_id;
  const botUserId = channelInfo?.bot_user_id;

  if (broadcasterUserId) {
    await sendChatMessage(
      broadcasterUserId,
      "Бот запущено! Напишіть !hello, щоб привітатися.",
      accessToken
    );
  }

  const client = createClient(process.env.KICK_CHANNEL_NAME, {
    logger: true,
    readOnly: false,
  });

  console.log("Спроба авторизації з токеном...");

  try {
    await client.login({
      type: "tokens",
      credentials: {
        bearerToken: accessToken,
      },
    });
  } catch (error) {
    console.error("❌ Помилка авторизації:", error.message);
    return;
  }

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

    if (message.sender.id === botUserId) {
      console.log(
        `ℹ️ Ігноруємо власне повідомлення від ${message.sender.username}`
      );
      return;
    }

    const messageKey = `${message.sender.id}:${message.content}:${message.created_at}`;
    if (processedMessages.has(messageKey)) {
      console.log(`ℹ️ Повідомлення ${messageKey} уже оброблено, ігноруємо`);
      return;
    }
    processedMessages.add(messageKey);
    setTimeout(() => processedMessages.delete(messageKey), 5 * 60 * 1000);

    if (message.content.toLowerCase().startsWith("!title ")) {
      const newTitle = message.content.slice(7).trim();
      if (newTitle) {
        try {
          await updateChannel(newTitle, 1, accessToken);
          await sendChatMessage(
            broadcasterUserId,
            `Назву стріму змінено на: ${newTitle}`,
            accessToken,
            message.id
          );
        } catch (error) {
          console.error("❌ Помилка при зміні назви:", error.message);
        }
      }
    }

    if (message.content.toLowerCase() === "!hello") {
      try {
        await sendChatMessage(
          broadcasterUserId,
          `Привіт, ${message.sender.username}!`,
          accessToken,
          message.id
        );
      } catch (error) {
        console.error("❌ Помилка при надсиланні привітання:", error.message);
      }
    }
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
