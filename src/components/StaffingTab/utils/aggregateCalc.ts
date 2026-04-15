/**
 * Pure functions for aggregate MDS/SAP calculations.
 * Used by AggregateHeatmapStrip (fast path) and handlePeriodClick (StaffingTab).
 * Eliminates duplication of substitution, variance, and denominator logic.
 */
import { ABSENCE_CATS, CHARGEABLE_CATS, GO_CATS, TRAINING_CATS, MDS_EXTRACT_START, getHoursPerDay } from "../constants";
import type { DailyCell, Employee, EmployeeDailyData, EtpAdjustment, CalendarDay } from "../types";
import { getEtpRatio } from "../types";
import { accumulateSegmentsByCategory, capUtilizations } from "./calcPrimitives";
import { getRealEmpId } from "./empIdUtils";
import { getToday } from "../../../utils/formatters";

// Dependent caches: reset when getToday() changes (tracked via _cachedToday)
let _cachedToday: string | null = null;
let _currentMonthStartCache: string | null = null;
const getCurrentMonthStart = (): string => {
  const today = getToday();
  if (_cachedToday !== today) {
    _cachedToday = today;
    _currentMonthStartCache = null;
    _nextMonthStartCache = null;
  }
  if (!_currentMonthStartCache) _currentMonthStartCache = today.slice(0, 7) + "-01";
  return _currentMonthStartCache;
};

