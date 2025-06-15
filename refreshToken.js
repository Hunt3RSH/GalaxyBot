import axios from "axios";
import dotenv from "dotenv";
import { updateEnvVariable } from "./utils/saveToken.js";

dotenv.config();

export async function refreshTokenIfNeeded() {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", process.env.REFRESH_TOKEN);
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);

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

    console.log("🔄 Токен оновлено");

    return access_token;
  } catch (err) {
    console.error(
      "❌ Не вдалося оновити токен:",
      err.response?.data || err.message
    );
    return null;
  }
}
