import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_PATH = path.resolve(__dirname, "../../dashboard.db");
const DEMO_PATH = path.resolve(__dirname, "../../dashboard-demo.db");

// ── Two connections, one proxy ──

const realDb: DatabaseType = new Database(REAL_PATH);
realDb.pragma("busy_timeout = 5000");
realDb.pragma("foreign_keys = ON");

const demoDb: DatabaseType = new Database(DEMO_PATH);
demoDb.pragma("busy_timeout = 5000");
demoDb.pragma("foreign_keys = ON");

let _isDemo = false;

/**
 * Proxy transparent : tout le code existant importe `db`
 * et obtient automatiquement la bonne connexion (réelle ou demo).
 */
const db: DatabaseType = new Proxy({} as DatabaseType, {
  get(_, prop: string | symbol) {
    const target = _isDemo ? demoDb : realDb;
    const val = (target as any)[prop];
    return typeof val === "function" ? val.bind(target) : val;
  },
});

export function isDemoMode(): boolean {
  return _isDemo;
}

export function setDemoMode(demo: boolean): void {
  _isDemo = demo;
}

/** Accès direct à la demo DB (pour seed/migrations). */
export function getDemoDb(): DatabaseType {
  return demoDb;
}

export default db;