let _nextMonthStartCache: string | null = null;
const getNextMonthStart = (): string => {
  const today = getToday();
  if (_cachedToday !== today) {
    _cachedToday = today;
    _currentMonthStartCache = null;
    _nextMonthStartCache = null;
  }
  if (!_nextMonthStartCache) {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 1);
    _nextMonthStartCache = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return _nextMonthStartCache;
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DisplayValues {
  displayChU: number;
  displayAbsU: number;
  sapActualChU: number;
  sapActualAbsU: number;
  sapForecastChU: number;
  sapForecastAbsU: number;
  isSapWithMds: boolean;
}

export interface EmpDayAggResult {
  cappedChU: number;
  cappedGoU: number;
  cappedTrU: number;
  cappedAbsU: number;
  rawGoU: number;
  rawTotal: number;
  cappedTotal: number;
  netU: number;
  display: DisplayValues;
  forecastCounted: boolean;
  forecastAbsU: number;
  forecastChU: number;
  forecastGoU: number;
  forecastTrU: number;
}

// ─── 1. isEmployeeActive ─────────────────────────────────────────────────────

/**
 * Determine if an employee is active on a given day.
 * Active = has staffing data, OR (date >= MDS_EXTRACT_START AND employee is present).
 * In SAP-only mode (sapOnly=true), SAP days count + past days where employee is present
 * (no SAP data → treated as 100% absence).
 */
export const isEmployeeActive = (
  hasStaffing: boolean,
  dateStr: string,
  arrivalDate?: string | null,
  departureDate?: string | null,
  sapOnly?: boolean,
  isSapDay?: boolean,
  isHoliday?: boolean
): boolean => {
  // Check presence first — grade-split virtual rows have narrowed arrival/departure
  const isPresent = (!arrivalDate || dateStr >= arrivalDate) && (!departureDate || dateStr <= departureDate);
  if (!isPresent) return false;
  if (sapOnly) {
    // M+1 onwards: no data in SAP mode
    if (dateStr >= getNextMonthStart()) return false;
    if (isSapDay) return true;
    // Holidays count as active for present employees (past months + current month)
    if (isHoliday) return true;
    // Past completed months: employee present → active (forced absence filled by buildDailyGrid)
    // Current month without SAP: only active if has staffing data (SAP day already checked above)
    if (dateStr >= getCurrentMonthStart()) return hasStaffing;
    return dateStr < getToday();
  }
  if (hasStaffing) return true;
  const isMdsAvailable = dateStr >= MDS_EXTRACT_START;
  if (!isMdsAvailable) return false;
  return true; // isPresent already checked at top
};

// ─── 2. getSegmentScale ──────────────────────────────────────────────────────

/**
 * Get the capping scale factor for a segment based on its category.
 */
export const getSegmentScale = (
  category: string,
  cell: { absScale: number; chScale: number; goScale: number; trScale: number },
  chargeableCombined: boolean
): number => {
  if (ABSENCE_CATS.has(category)) return cell.absScale;
  if (CHARGEABLE_CATS.has(category)) return cell.chScale;
  if (GO_CATS.has(category)) return chargeableCombined ? cell.chScale : cell.goScale;
  if (TRAINING_CATS.has(category)) return cell.trScale;
  return 1;
};

// ─── 3. accumulateForecastForEmployee ────────────────────────────────────────

/**
 * Accumulate forecast category breakdown for a single employee on a single day.
 * SAP+MDS: iterate forecastSegments (unscaled).
 * Non-SAP+staffing: iterate segments with scale factors.
 * Mutates forecastCatMap. Returns whether counted + forecast abs/ch values.
 */
export const accumulateForecastForEmployee = (
  cell: DailyCell,
  isSapEmp: boolean,
  chargeableCombined: boolean,
  forecastCatMap: Record<string, number>
): { counted: boolean; fAbsU: number; fChU: number; fGoU: number; fTrU: number } => {
  const hasMds = !!cell.forecastSegments;

  if (isSapEmp) {
    if (!hasMds) return { counted: false, fAbsU: 0, fChU: 0, fGoU: 0, fTrU: 0 };
    let fGoU = 0,
      fTrU = 0;
    for (const seg of cell.forecastSegments!) {
      forecastCatMap[seg.category] = (forecastCatMap[seg.category] || 0) + seg.util;
      if (GO_CATS.has(seg.category)) fGoU += seg.util;
      else if (TRAINING_CATS.has(seg.category)) fTrU += seg.util;
    }
    return { counted: true, fAbsU: cell.forecastAbsRate || 0, fChU: cell.forecastChU || 0, fGoU, fTrU };
  }

  // Non-SAP: only count if has staffing data
  if (!cell.hasStaffing) return { counted: false, fAbsU: 0, fChU: 0, fGoU: 0, fTrU: 0 };

  for (const seg of cell.segments) {
    const scale = getSegmentScale(seg.category, cell, chargeableCombined);
    forecastCatMap[seg.category] = (forecastCatMap[seg.category] || 0) + seg.util * scale;
  }
  return { counted: true, fAbsU: cell.cappedAbsU, fChU: cell.cappedChU, fGoU: cell.cappedGoU, fTrU: cell.cappedTrU };
};

// ─── 4. resolveDisplayValues ─────────────────────────────────────────────────

/**
 * Determine display chargeable/absence for a single employee-day.
 * Heatmaps always show SAP actuals when available (cell.cappedChU).
 * Forecast fields kept for variance tracking.
 */
export const resolveDisplayValues = (
  cell: DailyCell,
  isSapEmp: boolean,
  useSapActuals: boolean = false
): DisplayValues => {
  const hasMds = !!cell.forecastSegments;
  const effectiveCh = cell.effectiveChU != null ? cell.effectiveChU : cell.cappedChU;
  return {
    displayChU: effectiveCh,
    displayAbsU: cell.cappedAbsU,
    sapActualChU: isSapEmp ? cell.cappedChU : 0,
    sapActualAbsU: isSapEmp ? cell.cappedAbsU : 0,
    sapForecastChU: isSapEmp && hasMds ? cell.forecastChU || 0 : 0,
    sapForecastAbsU: isSapEmp && hasMds ? cell.forecastAbsRate || 0 : 0,
    isSapWithMds: isSapEmp && hasMds,
  };
};

// ─── 5. computeDisplayTU ─────────────────────────────────────────────────────

/**
 * Compute display TU rate from total active employee-days, display chargeable and absence.
 */
export const computeDisplayTU = (activeEmpDays: number, displayChU: number, displayAbsU: number): number => {
  const displayNet = activeEmpDays * 100 - displayAbsU;
  return displayNet > 0 ? (displayChU / displayNet) * 100 : 0;
};

// ─── 6. computeVarianceRate ──────────────────────────────────────────────────

// Delegated to varianceEngine — single source of truth for variance calculations.
export { computeVarianceRate } from "./varianceEngine";

// ─── 7. processEmployeeDayForAggregate ───────────────────────────────────────

/**
 * Process a single employee-day cell for aggregate computations.
 * Combines isEmployeeActive + segment accumulation + forecast + display.
 * Returns null if the employee is inactive on this day.
 * Mutates catMap, sapCatMap, forecastCatMap (accumulates into them).
 * useSapActuals: when true, only SAP days count and display uses SAP actuals.
 */
export const processEmployeeDayForAggregate = (
  cell: DailyCell,
  dateStr: string,
  isSapEmp: boolean,
  arrivalDate: string | undefined | null,
  departureDate: string | undefined | null,
  chargeableCombined: boolean,
  catMap: Record<string, number>,
  sapCatMap: Record<string, number>,
  forecastCatMap: Record<string, number>,
  useSapActuals: boolean = false
): EmpDayAggResult | null => {
  if (
    !isEmployeeActive(cell.hasStaffing, dateStr, arrivalDate, departureDate, useSapActuals, cell.isSap, cell.isHoliday)
  )
    return null;

  // Accumulate category breakdown from segments
  // In SAP-actuals mode, all active days (including forced-absence) go into sapCatMap
  for (const seg of cell.segments) {
    const scale = getSegmentScale(seg.category, cell, chargeableCombined);
    catMap[seg.category] = (catMap[seg.category] || 0) + seg.util * scale;
    if (isSapEmp || useSapActuals) sapCatMap[seg.category] = (sapCatMap[seg.category] || 0) + seg.util * scale;
  }

  // Forecast: skip in SAP-actuals mode
  const forecast = useSapActuals
    ? { counted: false, fAbsU: 0, fChU: 0, fGoU: 0, fTrU: 0 }
    : accumulateForecastForEmployee(cell, isSapEmp, chargeableCombined, forecastCatMap);

  // Display values
  const display = resolveDisplayValues(cell, isSapEmp, useSapActuals);

  return {
    cappedChU: cell.effectiveChU != null ? cell.effectiveChU : cell.cappedChU,
    cappedGoU: cell.cappedGoU,
    cappedTrU: cell.cappedTrU,
    cappedAbsU: cell.cappedAbsU,
    rawGoU: cell.rawGoU,
    rawTotal: cell.absU + cell.chU + cell.goU + cell.trU + cell.otU,
    cappedTotal: cell.cappedTotal,
    netU: cell.netU,
    display,
    forecastCounted: forecast.counted,
    forecastAbsU: forecast.fAbsU,
    forecastChU: forecast.fChU,
    forecastGoU: forecast.fGoU,
    forecastTrU: forecast.fTrU,
  };
};

// ─── 8. computeBucketFromGrid ────────────────────────────────────────────────

export interface BucketDisplayResult {
  displayTU: number;
  displayTO: number;
  availabilityRate: number;
  activeEmpDays: number;
  uniqueActiveEmpDays: number;
  presenceEmpDays: number;
  displayChU: number;
  displayAbsU: number;
  displayTrU: number;
  ioChU: number;
  ioChH: number;
  // Real hours (per-grade HPD, holiday-aware)
  realBaseH: number;
  realChH: number;
  realAbsH: number;
  realHolH: number;
  realTrH: number;
  realNetH: number;
  realTU: number;
  realTO: number;
  // SAP actual hours (only days with SAP data)
  sapBaseH: number;
  sapChH: number;
  sapAbsH: number;
  sapHolH: number;
  sapTrH: number;
  sapNetH: number;
  sapTU: number | null;
  sapTO: number | null;
  hasSapData: boolean;
  // MDS hours — independent pipeline (forecastSegments on SAP+MDS days, segments on pure MDS days)
  mdsBaseH: number;
  mdsChH: number;
  mdsAbsH: number;
  mdsHolH: number;
  mdsTrH: number;
  mdsNetH: number;
  mdsTU: number | null;
  mdsTO: number | null;
  hasMdsData: boolean;
}

/** Mutable accumulators shared across weekend/holiday/regular day handlers */
interface BucketAccumulators {
  activeEmpDays: number;
  totalDisplayChU: number;
  totalDisplayAbsU: number;
  totalTrU: number;
  totalIoChU: number;
  totalIoChH: number;
  covered: boolean;
  realBaseH: number;
  realChH: number;
  realAbsH: number;
  realHolH: number;
  realTrH: number;
  sapBaseH: number;
  sapChH: number;
  sapAbsH: number;
  sapHolH: number;
  sapTrH: number;
  hasSapData: boolean;
  mdsBaseH: number;
  mdsChH: number;
  mdsAbsH: number;
  mdsHolH: number;
  mdsTrH: number;
  hasMdsData: boolean;
  uniqueEmpPerDay: Map<string, Set<string>>;
  presenceEmpPerDay: Map<string, Set<string>>;
}

const createBucketAccumulators = (): BucketAccumulators => ({
  activeEmpDays: 0,
  totalDisplayChU: 0,
  totalDisplayAbsU: 0,
  totalTrU: 0,
  totalIoChU: 0,
  totalIoChH: 0,
  covered: false,
  realBaseH: 0,
  realChH: 0,
  realAbsH: 0,
  realHolH: 0,
  realTrH: 0,
  sapBaseH: 0,
  sapChH: 0,
  sapAbsH: 0,
  sapHolH: 0,
  sapTrH: 0,
  hasSapData: false,
  mdsBaseH: 0,
  mdsChH: 0,
  mdsAbsH: 0,
  mdsHolH: 0,
  mdsTrH: 0,
  hasMdsData: false,
  uniqueEmpPerDay: new Map(),
  presenceEmpPerDay: new Map(),
});

/** Track unique real employee for FTE dedup */
const trackUniqueEmp = (map: Map<string, Set<string>>, dtStr: string, realId: string): void => {
  if (!map.has(dtStr)) map.set(dtStr, new Set());
  map.get(dtStr)!.add(realId);
};

/** Weekend: only process employees with SAP data (e.g. travel) */
const accumulateWeekendDay = (
  employees: Employee[],
  dailyGrid: Map<string, EmployeeDailyData>,
  calIdx: number,
  dtStr: string,
  acc: BucketAccumulators,
  chargeableCombined: boolean
): void => {
  const weProcessed = new Set<string>();
  for (const emp of employees) {
    const realId = getRealEmpId(emp);
    if (weProcessed.has(realId)) continue;
    const empGrid = dailyGrid.get(emp.empId);
    if (!empGrid) continue;
    const c = empGrid.cells[calIdx];
    if (!c || !c.isSap || !c.segments || c.segments.length === 0) continue;
    weProcessed.add(realId);
    acc.covered = true;
    acc.activeEmpDays++;
    trackUniqueEmp(acc.uniqueEmpPerDay, dtStr, realId);
    const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, dtStr);
    acc.realBaseH += empHPD;
    acc.hasSapData = true;
    acc.sapBaseH += empHPD;
    for (const seg of c.segments) {
      const scale = getSegmentScale(seg.category, c, chargeableCombined);
      const scaledU = seg.util * scale;
      if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
        acc.realChH += (scaledU / 100) * empHPD;
        acc.sapChH += (scaledU / 100) * empHPD;
        acc.totalDisplayChU += scaledU;
      } else if (ABSENCE_CATS.has(seg.category)) {
        acc.realAbsH += (scaledU / 100) * empHPD;
        acc.sapAbsH += (scaledU / 100) * empHPD;
        acc.totalDisplayAbsU += scaledU;
      } else if (TRAINING_CATS.has(seg.category)) {
        acc.realTrH += (scaledU / 100) * empHPD;
        acc.sapTrH += (scaledU / 100) * empHPD;
        acc.totalTrU += scaledU;
      }
    }
    // MDS variance: weekend SAP without forecast → bench
    if (dtStr >= MDS_EXTRACT_START) {
      acc.hasMdsData = true;
      acc.mdsBaseH += empHPD;
      if (c.forecastSegments) {
        const mdsAcc = accumulateSegmentsByCategory(c.forecastSegments, chargeableCombined);
        const mdsCap = capUtilizations(mdsAcc);
        acc.mdsAbsH += (mdsCap.cappedAbsU / 100) * empHPD;
        acc.mdsChH += (mdsCap.cappedChU / 100) * empHPD;
        acc.mdsTrH += (mdsCap.cappedTrU / 100) * empHPD;
      }
    }
  }
};

