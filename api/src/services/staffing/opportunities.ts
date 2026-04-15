/**
 * Account overview, pipeline forecast, staffing gap detection, and alerts.
 *
 * Tools: getAccountOverview, getPipelineForecast, detectStaffingGaps, getAlerts
 */

import db from "../../db/database.js";
import {
  loadEmployees,
  loadAssignments,
  loadSkills,
  indexByEmpId,
  getSapDatesIndex,
  computeEmployeeAvailability,
  CHARGEABLE_CATS,
  overlapDays,
  countWorkdays,
  addDays,
  splitIntoMonths,
} from "./shared.js";

// ── Tool: get_account_overview ──

export function getAccountOverview(params: { account: string; periodStart: string; periodEnd: string }) {
  // Opportunities for this account
  const opps = db
    .prepare(
      "SELECT opportunityId, opportunity, status, grossRevenue, netRevenue, winPct, jobCode, manager, partner, creationDate, bookingDate FROM crm_opportunities WHERE account LIKE ? AND status != 15"
    )
    .all(`%${params.account}%`) as any[];

  // People working on this account (via assignments linked by jobCode)
  const jobCodes = opps.filter((o: any) => o.jobCode).map((o: any) => o.jobCode);
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const empById = new Map(employees.map((e) => [e.empId, e]));
  const peopleOnAccount = new Map<string, { name: string; grade: string; totalDays: number; jobs: string[] }>();

  if (jobCodes.length > 0) {
    const codeSet = new Set(jobCodes);
    for (const a of assignments) {
      if (codeSet.has(a.jobNo) && CHARGEABLE_CATS.has(a.category)) {
        const days = overlapDays(a.startDate, a.endDate, params.periodStart, params.periodEnd).length;
        if (days > 0) {
          const emp = empById.get(a.empId);
          if (emp) {
            const existing = peopleOnAccount.get(emp.empId) || {
              name: emp.name,
              grade: emp.grade,
              totalDays: 0,
              jobs: [],
            };
            existing.totalDays += days;
            if (!existing.jobs.includes(a.jobName)) existing.jobs.push(a.jobName);
            peopleOnAccount.set(emp.empId, existing);
          }
        }
      }
    }
  }

  // Staffing needs for this account's opportunities
  const opportunityIds = opps.map((o: any) => o.opportunityId);
  const needs =
    opportunityIds.length > 0
      ? (db
          .prepare(
            `SELECT opportunityId, opportunityId, grade, quantity, utilization, startDate, endDate, skills, probability, status FROM user_staffing_needs WHERE opportunityId IN (${opportunityIds.map(() => "?").join(",")})`
          )
          .all(...opportunityIds) as any[])
      : [];

  // Open actions on this account's opportunities
  const actions =
    opportunityIds.length > 0
      ? (db
          .prepare(
            `SELECT a.opportunityId, a.description, a.owner, a.dueDate, a.priority, a.status, o.opportunity as oppName FROM user_actions a JOIN crm_opportunities o ON a.opportunityId = o.opportunityId WHERE a.opportunityId IN (${opportunityIds.map(() => "?").join(",")}) AND a.status != 'done' ORDER BY a.dueDate LIMIT 10`
          )
          .all(...opportunityIds) as any[])
      : [];

  const totalRevenue = opps.reduce((s: number, o: any) => s + (o.grossRevenue || 0), 0);
  const byStatus: Record<number, { count: number; revenue: number }> = {};
  for (const o of opps) {
    const s = byStatus[o.status] || { count: 0, revenue: 0 };
    s.count++;
    s.revenue += o.grossRevenue || 0;
    byStatus[o.status] = s;
  }

  return {
    account: params.account,
    totalOpps: opps.length,
    totalRevenue: Math.round(totalRevenue),
    byStatus,
    topOpps: opps
      .sort((a: any, b: any) => (b.grossRevenue || 0) - (a.grossRevenue || 0))
      .slice(0, 5)
      .map((o: any) => ({
        name: o.opportunity,
        status: o.status,
        revenue: Math.round(o.grossRevenue || 0),
        winPct: o.winPct,
        manager: o.manager,
      })),
    peopleOnAccount: Array.from(peopleOnAccount.values()).sort((a, b) => b.totalDays - a.totalDays),
    openStaffingNeeds: needs.length,
    staffingNeeds: needs.map((n: any) => ({
      profile: n.grade,
      quantity: n.quantity,
      startDate: n.startDate,
      endDate: n.endDate,
    })),
    openActions: actions.map((a: any) => ({
      oppName: a.oppName,
      description: a.description,
      owner: a.owner,
      dueDate: a.dueDate,
      priority: a.priority,
    })),
  };
}

