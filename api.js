import axios from "axios";
import { API_CONFIG } from "./config.js";
import { refreshTokenIfNeeded } from "./refreshToken.js";

let currentAccessToken = process.env.ACCESS_TOKEN;

function handleError(error, context) {
  const message = error.response?.data || error.message;
  console.error(`❌ ${context}:`, message);
  console.error(`ℹ️ Статус відповіді:`, error.response?.status);
  return message;
}

async function requestWithTokenRefresh(requestFn, context) {
  try {
    return await requestFn(currentAccessToken);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`ℹ️ Отримано 401 для ${context}, оновлюємо токен...`);
      const newToken = await refreshTokenIfNeeded();
      if (newToken) {
        currentAccessToken = newToken;
        try {
          return await requestFn(newToken);
        } catch (retryError) {
          return handleError(
            retryError,
            `Помилка після оновлення токена для ${context}`
          );
        }
      }
    }
    return handleError(error, context);
  }
}

export async function checkToken(accessToken) {
  return requestWithTokenRefresh(async (token) => {
    const response = await axios.get(
      API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.USER,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("✅ Дані користувача:", response.data);
    return response.data;
  }, "Помилка перевірки токена");
}

export async function getChannelInfo(slug, accessToken) {
  return requestWithTokenRefresh(async (token) => {
    console.log(
      `ℹ️ Запит до API для slug: ${slug}, токен: ${token.slice(0, 10)}...`
    );
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS}?slug=${slug}`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("ℹ️ Відповідь API:", response.data);
    const channel = response.data.data?.[0];
    if (!channel) {
      console.error("❌ Канал не знайдено для slug:", slug);
      return null;
    }
    console.log("Отримано broadcaster_user_id:", channel.broadcaster_user_id);
    console.log("Отримано chatroom_id:", channel.chatroom?.id);
    console.log("Отримано channel_id:", channel.id);
    return {
      broadcaster_user_id: channel.broadcaster_user_id,
      chatroom_id: channel.chatroom?.id,
      bot_user_id: channel.user_id,
      channel_id: channel.id,
    };
  }, "Помилка отримання каналу");
}

export async function sendChatMessage(
  broadcasterUserId,
  content,
  accessToken,
  replyToMessageId = null
) {
  return requestWithTokenRefresh(async (token) => {
    console.log(
      `ℹ️ Надсилаємо повідомлення: broadcaster_user_id=${broadcasterUserId}, content="${content}", replyToMessageId=${replyToMessageId}`
    );
    const body = {
      broadcaster_user_id: broadcasterUserId,
      content,
      type: "user",
      ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
    };
    const response = await axios.post(
      API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.CHAT,
      body,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("ℹ️ Відповідь API на повідомлення:", response.data);
    if (response.data.data?.is_sent) {
      console.log(`✅ Повідомлення відправлено: "${content}"`);
      return response.data;
    }
    console.warn(
      "⚠️ Сервер прийняв запит, але is_sent !== true:",
      response.data
    );
    return null;
  }, "Помилка надсилання повідомлення");
}

export async function updateChannel({ streamTitle, categoryId }, accessToken) {
  return requestWithTokenRefresh(async (token) => {
    const body = {};
    if (streamTitle) body.stream_title = streamTitle;
    if (categoryId) body.category_id = Number(categoryId);

    if (!Object.keys(body).length) {
      console.error("❌ Не вказано параметрів для оновлення каналу");
      return null;
    }

    const response = await axios.patch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_CHANNEL}/${process.env.KICK_CHANNEL_SLUG}`,
      body,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("✅ Канал оновлено:", response.data);
    return response.data;
  }, "Помилка оновлення каналу");
}

export async function isModerator(userId, channelId, accessToken) {
  console.log(
    `ℹ️ Перевірка модератора для userId: ${userId} відключена через помилку API`
  );
  return false;
}

export async function findCategoryId(categoryName, accessToken) {
  return requestWithTokenRefresh(async (token) => {
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}/api/v1/categories?search=${encodeURIComponent(
        categoryName
      )}`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const categories = response.data.data || [];
    const category = categories.find(
      (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (!category) {
      console.error(`❌ Категорію "${categoryName}" не знайдено`);
      return null;
    }
    console.log(`ℹ️ Знайдено категорію: ${category.name} (ID: ${category.id})`);
    return category.id;
  }, `Помилка пошуку категорії "${categoryName}"`);
}
