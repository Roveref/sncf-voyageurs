#!/usr/bin/env tsx
/**
 * Standalone script to seed the demo database with GAIF Pilot data.
 * Run: cd api && npx tsx src/scripts/seedGaifDemo.ts [--force]
 *
 * Safe to run multiple times — with --force it clears and reseeds everything.
 */

import db, { getDemoDb, setDemoMode } from "../db/database.js";
import { seedGaifData, clearGaifData, hasGaifData } from "../services/gaifSeedData.js";
import { checkDatabase } from "../db/checkDatabase.js";

function copyVarTables() {
  const demoDb = getDemoDb();

  setDemoMode(false);
  const regions = db.prepare("SELECT country, region FROM var_country_region").all() as any[];
  const config = db.prepare("SELECT category, key, value FROM var_config").all() as any[];
  const optionsets = db.prepare("SELECT attribute, value, label FROM var_optionsets").all() as any[];

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
  const force = process.argv.includes("--force");

  setDemoMode(false);
  checkDatabase();
  setDemoMode(true);
  checkDatabase();
  setDemoMode(false);

  console.log("\n[seed-gaif] Copying var_* tables from real DB...");
  copyVarTables();

  // Seed demo DB
  setDemoMode(true);
  if (force || !hasGaifData()) {
    console.log("[seed-gaif] Clearing existing demo DB data...");
    clearGaifData();
    console.log("[seed-gaif] Seeding GAIF Pilot data into demo DB...");
    const result = seedGaifData();
    console.log("[seed-gaif] Demo DB done: " + JSON.stringify(result.counts));
  } else {
    console.log("[seed-gaif] Demo DB already has GAIF data. Use --force to reseed.");
  }

  // Seed real DB too (so the app works without demo mode toggle)
  setDemoMode(false);
  if (force || !hasGaifData()) {
    console.log("[seed-gaif] Clearing existing real DB data...");
    clearGaifData();
    console.log("[seed-gaif] Seeding GAIF Pilot data into real DB...");
    const result = seedGaifData();
    console.log("[seed-gaif] Real DB done: " + JSON.stringify(result.counts));
  } else {
    console.log("[seed-gaif] Real DB already has GAIF data. Use --force to reseed.");
  }
}

main();
