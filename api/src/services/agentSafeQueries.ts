/**
 * Agent safe parameterized queries — Replaces raw SQL generation for common patterns.
 *
 * The agent chooses a query pattern + parameters instead of writing free-form SQL.
 * This eliminates SQL injection risks for the 10 most common query types.
 */

import db from "../db/database.js";

// ── Query result formatter ──

function formatRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "No results.";
  const columns = Object.keys(rows[0]);
  const header = columns.join(" | ");
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null) return "NULL";
        if (typeof val === "number") return val.toLocaleString("fr-FR");
        return String(val);
      })
      .join(" | ")
  );
  return `${header}\n${"-".repeat(header.length)}\n${lines.join("\n")}\n\n(${rows.length} results)`;
}

// ── Pattern definitions ──

export interface SafeQueryParams {
  pattern: string;
  [key: string]: unknown;
}

const QUERY_PATTERNS: Record<string, (params: SafeQueryParams) => string> = {
  // 1. List opportunities by status
  opps_by_status(p) {
    const status = Number(p.status);
    const rows = db
      .prepare(
        `SELECT opportunityId, opportunity, account, grossRevenue, winPct, manager, partner
       FROM assets WHERE status = ? ORDER BY grossRevenue DESC LIMIT 50`
      )
      .all(status) as any[];
    const userRows = db
      .prepare(
        `SELECT opportunityId, opportunity, account, grossRevenue, winPct
       FROM user_assets WHERE status = ? ORDER BY grossRevenue DESC LIMIT 20`
      )
      .all(status) as any[];
    return formatRows([...rows, ...userRows]);
  },

  // 2. Search opportunities by account name
  opps_by_account(p) {
    const account = String(p.account || "").toLowerCase();
    const rows = db
      .prepare(
        `SELECT opportunityId, opportunity, account, status, grossRevenue, winPct, manager
       FROM assets WHERE LOWER(account) LIKE ? AND status != 15
       ORDER BY grossRevenue DESC LIMIT 30`
      )
      .all(`%${account}%`) as any[];
    return formatRows(rows);
  },

  // 3. List employees by grade
  employees_by_grade(p) {
    const grade = String(p.grade || "");
    const rows = db
      .prepare(
        `SELECT empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate
       FROM employees WHERE grade = ? AND (departureDate IS NULL OR departureDate > date('now'))
       ORDER BY name LIMIT 100`
      )
      .all(grade) as any[];
    return formatRows(rows);
  },

  // 4. Count opportunities by status
  opp_count_by_status(_p) {
    const rows = db
      .prepare(
        `SELECT status,
              CASE status
                WHEN 1 THEN 'Émergence' WHEN 4 THEN 'Investissement / CEB' WHEN 6 THEN 'Étude en cours'
                WHEN 11 THEN 'Maintenance lourde' WHEN 13 THEN 'Conventionné' WHEN 14 THEN 'En exploitation'
                WHEN 15 THEN 'Déclassé' ELSE 'Autre' END as label,
              COUNT(*) as count,
              COALESCE(SUM(grossRevenue), 0) as totalRevenue,
              COALESCE(SUM(weightedBooking), 0) as totalWeighted
       FROM assets GROUP BY status ORDER BY status`
      )
      .all() as any[];
    return formatRows(rows);
  },

  // 5. Search employees by name
  employees_by_name(p) {
    const name = String(p.name || "").toLowerCase();
    const rows = db
      .prepare(
        `SELECT empId, name, grade, subTeam, serviceLine, managerId
       FROM employees WHERE LOWER(name) LIKE ?
       AND (departureDate IS NULL OR departureDate > date('now'))
       ORDER BY name LIMIT 20`
      )
      .all(`%${name}%`) as any[];
    return formatRows(rows);
  },

  // 6. List staffing needs for an opportunity
  needs_for_opp(p) {
    const oppId = String(p.opportunityId || "");
    const rows = db
      .prepare(
        `SELECT n.id, n.grade, n.quantity, n.startDate, n.endDate, n.utilization, n.skills, n.probability,
              o.opportunity as oppName, o.account
       FROM user_staffing_needs n
       LEFT JOIN assets o ON n.opportunityId = o.opportunityId
       WHERE n.opportunityId = ? ORDER BY n.startDate`
      )
      .all(oppId) as any[];
    return formatRows(rows);
  },

  // 7. Skills inventory for an employee
  employee_skills(p) {
    const empId = String(p.empId || "");
    const rows = db
      .prepare(
        `SELECT s.name, s.level, s.category, e.name as empName, e.grade
       FROM hr_skills s JOIN employees e ON s.empId = e.empId
       WHERE s.empId = ? ORDER BY s.level DESC, s.name`
      )
      .all(empId) as any[];
    return formatRows(rows);
  },

  // 8. Pipeline by segment
  pipeline_by_segment(_p) {
    const rows = db
      .prepare(
        `SELECT subSegmentCode as segment, COUNT(*) as count,
              COALESCE(SUM(grossRevenue), 0) as totalGross,
              COALESCE(SUM(weightedBooking), 0) as totalWeighted
       FROM assets WHERE status NOT IN (15)
       GROUP BY subSegmentCode ORDER BY totalGross DESC`
      )
      .all() as any[];
    return formatRows(rows);
  },

  // 9. Actions for an opportunity
  actions_for_opp(p) {
    const oppId = String(p.opportunityId || "");
    const actions = db
      .prepare(
        `SELECT description, owner, dueDate, priority, status FROM user_actions
       WHERE opportunityId = ? ORDER BY dueDate`
      )
      .all(oppId) as any[];
    return formatRows(actions);
  },

  // 10. Revenue team for an opportunity
  revenue_team(p) {
    const oppId = String(p.opportunityId || "");
    const rows = db
      .prepare(
        `SELECT name, gradeBucket, percentage FROM user_asset_team
       WHERE opportunityId = ? ORDER BY percentage DESC`
      )
      .all(oppId) as any[];
    return formatRows(rows);
  },
};

// ── Executor ──

export function executeSafeQuery(params: SafeQueryParams): string {
  const handler = QUERY_PATTERNS[params.pattern];
  if (!handler) {
    return `Unknown query pattern: "${params.pattern}". Available: ${Object.keys(QUERY_PATTERNS).join(", ")}`;
  }
  try {
    return handler(params);
  } catch (err) {
    return `Query error: ${(err as Error).message}`;
  }
}

export const SAFE_QUERY_PATTERNS = Object.keys(QUERY_PATTERNS);
