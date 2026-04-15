/**
 * Pure computation functions for assignment insertion modes.
 * Fill & Extend, Fill & Truncate, Replace (truncate/delete/reduce).
 */

import { isWorkingDay, formatLocalDate } from "./dateUtils";
import { CHARGEABLE_CATS, GO_CATS, ABSENCE_CATS } from "../constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AssignmentSegment {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  utilization: number; // effective % for this segment
}

export interface FillResult {
  segments: AssignmentSegment[];
  effectiveEndDate: string;
  effectiveDays: number; // sum of (util/100) per working day across segments
  requestedDays: number; // working days in [start, end] * requestedUtil / 100
  noConflict: boolean;
}

export interface OverlappingAssignment {
  empId: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  overlapStart: string;
  overlapEnd: string;
}

export interface ReplaceResult {
  overlapping: OverlappingAssignment[];
  newAssignment: AssignmentSegment;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Advance a date by 1 day, return new YYYY-MM-DD string. */
const nextDay = (dateStr: string): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
};

/** Subtract 1 day, return new YYYY-MM-DD string. */
const prevDay = (dateStr: string): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
};

/** Check if two date ranges overlap. Inclusive on both ends. */
const rangesOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => s1 <= e2 && s2 <= e1;

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Compute daily available capacity for an employee over a date range.
 * Returns Map<dateStr, availablePercent> for working days only.
 */
export function computeDailyAvailability(
  employee: { assignments: { startDate: string; endDate: string; utilization: number; jobNo: string }[] },
  startDate: string,
  endDate: string,
  holidays: Set<string> | string[] | null,
  excludeAssignment?: { jobNo: string; startDate: string } | null
): Map<string, number> {
  const result = new Map<string, number>();
  let cursor = startDate;

  while (cursor <= endDate) {
    if (isWorkingDay(cursor, holidays)) {
      let usedUtil = 0;
      for (const a of employee.assignments) {
        if (excludeAssignment && a.jobNo === excludeAssignment.jobNo && a.startDate === excludeAssignment.startDate)
          continue;
        if (cursor >= a.startDate && cursor <= a.endDate) {
          usedUtil += a.utilization;
        }
      }
      result.set(cursor, Math.max(0, 100 - usedUtil));
    }
    cursor = nextDay(cursor);
  }

  return result;
}

/**
 * Extend daily availability beyond endDate until requestedDays are met.
 * Returns extended Map including days after endDate.
 */
function extendAvailability(
  employee: { assignments: { startDate: string; endDate: string; utilization: number; jobNo: string }[] },
  endDate: string,
  holidays: Set<string> | string[] | null,
  excludeAssignment: { jobNo: string; startDate: string } | null | undefined,
  requestedUtil: number,
  currentEffectiveDays: number,
  targetDays: number,
  maxExtendDays: number
): { extendedAvail: Map<string, number>; effectiveEndDate: string } {
  const extendedAvail = new Map<string, number>();
  let effectiveEndDate = endDate;
  let accumulated = currentEffectiveDays;
  let cursor = nextDay(endDate);
  let daysChecked = 0;

  while (accumulated < targetDays && daysChecked < maxExtendDays) {
    if (isWorkingDay(cursor, holidays)) {
      let usedUtil = 0;
      for (const a of employee.assignments) {
        if (excludeAssignment && a.jobNo === excludeAssignment.jobNo && a.startDate === excludeAssignment.startDate)
          continue;
        if (cursor >= a.startDate && cursor <= a.endDate) {
          usedUtil += a.utilization;
        }
      }
      const available = Math.max(0, 100 - usedUtil);
      extendedAvail.set(cursor, available);
      const effectiveUtil = Math.min(requestedUtil, available);
      if (effectiveUtil > 0) {
        accumulated += effectiveUtil / 100;
        effectiveEndDate = cursor;
      }
    }
    cursor = nextDay(cursor);
    daysChecked++;
  }

  return { extendedAvail, effectiveEndDate };
}

/**
 * Group consecutive working days with the same utilization into segments.
 * Friday->Monday is considered consecutive (weekends bridged).
 */