/** Holiday: count present employees for hours, track SAP/MDS pipelines */
const accumulateHolidayDay = (
  employees: Employee[],
  dailyGrid: Map<string, EmployeeDailyData>,
  calIdx: number,
  dtStr: string,
  acc: BucketAccumulators,
  useSapActuals?: boolean
): void => {
  if (useSapActuals && dtStr >= getNextMonthStart()) return;
  for (const emp of employees) {
    const empGrid = dailyGrid.get(emp.empId);
    if (!empGrid) continue;
    const c = empGrid.cells[calIdx];
    if (!c || c.isWE) continue;

    const active = useSapActuals
      ? (!emp._arrivalDate || dtStr >= emp._arrivalDate) && (!emp._departureDate || dtStr <= emp._departureDate)
      : isEmployeeActive(false, dtStr, emp._arrivalDate, emp._departureDate, false, false, true);
    if (!active) continue;

    acc.activeEmpDays++;
    const realId = getRealEmpId(emp);
    trackUniqueEmp(acc.uniqueEmpPerDay, dtStr, realId);

    const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, dtStr);
    acc.realBaseH += empHPD;
    acc.realHolH += empHPD;

    if (c.isSap) {
      acc.hasSapData = true;
      acc.sapBaseH += empHPD;
      acc.sapHolH += empHPD;
    }
    if (dtStr >= MDS_EXTRACT_START) {
      acc.hasMdsData = true;
      acc.mdsBaseH += empHPD;
      acc.mdsHolH += empHPD;
    }
  }
};

