/**
 * Routes /api/data/* — CRUD sur les données métier
 *
 * Endpoints pour lire et écrire les employés, opportunités,
 * assignments, skills, actions, staffing needs.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import db from "../db/database.js";
import { validate } from "../middleware/validate.js";
import { logAudit } from "../utils/audit.js";
import { createNotification } from "./notifications.js";

const router = Router();

// ── Validation schemas ──

const paginationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .passthrough();

const createOpportunityBody = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  account: z.string().max(500).optional(),
  status: z.number().int().optional(),
  grossRevenue: z.number().optional(),
  netRevenue: z.number().optional(),
  winPct: z.number().min(0).max(100).optional(),
  segment: z.string().max(100).optional(),
  manager: z.string().max(200).optional(),
  partner: z.string().max(200).optional(),
});

// ── Employees ──

router.get("/employees", validate({ query: paginationQuery }), (req: Request, res: Response) => {
  const { grade, team, search, limit = 100, offset = 0 } = req.query;

  let sql = `
    SELECT e.*, COUNT(a.id) as assignmentCount
    FROM employees e
    LEFT JOIN mds_assignments a ON e.empId = a.empId AND a.endDate >= date('now')
    WHERE (e.departureDate IS NULL OR e.departureDate > date('now'))
  `;
  const params: unknown[] = [];

  if (grade) {
    sql += " AND e.grade = ?";
    params.push(grade);
  }
  if (team) {
    sql += " AND e.subTeam = ?";
    params.push(team);
  }
  if (search) {
    sql += " AND (LOWER(e.name) LIKE ? OR e.empId LIKE ?)";
    params.push(`%${String(search).toLowerCase()}%`, `%${search}%`);
  }

  sql += " GROUP BY e.empId ORDER BY e.name ASC";
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json({ employees: rows });
});

router.get("/employees/:empId", (req: Request, res: Response) => {
  const employee = db
    .prepare(
      "SELECT empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate, gradeHistory FROM employees WHERE empId = ?"
    )
    .get(req.params.empId);
  if (!employee) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const assignments = db
    .prepare(
      "SELECT id, empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay FROM mds_assignments WHERE empId = ? ORDER BY startDate DESC"
    )
    .all(req.params.empId);

  const skills = db
    .prepare("SELECT id, empId, name, level, category FROM hr_skills WHERE empId = ? ORDER BY level DESC")
    .all(req.params.empId);

  res.json({ employee, assignments, skills });
});

// ── Opportunities ──

router.get("/opportunities", validate({ query: paginationQuery }), (req: Request, res: Response) => {
  const { status, search, segment, limit = 100, offset = 0 } = req.query;

  let sql = `SELECT opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue,
              winPct, cm1Pct, jobCode, engagementType, weightedBooking,
              creationDate, bookingDate, estimatedBookingDate,
              lastStatusChangeDate, manager, partner, em, ep,
              country, region, subSegmentCode, subSegment,
              serviceLine1, serviceLine2, serviceLine3,
              serviceOffering1, serviceOffering2, serviceOffering3
       FROM assets WHERE 1=1`;
  const params: unknown[] = [];

  if (status) {
    const statuses = String(status).split(",").map(Number);
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (search) {
    sql += " AND (LOWER(opportunity) LIKE ? OR LOWER(account) LIKE ? OR opportunityId LIKE ?)";
    const s = `%${String(search).toLowerCase()}%`;
    params.push(s, s, `%${search}%`);
  }
  if (segment) {
    sql += " AND subSegmentCode = ?";
    params.push(segment);
  }

  sql += " ORDER BY grossRevenue DESC";
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json({ opportunities: rows });
});

router.get("/opportunities/:id", (req: Request, res: Response) => {
  const opp = db
    .prepare(
      `SELECT opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue,
            winPct, cm1Pct, jobCode, engagementType, weightedBooking,
            creationDate, bookingDate, estimatedBookingDate,
            lastStatusChangeDate, manager, partner, em, ep,
            country, region, subSegmentCode, subSegment
     FROM assets WHERE opportunityId = ?`
    )
    .get(req.params.id);
  if (!opp) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }

  const actions = db
    .prepare(
      "SELECT opportunityId, opportunityId, description, owner, dueDate, priority, status, createdAt FROM user_actions WHERE opportunityId = ? ORDER BY createdAt DESC"
    )
    .all(req.params.id);
  const needs = db
    .prepare(
      "SELECT id, opportunityId, grade, quantity, utilization, startDate, endDate, skills, probability, status, description, assignedTo FROM user_staffing_needs WHERE opportunityId = ?"
    )
    .all(req.params.id);

  res.json({ opportunity: opp, actions, staffingNeeds: needs });
});

router.post("/opportunities", validate({ body: createOpportunityBody }), (req: Request, res: Response) => {
  const { id, name, account, status, grossRevenue, netRevenue, winPct, segment, manager, partner } = req.body;
  const username = (req as any).user?.username || "anonymous";

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_assets (opportunityId, opportunity, account, status, grossRevenue, netRevenue, winPct, subSegmentCode, manager, partner, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    account || null,
    status || 1,
    grossRevenue || null,
    netRevenue || null,
    winPct || null,
    segment || null,
    manager || null,
    partner || null,
    now,
    now
  );

  logAudit(username, "create_opportunity", "opportunity", id, name);
  createNotification("opportunity", `New opportunity: ${name}`, `${account || ""} — by ${username}`, id);
  res.status(201).json({ success: true, id });
});

router.put("/opportunities/:id", (req: Request, res: Response) => {
  const { name, account, status, grossRevenue, netRevenue, winPct, segment, manager, partner } = req.body;
  const username = (req as any).user?.username || "anonymous";
  const now = new Date().toISOString();

  // Try user_assets first, then assets
  const userResult = db
    .prepare(
      `UPDATE user_assets SET
      opportunity = COALESCE(?, opportunity),
      account = COALESCE(?, account),
      status = COALESCE(?, status),
      grossRevenue = COALESCE(?, grossRevenue),
      netRevenue = COALESCE(?, netRevenue),
      winPct = COALESCE(?, winPct),
      subSegmentCode = COALESCE(?, subSegmentCode),
      manager = COALESCE(?, manager),
      partner = COALESCE(?, partner),
      updatedAt = ?
     WHERE opportunityId = ?`
    )
    .run(name, account, status, grossRevenue, netRevenue, winPct, segment, manager, partner, now, req.params.id);

  if (userResult.changes > 0) {
    logAudit(username, "update_opportunity", "opportunity", String(req.params.id));
    createNotification(
      "crm_update",
      `Opportunity updated: ${name || req.params.id}`,
      `by ${username}`,
      String(req.params.id)
    );
    res.json({ success: true });
    return;
  }

  const crmResult = db
    .prepare(
      `UPDATE assets SET
      opportunity = COALESCE(?, opportunity),
      account = COALESCE(?, account),
      status = COALESCE(?, status),
      grossRevenue = COALESCE(?, grossRevenue),
      netRevenue = COALESCE(?, netRevenue),
      winPct = COALESCE(?, winPct),
      subSegmentCode = COALESCE(?, subSegmentCode),
      manager = COALESCE(?, manager),
      partner = COALESCE(?, partner),
      updatedAt = ?
     WHERE opportunityId = ?`
    )
    .run(name, account, status, grossRevenue, netRevenue, winPct, segment, manager, partner, now, req.params.id);

  if (crmResult.changes === 0) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }

  logAudit(username, "update_opportunity", "opportunity", String(req.params.id));
  createNotification(
    "crm_update",
    `Opportunity updated: ${name || req.params.id}`,
    `by ${username}`,
    String(req.params.id)
  );
  res.json({ success: true });
});

router.delete("/opportunities/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const username = (req as any).user?.username || "anonymous";
  const cascadeDelete = db.transaction(() => {
    db.prepare("DELETE FROM user_actions WHERE opportunityId = ?").run(id);
    db.prepare("DELETE FROM user_staffing_needs WHERE opportunityId = ?").run(id);
    db.prepare("DELETE FROM user_asset_team WHERE opportunityId = ?").run(id);
    db.prepare("DELETE FROM user_overrides WHERE entityType = 'opportunity' AND entityId = ?").run(id);
    db.prepare("DELETE FROM user_assets WHERE opportunityId = ?").run(id);
    db.prepare("DELETE FROM assets WHERE opportunityId = ?").run(id);
  });
  cascadeDelete();
  logAudit(username, "delete_opportunity", "opportunity", id);
  createNotification("opportunity", `Opportunity deleted: ${id.slice(0, 12)}`, `by ${username}`, id);
  res.json({ success: true });
});

// ── Assignments ──

router.get("/assignments", (req: Request, res: Response) => {
  const { empId, active } = req.query;

  let sql =
    "SELECT id, empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay FROM mds_assignments WHERE 1=1";
  const params: unknown[] = [];

  if (empId) {
    sql += " AND empId = ?";
    params.push(empId);
  }
  if (active === "true") {
    sql += " AND endDate >= date('now') AND startDate <= date('now')";
  }

  sql += " ORDER BY startDate DESC LIMIT 500";

  const rows = db.prepare(sql).all(...params);
  res.json({ assignments: rows });
});

// ── Stats agrégées ──

router.get("/stats", (_req: Request, res: Response) => {
  const employeeCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM employees WHERE departureDate IS NULL OR departureDate > date('now')")
      .get() as { c: number }
  ).c;

  const gradeDistribution = db
    .prepare(
      `SELECT grade, COUNT(*) as count FROM employees
       WHERE departureDate IS NULL OR departureDate > date('now')
       GROUP BY grade ORDER BY count DESC`
    )
    .all();

  const pipelineStats = db
    .prepare(
      `SELECT
        COUNT(*) as totalOpportunities,
        COALESCE(SUM(grossRevenue), 0) as totalRevenue,
        COALESCE(AVG(winPct), 0) as avgWinPct
       FROM assets WHERE status NOT IN (14, 15)`
    )
    .get();

  const bookingsStats = db
    .prepare(
      `SELECT
        COUNT(*) as totalBookings,
        COALESCE(SUM(grossRevenue), 0) as totalRevenue
       FROM assets WHERE status = 14`
    )
    .get();

  const endingSoon = db
    .prepare(
      `SELECT COUNT(*) as c FROM mds_assignments
       WHERE endDate BETWEEN date('now') AND date('now', '+30 days')`
    )
    .get() as { c: number };

  res.json({
    employees: { count: employeeCount, gradeDistribution },
    pipeline: pipelineStats,
    bookings: bookingsStats,
    alerts: { missionsEndingSoon: endingSoon.c },
  });
});

// ── Alerts ──

router.get("/alerts", (_req: Request, res: Response) => {
  const alerts: { type: string; severity: string; message: string; data: unknown }[] = [];

  // Missions ending soon
  const endingSoon = db
    .prepare(
      `SELECT e.name, e.grade, a.jobName, a.endDate
       FROM mds_assignments a JOIN employees e ON a.empId = e.empId
       WHERE a.endDate BETWEEN date('now') AND date('now', '+14 days')
       ORDER BY a.endDate ASC`
    )
    .all() as { name: string; grade: string; jobName: string; endDate: string }[];

  for (const row of endingSoon) {
    alerts.push({
      type: "end_mission",
      severity: "warning",
      message: `${row.name} (${row.grade}) — mission "${row.jobName}" ending on ${row.endDate}`,
      data: row,
    });
  }

  // Bench employees (no active assignment)
  const bench = db
    .prepare(
      `SELECT e.name, e.grade FROM employees e
       WHERE (e.departureDate IS NULL OR e.departureDate > date('now'))
       AND NOT EXISTS (
         SELECT 1 FROM mds_assignments a WHERE a.empId = e.empId
         AND a.endDate >= date('now') AND a.startDate <= date('now')
       )`
    )
    .all() as { name: string; grade: string }[];

  for (const row of bench) {
    alerts.push({
      type: "bench",
      severity: "critical",
      message: `${row.name} (${row.grade}) — no active assignment`,
      data: row,
    });
  }

  res.json({ alerts, count: alerts.length });
});

export default router;
