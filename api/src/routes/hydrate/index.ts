/**
 * Routes /api/hydrate/* — Hydratation frontend depuis le backend
 *
 * Le frontend appelle ces endpoints au chargement pour récupérer
 * les données sans avoir à uploader les fichiers Excel.
 *
 * GET /api/hydrate/crm       → Opportunités + comptes + filtres
 * GET /api/hydrate/staffing   → Records MDS (même format que useFileUpload)
 * GET /api/hydrate/changes    → Modifications utilisateur sauvegardées
 * POST /api/hydrate/changes   → Sauvegarder les modifications utilisateur
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";
import crmRouter from "./crm.js";
import staffingRouter from "./staffing.js";
import metadataRouter from "./metadata.js";
import changesRouter from "./changes.js";
import recruitmentRouter from "./recruitment.js";
import employeesRouter from "./employees.js";
import gridRouter from "./grid.js";

const router = Router();

// ── Mount sub-routers ──

router.use(crmRouter);
router.use(staffingRouter);
router.use(metadataRouter);
router.use(changesRouter);
router.use(recruitmentRouter);
router.use(employeesRouter);
router.use(gridRouter);

// ── GET /api/hydrate/regions ──

router.get("/regions", (_req: Request, res: Response) => {
  try {
    // Use the exhaustive VAR country→region mapping table
    const rows = db
      .prepare(
        "SELECT country, region FROM var_country_region WHERE region IS NOT NULL AND region != '' ORDER BY region, country"
      )
      .all() as { region: string; country: string }[];

    if (rows.length === 0) {
      res.json({ available: false, regions: [] });
      return;
    }

    // Group countries by region
    const regionMap = new Map<string, string[]>();
    for (const row of rows) {
      const countries = regionMap.get(row.region) || [];
      if (row.country && !countries.includes(row.country)) {
        countries.push(row.country);
      }
      regionMap.set(row.region, countries);
    }

    const regions = Array.from(regionMap.entries()).map(([name, countries]) => ({
      name,
      countries: countries.sort(),
    }));

    res.json({ available: true, regions });
  } catch (err) {
    error("hydrate/regions", "Error:", err);
    res.status(500).json({ error: "Error fetching regions." });
  }
});

// ── GET /api/hydrate/ready ──
// Retourne true quand la base a des données dans les tables principales

router.get("/ready", (_req: Request, res: Response) => {
  // Single query instead of 6 separate COUNT queries
  const counts = db
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM crm_opportunities) as opportunities,
      (SELECT COUNT(*) FROM employees) as employees,
      (SELECT COUNT(*) FROM mds_assignments) as assignments,
      (SELECT COUNT(*) FROM sap_records) as sapRecords,
      (SELECT COUNT(*) FROM hr_skills) as skills,
      (SELECT COUNT(*) FROM crm_accounts) as crmAccounts
  `
    )
    .get() as {
    opportunities: number;
    employees: number;
    assignments: number;
    sapRecords: number;
    skills: number;
    crmAccounts: number;
  };

  // Ready if CRM data is available (staffing data is optional — imported separately via Excel)
  const ready = counts.opportunities > 0 || (counts.employees > 0 && counts.assignments > 0);
  res.json({ ready, counts });
});

export default router;
