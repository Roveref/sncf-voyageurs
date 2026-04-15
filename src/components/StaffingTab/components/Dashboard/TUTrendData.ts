import {
  computeDailyMetrics,
  consolidateAssignments,
  normalizePeriods,
  buildDailyGrid,
} from "../../utils/dataProcessing";
import { MS_PER_DAY, getHoursPerDay, CHARGEABLE_CATS, GO_CATS, ABSENCE_CATS, MDS_EXTRACT_START } from "../../constants";
import { getGradeTarget } from "../../constants/theme";
import {
  computeBucketFromGrid,
  processEmployeeDayForAggregate,
  isEmployeeActive,
  getSegmentScale,
} from "../../utils/aggregateCalc";
import { computeSapChH, computeMdsChargeableHours } from "../../utils/varianceEngine";
import { isFirstSplit, isLastSplit } from "../../utils/gradeSplitUtils";
import { countGradeTransitionsInRange } from "../../utils/turnoverUtils";
import { isHolidayEnabled } from "../../utils/dateUtils";
import { getEtpRatio } from "../../types";
import { getRealEmpId } from "../../utils/empIdUtils";
import type {
  Employee,
  CalendarDay,
  EmployeeDailyData,
  SapLookup,
  EmployeeMetadata,
  DailyCellSegment,
} from "../../types";

export const MONTHS_FR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Compute aggregate TU for a bucket using the EXACT same per-day loop as AggregateHeatmapStrip.
 * Iterates calendar days, processes each employee's grid cell, accumulates real hours.
 * Includes weekend SAP, holidays, grade-aware HPD — identical to AggHeatmapStrip's daily building.
 */
const computeAggTUFromGrid = (
  employees: Employee[],
  dailyGrid: Map<string, EmployeeDailyData>,
  calendar: CalendarDay[],
  calIndex: Map<string, number>,
  bStartStr: string,
  bEndStr: string,
  chargeableCombined: boolean,
  useSapActuals: boolean
): {
  realTU: number;
  realTO: number;
  realBaseH: number;
  realChH: number;
  realNetH: number;
  hasSapData: boolean;
} | null => {
  let realBaseH = 0,
    realChH = 0,
    realAbsH = 0,
    realHolH = 0,
    realTrH = 0,
    realGoH = 0;
  let hasSapData = false;
  let covered = false;

  const bStart = new Date(bStartStr);
  const bEnd = new Date(bEndStr);
  const numDays = Math.round((bEnd.getTime() - bStart.getTime()) / 86400000);

  const nextMonthStart = useSapActuals
    ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      })()
    : "";

  for (let d = 0; d < numDays; d++) {
    const dt = new Date(bStart);
    dt.setDate(dt.getDate() + d);
    const dow = dt.getDay();
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const calIdx = calIndex.get(dtStr);
    if (calIdx == null) continue;
    const calDay = calendar[calIdx];

    // ── Weekend: same logic as AggHeatmapStrip ──
    // Deduplicate by real empId to avoid double-counting grade-split virtual rows
    if (dow === 0 || dow === 6) {
      const weProcessed = new Set<string>();
      for (const emp of employees) {
        const realId = getRealEmpId(emp);
        if (weProcessed.has(realId)) continue;
        const empGrid = dailyGrid.get(emp.empId);
        const c = empGrid?.cells?.[calIdx];
        if (!c || !c.isSap || !c.segments || c.segments.length === 0) continue;
        weProcessed.add(realId);
        covered = true;
        hasSapData = true;
        const empHPD = getHoursPerDay(emp.grade);
        realBaseH += empHPD;
        for (const seg of c.segments) {
          const scale = getSegmentScale(seg.category, c, chargeableCombined);
          const scaledU = seg.util * scale;
          if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
            realChH += (scaledU * empHPD) / 100;
          } else if (ABSENCE_CATS.has(seg.category)) {
            realAbsH += (scaledU * empHPD) / 100;
          }
        }
      }
      continue;
    }

    // ── Holiday: same logic as AggHeatmapStrip ──
    if (calDay?.isHoliday) {
      if (useSapActuals && dtStr >= nextMonthStart) continue;
      for (const emp of employees) {
        const active = useSapActuals
          ? (!emp._arrivalDate || dtStr >= emp._arrivalDate) && (!emp._departureDate || dtStr <= emp._departureDate)
          : isEmployeeActive(false, dtStr, emp._arrivalDate, emp._departureDate, false, false, true);
        if (!active) continue;
        covered = true;
        const empHPD = getHoursPerDay(emp.grade);
        realBaseH += empHPD;
        realHolH += empHPD;
        const empGrid = dailyGrid.get(emp.empId);
        const c = empGrid?.cells?.[calIdx];
        if (c && c.isSap) hasSapData = true;
      }
      continue;
    }

    // ── Regular day: same logic as AggHeatmapStrip (processEmployeeDayForAggregate) ──
    for (const emp of employees) {
      const empGrid = dailyGrid.get(emp.empId);
      if (!empGrid) continue;
      const c = empGrid.cells[calIdx];
      if (!c || c.isWE) continue;

      const catMap = {},
        sapCatMap = {},
        forecastCatMap = {};
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
      covered = true;
      if (c.isSap) hasSapData = true;

      const etpR = getEtpRatio(emp._etpAdjustments, dtStr);
      const empHPD = getHoursPerDay(emp.grade);
      realBaseH += empHPD * etpR;
      realChH += ((result.display.displayChU * empHPD) / 100) * etpR;
      realAbsH += ((result.display.displayAbsU * empHPD) / 100) * etpR;
      realTrH += ((result.cappedTrU * empHPD) / 100) * etpR;
      realGoH += ((result.cappedGoU * empHPD) / 100) * etpR;
    }
  }

  if (!covered) return null;
  const realNetH = realBaseH - realAbsH - realHolH;
  const realTU = realNetH > 0 ? (realChH / realNetH) * 100 : 0;
  const realTO = realNetH > 0 ? ((realChH + realGoH + realTrH) / realNetH) * 100 : 0;
  return { realTU, realTO, realBaseH, realChH, realNetH, hasSapData };
};

