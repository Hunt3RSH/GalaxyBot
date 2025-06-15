import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export function updateEnvVariable(key, value) {
  const envConfig = fs.readFileSync(".env", "utf-8");
  const lines = envConfig.split("\n");
  let updated = false;

  const newLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    newLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(".env", newLines.join("\n"));
}