// ── Tool: detect_staffing_gaps ──

export function detectStaffingGaps(params: { periodStart: string; periodEnd: string }) {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Won/Go opportunities without staffing needs
  const oppsNoStaffing = db
    .prepare(
      `SELECT o.opportunityId, o.opportunity, o.account, o.grossRevenue FROM crm_opportunities o
     WHERE o.status IN (4, 11) AND NOT EXISTS (SELECT 1 FROM user_staffing_needs n WHERE n.opportunityId = o.opportunityId)`
    )
    .all() as any[];

  // 2. Overallocated employees (>100% in the period)
  const overallocated: { name: string; grade: string; totalUtil: number; missions: string[] }[] = [];
  const activeEmps = employees.filter((e) => !e.departure || e.departure >= params.periodStart);
  for (const emp of activeEmps) {
    const empAss = (assignmentIndex.get(emp.empId) || []).filter(
      (a) => CHARGEABLE_CATS.has(a.category) && a.endDate >= params.periodStart && a.startDate <= params.periodEnd
    );
    const totalUtil = empAss.reduce((s, a) => s + (a.utilization || 0), 0);
    if (totalUtil > 100) {
      overallocated.push({
        name: emp.name,
        grade: emp.grade,
        totalUtil: Math.round(totalUtil),
        missions: empAss.map((a) => a.jobName),
      });
    }
  }

  // 3. Upcoming missions without people (staffing needs starting soon)
  const urgentNeeds = db
    .prepare(
      `SELECT n.grade, n.quantity, n.startDate, n.endDate, n.skills, o.opportunity as oppName, o.account
     FROM user_staffing_needs n JOIN crm_opportunities o ON n.opportunityId = o.opportunityId
     WHERE n.startDate BETWEEN ? AND date(?, '+30 days') ORDER BY n.startDate`
    )
    .all(today, today) as any[];

  // 4. Long-term bench (no chargeable assignment for 30+ days)
  const benchEmployees: { name: string; grade: string; benchDays: number }[] = [];
  for (const emp of activeEmps) {
    const empAss2 = assignmentIndex.get(emp.empId) || [];
    const hasChargeable = empAss2.some(
      (a) => CHARGEABLE_CATS.has(a.category) && a.endDate >= today && a.startDate <= today
    );
    if (!hasChargeable) {
      // Find last chargeable end date
      const lastEnd = empAss2
        .filter((a) => CHARGEABLE_CATS.has(a.category) && a.endDate < today)
        .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
      const benchDays = lastEnd ? countWorkdays(lastEnd.endDate, today) : 999;
      if (benchDays >= 20) benchEmployees.push({ name: emp.name, grade: emp.grade, benchDays });
    }
  }

  // 5. Skill gaps: skills required by needs but absent in available people
  const allSkills = loadSkills();
  const neededSkills = new Map<string, number>();
  const availableSkills = new Set<string>();
  for (const n of urgentNeeds) {
    try {
      const skills = JSON.parse(n.skills || "[]") as string[];
      for (const s of skills) neededSkills.set(s, (neededSkills.get(s) || 0) + 1);
    } catch {
      /* */
    }
  }
  for (const s of allSkills) availableSkills.add(s.name);
  const skillGaps = Array.from(neededSkills.entries())
    .filter(([skill]) => !Array.from(availableSkills).some((a) => a.toLowerCase().includes(skill.toLowerCase())))
    .map(([skill, count]) => ({ skill, demandCount: count }));

  return {
    oppsWithoutStaffing: oppsNoStaffing.map((o: any) => ({
      name: o.opportunity,
      account: o.account,
      revenue: Math.round(o.grossRevenue || 0),
    })),
    overallocated,
    urgentNeeds: urgentNeeds.map((n: any) => ({
      profile: n.grade,
      quantity: n.quantity,
      startDate: n.startDate,
      oppName: n.oppName,
      account: n.account,
    })),
    benchEmployees: benchEmployees.sort((a, b) => b.benchDays - a.benchDays).slice(0, 10),
    skillGaps,
  };
}

