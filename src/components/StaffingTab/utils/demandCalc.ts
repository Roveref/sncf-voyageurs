/**
 * demandCalc — Pure computation functions for staffing demand/supply analysis.
 *
 * Computes monthly ETP demand (from staffing needs), supply (from employee availability),
 * and gap (demand - supply) by grade. Powers the NeedsBoardV2 demand chart.
 *
 * Follows the same patterns as scenarioUtils.ts (computeNeedsExtraHours) and
 * aggregateCalc.ts for working-day counting and grade-aware calculations.
 */

import { countWorkingDaysInRange } from "./dateUtils";
import { formatLocalDate } from "./dateUtils";
import { GRADE_ORDER } from "../constants";
import { getEtpRatio } from "../types";
import type { Employee } from "../types";
import type { StaffingNeedItem, StaffingAssignment } from "../../../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MonthBucket {
  key: string; // "2026-04"
  label: string; // "avr. 26"
  startDate: string; // "2026-04-01"
  endDate: string; // "2026-05-01" (exclusive, like existing patterns)
  workingDays: number;
}

export interface GradeDemand {
  etp: number; // Confirmed demand (non-cancelled, non-filled)
  etpWeighted: number; // Probability-weighted demand
  headcount: number; // Raw quantity sum
  needIds: string[];
  opportunityIds: string[];
}

export interface GradeSupply {
  availableEtp: number; // Non-chargeable ETP
  totalEtp: number; // Total headcount (ETP-adjusted)
}

export interface DemandSupplyRow {
  monthKey: string;
  monthLabel: string;
  workingDays: number;
  // Dynamically keyed per grade — see buildDemandSupplyRows
  [key: string]: any;
  // Totals
  demandTotal: number;
  pipelineTotal: number;
  supplyTotal: number; // Dispo totale (all grades)
  matchedTotal: number; // Dispo filtrée (only grades with demand)
  gapTotal: number; // demand - matched
  // Drill-down metadata (not rendered, used on click)
  _details: Record<string, { needIds: string[]; opportunityIds: string[]; etp: number }>;
}

/** Sanitize grade name for use as object key (remove spaces) */
export const sanitizeGrade = (grade: string): string => grade.replace(/\s+/g, "");

const resolveGrade = (need: StaffingNeedItem): string => need.grade || "Unknown";

// ─── Month bucket generation ───────────────────────────────────────────────

/**
 * Generate monthly buckets from startDate to endDate.
 * End dates are exclusive (same convention as timeline presets).
 */
