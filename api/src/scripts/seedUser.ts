/**
 * Seed a user into var_auth.
 * Usage: npx tsx src/scripts/seedUser.ts <username> <password> [displayName]
 */

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../dashboard.db");

const [, , username, password, displayName] = process.argv;

if (!username || !password) {
  console.error("Usage: npx tsx src/scripts/seedUser.ts <username> <password> [displayName]");
  process.exit(1);
}

const db = new Database(dbPath);
const hash = await bcrypt.hash(password, 10);
const now = new Date().toISOString();

db.prepare(
  `INSERT INTO var_auth (username, passwordHash, displayName, createdAt)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(username) DO UPDATE SET passwordHash = ?, displayName = ?`
).run(username, hash, displayName || username, now, hash, displayName || username);

console.log(`User "${username}" created/updated.`);
db.close();
