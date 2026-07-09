/**
 * Agent IA — Tool dispatch map
 *
 * Maps tool names to their handler functions.
 * Each handler receives the tool input and a context, and returns a structured result.
 */

import db from "../db/database.js";
import {
  computeAvailability,
  findStaffingCandidates,
  getTeamKPIs,
  getSapMdsVariance,
  getPipelineForecast,
  detectStaffingGaps,
  getAlerts,
  simulateImpact,
} from "./staffingCalc.js";
import { executeSafeQuery } from "./agentSafeQueries.js";
import { broadcast } from "../routes/events.js";
import { createNotification } from "../routes/notifications.js";
import { logAudit } from "../utils/audit.js";
import type { ScoringConfig } from "./agent.js";

// ── Tool dispatch types ──

export interface ToolHandlerResult {
  description: string;
  result: string;
  action?: Record<string, unknown>;
  logSuffix: string;
}

export interface ToolContext {
  scoringConfig?: ScoringConfig;
  onProgress?: (message: string) => void;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext
) => ToolHandlerResult | Promise<ToolHandlerResult>;

/** Notify frontends that the AI agent modified data. */
function notifyDataChanged(scope: string, detail?: Record<string, unknown>) {
  broadcast("agent-data-changed", { scope, ...detail, timestamp: new Date().toISOString() });
}

/** Normalize grade/profile strings to match DB convention (PascalCase). */
const GRADE_ALIASES: Record<string, string> = {
  intern: "Intern",
  analyst: "Analyst",
  consultant: "Consultant",
  senior_consultant: "Senior Consultant",
  "senior consultant": "Senior Consultant",
  manager: "Manager",
  senior_manager: "Senior Manager",
  "senior manager": "Senior Manager",
  director: "Director",
  associate_director: "Director",
  partner: "Partner",
};

function normalizeGrade(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return GRADE_ALIASES[lower] || raw.trim();
}

/** Validate YYYY-MM-DD date format and return true if valid */
function isValidDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/** Return error string if date is invalid, null otherwise */
function validateDateParam(name: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!isValidDate(value)) return `Error: ${name} has invalid date format "${value}". Expected YYYY-MM-DD.`;
  return null;
}

// ── Safe SQL execution ──

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function executeSafeSQL(query: string): string {
  try {
    query = query.replace(/'([^']*)'/g, (_, content) => `'${stripAccents(content)}'`);

    // Strip string literals to avoid false positives on data content
    const withoutStrings = query.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    const normalized = withoutStrings.trim().toUpperCase();

    if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
      return "Error: only SELECT queries are allowed.";
    }

    // Block dangerous keywords (UNION ALL is allowed for CRM+user table queries)
    const dangerous = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "DROP",
      "ALTER",
      "CREATE",
      "ATTACH",
      "DETACH",
      "PRAGMA",
      "VACUUM",
      "REINDEX",
    ];
    const dangerousPattern = new RegExp(`\\b(${dangerous.join("|")})\\b`, "i");
    const match = normalized.match(dangerousPattern);
    if (match) return `Error: forbidden keyword "${match[1]}" detected.`;

    // Block UNION without ALL (potential injection vector), allow UNION ALL
    if (/\bUNION\b(?!\s+ALL\b)/i.test(normalized)) {
      return "Error: UNION without ALL is not allowed. Use UNION ALL instead.";
    }

    // Block multi-statement queries
    const queryTrimmed = query.trim().replace(/;\s*$/, "");
    if (queryTrimmed.includes(";")) return "Error: only one query at a time.";

    // Auto-add LIMIT 200 if no LIMIT present (prevent context overflow)
    let safeQuery = queryTrimmed;
    if (!/\bLIMIT\b/i.test(normalized)) {
      safeQuery += " LIMIT 200";
    }

    // Definitive read-only check: better-sqlite3's stmt.reader is true only for
    // genuine read-only statements. This is enforced by SQLite itself and cannot
    // be bypassed by SQL tricks (case variations, comments, encoding, etc.).
    const stmt = db.prepare(safeQuery);
    if (!stmt.reader) {
      return "Error: only read-only (SELECT) queries are allowed.";
    }

    const rows = stmt.all();

    if (rows.length === 0) return "No results.";

    const columns = Object.keys(rows[0] as Record<string, unknown>);
    const header = columns.join(" | ");
    const lines = rows.map((row) =>
      columns
        .map((col) => {
          const val = (row as Record<string, unknown>)[col];
          if (val === null) return "NULL";
          if (typeof val === "number") return val.toLocaleString("fr-FR");
          return String(val);
        })
        .join(" | ")
    );

    return `${header}\n${"-".repeat(header.length)}\n${lines.join("\n")}\n\n(${rows.length} results)`;
  } catch (err) {
    return `SQL error: ${(err as Error).message}`;
  }
}

// ── Tool dispatch map ──

