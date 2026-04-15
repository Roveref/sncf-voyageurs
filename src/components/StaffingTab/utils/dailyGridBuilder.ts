/**
 * dailyGridBuilder.ts — Focused sub-functions extracted from buildDailyGrid().
 *
 * Each function handles one responsibility of the daily grid construction pipeline.
 * The parent buildDailyGrid() in dataProcessing.ts orchestrates these.
 */

import { getHoursPerDay } from "../constants";
import { MDS_EXTRACT_START } from "../constants";
import type { DailyCell, DailyCellSegment, CalendarDay, EmployeeGridMetrics, SapDayData, SapRecord } from "../types";
import { accumulateSegmentsByCategory, capUtilizations, computeTuRate, computeToRate } from "./calcPrimitives";
import { computeVarianceRate } from "./varianceEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SegmentPeriod = {
  start: number;
  end: number;
  util: number;
  jobName: string;
  jobNo: string | null;
  category: string;
};

/** Raw utilization values before capping */
export interface RawUtilization {
  absU: number;
  chU: number;
  goU: number;
  trU: number;
  otU: number;
  rawGoU: number;
}

/** Forecast data computed for a single day */
export interface ForecastResult {
  forecastSegments: DailyCellSegment[] | null;
  forecastTuRate: number | null;
  forecastChU: number | null;
  forecastAbsRate: number | null;
  /** Raw (uncapped) utilization values for forecast accumulators */
  rawFAbsU: number;
  rawFChU: number;
  rawFGoU: number;
  rawFTrU: number;
  rawFOtU: number;
  /** Capped values for accumulation */
  cappedFChU: number;
  cappedFGoU: number;
  cappedFTrU: number;
  cappedFOtU: number;
}

/** Result of segment classification for a single day */
export interface DaySegmentResult {
  segments: DailyCellSegment[];
  raw: RawUtilization;
  dayWorkUtils: number[];
  isSap: boolean;
  forcedAbsence: boolean;
  forecastResult: ForecastResult;
}

/** Mutable accumulators for employee-level metrics */
export interface MetricAccumulators {
  workDays: number;
  weekendSapDays: number;
  absenceUtil: number;
  holidayUtil: number;
  chargeableUtil: number;
  generalOpptyUtil: number;
  trainingUtil: number;
  otherUtil: number;
  fragSum: number;
  fragDays: number;
  // Forecast-only accumulators
  fcastWorkDays: number;
  fcastAbsenceUtil: number;
  fcastHolidayUtil: number;
  fcastChargeableUtil: number;
  fcastGeneralOpptyUtil: number;
  fcastTrainingUtil: number;
  fcastOtherUtil: number;
  // Transition loss tracking
  dailyChRates: number[];
  dailyIsAbsence: boolean[];
  // SAP variance
  sapChSum: number;
  sapAbsSum: number;
  fChSum: number;
  fAbsSum: number;
  sapVarDayCount: number;
  // SAP completion
  sapMonthDayCount: number;
}

// ─── Parameter object interfaces ────────────────────────────────────────────

/** Calendar-level day information (shared across all employees) */
export interface DayInfo {
  dateStr: string;
  ts: number;
  isHoliday: boolean;
}

/** Employee-level context for grid computation */
export interface EmpContext {
  empSap: Record<string, SapDayData> | null;
  sapMinDate: string | null;
  sapMaxDate: string | null;
  HPD: number;
  periodsByTs: Map<number, SegmentPeriod[]>;
}

/** Grid-level settings (constant for entire grid build) */
export interface GridSettings {
  chargeableCombined: boolean;
  dataSourceFilter: "sap" | undefined;
  currentMonthStartStr: string;
  currentMonthStartStrGlobal: string;
  nextMonthStartStr: string;
}

// ─── Transition loss ────────────────────────────────────────────────────────

