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

    // GAIF native metric columns — migrate legacy DBs that encoded these in lostComment JSON.
    ensureGaifNativeColumns(opts?.silent ?? false);
    // Rename tables BP → GAIF natives (v2). Idempotent, safe à exécuter à chaque boot.
    migrateTablesToGaifNative(opts?.silent ?? false);
  } catch (err) {
    error("db", "Cannot read database:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAIF v2 — Rename des tables BP → GAIF natives
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_RENAMES: Array<{ from: string; to: string }> = [
  { from: "crm_opportunities", to: "assets" },
  { from: "crm_accounts", to: "sites" },
  { from: "user_opportunities", to: "user_assets" },
  { from: "hr_candidates", to: "nonconformities" },
  { from: "hr_applications", to: "nc_scopes" },
  { from: "user_revenue_team", to: "user_asset_team" },
  { from: "candidate_staffing_match", to: "nc_staffing_match" },
];

const DEPRECATED_TABLES = ["crm_contacts"];

function migrateTablesToGaifNative(silent: boolean): void {
  try {
    const existingTables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name)
    );

    // 1. Rename legacy → GAIF. ALTER TABLE RENAME TO est idempotent si from n'existe plus.
    for (const { from, to } of TABLE_RENAMES) {
      if (existingTables.has(from) && !existingTables.has(to)) {
        try {
          db.prepare(`ALTER TABLE ${from} RENAME TO ${to}`).run();
          if (!silent) log("db", `Renamed ${from} → ${to}`);
          existingTables.delete(from);
          existingTables.add(to);
        } catch (err) {
          warn("db", `Cannot rename ${from} → ${to}:`, err);
        }
      } else if (existingTables.has(from) && existingTables.has(to)) {
        // Les deux existent : cas rare (ex: seed partiel). On garde la nouvelle et drop l'ancienne.
        warn("db", `Both ${from} and ${to} exist — dropping legacy ${from}`);
        try {
          db.prepare(`DROP TABLE ${from}`).run();
        } catch {
          /* ignore */
        }
      }
    }

    // 2. Drop des tables purement BP (inutilisées en GAIF EAM).
    for (const table of DEPRECATED_TABLES) {
      if (existingTables.has(table)) {
        try {
          db.prepare(`DROP TABLE ${table}`).run();
          if (!silent) log("db", `Dropped deprecated table ${table}`);
        } catch (err) {
          warn("db", `Cannot drop ${table}:`, err);
        }
      }
    }

    // 3. Refresh FK si les user_* et gaif_* existaient déjà avec anciennes FK.
    // SQLite ne met pas à jour automatiquement les FK sur RENAME — on doit les vérifier.
    // Ici, pour simplicité, les FK seront corrigées au prochain init_db.py.
  } catch (err) {
    warn("db", "migrateTablesToGaifNative failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAIF — Migration helpers
// ─────────────────────────────────────────────────────────────────────────────

const GAIF_METRIC_COLUMNS: Array<{ name: string; type: string; defaultClause?: string }> = [
  { name: "utilizationPct", type: "REAL" },
  { name: "incidents12m", type: "INTEGER", defaultClause: "DEFAULT 0" },
  { name: "consoEau", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "consoElec", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "consoGaz", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "surfaceM2", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "mtbf", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "mttr", type: "REAL", defaultClause: "DEFAULT 0" },
  { name: "etatAbe", type: "TEXT" },
];

function ensureGaifNativeColumns(silent: boolean): void {
  // Après rename : les tables s'appellent assets / user_assets, mais on vérifie
  // aussi les anciens noms au cas où le rename n'est pas encore fait ce boot.
  for (const tableName of ["assets", "user_assets", "crm_opportunities", "user_opportunities"]) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
      if (cols.length === 0) continue;
      const existing = new Set(cols.map((c) => c.name));
      for (const col of GAIF_METRIC_COLUMNS) {
        if (!existing.has(col.name)) {
          const defaultClause = col.defaultClause ? ` ${col.defaultClause}` : "";
          db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}${defaultClause}`).run();
          if (!silent) log("db", `Added ${col.name} column to ${tableName}`);
        }
      }
    } catch (err) {
      warn("db", `Cannot migrate GAIF columns on ${tableName}:`, err);
    }
  }

  // Create GAIF tables if missing — idempotent via IF NOT EXISTS.
  // Ces CREATE TABLE sont des miroirs du schema.sql (bloc « GAIF — Domain-specific tables »).
  ensureGaifTables(silent);
}

/**
 * Crée les 8 tables GAIF si elles n'existent pas.
 * Miroir du bloc « GAIF — Domain-specific tables » dans api/schema.sql.
 */
function ensureGaifTables(silent: boolean): void {
  const tables: Array<{ name: string; ddl: string; indexes?: string[] }> = [
    {
      name: "gaif_contracts",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_contracts (
        id TEXT PRIMARY KEY,
        prestataire TEXT NOT NULL,
        patrimoine TEXT NOT NULL,
        scope TEXT,
        sites TEXT,
        startDate TEXT,
        endDate TEXT,
        amount REAL,
        perfScore INTEGER,
        managerId TEXT,
        status TEXT DEFAULT 'actif',
        createdAt TEXT,
        updatedAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_contracts_patrimoine ON gaif_contracts(patrimoine)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_contracts_endDate ON gaif_contracts(endDate)",
      ],
    },
    {
      name: "gaif_vr_schedule",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_vr_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT NOT NULL,
        plannedDate TEXT NOT NULL,
        executedDate TEXT,
        vrType TEXT,
        status TEXT DEFAULT 'planifiee',
        inspector TEXT,
        result TEXT,
        comment TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_vr_assetId ON gaif_vr_schedule(assetId)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_vr_planned ON gaif_vr_schedule(plannedDate)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_vr_status ON gaif_vr_schedule(status)",
      ],
    },
    {
      name: "gaif_risks",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_risks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL,
        severity TEXT NOT NULL,
        stage TEXT NOT NULL,
        ownerId TEXT,
        processus TEXT,
        patrimoine TEXT,
        dueDate TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_risks_stage ON gaif_risks(stage)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_risks_kind ON gaif_risks(kind)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_risks_severity ON gaif_risks(severity)",
      ],
    },
    {
      name: "gaif_audits",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_audits (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        scope TEXT,
        plannedDate TEXT NOT NULL,
        completedDate TEXT,
        auditor TEXT,
        status TEXT DEFAULT 'planifie',
        report TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_audits_date ON gaif_audits(plannedDate)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_audits_status ON gaif_audits(status)",
      ],
    },
    {
      name: "gaif_doctrinaire_docs",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_doctrinaire_docs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        version TEXT,
        lastUpdate TEXT,
        owner TEXT,
        status TEXT DEFAULT 'Publié',
        summary TEXT,
        content TEXT,
        url TEXT,
        tags TEXT
      )`,
      indexes: ["CREATE INDEX IF NOT EXISTS idx_gaif_docs_category ON gaif_doctrinaire_docs(category)"],
    },
    {
      name: "gaif_comites",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_comites (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        shortLabel TEXT,
        cadence TEXT NOT NULL,
        coAnimateur TEXT,
        themes TEXT,
        raciLeadId TEXT,
        nextOccurrence TEXT NOT NULL,
        color TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
    },
    {
      name: "gaif_comite_actions",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_comite_actions (
        id TEXT PRIMARY KEY,
        comiteId TEXT NOT NULL REFERENCES gaif_comites(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        ownerId TEXT,
        dueDate TEXT,
        priority TEXT,
        status TEXT DEFAULT 'open',
        decisionDate TEXT,
        outcome TEXT,
        createdAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_comite_actions_comite ON gaif_comite_actions(comiteId)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_comite_actions_status ON gaif_comite_actions(status)",
      ],
    },
    {
      name: "gaif_projects",
      ddl: `CREATE TABLE IF NOT EXISTS gaif_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        patrimoine TEXT,
        siteId TEXT,
        phase INTEGER,
        marqueur TEXT,
        leadId TEXT,
        startDate TEXT,
        endDate TEXT,
        budget REAL,
        budgetByYear TEXT,
        description TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_gaif_projects_patrimoine ON gaif_projects(patrimoine)",
        "CREATE INDEX IF NOT EXISTS idx_gaif_projects_phase ON gaif_projects(phase)",
      ],
    },
  ];

  const existingTables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name)
  );

  for (const t of tables) {
    if (existingTables.has(t.name)) continue;
    try {
      db.exec(t.ddl);
      if (t.indexes) for (const idx of t.indexes) db.exec(idx);
      if (!silent) log("db", `Created GAIF table ${t.name}`);
    } catch (err) {
      warn("db", `Cannot create GAIF table ${t.name}:`, err);
    }
  }
}
