import express from "express";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { updateEnvVariable } from "./utils/saveToken.js";
import { startServer } from "./chatbot.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

let codeVerifierGlobal = "";

function base64urlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function refreshToken() {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("refresh_token", process.env.REFRESH_TOKEN);

    console.log(
      `ℹ️ Спроба оновлення токена з client_id=${process.env.CLIENT_ID?.slice(
        0,
        5
      )}..., refresh_token=${process.env.REFRESH_TOKEN?.slice(0, 5)}...`
    );

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
    console.error(
      "❌ Помилка оновлення токена:",
      error.response?.data || error.message
    );
    if (error.response?.data?.error === "invalid_grant") {
      console.error(
        "⚠️ REFRESH_TOKEN невалідний. Потрібна повторна авторизація через /login."
      );
    }
    return null;
  }
}

app.get("/login", (req, res) => {
  console.log("ℹ️ Запит до /login");
  const codeVerifier = base64urlEncode(crypto.randomBytes(32));
  const codeChallenge = base64urlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  codeVerifierGlobal = codeVerifier;
  const state = crypto.randomBytes(16).toString("hex");

  const scopes = [
    "chat:write",
    "chat:read",
    "channel:read",
    "channel:write",
    "user:read",
    "events:subscribe",
  ];

  const scopeParam = encodeURIComponent(scopes.join(" "));

  const authUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${
    process.env.CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    process.env.REDIRECT_URI
  )}&scope=${scopeParam}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;

  console.log(`ℹ️ Перенаправлення на: ${authUrl}`);
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code, error } = req.query;
  console.log(
    `ℹ️ Запит до /callback: code=${code?.slice(0, 5)}..., error=${error}`
  );

  if (error) {
    console.error(`❌ Помилка авторизації від Kick: ${error}`);
    return res.status(400).send(`Authorization error: ${error}`);
  }

  if (!code) {
    console.error("❌ Код авторизації не надано");
    return res.status(400).send("Authorization code missing");
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("redirect_uri", process.env.REDIRECT_URI);
    params.append("code", code);
    params.append("code_verifier", codeVerifierGlobal);

    console.log(
      `ℹ️ Запит токена з code=${code.slice(0, 5)}..., redirect_uri=${
        process.env.REDIRECT_URI
      }`
    );

    const tokenRes = await axios.post(
      "https://id.kick.com/oauth/token",
      params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    updateEnvVariable("ACCESS_TOKEN", access_token);
    updateEnvVariable("REFRESH_TOKEN", refresh_token);

    console.log("✅ Отримано токен. Запускаємо бота...");

    await startServer(access_token);

    res.send(
      "✅ Успішна авторизація. Бот запущено. <a href='/status'>Check status</a>"
    );
  } catch (err) {
    console.error("❌ Помилка токена:", err.response?.data || err.message);
    res.status(500).send("❌ Помилка авторизації.");
  }
});

app.get("/status", (req, res) => {
  console.log("ℹ️ Запит до /status");
  res.json({
    access_token: process.env.ACCESS_TOKEN?.slice(0, 10) + "...",
    refresh_token: process.env.REFRESH_TOKEN?.slice(0, 10) + "...",
    channel_name: process.env.KICK_CHANNEL_NAME,
    channel_slug: process.env.KICK_CHANNEL_SLUG,
    client_id: process.env.CLIENT_ID?.slice(0, 5) + "...",
    redirect_uri: process.env.REDIRECT_URI,
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(
    `🌐 Будь ласка, пройдіть авторизацію: http://localhost:${PORT}/login`
  );
});
