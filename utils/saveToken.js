import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export function updateEnvVariable(key, value) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(".env"));
    envConfig[key] = value;

    const envContent = Object.entries(envConfig)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    fs.writeFileSync(".env", envContent + "\n");
    console.log(`✅ Оновлено .env: ${key}=${value.slice(0, 10)}...`);
  } catch (error) {
    console.error(`❌ Помилка оновлення .env для ${key}:`, error.message);
  }
}

export function appendToMentionsFile(mentionedUser, byUser, timestamp) {
  const key = `MENTION_${timestamp.replace(/[- :]/g, "")}`;
  const value = `${mentionedUser} mentioned by ${byUser} at ${timestamp}`;
  const line = `${key}=${value}\n`;

  try {
    fs.appendFileSync("mentions.env", line);
    console.log(`✅ Згадку додано до mentions.env: ${key}`);
  } catch (error) {
    console.error(`❌ Помилка запису до mentions.env:`, error.message);
  }
}
