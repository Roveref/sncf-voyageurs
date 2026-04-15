/**
 * Routes /api/staffing/* — Staffing needs REST API
 *
 * CRUD for staffing needs, candidate matching, and skills catalog.
 * Assignments are managed client-side in user_assignments.
 */

import { Router, Request, Response } from "express";
import db from "../db/database.js";
import { findStaffingCandidates } from "../services/staffing/candidates.js";
import { broadcast } from "./events.js";
import { log } from "../utils/logger.js";
import { createNotification } from "./notifications.js";

const router = Router();

const now = () => new Date().toISOString();

function notifyStaffingChanged(detail?: Record<string, unknown>) {
  broadcast("agent-data-changed", { scope: "staffing", ...detail, timestamp: now() });
}

// ── Helpers ──

function hydrateNeedRow(r: any) {
  return {
    id: r.id,
    opportunityId: r.opportunityId,
    grade: r.grade,
    quantity: r.quantity || 1,
    startDate: r.startDate || "",
    endDate: r.endDate || "",
    utilization: r.utilization ?? 100,
    probability: r.probability ?? 100,
    skills: r.skills ? JSON.parse(r.skills) : [],
    description: r.description || null,
    status: r.status || "open",
    createdAt: r.createdAt || null,
    modifiedAt: r.modifiedAt || null,
  };
}

// ── Needs ──

/** GET /api/staffing/needs — All needs */
router.get("/needs", (_req: Request, res: Response) => {
  const needRows = db
    .prepare(
      "SELECT id, opportunityId, grade, quantity, utilization, startDate, endDate, skills, probability, status, description, createdAt, modifiedAt FROM user_staffing_needs ORDER BY createdAt DESC"
    )
    .all() as any[];
  const needs = needRows.map((r) => hydrateNeedRow(r));
  res.json({ needs });
});

/** POST /api/staffing/needs — Create a need */
router.post("/needs", (req: Request, res: Response) => {
  const { id, opportunityId, grade, quantity, startDate, endDate, utilization, skills, probability, description } =
    req.body;
  if (!id || !opportunityId) {
    res.status(400).json({ error: "id and opportunityId are required" });
    return;
  }

  db.prepare(
    `INSERT INTO user_staffing_needs (id, opportunityId, grade, quantity, startDate, endDate, utilization, skills, probability, description, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    id,
    opportunityId,
    grade ?? null,
    quantity ?? 1,
    startDate ?? null,
    endDate ?? null,
    utilization ?? 100,
    JSON.stringify(skills || []),
    probability ?? null,
    description ?? null,
    now()
  );

  notifyStaffingChanged({ needId: id });
  createNotification(
    "staffing_need",
    `Staffing need created: ${quantity ?? 1}x ${grade || "?"}`,
    `${startDate || ""} → ${endDate || ""}`,
    opportunityId
  );
  res.json({ success: true, id });
});

/** PATCH /api/staffing/needs/:id — Update a need */
router.patch("/needs/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT id FROM user_staffing_needs WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Need not found" });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed = [
    "grade",
    "quantity",
    "startDate",
    "endDate",
    "utilization",
    "skills",
    "probability",
    "description",
    "status",
  ];

  for (const [key, val] of Object.entries(req.body)) {
    if (!allowed.includes(key)) continue;
    const col = key;
    if (col === "skills") {
      fields.push(`${col} = ?`);
      values.push(JSON.stringify(val));
    } else {
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) {
    res.json({ success: true, noChanges: true });
    return;
  }

  fields.push("modifiedAt = ?");
  values.push(now());
  values.push(id);

  db.prepare(`UPDATE user_staffing_needs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  notifyStaffingChanged({ needId: id });
  const need = db.prepare("SELECT opportunityId, grade, quantity FROM user_staffing_needs WHERE id = ?").get(id) as any;
  if (need) {
    createNotification(
      "staffing_need",
      `Staffing need updated: ${need.quantity ?? 1}x ${need.grade || "?"}`,
      req.body.status ? `Status → ${req.body.status}` : undefined,
      need.opportunityId
    );
  }
  res.json({ success: true });
});

/** DELETE /api/staffing/needs/:id — Delete a need */
router.delete("/needs/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const need = db.prepare("SELECT opportunityId, grade, quantity FROM user_staffing_needs WHERE id = ?").get(id) as any;
  db.prepare("DELETE FROM user_staffing_needs WHERE id = ?").run(id);
  notifyStaffingChanged({ needId: id });
  if (need) {
    createNotification(
      "staffing_need",
      `Staffing need deleted: ${need.quantity ?? 1}x ${need.grade || "?"}`,
      undefined,
      need.opportunityId
    );
  }
  res.json({ success: true });
});

// ── Candidates ──

/** GET /api/staffing/candidates — Find candidates for a need */
router.get("/candidates", async (req: Request, res: Response) => {
  const { needId, grade, periodStart, periodEnd, skills, minScore, maxGradeDistance, periodTolerance } = req.query;

  if (!needId && (!periodStart || !periodEnd)) {
    res.status(400).json({ error: "needId or (periodStart + periodEnd) required" });
    return;
  }

  try {
    const candidates = await findStaffingCandidates({
      needId: needId as string | undefined,
      grade: grade as string | undefined,
      skills: skills ? (skills as string).split(",") : undefined,
      periodStart: (periodStart as string) || "",
      periodEnd: (periodEnd as string) || "",
      minScore: minScore ? Number(minScore) : undefined,
      maxGradeDistance: maxGradeDistance ? Number(maxGradeDistance) : undefined,
      periodTolerance: periodTolerance ? Number(periodTolerance) : undefined,
    });

    res.json({ candidates });
  } catch (err: any) {
    log("staffing", `Candidate search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Skills catalog ──

/** GET /api/staffing/skills/catalog — Distinct skills for autocomplete */
router.get("/skills/catalog", (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT name, category, COUNT(DISTINCT empId) as usageCount
     FROM hr_skills
     GROUP BY LOWER(name)
     ORDER BY usageCount DESC`
    )
    .all() as any[];

  res.json({
    skills: rows.map((r) => ({
      name: r.name,
      category: r.category || null,
      usageCount: r.usageCount,
    })),
  });
});

export default router;
