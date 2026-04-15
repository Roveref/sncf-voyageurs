import type { Employee, GradeTransition } from "../types";

/**
 * Compute the day before a given ISO date string (YYYY-MM-DD).
 */
export const dayBefore = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/** Return the later of two nullable ISO date strings. */
const maxDate = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
};

/** Return the earlier of two nullable ISO date strings. */
const minDate = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b || null;
  if (!b) return a;
  return a < b ? a : b;
};

/** Shift a date string to the next Monday if it falls on a weekend. */
export const shiftToMonday = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  if (dow === 6)
    d.setDate(d.getDate() + 2); // Sat → Mon
  else if (dow === 0)
    d.setDate(d.getDate() + 1); // Sun → Mon
  else return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Shift a date string to the previous Friday if it falls on a weekend. */
export const shiftToFriday = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  if (dow === 0)
    d.setDate(d.getDate() - 2); // Sun → Fri
  else if (dow === 6)
    d.setDate(d.getDate() - 1); // Sat → Fri
  else return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Shift a Date object to the nearest workday (mutates and returns the date). */
export const shiftToWorkday = (d: Date, forward: boolean): Date => {
  const dow = d.getDay();
  if (forward) {
    if (dow === 6) d.setDate(d.getDate() + 2);
    else if (dow === 0) d.setDate(d.getDate() + 1);
  } else {
    if (dow === 0) d.setDate(d.getDate() - 2);
    else if (dow === 6) d.setDate(d.getDate() - 1);
  }
  return d;
};

/** Format a Date as YYYY-MM-DD. */
export const formatDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Is this employee the first split (g0) of a grade-split row? */
export const isFirstSplit = (emp: { _gradeIndex?: number }): boolean => emp._gradeIndex === 0;

/** Is this employee the last split of a grade-split row? */
export const isLastSplit = (emp: { _gradeIndex?: number; _gradeSplitCount?: number }): boolean =>
  emp._gradeIndex === (emp._gradeSplitCount || 1) - 1;

/**
 * Split an employee with multiple grade transitions into N virtual rows.
 * Each row covers one grade period, using _arrivalDate/_departureDate to
 * control which cells are active (inactive cells are grayed out by HeatmapStrip).
 *
 * The KEY invariant is that buildDailyGrid's forecast segment loop is guarded
 * by `isPresent`, so days outside _arrivalDate/_departureDate produce no
 * segments and are excluded from metrics.
 *
 * @param emp       The original employee object
 * @param history   Grade history (at least 2 entries with grade)
 * @returns         Array of cloned employees, one per grade period
 */
export const splitByGradeTransitions = (emp: Employee, history: GradeTransition[]): Employee[] => {
  if (!history || history.length <= 1) return [emp];

  const sorted = [...history]
    .filter((t) => t.grade)
    .sort((a, b) => (a.since || "0000-00-00").localeCompare(b.since || "0000-00-00"));

  if (sorted.length <= 1) return [emp];

  const realEmpId = emp.empId;
  const origArrival = emp._arrivalDate || null;
  const origDeparture = emp._departureDate || null;

  return sorted.map((transition, i) => {
    const isFirst = i === 0;
    const isLast = i === sorted.length - 1;

    // Period boundaries from grade history
    // Shift transition dates to workdays so no gap exists between splits on weekends
    const rawStart = isFirst ? origArrival : transition.since || null;
    const periodStart = rawStart && !isFirst ? shiftToMonday(rawStart) : rawStart;
    const nextSince = !isLast && sorted[i + 1].since ? shiftToMonday(sorted[i + 1].since) : null;
    const periodEnd = isLast ? origDeparture : nextSince ? shiftToFriday(dayBefore(nextSince)) : origDeparture;

    // Narrow to intersection with original presence dates
    const narrowedArrival = isFirst ? origArrival : maxDate(origArrival, periodStart);
    const narrowedDeparture = isLast ? origDeparture : minDate(origDeparture, periodEnd);

    return {
      ...emp,
      empId: `${realEmpId}::g${i}`,
      _realEmpId: realEmpId,
      _isGradeSplit: true,
      _gradeIndex: i,
      _gradeSplitCount: sorted.length,
      grade: transition.grade,
      _arrivalDate: narrowedArrival ?? undefined,
      _departureDate: narrowedDeparture ?? undefined,
      _gradeTransition: null,
    };
  });
};
