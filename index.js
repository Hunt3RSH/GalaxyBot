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

// Періодичні повідомлення
const periodicMessages = [
  "💡 Не забувайте пити воду під час перегляду стріму!",
  "🔥 Підписуйтесь на канал, щоб не пропустити нові стріми!",
  "💬 Ставте свої запитання в чаті — стрімер готовий відповісти!",
  "🎮 Підтримайте стрімерa, використовуючи команду !підтримка",
  "📢 Приєднуйтесь до нашого Discord: https://discord.gg/CSMdbPCHXf",
  "🎥 Запросіть друзів на стрім, чим нас більше — тим цікавіше!",
  "😊 Залишайте ваші коментарі та думки у чаті — це допомагає стрімеру!"
];

// Функція для отримання випадкового індексу
function getRandomIndex(arrayLength) {
  return Math.floor(Math.random() * arrayLength);
}

// Інтервал для періодичних повідомлень (10 хвилин)
setInterval(() => {
  const randomIndex = getRandomIndex(periodicMessages.length);
  const message = periodicMessages[randomIndex];
  client.say("YourChannelName", message);  // Замініть на ваш канал
}, 10 * 60 * 1000); // Інтервал у мілісекундах

// Реакція на рейд
client.on('raid', async (channel, username, viewers) => {
    console.log(`Raid from ${username} with ${viewers} viewers!`);
    await client.say(channel, `Дякуємо за рейд, ${username}! Перевірте канал: https://twitch.tv/${username}`);
});

// Перевірка на використання символу 'Ы' або 'ы'
client.on('message', async (channel, user, message, self) => {
    // Якщо це повідомлення від бота, ігноруємо його
    if (self) return;  // Ігноруємо повідомлення, якщо це повідомлення від бота

    // Перевірка на використання символу 'Ы' або 'ы'
    if (message.includes("Ы") || message.includes("ы")) {
        const warningMessage = `Привіт, @${user["display-name"]}, що за невідомий символ 'Ы' у твоєму повідомленні? Може, це зашифроване послання? Ти точно хочеш, щоб ми зрозуміли?`;
        await client.say(channel, warningMessage);
    }

    // Перевірка на використання слова "да"
    const words = message.toLowerCase().split(/\s+/);
    if (words.includes("да")) {
        const warningMessage = `Попався @${user["display-name"]}, Ого, ти сказав 'да'? Я навіть не знаю, як з цим жити. 😱 Будь ласка, обирай слова мудріше, щоб не впасти в гріх!`;
        await client.say(channel, warningMessage);
    }
});

// Запуск Express серверу на заданому порті
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
