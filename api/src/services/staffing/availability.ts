/**
 * Staffing availability calculations.
 *
 * Tools: computeAvailability, getSapActuals, getSapMdsVariance
 */

import {
  type AvailabilityResult,
  loadEmployees,
  loadAssignments,
  indexByEmpId,
  getSapDatesIndex,
  computeEmployeeAvailability,
  MDS_EXTRACT_START,
  CHARGEABLE_CATS,
  hpd,
  eachWorkday,
  loadSapForPeriod,
  aggregateSapHours,
} from "./shared.js";

// ── Tool: compute_availability ──

export async function computeAvailability(
  params: {
    empId?: string;
    grade?: string;
    minAvailablePct?: number;
    periodStart: string;
    periodEnd: string;
  },
  onProgress?: (processed: number, total: number) => void
): Promise<AvailabilityResult[]> {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const sapDatesIndex = getSapDatesIndex();

  let filtered = employees.filter(
    (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
  );

  if (params.empId) filtered = filtered.filter((e) => e.empId === params.empId);
  if (params.grade) filtered = filtered.filter((e) => e.grade === params.grade);

  const results: AvailabilityResult[] = [];
  for (let i = 0; i < filtered.length; i++) {
    results.push(
      computeEmployeeAvailability(
        filtered[i],
        assignmentIndex.get(filtered[i].empId) || [],
        params.periodStart,
        params.periodEnd,
        sapDatesIndex.get(filtered[i].empId)
      )
    );
    // Yield to event loop every 10 employees for SSE progress flush
    if (onProgress && (i + 1) % 10 === 0) {
      onProgress(i + 1, filtered.length);
      await new Promise((r) => setImmediate(r));
    }
  }

  if (params.minAvailablePct !== undefined) {
    return results.filter((r) => r.availablePct >= params.minAvailablePct!);
  }

  return results;
}

// ── Tool: get_sap_actuals ──

export function getSapActuals(params: { empId?: string; grade?: string; periodStart: string; periodEnd: string }): {
  empId: string;
  name: string;
  grade: string;
  sapDays: number;
  totalHours: number;
  chargeableHours: number;
  absenceHours: number;
  trainingHours: number;
  netHours: number;
  tuPct: number;
  availableHours: number;
  availablePct: number;
  topProjects: { salesOrder: string; hours: number }[];
}[] {
  const employees = loadEmployees();
  let filtered = employees.filter(
    (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
  );
  if (params.empId) filtered = filtered.filter((e) => e.empId === params.empId);
  if (params.grade) filtered = filtered.filter((e) => e.grade === params.grade);

  const effectiveStart = params.periodStart > MDS_EXTRACT_START ? params.periodStart : MDS_EXTRACT_START;
  if (effectiveStart >= params.periodEnd) return [];

  const results: ReturnType<typeof getSapActuals> = [];

  for (const emp of filtered) {
    const sapRecords = loadSapForPeriod(effectiveStart, params.periodEnd, emp.empId);
    if (sapRecords.length === 0) continue; // No SAP data for this employee

    const agg = aggregateSapHours(sapRecords, emp.grade, effectiveStart, params.periodEnd);
    const netH = agg.totalH - agg.absH;
    const availH = Math.max(0, netH - agg.chH - agg.goH - agg.trH - agg.otherH);
    const tuPct = netH > 0 ? Math.round((agg.chH / netH) * 1000) / 10 : 0;
    const availPct = netH > 0 ? Math.round((availH / netH) * 1000) / 10 : 0;

    // Top projects by hours
    const projectHours = new Map<string, number>();
    for (const r of sapRecords) {
      if (CHARGEABLE_CATS.has(r.category) && r.activityType) {
        projectHours.set(r.activityType, (projectHours.get(r.activityType) || 0) + r.hours);
      }
    }
    const topProjects = Array.from(projectHours.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([salesOrder, hours]) => ({ salesOrder, hours: Math.round(hours * 10) / 10 }));

    results.push({
      empId: emp.empId,
      name: emp.name,
      grade: emp.grade,
      sapDays: agg.days,
      totalHours: agg.totalH,
      chargeableHours: agg.chH,
      absenceHours: agg.absH,
      trainingHours: agg.trH,
      netHours: Math.round(netH * 10) / 10,
      tuPct,
      availableHours: Math.round(availH * 10) / 10,
      availablePct: availPct,
      topProjects,
    });
  }

  results.sort((a, b) => b.tuPct - a.tuPct);
  return results.slice(0, 30);
}

// ── Tool: get_sap_mds_variance ──

export function getSapMdsVariance(params: { empId?: string; grade?: string; periodStart: string; periodEnd: string }): {
  empId: string;
  name: string;
  grade: string;
  mds: { chH: number; absH: number; trH: number; tuPct: number };
  sap: { chH: number; absH: number; trH: number; tuPct: number };
  delta: { chH: number; absH: number; trH: number; tuPts: number };
  status: string; // "surperformance" | "sous-performance" | "aligne"
}[] {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const sapDatesIndex = getSapDatesIndex();

  let filtered = employees.filter(
    (e) => (!e.departure || e.departure >= params.periodStart) && (!e.arrival || e.arrival <= params.periodEnd)
  );
  if (params.empId) filtered = filtered.filter((e) => e.empId === params.empId);
  if (params.grade) filtered = filtered.filter((e) => e.grade === params.grade);

  const results: ReturnType<typeof getSapMdsVariance> = [];

  // Effective period: clamp to MDS_EXTRACT_START
  const effectiveStart = params.periodStart > MDS_EXTRACT_START ? params.periodStart : MDS_EXTRACT_START;
  if (effectiveStart >= params.periodEnd) return [];

  for (const emp of filtered) {
    // MDS (forecast) — computed on the effective period (>= MDS_EXTRACT_START)
    const mdsAvail = computeEmployeeAvailability(
      emp,
      assignmentIndex.get(emp.empId) || [],
      effectiveStart,
      params.periodEnd,
      sapDatesIndex.get(emp.empId)
    );

    // SAP (actuals) — only records >= MDS_EXTRACT_START
    const sapRecords = loadSapForPeriod(effectiveStart, params.periodEnd, emp.empId);
    if (sapRecords.length === 0) continue;

    const sapAgg = aggregateSapHours(sapRecords, emp.grade, effectiveStart, params.periodEnd);
    const sapNetH = sapAgg.totalH - sapAgg.absH;
    const sapTuPct = sapNetH > 0 ? Math.round((sapAgg.chH / sapNetH) * 1000) / 10 : 0;

    const deltaChH = Math.round((sapAgg.chH - mdsAvail.chargeableHours) * 10) / 10;
    const deltaTuPts = Math.round((sapTuPct - mdsAvail.tuPct) * 10) / 10;
    const status = deltaTuPts > 5 ? "surperformance" : deltaTuPts < -5 ? "sous-performance" : "aligne";

    results.push({
      empId: emp.empId,
      name: emp.name,
      grade: emp.grade,
      mds: {
        chH: mdsAvail.chargeableHours,
        absH: mdsAvail.absenceHours,
        trH: mdsAvail.trainingHours,
        tuPct: mdsAvail.tuPct,
      },
      sap: { chH: sapAgg.chH, absH: sapAgg.absH, trH: sapAgg.trH, tuPct: sapTuPct },
      delta: {
        chH: deltaChH,
        absH: Math.round((sapAgg.absH - mdsAvail.absenceHours) * 10) / 10,
        trH: Math.round((sapAgg.trH - mdsAvail.trainingHours) * 10) / 10,
        tuPts: deltaTuPts,
      },
      status,
    });
  }

  // Sort by absolute delta (biggest discrepancies first)
  results.sort((a, b) => Math.abs(b.delta.tuPts) - Math.abs(a.delta.tuPts));
  return results.slice(0, 30);
}
