/**
 * Route /api/demo — Gestion du mode demo et des dummy data
 *
 * POST /api/demo/activate   → Active le mode demo (switch vers dashboard-demo.db)
 * POST /api/demo/deactivate → Retour aux vraies données
 * POST /api/demo/seed       → (Re)génère les dummy data
 * GET  /api/demo/status     → État actuel (mode + données présentes)
 */

import { Router, type Request, type Response } from "express";
import { isDemoMode, setDemoMode, getDemoDb } from "../db/database.js";
import { seedDemoData, clearDemoData, hasDemoData } from "../services/dummyData.js";
import { setLLMProvider, getLLMProvider } from "../services/llm.js";
import { clearStaffingCaches } from "../services/staffing/shared.js";
import { pauseServicesForDemo, resumeServicesAfterDemo } from "../services/serviceLifecycle.js";
import { waitForImportIdle } from "../services/fileWatcher.js";
import db from "../db/database.js";

const router = Router();

/**
 * Copie les tables var_* (config, optionsets, country_region) de la vraie DB
 * vers la demo DB, pour que les mappings restent cohérents.
 */
export function copyVarTables() {
  const demoDb = getDemoDb();

  // Lire depuis la vraie DB (mode normal)
  const wasDemo = isDemoMode();
  setDemoMode(false);

  const regions = db.prepare("SELECT country, region FROM var_country_region").all() as {
    country: string;
    region: string;
  }[];
  const optionsets = db.prepare("SELECT attribute, value, label FROM var_optionsets").all() as {
    attribute: string;
    value: number;
    label: string;
  }[];
  const config = db.prepare("SELECT category, key, value FROM var_config").all() as {
    category: string;
    key: string;
    value: string;
  }[];

  // Ecrire dans la demo DB directement
  demoDb.exec("DELETE FROM var_country_region");
  demoDb.exec("DELETE FROM var_optionsets");
  demoDb.exec("DELETE FROM var_config");

  const insRegion = demoDb.prepare("INSERT INTO var_country_region (country, region) VALUES (?, ?)");
  for (const r of regions) insRegion.run(r.country, r.region);

  const insOpt = demoDb.prepare("INSERT INTO var_optionsets (attribute, value, label) VALUES (?, ?, ?)");
  for (const o of optionsets) insOpt.run(o.attribute, o.value, o.label);

  const insConf = demoDb.prepare("INSERT INTO var_config (category, key, value) VALUES (?, ?, ?)");
  for (const c of config) insConf.run(c.category, c.key, c.value);

  // Restore mode
  setDemoMode(wasDemo);
}

// GET /api/demo/status
router.get("/status", (_req: Request, res: Response) => {
  res.json({ demo: isDemoMode(), hasData: hasDemoData(), provider: getLLMProvider() });
});

// POST /api/demo/activate
router.post("/activate", async (_req: Request, res: Response) => {
  try {
    // Wait for any in-progress import to finish before switching DB
    await waitForImportIdle(10000).catch(() => {});
    // Pause background services before switching
    pauseServicesForDemo();
    // Copier les var_* depuis la vraie DB
    copyVarTables();
    setDemoMode(true);
    clearStaffingCaches();
    setLLMProvider("claude");
    // Auto-seed si la demo DB est vide
    if (!hasDemoData()) {
      seedDemoData();
    }
    res.json({ demo: true, hasData: true, provider: "claude" });
  } catch (err) {
    console.error("[demo] Activate error:", err);
    res.status(500).json({ error: "Failed to activate demo.", details: String(err) });
  }
});

// POST /api/demo/deactivate
router.post("/deactivate", (_req: Request, res: Response) => {
  setDemoMode(false);
  clearStaffingCaches();
  setLLMProvider("ollama");
  // Resume background services after switching back to real mode
  resumeServicesAfterDemo();
  res.json({ demo: false, provider: "ollama" });
});

// POST /api/demo/seed — Régénère les dummy data (clear + reseed)
router.post("/seed", (_req: Request, res: Response) => {
  try {
    copyVarTables();
    clearStaffingCaches();
    clearDemoData();
    const result = seedDemoData();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[demo] Seed error:", err);
    res.status(500).json({ error: "Failed to seed demo data.", details: String(err) });
  }
});

export default router;
