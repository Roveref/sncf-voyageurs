/**
 * Team KPIs, trends, and scenario comparison.
 *
 * Tools: getTeamKPIs, getTrend, compareScenarios
 */

import db from "../../db/database.js";
import {
  type TeamKPIs,
  loadEmployees,
  loadAssignments,
  indexByEmpId,
  getSapDatesIndex,
  computeEmployeeAvailability,
  GRADE_ORDER,
  GRADE_TU_TARGET,
  splitIntoMonths,
} from "./shared.js";

// ── Tool: get_team_kpis ──

export function getTeamKPIs(params: {
  periodStart: string;
  periodEnd: string;
  grade?: string;
  subTeam?: string;
}): TeamKPIs {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const sapDatesIndex = getSapDatesIndex();

  let filtered = employees.filter(
    (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
  );
  if (params.grade) filtered = filtered.filter((e) => e.grade === params.grade);
  if (params.subTeam) filtered = filtered.filter((e) => e.subTeam === params.subTeam);

  let totalNet = 0,
    totalCh = 0,
    totalAbs = 0,
    totalTr = 0,
    totalGo = 0;
  const gradeMap = new Map<string, { count: number; ch: number; net: number }>();

  for (const emp of filtered) {
    const avail = computeEmployeeAvailability(
      emp,
      assignmentIndex.get(emp.empId) || [],
      params.periodStart,
      params.periodEnd,
      sapDatesIndex.get(emp.empId)
    );
    totalNet += avail.netHours;
    totalCh += avail.chargeableHours;
    totalAbs += avail.absenceHours;
    totalTr += avail.trainingHours;
    totalGo += avail.goHours;

    const g = gradeMap.get(emp.grade) || { count: 0, ch: 0, net: 0 };
    g.count++;
    g.ch += avail.chargeableHours;
    g.net += avail.netHours;
    gradeMap.set(emp.grade, g);
  }

  const tuPct = totalNet > 0 ? Math.round((totalCh / totalNet) * 1000) / 10 : 0;
  const toPct = totalNet > 0 ? Math.round(((totalCh + totalGo + totalTr) / totalNet) * 1000) / 10 : 0;
  const benchPct = totalNet > 0 ? Math.round(((totalNet - totalCh) / totalNet) * 1000) / 10 : 0;

  const byGrade = GRADE_ORDER.filter((g) => gradeMap.has(g)).map((g) => {
    const d = gradeMap.get(g)!;
    return {
      grade: g,
      count: d.count,
      tuPct: d.net > 0 ? Math.round((d.ch / d.net) * 1000) / 10 : 0,
      target: GRADE_TU_TARGET[g] || 90,
    };
  });

  return {
    employeeCount: filtered.length,
    totalNetHours: Math.round(totalNet),
    totalChargeableHours: Math.round(totalCh),
    totalAbsenceHours: Math.round(totalAbs),
    totalTrainingHours: Math.round(totalTr),
    tuPct,
    toPct,
    benchPct,
    byGrade,
  };
}

// ── Tool: get_trend ──

export function getTrend(params: {
  metric: "tu" | "pipeline" | "bench" | "bookings";
  periodStart: string;
  periodEnd: string;
  granularity?: "monthly" | "default";
}) {
  // Monthly granularity: return an array of data points per calendar month
  if (params.granularity === "monthly") {
    const months = splitIntoMonths(params.periodStart, params.periodEnd);
    if (params.metric === "tu" || params.metric === "bench") {
      const points = months.map((m) => {
        const kpis = getTeamKPIs({ periodStart: m.start, periodEnd: m.end });
        return {
          label: m.label,
          start: m.start,
          end: m.end,
          tuPct: kpis.tuPct,
          toPct: kpis.toPct,
          benchPct: kpis.benchPct,
          count: kpis.employeeCount,
        };
      });
      return { metric: params.metric, granularity: "monthly", points };
    }
    if (params.metric === "pipeline") {
      const points = months.map((m) => {
        const row = db
          .prepare(
            "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue, COALESCE(SUM(weightedBooking),0) as weighted FROM crm_opportunities WHERE status NOT IN (14,15) AND creationDate >= ? AND creationDate < ?"
          )
          .get(m.start, m.end) as any;
        return {
          label: m.label,
          start: m.start,
          end: m.end,
          opps: row.count,
          revenue: Math.round(row.revenue),
          weighted: Math.round(row.weighted),
        };
      });
      return { metric: "pipeline", granularity: "monthly", points };
    }
    // bookings
    const points = months.map((m) => {
      const row = db
        .prepare(
          "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue FROM crm_opportunities WHERE status = 14 AND bookingDate >= ? AND bookingDate < ?"
        )
        .get(m.start, m.end) as any;
      return { label: m.label, start: m.start, end: m.end, count: row.count, revenue: Math.round(row.revenue) };
    });
    return { metric: "bookings", granularity: "monthly", points };
  }

  // Default: Split the period in half for comparison
  const startDate = new Date(params.periodStart);
  const endDate = new Date(params.periodEnd);
  const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
  const midStr = midDate.toISOString().slice(0, 10);

  if (params.metric === "tu" || params.metric === "bench") {
    const kpis1 = getTeamKPIs({ periodStart: params.periodStart, periodEnd: midStr });
    const kpis2 = getTeamKPIs({ periodStart: midStr, periodEnd: params.periodEnd });
    return {
      metric: params.metric,
      period1: {
        start: params.periodStart,
        end: midStr,
        tuPct: kpis1.tuPct,
        toPct: kpis1.toPct,
        benchPct: kpis1.benchPct,
        count: kpis1.employeeCount,
      },
      period2: {
        start: midStr,
        end: params.periodEnd,
        tuPct: kpis2.tuPct,
        toPct: kpis2.toPct,
        benchPct: kpis2.benchPct,
        count: kpis2.employeeCount,
      },
      delta: {
        tuPct: Math.round((kpis2.tuPct - kpis1.tuPct) * 10) / 10,
        toPct: Math.round((kpis2.toPct - kpis1.toPct) * 10) / 10,
        benchPct: Math.round((kpis2.benchPct - kpis1.benchPct) * 10) / 10,
      },
      trend: kpis2.tuPct > kpis1.tuPct ? "hausse" : kpis2.tuPct < kpis1.tuPct ? "baisse" : "stable",
    };
  }

  if (params.metric === "pipeline") {
    const p1 = db
      .prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue FROM crm_opportunities WHERE status NOT IN (14,15) AND creationDate BETWEEN ? AND ?"
      )
      .get(params.periodStart, midStr) as any;
    const p2 = db
      .prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue FROM crm_opportunities WHERE status NOT IN (14,15) AND creationDate BETWEEN ? AND ?"
      )
      .get(midStr, params.periodEnd) as any;
    return {
      metric: "pipeline",
      period1: { start: params.periodStart, end: midStr, opps: p1.count, revenue: Math.round(p1.revenue) },
      period2: { start: midStr, end: params.periodEnd, opps: p2.count, revenue: Math.round(p2.revenue) },
      delta: { opps: p2.count - p1.count, revenue: Math.round(p2.revenue - p1.revenue) },
      trend: p2.revenue > p1.revenue ? "hausse" : p2.revenue < p1.revenue ? "baisse" : "stable",
    };
  }

  // bookings
  const b1 = db
    .prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue FROM crm_opportunities WHERE status = 14 AND bookingDate BETWEEN ? AND ?"
    )
    .get(params.periodStart, midStr) as any;
  const b2 = db
    .prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as revenue FROM crm_opportunities WHERE status = 14 AND bookingDate BETWEEN ? AND ?"
    )
    .get(midStr, params.periodEnd) as any;
  return {
    metric: "bookings",
    period1: { start: params.periodStart, end: midStr, count: b1.count, revenue: Math.round(b1.revenue) },
    period2: { start: midStr, end: params.periodEnd, count: b2.count, revenue: Math.round(b2.revenue) },
    delta: { count: b2.count - b1.count, revenue: Math.round(b2.revenue - b1.revenue) },
    trend: b2.revenue > b1.revenue ? "hausse" : b2.revenue < b1.revenue ? "baisse" : "stable",
  };
}

