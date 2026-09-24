/**
 * Usage: npm run admin:create -- you@company.com
 * Promotes an existing account to admin, or creates one with a random password printed once.
 */
import { randomBytes, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createDb } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { now } from "../lib/time.js";

dotenv.config({ quiet: true });

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 16 chars from an unambiguous alphabet, without modulo bias. */
export function randomPassword(length = 16): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 256 - (256 % PASSWORD_ALPHABET.length)) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

async function main(): Promise<number> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run admin:create -- <email>");
    return 2;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set (see .env.example)");
    return 2;
  }

  const db = createDb(databaseUrl);
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "admin") {
        console.log(`${email} is already an admin.`);
      } else {
        await db.user.update({ where: { id: existing.id }, data: { role: "admin" } });
        console.log(`Promoted ${email} to admin.`);
      }
      if (existing.disabledAt !== null) console.warn("Warning: this account is disabled; re-enable it before signing in.");
      return 0;
    }

    const password = randomPassword();
    await db.user.create({
      data: {
        id: randomUUID(),
        email,
        name: email.split("@")[0] ?? "Admin",
        passwordHash: await hashPassword(password),
        createdAt: now(),
        role: "admin",
      },
    });
    console.log(`Created admin ${email}`);
    console.log(`Temporary password (shown once): ${password}`);
    return 0;
  } finally {
    await db.$disconnect();
  }
}

process.exitCode = await main();
