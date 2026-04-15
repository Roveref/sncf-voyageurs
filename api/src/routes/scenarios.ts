/**
 * Routes /api/scenarios — CRUD scénarios what-if
 */

import { Router, Request, Response } from "express";
import db from "../db/database.js";
import { createNotification } from "./notifications.js";

const router = Router();

// GET /api/scenarios
router.get("/", (_req: Request, res: Response) => {
  const rows = db
    .prepare("SELECT id, name, baseId, overrides, empOverrides, createdAt FROM user_scenarios ORDER BY createdAt DESC")
    .all();
  res.json({ scenarios: rows });
});

// GET /api/scenarios/:id
router.get("/:id", (req: Request, res: Response) => {
  const scenario = db
    .prepare("SELECT id, name, baseId, overrides, empOverrides, createdAt FROM user_scenarios WHERE id = ?")
    .get(req.params.id);
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found." });
    return;
  }
  res.json({ scenario });
});

// POST /api/scenarios
router.post("/", (req: Request, res: Response) => {
  const { id, name, baseId, overrides, empOverrides } = req.body;

  if (!id || !name) {
    res.status(400).json({ error: "id and name are required." });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_scenarios (id, name, baseId, overrides, empOverrides, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, baseId || null, JSON.stringify(overrides || {}), JSON.stringify(empOverrides || {}), now);

  createNotification("crm_update", `Scenario created: ${name}`);
  res.status(201).json({ success: true, id });
});

// PUT /api/scenarios/:id
router.put("/:id", (req: Request, res: Response) => {
  const { name, overrides, empOverrides } = req.body;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) {
    sets.push("name = ?");
    params.push(name);
  }
  if (overrides !== undefined) {
    sets.push("overrides = ?");
    params.push(JSON.stringify(overrides));
  }
  if (empOverrides !== undefined) {
    sets.push("empOverrides = ?");
    params.push(JSON.stringify(empOverrides));
  }

  if (sets.length === 0) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  params.push(req.params.id);
  const result = db.prepare(`UPDATE user_scenarios SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  if (result.changes === 0) {
    res.status(404).json({ error: "Scenario not found." });
    return;
  }

  createNotification("crm_update", `Scenario updated: ${name || req.params.id}`);
  res.json({ success: true });
});

// DELETE /api/scenarios/:id
router.delete("/:id", (req: Request, res: Response) => {
  const scenario = db.prepare("SELECT name FROM user_scenarios WHERE id = ?").get(req.params.id) as
    | { name: string }
    | undefined;
  db.prepare("DELETE FROM user_scenarios WHERE id = ?").run(req.params.id);
  createNotification("crm_update", `Scenario deleted: ${scenario?.name || req.params.id}`);
  res.json({ success: true });
});

export default router;