/** Regular workday: use processEmployeeDayForAggregate + SAP/MDS/IO pipelines */
const accumulateRegularDay = (
  employees: Employee[],
  dailyGrid: Map<string, EmployeeDailyData>,
  calIdx: number,
  dtStr: string,
  acc: BucketAccumulators,
  chargeableCombined: boolean,
  useSapActuals?: boolean,
  ioJobcodes?: Set<string> | null
): void => {
  const hasIO = ioJobcodes && ioJobcodes.size > 0;
  const catMap: Record<string, number> = {};
  const sapCatMap: Record<string, number> = {};
  const forecastCatMap: Record<string, number> = {};

  for (const emp of employees) {
    const empGrid = dailyGrid.get(emp.empId);
    if (!empGrid) continue;
    const c = empGrid.cells[calIdx];
    if (!c || c.isWE) continue;

    const result = processEmployeeDayForAggregate(
      c,
      dtStr,
      c.isSap,
      emp._arrivalDate,
      emp._departureDate,
      chargeableCombined,
      catMap,
      sapCatMap,
      forecastCatMap,
      useSapActuals
    );
    if (!result) continue;
    acc.activeEmpDays++;
    const realId = getRealEmpId(emp);
    trackUniqueEmp(acc.uniqueEmpPerDay, dtStr, realId);

    acc.totalDisplayChU += result.display.displayChU;
    acc.totalDisplayAbsU += result.display.displayAbsU;
    acc.totalTrU += result.cappedTrU;

    const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, dtStr);
    acc.realBaseH += empHPD;
    acc.realChH += (result.display.displayChU / 100) * empHPD;
    acc.realAbsH += (result.cappedAbsU / 100) * empHPD;
    acc.realTrH += (result.cappedTrU / 100) * empHPD;

    // SAP actual hours
    if (c.isSap) {
      acc.hasSapData = true;
      acc.sapBaseH += empHPD;
      acc.sapChH += (result.display.sapActualChU / 100) * empHPD;
      acc.sapAbsH += (result.display.sapActualAbsU / 100) * empHPD;
      acc.sapTrH += (result.cappedTrU / 100) * empHPD;
    }

    // MDS independent pipeline
    if (c.isSap && c.forecastSegments) {
      acc.hasMdsData = true;
      acc.mdsBaseH += empHPD;
      const mdsAcc = accumulateSegmentsByCategory(c.forecastSegments, chargeableCombined);
      const mdsCap = capUtilizations(mdsAcc);
      acc.mdsAbsH += (mdsCap.cappedAbsU / 100) * empHPD;
      acc.mdsChH += (mdsCap.cappedChU / 100) * empHPD;
      acc.mdsTrH += (mdsCap.cappedTrU / 100) * empHPD;
    } else if (!c.isSap && c.hasStaffing) {
      acc.hasMdsData = true;
      acc.mdsBaseH += empHPD;
      acc.mdsAbsH += (result.cappedAbsU / 100) * empHPD;
      acc.mdsChH += (result.display.displayChU / 100) * empHPD;
      acc.mdsTrH += (result.cappedTrU / 100) * empHPD;
    } else if (c.isSap && !c.forecastSegments && dtStr >= MDS_EXTRACT_START) {
      acc.hasMdsData = true;
      acc.mdsBaseH += empHPD;
    }

    // I&O
    if (hasIO) {
      for (const seg of c.segments) {
        if (
          seg.jobNo &&
          ioJobcodes!.has(String(seg.jobNo).trim()) &&
          (seg.category === "chargeable" || seg.category === "generalOppty")
        ) {
          acc.totalIoChU += seg.util;
          acc.totalIoChH += (seg.util / 100) * empHPD;
        }
      }
    }
  }
};

