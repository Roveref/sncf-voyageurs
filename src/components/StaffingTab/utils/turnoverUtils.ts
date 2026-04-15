/**
 * Shared turnover counting utilities.
 * Extracts duplicated arrival/departure/grade-transition counting logic
 * from StaffingTab, useTeamStats, and TUTrendChart.
 */
import { getRealEmpId } from "./empIdUtils";
import { isFirstSplit, isLastSplit, shiftToWorkday, formatDateStr } from "./gradeSplitUtils";
import type { Employee } from "../types";

export interface ArrivalDepartureCounts {
  arrivalCounts: Map<string, number> | null;
  departureCounts: Map<string, number> | null;
}

/**
 * Count arrivals/departures per date for badge display (MonthHeaderBar).
 * Deduplicates by realEmpId, handles grade splits (arrival on g0, departure on last).
 */
export const countArrivalDepartures = (employees: Employee[]): ArrivalDepartureCounts => {
  if (!employees || employees.length === 0) return { arrivalCounts: null, departureCounts: null };
  const arrCounts = new Map<string, number>();
  const depCounts = new Map<string, number>();
  const seenRealArr = new Set<string>();
  const seenRealDep = new Set<string>();
  for (const emp of employees) {
    const realId = getRealEmpId(emp);
    if ((!emp._isGradeSplit || isFirstSplit(emp)) && emp._arrivalDate && !seenRealArr.has(realId)) {
      seenRealArr.add(realId);
      arrCounts.set(emp._arrivalDate, (arrCounts.get(emp._arrivalDate) || 0) + 1);
    }
    if ((!emp._isGradeSplit || isLastSplit(emp)) && emp._departureDate && !seenRealDep.has(realId)) {
      seenRealDep.add(realId);
      depCounts.set(emp._departureDate, (depCounts.get(emp._departureDate) || 0) + 1);
    }
  }
  return {
    arrivalCounts: arrCounts.size > 0 ? arrCounts : null,
    departureCounts: depCounts.size > 0 ? depCounts : null,
  };
};

/**
 * Count grade transitions per date for badge display.
 * Deduplicates by realEmpId, shifts weekend dates to nearest workday.
 */
export const countGradeTransitionsByDate = (
  employees: Employee[],
  timelineStart?: string
): Map<string, number> | null => {
  if (!employees || employees.length === 0) return null;
  const counts = new Map<string, number>();
  const seenReal = new Set<string>();
  for (const emp of employees) {
    const realId = getRealEmpId(emp);
    if (seenReal.has(realId)) continue;
    seenReal.add(realId);
    const history = emp._gradeHistory;
    if (!history || history.length <= 1) continue;
    for (let i = 1; i < history.length; i++) {
      const t = history[i];
      if (!t.since) continue;
      // Skip transitions strictly before timeline start — they are not within the visible period
      if (timelineStart && t.since < timelineStart) continue;
      const arrival = shiftToWorkday(new Date(t.since + "T00:00:00"), true);
      const key = formatDateStr(arrival);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts.size > 0 ? counts : null;
};

export interface TurnoverInRangeResult {
  arrivals: number;
  departures: number;
  arrivalsAll: number;
  departuresAll: number;
}

/**
 * Count turnover (arrivals/departures) within a date range.
 * Returns separate counts with and without Interns.
 * Used by useTeamStats for churn metrics.
 */
export const countTurnoverInRange = (
  employees: Employee[],
  rangeStart: string,
  rangeEnd: string
): TurnoverInRangeResult => {
  let arrivals = 0,
    departures = 0,
    arrivalsAll = 0,
    departuresAll = 0;
  const arrIds = new Set<string>(),
    depIds = new Set<string>();
  const arrIdsAll = new Set<string>(),
    depIdsAll = new Set<string>();

  for (const emp of employees) {
    const realId = getRealEmpId(emp);
    const canArr = !emp._isGradeSplit || isFirstSplit(emp);
    const canDep = !emp._isGradeSplit || isLastSplit(emp);

    // All (including Interns)
    if (
      canArr &&
      !arrIdsAll.has(realId) &&
      emp._arrivalDate &&
      emp._arrivalDate >= rangeStart &&
      emp._arrivalDate < rangeEnd
    ) {
      arrIdsAll.add(realId);
      arrivalsAll++;
    }
    if (
      canDep &&
      !depIdsAll.has(realId) &&
      emp._departureDate &&
      emp._departureDate > rangeStart &&
      emp._departureDate <= rangeEnd
    ) {
      depIdsAll.add(realId);
      departuresAll++;
    }

    // Excluding Interns
    if (emp.grade === "Intern") continue;
    if (
      canArr &&
      !arrIds.has(realId) &&
      emp._arrivalDate &&
      emp._arrivalDate >= rangeStart &&
      emp._arrivalDate < rangeEnd
    ) {
      arrIds.add(realId);
      arrivals++;
    }
    if (
      canDep &&
      !depIds.has(realId) &&
      emp._departureDate &&
      emp._departureDate > rangeStart &&
      emp._departureDate <= rangeEnd
    ) {
      depIds.add(realId);
      departures++;
    }
  }

  return { arrivals, departures, arrivalsAll, departuresAll };
};

/**
 * Count grade transitions within a date range (for TUTrendChart buckets).
 * Shifts weekend dates to nearest workday, deduplicates by realEmpId.
 */
export const countGradeTransitionsInRange = (employees: Employee[], rangeStart: string, rangeEnd: string): number => {
  let count = 0;
  const seenReal = new Set<string>();
  for (const emp of employees) {
    const realId = getRealEmpId(emp);
    if (seenReal.has(realId)) continue;
    seenReal.add(realId);
    if (!emp._gradeHistory || emp._gradeHistory.length <= 1) continue;
    for (let i = 1; i < emp._gradeHistory.length; i++) {
      const gh = emp._gradeHistory[i];
      if (!gh.since) continue;
      const shifted = formatDateStr(shiftToWorkday(new Date(gh.since + "T00:00:00"), true));
      if (shifted >= rangeStart && shifted < rangeEnd) count++;
    }
  }
  return count;
};