export function groupConsecutiveDays(
  dailyUtils: Map<string, number>,
  holidays: Set<string> | string[] | null
): AssignmentSegment[] {
  if (dailyUtils.size === 0) return [];

  // Sort dates
  const sortedDates = [...dailyUtils.keys()].sort();
  const segments: AssignmentSegment[] = [];

  let segStart = sortedDates[0];
  let segEnd = sortedDates[0];
  let segUtil = dailyUtils.get(sortedDates[0])!;

  for (let i = 1; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const util = dailyUtils.get(date)!;

    // Check if this date is consecutive to segEnd (bridging weekends/holidays)
    let isConsecutive = false;
    let check = nextDay(segEnd);
    // Skip weekends and holidays to find the next working day
    let skipped = 0;
    while (!isWorkingDay(check, holidays) && skipped < 10) {
      check = nextDay(check);
      skipped++;
    }
    isConsecutive = check === date && util === segUtil;

    if (isConsecutive) {
      segEnd = date;
    } else {
      if (segUtil > 0) {
        segments.push({ startDate: segStart, endDate: segEnd, utilization: segUtil });
      }
      segStart = date;
      segEnd = date;
      segUtil = util;
    }
  }

  // Push last segment
  if (segUtil > 0) {
    segments.push({ startDate: segStart, endDate: segEnd, utilization: segUtil });
  }

  return segments;
}

/**
 * Fill & Extend: fill available capacity day by day, extend end date if needed.
 */
export function computeFillExtend(
  employee: { assignments: { startDate: string; endDate: string; utilization: number; jobNo: string }[] },
  startDate: string,
  endDate: string,
  requestedUtil: number,
  holidays: Set<string> | string[] | null,
  excludeAssignment?: { jobNo: string; startDate: string } | null,
  maxExtendDays = 365
): FillResult {
  const dailyAvail = computeDailyAvailability(employee, startDate, endDate, holidays, excludeAssignment);

  // Compute requested days (working days * requestedUtil/100)
  const workingDays = dailyAvail.size;
  const requestedDays = (workingDays * requestedUtil) / 100;

  // noConflict = every day has >= requestedUtil available
  let noConflict = true;
  for (const avail of dailyAvail.values()) {
    if (avail < requestedUtil) {
      noConflict = false;
      break;
    }
  }

  // Build daily effective utilizations
  const dailyEffective = new Map<string, number>();
  let effectiveDays = 0;

  for (const [dateStr, avail] of dailyAvail) {
    const effectiveUtil = Math.min(requestedUtil, avail);
    if (effectiveUtil > 0) {
      dailyEffective.set(dateStr, effectiveUtil);
      effectiveDays += effectiveUtil / 100;
    }
  }

  let effectiveEndDate = endDate;

  // If not enough days, extend beyond endDate
  if (effectiveDays < requestedDays) {
    const { extendedAvail, effectiveEndDate: extEnd } = extendAvailability(
      employee,
      endDate,
      holidays,
      excludeAssignment,
      requestedUtil,
      effectiveDays,
      requestedDays,
      maxExtendDays
    );
    effectiveEndDate = extEnd;
    for (const [dateStr, avail] of extendedAvail) {
      const effectiveUtil = Math.min(requestedUtil, avail);
      if (effectiveUtil > 0) {
        dailyEffective.set(dateStr, effectiveUtil);
        effectiveDays += effectiveUtil / 100;
      }
    }
  }

  const segments = groupConsecutiveDays(dailyEffective, holidays);

  return { segments, effectiveEndDate, effectiveDays, requestedDays, noConflict };
}

/**
 * Fill & Truncate: fill available capacity day by day, stop at endDate.
 */
export function computeFillTruncate(
  employee: { assignments: { startDate: string; endDate: string; utilization: number; jobNo: string }[] },
  startDate: string,
  endDate: string,
  requestedUtil: number,
  holidays: Set<string> | string[] | null,
  excludeAssignment?: { jobNo: string; startDate: string } | null
): FillResult {
  const dailyAvail = computeDailyAvailability(employee, startDate, endDate, holidays, excludeAssignment);

  const workingDays = dailyAvail.size;
  const requestedDays = (workingDays * requestedUtil) / 100;

  let noConflict = true;
  for (const avail of dailyAvail.values()) {
    if (avail < requestedUtil) {
      noConflict = false;
      break;
    }
  }

  const dailyEffective = new Map<string, number>();
  let effectiveDays = 0;

  for (const [dateStr, avail] of dailyAvail) {
    const effectiveUtil = Math.min(requestedUtil, avail);
    if (effectiveUtil > 0) {
      dailyEffective.set(dateStr, effectiveUtil);
      effectiveDays += effectiveUtil / 100;
    }
  }

  const segments = groupConsecutiveDays(dailyEffective, holidays);

  return { segments, effectiveEndDate: endDate, effectiveDays, requestedDays, noConflict };
}

