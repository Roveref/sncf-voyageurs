/**
 * Backup automatique des tables user_*
 *
 * Deux fichiers séparés :
 * - backups/user_data_real.json    → données réelles (dashboard.db)
 * - backups/user_data_demo.json    → données demo (dashboard-demo.db)
 *
 * Le mode actif (isDemoMode) détermine quel fichier est utilisé.
 * Jamais de cross-contamination entre real et demo.
 */

import db, { isDemoMode } from "../db/database.js";
import fs from "fs";
import path from "path";
import { log, debug } from "../utils/logger.js";

const BACKUP_DIR = path.resolve("backups");
const REAL_FILE = path.join(BACKUP_DIR, "user_data_real.json");
const DEMO_FILE = path.join(BACKUP_DIR, "user_data_demo.json");
const MAX_HISTORY = 5;

function getBackupFile(): string {
  return isDemoMode() ? DEMO_FILE : REAL_FILE;
}

function getLabel(): string {
  return isDemoMode() ? "demo" : "real";
}

// Tables to backup — SECURITY: this whitelist is the ONLY source for table names
// used in dynamic SQL. Never derive table names from user input.
const USER_TABLES = [
  "user_overrides",
  "user_opportunities",
  "user_employees",
  "user_actions",
  "user_staffing_needs",
  "user_assignments",
  "user_accounts",
  "user_revenue_team",
  "user_scenarios",
] as const;

const USER_TABLES_SET = new Set<string>(USER_TABLES);

/** Validate table name against whitelist before using in dynamic SQL */
function assertSafeTable(table: string): void {
  if (!USER_TABLES_SET.has(table)) {
    throw new Error(`Backup: refused to operate on non-whitelisted table "${table}"`);
  }
}

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Dump all user_* tables to JSON (real or demo depending on mode).
 */
export function backupUserData(): { tables: number; rows: number; file: string } {
  ensureDir();

  const backupFile = getBackupFile();
  const label = getLabel();

  const data: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of USER_TABLES) {
    try {
      assertSafeTable(table);
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length > 0) {
        data[table] = rows;
        totalRows += rows.length;
      }
    } catch {
      // Table might not exist yet
    }
  }

  if (totalRows === 0) {
    log("backup", `[${label}] No user data to backup.`);
    return { tables: 0, rows: 0, file: "" };
  }

  const payload = JSON.stringify({ timestamp: new Date().toISOString(), mode: label, data }, null, 2);

  // Rotate: rename current to timestamped
  if (fs.existsSync(backupFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
      const ts = (existing.timestamp || new Date().toISOString()).replace(/[:.]/g, "-");
      const histFile = path.join(BACKUP_DIR, `user_data_${label}_${ts}.json`);
      fs.renameSync(backupFile, histFile);

      // Clean old history for this mode
      const prefix = `user_data_${label}_`;
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith(prefix))
        .sort()
        .reverse();
      for (const f of files.slice(MAX_HISTORY)) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
      }
    } catch {
      /* ignore rotation errors */
    }
  }

  fs.writeFileSync(backupFile, payload);

  const tableCount = Object.keys(data).length;
  log("backup", `[${label}] Backed up ${totalRows} rows from ${tableCount} tables`);
  return { tables: tableCount, rows: totalRows, file: backupFile };
}

/**
 * Restore user_* data from backup matching current mode.
 * Only restores tables that are currently empty.
 */
export function restoreUserData(): { tables: number; rows: number } | null {
  const backupFile = getBackupFile();
  const label = getLabel();

  if (!fs.existsSync(backupFile)) {
    log("backup", `[${label}] No backup file found.`);
    return null;
  }

  let backup: { timestamp: string; mode?: string; data: Record<string, Record<string, unknown>[]> };
  try {
    backup = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
  } catch {
    log("backup", `[${label}] Failed to parse backup file.`);
    return null;
  }

  // Safety: reject if backup mode doesn't match current mode
  if (backup.mode && backup.mode !== label) {
    log("backup", `[${label}] Backup mode mismatch (backup=${backup.mode}, current=${label}). Skipping restore.`);
    return null;
  }

  let totalRows = 0;
  let tableCount = 0;

  // Disable FK checks BEFORE transaction (SQLite ignores pragma inside transactions)
  db.pragma("foreign_keys = OFF");

  const restoreAll = db.transaction(() => {
    for (const [table, rows] of Object.entries(backup.data)) {
      if (!rows || rows.length === 0) continue;
      if (!USER_TABLES_SET.has(table)) continue; // Skip non-whitelisted tables

      // Only restore if table is empty
      try {
        const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
        if (count > 0) continue; // Table has data, skip
      } catch {
        continue; // Table doesn't exist
      }

      const columns = Object.keys(rows[0]);
      // Validate column names: only allow alphanumeric + underscore
      const safeColumns = columns.filter((c) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));
      if (safeColumns.length !== columns.length) continue; // Skip if any column name looks suspicious
      const placeholders = safeColumns.map(() => "?").join(", ");
      const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (${safeColumns.join(", ")}) VALUES (${placeholders})`);

      for (const row of rows) {
        stmt.run(...safeColumns.map((c) => row[c] ?? null));
      }

      totalRows += rows.length;
      tableCount++;
      debug("backup", `  [${label}] Restored ${rows.length} rows → ${table}`);
    }
  });

  restoreAll();
  db.pragma("foreign_keys = ON");

  if (tableCount > 0) {
    log(
      "backup",
      `[${label}] Restored ${totalRows} rows across ${tableCount} tables from backup (${backup.timestamp})`
    );
  } else {
    log("backup", `[${label}] All tables already have data, nothing to restore.`);
  }

  return { tables: tableCount, rows: totalRows };
}

/**
 * Check if user tables are empty (= need restore).
 */
export function userTablesEmpty(): boolean {
  for (const table of USER_TABLES) {
    try {
      assertSafeTable(table);
      const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
      if (count > 0) return false;
    } catch {
      continue;
    }
  }
  return true;
}

// ── Periodic backup ──

let backupInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicBackup(intervalMs = 60 * 60 * 1000) {
  // Initial backup
  backupUserData();

  // Then every hour
  backupInterval = setInterval(() => {
    backupUserData();
  }, intervalMs);

  log("backup", `Periodic backup started (every ${Math.round(intervalMs / 60000)} min)`);
}

export function stopPeriodicBackup() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}
