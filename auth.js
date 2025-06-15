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
    console.error(
      "❌ Помилка оновлення токена:",
      error.response?.data || error.message
    );
    return null;
  }
}

app.get("/login", (req, res) => {
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

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("❗ Відсутній code");

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("redirect_uri", process.env.REDIRECT_URI);
    params.append("code", code);
    params.append("code_verifier", codeVerifierGlobal);

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

    res.send("✅ Успішна авторизація. Бот запущено.");
  } catch (err) {
    console.error("❌ Помилка токена:", err.response?.data || err.message);
    res.status(500).send("❌ Помилка авторизації.");
  }
});

app.listen(PORT, () => {
  console.log(
    `🌐 Будь ласка, пройдіть авторизацію: http://localhost:${PORT}/login`
  );
});