/**
 * Replace: identify overlapping assignments.
 */
export function computeReplace(
  employee: {
    empId: string;
    assignments: {
      empId: string;
      jobNo: string;
      jobName: string;
      startDate: string;
      endDate: string;
      utilization: number;
    }[];
  },
  startDate: string,
  endDate: string,
  requestedUtil: number,
  excludeAssignment?: { jobNo: string; startDate: string } | null
): ReplaceResult {
  const overlapping: OverlappingAssignment[] = [];

  for (const a of employee.assignments) {
    if (excludeAssignment && a.jobNo === excludeAssignment.jobNo && a.startDate === excludeAssignment.startDate)
      continue;
    if (rangesOverlap(a.startDate, a.endDate, startDate, endDate)) {
      overlapping.push({
        empId: a.empId || employee.empId,
        jobNo: a.jobNo,
        jobName: a.jobName,
        startDate: a.startDate,
        endDate: a.endDate,
        utilization: a.utilization,
        overlapStart: a.startDate < startDate ? startDate : a.startDate,
        overlapEnd: a.endDate > endDate ? endDate : a.endDate,
      });
    }
  }

  return {
    overlapping,
    newAssignment: { startDate, endDate, utilization: requestedUtil },
  };
}

/**
 * For Replace-Truncate: compute the truncated fragments of an existing assignment.
 * Returns 0, 1, or 2 fragments (before and/or after the overlap zone).
 */
export function computeTruncateFragments(
  assignment: { startDate: string; endDate: string; utilization: number },
  overlapStart: string,
  overlapEnd: string
): AssignmentSegment[] {
  const fragments: AssignmentSegment[] = [];

  // Fragment before overlap
  if (assignment.startDate < overlapStart) {
    fragments.push({
      startDate: assignment.startDate,
      endDate: prevDay(overlapStart),
      utilization: assignment.utilization,
    });
  }

  // Fragment after overlap
  if (assignment.endDate > overlapEnd) {
    fragments.push({
      startDate: nextDay(overlapEnd),
      endDate: assignment.endDate,
      utilization: assignment.utilization,
    });
  }

  return fragments;
}

// ─── Fit In ─────────────────────────────────────────────────────────────────

export interface FitInOverride {
  jobNo: string;
  startDate: string; // full assignment dates (for lookup)
  endDate: string;
  overlapStart: string; // only the overlap zone gets reduced
  overlapEnd: string;
  originalUtilization: number;
  newUtilization: number;
}

export interface FitInResult {
  overrides: FitInOverride[];
  newAssignment: AssignmentSegment;
  feasible: boolean; // false if existing assignments can't be reduced enough
}

/**
 * Fit In: reduce existing assignment utilizations on overlapping days
 * just enough to fit the new assignment at full requested utilization.
 * Each existing assignment's utilization is reduced proportionally.
 */
