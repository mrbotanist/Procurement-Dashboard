// Creates .env from .env.example with a fresh AUTH_SECRET. Safe to re-run: never overwrites an existing .env.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.log(".env already exists; leaving it unchanged.");
} else {
  const secret = randomBytes(32).toString("base64");
  const env = readFileSync(".env.example", "utf8").replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${secret}"`);
  writeFileSync(".env", env);
  console.log("Created .env with a new AUTH_SECRET.");
}
