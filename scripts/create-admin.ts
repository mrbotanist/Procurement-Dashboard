// Create (or reset) an admin user:
//   npm run create-admin -- --email you@store.ae --name "Your Name" --password "a long password"
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/prisma-client";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Admin";
  const password = arg("password") ?? process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) {
    console.log('Usage: npm run create-admin -- --email you@store.ae --name "Your Name" --password "at least 10 characters"');
    process.exit(1);
  }
  const db = createPrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.upsert({ where: { email }, update: { name, passwordHash, role: "ADMIN", active: true }, create: { email, name, passwordHash, role: "ADMIN" } });
  console.log(`Admin ${email} is ready. Sign in at http://localhost:3000`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