// ── Tool: get_alerts ──

export function getAlerts(params: { lookaheadDays?: number }): {
  overdueActions: { description: string; owner: string; dueDate: string; oppName: string; daysPastDue: number }[];
  endingMissions: { empName: string; grade: string; jobName: string; endDate: string; daysLeft: number }[];
  upcomingDepartures: {
    empName: string;
    grade: string;
    departureDate: string;
    daysLeft: number;
    activeMissions: number;
  }[];
  stagnantProposals: {
    oppName: string;
    account: string;
    revenue: number;
    creationDate: string;
    daysInProposal: number;
  }[];
  overallocated: { empName: string; grade: string; totalUtil: number; missions: string[] }[];
} {
  const lookahead = params.lookaheadDays || 30;
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = addDays(today, lookahead);
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);

  // 1. Overdue actions
  const overdueActions = (
    db
      .prepare(
        `SELECT a.description, a.owner, a.dueDate, o.opportunity as oppName
     FROM user_actions a JOIN crm_opportunities o ON a.opportunityId = o.opportunityId
     WHERE a.status != 'done' AND a.dueDate < ?
     ORDER BY a.dueDate LIMIT 20`
      )
      .all(today) as any[]
  ).map((r: any) => ({
    description: r.description,
    owner: r.owner,
    dueDate: r.dueDate,
    oppName: r.oppName,
    daysPastDue: countWorkdays(r.dueDate, today),
  }));

  // 2. Missions ending within lookahead
  const endingMissions = (
    db
      .prepare(
        `SELECT e.name as empName, e.grade, a.jobName, a.endDate
     FROM mds_assignments a JOIN employees e ON a.empId = e.empId
     WHERE a.category = 'chargeable'
     AND a.endDate >= ? AND a.endDate <= ?
     AND (e.departureDate IS NULL OR e.departureDate > ?)
     ORDER BY a.endDate LIMIT 20`
      )
      .all(today, futureDate, today) as any[]
  ).map((r: any) => ({
    empName: r.empName,
    grade: r.grade,
    jobName: r.jobName,
    endDate: r.endDate,
    daysLeft: countWorkdays(today, r.endDate),
  }));

  // 3. Upcoming departures
  const upcomingDepartures: {
    empName: string;
    grade: string;
    departureDate: string;
    daysLeft: number;
    activeMissions: number;
  }[] = [];
  for (const emp of employees) {
    if (!emp.departure) continue;
    if (emp.departure < today || emp.departure > futureDate) continue;
    const empAss = assignmentIndex.get(emp.empId) || [];
    const activeMissions = empAss.filter(
      (a) => a.category === "chargeable" && a.endDate >= today && a.startDate <= emp.departure!
    ).length;
    upcomingDepartures.push({
      empName: emp.name,
      grade: emp.grade,
      departureDate: emp.departure,
      daysLeft: countWorkdays(today, emp.departure),
      activeMissions,
    });
  }
  // Also check user_overrides for manual departures
  const manualDeps = db
    .prepare(
      `SELECT ov.entityId as empId, ov.newValue as departureDate, e.name, e.grade
     FROM user_overrides ov JOIN employees e ON ov.entityId = e.empId
     WHERE ov.entityType = 'employee' AND ov.field = 'departureDate'
       AND ov.newValue >= ? AND ov.newValue <= ?`
    )
    .all(today, futureDate) as any[];
  for (const md of manualDeps) {
    if (!upcomingDepartures.some((d) => d.empName === md.name)) {
      const empAss = assignmentIndex.get(md.empId) || [];
      const activeMissions = empAss.filter((a: any) => a.category === "chargeable" && a.endDate >= today).length;
      upcomingDepartures.push({
        empName: md.name,
        grade: md.grade,
        departureDate: md.departureDate,
        daysLeft: countWorkdays(today, md.departureDate),
        activeMissions,
      });
    }
  }
  upcomingDepartures.sort((a, b) => a.daysLeft - b.daysLeft);

  // 4. Stagnant proposals (>60 days in Proposal status)
  const stagnantProposals = (
    db
      .prepare(
        `SELECT opportunity as name, account, grossRevenue, creationDate, lastStatusChangeDate
     FROM crm_opportunities WHERE status = 6
     AND (lastStatusChangeDate IS NOT NULL AND lastStatusChangeDate < date(?, '-60 days')
       OR lastStatusChangeDate IS NULL AND creationDate < date(?, '-60 days'))
     ORDER BY grossRevenue DESC LIMIT 15`
      )
      .all(today, today) as any[]
  ).map((r: any) => {
    const refDate = r.lastStatusChangeDate || r.creationDate;
    return {
      oppName: r.name,
      account: r.account,
      revenue: Math.round(r.grossRevenue || 0),
      creationDate: r.creationDate,
      daysInProposal: Math.round((new Date(today).getTime() - new Date(refDate).getTime()) / 86400000),
    };
  });

  // 5. Overallocated employees (same as detect_staffing_gaps but with more detail)
  const overallocated: { empName: string; grade: string; totalUtil: number; missions: string[] }[] = [];
  for (const emp of employees) {
    if (emp.departure && emp.departure < today) continue;
    const empAss = (assignmentIndex.get(emp.empId) || []).filter(
      (a) => a.category === "chargeable" && a.endDate >= today && a.startDate <= futureDate
    );
    const totalUtil = empAss.reduce((s, a) => s + (a.utilization || 0), 0);
    if (totalUtil > 100) {
      overallocated.push({
        empName: emp.name,
        grade: emp.grade,
        totalUtil: Math.round(totalUtil),
        missions: empAss.map((a) => `${a.jobName} (${a.utilization}%)`),
      });
    }
  }
  overallocated.sort((a, b) => b.totalUtil - a.totalUtil);

  return {
    overdueActions,
    endingMissions,
    upcomingDepartures: upcomingDepartures.slice(0, 15),
    stagnantProposals,
    overallocated: overallocated.slice(0, 15),
  };
}