export const TOOL_DISPATCH: Record<string, ToolHandler> = {
  safe_query(input) {
    const pattern = String(input.pattern || "");
    const result = executeSafeQuery(input as any);
    return {
      description: `SafeQuery: ${pattern}`,
      result,
      logSuffix: `safe_query(${pattern}) → ${result.split("\n").length} lines`,
    };
  },

  execute_sql(input) {
    const query = String(input.query || "");
    const result = executeSafeSQL(query);
    return {
      description: `SQL: ${query}`,
      result,
      logSuffix: `SQL → ${result.split("\n").length} lines`,
    };
  },

  async compute_availability(input, ctx) {
    // Validate dates
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr)
      return { description: "Calcul disponibilite", result: startErr, logSuffix: `availability → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Calcul disponibilite", result: endErr, logSuffix: `availability → ${endErr}` };
    const data = await computeAvailability(
      input as any,
      ctx.onProgress ? (n, total) => ctx.onProgress!(`Calcul disponibilite... ${n}/${total} employes`) : undefined
    );
    const gradeTargets: Record<string, number> = {
      Partner: 25,
      Director: 50,
      "Senior Manager": 65,
      Manager: 75,
      "Senior Consultant": 90,
      Consultant: 90,
      Analyst: 90,
      Intern: 95,
    };
    const result =
      data.length === 0
        ? "[]"
        : JSON.stringify(
            data.map((r) => {
              const target = gradeTargets[r.grade] || 90;
              const status =
                r.tuPct > target + 10 ? "surcharge" : r.tuPct < target - 20 ? "sous-utilise" : "dans la cible";
              const blocker =
                r.activeAssignments.length > 0
                  ? r.activeAssignments.sort((a, b) => b.overlapDays - a.overlapDays)[0]
                  : null;
              return {
                name: r.name,
                grade: r.grade,
                tuPct: r.tuPct,
                tuTarget: target,
                tuStatus: status,
                availablePct: r.availablePct,
                availableHours: r.availableHours,
                absenceHours: r.absenceHours,
                trainingHours: r.trainingHours,
                mainMission: blocker ? `${blocker.jobName} (${blocker.utilization}%, ${blocker.overlapDays}j)` : "none",
                allMissions: r.activeAssignments.map((a) => ({
                  job: a.jobName,
                  util: a.utilization,
                  days: a.overlapDays,
                })),
              };
            })
          );
    return {
      description: `Calcul disponibilite: ${input.grade || input.empId || "tous"} (${input.periodStart} → ${input.periodEnd})`,
      result,
      logSuffix: `availability → ${data.length} employees`,
    };
  },

  async find_staffing_candidates(input, ctx) {
    // Validate dates
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr)
      return { description: "Recherche candidats", result: startErr, logSuffix: `candidates → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Recherche candidats", result: endErr, logSuffix: `candidates → ${endErr}` };
    const toolInput = { ...input } as any;
    if (ctx.scoringConfig) {
      if (toolInput.minAvailablePct === undefined) toolInput.minAvailablePct = ctx.scoringConfig.minAvailPct;
      if (toolInput.minSkillsMatchPct === undefined) toolInput.minSkillsMatchPct = ctx.scoringConfig.minSkillsPct;
      if (toolInput.maxGradeDistance === undefined) toolInput.maxGradeDistance = ctx.scoringConfig.maxGradeDist;
      if (toolInput.periodTolerance === undefined) toolInput.periodTolerance = ctx.scoringConfig.periodTolerance;
    }
    const data = await findStaffingCandidates(
      toolInput,
      ctx.onProgress
        ? (n, total) => ctx.onProgress!(`Recherche candidats... ${n}/${total} employes evalues`)
        : undefined
    );
    if (data.length === 0) {
      return {
        description: `Recherche candidats: ${input.grade || "tout grade"} (${input.periodStart} → ${input.periodEnd})${input.skills ? " skills: " + (input.skills as string[]).join(", ") : ""}`,
        result: "[]",
        logSuffix: `candidates → 0 matches`,
      };
    }
    // Raw data for the agent's reasoning (full detail).
    const rawJson = JSON.stringify(
      data.map((c) => ({
        name: c.name,
        grade: c.grade,
        score: c.totalScore,
        scoringMode: c.scoringMode || "standard",
        scoreBreakdown: c.scoreBreakdown,
        serviceLineMatch: c.serviceLineMatch ?? false,
        ...(c.clientBonus ? { clientBonus: c.clientBonus } : {}),
        ...(c.overloadMalus ? { overloadMalus: c.overloadMalus } : {}),
        matchDispo: c.dispoCoveragePct,
        matchSkills: c.skillsMatchPct,
        matchGrade: c.gradeDist === 0 ? "exact" : `±${c.gradeDist}`,
        availablePct: c.availablePct,
        availableHours: c.availableHours,
        tuPct: c.tuPct,
        skills: c.matchedSkills,
        missions: c.activeAssignments,
        ...(c.availableFrom ? { availableFrom: c.availableFrom, delayDays: c.delayDays } : {}),
      }))
    );
    // Pre-built candidate-card chart block, ready for the agent to copy verbatim.
    // Uses the exact field names CandidateCards.tsx expects — no manual remapping by the LLM.
    const top = data.slice(0, 5);
    const chartTitle = `Top ${top.length} candidats — ${input.grade || "tout grade"}${input.skills && (input.skills as string[]).length > 0 ? " " + (input.skills as string[]).join("/") : ""}`;
    const chartData = top.map((c) => ({
      name: c.name,
      grade: c.grade,
      totalScore: c.totalScore,
      gradeFit: c.scoreBreakdown?.gradeFit ?? 0,
      dateOverlap: c.scoreBreakdown?.dateOverlap ?? 0,
      availability: c.scoreBreakdown?.availability ?? 0,
      skills: c.scoreBreakdown?.skills ?? 0,
      availableHours: c.availableHours,
      availablePct: c.availablePct,
      tuPct: c.tuPct,
      matchedSkills: c.matchedSkills || [],
      ...(c.availableFrom ? { availableFrom: c.availableFrom, delayDays: c.delayDays } : {}),
    }));
    const chartBlock = `---chart\n${JSON.stringify({ type: "candidate-card", title: chartTitle, data: chartData })}\n---`;
    // Chart block FIRST so it survives the 3000-char truncation in agent.ts.
    const result =
      `${data.length} candidats trouvés.\n\n` +
      `IMPORTANT — pour visualiser ces candidats, copie LITTERALEMENT le bloc suivant à la fin de ta réponse (ne le modifie pas, ne le reformate pas, ne le remplace pas par un bar/progress chart) :\n\n${chartBlock}\n\n` +
      `Détail JSON pour ton raisonnement :\n${rawJson}`;
    return {
      description: `Recherche candidats: ${input.grade || "tout grade"} (${input.periodStart} → ${input.periodEnd})${input.skills ? " skills: " + (input.skills as string[]).join(", ") : ""}`,
      result,
      logSuffix: `candidates → ${data.length} matches`,
    };
  },

  get_team_kpis(input) {
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr) return { description: "KPIs equipe", result: startErr, logSuffix: `team KPIs → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "KPIs equipe", result: endErr, logSuffix: `team KPIs → ${endErr}` };
    const data = getTeamKPIs(input as any);
    const result = JSON.stringify({
      count: data.employeeCount,
      tuPct: data.tuPct,
      toPct: data.toPct,
      benchPct: data.benchPct,
      hours: {
        net: data.totalNetHours,
        ch: data.totalChargeableHours,
        abs: data.totalAbsenceHours,
        training: data.totalTrainingHours,
      },
      byGrade: data.byGrade,
    });
    return {
      description: `KPIs equipe: ${input.subTeam || input.grade || "tous"} (${input.periodStart} → ${input.periodEnd})`,
      result,
      logSuffix: `team KPIs → ${data.employeeCount} employees`,
    };
  },

  create_staffing_need(input) {
    const { opportunityId, quantity = 1, startDate, endDate, skills = [] } = input as any;
    const grade = normalizeGrade(String(input.profile || ""));
    const needId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      // Validate date formats
      const startErr = validateDateParam("startDate", startDate);
      if (startErr)
        return {
          description: `Create staffing need`,
          result: startErr,
          logSuffix: `create_staffing_need → ${startErr}`,
        };
      const endErr = validateDateParam("endDate", endDate);
      if (endErr)
        return { description: `Create staffing need`, result: endErr, logSuffix: `create_staffing_need → ${endErr}` };
      // Validate opp exists (in either assets or user_assets)
      const opp =
        db.prepare(`SELECT opportunityId FROM assets WHERE opportunityId = ?`).get(opportunityId) ||
        db.prepare(`SELECT opportunityId FROM user_assets WHERE opportunityId = ?`).get(opportunityId);
      if (!opp)
        return {
          description: `Create staffing need`,
          result: `Error: opportunity ${opportunityId} not found`,
          logSuffix: `create_staffing_need → opp not found: ${opportunityId}`,
        };
      // Check for duplicate (same opp + profile + dates)
      const dup = db
        .prepare(
          `SELECT id FROM user_staffing_needs WHERE opportunityId = ? AND grade = ? AND startDate = ? AND endDate = ?`
        )
        .get(opportunityId, grade, startDate, endDate);
      if (dup)
        return {
          description: `Create staffing need`,
          result: `Identical need already exists (${(dup as any).id})`,
          logSuffix: `create_staffing_need → duplicate detected`,
        };
      // Validate dates
      if (startDate && endDate && startDate > endDate)
        return {
          description: `Create staffing need`,
          result: `Error: start date after end date`,
          logSuffix: `create_staffing_need → inverted dates`,
        };
      const util = Number(input.utilization) || 100;
      const prob = Number(input.probability) || 1;
      db.prepare(
        `INSERT INTO user_staffing_needs (id, opportunityId, grade, quantity, startDate, endDate, skills, probability, utilization, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(needId, opportunityId, grade, quantity, startDate, endDate, JSON.stringify(skills), prob, util, now);
      notifyDataChanged("changes", { opportunityId });
      createNotification(
        "staffing_need",
        `Staffing need created: ${quantity}x ${grade}`,
        `${startDate} → ${endDate}`,
        opportunityId
      );
      return {
        description: `Create staffing need: ${grade} x${quantity} on ${opportunityId}`,
        result: `Need created (id: ${needId}): ${quantity}x ${grade}, ${startDate} → ${endDate}`,
        action: { action: "staffing_need_created", opportunityId, needId },
        logSuffix: `create_staffing_need → created (id: ${needId}): ${quantity}x ${grade}, ${startDate} → ${endDate}`,
      };
    } catch (e: any) {
      return {
        description: `Create staffing need: ${grade} x${quantity} on ${opportunityId}`,
        result: `Error: ${e.message}`,
        logSuffix: `create_staffing_need → Error: ${e.message}`,
      };
    }
  },

  create_action(input) {
    const { opportunityId, description, owner, dueDate, priority = "medium" } = input as any;
    const actionId = crypto.randomUUID();
    const due = dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const now = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO user_actions (id, opportunityId, description, owner, dueDate, priority, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
      ).run(actionId, opportunityId, description, owner, due, priority, now);
      notifyDataChanged("changes", { opportunityId });
      createNotification("action", `Action: ${description}`, `Assigned to ${owner}, due ${due}`, opportunityId);
      return {
        description: `Create action: "${description}" → ${owner}`,
        result: `Action created (id: ${actionId}): "${description}" assigned to ${owner}, due ${due}`,
        action: { action: "action_created", opportunityId, actionId },
        logSuffix: `create_action → Action created (id: ${actionId}): "${description}" assigned to ${owner}, due ${due}`,
      };
    } catch (e: any) {
      return {
        description: `Create action: "${description}" → ${owner}`,
        result: `Error: ${e.message}`,
        logSuffix: `create_action → Error: ${e.message}`,
      };
    }
  },

  update_opportunity_status(input) {
    const { opportunityId, newStatus, comment = "", bookingDate } = input as any;
    const statusNames: Record<number, string> = {
      1: "Émergence",
      4: "Investissement / CEB",
      6: "Étude en cours",
      11: "Maintenance lourde",
      13: "Conventionné",
      14: "En exploitation",
      15: "Déclassé",
    };
    try {
      const opp = (db.prepare(`SELECT status FROM assets WHERE opportunityId = ?`).get(opportunityId) ||
        db.prepare(`SELECT status FROM user_assets WHERE opportunityId = ?`).get(opportunityId)) as any;
      const originalStatus = opp?.status ?? 0;
      const modifiedAt = new Date().toISOString();
      // Write status override into EAV table (append-only history)
      const ins = db.prepare(
        `INSERT INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt) VALUES ('opportunity', ?, ?, ?, ?, ?)`
      );
      ins.run(opportunityId, "status", String(originalStatus), String(newStatus), modifiedAt);
      if (comment) {
        ins.run(opportunityId, "overrideComment", null, comment, modifiedAt);
      }
      if (bookingDate) {
        ins.run(opportunityId, "bookingDate", null, bookingDate, modifiedAt);
      }
      logAudit("agent", "update_status", "opportunity", opportunityId, `${originalStatus} → ${newStatus}`);
      notifyDataChanged("changes", { opportunityId });
      const result = `Status updated: ${opportunityId} → ${statusNames[newStatus]}${comment ? ` (${comment})` : ""}`;
      return {
        description: `Status change: ${opportunityId} → ${statusNames[newStatus] || newStatus}`,
        result,
        action: { action: "status_updated", opportunityId, newStatus },
        logSuffix: `update_status → ${result}`,
      };
    } catch (e: any) {
      return {
        description: `Status change: ${opportunityId} → ${statusNames[newStatus] || newStatus}`,
        result: `Error: ${e.message}`,
        logSuffix: `update_status → Error: ${e.message}`,
      };
    }
  },

  create_opportunity(input) {
    const { name, account, grossRevenue, netRevenue, status = 1, serviceLine = "", winPct = 50 } = input as any;
    const opportunityId = `MAN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    try {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO user_assets (opportunityId, opportunity, account, status, grossRevenue, netRevenue, winPct, serviceLine1, creationDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        opportunityId,
        name,
        account,
        status,
        grossRevenue,
        netRevenue || grossRevenue,
        winPct,
        serviceLine,
        now.slice(0, 10),
        now,
        now
      );
      logAudit("agent", "create_opportunity", "opportunity", opportunityId, name);
      notifyDataChanged("crm", { opportunityId });
      createNotification("opportunity", `New opportunity: ${name}`, `${account} — ${grossRevenue}€`, opportunityId);
      const result = `Opportunity created (id: ${opportunityId}): "${name}", ${account}, ${grossRevenue}€`;
      return {
        description: `Create opportunity: "${name}" (${account}, ${grossRevenue}€)`,
        result,
        action: { action: "opportunity_created", opportunityId },
        logSuffix: `create_opportunity → ${result}`,
      };
    } catch (e: any) {
      return {
        description: `Create opportunity: "${name}" (${account}, ${grossRevenue}€)`,
        result: `Error: ${e.message}`,
        logSuffix: `create_opportunity → Error: ${e.message}`,
      };
    }
  },

  update_revenue_team(input) {
    const { opportunityId, members } = input as any;
    try {
      db.transaction(() => {
        db.prepare(`DELETE FROM user_asset_team WHERE opportunityId = ?`).run(opportunityId);
        const ins = db.prepare(
          `INSERT INTO user_asset_team (id, opportunityId, name, gradeBucket, percentage) VALUES (?, ?, ?, ?, ?)`
        );
        for (const m of members) {
          ins.run(crypto.randomUUID(), opportunityId, m.name, m.gradeBucket, m.percentage);
        }
      })();
      notifyDataChanged("changes", { opportunityId });
      const result = `Revenue team updated: ${members.map((m: any) => `${m.name} (${m.gradeBucket} ${m.percentage}%)`).join(", ")}`;
      return {
        description: `Update revenue team: ${opportunityId} (${members.length} members)`,
        result,
        action: { action: "revenue_team_updated", opportunityId },
        logSuffix: `update_revenue_team → ${result}`,
      };
    } catch (e: any) {
      return {
        description: `Update revenue team: ${opportunityId} (${members.length} members)`,
        result: `Error: ${e.message}`,
        logSuffix: `update_revenue_team → Error: ${e.message}`,
      };
    }
  },

  delete_opportunity(input) {
    const { opportunityId } = input as any;
    try {
      // Check if it exists in user_assets (manual) — only manual opps can be deleted
      const userOpp = db
        .prepare(`SELECT opportunityId FROM user_assets WHERE opportunityId = ?`)
        .get(opportunityId) as any;
      if (!userOpp) {
        const crmOpp = db.prepare(`SELECT opportunityId FROM assets WHERE opportunityId = ?`).get(opportunityId) as any;
        if (!crmOpp) {
          return {
            description: `Delete opportunity: ${opportunityId}`,
            result: `Opportunity ${opportunityId} not found`,
            logSuffix: `delete_opportunity → Opportunity ${opportunityId} not found`,
          };
        }
        return {
          description: `Delete opportunity: ${opportunityId}`,
          result: `Cannot delete ${opportunityId}: not a manual opportunity`,
          logSuffix: `delete_opportunity → Cannot delete ${opportunityId}: not a manual opportunity`,
        };
      }
      db.transaction(() => {
        db.prepare(`DELETE FROM user_assets WHERE opportunityId = ?`).run(opportunityId);
        db.prepare(`DELETE FROM user_overrides WHERE entityType = 'opportunity' AND entityId = ?`).run(opportunityId);
        db.prepare(`DELETE FROM user_actions WHERE opportunityId = ?`).run(opportunityId);
        db.prepare(`DELETE FROM user_staffing_needs WHERE opportunityId = ?`).run(opportunityId);
        db.prepare(`DELETE FROM user_asset_team WHERE opportunityId = ?`).run(opportunityId);
      })();
      logAudit("agent", "delete_opportunity", "opportunity", opportunityId);
      notifyDataChanged("crm", { opportunityId, deleted: true });
      return {
        description: `Delete opportunity: ${opportunityId}`,
        result: `Opportunity ${opportunityId} deleted (with its actions and needs)`,
        action: { action: "opportunity_deleted", opportunityId },
        logSuffix: `delete_opportunity → Opportunity ${opportunityId} deleted (with its actions and needs)`,
      };
    } catch (e: any) {
      return {
        description: `Delete opportunity: ${opportunityId}`,
        result: `Error: ${e.message}`,
        logSuffix: `delete_opportunity → Error: ${e.message}`,
      };
    }
  },

  create_scenario(input) {
    const { name } = input as any;
    const scenarioId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO user_scenarios (id, name, baseId, overrides, empOverrides, createdAt) VALUES (?, ?, NULL, '{}', '{}', ?)`
      ).run(scenarioId, name, now);
      notifyDataChanged("changes");
      return {
        description: `Create scenario: "${name}"`,
        result: `Scenario created (id: ${scenarioId}): "${name}"`,
        action: { action: "scenario_created", scenarioId, name },
        logSuffix: `create_scenario → Scenario created (id: ${scenarioId}): "${name}"`,
      };
    } catch (e: any) {
      return {
        description: `Create scenario: "${name}"`,
        result: `Error: ${e.message}`,
        logSuffix: `create_scenario → Error: ${e.message}`,
      };
    }
  },

  update_employee(input) {
    const { empId, dm, departureDate, arrivalDate, grade, gradeStartDate } = input as any;
    const changes: string[] = [];
    if (dm) changes.push(`DM → ${dm}`);
    if (departureDate) changes.push(`departure → ${departureDate}`);
    if (arrivalDate) changes.push(`arrival → ${arrivalDate}`);
    if (grade) changes.push(`grade → ${grade} (${gradeStartDate})`);
    const now = new Date().toISOString();
    try {
      // Write overrides into EAV table (append-only history)
      const ins = db.prepare(
        `INSERT INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt) VALUES ('employee', ?, ?, NULL, ?, ?)`
      );
      if (dm) ins.run(empId, "dm", dm, now);
      if (departureDate) {
        ins.run(empId, "departureDate", departureDate, now);
        ins.run(empId, "manualDeparture", "true", now);
      }
      if (arrivalDate) {
        ins.run(empId, "arrivalDate", arrivalDate, now);
        ins.run(empId, "manualArrival", "true", now);
      }
      if (grade && gradeStartDate) {
        // Read existing gradeHistory from latest override and append
        const existing = db
          .prepare(
            "SELECT newValue FROM user_overrides WHERE entityType = 'employee' AND entityId = ? AND field = 'gradeHistory' ORDER BY modifiedAt DESC LIMIT 1"
          )
          .get(empId) as any;
        const gh = existing?.newValue ? JSON.parse(existing.newValue) : [];
        gh.push({ grade, since: gradeStartDate });
        ins.run(empId, "gradeHistory", JSON.stringify(gh), now);
      }
      logAudit("agent", "update_employee", "employee", empId, changes.join(", "));
      notifyDataChanged("changes", { empId });
      return {
        description: `Update employee ${empId}: ${changes.join(", ")}`,
        result: `Employee ${empId} updated: ${changes.join(", ")}`,
        action: { action: "employee_updated", empId },
        logSuffix: `update_employee → Employee ${empId} updated: ${changes.join(", ")}`,
      };
    } catch (e: any) {
      return {
        description: `Update employee ${empId}: ${changes.join(", ")}`,
        result: `Error: ${e.message}`,
        logSuffix: `update_employee → Error: ${e.message}`,
      };
    }
  },

  get_sap_mds_variance: (input) => {
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr) return { description: "Variance SAP vs MDS", result: startErr, logSuffix: `variance �� ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Variance SAP vs MDS", result: endErr, logSuffix: `variance → ${endErr}` };
    const data = getSapMdsVariance(input as any);
    return {
      description: `Variance SAP vs MDS: ${input.grade || input.empId || "tous"} (${input.periodStart} → ${input.periodEnd})`,
      result:
        data.length === 0
          ? "No SAP data to compare."
          : JSON.stringify(
              data.map((r) => ({
                name: r.name,
                grade: r.grade,
                status: r.status,
                mds: r.mds,
                sap: r.sap,
                delta: r.delta,
              }))
            ),
      logSuffix: `get_sap_mds_variance → ${data.length} employees, ${data.filter((r) => r.status !== "aligne").length} ecarts`,
    };
  },

  // ── Analytics tools ──

  get_pipeline_kpis(input) {
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr) return { description: "Pipeline KPIs", result: startErr, logSuffix: `pipeline KPIs → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Pipeline KPIs", result: endErr, logSuffix: `pipeline KPIs → ${endErr}` };
    try {
      const forecast = getPipelineForecast(input as any);

      // Concentration analysis: top 3 accounts as % of total pipeline
      const accountRevenue = db
        .prepare(
          "SELECT account, SUM(grossRevenue) as total FROM assets WHERE status NOT IN (15) GROUP BY account ORDER BY total DESC"
        )
        .all() as any[];
      const totalPipeline = accountRevenue.reduce((s: number, a: any) => s + (a.total || 0), 0);
      const top3Revenue = accountRevenue.slice(0, 3).reduce((s: number, a: any) => s + (a.total || 0), 0);
      const concentrationPct = totalPipeline > 0 ? Math.round((top3Revenue / totalPipeline) * 100) : 0;

      // Stagnant proposals (>60 days in Proposal status)
      const today = new Date().toISOString().slice(0, 10);
      const stagnant = db
        .prepare(
          `SELECT COUNT(*) as count FROM assets WHERE status = 6
         AND (lastStatusChangeDate IS NOT NULL AND lastStatusChangeDate < date(?, '-60 days')
           OR lastStatusChangeDate IS NULL AND creationDate < date(?, '-60 days'))`
        )
        .get(today, today) as any;

      const result = JSON.stringify({
        ...forecast,
        concentration: {
          top3Accounts: accountRevenue
            .slice(0, 3)
            .map((a: any) => ({ account: a.account, revenue: Math.round(a.total || 0) })),
          top3Pct: concentrationPct,
          isRisk: concentrationPct > 40,
        },
        stagnantProposals: stagnant?.count || 0,
      });
      return {
        description: `Pipeline KPIs: ${input.periodStart} → ${input.periodEnd}`,
        result,
        logSuffix: `get_pipeline_kpis → ${forecast.byStatus.length} statuses, concentration ${concentrationPct}%, ${stagnant?.count || 0} stagnant`,
      };
    } catch (e: any) {
      return {
        description: "Pipeline KPIs",
        result: `Error: ${e.message}`,
        logSuffix: `get_pipeline_kpis → Error: ${e.message}`,
      };
    }
  },

  search_entity(input) {
    const query = String(input.query || "").trim();
    const type = String(input.type || "all");
    if (!query)
      return {
        description: "Search entity",
        result: "Error: query is required",
        logSuffix: "search_entity → empty query",
      };

    const searchTerm = stripAccents(query).toLowerCase();
    const results: any[] = [];

    try {
      if (type === "all" || type === "employee") {
        const emps = db
          .prepare("SELECT empId, name, grade, subTeam, serviceLine FROM employees WHERE LOWER(name) LIKE ? LIMIT 5")
          .all(`%${searchTerm}%`) as any[];
        results.push(...emps.map((e: any) => ({ ...e, _type: "employee" })));
      }

      if (type === "all" || type === "opportunity") {
        const opps = db
          .prepare(
            "SELECT opportunityId as id, opportunity as name, account, status, grossRevenue FROM assets WHERE LOWER(opportunity) LIKE ? OR LOWER(account) LIKE ? LIMIT 5"
          )
          .all(`%${searchTerm}%`, `%${searchTerm}%`) as any[];
        const userOpps = db
          .prepare(
            "SELECT opportunityId as id, opportunity as name, account, status, grossRevenue FROM user_assets WHERE LOWER(opportunity) LIKE ? OR LOWER(account) LIKE ? LIMIT 5"
          )
          .all(`%${searchTerm}%`, `%${searchTerm}%`) as any[];
        results.push(...opps.map((o: any) => ({ ...o, _type: "opportunity" })));
        results.push(...userOpps.map((o: any) => ({ ...o, _type: "opportunity", _source: "manual" })));
      }

      if (type === "all" || type === "account") {
        const accts = db
          .prepare(
            "SELECT account, subSegmentCode, accountLeader, country FROM sites WHERE LOWER(account) LIKE ? LIMIT 5"
          )
          .all(`%${searchTerm}%`) as any[];
        results.push(...accts.map((a: any) => ({ ...a, _type: "account" })));
      }

      return {
        description: `Search: "${query}" (${type})`,
        result: results.length === 0 ? "No results found." : JSON.stringify(results.slice(0, 10)),
        logSuffix: `search_entity → ${results.length} matches for "${query}"`,
      };
    } catch (e: any) {
      return {
        description: `Search: "${query}"`,
        result: `Error: ${e.message}`,
        logSuffix: `search_entity → Error: ${e.message}`,
      };
    }
  },

  // ── Impact & detection tools ──

  simulate_impact(input) {
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr)
      return { description: "Simulation impact", result: startErr, logSuffix: `simulate_impact → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Simulation impact", result: endErr, logSuffix: `simulate_impact → ${endErr}` };
    try {
      const data = simulateImpact(input as any);
      return {
        description: `Impact: ${data.scenario}`,
        result: JSON.stringify(data),
        logSuffix: `simulate_impact → ${data.scenario} (delta TU: ${data.staffingImpact.tuDelta}pts)`,
      };
    } catch (e: any) {
      return {
        description: "Simulation impact",
        result: `Error: ${e.message}`,
        logSuffix: `simulate_impact → Error: ${e.message}`,
      };
    }
  },

  detect_staffing_gaps(input) {
    const startErr = validateDateParam("periodStart", input.periodStart);
    if (startErr) return { description: "Detection gaps", result: startErr, logSuffix: `detect_gaps → ${startErr}` };
    const endErr = validateDateParam("periodEnd", input.periodEnd);
    if (endErr) return { description: "Detection gaps", result: endErr, logSuffix: `detect_gaps → ${endErr}` };
    try {
      const data = detectStaffingGaps(input as any);
      const summary = [
        `${data.oppsWithoutStaffing.length} opps without staffing`,
        `${data.overallocated.length} overallocated`,
        `${data.urgentNeeds.length} urgent needs`,
        `${data.benchEmployees.length} on bench`,
        `${data.skillGaps.length} skill gaps`,
      ].join(", ");
      return {
        description: `Staffing gaps: ${input.periodStart} → ${input.periodEnd}`,
        result: JSON.stringify(data),
        logSuffix: `detect_staffing_gaps → ${summary}`,
      };
    } catch (e: any) {
      return {
        description: "Detection gaps",
        result: `Error: ${e.message}`,
        logSuffix: `detect_staffing_gaps → Error: ${e.message}`,
      };
    }
  },

  get_alerts(input) {
    try {
      const data = getAlerts(input as any);
      const total =
        data.overdueActions.length +
        data.endingMissions.length +
        data.upcomingDepartures.length +
        data.stagnantProposals.length +
        data.overallocated.length;
      return {
        description: `Alertes (lookahead: ${input.lookaheadDays || 30}j)`,
        result: JSON.stringify(data),
        logSuffix: `get_alerts → ${total} alertes (${data.overdueActions.length} retard, ${data.stagnantProposals.length} stagnant, ${data.overallocated.length} surcharge)`,
      };
    } catch (e: any) {
      return { description: "Alertes", result: `Error: ${e.message}`, logSuffix: `get_alerts → Error: ${e.message}` };
    }
  },

  // ── User profile ──

  update_user_profile(input) {
    try {
      db.exec(
        `CREATE TABLE IF NOT EXISTS var_user_profile (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)`
      );
      const now = new Date().toISOString();
      const upsert = db.prepare(
        `INSERT INTO var_user_profile (key, value, updatedAt) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
      );
      const updates: string[] = [];
      for (const [key, value] of Object.entries(input)) {
        if (
          value !== undefined &&
          value !== null &&
          ["team", "accounts", "role", "grade", "preferences"].includes(key)
        ) {
          const serialized = typeof value === "string" ? value : JSON.stringify(value);
          upsert.run(key, serialized, now);
          updates.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
        }
      }
      if (updates.length === 0)
        return {
          description: "Update profile",
          result: "No valid fields to update",
          logSuffix: "update_user_profile → no fields",
        };
      logAudit("agent", "update_user_profile", "user_profile", "current", updates.join(", "));
      return {
        description: `Profil mis a jour: ${updates.join(", ")}`,
        result: `Profil sauvegarde: ${updates.join(", ")}. Ces informations seront utilisees dans les futures conversations.`,
        logSuffix: `update_user_profile → ${updates.length} fields: ${updates.join(", ")}`,
      };
    } catch (e: any) {
      return {
        description: "Update profile",
        result: `Error: ${e.message}`,
        logSuffix: `update_user_profile → Error: ${e.message}`,
      };
    }
  },

  match_candidate_to_need(input) {
    const { candidateId, staffingNeedId, matchScore } = input as any;
    try {
      const candidate = db
        .prepare("SELECT id, firstName, lastName, grade FROM nonconformities WHERE id = ?")
        .get(candidateId) as any;
      if (!candidate)
        return {
          description: `Match candidate ${candidateId}`,
          result: `Candidate ${candidateId} not found`,
          logSuffix: "match_candidate → not found",
        };
      const need = db
        .prepare("SELECT id, opportunityId, grade FROM user_staffing_needs WHERE id = ?")
        .get(staffingNeedId) as any;
      if (!need)
        return {
          description: `Match candidate ${candidateId}`,
          result: `Staffing need ${staffingNeedId} not found`,
          logSuffix: "match_candidate → need not found",
        };

      db.prepare(
        `INSERT INTO nc_staffing_match (candidateId, staffingNeedId, matchScore, matchedAt, matchedBy)
         VALUES (?, ?, ?, ?, 'agent') ON CONFLICT(candidateId, staffingNeedId) DO UPDATE SET matchScore = excluded.matchScore, matchedAt = excluded.matchedAt`
      ).run(candidateId, staffingNeedId, matchScore ?? null, new Date().toISOString());

      logAudit("agent", "match_candidate", "candidate", candidateId, `→ need ${staffingNeedId} (score: ${matchScore})`);
      const name = `${candidate.firstName} ${candidate.lastName}`;
      return {
        description: `Match candidate ${name} → need ${need.grade} (${need.opportunityId})`,
        result: `Matched ${name} (${candidate.grade}) to staffing need ${staffingNeedId} (grade: ${need.grade}, score: ${matchScore})`,
        action: { action: "candidate_matched", candidateId, staffingNeedId },
        logSuffix: `match_candidate → ${name} ↔ ${staffingNeedId}`,
      };
    } catch (e: any) {
      return {
        description: `Match candidate ${candidateId}`,
        result: `Error: ${e.message}`,
        logSuffix: `match_candidate → Error: ${e.message}`,
      };
    }
  },

  // ── GAIF — Comitologie : actions ouvertes par comité (lecture table gaif_comite_actions) ──
  get_comite_actions(input) {
    const comiteRaw = String(input.comite || "")
      .toLowerCase()
      .trim();
    // Résolution flexible : "copil-immo", "COPIL-IMMO", "copil_immo", "immo" fonctionnent tous
    let comite: { id: string; label: string; cadence: string; themes: string; nextOccurrence: string } | undefined;
    try {
      const rows = db.prepare(`SELECT id, label, cadence, themes, nextOccurrence FROM gaif_comites`).all() as Array<{
        id: string;
        label: string;
        cadence: string;
        themes: string;
        nextOccurrence: string;
      }>;
      comite = rows.find(
        (r) =>
          r.id.toLowerCase() === comiteRaw ||
          r.id.toLowerCase().includes(comiteRaw) ||
          r.label.toLowerCase().includes(comiteRaw)
      );
    } catch {
      // Table may not exist on legacy DB
    }

    if (!comite) {
      return {
        description: "get_comite_actions",
        result: `Comité inconnu: "${comiteRaw}". Comités valides: copil-reseau, copil-immo, cotech-idfm, copil-rse.`,
        logSuffix: `get_comite_actions → unknown(${comiteRaw})`,
      };
    }

    let themes: string[] = [];
    try {
      themes = JSON.parse(comite.themes);
    } catch {
      themes = [];
    }

    let actions: Array<{
      id: string;
      description: string;
      ownerId: string;
      dueDate: string;
      status: string;
      priority: string;
    }> = [];
    try {
      actions = db
        .prepare(
          `SELECT id, description, ownerId, dueDate, status, priority
           FROM gaif_comite_actions WHERE comiteId = ? AND status != 'done' AND status != 'cancelled'
           ORDER BY dueDate ASC LIMIT 25`
        )
        .all(comite.id) as typeof actions;
    } catch {
      // Table may not exist on legacy DB
    }

    const lines: string[] = [];
    lines.push(`## ${comite.label} (${comite.cadence})`);
    lines.push(`**Prochaine occurrence** : ${comite.nextOccurrence}`);
    if (themes.length > 0) lines.push(`**Thèmes** : ${themes.join(" · ")}`);
    lines.push("");
    if (actions.length === 0) {
      lines.push("_Aucune action ouverte associée à ce comité._");
    } else {
      lines.push(
        `**${actions.length} action${actions.length > 1 ? "s" : ""} ouverte${actions.length > 1 ? "s" : ""}** :`
      );
      for (const a of actions) {
        const priority = a.priority ? ` [${a.priority}]` : "";
        lines.push(`- [${a.status}]${priority} ${a.description} · ${a.ownerId} · échéance ${a.dueDate}`);
      }
    }
    return {
      description: `Comité ${comite.label}`,
      result: lines.join("\n"),
      logSuffix: `get_comite_actions(${comite.id}) → ${actions.length} actions`,
    };
  },

  // ── GAIF — Analyse des écarts de conformité par site/patrimoine ──
  get_compliance_gaps(input) {
    const patrimoine = input.patrimoine ? String(input.patrimoine) : null;
    const site = input.site ? String(input.site) : null;
    const threshold = Number(input.threshold ?? 95);
    let sql = `SELECT opportunityId, opportunity, serviceLine1 as site, subSegmentCode as patrimoine,
                      engagementType as criticite, cm1Pct as conformite, partner
               FROM assets
               WHERE cm1Pct < ?`;
    const params: any[] = [threshold];
    if (patrimoine) {
      sql += " AND subSegmentCode = ?";
      params.push(patrimoine);
    }
    if (site) {
      sql += " AND serviceLine1 LIKE ?";
      params.push(`%${site}%`);
    }
    sql += " ORDER BY cm1Pct ASC LIMIT 50";
    try {
      const rows = db.prepare(sql).all(...params) as Array<{
        opportunityId: string;
        opportunity: string;
        site: string;
        patrimoine: string;
        criticite: string;
        conformite: number;
        partner: string | null;
      }>;
      if (rows.length === 0) {
        return {
          description: "Compliance gaps",
          result:
            "Aucun actif sous le seuil de conformité dans le périmètre demandé. Les seuils PSGA (critique <1%/autre <5% optimal) sont respectés.",
          logSuffix: `get_compliance_gaps → 0`,
        };
      }
      const lines: string[] = [];
      lines.push(`## ${rows.length} actif${rows.length > 1 ? "s" : ""} sous ${threshold}% de conformité`);
      const critCount = rows.filter((r) => String(r.criticite || "").includes("Critique")).length;
      lines.push(
        `Dont **${critCount} actif${critCount > 1 ? "s" : ""} critique${critCount > 1 ? "s" : ""}** (priorité PSGA).`
      );
      lines.push("");
      lines.push("| Actif | Site | Patrimoine | Criticité | Conformité | Prestataire |");
      lines.push("|---|---|---|---|---|---|");
      for (const r of rows.slice(0, 25)) {
        lines.push(
          `| ${r.opportunity} | ${r.site} | ${r.patrimoine} | ${String(r.criticite).replace("Criticité ", "")} | ${Number(r.conformite).toFixed(1)}% | ${r.partner ?? "—"} |`
        );
      }
      if (rows.length > 25) lines.push(`\n_… et ${rows.length - 25} autres._`);
      return {
        description: "Compliance gaps",
        result: lines.join("\n"),
        logSuffix: `get_compliance_gaps → ${rows.length} rows`,
      };
    } catch (e: any) {
      return {
        description: "Compliance gaps",
        result: `Erreur SQL : ${e.message}`,
        logSuffix: `get_compliance_gaps → Error: ${e.message}`,
      };
    }
  },

  // ── GAIF — Recherche dans le corpus doctrinaire (lecture table gaif_doctrinaire_docs) ──
  knowledge_base_lookup(input) {
    const query = String(input.query || "")
      .toLowerCase()
      .trim();
    if (query.length < 3) {
      return {
        description: "Knowledge base lookup",
        result: "Requête trop courte (min 3 caractères).",
        logSuffix: "kb_lookup → short",
      };
    }
    type KBRow = {
      id: string;
      title: string;
      category: string;
      summary: string | null;
      content: string | null;
      tags: string | null;
    };
    let rows: KBRow[] = [];
    try {
      rows = db
        .prepare(
          `SELECT id, title, category, summary, content, tags FROM gaif_doctrinaire_docs WHERE status != 'Retiré' OR status IS NULL`
        )
        .all() as KBRow[];
    } catch {
      return {
        description: "Knowledge base lookup",
        result: "Corpus documentaire non initialisé. Lance : python3 scripts/init_db.py puis re-seed la démo GAIF.",
        logSuffix: "kb_lookup → table missing",
      };
    }
    const tokens = query.split(/\s+/).filter((t) => t.length > 2);
    const scored = rows
      .map((r) => {
        const tagsArray: string[] = (() => {
          try {
            return r.tags ? JSON.parse(r.tags) : [];
          } catch {
            return [];
          }
        })();
        const hay =
          `${r.title} ${r.category} ${r.summary ?? ""} ${r.content ?? ""} ${tagsArray.join(" ")}`.toLowerCase();
        let score = 0;
        for (const t of tokens) if (hay.includes(t)) score++;
        return { row: r, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (scored.length === 0) {
      return {
        description: "Knowledge base lookup",
        result: `Aucune entrée trouvée pour "${query}". Essaie des mots-clés plus génériques (ex: maintenance, criticité, comitologie, PSGA).`,
        logSuffix: `kb_lookup(${query}) → 0`,
      };
    }
    const lines = scored.map(({ row }) => {
      const body = row.content || row.summary || "(contenu vide)";
      return `### ${row.title} (${row.category})\n${body}`;
    });
    return {
      description: `KB lookup: ${query}`,
      result: lines.join("\n\n"),
      logSuffix: `kb_lookup(${query}) → ${scored.length}`,
    };
  },
};