export interface TransitionLossResult {
  totalShortfall: number;
  shortfallDetails?: Array<{ dayIdx: number; rate: number; neighborMax: number; shortfall: number }>;
}

/**
 * Compute TU transition loss using precomputed nearest-neighbor rates in O(n).
 * Shared between computeEmployeeMetrics (dailyGridBuilder) and computeDailyMetrics (dataProcessing).
 */
export const computeTransitionLoss = (
  dailyChRates: number[],
  dailyIsAbsence: boolean[],
  collectDetails: boolean = false
): TransitionLossResult => {
  const len = dailyChRates.length;
  const prevNonAbsRate = new Array(len).fill(-1);
  const nextNonAbsRate = new Array(len).fill(-1);

  let lastRate = -1;
  for (let i = 0; i < len; i++) {
    if (!dailyIsAbsence[i]) lastRate = dailyChRates[i];
    prevNonAbsRate[i] = lastRate;
  }
  lastRate = -1;
  for (let i = len - 1; i >= 0; i--) {
    if (!dailyIsAbsence[i]) lastRate = dailyChRates[i];
    nextNonAbsRate[i] = lastRate;
  }

  let totalShortfall = 0;
  const shortfallDetails: Array<{ dayIdx: number; rate: number; neighborMax: number; shortfall: number }> | undefined =
    collectDetails ? [] : undefined;

  for (let i = 0; i < len; i++) {
    if (dailyIsAbsence[i]) continue;
    const prev = i > 0 ? prevNonAbsRate[i - 1] : -1;
    const next = i < len - 1 ? nextNonAbsRate[i + 1] : -1;
    const neighborMax = Math.max(prev, next);
    if (neighborMax > dailyChRates[i]) {
      const sf = neighborMax - dailyChRates[i];
      totalShortfall += sf;
      if (collectDetails) {
        shortfallDetails!.push({ dayIdx: i, rate: dailyChRates[i], neighborMax, shortfall: sf });
      }
    }
  }

  return { totalShortfall, shortfallDetails };
};

// ─── Null forecast singleton ─────────────────────────────────────────────────

