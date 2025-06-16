import axios from "axios";
import { API_CONFIG } from "./config.js";
import { updateEnvVariable } from "./utils/saveToken.js";

let currentAccessToken = process.env.ACCESS_TOKEN;

function handleError(error, context) {
  const message = error.response?.data || error.message;
  console.error(`❌ ${context}:`, message);
  return null;
}

export async function refreshToken() {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("refresh_token", process.env.REFRESH_TOKEN);

    const res = await axios.post(
      "https://id.kick.com/oauth/token",
      params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token } = res.data;
    updateEnvVariable("ACCESS_TOKEN", access_token);
    updateEnvVariable("REFRESH_TOKEN", refresh_token);
    currentAccessToken = access_token; // Оновлюємо поточний токен
    console.log("✅ Токен оновлено");
    return access_token;
  } catch (error) {
    console.error(
      "❌ Помилка оновлення токена:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function requestWithTokenRefresh(requestFn, context) {
  try {
    return await requestFn(currentAccessToken);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`ℹ️ Отримано 401 для ${context}, оновлюємо токен...`);
      const newToken = await refreshToken();
      if (newToken) {
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
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS}?slug=${slug}`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${token}`,
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
      "Надсилаємо повідомлення з broadcaster_user_id:",
      broadcasterUserId,
      "Вміст:",
      content
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
  return false; // Тимчасово відключено
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