// ── Tool: get_pipeline_forecast ──

export function getPipelineForecast(params: { periodStart: string; periodEnd: string }): {
  totalGross: number;
  totalWeighted: number;
  byStatus: { status: number; label: string; count: number; gross: number; weighted: number }[];
  byMonth: { month: string; gross: number; weighted: number; bookings: number }[];
  topDeals: {
    name: string;
    account: string;
    gross: number;
    weighted: number;
    winPct: number;
    status: number;
    estimatedBooking: string | null;
  }[];
  capacityGap: { availableHours: number; requiredHours: number; gapHours: number; gapPct: number } | null;
} {
  const statusLabels: Record<number, string> = { 1: "Lead", 4: "Go", 6: "Proposal", 11: "Won", 14: "Booked" };

  // Pipeline by status (exclude Lost)
  const byStatus = (
    db
      .prepare(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(grossRevenue),0) as gross, COALESCE(SUM(weightedBooking),0) as weighted
     FROM crm_opportunities WHERE status NOT IN (15)
     AND (estimatedBookingDate >= ? OR bookingDate >= ? OR (estimatedBookingDate IS NULL AND creationDate >= date(?, '-365 days')))
     GROUP BY status ORDER BY status`
      )
      .all(params.periodStart, params.periodStart, params.periodStart) as any[]
  ).map((r: any) => ({
    status: r.status,
    label: statusLabels[r.status] || `Status ${r.status}`,
    count: r.count,
    gross: Math.round(r.gross),
    weighted: Math.round(r.weighted),
  }));

  const totalGross = byStatus.reduce((s, r) => s + r.gross, 0);
  const totalWeighted = byStatus.reduce((s, r) => s + r.weighted, 0);

  // Monthly breakdown by estimatedBookingDate or bookingDate
  const months = splitIntoMonths(params.periodStart, params.periodEnd);
  const byMonth = months.map((m) => {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(grossRevenue),0) as gross, COALESCE(SUM(weightedBooking),0) as weighted
       FROM crm_opportunities WHERE status NOT IN (14, 15)
       AND estimatedBookingDate >= ? AND estimatedBookingDate < ?`
      )
      .get(m.start, m.end) as any;
    const booked = db
      .prepare(
        `SELECT COALESCE(SUM(grossRevenue),0) as revenue
       FROM crm_opportunities WHERE status = 14 AND bookingDate >= ? AND bookingDate < ?`
      )
      .get(m.start, m.end) as any;
    return {
      month: m.label,
      gross: Math.round(row?.gross || 0),
      weighted: Math.round(row?.weighted || 0),
      bookings: Math.round(booked?.revenue || 0),
    };
  });

  // Top deals
  const topDeals = (
    db
      .prepare(
        `SELECT opportunity as name, account, grossRevenue, weightedBooking, winPct, status, estimatedBookingDate
     FROM crm_opportunities WHERE status NOT IN (14, 15)
     ORDER BY weightedBooking DESC LIMIT 10`
      )
      .all() as any[]
  ).map((r: any) => ({
    name: r.name,
    account: r.account,
    gross: Math.round(r.grossRevenue || 0),
    weighted: Math.round(r.weightedBooking || 0),
    winPct: r.winPct,
    status: r.status,
    estimatedBooking: r.estimatedBookingDate,
  }));

  // Capacity gap: available hours vs required hours from staffing needs
  let capacityGap = null;
  try {
    const employees = loadEmployees();
    const assignments = loadAssignments();
    const assignmentIndex = indexByEmpId(assignments);
    const sapDatesIndex = getSapDatesIndex();
    const activeEmps = employees.filter(
      (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
    );
    let totalAvailH = 0;
    for (const emp of activeEmps) {
      const avail = computeEmployeeAvailability(
        emp,
        assignmentIndex.get(emp.empId) || [],
        params.periodStart,
        params.periodEnd,
        sapDatesIndex.get(emp.empId)
      );
      totalAvailH += avail.availableHours;
    }
    const needsRows = db
      .prepare(
        `SELECT quantity, startDate, endDate, utilization FROM user_staffing_needs
       WHERE startDate <= ? AND endDate >= ?`
      )
      .all(params.periodEnd, params.periodStart) as any[];
    let requiredH = 0;
    for (const n of needsRows) {
      const days = countWorkdays(
        n.startDate > params.periodStart ? n.startDate : params.periodStart,
        n.endDate < params.periodEnd ? n.endDate : params.periodEnd
      );
      requiredH += days * 8 * (n.quantity || 1) * ((n.utilization || 100) / 100);
    }
    const gapH = requiredH - totalAvailH;
    capacityGap = {
      availableHours: Math.round(totalAvailH),
      requiredHours: Math.round(requiredH),
      gapHours: Math.round(gapH),
      gapPct: totalAvailH > 0 ? Math.round((gapH / totalAvailH) * 100) : 0,
    };
  } catch {
    /* capacity gap is optional */
  }

  return { totalGross, totalWeighted, byStatus, byMonth, topDeals, capacityGap };
}
