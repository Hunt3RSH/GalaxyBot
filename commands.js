import {
  sendChatMessage,
  updateChannel,
  isModerator,
  findCategoryId,
} from "./api.js";

const COMMANDS = {
  /**
   * Привітання користувача
   */
  hello: {
    matcher: (content) => content === "!hello",
    handler: async (message, broadcasterUserId, accessToken) => {
      await sendChatMessage(
        broadcasterUserId,
        `Привіт, ${message.sender.username}!`,
        accessToken,
        message.id
      );
    },
  },
  /**
   * Додавання до хаос роздачі
   */
  galaxy: {
    matcher: (content) => content === "!galaxy",
    handler: async (message, broadcasterUserId, accessToken) => {
      await sendChatMessage(
        broadcasterUserId,
        `@${message.sender.username}, тебе додано в хаос роздачі! 🚀`,
        accessToken,
        message.id
      );
    },
  },
  /**
   * Інформація про бота
   */
  info: {
    matcher: (content) => content === "!info",
    handler: async (message, broadcasterUserId, accessToken) => {
      await sendChatMessage(
        broadcasterUserId,
        `Я бот для каналу ${process.env.KICK_CHANNEL_NAME}! Пиши !hello, !galaxy, !title або !category для взаємодії. 😎`,
        accessToken,
        message.id
      );
    },
  },
};

export async function handleCommand(
  message,
  broadcasterUserId,
  accessToken,
  channelId
) {
  const content = message.content.toLowerCase();

  // Знаходимо та виконуємо відповідну команду
  for (const [name, { matcher, handler }] of Object.entries(COMMANDS)) {
    if (matcher(content)) {
      try {
        await handler(message, broadcasterUserId, accessToken, channelId);
      } catch (error) {
        console.error(`❌ Помилка при обробці команди ${name}:`, error);
      }
      return;
    }
  }
}
