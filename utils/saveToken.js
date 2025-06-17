import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export function updateEnvVariable(key, value) {
  const envConfig = fs.readFileSync(".env", "utf8").split("\n");
  const index = envConfig.findIndex((line) => line.startsWith(`${key}=`));
  if (index !== -1) {
    envConfig[index] = `${key}=${value}`;
  } else {
    envConfig.push(`${key}=${value}`);
  }
  fs.writeFileSync(".env", envConfig.join("\n"), "utf8");
  process.env[key] = value;
  console.log(`ℹ️ Оновлено .env: ${key}=${value.slice(0, 10)}...`);
}

export function appendToMentionsFile(type, username, timestamp, content) {
  console.log(
    `ℹ️ Виклик appendToMentionsFile: type=${type}, username=${username}, timestamp=${timestamp}, content=${content}`
  );
  if (!type || !username || !timestamp || !content) {
    console.error("❌ Некоректні параметри в appendToMentionsFile:", {
      type,
      username,
      timestamp,
      content,
    });
    return;
  }
  const key = `MENTION_${timestamp.replace(/[- :]/g, "")}`;
  const logEntry = `${timestamp} | ${type} | ${username} | ${content}\n`;
  try {
    fs.appendFileSync("mentions.env", logEntry, "utf8");
    console.log(`ℹ️ Збережено в mentions.env: ${key}`);
  } catch (error) {
    console.error("❌ Помилка запису в mentions.env:", error.message);
  }
}
