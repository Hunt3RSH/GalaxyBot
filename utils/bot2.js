import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const CHANNEL_SLUG = process.env.CHANNEL_SLUG;

if (!ACCESS_TOKEN || !CHANNEL_SLUG) {
  console.error("Відсутній ACCESS_TOKEN або CHANNEL_SLUG");
  process.exit(1);
}

async function getChannelInfo() {
  try {
    const response = await axios.get(
      `https://api.kick.com/public/v1/channels?slug=${CHANNEL_SLUG}`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          Accept: "*/*",
        },
      }
    );
    const channel = response.data.data?.[0];
    if (!channel) {
      console.error("Канал не знайдено");
      return null;
    }
    return channel;
  } catch (error) {
    console.error(
      "Помилка отримання каналу:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function sendMessage(
  broadcasterUserId,
  message,
  replyToMessageId = null
) {
  try {
    const body = {
      broadcaster_user_id: broadcasterUserId,
      content: message,
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
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "*/*",
        },
      }
    );
    if (response.data.data?.is_sent) {
      console.log(`✅ Повідомлення відправлено: "${message}"`);
    } else {
      console.warn("⚠️ Сервер прийняв запит, але is_sent !== true");
    }
  } catch (error) {
    console.error(
      "❌ Помилка відправки повідомлення:",
      error.response?.data || error.message
    );
  }
}

export async function onMessage(msg) {
  const channel = await getChannelInfo();
  if (!channel) return;

  const broadcasterUserId = channel.broadcaster_user_id;

  if (msg.toLowerCase() === "!hello") {
    await sendMessage(broadcasterUserId, "Привіт, це бот Kick!");
  }
}

export async function initBot() {
  console.log("🤖 Бот запущений. Тестуємо команду '!hello'");
  await onMessage("!hello");
}