export function generateMonthBuckets(
  startDate: string,
  monthCount: number,
  isHoliday: (dateStr: string) => boolean = () => false
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const start = new Date(startDate + "T00:00:00");
  // Align to 1st of month
  start.setDate(1);

  for (let i = 0; i < monthCount; i++) {
    const y = start.getFullYear();
    const m = start.getMonth() + i;
    const bucketStart = new Date(y, m, 1);
    const bucketEnd = new Date(y, m + 1, 1); // exclusive

    const startStr = formatLocalDate(bucketStart);
    const endStr = formatLocalDate(bucketEnd);
    const workingDays = countWorkingDaysInRange(bucketStart, bucketEnd, (d) => isHoliday(d));

    const label = bucketStart.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

    buckets.push({
      key: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, "0")}`,
      label,
      startDate: startStr,
      endDate: endStr,
      workingDays,
    });
  }

  return buckets;
}

// ─── Demand computation ────────────────────────────────────────────────────

/**
 * Compute ETP demand per grade per month bucket.
 *
 * Formula per need overlapping bucket:
 *   overlapDays = workingDays in [max(needStart, bucketStart), min(needEnd, bucketEnd))
 *   etpContrib = quantity × utilization × (overlapDays / bucket.workingDays)
 *   etpWeighted = etpContrib × probability
 */
export function computeDemandByMonth(
  needs: StaffingNeedItem[],
  assignments: StaffingAssignment[],
  buckets: MonthBucket[],
  isHoliday: (dateStr: string) => boolean = () => false
): Map<string, Record<string, GradeDemand>> {
  // Pre-index filled needs to exclude them from demand
  const filledNeedIds = new Set<string>();
  const assignmentsByNeed = new Map<string, number>();
  for (const a of assignments) {
    if (a.status === "cancelled") continue;
    assignmentsByNeed.set(a.needId, (assignmentsByNeed.get(a.needId) || 0) + 1);
  }

  const result = new Map<string, Record<string, GradeDemand>>();

  for (const bucket of buckets) {
    const byGrade: Record<string, GradeDemand> = {};
    const bStart = new Date(bucket.startDate + "T00:00:00");
    const bEnd = new Date(bucket.endDate + "T00:00:00");

    for (const need of needs) {
      if (need.status === "cancelled") continue;
      // Exclude fully filled needs
      const qty = need.quantity || 1;
      const filledCount = assignmentsByNeed.get(need.id) || 0;
      const remainingQty = Math.max(0, qty - filledCount);
      if (remainingQty === 0) continue;

      const needStart = need.startDate ? new Date(need.startDate + "T00:00:00") : null;
      const needEnd = need.endDate ? new Date(need.endDate + "T00:00:00") : null;
      if (!needStart || !needEnd || isNaN(needStart.getTime()) || isNaN(needEnd.getTime())) continue;

      // Check overlap — needEnd is inclusive, bucketEnd is exclusive
      // Add 1 day to needEnd to make it exclusive for comparison
      const needEndExcl = new Date(needEnd);
      needEndExcl.setDate(needEndExcl.getDate() + 1);
      if (needEndExcl <= bStart || needStart >= bEnd) continue;

      const overlapStart = needStart > bStart ? needStart : bStart;
      const overlapEnd = needEndExcl < bEnd ? needEndExcl : bEnd;
      const overlapDays = countWorkingDaysInRange(overlapStart, overlapEnd, isHoliday);
      if (overlapDays === 0 || bucket.workingDays === 0) continue;

      const util = typeof need.utilization === "number" ? need.utilization / 100 : 1;
      const probability = Math.max(0, Math.min(1, need.probability ?? 1));
      const grade = resolveGrade(need);

      const etpContrib = remainingQty * util * (overlapDays / bucket.workingDays);
      const etpWeighted = etpContrib * probability;

      if (!byGrade[grade]) {
        byGrade[grade] = { etp: 0, etpWeighted: 0, headcount: 0, needIds: [], opportunityIds: [] };
      }
      byGrade[grade].etp += etpContrib;
      byGrade[grade].etpWeighted += etpWeighted;
      byGrade[grade].headcount += remainingQty;
      byGrade[grade].needIds.push(need.id);
      if (need.opportunityId && !byGrade[grade].opportunityIds.includes(need.opportunityId)) {
        byGrade[grade].opportunityIds.push(need.opportunityId);
      }
    }

    result.set(bucket.key, byGrade);
  }

  return result;
}

// ─── Supply computation ────────────────────────────────────────────────────

/**
 * Compute team headcount and real availability per grade per month bucket.
 *
 * Uses dailyGrid cells for per-day chargeable utilization (same source of truth
 * as heatmaps and TU calculations). No fallback — if dailyGrid is not available,
 * availability is 0.
 *
 * For each employee active in the bucket, iterates calendar days:
 *   totalEtp = etpRatio × (activeDays / bucket.workingDays)
 *   availableEtp = sum of (1 - chU/100) per day × etpRatio / bucket.workingDays
 */
export function computeSupplyByMonth(
  employees: Employee[],
  buckets: MonthBucket[],
  isHoliday: (dateStr: string) => boolean = () => false,
  dailyGrid?: Map<string, any> | null,
  calendarIndex?: Map<string, number> | null
): Map<string, Record<string, GradeSupply>> {
  const result = new Map<string, Record<string, GradeSupply>>();

  for (const bucket of buckets) {
    const byGrade: Record<string, GradeSupply> = {};
    const bStart = new Date(bucket.startDate + "T00:00:00");
    const bEnd = new Date(bucket.endDate + "T00:00:00");

    for (const emp of employees) {
      if (emp._isGradeSplit && (emp._gradeIndex || 0) > 0) continue;

      const grade = emp.grade || "Unknown";
      const empId = emp._isGradeSplit ? emp._realEmpId || emp.empId : emp.empId;

      // Determine employee's active window within the bucket
      let empStart = bStart;
      let empEnd = bEnd;
      if (emp._arrivalDate) {
        const arr = new Date(emp._arrivalDate + "T00:00:00");
        if (arr > empStart) empStart = arr;
      }
      if (emp._departureDate) {
        const dep = new Date(emp._departureDate + "T00:00:00");
        dep.setDate(dep.getDate() + 1);
        if (dep < empEnd) empEnd = dep;
      }
      if (empStart >= empEnd) continue;

      const activeDays = countWorkingDaysInRange(empStart, empEnd, isHoliday);
      if (activeDays === 0) continue;

      const midDate = new Date(bStart);
      midDate.setDate(midDate.getDate() + Math.round((bEnd.getTime() - bStart.getTime()) / 86400000 / 2));
      const midStr = formatLocalDate(midDate);
      const etpRatio = getEtpRatio(emp._etpAdjustments, midStr);

      const presenceFraction = activeDays / (bucket.workingDays || 1);
      const totalEtp = etpRatio * presenceFraction;

      // Compute availability from dailyGrid (day by day)
      let availEtp = 0;
      const empGrid = dailyGrid?.get(empId);
      if (empGrid?.cells && calendarIndex) {
        let availDays = 0;
        const numDays = Math.round((bEnd.getTime() - bStart.getTime()) / 86400000);
        for (let d = 0; d < numDays; d++) {
          const dt = new Date(bStart);
          dt.setDate(dt.getDate() + d);
          const dow = dt.getDay();
          if (dow === 0 || dow === 6) continue;
          const dtStr = formatLocalDate(dt);
          if (isHoliday(dtStr)) continue;
          if (emp._arrivalDate && dtStr < emp._arrivalDate) continue;
          if (emp._departureDate && dtStr > emp._departureDate) continue;

          const calIdx = calendarIndex.get(dtStr);
          if (calIdx == null) continue;
          const cell = empGrid.cells[calIdx];
          if (!cell || cell.isWE || cell.isInactive) continue;

          const chU = cell.effectiveChU ?? cell.cappedChU ?? 0;
          availDays += Math.max(0, 1 - chU / 100);
        }
        availEtp = (etpRatio * availDays) / (bucket.workingDays || 1);
      }
      // If no dailyGrid, availEtp stays 0 (no fallback)

      if (!byGrade[grade]) byGrade[grade] = { availableEtp: 0, totalEtp: 0 };
      byGrade[grade].totalEtp += totalEtp;
      byGrade[grade].availableEtp += availEtp;
    }

    result.set(bucket.key, byGrade);
  }

  return result;
}

// ─── Merge into Recharts-ready rows ────────────────────────────────────────

/**
 * Build flat DemandSupplyRow array for Recharts.
 * One row per month, with demand_[Grade], pipeline_[Grade], supply_[Grade] keys.
 */
export function buildDemandSupplyRows(
  buckets: MonthBucket[],
  demand: Map<string, Record<string, GradeDemand>>,
  supply: Map<string, Record<string, GradeSupply>>
): DemandSupplyRow[] {
  return buckets.map((bucket) => {
    const demandByGrade = demand.get(bucket.key) || {};
    const supplyByGrade = supply.get(bucket.key) || {};

    const row: DemandSupplyRow = {
      monthKey: bucket.key,
      monthLabel: bucket.label,
      workingDays: bucket.workingDays,
      demandTotal: 0,
      pipelineTotal: 0,
      supplyTotal: 0,
      matchedTotal: 0,
      gapTotal: 0,
      _details: {},
    };

    for (const grade of GRADE_ORDER) {
      const sk = sanitizeGrade(grade);
      const d = demandByGrade[grade];
      const s = supplyByGrade[grade];

      const demandEtp = d ? Math.round(d.etp * 100) / 100 : 0;
      const pipelineEtp = d ? Math.round(d.etpWeighted * 100) / 100 : 0;
      const availableEtp = s ? Math.round(s.availableEtp * 100) / 100 : 0;
      const hasDemand = demandEtp > 0;

      const matchedEtp = hasDemand ? availableEtp : 0;
      const unmatchedEtp = availableEtp - matchedEtp;

      row[`demand_${sk}`] = demandEtp;
      row[`pipeline_${sk}`] = pipelineEtp;
      row[`supply_${sk}`] = availableEtp;
      row[`matched_${sk}`] = matchedEtp;
      row[`unmatched_${sk}`] = Math.round(unmatchedEtp * 100) / 100;

      row.demandTotal += demandEtp;
      row.pipelineTotal += pipelineEtp;
      row.supplyTotal += availableEtp;
      row.matchedTotal += hasDemand ? availableEtp : 0;

      if (d) {
        row._details[grade] = { needIds: d.needIds, opportunityIds: d.opportunityIds, etp: demandEtp };
      }
    }

    row.demandTotal = Math.round(row.demandTotal * 100) / 100;
    row.pipelineTotal = Math.round(row.pipelineTotal * 100) / 100;
    row.supplyTotal = Math.round(row.supplyTotal * 100) / 100;
    row.matchedTotal = Math.round(row.matchedTotal * 100) / 100;
    row.gapTotal = Math.round((row.demandTotal - row.matchedTotal) * 100) / 100;

    return row;
  });
}

// ─── Helpers for drill-down ────────────────────────────────────────────────

/** Get needs that overlap a specific month bucket for a specific grade */
export function getNeedsForCell(
  monthKey: string,
  grade: string,
  allNeeds: StaffingNeedItem[],
  buckets: MonthBucket[]
): StaffingNeedItem[] {
  const bucket = buckets.find((b) => b.key === monthKey);
  if (!bucket) return [];

  return allNeeds.filter((need) => {
    if (need.status === "cancelled") return false;
    const needGrade = resolveGrade(need);
    if (needGrade !== grade) return false;

    const needStart = need.startDate;
    const needEnd = need.endDate;
    if (!needStart || !needEnd) return false;

    // Need overlaps bucket? (needEnd inclusive, bucketEnd exclusive)
    return needEnd >= bucket.startDate && needStart < bucket.endDate;
  });
}
