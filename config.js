export const API_CONFIG = {
  BASE_URL: "https://api.kick.com",
  ENDPOINTS: {
    USER: "/api/v2/user",
    CHANNELS: "/public/v1/channels",
    CHAT: "/public/v1/chat",
    UPDATE_CHANNEL: "/api/v2/channels",
  },
  HEADERS: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

export const CACHE_CONFIG = {
  MESSAGE_TTL: 5 * 60 * 1000, // 5 хвилин
};

export const REQUIRED_ENV = ["KICK_CHANNEL_NAME", "KICK_CHANNEL_SLUG"];
