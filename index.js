const tmi = require('tmi.js');

// Параметри для бота
const client = new tmi.Client({
    identity: {
        username: 'hunt3rsbot', // Ім'я вашого бота
        password: 'oauth:oxsd08wgp1d6etrg1jhx9zo98d4i9n' // OAuth-токен бота
    },
    channels: ['hunt3r_wtf'] // Ваш канал
});

// Підключення до чату Twitch
client.connect()
    .then(() => console.log('Bot connected to chat'))
    .catch((err) => console.error('Error connecting bot:', err));

// Реакція на рейд
client.on('raid', (channel, username, viewers) => {
    console.log(`Raid from ${username} with ${viewers} viewers!`);
    client.say(channel, `Дякуємо за рейд, ${username}! Перевірте канал: https://twitch.tv/${username}`);
});

client.on('message', (channel, user, message, self) => {
    // Якщо це повідомлення від бота, ігноруємо його
    if (self) return;

    // Перевірка на використання символу 'Ы' або 'ы'
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
});