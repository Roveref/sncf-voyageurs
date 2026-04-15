/**
 * Impact simulation for what-if scenarios.
 *
 * Tool: simulateImpact
 */

import db from "../../db/database.js";
import {
  type ImpactResult,
  loadEmployees,
  loadAssignments,
  indexByEmpId,
  getSapDatesIndex,
  computeEmployeeAvailability,
  CHARGEABLE_CATS,
  hpd,
  overlapDays,
} from "./shared.js";

// ── Tool: simulate_impact ──

export function simulateImpact(params: {
  type: "lose_opportunity" | "lose_employee" | "lose_account";
  targetId?: string;
  targetName?: string;
  periodStart: string;
  periodEnd: string;
}): ImpactResult {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const sapDatesIndex = getSapDatesIndex();

  let scenario = "";
  let lostRevenue = 0,
    remainingRevenue = 0,
    lostOpps = 0,
    remainingOpps = 0;
  const freedEmployees: string[] = [];
  let affectedJobCodes: string[] = [];

  if (params.type === "lose_opportunity" && params.targetId) {
    const opp = db
      .prepare("SELECT opportunity, account, grossRevenue, jobCode FROM crm_opportunities WHERE opportunityId = ?")
      .get(params.targetId) as any;
    if (opp) {
      scenario = `Perte de l'opportunite "${opp.opportunity}" (${opp.account})`;
      lostRevenue = opp.grossRevenue || 0;
      lostOpps = 1;
      if (opp.jobCode) affectedJobCodes.push(opp.jobCode);
    }
    const allOpps = db
      .prepare("SELECT grossRevenue FROM crm_opportunities WHERE status NOT IN (15) AND opportunityId != ?")
      .all(params.targetId) as any[];
    remainingRevenue = allOpps.reduce((s: number, o: any) => s + (o.grossRevenue || 0), 0);
    remainingOpps = allOpps.length;
  } else if (params.type === "lose_account" && params.targetName) {
    const opps = db
      .prepare(
        "SELECT opportunityId, opportunity, grossRevenue, jobCode FROM crm_opportunities WHERE account LIKE ? AND status NOT IN (15)"
      )
      .all(`%${params.targetName}%`) as any[];
    scenario = `Perte du compte "${params.targetName}" (${opps.length} opportunites)`;
    lostRevenue = opps.reduce((s: number, o: any) => s + (o.grossRevenue || 0), 0);
    lostOpps = opps.length;
    affectedJobCodes = opps.filter((o: any) => o.jobCode).map((o: any) => o.jobCode);
    const remaining = db
      .prepare("SELECT grossRevenue FROM crm_opportunities WHERE status NOT IN (15) AND account NOT LIKE ?")
      .all(`%${params.targetName}%`) as any[];
    remainingRevenue = remaining.reduce((s: number, o: any) => s + (o.grossRevenue || 0), 0);
    remainingOpps = remaining.length;
  } else if (params.type === "lose_employee" && (params.targetId || params.targetName)) {
    const emp = params.targetId
      ? employees.find((e) => e.empId === params.targetId)
      : employees.find((e) => e.name.toLowerCase().includes((params.targetName || "").toLowerCase()));
    if (emp) {
      scenario = `Depart de ${emp.name} (${emp.grade})`;
      const empAss = (assignmentIndex.get(emp.empId) || []).filter(
        (a) => a.endDate >= params.periodStart && CHARGEABLE_CATS.has(a.category)
      );
      affectedJobCodes = empAss.map((a) => a.jobNo);
    }
  }

  // Find employees freed by lost opportunities
  if (affectedJobCodes.length > 0) {
    const empById = new Map(employees.map((e) => [e.empId, e]));
    const affectedSet = new Set(affectedJobCodes);
    for (const a of assignments) {
      if (
        affectedSet.has(a.jobNo) &&
        CHARGEABLE_CATS.has(a.category) &&
        a.endDate >= params.periodStart &&
        a.startDate <= params.periodEnd
      ) {
        const emp = empById.get(a.empId);
        if (emp && !freedEmployees.includes(emp.name)) freedEmployees.push(emp.name);
      }
    }
  }

  // Calculate TU before/after
  const activeEmps = employees.filter((e) => !e.departure || e.departure >= params.periodStart);
  let totalNetBefore = 0,
    totalChBefore = 0,
    totalChAfter = 0;
  const affectedSet = new Set(affectedJobCodes);

  for (const emp of activeEmps) {
    if (
      params.type === "lose_employee" &&
      (emp.empId === params.targetId || emp.name.toLowerCase().includes((params.targetName || "").toLowerCase()))
    )
      continue;
    const avail = computeEmployeeAvailability(
      emp,
      assignmentIndex.get(emp.empId) || [],
      params.periodStart,
      params.periodEnd,
      sapDatesIndex.get(emp.empId)
    );
    totalNetBefore += avail.netHours;
    totalChBefore += avail.chargeableHours;
    // After: subtract chargeable hours from affected job codes
    const empAffectedH = (assignmentIndex.get(emp.empId) || [])
      .filter((a) => affectedSet.has(a.jobNo) && CHARGEABLE_CATS.has(a.category))
      .reduce((s, a) => {
        const days = overlapDays(a.startDate, a.endDate, params.periodStart, params.periodEnd).length;
        return s + days * (a.utilization / 100) * hpd(emp.grade);
      }, 0);
    totalChAfter += Math.max(0, avail.chargeableHours - empAffectedH);
  }

  const tuBefore = totalNetBefore > 0 ? Math.round((totalChBefore / totalNetBefore) * 1000) / 10 : 0;
  const tuAfter = totalNetBefore > 0 ? Math.round((totalChAfter / totalNetBefore) * 1000) / 10 : 0;

  return {
    scenario,
    pipelineImpact: {
      lostRevenue: Math.round(lostRevenue),
      remainingRevenue: Math.round(remainingRevenue),
      lostOpps,
      remainingOpps,
    },
    staffingImpact: { freedEmployees, tuBefore, tuAfter, tuDelta: Math.round((tuAfter - tuBefore) * 10) / 10 },
  };
}
