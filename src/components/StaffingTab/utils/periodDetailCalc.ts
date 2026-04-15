/**
 * periodDetailCalc.ts — Pure calculation functions extracted from usePeriodDetail.
 *
 * No React hooks, no store access. All functions are pure and testable.
 */

import { JOB_CATEGORIES, ABSENCE_CATS, CHARGEABLE_CATS, GO_CATS, TRAINING_CATS } from "../constants";
import { getSegmentScale } from "./aggregateCalc";
import { capUtilizations, computeTuRate, computeToRate } from "./calcPrimitives";
import type { DailyCell, DailyCellSegment } from "../types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PeriodHoursSummary {
  absH: number;
  holH: number;
  chH: number;
  goH: number;
  trH: number;
  resH: number;
  ncH: number;
  otH: number;
  netH: number;
  diH: number;
  overH: number;
  tu: number;
  to: number;
  totalBase: number;
}

export interface Pipeline {
  baseH: number;
  absH: number;
  holH: number;
  chH: number;
  goH: number;
  trH: number;
  overH: number;
  missingH: number;
  catHoursMap: Record<string, number>;
  catMap: Record<string, number>;
  projectHoursMap: Record<string, { hours: number; account: string; jobNo: string; oppName: string }>;
  empDayCount: number;
  daysSet: Set<number>;
}

export interface TopProject {
  name: string;
  account: string;
  jobNo: string;
  hours: number;
}

// ─── Pipeline factory ───────────────────────────────────────────────────────

export const makePipeline = (): Pipeline => ({
  baseH: 0,
  absH: 0,
  holH: 0,
  chH: 0,
  goH: 0,
  trH: 0,
  overH: 0,
  missingH: 0,
  catHoursMap: {} as Record<string, number>,
  catMap: {} as Record<string, number>,
  projectHoursMap: {} as Record<string, { hours: number; account: string; jobNo: string; oppName: string }>,
  empDayCount: 0,
  daysSet: new Set<number>(),
});

// ─── Category extraction helpers ────────────────────────────────────────────

/** Extract reservation hours from a category-hours map. */
export const extractResH = (hm: Record<string, number>): number => hm[JOB_CATEGORIES.RESERVATION] || 0;

/** Extract non-categorized hours (not abs, ch, go, tr, reservation, or holiday). */
export const extractNcH = (hm: Record<string, number>): number =>
  Object.entries(hm).reduce(
    (sum, [cat, v]) =>
      !ABSENCE_CATS.has(cat) &&
      !CHARGEABLE_CATS.has(cat) &&
      !GO_CATS.has(cat) &&
      !TRAINING_CATS.has(cat) &&
      cat !== JOB_CATEGORIES.RESERVATION &&
      cat !== JOB_CATEGORIES.HOLIDAY
        ? sum + v
        : sum,
    0
  );

// ─── Hours summary builder ──────────────────────────────────────────────────

/**
 * Build a period hours summary from raw accumulated totals.
 * All input values are raw sums; they get divided by `divBy` (typically day count).
 */
export const buildHoursSummary = (
  baseH: number,
  absHr: number,
  holHr: number,
  chHr: number,
  goHr: number,
  trHr: number,
  resHr: number,
  ncHr: number,
  overHr: number,
  divBy: number
): PeriodHoursSummary => {
  const totalBase = baseH / divBy,
    holH = holHr / divBy,
    absH = absHr / divBy;
  const netH = Math.max(0, totalBase - absH - holH);
  const chH = chHr / divBy,
    goH = goHr / divBy,
    trH = trHr / divBy;
  const resH = resHr / divBy,
    ncH = ncHr / divBy;
  const overH = overHr / divBy;
  const otH = resH + ncH;
  const diH = Math.max(0, netH - chH - goH - trH - resH - ncH);
  const tu = computeTuRate(chH, netH > 0.01 ? netH : 0, 100);
  const to = computeToRate(chH, goH, trH, netH > 0.01 ? netH : 0, 100);
  return { absH, holH, chH, goH, trH, resH, ncH, otH, netH, diH, overH, tu, to, totalBase };
};

// ─── Per-day accumulation into a pipeline ───────────────────────────────────

/**
 * Accumulate one employee-day of segment data into a pipeline.
 *
 * @param pipe         The pipeline to mutate
 * @param cell         The daily cell (used for scale factors when useOwnScales is false)
 * @param segments     The segments to process (cell.segments or cell.forecastSegments)
 * @param empHPD       Employee hours per day (grade & ETP adjusted)
 * @param chargeableCombined  Whether GO is combined into chargeable
 * @param resolveOpp   Callback to resolve jobNo → { oppName, account }
 * @param useOwnScales When true, recompute capping scales from segments instead of cell scales
 * @param skipAnomalyCheck When true, skip over/missing hours check (e.g. holidays, forced absence)
 */