/** Derive final TU/TO rates from accumulated bucket data */
const buildBucketResult = (acc: BucketAccumulators): BucketDisplayResult => {
  let uniqueActiveEmpDays = 0;
  for (const daySet of acc.uniqueEmpPerDay.values()) uniqueActiveEmpDays += daySet.size;
  let presenceEmpDays = 0;
  for (const daySet of acc.presenceEmpPerDay.values()) presenceEmpDays += daySet.size;

  const displayTU = computeDisplayTU(acc.activeEmpDays, acc.totalDisplayChU, acc.totalDisplayAbsU);
  const net = acc.activeEmpDays * 100 - acc.totalDisplayAbsU;
  const displayTO = net > 0 ? ((acc.totalDisplayChU + acc.totalTrU) / net) * 100 : 100;
  const availabilityRate = Math.max(0, 100 - displayTU);

  const realNetH = acc.realBaseH - acc.realAbsH - acc.realHolH;
  const realTU = realNetH > 0 ? (acc.realChH / realNetH) * 100 : 0;
  const realTO = realNetH > 0 ? ((acc.realChH + acc.realTrH) / realNetH) * 100 : 0;

  const sapNetH = acc.sapBaseH - acc.sapAbsH - acc.sapHolH;
  const sapTU = acc.hasSapData && sapNetH > 0 ? (acc.sapChH / sapNetH) * 100 : null;
  const sapTO = acc.hasSapData && sapNetH > 0 ? ((acc.sapChH + acc.sapTrH) / sapNetH) * 100 : null;

  const mdsNetH = acc.mdsBaseH - acc.mdsAbsH - acc.mdsHolH;
  const mdsTU = acc.hasMdsData && mdsNetH > 0 ? (acc.mdsChH / mdsNetH) * 100 : null;
  const mdsTO = acc.hasMdsData && mdsNetH > 0 ? ((acc.mdsChH + acc.mdsTrH) / mdsNetH) * 100 : null;

  return {
    displayTU,
    displayTO,
    availabilityRate,
    activeEmpDays: acc.activeEmpDays,
    uniqueActiveEmpDays,
    presenceEmpDays,
    displayChU: acc.totalDisplayChU,
    displayAbsU: acc.totalDisplayAbsU,
    displayTrU: acc.totalTrU,
    ioChU: acc.totalIoChU,
    ioChH: acc.totalIoChH,
    realBaseH: acc.realBaseH,
    realChH: acc.realChH,
    realAbsH: acc.realAbsH,
    realHolH: acc.realHolH,
    realTrH: acc.realTrH,
    realNetH,
    realTU,
    realTO,
    sapBaseH: acc.sapBaseH,
    sapChH: acc.sapChH,
    sapAbsH: acc.sapAbsH,
    sapHolH: acc.sapHolH,
    sapTrH: acc.sapTrH,
    sapNetH,
    sapTU,
    sapTO,
    hasSapData: acc.hasSapData,
    mdsBaseH: acc.mdsBaseH,
    mdsChH: acc.mdsChH,
    mdsAbsH: acc.mdsAbsH,
    mdsHolH: acc.mdsHolH,
    mdsTrH: acc.mdsTrH,
    mdsNetH,
    mdsTU,
    mdsTO,
    hasMdsData: acc.hasMdsData,
  };
};

