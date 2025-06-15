import axios from "axios";
import { API_CONFIG } from "./config.js";
import { updateEnvVariable } from "./utils/saveToken.js";

function handleError(error, context) {
  const message = error.response?.data || error.message;
  console.error(`❌ ${context}:`, message);
  return null;
}

export async function checkToken(accessToken) {
  try {
    const response = await axios.get(
      API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.USER,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log("✅ Дані користувача:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Токен, що використовується:",
      accessToken.slice(0, 10) + "..."
    );
    return handleError(error, "Помилка перевірки токена");
  }
}

export async function getChannelInfo(slug, accessToken) {
  try {
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS}?slug=${slug}`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${accessToken}`,
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
  } catch (error) {
    return handleError(error, "Помилка отримання каналу");
  }
}

export async function sendChatMessage(
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
          Authorization: `Bearer ${accessToken}`,
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
  } catch (error) {
    return handleError(error, "Помилка надсилання повідомлення");
  }
}

async function refreshToken() {
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
    console.log("✅ Токен оновлено");
    return access_token;
  } catch (error) {
    return handleError(error, "Помилка оновлення токена");
  }
}

export async function updateChannel({ streamTitle, categoryId }, accessToken) {
  try {
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
          Authorization: `Bearer ${accessToken}`,
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
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_CHANNEL}/${process.env.KICK_CHANNEL_SLUG}`,
            body,
            {
              headers: {
                ...API_CONFIG.HEADERS,
                Authorization: `Bearer ${newToken}`,
              },
            }
          );
          console.log(
            "✅ Канал оновлено після оновлення токена:",
            retryResponse.data
          );
          return retryResponse.data;
        } catch (retryError) {
          return handleError(retryError, "Помилка після оновлення токена");
        }
      }
    }
    return null;
  }
}

export async function isModerator(userId, channelId, accessToken) {
  try {
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}/api/v2/channels/${channelId}/moderators`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const moderators = response.data.data || [];
    const isMod = moderators.some((mod) => mod.user_id === userId);
    console.log(`ℹ️ Користувач ${userId} ${isMod ? "є" : "не є"} модератором`);
    return isMod;
  } catch (error) {
    console.error(
      "❌ Помилка перевірки модератора:",
      error.response?.data || error.message
    );
    return false;
  }
}

export async function findCategoryId(categoryName, accessToken) {
  try {
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}/api/v1/categories?search=${encodeURIComponent(
        categoryName
      )}`,
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${accessToken}`,
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
  } catch (error) {
    return handleError(error, `Помилка пошуку категорії "${categoryName}"`);
  }
}