export const accumulateDayForPipeline = (
  pipe: Pipeline,
  cell: DailyCell,
  segments: DailyCellSegment[],
  empHPD: number,
  chargeableCombined: boolean,
  resolveOpp: (jobNo: string) => { oppName: string; account: string } | null,
  useOwnScales = false,
  skipAnomalyCheck = false
): void => {
  pipe.baseH += empHPD;

  // Compute capping scales from these segments if needed
  let absScale = cell.absScale,
    chScale = cell.chScale,
    goScale = cell.goScale,
    trScale = cell.trScale;
  if (useOwnScales) {
    let rawAbsU = 0,
      rawChU = 0,
      rawGoU = 0,
      rawTrU = 0;
    for (const seg of segments) {
      if (ABSENCE_CATS.has(seg.category)) rawAbsU += seg.util;
      else if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category)))
        rawChU += seg.util;
      else if (GO_CATS.has(seg.category)) rawGoU += seg.util;
      else if (TRAINING_CATS.has(seg.category)) rawTrU += seg.util;
    }
    const cap = capUtilizations({ absU: rawAbsU, chU: rawChU, goU: rawGoU, trU: rawTrU });
    absScale = cap.absScale;
    chScale = cap.chScale;
    goScale = cap.goScale;
    trScale = cap.trScale;
  }
  const scaleCell = { absScale, chScale, goScale, trScale };

  for (const seg of segments) {
    const scale = getSegmentScale(seg.category, scaleCell, chargeableCombined);
    const scaledU = seg.util * scale;
    const segH = (scaledU * empHPD) / 100;
    pipe.catHoursMap[seg.category] = (pipe.catHoursMap[seg.category] || 0) + segH;
    pipe.catMap[seg.category] = (pipe.catMap[seg.category] || 0) + scaledU;
    if (ABSENCE_CATS.has(seg.category)) pipe.absH += segH;
    else if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
      pipe.chH += segH;
      const resolvedOpp = resolveOpp(seg.jobNo ?? "");
      const projKey = (resolvedOpp?.oppName || seg.name || seg.jobNo || "Unknown") + "::" + (seg.jobNo || "");
      if (!pipe.projectHoursMap[projKey]) {
        pipe.projectHoursMap[projKey] = {
          hours: 0,
          account: resolvedOpp?.account || "",
          jobNo: seg.jobNo || "",
          oppName: resolvedOpp?.oppName || "",
        };
      }
      pipe.projectHoursMap[projKey].hours += segH;
    } else if (GO_CATS.has(seg.category)) pipe.goH += segH;
    else if (TRAINING_CATS.has(seg.category)) pipe.trH += segH;
  }
  // Overcharge / Missing: total SAP hours vs HPD (skip holidays & forced absence)
  if (!skipAnomalyCheck) {
    const totalSapU = segments.reduce((sum, seg) => sum + seg.util, 0);
    if (totalSapU > 100) pipe.overH += ((totalSapU - 100) * empHPD) / 100;
    if (totalSapU < 100) pipe.missingH += ((100 - totalSapU) * empHPD) / 100;
  }
};

// ─── Holiday accumulation ───────────────────────────────────────────────────

/**
 * Accumulate a holiday day into a pipeline (no segments, just base + holiday hours).
 */
export const accumulateHolidayForPipeline = (pipe: Pipeline, empHPD: number, dayIndex: number): void => {
  pipe.baseH += empHPD;
  pipe.holH += empHPD;
  pipe.catHoursMap["holiday"] = (pipe.catHoursMap["holiday"] || 0) + empHPD;
  pipe.catMap["holiday"] = (pipe.catMap["holiday"] || 0) + 100;
  pipe.empDayCount++;
  pipe.daysSet.add(dayIndex);
};

// ─── Period summary building ────────────────────────────────────────────────

export interface CatBreakdownEntry {
  category: string;
  avg: number;
  avgH?: number;
}

/**
 * Build category breakdown from a category map.
 * Divides raw accumulated values by divBy and sorts descending by avg.
 */
export const buildCatBreakdown = (
  catMap: Record<string, number>,
  divBy: number,
  hoursMap?: Record<string, number>
): CatBreakdownEntry[] =>
  Object.entries(catMap)
    .map(([cat, sum]) => ({
      category: cat,
      avg: sum / divBy,
      ...(hoursMap ? { avgH: (hoursMap[cat] || 0) / divBy } : {}),
    }))
    .sort((a, b) => b.avg - a.avg);

/**
 * Build the final period summary (precomputed hours) from a pipeline.
 * Returns null if the pipeline has no day data.
 */
export const buildPeriodSummary = (pipe: Pipeline, dayCount: number): PeriodHoursSummary | null => {
  if (dayCount <= 0) return null;
  return buildHoursSummary(
    pipe.baseH,
    pipe.absH,
    pipe.holH,
    pipe.chH,
    pipe.goH,
    pipe.trH,
    extractResH(pipe.catHoursMap),
    extractNcH(pipe.catHoursMap),
    pipe.overH,
    dayCount
  );
};

// ─── Top projects ───────────────────────────────────────────────────────────

/**
 * Build top-5 chargeable projects from a pipeline, with an "Others" rollup.
 */
export const buildTopProjects = (pipe: Pipeline, divBy: number): TopProject[] => {
  const entries = Object.entries(pipe.projectHoursMap)
    .map(([_key, v]) => ({
      name: v.oppName || v.jobNo || "Unknown",
      account: v.account,
      jobNo: v.jobNo,
      hours: v.hours / divBy,
    }))
    .sort((a, b) => b.hours - a.hours);
  if (entries.length <= 5) return entries;
  const top5 = entries.slice(0, 5);
  const othersH = entries.slice(5).reduce((s, e) => s + e.hours, 0);
  return [...top5, { name: "Others\u2026", account: "", jobNo: "", hours: othersH }];
};

// ─── Presence FTE calculation ───────────────────────────────────────────────

/**
 * Calculate presence-based FTE from a map of realEmpId → presence days.
 * Each employee's contribution is capped at 1.0 (days / workDays).
 */
export const calculatePresenceFTE = (
  presenceDaysMap: Map<string, number>,
  workDays: number,
  fallbackCount: number
): number => {
  if (workDays <= 0) return fallbackCount;
  let fte = 0;
  for (const [, days] of presenceDaysMap) fte += Math.min(1, days / workDays);
  return fte;
};
