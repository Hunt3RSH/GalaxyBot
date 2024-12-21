const tmi = require('tmi.js');

// Параметри для бота
const client = new tmi.Client({
    identity: {
        username: 'hunt3rsbot', // Ім'я вашого бота
        password: 'oauth:oxsd08wgp1d6etrg1jhx9zo98d4i9n' // OAuth-токен бота
    },
    channels: ['hunt3r_wtf'] // Ваш канал
});

// Підключення до Twitch
client.connect()
    .then(() => console.log('Bot connected to chat'))
    .catch((err) => console.error('Error connecting bot:', err));

// Реакція на подію рейду
client.on('raided', (channel, username, viewers) => {
    console.log(`${username} зарейдив з ${viewers} глядачами!`);

    // Відправляємо shoutout
    const message = `Дякуємо за рейд, ${username}! Завітайте до них: https://twitch.tv/${username}`;
    client.say(channel, message);
});
