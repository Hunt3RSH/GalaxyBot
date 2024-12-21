const express = require('express');
const tmi = require('tmi.js');

// Ініціалізація додатку Express
const app = express();

// Встановлюємо порт із змінної середовища (Render надає порт через process.env.PORT)
// або використовуємо 3000 для локального запуску
const port = process.env.PORT || 3000;

// Параметри для бота
const client = new tmi.Client({
    identity: {
        username: 'hunt3rsbot', // Ім'я вашого бота
        password: 'oauth:oxsd08wgp1d6etrg1jhx9zo98d4i9n' // OAuth-токен бота
    },
    channels: ['hunt3r_wtf'] // Ваш канал
});

// Підключення до чату Twitch
async function connectBot() {
    try {
        await client.connect();
        console.log('Bot connected to chat');
    } catch (err) {
        console.error('Error connecting bot:', err);
    }
}

// Виклик функції для підключення
connectBot();

// Команди для чату
const commands = {
  "!github": "https://github.com/Hunt3RSH",
  "!дс": "посилання на мій діскорд сервер https://discord.gg/CSMdbPCHXf",
  "!інста":
    "свіжі фотки, мого не свіжого інстаграму https://www.instagram.com/hunt3r_npc",
  "!ланки":
    "виробничі ланки ферми https://clan.cloudflare.steamstatic.com/images//45074709/c62569da04ae0daaaecbd810dec8255186bf39b1.jpg",
  "!підтримка":
    "'MONAпідтримка': - це дуже легкий і гарний спосіб підтримати стрімера ось цим посиланням https://send.monobank.ua/jar/8GgAujGTyF",
  "!стім": "посилання на мій стім https://steamcommunity.com/id/Hunt3R_wise/",
  "!трейд":
    "https://steamcommunity.com/tradeoffer/new/?partner=144581493&token=vfpzrhJzn",
  "!dpi": "DPI: 800",
  "!x": "тут я пишу інколи якісь пости https://x.com/Hunt3R__DEV",
};

// Періодичні повідомлення
const periodicMessages = [
  "💡 Не забувайте пити воду під час перегляду стріму!",
  "🔥 Підписуйтесь на канал, щоб не пропустити нові стріми!",
  "💬 Ставте свої запитання в чаті — стрімер готовий відповісти!",
  "🎮 Підтримайте стрімерa, використовуючи команду !підтримка",
  "📢 Приєднуйтесь до нашого Discord: https://discord.gg/CSMdbPCHXf",
  "🎥 Запросіть друзів на стрім, чим нас більше — тим цікавіше!",
  "😊 Залишайте ваші коментарі та думки у чаті — це допомагає стрімеру!",
];

let messageIndex = 0;

// Функція для надсилання повідомлень послідовно
setInterval(() => {
  if (messageIndex < periodicMessages.length) {
    const message = periodicMessages[messageIndex];
    client.say("hunt3r_wtf", message); // Замініть на ваш канал
    messageIndex++; // Переходимо до наступного повідомлення
  } else {
    // Якщо всі повідомлення відправлені, повертаємось до першого
    messageIndex = 0;
  }
}, 10 * 60 * 1000); // Інтервал у 10 хвилин (600 000 мс)

// Автоматичний shoutout при рейді
client.on('raid', (channel, user, viewers) => {
  const raidMessage = `🎉 Великий рейд від ${user.username} з ${viewers} глядачами! 🥳 Подивіться на канал ${user.username} і підпишіться!`;
  client.say(channel, raidMessage); // Відправляємо шатаут у ваш канал
});

// Обробка чат повідомлень
client.on("chat", async (channel, user, message, self) => {
  if (self) return; // Ігноруємо повідомлення від самого бота

  // Перевірка на використання символу 'Ы'
  if (message.includes("Ы") || message.includes("ы")) {
    const warningMessage = `Привіт, @${user["display-name"]}, що за невідомий символ 'Ы' у твоєму повідомленні? Може, це зашифроване послання? Ти точно хочеш, щоб ми зрозуміли?`;
    client.say(channel, warningMessage);
  }

  // Перевірка на використання слова "да"
  const words = message.toLowerCase().split(/\s+/);
  if (words.includes("да")) {
    const warningMessage = `Попався @${user["display-name"]}, Ого, ти сказав 'да'? Я навіть не знаю, як з цим жити. 😱 Будь ласка, обирай слова мудріше, щоб не впасти в гріх!`;
    client.say(channel, warningMessage);
  }

  // Обробка команд
  if (message.startsWith("!любов")) {
    const args = message.split(" ");
    const targetUser = args[1];

    if (!targetUser || targetUser === `@${user["username"]}`) {
      client.say(
        channel,
        `@${user["display-name"]}, вкажіть ім'я іншого користувача! Наприклад: !любов @Streamer`
      );
    } else {
      const compatibility = Math.floor(Math.random() * 100) + 1;
      client.say(
        channel,
        `@${user["display-name"]} та ${targetUser} підходять на ${compatibility}% 💕`
      );
    }
  }

  if (message.startsWith("!розмір")) {
    const n = Math.floor(Math.random() * 50) + 1;
    const username = user["display-name"];
    let response = "";

    if (n <= 15) {
      response = `😅 Ну що, ${username}, головне не розмір, а харизма! ${n} см`;
    } else if (n <= 35) {
      response = `👌 ${username}, цілком гідний результат! Тримайся впевнено ${n} см`;
    } else {
      response = `🔥 ${username}, ну це вже рекорд! Вражаючі показники ${n} см 💪`;
    }

    client.say(channel, response);
  }

  if (message.startsWith("!розумник")) {
    const username = user["display-name"];
    const categories = {
      wise: [
        `${username}, пий більше води! 💧`,
        `Якщо хочеш змін, почни з себе, ${username}! ✨`,
        `Твій день буде успішним, ${username}, якщо почнеш із посмішки! 😊`,
      ],
      funny: [
        `${username}, не забудь: ти геній, тільки ніхто цього не помітив! 🤔`,
        `${username}, не намагайся бути ідеальним — це вже моє місце 😎`,
      ],
    };

    const category = ["wise", "funny"][Math.floor(Math.random() * 2)];
    const response =
      categories[category][
        Math.floor(Math.random() * categories[category].length)
      ];
    client.say(channel, response);
  }

  if (message.startsWith("!хто")) {
    const users = [
      `Ти сам, @${user["username"]}`,
      "Модератор @justbios",
      "Кіт на клавіатурі",
      "Рандомний незнайомець",
      "Автор стріму",
    ];
    const reasons = [
      "найрозумніший у чаті!",
      "трохи запізнився на вечірку, але все ще крутий!",
      "справжній гуру геймінгу!",
    ];
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomReason = reasons[Math.floor(Math.random() * reasons.length)];

    client.say(channel, `${randomUser} — ${randomReason}`);
  }
if (message.startsWith("!пиво")) {
    const beerMessages = [
        `🍺 @${user["display-name"]}, це твоє пиво. Насолоджуйся!`,
        `🥳 Ось твоє пиво, @${user['display-name']}! Випий за перемогу!`,
        `🍻 Пиво для @${user['display-name']}. Тепер вечір точно буде вдалим!`
    ];
    const randomBeerMessage = beerMessages[Math.floor(Math.random() * beerMessages.length)];
    client.say(channel, randomBeerMessage);
}

  // Перевірка на команди
  if (message.startsWith("!")) {
    const command = message.split(" ")[0];
    if (commands[command]) {
      client.say(channel, commands[command]);
    }
  }
});

// Запуск Express серверу на заданому порті
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
