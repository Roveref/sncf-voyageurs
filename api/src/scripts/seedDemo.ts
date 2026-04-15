#!/usr/bin/env tsx
/**
 * Standalone script to seed the demo database.
 * Run: cd api && npx tsx src/scripts/seedDemo.ts [--force]
 *
 * This is the single source of truth for demo data creation.
 * Safe to run multiple times — with --force it clears and reseeds everything.
 * Without --force, only seeds if demo DB is empty/incomplete.
 */

import db, { getDemoDb, setDemoMode } from "../db/database.js";
import { seedDemoData, clearDemoData, hasDemoData } from "../services/dummyData.js";
import { checkDatabase } from "../db/checkDatabase.js";

function copyVarTables() {
  const demoDb = getDemoDb();

  // Read from real DB (proxy in real mode)
  setDemoMode(false);
  const regions = db.prepare("SELECT country, region FROM var_country_region").all() as any[];
  const config = db.prepare("SELECT category, key, value FROM var_config").all() as any[];
  const optionsets = db.prepare("SELECT attribute, value, label FROM var_optionsets").all() as any[];

  // Write to demo DB (direct access)
  demoDb.exec("DELETE FROM var_country_region");
  demoDb.exec("DELETE FROM var_config");
  demoDb.exec("DELETE FROM var_optionsets");

  if (regions.length > 0) {
    const ins = demoDb.prepare("INSERT OR REPLACE INTO var_country_region (country, region) VALUES (?, ?)");
    for (const r of regions) ins.run(r.country, r.region);
  }
  if (config.length > 0) {
    const ins = demoDb.prepare("INSERT OR REPLACE INTO var_config (category, key, value) VALUES (?, ?, ?)");
    for (const c of config) ins.run(c.category, c.key, c.value);
  }
  if (optionsets.length > 0) {
    const ins = demoDb.prepare("INSERT OR REPLACE INTO var_optionsets (attribute, value, label) VALUES (?, ?, ?)");
    for (const o of optionsets) ins.run(o.attribute, o.value, o.label);
  }

  console.log(`  Copied ${regions.length} regions + ${config.length} config + ${optionsets.length} optionsets`);
}

function main() {
  // Ensure schemas exist
  setDemoMode(false);
  checkDatabase();
  setDemoMode(true);
  checkDatabase();
  setDemoMode(false);

  console.log("\n[seed-demo] Copying var_* tables from real DB...");
  copyVarTables();

  console.log("[seed-demo] Clearing existing demo data...");
  clearDemoData();

  console.log("[seed-demo] Seeding demo data...");
  const result = seedDemoData();

  console.log("[seed-demo] Done!");
  console.log(JSON.stringify(result.counts, null, 2));
}

main();
