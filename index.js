const tmi = require('tmi.js'); // Підключаємо tmi.js для Twitch
const express = require('express'); // Express для веб-сервера
const app = express();
const port = process.env.PORT || 3000;

// ===== Веб-сервер для Glitch =====
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html'); // Показуємо HTML-сторінку
});

app.listen(port, () => {
  console.log(`Web server running on http://localhost:${port}`);
});

// ===== Параметри для підключення до Twitch =====
const options = {
  options: { debug: true }, // Включаємо дебаг
  connection: { reconnect: true },
  identity: {
    username: 'hunt3rsbot', // Логін вашого бота
    password: 'oauth:oxsd08wgp1d6etrg1jhx9zo98d4i9n' // Twitch OAuth токен
  },
  channels: ['hunt3r_wtf'] // Канал, де працюватиме бот
};

const client = new tmi.Client(options);

// ===== Підключення бота до Twitch =====
client.connect().catch(console.error);

// ===== Логіка бота =====
client.on('message', (channel, tags, message, self) => {
  if (self) return; // Ігноруємо повідомлення від самого бота

  const command = message.trim().toLowerCase();

  // Команди бота
  if (command === '!hello') {
    client.say(channel, `Привіт, ${tags.username}! 👋`);
  }

  if (command === '!info') {
    client.say(channel, 'Я простий Twitch-бот, створений для тестування! 🚀');
  }
});

// ===== Обробка помилок =====
client.on('connected', (address, port) => {
  console.log(`Бот підключений до ${address}:${port}`);
});