/**
 * Compute the full date range from all employee assignments + SAP data.
 */
export const getFullDateRange = (employees: Employee[], sapLookup: SapLookup | null) => {
  let minDate: Date | null = null,
    maxDate: Date | null = null;
  for (const emp of employees) {
    for (const a of emp.assignments) {
      const s = new Date(a.startDate);
      const e = new Date(a.endDate);
      if (!minDate || s < minDate) minDate = s;
      if (!maxDate || e > maxDate) maxDate = e;
    }
  }
  if (sapLookup) {
    for (const empId of Object.keys(sapLookup)) {
      for (const dtStr of Object.keys(sapLookup[empId])) {
        const d = new Date(dtStr);
        if (!isNaN(d.getTime())) {
          if (!minDate || d < minDate) minDate = d;
          const dEnd = new Date(d);
          dEnd.setDate(dEnd.getDate() + 1);
          if (!maxDate || dEnd > maxDate) maxDate = dEnd;
        }
      }
    }
  }
  return { minDate, maxDate };
};

/** ISO week number */
export const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / MS_PER_DAY - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

/**
 * Generate time buckets based on granularity: day, week, 2week, halfmonth, month.
 */
export const generateBuckets = (start: Date, end: Date, granularity: string) => {
  const buckets: Array<{
    bStart: Date;
    bEnd: Date;
    label: string;
    _year: string;
    _isC2?: boolean;
    _monthIdx?: number;
  }> = [];
  const yr = (d: Date) => d.getFullYear().toString().slice(-2);
  const pad = (n: number) => String(n).padStart(2, "0");

  // Label format: "displayPart·YY" — the ·YY suffix ensures uniqueness across years.
  // The tick renderer strips everything from · onwards for display.
  // C2 labels use a leading space for halfmonth: " Month·YY"
  const tag = (display: string, d: Date) => `${display}·${yr(d)}`;

  if (granularity === "day") {
    const cur = new Date(start);
    while (cur < end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) {
        const next = new Date(cur);
        next.setDate(next.getDate() + 1);
        buckets.push({
          bStart: new Date(cur),
          bEnd: next,
          label: tag(`${pad(cur.getDate())}/${pad(cur.getMonth() + 1)}`, cur),
          _year: yr(cur),
          _monthIdx: cur.getMonth(),
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (granularity === "week") {
    const cur = new Date(start);
    const dow = cur.getDay();
    if (dow !== 1) cur.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow));
    while (cur < end) {
      const wEnd = new Date(cur);
      wEnd.setDate(wEnd.getDate() + 7);
      buckets.push({
        bStart: new Date(cur),
        bEnd: new Date(wEnd),
        label: tag(`S${pad(getISOWeek(cur))}`, cur),
        _year: yr(cur),
        _monthIdx: cur.getMonth(),
      });
      cur.setDate(cur.getDate() + 7);
    }
  } else if (granularity === "2week") {
    const cur = new Date(start);
    const dow = cur.getDay();
    if (dow !== 1) cur.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow));
    while (cur < end) {
      const wEnd = new Date(cur);
      wEnd.setDate(wEnd.getDate() + 14);
      const wk = getISOWeek(cur);
      buckets.push({
        bStart: new Date(cur),
        bEnd: new Date(wEnd),
        label: tag(`S${pad(wk)}-${pad(wk + 1)}`, cur),
        _year: yr(cur),
        _monthIdx: cur.getMonth(),
      });
      cur.setDate(cur.getDate() + 14);
    }
  } else if (granularity === "halfmonth") {
    // Always use full half-month boundaries so the same label always covers
    // the same date range regardless of the overall min/max data bounds.
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur < end) {
      const mid = new Date(cur.getFullYear(), cur.getMonth(), 16);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      // C1: 1st → 16th (full half, inclusive when start = 16th)
      if (mid >= start) {
        buckets.push({
          bStart: new Date(cur),
          bEnd: new Date(mid),
          label: tag(MONTHS_FR[cur.getMonth()], cur),
          _year: yr(cur),
          _isC2: false,
        });
      }
      // C2: 16th → 1st next month (full half)
      if (nextMonth > start && mid < end) {
        buckets.push({
          bStart: new Date(mid),
          bEnd: new Date(nextMonth),
          label: ` ${tag(MONTHS_FR[cur.getMonth()], cur)}`,
          _year: yr(cur),
          _isC2: true,
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    // month (default) — always full calendar months so the same label
    // always represents the same date range.
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur < end) {
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      buckets.push({
        bStart: new Date(cur),
        bEnd: new Date(nextMonth),
        label: tag(MONTHS_FR[cur.getMonth()], cur),
        _year: yr(cur),
        _monthIdx: cur.getMonth(),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return buckets;
};

/**
 * Check if an employee is present (even partially) in a bucket,
 * based on arrival/departure dates from metadata.
 * Returns false if the employee has departed before the bucket starts
 * or has not arrived by the bucket end.
 * For employees without metadata, falls back to their first assignment start date.
 */
export const isEmpPresentInBucket = (
  emp: Employee,
  employeeMetadata: Record<string, EmployeeMetadata> | null,
  bStartStr: string,
  bEndStr: string
) => {
  // Grade-split virtual rows have narrowed _arrivalDate/_departureDate — use them directly
  const arrival =
    emp._arrivalDate ||
    employeeMetadata?.[getRealEmpId(emp)]?.arrivalDate ||
    employeeMetadata?.[emp.empId]?.arrivalDate ||
    null;
  const departure =
    emp._departureDate ||
    employeeMetadata?.[getRealEmpId(emp)]?.departureDate ||
    employeeMetadata?.[emp.empId]?.departureDate ||
    null;
  if (departure && departure < bStartStr) return false;
  if (arrival && arrival >= bEndStr) return false;

  // If no arrival/departure info, use first assignment start as proxy
  if (!arrival && !departure && emp.assignments?.length) {
    const firstStart = emp.assignments.reduce((min: string | null, a: { startDate: string }) => {
      const s = a.startDate;
      return s && (!min || s < min) ? s : min;
    }, null);
    if (firstStart && firstStart >= bEndStr) return false;
  }
  return true;
};

/**
 * Build TU time-series from employee data, at the requested granularity.
 * Uses employeeMetadata to exclude employees not present in a given bucket
 * (arrived after / departed before), so the TU for a given bucket is stable
 * regardless of the timeline selection.
 */
export const buildTimePoints = (
  employees: Employee[],
  chargeableCombined: boolean,
  enabledHolidayDates: Set<string> | string[],
  sapLookup: SapLookup | null,
  granularity: string,
  heatmapMode = "utilization",
  ioJobcodes: Set<string> | null = null,
  employeeMetadata: Record<string, EmployeeMetadata> | null = null,
  useSapActuals = false,
  fullSapLookup: SapLookup | null = null
) => {
  // Use fullSapLookup (original, mode-independent) for date range so the chart X axis
  // stays consistent across All/SAP/MDS modes
  const { minDate, maxDate } = getFullDateRange(employees, fullSapLookup || sapLookup);
  if (!minDate || !maxDate) return [];

  // Snap start to Jan 1 of its year so the chart always shows full years
  // (needed for LY highlight to cover January even when data starts later)
  const start = new Date(minDate.getFullYear(), 0, 1);
  const end = new Date(maxDate);
  end.setHours(0, 0, 0, 0);

  const buckets = generateBuckets(start, end, granularity);
  const hasSap = !!sapLookup;

  // Compute MDS-only date range (assignments only, no SAP) to suppress forecast outside MDS coverage
  let mdsMaxDate: Date | null = null;
  for (const emp of employees) {
    for (const a of emp.assignments) {
      const e = new Date(a.endDate);
      if (!mdsMaxDate || e > mdsMaxDate) mdsMaxDate = e;
    }
  }

  // ── Build own calendar + dailyGrid for the full data range ──
  // Same mechanics as TU Timeline: buildDailyGrid produces cells with
  // forecastSegments, cappedChU, isSap etc., then computeBucketFromGrid
  // uses processEmployeeDayForAggregate to compute display TU per bucket.
  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  const enabledArr = enabledHolidayDates instanceof Set ? [...enabledHolidayDates] : enabledHolidayDates || [];
  const trendCalendar: CalendarDay[] = [];
  const cursor = new Date(start);
  for (let d = 0; d < totalDays; d++) {
    if (d > 0) cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    const isWE = dow === 0 || dow === 6;
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    const isHoliday = !isWE && isHolidayEnabled(dateStr, enabledArr);
    trendCalendar.push({
      date: new Date(cursor.getTime()),
      dow,
      isWE,
      dateStr,
      ts: cursor.getTime(),
      month: cursor.getMonth(),
      isHoliday,
    });
  }
  const trendGrid =
    trendCalendar.length > 0
      ? buildDailyGrid(
          employees,
          trendCalendar,
          sapLookup,
          chargeableCombined,
          enabledArr,
          new Set<string>(),
          0,
          undefined,
          useSapActuals ? "sap" : undefined
        )
      : null;
  const calIndex = new Map(trendCalendar.map((c, i) => [c.dateStr, i]));

  const hasIO = ioJobcodes && ioJobcodes.size > 0;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const result = buckets.map(({ bStart, bEnd, label, _year, _isC2, _monthIdx }, idx: number) => {
    let totalCh = 0,
      totalNet = 0,
      totalTr = 0;
    let sapCh = 0,
      sapNet = 0;
    let presentCount = 0; // number of employees present in this bucket
    const presentRealIds = new Set<string>(); // deduplicate grade-split virtual rows
    // Per-grade breakdown for grade-capped infinite capacity
    const gradeBreakdown: Record<string, { ch: number; net: number }> = {};
    let hasActualData = false; // true if at least one employee has SAP data in this bucket
    // Variance: SAP and MDS hours computed on the exact same employee×day pairs
    let varSapCh = 0,
      varSapNet = 0; // SAP hours for days with both SAP and MDS
    let varMdsCh = 0,
      varMdsNet = 0; // MDS hours for those same days
    let hasBothData = false;

    const bStartStr = `${bStart.getFullYear()}-${pad2(bStart.getMonth() + 1)}-${pad2(bStart.getDate())}`;
    const bEndStr = `${bEnd.getFullYear()}-${pad2(bEnd.getMonth() + 1)}-${pad2(bEnd.getDate())}`;

    for (const emp of employees) {
      // Skip employees not present in this bucket (departed before or not arrived yet)
      if (!isEmpPresentInBucket(emp, employeeMetadata, bStartStr, bEndStr)) continue;
      presentCount++;
      presentRealIds.add(getRealEmpId(emp));

      const periods = emp._periods || normalizePeriods(emp._consolidated || consolidateAssignments(emp.assignments));
      const m = computeDailyMetrics(periods, bStart, bEnd, enabledHolidayDates, {
        chargeableCombined,
        etpAdjustments: emp._etpAdjustments,
      });
      const empCh = m.chargeableH + m.generalOpptyH;
      totalCh += empCh;
      totalNet += m.netH;
      totalTr += m.trainingH || 0;

      // Accumulate per-grade breakdown
      const g = emp.grade || "Unknown";
      if (!gradeBreakdown[g]) gradeBreakdown[g] = { ch: 0, net: 0 };
      gradeBreakdown[g].ch += empCh;
      gradeBreakdown[g].net += m.netH;

      if (hasSap && sapLookup[emp.empId]) {
        const empSap = sapLookup[emp.empId];
        const numDays = Math.round((bEnd.getTime() - bStart.getTime()) / MS_PER_DAY);
        let empSapCh = 0,
          empSapNet = 0,
          empHasSapDay = false;
        const baseHPD = getHoursPerDay(emp.grade);
        const etpAdj = emp._etpAdjustments;
        // Per-day variance: track SAP and MDS on the same days
        let empVarSapCh = 0,
          empVarMdsCh = 0,
          empVarMdsAbs = 0,
          empVarSapNet = 0,
          empVarMdsNet = 0;
        for (let d = 0; d < numDays; d++) {
          const dt = new Date(bStart);
          dt.setDate(dt.getDate() + d);
          const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
          const dtStr = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
          const dayData = empSap[dtStr];
          // Skip weekends without SAP data; include weekends WITH SAP data (e.g. travel)
          if (isWeekend && !dayData) continue;
          if (dayData) {
            empHasSapDay = true;
            const empHPD = baseHPD * getEtpRatio(etpAdj, dtStr);
            empSapNet += empHPD;
            let daySapCh = 0;
            if (dayData.categories) {
              daySapCh =
                (dayData.categories.chargeable || 0) +
                (chargeableCombined ? dayData.categories["generalOppty"] || dayData.categories.go || 0 : 0);
            }
            empSapCh += daySapCh;
            // Check if this same day has MDS data
            const ts = dt.getTime();
            const dayMdsSegs: DailyCellSegment[] = [];
            for (const p of periods) {
              if (ts >= p.start && ts <= p.end) {
                dayMdsSegs.push({
                  category: p.category,
                  util: p.util,
                  name: (p as { name?: string }).name || "",
                  jobNo: (p as { jobNo?: string }).jobNo || null,
                });
              }
            }
            if (dayMdsSegs.length > 0) {
              // This day has both SAP and MDS — include in variance
              empVarSapCh += daySapCh;
              empVarSapNet += empHPD;
              empVarMdsCh += computeMdsChargeableHours(dayMdsSegs, empHPD, chargeableCombined);
              // Compute MDS absence for net hours
              let dayMdsAbs = 0;
              for (const seg of dayMdsSegs) {
                if (ABSENCE_CATS.has(seg.category)) dayMdsAbs += seg.util;
              }
              empVarMdsNet += empHPD - (Math.min(dayMdsAbs, 100) * empHPD) / 100;
            }
          }
        }
        if (empHasSapDay) {
          hasActualData = true;
          sapCh += empSapCh;
          sapNet += empSapNet;
          // Variance: only days where this employee has both SAP and MDS
          if (empVarSapNet > 0) {
            hasBothData = true;
            varSapCh += empVarSapCh;
            varSapNet += empVarSapNet;
            varMdsCh += empVarMdsCh;
            varMdsNet += empVarMdsNet;
          }
        }
      }
    }

    let forecast: number | null = null;
    let actual: number | null = null;
    let delta: number | null = null;
    // Debug info from grid computation (for tooltip)
    let _gridActiveEmpDays = 0,
      _gridUniqueActiveEmpDays = 0,
      _gridDisplayChU = 0,
      _gridDisplayAbsU = 0,
      _gridDisplayTrU = 0;

    // Compute grid once for this bucket (reused for forecast + actual + I&O + FTE)
    // Compute grid once for this bucket (reused for forecast + actual + I&O + FTE)
    const grid =
      presentCount > 0 && trendGrid
        ? computeBucketFromGrid(
            employees,
            trendGrid,
            calIndex,
            bStartStr,
            bEndStr,
            chargeableCombined,
            ioJobcodes,
            useSapActuals,
            trendCalendar
          )
        : null;

    // Always read activeEmpDays from grid (needed for FTE computation in all modes)
    if (grid) {
      _gridActiveEmpDays = grid.activeEmpDays;
      _gridUniqueActiveEmpDays = grid.uniqueActiveEmpDays;
    }

    if (heatmapMode === "variance_hours") {
      if (hasBothData && varSapNet > 0) {
        delta = parseFloat((varSapCh - varMdsCh).toFixed(1));
      }
    } else if (heatmapMode === "variance_hours_pct") {
      if (hasBothData && varSapNet > 0 && varMdsNet > 0) {
        const sTU = (varSapCh / varSapNet) * 100;
        const fTU = (varMdsCh / varMdsNet) * 100;
        delta = parseFloat((sTU - fTU).toFixed(1));
      }
    } else {
      const bucketInMdsRange = mdsMaxDate ? bStart < mdsMaxDate : false;
      const isMdsAvailable = bStartStr >= MDS_EXTRACT_START;
      if (isMdsAvailable && bucketInMdsRange && presentCount > 0) {
        if (grid) {
          _gridActiveEmpDays = grid.activeEmpDays;
          _gridUniqueActiveEmpDays = grid.uniqueActiveEmpDays;
          _gridDisplayChU = grid.displayChU;
          _gridDisplayAbsU = grid.displayAbsU;
          _gridDisplayTrU = grid.displayTrU;
          // Use independent MDS pipeline for forecast curve (not contaminated by SAP)
          const useMdsTU = grid.mdsTU != null;
          switch (heatmapMode) {
            case "to":
              forecast = useMdsTU ? grid.mdsTO : grid.realTO;
              break;
            case "availability": {
              const tu = useMdsTU ? grid.mdsTU! : grid.realTU;
              const netH = useMdsTU ? grid.mdsNetH : grid.realNetH;
              forecast = netH > 0 ? Math.max(0, 100 - tu) : 0;
              break;
            }
            default:
              forecast = useMdsTU ? grid.mdsTU : grid.realTU;
              break;
          }
        } else if (totalNet > 0 && totalCh > 0) {
          const tuVal = (totalCh / totalNet) * 100;
          switch (heatmapMode) {
            case "to":
              forecast = ((totalCh + totalTr) / totalNet) * 100;
              break;
            case "availability":
              forecast = Math.max(0, 100 - tuVal);
              break;
            default:
              forecast = tuVal;
              break;
          }
        }
      }
      // Actual SAP: use computeAggTUFromGrid (same per-day loop as AggHeatmapStrip)
      const aggTU = trendGrid
        ? computeAggTUFromGrid(
            employees,
            trendGrid,
            trendCalendar,
            calIndex,
            bStartStr,
            bEndStr,
            chargeableCombined,
            useSapActuals
          )
        : null;
      if (aggTU && aggTU.hasSapData) {
        switch (heatmapMode) {
          case "to":
            actual = aggTU.realTO;
            break;
          case "availability":
            actual = aggTU.realNetH > 0 ? Math.max(0, 100 - aggTU.realTU) : null;
            break;
          default:
            actual = aggTU.realTU;
            break;
        }
      }
    }

    // I&O TU: from grid segments using real hours
    let ioTU: number | null = null;
    if (hasIO && grid && grid.realNetH > 0) {
      ioTU = (grid.ioChH / grid.realNetH) * 100;
    }
    // Halfmonth: position C1 at 1/3, C2 at 2/3 within the month (year*12+month units)
    // Other granularities: sequential index (re-indexed after year filtering for uniform spacing)
    const _xPos =
      _isC2 === false
        ? bStart.getFullYear() * 12 + bStart.getMonth() + 1 / 3
        : _isC2 === true
          ? bStart.getFullYear() * 12 + bStart.getMonth() + 2 / 3
          : idx;
    // Grid debug: use real hours from grid (per-grade HPD, holiday-aware)
    const _totalH = grid ? grid.realBaseH : 0;
    const _absH = grid ? grid.realAbsH : 0;
    const _holH = grid ? grid.realHolH : 0;
    const _netH = grid ? grid.realNetH : 0;
    const _chH = grid ? grid.realChH : 0;
    const _trH = grid ? grid.realTrH : 0;
    // Derive FTE from presence (arrival/departure) — fully mode-independent, no grid dependency
    let bucketWorkDays = 0;
    {
      const c = new Date(bStart);
      while (c < bEnd) {
        const dw = c.getDay();
        if (dw !== 0 && dw !== 6) bucketWorkDays++;
        c.setDate(c.getDate() + 1);
      }
    }
    // Count presence-days weighted by ETP ratio: for each working day, sum ETP ratios of present employees
    let presenceDays = 0;
    {
      const c = new Date(bStart);
      while (c < bEnd) {
        const dw = c.getDay();
        if (dw !== 0 && dw !== 6) {
          const dtStr = `${c.getFullYear()}-${pad2(c.getMonth() + 1)}-${pad2(c.getDate())}`;
          for (const emp of employees) {
            const isPresent =
              (!emp._arrivalDate || dtStr >= emp._arrivalDate) && (!emp._departureDate || dtStr <= emp._departureDate);
            if (isPresent) presenceDays += getEtpRatio(emp._etpAdjustments, dtStr);
          }
        }
        c.setDate(c.getDate() + 1);
      }
    }
    const gridFte = bucketWorkDays > 0 && presenceDays > 0 ? presenceDays / bucketWorkDays : presentRealIds.size;

    // Bucket-level turnover churn: (arrivals + departures in bucket) / presentRealIds × 100
    // Use real metadata dates, NOT grade-split narrowed dates (grade transitions ≠ turnover)
    // Also count grade transitions within the bucket
    let turnoverChurn: number | null = null;
    let _bucketArrivals = 0,
      _bucketDepartures = 0,
      _bucketGradeChanges = 0;
    if (presentRealIds.size > 0) {
      const bArrivalIds = new Set<string>();
      const bDepartureIds = new Set<string>();
      const presentEmps: Employee[] = [];
      for (const emp of employees) {
        if (!isEmpPresentInBucket(emp, employeeMetadata, bStartStr, bEndStr)) continue;
        presentEmps.push(emp);
        const realId = getRealEmpId(emp);
        // Count arrivals/departures in bucket
        // For grade splits: only count arrival on first split (g0), departure on last split
        if (
          (!emp._isGradeSplit || isFirstSplit(emp)) &&
          emp._arrivalDate &&
          !bArrivalIds.has(realId) &&
          emp._arrivalDate >= bStartStr &&
          emp._arrivalDate < bEndStr
        ) {
          bArrivalIds.add(realId);
        }
        if (
          (!emp._isGradeSplit || isLastSplit(emp)) &&
          emp._departureDate &&
          !bDepartureIds.has(realId) &&
          emp._departureDate >= bStartStr &&
          emp._departureDate < bEndStr
        ) {
          bDepartureIds.add(realId);
        }
      }
      _bucketGradeChanges = countGradeTransitionsInRange(presentEmps, bStartStr, bEndStr);
      _bucketArrivals = bArrivalIds.size;
      _bucketDepartures = bDepartureIds.size;
      turnoverChurn = presentRealIds.size > 0 ? (_bucketDepartures / presentRealIds.size) * 100 : 0;
    }

    return {
      label,
      forecast,
      actual,
      target: null,
      delta,
      fte: gridFte,
      ioTU,
      turnoverChurn,
      _bucketArrivals,
      _bucketDepartures,
      _bucketGradeChanges,
      _mStart: bStart.getTime(),
      _mEnd: bEnd.getTime(),
      _year,
      _isC2,
      _xPos,
      _monthIdx,
      _totalCh: totalCh,
      _totalNet: totalNet,
      _totalH,
      _netH,
      _chH,
      _absH,
      _holH,
      _trH,
      _gridActiveEmpDays,
      _presentCount: presentRealIds.size,
      _gradeBreakdown: gradeBreakdown,
    };
  });

  return result;
};

/**
 * Compute per-bucket theoretical TU as a weighted average of grade targets,
 * prorated by each employee's FTE in the bucket.
 */
export const buildTargetSeries = (
  employees: Employee[],
  employeeMetadata: Record<string, EmployeeMetadata> | null,
  sapLookup: SapLookup | null,
  granularity: string
) => {
  const { minDate, maxDate } = getFullDateRange(employees, sapLookup);
  if (!minDate || !maxDate) return new Map<string, number>();

  // Snap start to Jan 1 of its year (aligned with buildTimePoints)
  const start = new Date(minDate.getFullYear(), 0, 1);
  const end = new Date(maxDate);
  end.setHours(0, 0, 0, 0);
  const buckets = generateBuckets(start, end, granularity);
  const metaMap = employeeMetadata || {};

  const targetByLabel = new Map<string, number>();
  for (const { bStart, bEnd, label } of buckets) {
    const bucketDays = Math.round((bEnd.getTime() - bStart.getTime()) / MS_PER_DAY);
    const bStartStr = `${bStart.getFullYear()}-${String(bStart.getMonth() + 1).padStart(2, "0")}-${String(bStart.getDate()).padStart(2, "0")}`;
    const bEndStr = `${bEnd.getFullYear()}-${String(bEnd.getMonth() + 1).padStart(2, "0")}-${String(bEnd.getDate()).padStart(2, "0")}`;
    let weightedTarget = 0,
      totalFte = 0;

    for (const emp of employees) {
      // Use employee's own arrival/departure (handles grade-split virtual rows), fallback to metadata
      const meta = metaMap[getRealEmpId(emp)] || metaMap[emp.empId];
      const arrival = emp._arrivalDate || meta?.arrivalDate || null;
      const departure = emp._departureDate || meta?.departureDate || null;
      let fte = 1;
      if ((arrival || departure) && bucketDays > 0) {
        const presStart = arrival && arrival > bStartStr ? arrival : bStartStr;
        const presEnd = departure && departure < bEndStr ? departure : bEndStr;
        if (presStart >= presEnd) continue; // not present in this bucket
        const overlapDays = Math.round((new Date(presEnd).getTime() - new Date(presStart).getTime()) / MS_PER_DAY);
        fte = Math.min(1, overlapDays / bucketDays);
      }
      const target = getGradeTarget(emp.grade);
      weightedTarget += target * fte;
      totalFte += fte;
    }

    targetByLabel.set(label, totalFte > 0 ? parseFloat((weightedTarget / totalFte).toFixed(1)) : 0);
  }
  return targetByLabel;
};

/**
 * Compute day-precise x-positions for the highlight zone edges.
 * Interpolates within buckets so the highlight doesn't snap to bucket centers.
 */
/** TU trend data point (output of buildTimePoints). Caller adds _xPos. */
export interface TrendPoint {
  _xPos: number;
  _mStart: number;
  _mEnd: number;
  _year: string;
  _monthIdx?: number;
  _isC2?: boolean;
  label: string;
  [key: string]: unknown;
}

export const findSelectionXPos = (points: TrendPoint[], timelineStart: Date | string, timelineEnd: Date | string) => {
  if (points.length === 0) return { selStartXPos: null, selEndXPos: null };

  const selS = new Date(timelineStart).setHours(0, 0, 0, 0);
  const selE = new Date(timelineEnd).setHours(0, 0, 0, 0);

  // Compute left/right x-edges of bucket i from neighboring _xPos values
  const edges = (i: number): [number, number] => {
    const x = points[i]._xPos;
    const gap = points.length > 1 ? (i > 0 ? x - points[i - 1]._xPos : points[1]._xPos - x) : 1;
    const prevX = i > 0 ? points[i - 1]._xPos : x - gap;
    const nextX = i < points.length - 1 ? points[i + 1]._xPos : x + gap;
    return [(prevX + x) / 2, (x + nextX) / 2];
  };

  let selStartXPos: number | null = null;
  let selEndXPos: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const { _mStart, _mEnd } = points[i];
    const [leftX, rightX] = edges(i);
    const bandW = rightX - leftX;

    // Start position: first bucket that extends past selS
    if (selStartXPos == null && _mEnd > selS) {
      if (selS <= _mStart) {
        selStartXPos = leftX;
      } else {
        const frac = _mEnd - _mStart > 0 ? (selS - _mStart) / (_mEnd - _mStart) : 0;
        selStartXPos = leftX + frac * bandW;
      }
    }

    // End position: keep updating for every bucket that overlaps selE
    if (_mStart < selE) {
      if (selE >= _mEnd) {
        selEndXPos = rightX;
      } else {
        const frac = _mEnd - _mStart > 0 ? (selE - _mStart) / (_mEnd - _mStart) : 1;
        selEndXPos = leftX + frac * bandW;
      }
    }
  }

  return { selStartXPos, selEndXPos };
};

/**
 * Inverse of findSelectionXPos: convert an x-axis position back to a YYYY-MM-DD date string.
 * Interpolates within the bucket that contains the given xPos.
 */
export const xPosToDate = (xPos: number, points: TrendPoint[]): string | null => {
  if (points.length === 0) return null;

  const edges = (i: number): [number, number] => {
    const x = points[i]._xPos;
    const gap = points.length > 1 ? (i > 0 ? x - points[i - 1]._xPos : points[1]._xPos - x) : 1;
    const prevX = i > 0 ? points[i - 1]._xPos : x - gap;
    const nextX = i < points.length - 1 ? points[i + 1]._xPos : x + gap;
    return [(prevX + x) / 2, (x + nextX) / 2];
  };

  for (let i = 0; i < points.length; i++) {
    const [leftX, rightX] = edges(i);
    if (xPos >= leftX && xPos <= rightX) {
      const bandW = rightX - leftX;
      const frac = bandW > 0 ? (xPos - leftX) / bandW : 0;
      const ts = points[i]._mStart + frac * (points[i]._mEnd - points[i]._mStart);
      const d = new Date(ts);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // xPos is outside all buckets — clamp to first/last bucket edge
  if (xPos <= points[0]._xPos) {
    const d = new Date(points[0]._mStart);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const last = points[points.length - 1];
  const d = new Date(last._mEnd);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
