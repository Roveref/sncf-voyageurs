import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./database.js";
import { log, warn, error } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "../../schema.sql");

/**
 * Verify that the database schema matches schema.sql.
 *
 * Only checks — does NOT create tables. Run `python3 scripts/init_db.py` to fix.
 *
 * @param opts.silent - If true, only log on error (used for demo DB check)
 */
export function checkDatabase(opts?: { silent?: boolean }) {
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    const tableNames = new Set(tables.map((t) => t.name));

    // Extract expected table names from schema.sql
    const missing: string[] = [];
    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
      const re = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
      let match;
      while ((match = re.exec(schema)) !== null) {
        if (!tableNames.has(match[1])) missing.push(match[1]);
      }
    }

    if (missing.length > 0) {
      warn("db", `Missing ${missing.length} table(s): ${missing.join(", ")}. Run: python3 scripts/init_db.py`);
    } else if (!opts?.silent) {
      log("db", `Schema OK (${tables.length} tables)`);
    }
    // Normalize legacy action statuses → 'open' | 'done'
    try {
      const migrated = db
        .prepare("UPDATE user_actions SET status = 'done' WHERE status IN ('completed', 'in_progress')")
        .run();
      if (migrated.changes > 0) log("db", `Migrated ${migrated.changes} action(s) to normalized status`);
    } catch {
      /* table might not exist */
    }
    // Add assignedTo column to user_staffing_needs if missing
    try {
      const cols = db.prepare("PRAGMA table_info(user_staffing_needs)").all() as { name: string }[];
      if (cols.length > 0 && !cols.some((c) => c.name === "assignedTo")) {
        db.prepare("ALTER TABLE user_staffing_needs ADD COLUMN assignedTo TEXT").run();
        log("db", "Added assignedTo column to user_staffing_needs");
      }
    } catch {
      /* table might not exist */
    }
    // Add crmGuid column to crm_opportunities if missing
    try {
      const cols = db.prepare("PRAGMA table_info(crm_opportunities)").all() as { name: string }[];
      if (cols.length > 0 && !cols.some((c) => c.name === "crmGuid")) {
        db.prepare("ALTER TABLE crm_opportunities ADD COLUMN crmGuid TEXT").run();
        log("db", "Added crmGuid column to crm_opportunities");
      }
    } catch {
      /* table might not exist */
    }
  } catch (err) {
    error("db", "Cannot read database:", err);
  }
}