export function computeFitIn(
  employee: {
    assignments: {
      jobNo: string;
      jobName: string;
      startDate: string;
      endDate: string;
      utilization: number;
      category?: string;
    }[];
  },
  startDate: string,
  endDate: string,
  requestedUtil: number,
  holidays: Set<string> | string[] | null,
  excludeAssignment?: { jobNo: string; startDate: string } | null
): FitInResult {
  // Find overlapping assignments
  const overlapping = employee.assignments.filter((a) => {
    if (excludeAssignment && a.jobNo === excludeAssignment.jobNo && a.startDate === excludeAssignment.startDate)
      return false;
    return rangesOverlap(a.startDate, a.endDate, startDate, endDate);
  });

  if (overlapping.length === 0) {
    return {
      overrides: [],
      newAssignment: { startDate, endDate, utilization: requestedUtil },
      feasible: true,
    };
  }

  // Category priority: reduce chargeable (+ GO) first, then absences
  const chargeableCats = new Set([...CHARGEABLE_CATS, ...GO_CATS]);
  const isChargeable = (cat?: string) => !!cat && chargeableCats.has(cat);
  const isAbsence = (cat?: string) => !!cat && ABSENCE_CATS.has(cat);

  // Per-day reduction with priority: chargeable first, then absence, then rest.
  // Map: assignmentIndex → [ { date, newUtil } ]
  const perAssignmentDays: Map<number, { date: string; newUtil: number }[]> = new Map();
  for (let i = 0; i < overlapping.length; i++) perAssignmentDays.set(i, []);

  let feasible = true;
  let needsReduction = false;
  let cursor = startDate;
  while (cursor <= endDate) {
    if (isWorkingDay(cursor, holidays)) {
      // Find which overlapping assignments are active on this day, grouped by priority
      const chIndices: number[] = []; // chargeable + GO
      const absIndices: number[] = []; // absences
      const otherIndices: number[] = []; // rest
      let dayExistingUtil = 0;
      for (let i = 0; i < overlapping.length; i++) {
        const a = overlapping[i];
        if (cursor >= a.startDate && cursor <= a.endDate) {
          dayExistingUtil += a.utilization;
          if (isChargeable(a.category)) chIndices.push(i);
          else if (isAbsence(a.category)) absIndices.push(i);
          else otherIndices.push(i);
        }
      }

      const excess = dayExistingUtil + requestedUtil - 100;
      if (excess > 0 && dayExistingUtil > 0) {
        needsReduction = true;
        let remaining = excess;

        // Priority 1: reduce chargeable proportionally
        const chUtil = chIndices.reduce((s, i) => s + overlapping[i].utilization, 0);
        const chReduction = Math.min(remaining, chUtil);
        const chRatio = chUtil > 0 ? chReduction / chUtil : 0;
        for (const i of chIndices) {
          const a = overlapping[i];
          const newUtil = Math.max(0, Math.round(a.utilization * (1 - chRatio)));
          perAssignmentDays.get(i)!.push({ date: cursor, newUtil });
        }
        remaining -= chReduction;

        // Priority 2: reduce other (training, etc.) proportionally — never reduce absences
        if (remaining > 0.5) {
          const otherUtil = otherIndices.reduce((s, i) => s + overlapping[i].utilization, 0);
          const otherReduction = Math.min(remaining, otherUtil);
          const otherRatio = otherUtil > 0 ? otherReduction / otherUtil : 0;
          for (const i of otherIndices) {
            const a = overlapping[i];
            const newUtil = Math.max(0, Math.round(a.utilization * (1 - otherRatio)));
            perAssignmentDays.get(i)!.push({ date: cursor, newUtil });
          }
        }
      }
    }
    cursor = nextDay(cursor);
  }

  if (!needsReduction) {
    return {
      overrides: [],
      newAssignment: { startDate, endDate, utilization: requestedUtil },
      feasible: true,
    };
  }

  // Merge per-day entries into contiguous segments with the same newUtil per assignment
  const overrides: FitInOverride[] = [];
  for (let i = 0; i < overlapping.length; i++) {
    const a = overlapping[i];
    const days = perAssignmentDays.get(i)!;
    if (days.length === 0) continue;

    let segStart = days[0].date;
    let segEnd = days[0].date;
    let segUtil = days[0].newUtil;

    for (let d = 1; d < days.length; d++) {
      // Check if consecutive working day with same newUtil
      if (days[d].newUtil === segUtil) {
        segEnd = days[d].date;
      } else {
        overrides.push({
          jobNo: a.jobNo,
          startDate: a.startDate,
          endDate: a.endDate,
          overlapStart: segStart,
          overlapEnd: segEnd,
          originalUtilization: a.utilization,
          newUtilization: segUtil,
        });
        segStart = days[d].date;
        segEnd = days[d].date;
        segUtil = days[d].newUtil;
      }
    }
    // Push last segment
    overrides.push({
      jobNo: a.jobNo,
      startDate: a.startDate,
      endDate: a.endDate,
      overlapStart: segStart,
      overlapEnd: segEnd,
      originalUtilization: a.utilization,
      newUtilization: segUtil,
    });
  }

  return {
    overrides,
    newAssignment: { startDate, endDate, utilization: requestedUtil },
    feasible: feasible && overrides.every((o) => o.newUtilization >= 0),
  };
}
