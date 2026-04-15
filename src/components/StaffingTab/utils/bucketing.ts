/**
 * bucketing.ts — Pure bucketing logic extracted from HeatmapStrip.
 *
 * All functions are side-effect-free and React-free so they can be unit-tested
 * independently.  The useMemo wrappers in HeatmapStrip call these functions and
 * pass in the memoised dependencies as plain arguments.
 */

import { ABSENCE_CATS, CHARGEABLE_CATS, GO_CATS, TRAINING_CATS, MONTHS_EN, getHoursPerDay } from "../constants";
import { computeMdsChargeableHours, computeSapChH } from "./varianceEngine";
import { getHeatmapStyle } from "../constants/theme";
import type { DailyCell, CalendarDay, GradeTransition } from "../types";

// ─── Shared format helpers (no React dependency) ─────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const fmtWeekdayDayMonth = (d: Date) => `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;

export const fmtDayMonthShort = (d: Date) => `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;

export const fmtDayMonth = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export const fmtMonthLong = (d: Date) => MONTHS_LONG[d.getMonth()];

// ─── Shared data types ────────────────────────────────────────────────────────

/** Shape of computed daily data before bucketing */
export interface DailyEntry {
  date: Date;
  dow: number;
  isWE: boolean;
  isHoliday: boolean;
  total: number;
  cappedTotal: number;
  tuRate: number;
  toRate: number;
  absRate: number;
  goRate: number;
  chU: number;
  trU: number;
  monthStart: boolean;
  segments: DailyCell["segments"];
  absScale: number;
  chScale: number;
  goScale: number;
  trScale: number;
  isSap: boolean;
  hasStaffing: boolean;
  isForcedAbsence?: boolean;
  forecastSegments: DailyCell["forecastSegments"];
  forecastTuRate: number | null;
  forecastChU: number | null;
  forecastAbsRate: number | null;
  gradeTransition?: { from: string; to: string; since: string; isDeparture?: boolean } | null;
}

/** Shape of a rendered heatmap cell/bucket */
export interface HeatmapBucket {
  fill: string;
  label: string;
  isWeekend?: boolean;
  isInactive?: boolean;
  span: number;
  startDate: Date;
  endDate: Date;
  monthStart?: boolean;
  total?: number;
  cappedTotal?: number;
  tuRate?: number;
  toRate?: number;
  absRate?: number;
  goRate?: number;
  sumChU?: number;
  sumNetU?: number;
  chU?: number;
  trU?: number;
  segments?: DailyCell["segments"];
  catBreakdown?: { category: string; name: string | null; jobNo: string | null; avg: number }[];
  workDays?: number;
  _calDays?: number;
  isSap?: boolean;
  isFullSap?: boolean;
  sapDayCount?: number;
  varianceRate?: number | null;
  varianceHours?: number | null;
  sapTuRate?: number | null;
  sapChHours?: number | null;
  forecastChHours?: number | null;
  forecastTuRateBucket?: number | null;
  forecastTuRateAll?: number | null;
  displayTuRate?: number | null;
  forecastCatBreakdown?: { category: string; name: string | null; jobNo: string | null; avg: number }[] | null;
  sapCatBreakdown?: { category: string; name: string | null; jobNo: string | null; avg: number }[] | null;
  hasStaffing?: boolean;
  isForcedAbsence?: boolean;
  isCurrentMonth?: boolean;
  forecastSegments?: DailyCell["forecastSegments"] | null;
  forecastTuRate?: number | null;
  gradeTransition?: { from: string; to: string; since: string; isDeparture?: boolean } | null;
}

// ─── Grade transition map builder ─────────────────────────────────────────────

/**
 * Build a Map<dateString, {from, to, since, isDeparture}> for fast lookup during
 * daily iteration.  Returns null when there are fewer than 2 grade transitions
 * (nothing to mark).
 *
 * @param gradeTransitions - Array of GradeTransition for the employee
 * @param mergedGradeRow   - True when two split-grade rows are merged for display;
 *                           in that case departure markers are suppressed.
 */
export function buildGradeTransitionMap(
  gradeTransitions: GradeTransition[] | null | undefined,
  mergedGradeRow: boolean
): Map<string, { from: string; to: string; since: string; isDeparture?: boolean }> | null {
  if (!gradeTransitions || gradeTransitions.length <= 1) return null;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const shiftToWorkday = (d: Date, forward: boolean) => {
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

  const map = new Map<string, { from: string; to: string; since: string; isDeparture?: boolean }>();

  for (let i = 1; i < gradeTransitions.length; i++) {
    const t = gradeTransitions[i];
    if (!t.since) continue;

    const info = { from: gradeTransitions[i - 1].grade, to: t.grade, since: t.since };

    // Arrival: first working day of new grade
    const arrival = shiftToWorkday(new Date(t.since + "T00:00:00"), true);
    map.set(toKey(arrival), { ...info, isDeparture: false });

    // Departure: last working day of old grade (day before transition) — skip in merged view
    if (!mergedGradeRow) {
      const departure = new Date(t.since + "T00:00:00");
      departure.setDate(departure.getDate() - 1);
      shiftToWorkday(departure, false);
      const depKey = toKey(departure);
      if (!map.has(depKey)) map.set(depKey, { ...info, isDeparture: true });
    }
  }

  return map.size > 0 ? map : null;
}

// ─── Step 1: Build the flat daily array ──────────────────────────────────────

/**
 * Convert raw DailyCell[] + CalendarDay[] into a DailyEntry[] that contains
 * all the pre-computed fields needed by the bucketing functions.
 *
 * @param precomputedCells  - One cell per calendar day (length must equal calendar.length)
 * @param calendar          - Calendar array from the timeline store
 * @param gradeTransitionMap - Output of buildGradeTransitionMap(); may be null
 */
export function buildDailyEntries(
  precomputedCells: DailyCell[] | null,
  calendar: CalendarDay[],
  gradeTransitionMap: Map<string, { from: string; to: string; since: string; isDeparture?: boolean }> | null
): DailyEntry[] {
  const totalDays = calendar ? calendar.length : 0;
  if (totalDays <= 0 || !precomputedCells || precomputedCells.length !== totalDays) return [];

  const daily: DailyEntry[] = [];
  let prevMonth = -1;

  for (let d = 0; d < totalDays; d++) {
    const c = precomputedCells[d];
    const { date, dow, month: _month, isHoliday: calIsHoliday } = calendar[d];
    const monthStart = prevMonth !== -1 && _month !== prevMonth;
    prevMonth = _month;

    if (c.isWE) {
      daily.push({
        date,
        dow,
        isWE: true,
        isHoliday: false,
        total: 0,
        cappedTotal: 0,
        tuRate: 0,
        toRate: 0,
        absRate: 0,
        goRate: 0,
        chU: c.isSap ? c.cappedChU || 0 : 0,
        trU: 0,
        monthStart,
        segments: c.segments,
        absScale: 1,
        chScale: 1,
        goScale: 1,
        trScale: 1,
        isSap: c.isSap || false,
        hasStaffing: false,
        forecastSegments: null,
        forecastTuRate: null,
        forecastChU: null,
        forecastAbsRate: null,
      });
    } else {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      daily.push({
        date,
        dow,
        isWE: false,
        isHoliday: !!calIsHoliday,
        total: c.cappedAbsU + c.chU + c.goU + c.trU + c.otU,
        cappedTotal: c.cappedTotal,
        tuRate: c.tuRate,
        toRate: c.toRate,
        absRate: c.cappedAbsU,
        goRate: c.rawGoU,
        chU: c.effectiveChU != null ? c.effectiveChU : c.cappedChU,
        trU: c.cappedTrU,
        monthStart,
        segments: c.segments,
        absScale: c.absScale,
        chScale: c.chScale,
        goScale: c.goScale,
        trScale: c.trScale,
        isSap: c.isSap,
        hasStaffing: c.hasStaffing,
        isForcedAbsence: c.isForcedAbsence,
        forecastSegments: c.forecastSegments,
        forecastTuRate: c.forecastTuRate,
        forecastChU: c.forecastChU,
        forecastAbsRate: c.forecastAbsRate,
        gradeTransition: gradeTransitionMap?.get(dateStr) || null,
      });
    }
  }

  return daily;
}

// ─── Inner helpers (shared by all granularities) ──────────────────────────────

/**
 * Compute per-category average utilisation from a slice of working days.
 * Only active days (hasStaffing) are included — pre-arrival/post-departure days
 * are excluded.
 */
function catBreakdownFrom(
  days: DailyEntry[],
  chargeableCombined: boolean
): { category: string; name: string | null; jobNo: string | null; avg: number }[] {
  const active = days.filter((d) => d.hasStaffing);
  const n = active.length || 1;
  const catMap: Record<string, { category: string; name: string | null; jobNo: string | null; total: number }> = {};

  active.forEach((d) => {
    (d.segments || []).forEach((seg) => {
      let scale = 1;
      const cat = seg.category;
      if (ABSENCE_CATS.has(cat)) {
        scale = d.absScale != null ? d.absScale : 1;
      } else {
        if (CHARGEABLE_CATS.has(cat)) scale = d.chScale != null ? d.chScale : 1;
        else if (GO_CATS.has(cat))
          scale = chargeableCombined ? (d.chScale != null ? d.chScale : 1) : d.goScale != null ? d.goScale : 1;
        else if (TRAINING_CATS.has(cat)) scale = d.trScale != null ? d.trScale : 1;
      }
      const key = seg.name ? `${cat}||${seg.name}` : cat;
      if (!catMap[key]) catMap[key] = { category: cat, name: seg.name || null, jobNo: seg.jobNo || null, total: 0 };
      catMap[key].total += seg.util * scale;
    });
  });

  return Object.values(catMap)
    .map(({ category, name, jobNo, total }) => ({ category, name, jobNo, avg: total / n }))
    .sort((a, b) => b.avg - a.avg);
}

/**
 * Compute the CSS grid column span for a slice.
 * Each consecutive weekend block counts as 1 column; each workday counts as 1.
 */
function colSpan(slice: DailyEntry[]): number {
  let cols = 0;
  let i = 0;
  while (i < slice.length) {
    if (slice[i].isWE) {
      cols++;
      while (i < slice.length && slice[i].isWE) i++;
    } else {
      cols++;
      i++;
    }
  }
  return cols;
}

/**
 * Compute bucket-level TU/TO rates from summed raw hours (not averaged daily
 * rates).  Only active days (hasStaffing) contribute.
 */
function computeBucketRates(working: DailyEntry[]) {
  const active = working.filter((d) => d.hasStaffing);
  const n = active.length;
  if (n === 0) return { tuRate: 0, toRate: 0, avgAbs: 0, avgGo: 0, sumChU: 0, sumNetU: 0 };

  const sumAbs = active.reduce((s: number, d) => s + d.absRate, 0);
  const sumCh = active.reduce((s: number, d) => s + d.chU, 0);
  const sumGo = active.reduce((s: number, d) => s + (d.goRate || 0), 0);
  const sumTr = active.reduce((s: number, d) => s + d.trU, 0);
  const totalNet = n * 100 - sumAbs;
  const tuRate = totalNet > 0 ? (sumCh / totalNet) * 100 : 100;
  const toRate = totalNet > 0 ? ((sumCh + sumGo + sumTr) / totalNet) * 100 : 100;
  const avgAbs = n > 0 ? sumAbs / n : 0;
  const avgGo = n > 0 ? sumGo / n : 0;
  return { tuRate, toRate, avgAbs, avgGo, sumChU: sumCh, sumNetU: totalNet };
}

/**
 * Compute SAP-related bucket fields (variance, forecast breakdown, etc.).
 *
 * @param working          - Work days in the slice (no weekends)
 * @param allDays          - Full slice including weekends (for weekend SAP days)
 * @param grade            - Employee grade string (for hours-per-day lookup)
 * @param chargeableCombined - Whether GO is counted as chargeable
 */
function computeSapInfo(
  working: DailyEntry[],
  allDays: DailyEntry[],
  grade: string,
  chargeableCombined: boolean
): {
  isSap: boolean;
  isFullSap: boolean;
  sapDayCount: number;
  varianceRate: number | null;
  sapTuRate: number | null;
  forecastTuRateAll: number | null;
  forecastTuRateBucket: number | null;
  varianceHours: number | null;
  sapChHours: number | null;
  forecastChHours: number | null;
  forecastCatBreakdown: { category: string; name: string | null; jobNo: string | null; avg: number }[] | null;
  sapCatBreakdown: { category: string; name: string | null; jobNo: string | null; avg: number }[] | null;
  hasStaffing: boolean;
  displayTuRate: number | null;
  isForcedAbsence: boolean;
} {
  const hasSap = working.some((d) => d.isSap);
  const isFullSap = working.length > 0 && working.every((d) => d.isSap);

  // Include weekend SAP days (e.g. travel) in SAP TU calculation
  const weSapDays = allDays.filter((d) => d.isWE && d.isSap);
  const sapDaysAll = [...working.filter((d) => d.isSap && d.hasStaffing), ...weSapDays];
  const sapDayCount = sapDaysAll.length;

  const sapDaysWithMds = sapDaysAll.filter((d) => d.forecastSegments && d.forecastSegments.length > 0);

  let sapTuRate: number | null = null;
  let forecastTuRateBucket: number | null = null;
  let varianceRate: number | null = null;

  if (sapDaysAll.length > 0) {
    const sCh = sapDaysAll.reduce((s, d) => s + d.chU, 0);
    const sAbs = sapDaysAll.reduce((s, d) => s + d.absRate, 0);
    const sNet = sapDaysAll.length * 100 - sAbs;
    sapTuRate = sNet > 0 ? (sCh / sNet) * 100 : 100;
  }

  if (sapDaysWithMds.length > 0) {
    const fCh = sapDaysWithMds.reduce((s, d) => s + (d.forecastChU ?? 0), 0);
    const fAbs = sapDaysWithMds.reduce((s, d) => s + (d.forecastAbsRate || 0), 0);
    const fNet = sapDaysWithMds.length * 100 - fAbs;
    forecastTuRateBucket = fNet > 0 ? (fCh / fNet) * 100 : 100;

    const vsCh = sapDaysWithMds.reduce((s, d) => s + d.chU, 0);
    const vsAbs = sapDaysWithMds.reduce((s, d) => s + d.absRate, 0);
    const vsNet = sapDaysWithMds.length * 100 - vsAbs;
    const vsSapTu = vsNet > 0 ? (vsCh / vsNet) * 100 : 100;
    varianceRate = vsSapTu - forecastTuRateBucket!;
  }

  const sapCatBreakdown = sapDaysAll.length > 0 ? catBreakdownFrom(sapDaysAll, chargeableCombined) : null;

  // Forecast category breakdown
  const forecastCatMap: Record<string, { category: string; name: string | null; jobNo: string | null; total: number }> =
    {};
  let forecastDayCount = 0;
  const activeForForecast = working.filter((d) => d.hasStaffing);
  activeForForecast.forEach((d) => {
    const segs =
      d.isSap && d.forecastSegments && d.forecastSegments.length > 0
        ? d.forecastSegments
        : !d.isSap
          ? d.segments
          : null;
    if (!segs || segs.length === 0) return;
    forecastDayCount++;
    let dayAbsRaw = 0;
    segs.forEach((seg) => {
      if (ABSENCE_CATS.has(seg.category)) dayAbsRaw += seg.util;
    });
    const dayAbsScale = dayAbsRaw > 100 ? 100 / dayAbsRaw : 1;
    segs.forEach((seg) => {
      const scale = ABSENCE_CATS.has(seg.category) ? dayAbsScale : 1;
      const key = seg.name ? `${seg.category}||${seg.name}` : seg.category;
      if (!forecastCatMap[key])
        forecastCatMap[key] = { category: seg.category, name: seg.name || null, jobNo: seg.jobNo || null, total: 0 };
      forecastCatMap[key].total += seg.util * scale;
    });
  });
  const activeN = activeForForecast.length || 1;
  const forecastCatBreakdown =
    forecastDayCount > 0
      ? Object.values(forecastCatMap)
          .map(({ category, name, jobNo, total }) => ({ category, name, jobNo, avg: total / activeN }))
          .sort((a, b) => b.avg - a.avg)
      : null;

  const hasStaffing = working.some((d) => d.hasStaffing);
  const empHPD = getHoursPerDay(grade);
  const MDS_START = "2025-09-01";
  const pad = (n: number) => String(n).padStart(2, "0");
  const toDS = (d: DailyEntry) => `${d.date.getFullYear()}-${pad(d.date.getMonth() + 1)}-${pad(d.date.getDate())}`;

  // Delta h: SAP ch - MDS ch, after MDS_EXTRACT_START
  const sapDaysForVar = sapDaysAll.filter((d) => toDS(d) >= MDS_START);
  const sapChHours =
    sapDaysForVar.length > 0
      ? sapDaysForVar.reduce((s, d) => s + computeSapChH(d.segments, d.chScale ?? 1, empHPD, chargeableCombined), 0)
      : null;

  // MDS side: SAP days (forecastSegments or bench) + pure MDS days from completed months
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const mdsDaysForVar = working.filter(
    (d) => !d.isHoliday && !d.isSap && d.hasStaffing && toDS(d) >= MDS_START && toDS(d).slice(0, 7) < currentMonthStr
  );
  const forecastChHours =
    sapDaysForVar.length > 0 || mdsDaysForVar.length > 0
      ? sapDaysForVar.reduce((s, d) => {
          if (d.forecastSegments) return s + computeMdsChargeableHours(d.forecastSegments, empHPD, chargeableCombined);
          return s; // SAP without MDS → 0h chargeable (bench)
        }, 0) + mdsDaysForVar.reduce((s, d) => s + (d.chU * empHPD) / 100, 0)
      : null;

  const varianceHours = sapChHours != null && forecastChHours != null ? sapChHours - forecastChHours : null;

  // Aggregate forecast TU over ALL working days (mix SAP+MDS)
  const activeWorking = working.filter((d) => d.hasStaffing);
  const allFCh = activeWorking.reduce((s, d) => s + (d.isSap && d.forecastSegments ? (d.forecastChU ?? 0) : d.chU), 0);
  const allFAbs = activeWorking.reduce(
    (s, d) => s + (d.isSap && d.forecastSegments ? d.forecastAbsRate || 0 : d.absRate),
    0
  );
  const allFNet = activeWorking.length * 100 - allFAbs;
  const forecastTuRateAll = allFNet > 0 ? (allFCh / allFNet) * 100 : 100;
  const displayTuRate = isFullSap && sapTuRate != null ? sapTuRate : forecastTuRateAll;

  const forcedDays = working.filter((d) => d.isForcedAbsence).length;
  const isForcedAbsence = forcedDays > 0 && forcedDays > working.length / 2;

  return {
    isSap: hasSap,
    isFullSap,
    sapDayCount,
    varianceRate,
    sapTuRate,
    forecastTuRateAll,
    forecastTuRateBucket,
    varianceHours,
    sapChHours,
    forecastChHours,
    forecastCatBreakdown,
    sapCatBreakdown,
    hasStaffing,
    displayTuRate,
    isForcedAbsence,
  };
}

// ─── Step 2: Build a single aggregated work-bucket ────────────────────────────

const MDS_EXTRACT_START = "2025-09-01";

/**
 * Build one HeatmapBucket from a slice of DailyEntry (for non-day granularities).
 * The slice may include weekend entries; `working` is filtered inside.
 */
function makeWorkBucket(
  slice: DailyEntry[],
  grade: string,
  chargeableCombined: boolean,
  curMonth: number,
  curYear: number
): HeatmapBucket {
  const working = slice.filter((d) => !d.isWE);
  const avg = working.length > 0 ? working.reduce((s, d) => s + d.total, 0) / working.length : 0;
  const avgCapped =
    working.length > 0
      ? working.reduce((s, d) => s + (d.cappedTotal != null ? d.cappedTotal : d.total), 0) / working.length
      : 0;
  const { tuRate: avgTU, toRate: avgTO, avgAbs, avgGo, sumChU, sumNetU } = computeBucketRates(working);
  const sLabel = fmtDayMonthShort(slice[0].date);
  const eLabel = fmtDayMonthShort(slice[slice.length - 1].date);
  const sapInfo = computeSapInfo(working, slice, grade, chargeableCombined);
  const isCurrentMonth = slice.some((d) => d.date.getMonth() === curMonth && d.date.getFullYear() === curYear);
  return {
    fill: avg === 0 && sapInfo.isSap ? "#ef4444" : avg === 0 ? "#ffffff" : getHeatmapStyle(avg, grade).backgroundColor,
    total: avg,
    cappedTotal: avgCapped,
    tuRate: avgTU,
    toRate: avgTO,
    absRate: avgAbs,
    goRate: avgGo,
    sumChU,
    sumNetU,
    label: `${sLabel} \u2013 ${eLabel}`,
    catBreakdown: catBreakdownFrom(working, chargeableCombined),
    workDays: working.length,
    span: slice.length,
    startDate: slice[0].date,
    endDate: slice[slice.length - 1].date,
    isCurrentMonth,
    ...sapInfo,
  };
}

// ─── Step 3: Main bucketing function ─────────────────────────────────────────

/**
 * Aggregate a flat DailyEntry[] into HeatmapBucket[] according to the requested
 * granularity, then stamp month-boundary and grade-transition markers.
 *
 * This is the body of the `cells` useMemo in HeatmapStrip, extracted verbatim.
 *
 * @param daily             - Output of buildDailyEntries()
 * @param grade             - Employee grade string
 * @param granularity       - Time bucket size
 * @param chargeableCombined - Whether GO is counted as chargeable
 * @param gradeTransitionMap - Output of buildGradeTransitionMap(); may be null
 */
export function buildHeatmapBuckets(
  daily: DailyEntry[],
  grade: string,
  granularity: "day" | "week" | "2week" | "halfmonth" | "month",
  chargeableCombined: boolean,
  gradeTransitionMap: Map<string, { from: string; to: string; since: string; isDeparture?: boolean }> | null
): HeatmapBucket[] {
  const totalDays = daily.length;
  if (totalDays === 0) return [];

  // ── Day granularity ────────────────────────────────────────────────────────
  if (granularity === "day") {
    const result: HeatmapBucket[] = [];
    let i = 0;
    while (i < totalDays) {
      const d = daily[i];
      if (d.isWE) {
        let weEnd = i + 1;
        while (weEnd < totalDays && daily[weEnd].isWE) weEnd++;
        result.push({
          fill: "#f0f0f0",
          label: fmtWeekdayDayMonth(d.date),
          isWeekend: true,
          span: Math.max(1, Math.round((weEnd - i) / 2)),
          monthStart: d.monthStart,
          startDate: d.date,
          endDate: daily[weEnd - 1].date,
        });
        i = weEnd;
      } else {
        const dStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(d.date.getDate()).padStart(2, "0")}`;
        const afterMdsStart = dStr >= MDS_EXTRACT_START;
        const empHPD = getHoursPerDay(grade);

        const sapCh: number | null =
          d.isSap && d.hasStaffing ? computeSapChH(d.segments, d.chScale ?? 1, empHPD, chargeableCombined) : null;

        let fcastCh: number | null = null;
        let varH: number | null = null;
        if (afterMdsStart && d.isSap && d.hasStaffing) {
          fcastCh = d.forecastSegments ? computeMdsChargeableHours(d.forecastSegments, empHPD, chargeableCombined) : 0; // SAP without MDS → bench
          varH = sapCh! - fcastCh!;
        }

        result.push({
          fill: d.isSap && d.total === 0 ? "#ef4444" : getHeatmapStyle(d.total, grade).backgroundColor,
          total: d.total,
          cappedTotal: d.cappedTotal,
          tuRate: d.tuRate,
          toRate: d.toRate,
          absRate: d.absRate,
          goRate: d.goRate,
          segments: d.segments,
          label: fmtWeekdayDayMonth(d.date),
          span: 1,
          monthStart: d.monthStart,
          startDate: d.date,
          endDate: d.date,
          isSap: d.isSap,
          hasStaffing: d.hasStaffing,
          isForcedAbsence: d.isForcedAbsence,
          forecastSegments: d.forecastSegments,
          forecastTuRate: d.forecastTuRate,
          varianceRate: afterMdsStart && d.isSap && d.forecastSegments ? d.tuRate - (d.forecastTuRate ?? 0) : null,
          sapChHours: sapCh,
          forecastChHours: fcastCh,
          varianceHours: varH,
          gradeTransition: d.gradeTransition || null,
        });
        i++;
      }
    }
    return result;
  }

  // ── Shared helpers for all aggregated granularities ────────────────────────
  const buckets: HeatmapBucket[] = [];
  const _curMonth = new Date().getMonth();
  const _curYear = new Date().getFullYear();

  // ── Week granularity ───────────────────────────────────────────────────────
  if (granularity === "week") {
    let j = 0;
    while (j < totalDays) {
      if (daily[j].isWE) {
        let end = j + 1;
        while (end < totalDays && daily[end].isWE) end++;
        buckets.push({
          fill: "#f0f0f0",
          isWeekend: true,
          label: "Weekend",
          span: Math.max(1, Math.round((end - j) / 2)),
          startDate: daily[j].date,
          endDate: daily[end - 1].date,
        });
        j = end;
      } else {
        let end = j + 1;
        while (end < totalDays && !daily[end].isWE) end++;
        buckets.push(makeWorkBucket(daily.slice(j, end), grade, chargeableCombined, _curMonth, _curYear));
        j = end;
      }
    }

    // ── 2-week granularity ─────────────────────────────────────────────────────
  } else if (granularity === "2week") {
    let j = 0;
    while (j < totalDays) {
      let end = j + 1;
      let mondays = 0;
      while (end < totalDays) {
        if (daily[end].dow === 1 && ++mondays === 2) break;
        end++;
      }
      const slice = daily.slice(j, end);
      const working = slice.filter((d) => !d.isWE);
      if (working.length === 0) {
        buckets.push({
          fill: "#f0f0f0",
          isWeekend: true,
          label: "Weekend",
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
        });
      } else {
        const avg = working.reduce((s, d) => s + d.total, 0) / working.length;
        const { tuRate: avgTU, toRate: avgTO, avgAbs, avgGo, sumChU, sumNetU } = computeBucketRates(working);
        const sLabel = fmtDayMonthShort(slice[0].date);
        const eLabel = fmtDayMonthShort(slice[slice.length - 1].date);
        buckets.push({
          fill:
            avg === 0 && working.some((dd) => dd.isSap)
              ? "#ef4444"
              : avg === 0
                ? "#ffffff"
                : getHeatmapStyle(avg, grade).backgroundColor,
          total: avg,
          tuRate: avgTU,
          toRate: avgTO,
          absRate: avgAbs,
          goRate: avgGo,
          sumChU,
          sumNetU,
          label: `${sLabel} \u2013 ${eLabel}`,
          catBreakdown: catBreakdownFrom(working, chargeableCombined),
          workDays: working.length,
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
          ...computeSapInfo(working, slice, grade, chargeableCombined),
        });
      }
      j = end;
    }

    // ── Half-month granularity ─────────────────────────────────────────────────
  } else if (granularity === "halfmonth") {
    let j = 0;
    while (j < totalDays) {
      const curMonth = daily[j].date.getMonth();
      const curHalf = daily[j].date.getDate() <= 15 ? 1 : 2;
      let end = j + 1;
      while (end < totalDays) {
        const dd = daily[end].date;
        if (dd.getMonth() !== curMonth || (dd.getDate() <= 15 ? 1 : 2) !== curHalf) break;
        end++;
      }
      const slice = daily.slice(j, end);
      const working = slice.filter((d) => !d.isWE);
      if (working.length === 0) {
        buckets.push({
          fill: "#f0f0f0",
          isWeekend: true,
          label: "Weekend",
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
        });
      } else {
        const avg = working.reduce((s, d) => s + d.total, 0) / working.length;
        const { tuRate: avgTU, toRate: avgTO, avgAbs, avgGo, sumChU, sumNetU } = computeBucketRates(working);
        const mLabel = MONTHS_EN[curMonth];
        const label = `C${curHalf} ${mLabel} (${fmtDayMonth(slice[0].date)} \u2013 ${fmtDayMonth(slice[slice.length - 1].date)})`;
        const _sapInfo = computeSapInfo(working, slice, grade, chargeableCombined);
        buckets.push({
          fill:
            avg === 0 && working.some((dd) => dd.isSap)
              ? "#ef4444"
              : avg === 0
                ? "#ffffff"
                : getHeatmapStyle(avg, grade).backgroundColor,
          total: avg,
          tuRate: avgTU,
          toRate: avgTO,
          absRate: avgAbs,
          goRate: avgGo,
          sumChU,
          sumNetU,
          label,
          catBreakdown: catBreakdownFrom(working, chargeableCombined),
          workDays: working.length,
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
          isCurrentMonth: slice.some((d) => d.date.getMonth() === _curMonth && d.date.getFullYear() === _curYear),
          ..._sapInfo,
        });
      }
      j = end;
    }

    // ── Month granularity ──────────────────────────────────────────────────────
  } else {
    let j = 0;
    while (j < totalDays) {
      const curMonth = daily[j].date.getMonth();
      let end = j + 1;
      while (end < totalDays && daily[end].date.getMonth() === curMonth) end++;
      const slice = daily.slice(j, end);
      const working = slice.filter((d) => !d.isWE);
      if (working.length === 0) {
        buckets.push({
          fill: "#f0f0f0",
          isWeekend: true,
          label: "Weekend",
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
        });
      } else {
        const avg = working.reduce((s, d) => s + d.total, 0) / working.length;
        const { tuRate: avgTU, toRate: avgTO, avgAbs, avgGo, sumChU, sumNetU } = computeBucketRates(working);
        const label = `${fmtMonthLong(slice[0].date)} (${fmtDayMonth(slice[0].date)} \u2013 ${fmtDayMonth(slice[slice.length - 1].date)})`;
        const _sapInfo = computeSapInfo(working, slice, grade, chargeableCombined);
        buckets.push({
          fill:
            avg === 0 && working.some((dd) => dd.isSap)
              ? "#ef4444"
              : avg === 0
                ? "#ffffff"
                : getHeatmapStyle(avg, grade).backgroundColor,
          total: avg,
          tuRate: avgTU,
          toRate: avgTO,
          absRate: avgAbs,
          goRate: avgGo,
          sumChU,
          sumNetU,
          label,
          catBreakdown: catBreakdownFrom(working, chargeableCombined),
          workDays: working.length,
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
          isCurrentMonth: slice.some((d) => d.date.getMonth() === _curMonth && d.date.getFullYear() === _curYear),
          ..._sapInfo,
        });
      }
      j = end;
    }
  }

  // ── Post-process: stamp month boundaries + grade transitions ───────────────
  let dayIdx = 0;
  for (const b of buckets) {
    b.monthStart = dayIdx > 0 && daily[dayIdx].date.getMonth() !== daily[dayIdx - 1].date.getMonth();
    const calDays = b._calDays || b.span;
    if (gradeTransitionMap && !b.isWeekend) {
      for (let k = dayIdx; k < dayIdx + calDays && k < daily.length; k++) {
        const dd = daily[k];
        if (dd.isWE) continue;
        const dateStr = `${dd.date.getFullYear()}-${String(dd.date.getMonth() + 1).padStart(2, "0")}-${String(dd.date.getDate()).padStart(2, "0")}`;
        const gt = gradeTransitionMap.get(dateStr);
        if (gt) {
          b.gradeTransition = gt;
          break;
        }
      }
    }
    dayIdx += calDays;
  }

  return buckets;
}
