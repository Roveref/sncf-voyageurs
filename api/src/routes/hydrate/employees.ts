/**
 * GET /api/hydrate/employees — Returns pre-enriched Employee[] from the server.
 *
 * Replaces the client-side useDataPipeline by doing all enrichment server-side:
 * - Assignment consolidation + period normalization
 * - Metadata merge (grade history, arrival/departure)
 * - SAP grade detection (MAGR → grade)
 * - Skills enrichment
 * - Manager hierarchy
 * - Search index
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";
import { computeETag, handleConditionalRequest } from "./utils.js";
import { buildEnrichedEmployees } from "../../services/staffing/enrichment.js";

const router = Router();

router.get("/employees", (req: Request, res: Response) => {
  try {
    // ETag: fingerprint from employee + assignment + skill counts + max updatedAt
    const fpRow = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM employees) as empCnt,
          (SELECT COUNT(*) FROM mds_assignments) as assCnt,
          (SELECT MAX(updatedAt) FROM mds_assignments) as assMax,
          (SELECT COUNT(*) FROM hr_skills) as skillCnt,
          (SELECT COUNT(*) FROM sap_records) as sapCnt
        `
      )
      .get() as { empCnt: number; assCnt: number; assMax: string | null; skillCnt: number; sapCnt: number };

    const fingerprint = computeETag(
      `employees-${fpRow.empCnt}-${fpRow.assCnt}-${fpRow.assMax}-${fpRow.skillCnt}-${fpRow.sapCnt}`
    );
    if (handleConditionalRequest(req, res, fingerprint)) return;

    if (fpRow.empCnt === 0 && fpRow.assCnt === 0) {
      res.json({ available: false });
      return;
    }

    const result = buildEnrichedEmployees();

    res.json({
      available: true,
      employees: result.employees,
      managerList: result.managerList,
      stats: result.stats,
    });
  } catch (err) {
    error("hydrate/employees", "Error:", err);
    res.status(500).json({ error: "Error building enriched employees." });
  }
});

export default router;