const NULL_FORECAST: ForecastResult = {
  forecastSegments: null,
  forecastTuRate: null,
  forecastChU: null,
  forecastAbsRate: null,
  rawFAbsU: 0,
  rawFChU: 0,
  rawFGoU: 0,
  rawFTrU: 0,
  rawFOtU: 0,
  cappedFChU: 0,
  cappedFGoU: 0,
  cappedFTrU: 0,
  cappedFOtU: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Transform SAP day records into DailyCellSegment[] */
const buildSapDaySegments = (sapDay: SapDayData, HPD: number): DailyCellSegment[] =>
  sapDay.records.map((r: SapRecord) => ({
    name: r.text || "SAP",
    jobNo: r.salesOrder || null,
    category: r.category,
    util: (r.hours / HPD) * 100,
  }));

/** Transform MDS periods into DailyCellSegment[] */
const buildForecastSegments = (periodsByTs: Map<number, SegmentPeriod[]>, ts: number): DailyCellSegment[] => {
  const dayPeriods = periodsByTs.get(ts);
  if (!dayPeriods) return [];
  return dayPeriods.map((p) => ({ name: p.jobName, jobNo: p.jobNo, category: p.category, util: p.util }));
};

/** Accumulate fragmentation HHI from work utilities */
const accumulateFragmentation = (workUtils: number[], acc: MetricAccumulators): void => {
  if (workUtils.length > 1) {
    const totalWork = workUtils.reduce((a, b) => a + b, 0);
    if (totalWork > 0) {
      const hhi = workUtils.reduce((a2, u) => a2 + (u / totalWork) ** 2, 0);
      acc.fragSum += 1 - hhi;
      acc.fragDays++;
    }
  } else if (workUtils.length === 1) {
    acc.fragDays++;
  }
};

// ─── 1. buildPeriodIndex ─────────────────────────────────────────────────────

/**
 * Build a Map<timestamp, SegmentPeriod[]> for O(1) day lookups.
 * Each day timestamp maps to all periods that overlap that day.
 */
const MS_PER_DAY = 86_400_000;

export const buildPeriodIndex = (segmentPeriods: SegmentPeriod[]): Map<number, SegmentPeriod[]> => {
  const periodsByTs = new Map<number, SegmentPeriod[]>();
  for (const p of segmentPeriods) {
    const pEnd = p.end;
    // Use Date arithmetic (setDate) instead of += MS_PER_DAY to handle DST correctly.
    // Adding 86400000ms skips/repeats days at DST boundaries (spring forward / fall back).
    const cursor = new Date(p.start);
    while (cursor.getTime() <= pEnd) {
      cursor.setHours(0, 0, 0, 0); // normalize after DST shift
      const dayTs = cursor.getTime();
      let arr = periodsByTs.get(dayTs);
      if (!arr) {
        arr = [];
        periodsByTs.set(dayTs, arr);
      }
      arr.push(p);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return periodsByTs;
};

// ─── 2. computeForecastForDay ────────────────────────────────────────────────

/**
 * Build forecast data for a single day from MDS periods.
 * Used for SAP days (parallel forecast trace) and forced-absence days.
 */
export const computeForecastForDay = (
  periodsByTs: Map<number, SegmentPeriod[]>,
  ts: number,
  isHoliday: boolean,
  chargeableCombined: boolean,
  isMdsAvailable: boolean
): ForecastResult => {
  if (!isMdsAvailable) return NULL_FORECAST;

  // Build segments then classify via shared primitive
  const fSegs: DailyCellSegment[] = isHoliday
    ? [{ name: "Holiday", jobNo: null, category: "holiday", util: 100 }]
    : buildForecastSegments(periodsByTs, ts);

  const forecastSegments = fSegs.length > 0 ? fSegs : null;
  const classified = accumulateSegmentsByCategory(fSegs, chargeableCombined);
  const fCap = capUtilizations(classified);
  return {
    forecastSegments,
    forecastTuRate: computeTuRate(fCap.cappedChU, fCap.netU),
    forecastChU: fCap.cappedChU,
    forecastAbsRate: fCap.cappedAbsU,
    rawFAbsU: classified.absU,
    rawFChU: classified.chU,
    rawFGoU: classified.goU,
    rawFTrU: classified.trU,
    rawFOtU: classified.otU,
    cappedFChU: fCap.cappedChU,
    cappedFGoU: fCap.cappedGoU,
    cappedFTrU: fCap.cappedTrU,
    cappedFOtU: fCap.cappedOtU,
  };
};

// ─── 3. computeDayCellSegments ───────────────────────────────────────────────

/**
 * Build segments, raw utilization, and forecast data for a single workday.
 *
 * Determines the data source (SAP, holiday, forced absence, MDS forecast)
 * and classifies each segment into utilization categories via accumulateSegmentsByCategory.
 *
 * @returns DaySegmentResult with all data needed to assemble the final cell.
 */
export const computeDayCellSegments = (
  day: DayInfo,
  isPresent: boolean,
  emp: EmpContext,
  settings: GridSettings
): DaySegmentResult => {
  const { dateStr, ts, isHoliday } = day;
  const { empSap, sapMinDate, sapMaxDate, HPD, periodsByTs } = emp;
  const { chargeableCombined, dataSourceFilter, currentMonthStartStr, currentMonthStartStrGlobal, nextMonthStartStr } =
    settings;

  const isMdsAvailable = dateStr >= MDS_EXTRACT_START;
  const sapDay = empSap ? empSap[dateStr] : null;
  const isSapHoliday = !sapDay && isHoliday && sapMinDate !== null && dateStr >= sapMinDate! && dateStr <= sapMaxDate!;
  let isSap = !!sapDay || isSapHoliday;
  let forcedAbsence = false;

  let segments: DailyCellSegment[] = [];
  let raw: RawUtilization = { absU: 0, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
  let dayWorkUtils: number[] = [];
  let forecastResult: ForecastResult = NULL_FORECAST;

  // Skip all data sources when employee is not present (outside arrival/departure)
  if (!isPresent) {
    isSap = false;
  } else if (isSap) {
    // ── SAP day: build SAP segments + parallel forecast ──
    forecastResult = computeForecastForDay(periodsByTs, ts, isHoliday, chargeableCombined, isMdsAvailable);

    if (isSapHoliday) {
      raw = { absU: 100, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
      segments = [{ name: "Holiday", jobNo: null, category: "holiday", util: 100 }];
    } else {
      // sapDay is non-null here: isSap is true and isSapHoliday is false → !!sapDay must be true
      segments = buildSapDaySegments(sapDay!, HPD);
      const classified = accumulateSegmentsByCategory(segments, chargeableCombined);
      raw = {
        absU: classified.absU,
        chU: classified.chU,
        goU: classified.goU,
        trU: classified.trU,
        otU: classified.otU,
        rawGoU: classified.rawGoU,
      };
      dayWorkUtils = classified.workUtils;
    }
  } else if (isHoliday && !(dataSourceFilter === "sap" && dateStr >= nextMonthStartStr)) {
    // ── Non-SAP holiday (skip in SAP mode for M+1 onwards) ──
    raw = { absU: 100, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
    segments = [{ name: "Holiday", jobNo: null, category: "holiday", util: 100 }];
  } else if (dataSourceFilter === "sap") {
    if (dateStr >= nextMonthStartStr) {
      // M+1 onwards: no data displayed in SAP mode
    } else if (dateStr < currentMonthStartStr) {
      raw = { absU: 100, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
      isSap = true;
      forcedAbsence = true;
      segments = [{ name: "Absence (no SAP)", jobNo: null, category: "otherAbsence", util: 100 }];
    }
  } else if (!isMdsAvailable) {
    if (empSap && dateStr < currentMonthStartStrGlobal && isPresent) {
      raw = { absU: 100, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
      isSap = true;
      forcedAbsence = true;
      segments = [{ name: "Absence (no SAP)", jobNo: null, category: "otherAbsence", util: 100 }];
    }
  } else if (empSap && dateStr < currentMonthStartStrGlobal && isPresent) {
    // ── Past completed month with MDS available, forced absence ──
    raw = { absU: 100, chU: 0, goU: 0, trU: 0, otU: 0, rawGoU: 0 };
    isSap = true;
    forcedAbsence = true;
    segments = [{ name: "Absence (no SAP)", jobNo: null, category: "otherAbsence", util: 100 }];
    // Build parallel forecast trace for variance computation
    forecastResult = computeForecastForDay(periodsByTs, ts, false, chargeableCombined, true);
  } else {
    // ── Forecast data (isPresent guaranteed by outer check) ──
    segments = buildForecastSegments(periodsByTs, ts);
    const classified = accumulateSegmentsByCategory(segments, chargeableCombined);
    raw = {
      absU: classified.absU,
      chU: classified.chU,
      goU: classified.goU,
      trU: classified.trU,
      otU: classified.otU,
      rawGoU: classified.rawGoU,
    };
    dayWorkUtils = classified.workUtils;
  }

  return { segments, raw, dayWorkUtils, isSap, forcedAbsence, forecastResult };
};

// ─── 4. assembleDailyCell ────────────────────────────────────────────────────

/**
 * Assemble the final DailyCell from raw utilization, segments, and forecast data.
 * Applies capping (priority: abs > ch > go > tr > ot) and computes TU/TO rates.
 */
export const assembleDailyCell = (
  day: DayInfo,
  isPresent: boolean,
  result: DaySegmentResult,
  settings: GridSettings
): DailyCell => {
  const { dateStr, isHoliday } = day;
  const { dataSourceFilter, nextMonthStartStr } = settings;
  const isMdsAvailable = dateStr >= MDS_EXTRACT_START;
  const { segments, raw, dayWorkUtils, isSap, forcedAbsence, forecastResult } = result;
  const { absU, chU, goU, trU, otU, rawGoU } = raw;

  const cap = capUtilizations({ absU, chU, goU, trU, otU });
  const { cappedAbsU, netU, cappedChU, cappedGoU, cappedTrU, cappedTotal, absScale, chScale, goScale, trScale } = cap;
  const tuRate = computeTuRate(cappedChU, netU);
  const toRate = computeToRate(cappedChU, cappedGoU, cappedTrU, netU);

  const isFutureSap = dataSourceFilter === "sap" && dateStr >= nextMonthStartStr;
  const hasStaffing =
    !isFutureSap &&
    (isSap ||
      (segments.length > 0 && !segments.every((s) => s.category === "holiday")) ||
      (isMdsAvailable && !isSap && isPresent) ||
      (dataSourceFilter === "sap" && isHoliday && isPresent) ||
      forcedAbsence);

  return {
    dateStr,
    isWE: false,
    isHoliday,
    absU,
    chU,
    goU,
    trU,
    otU,
    rawGoU,
    cappedAbsU,
    cappedChU,
    cappedGoU,
    cappedTrU,
    cappedTotal,
    tuRate,
    toRate,
    netU,
    segments,
    absScale,
    chScale,
    goScale,
    trScale,
    isSap,
    forecastSegments: forecastResult.forecastSegments,
    forecastTuRate: forecastResult.forecastTuRate,
    forecastChU: forecastResult.forecastChU,
    forecastAbsRate: forecastResult.forecastAbsRate,
    hasStaffing,
    ...(forcedAbsence && { isForcedAbsence: true }),
    dayWorkUtils: dayWorkUtils.length > 0 ? dayWorkUtils : null,
  };
};

// ─── 5. buildWeekendSapCell ──────────────────────────────────────────────────

/**
 * Build a DailyCell for a weekend day that has SAP data (e.g. weekend travel).
 * Returns null if there is no SAP data for this weekend day.
 */
export const buildWeekendSapCell = (
  dateStr: string,
  empSap: Record<string, SapDayData> | null,
  HPD: number,
  chargeableCombined: boolean
): DailyCell | null => {
  const weSapDay = empSap ? empSap[dateStr] : null;
  if (!weSapDay) return null;

  const weSegs = buildSapDaySegments(weSapDay, HPD);
  const classified = accumulateSegmentsByCategory(weSegs, chargeableCombined);
  const weCap = capUtilizations(classified);
  return {
    dateStr,
    isWE: true,
    isHoliday: false,
    absU: classified.absU,
    chU: classified.chU,
    goU: classified.goU,
    trU: classified.trU,
    otU: classified.otU,
    rawGoU: classified.rawGoU,
    cappedAbsU: weCap.cappedAbsU,
    cappedChU: weCap.cappedChU,
    cappedGoU: weCap.cappedGoU,
    cappedTrU: weCap.cappedTrU,
    cappedTotal: weCap.cappedTotal,
    tuRate: computeTuRate(weCap.cappedChU, weCap.netU),
    toRate: computeToRate(weCap.cappedChU, weCap.cappedGoU, weCap.cappedTrU, weCap.netU),
    netU: weCap.netU,
    segments: weSegs,
    absScale: 1,
    chScale: 1,
    goScale: 1,
    trScale: 1,
    isSap: true,
    forecastSegments: null,
    forecastTuRate: null,
    forecastChU: null,
    forecastAbsRate: null,
    hasStaffing: true,
    dayWorkUtils: null,
  };
};

// ─── 6. accumulateFromCachedCell ─────────────────────────────────────────────

/**
 * Re-accumulate employee-level metrics from a cached cell (O(1) per day).
 * Mutates the `acc` accumulators in place.
 */
export const accumulateFromCachedCell = (
  cached: DailyCell,
  acc: MetricAccumulators,
  empSap: Record<string, SapDayData> | null,
  sapMonthDateStrs: Set<string>,
  chargeableCombined: boolean
): void => {
  if (cached.isHoliday && !cached.isSap) {
    acc.holidayUtil += 100;
    acc.fcastHolidayUtil += 100;
    acc.fcastWorkDays++;
    acc.dailyChRates.push(0);
    acc.dailyIsAbsence.push(true);
  } else {
    acc.absenceUtil += cached.absU;
    acc.chargeableUtil += cached.cappedChU;
    acc.generalOpptyUtil += cached.cappedGoU;
    acc.trainingUtil += cached.cappedTrU;
    acc.otherUtil += Math.min(
      cached.otU,
      Math.max(0, cached.netU - cached.cappedChU - cached.cappedGoU - cached.cappedTrU)
    );
    acc.dailyChRates.push(cached.cappedChU);
    acc.dailyIsAbsence.push(cached.absU >= 100);
    accumulateFragmentation(cached.dayWorkUtils || [], acc);
    if (cached.isSap && cached.forecastSegments) {
      acc.sapVarDayCount++;
      const sapDayNetU = Math.max(0, 100 - cached.absU);
      const sapDayCappedCh = Math.min(cached.chU, sapDayNetU);
      acc.sapChSum += sapDayCappedCh;
      acc.sapAbsSum += Math.min(cached.absU, 100);
      acc.fChSum += cached.forecastChU || 0;
      acc.fAbsSum += cached.forecastAbsRate || 0;
    }
    if (empSap && sapMonthDateStrs.size > 0 && empSap[cached.dateStr] && sapMonthDateStrs.has(cached.dateStr)) {
      acc.sapMonthDayCount++;
    }

    // Forecast-only accumulators from cache
    acc.fcastWorkDays++;
    if (cached.isSap) {
      if (cached.forecastSegments) {
        // Re-accumulate from raw forecast segments with proper capping
        const classified = accumulateSegmentsByCategory(cached.forecastSegments, chargeableCombined);
        const fCap = capUtilizations(classified);
        acc.fcastAbsenceUtil += classified.absU;
        acc.fcastChargeableUtil += fCap.cappedChU;
        acc.fcastGeneralOpptyUtil += fCap.cappedGoU;
        acc.fcastTrainingUtil += fCap.cappedTrU;
        acc.fcastOtherUtil += fCap.cappedOtU;
      } else {
        acc.fcastAbsenceUtil += cached.forecastAbsRate || 0;
        acc.fcastChargeableUtil += cached.forecastChU || 0;
      }
    } else {
      acc.fcastAbsenceUtil += cached.absU;
      acc.fcastChargeableUtil += cached.cappedChU;
      acc.fcastGeneralOpptyUtil += cached.cappedGoU;
      acc.fcastTrainingUtil += cached.cappedTrU;
      acc.fcastOtherUtil += Math.min(
        cached.otU,
        Math.max(0, cached.netU - cached.cappedChU - cached.cappedGoU - cached.cappedTrU)
      );
    }
  }
};

// ─── 7. accumulateFromNewCell ────────────────────────────────────────────────

/**
 * Accumulate employee-level metrics from a freshly computed cell.
 * Mutates the `acc` accumulators in place.
 */
export const accumulateFromNewCell = (
  cell: DailyCell,
  result: DaySegmentResult,
  acc: MetricAccumulators,
  empSap: Record<string, SapDayData> | null,
  sapMonthDateStrs: Set<string>,
  isMdsAvailable: boolean
): void => {
  const { raw, dayWorkUtils, isSap, forecastResult } = result;

  // Holiday (non-SAP) → skip normal accumulation
  if (cell.isHoliday && !isSap) {
    acc.holidayUtil += 100;
    if (isMdsAvailable) {
      acc.fcastHolidayUtil += 100;
      acc.fcastWorkDays++;
    }
    acc.dailyChRates.push(0);
    acc.dailyIsAbsence.push(true);
    return;
  }

  acc.absenceUtil += raw.absU;
  acc.chargeableUtil += cell.cappedChU;
  acc.generalOpptyUtil += cell.cappedGoU;
  acc.trainingUtil += cell.cappedTrU;
  acc.otherUtil += Math.min(raw.otU, Math.max(0, cell.netU - cell.cappedChU - cell.cappedGoU - cell.cappedTrU));

  // Forecast-only: for non-SAP days after MDS_EXTRACT_START, use same values (they come from MDS)
  if (!isSap && isMdsAvailable) {
    acc.fcastWorkDays++;
    acc.fcastAbsenceUtil += raw.absU;
    acc.fcastChargeableUtil += cell.cappedChU;
    acc.fcastGeneralOpptyUtil += cell.cappedGoU;
    acc.fcastTrainingUtil += cell.cappedTrU;
    acc.fcastOtherUtil += Math.min(raw.otU, Math.max(0, cell.netU - cell.cappedChU - cell.cappedGoU - cell.cappedTrU));
  }

  // SAP day forecast accumulation
  if (isSap) {
    acc.fcastWorkDays++;
    acc.fcastAbsenceUtil += forecastResult.rawFAbsU;
    acc.fcastChargeableUtil += forecastResult.cappedFChU;
    acc.fcastGeneralOpptyUtil += forecastResult.cappedFGoU;
    acc.fcastTrainingUtil += forecastResult.cappedFTrU;
    acc.fcastOtherUtil += forecastResult.cappedFOtU;
  }

  acc.dailyChRates.push(cell.cappedChU);
  acc.dailyIsAbsence.push(raw.absU >= 100);

  // Fragmentation
  accumulateFragmentation(dayWorkUtils, acc);

  // SAP variance accumulation
  if (isSap && forecastResult.forecastSegments) {
    acc.sapVarDayCount++;
    const sapDayNetU = Math.max(0, 100 - raw.absU);
    const sapDayCappedCh = Math.min(raw.chU, sapDayNetU);
    acc.sapChSum += sapDayCappedCh;
    acc.sapAbsSum += Math.min(raw.absU, 100);
    acc.fChSum += forecastResult.forecastChU!;
    acc.fAbsSum += forecastResult.forecastAbsRate!;
  }

  // SAP month completion count
  if (empSap && sapMonthDateStrs.size > 0 && empSap[cell.dateStr] && sapMonthDateStrs.has(cell.dateStr)) {
    acc.sapMonthDayCount++;
  }
};

// ─── 8. computeEmployeeMetrics ───────────────────────────────────────────────

/**
 * Derive final employee-level metrics from accumulated values.
 * Includes TU transition loss, SAP variance, and forecast-only metrics.
 */
export const computeEmployeeMetrics = (
  acc: MetricAccumulators,
  HPD: number,
  sapMonthWorkDays: number
): EmployeeGridMetrics => {
  // ── TU Transition Loss (shared O(n) algorithm) ──
  const { totalShortfall, shortfallDetails } = computeTransitionLoss(acc.dailyChRates, acc.dailyIsAbsence, true);

  // ── Derive employee-level metrics ──
  // Include weekend SAP days in total hours so weekend work is reflected in TU
  const totalH = (acc.workDays + acc.weekendSapDays) * HPD;
  const absenceH = (acc.absenceUtil * HPD) / 100;
  const holidayH = (acc.holidayUtil * HPD) / 100;
  const netH = totalH - absenceH - holidayH;
  const chargeableH = (acc.chargeableUtil * HPD) / 100;
  const generalOpptyH = (acc.generalOpptyUtil * HPD) / 100;
  const trainingH = (acc.trainingUtil * HPD) / 100;
  const otherH = (acc.otherUtil * HPD) / 100;
  const dispoH = Math.max(0, netH - chargeableH - generalOpptyH - trainingH - otherH);
  const tu = computeTuRate(chargeableH + generalOpptyH, netH);
  const to = computeToRate(chargeableH, generalOpptyH, trainingH, netH);

  const fragScore = acc.fragDays > 0 ? (acc.fragSum / acc.fragDays) * 100 : 0;
  const tuTransitionLossHours = (totalShortfall * HPD) / 100;
  const tuTransitionLossPoints = netH > 0 ? (tuTransitionLossHours / netH) * 100 : 0;

  // ── SAP variance ──
  const varianceRate = computeVarianceRate(acc.sapVarDayCount, acc.sapChSum, acc.sapAbsSum, acc.fChSum, acc.fAbsSum);
  const varianceHours = acc.sapVarDayCount > 0 ? ((acc.sapChSum - acc.fChSum) * HPD) / 100 : null;

  // ── SAP completion percentage ──
  const sapPct = sapMonthWorkDays > 0 ? (acc.sapMonthDayCount / sapMonthWorkDays) * 100 : 0;

  // ── Forecast-only derived metrics (MDS data only) ──
  const forecastTotalH = acc.fcastWorkDays * HPD;
  const forecastAbsenceH = (acc.fcastAbsenceUtil * HPD) / 100;
  const forecastHolidayH = (acc.fcastHolidayUtil * HPD) / 100;
  const forecastNetH = forecastTotalH - forecastAbsenceH - forecastHolidayH;
  const forecastChargeableH = (acc.fcastChargeableUtil * HPD) / 100;
  const forecastGeneralOpptyH = (acc.fcastGeneralOpptyUtil * HPD) / 100;
  const forecastTrainingH = (acc.fcastTrainingUtil * HPD) / 100;
  const forecastOtherH = (acc.fcastOtherUtil * HPD) / 100;
  const forecastTU = forecastNetH > 0 ? ((forecastChargeableH + forecastGeneralOpptyH) / forecastNetH) * 100 : 0;

  return {
    tu,
    to,
    workDays: acc.workDays,
    totalH,
    absenceH,
    holidayH,
    netH,
    chargeableH,
    generalOpptyH,
    trainingH,
    otherH,
    dispoH,
    fragScore,
    tuTransitionLossHours,
    tuTransitionLossPoints,
    shortfallDetails: shortfallDetails || [],
    varianceRate,
    varianceHours,
    sapPct,
    forecastTotalH,
    forecastAbsenceH,
    forecastNetH,
    forecastChargeableH,
    forecastGeneralOpptyH,
    forecastTrainingH,
    forecastOtherH,
    forecastTU,
  };
};

// ─── 9. createEmptyAccumulators ──────────────────────────────────────────────

/**
 * Create a fresh set of metric accumulators for one employee.
 */
export const createEmptyAccumulators = (): MetricAccumulators => ({
  workDays: 0,
  weekendSapDays: 0,
  absenceUtil: 0,
  holidayUtil: 0,
  chargeableUtil: 0,
  generalOpptyUtil: 0,
  trainingUtil: 0,
  otherUtil: 0,
  fragSum: 0,
  fragDays: 0,
  fcastWorkDays: 0,
  fcastAbsenceUtil: 0,
  fcastHolidayUtil: 0,
  fcastChargeableUtil: 0,
  fcastGeneralOpptyUtil: 0,
  fcastTrainingUtil: 0,
  fcastOtherUtil: 0,
  dailyChRates: [],
  dailyIsAbsence: [],
  sapChSum: 0,
  sapAbsSum: 0,
  fChSum: 0,
  fAbsSum: 0,
  sapVarDayCount: 0,
  sapMonthDayCount: 0,
});
