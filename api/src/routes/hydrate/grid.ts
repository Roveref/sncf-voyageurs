/**
 * GET /api/hydrate/grid — Returns the full daily grid (breakdown in hours).
 *
 * Computes per-employee per-day segments with hours, plus aggregated metrics.
 * The frontend caches this and applies filters locally.
 * The AI agent uses the same computeGrid() function for on-demand calculations.
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";
import { computeETag, handleConditionalRequest } from "./utils.js";
import { computeGrid } from "../../services/staffing/gridCalc.js";

const router = Router();

router.get("/grid", (req: Request, res: Response) => {
  try {
    // Optional date range params (defaults to COS year in computeGrid)
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    // ETag: fingerprint from assignment + SAP counts + max updatedAt
    const fpRow = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM mds_assignments) as assCnt,
          (SELECT MAX(updatedAt) FROM mds_assignments) as assMax,
          (SELECT COUNT(*) FROM sap_records) as sapCnt,
          (SELECT COUNT(*) FROM employees) as empCnt
        `
      )
      .get() as { assCnt: number; assMax: string | null; sapCnt: number; empCnt: number };

    const fingerprint = computeETag(
      `grid-${fpRow.empCnt}-${fpRow.assCnt}-${fpRow.assMax}-${fpRow.sapCnt}-${start || "default"}-${end || "default"}`
    );
    if (handleConditionalRequest(req, res, fingerprint)) return;

    if (fpRow.empCnt === 0 && fpRow.assCnt === 0) {
      res.json({ available: false });
      return;
    }

    const result = computeGrid(start, end);

    res.json({
      available: true,
      calendar: result.calendar,
      grid: result.grid,
      stats: { computeMs: result.computeMs, employees: Object.keys(result.grid).length },
    });
  } catch (err) {
    error("hydrate/grid", "Error:", err);
    res.status(500).json({ error: "Error computing staffing grid." });
  }
});

export default router;