// ── Tool: compare_scenarios ──

export function compareScenarios(params: {
  scenarioId1?: string; // null = real data
  scenarioId2: string;
  periodStart: string;
  periodEnd: string;
}): {
  scenario1: { id: string | null; name: string };
  scenario2: { id: string; name: string };
  real: { tuPct: number; toPct: number; benchPct: number; employeeCount: number; chargeableHours: number };
  withScenario: { tuPct: number; toPct: number; benchPct: number; employeeCount: number; chargeableHours: number };
  delta: { tuPct: number; toPct: number; benchPct: number; chargeableHours: number };
  assignmentChanges: { empName: string; type: string; jobName: string; utilization: number }[];
} {
  const employees = loadEmployees();
  const baseAssignments = loadAssignments();
  const assignmentIndex = indexByEmpId(baseAssignments);
  const sapDatesIndex = getSapDatesIndex();

  // Load scenario names
  const s1Name = params.scenarioId1
    ? (db.prepare("SELECT name FROM user_scenarios WHERE id = ?").get(params.scenarioId1) as any)?.name ||
      params.scenarioId1
    : "Actual";
  const s2Row = db
    .prepare("SELECT name, assignment_overrides, employee_overrides FROM user_scenarios WHERE id = ?")
    .get(params.scenarioId2) as any;
  if (!s2Row) {
    return {
      scenario1: { id: params.scenarioId1 || null, name: s1Name },
      scenario2: { id: params.scenarioId2, name: "Scenario not found" },
      real: { tuPct: 0, toPct: 0, benchPct: 0, employeeCount: 0, chargeableHours: 0 },
      withScenario: { tuPct: 0, toPct: 0, benchPct: 0, employeeCount: 0, chargeableHours: 0 },
      delta: { tuPct: 0, toPct: 0, benchPct: 0, chargeableHours: 0 },
      assignmentChanges: [],
    };
  }

  // Parse scenario overrides
  let overrides: Record<
    string,
    { category?: string; utilization?: number; startDate?: string; endDate?: string; deleted?: boolean }
  > = {};
  try {
    overrides = JSON.parse(s2Row.assignment_overrides || "{}");
  } catch {
    /* */
  }

  // Compute real KPIs (baseline)
  const realKPIs = getTeamKPIs({ periodStart: params.periodStart, periodEnd: params.periodEnd });

  // Apply scenario overrides to assignments
  const scenarioAssignments = [...baseAssignments];
  const assignmentChanges: { empName: string; type: string; jobName: string; utilization: number }[] = [];

  for (const [key, override] of Object.entries(overrides)) {
    // Key format: empId::jobNo::startDate
    const parts = key.split("::");
    if (parts.length < 3) continue;
    const [empId, jobNo, startDate] = parts;
    const emp = employees.find((e) => e.empId === empId);
    const empName = emp?.name || empId;

    if (override.deleted) {
      // Remove this assignment
      const idx = scenarioAssignments.findIndex(
        (a) => a.empId === empId && a.jobNo === jobNo && a.startDate === startDate
      );
      if (idx >= 0) {
        assignmentChanges.push({
          empName,
          type: "supprime",
          jobName: scenarioAssignments[idx].jobName,
          utilization: 0,
        });
        scenarioAssignments.splice(idx, 1);
      }
    } else {
      // Modify or add
      const existing = scenarioAssignments.find(
        (a) => a.empId === empId && a.jobNo === jobNo && a.startDate === startDate
      );
      if (existing) {
        if (override.utilization !== undefined) existing.utilization = override.utilization;
        if (override.startDate) existing.startDate = override.startDate;
        if (override.endDate) existing.endDate = override.endDate;
        if (override.category) existing.category = override.category;
        assignmentChanges.push({
          empName,
          type: "modifie",
          jobName: existing.jobName,
          utilization: override.utilization || existing.utilization,
        });
      } else {
        // New assignment added by scenario
        const newAss = {
          empId: empId,
          jobNo: jobNo,
          jobName: override.category === "chargeable" ? jobNo : "Scenario override",
          category: override.category || "chargeable",
          startDate: override.startDate || startDate,
          endDate: override.endDate || params.periodEnd,
          utilization: override.utilization || 100,
          hoursPerDay: 8,
        };
        scenarioAssignments.push(newAss);
        assignmentChanges.push({ empName, type: "ajoute", jobName: newAss.jobName, utilization: newAss.utilization });
      }
    }
  }

  // Compute scenario KPIs
  const scenarioIndex = indexByEmpId(scenarioAssignments);
  const activeEmps = employees.filter(
    (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
  );
  let totalNet = 0,
    totalCh = 0,
    totalAbs = 0,
    totalTr = 0,
    totalGo = 0;
  for (const emp of activeEmps) {
    const avail = computeEmployeeAvailability(
      emp,
      scenarioIndex.get(emp.empId) || [],
      params.periodStart,
      params.periodEnd,
      sapDatesIndex.get(emp.empId)
    );
    totalNet += avail.netHours;
    totalCh += avail.chargeableHours;
    totalAbs += avail.absenceHours;
    totalTr += avail.trainingHours;
    totalGo += avail.goHours;
  }
  const scenarioTU = totalNet > 0 ? Math.round((totalCh / totalNet) * 1000) / 10 : 0;
  const scenarioTO = totalNet > 0 ? Math.round(((totalCh + totalGo + totalTr) / totalNet) * 1000) / 10 : 0;
  const scenarioBench = totalNet > 0 ? Math.round(((totalNet - totalCh) / totalNet) * 1000) / 10 : 0;

  return {
    scenario1: { id: params.scenarioId1 || null, name: s1Name },
    scenario2: { id: params.scenarioId2, name: s2Row.name },
    real: {
      tuPct: realKPIs.tuPct,
      toPct: realKPIs.toPct,
      benchPct: realKPIs.benchPct,
      employeeCount: realKPIs.employeeCount,
      chargeableHours: realKPIs.totalChargeableHours,
    },
    withScenario: {
      tuPct: scenarioTU,
      toPct: scenarioTO,
      benchPct: scenarioBench,
      employeeCount: activeEmps.length,
      chargeableHours: Math.round(totalCh),
    },
    delta: {
      tuPct: Math.round((scenarioTU - realKPIs.tuPct) * 10) / 10,
      toPct: Math.round((scenarioTO - realKPIs.toPct) * 10) / 10,
      benchPct: Math.round((scenarioBench - realKPIs.benchPct) * 10) / 10,
      chargeableHours: Math.round(totalCh - realKPIs.totalChargeableHours),
    },
    assignmentChanges: assignmentChanges.slice(0, 20),
  };
}