/**
 * Compute display TU/TO/availability for a date range bucket using the dailyGrid.
 * Delegates to accumulateWeekendDay / accumulateHolidayDay / accumulateRegularDay
 * for each day type, then derives final rates via buildBucketResult.
 *
 * Returns null if the bucket is not covered by the dailyGrid.
 */
export const computeBucketFromGrid = (
  employees: Employee[],
  dailyGrid: Map<string, EmployeeDailyData> | null,
  calIndex: Map<string, number> | null,
  bStartStr: string,
  bEndStr: string,
  chargeableCombined: boolean,
  ioJobcodes?: Set<string> | null,
  useSapActuals?: boolean,
  calendarDays?: CalendarDay[] | null
): BucketDisplayResult | null => {
  if (!dailyGrid || !calIndex) return null;

  const acc = createBucketAccumulators();
  const bStart = new Date(bStartStr);
  const bEnd = new Date(bEndStr);
  const numDays = Math.round((bEnd.getTime() - bStart.getTime()) / 86400000);

  for (let d = 0; d < numDays; d++) {
    const dt = new Date(bStart);
    dt.setDate(dt.getDate() + d);
    const dow = dt.getDay();
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const calIdx = calIndex.get(dtStr);
    if (calIdx == null) continue;

    if (dow === 0 || dow === 6) {
      accumulateWeekendDay(employees, dailyGrid, calIdx, dtStr, acc, chargeableCombined);
      continue;
    }

    acc.covered = true;
    const calDay = calendarDays ? calendarDays[calIdx] : null;
    const isHoliday = calDay ? calDay.isHoliday : false;

    // Mode-independent presence tracking for stable FTE
    for (const emp of employees) {
      const isPresent =
        (!emp._arrivalDate || dtStr >= emp._arrivalDate) && (!emp._departureDate || dtStr <= emp._departureDate);
      if (isPresent) trackUniqueEmp(acc.presenceEmpPerDay, dtStr, getRealEmpId(emp));
    }

    if (isHoliday) {
      accumulateHolidayDay(employees, dailyGrid, calIdx, dtStr, acc, useSapActuals);
    } else {
      accumulateRegularDay(employees, dailyGrid, calIdx, dtStr, acc, chargeableCombined, useSapActuals, ioJobcodes);
    }
  }

  if (!acc.covered || (acc.activeEmpDays === 0 && acc.realBaseH === 0)) return null;
  return buildBucketResult(acc);
};
