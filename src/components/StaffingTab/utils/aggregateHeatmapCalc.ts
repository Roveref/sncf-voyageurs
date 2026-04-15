/**
 * Pure computation extracted from AggregateHeatmapStrip's useMemo.
 * No React dependencies — can be tested and reused independently.
 */
import {
  MS_PER_DAY,
  getHoursPerDay,
  MDS_EXTRACT_START,
  CHARGEABLE_CATS,
  GO_CATS,
  ABSENCE_CATS,
  MONTHS_EN,
} from "../constants";
import {
  processEmployeeDayForAggregate,
  isEmployeeActive,
  computeVarianceRate,
  getSegmentScale,
} from "./aggregateCalc";
import { getEtpRatio, Employee, CalendarDay } from "../types";
import { getRealEmpId } from "./empIdUtils";
import { computeSapChH, computeMdsChargeableHours } from "./varianceEngine";
import { getHeatmapStyle, getGradeTarget } from "../constants/theme";
import { getSapWallColor } from "./sapUtils";
import { computeTuRate, computeToRate } from "./calcPrimitives";

export interface AggregateHeatmapCalcParams {
  employees: Employee[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  calendarProp: CalendarDay[];
  dailyGrid: Map<string, any>;
  granularity: string;
  chargeableCombined: boolean;
  theoreticalTU: number | undefined;
  useSapActuals: boolean;
}

/** A single cell (day, week, 2-week, half-month, or month bucket) returned by computeAggregateHeatmapCells. */
export interface AggregateBucketCell {
  fill: string;
  label: string;
  span: number;
  isWeekend?: boolean;
  monthStart?: boolean;
  startDate?: Date;
  endDate?: Date;
  total?: number;
  cappedTotal?: number;
  tuRate?: number;
  toRate?: number;
  absRate?: number;
  goRate?: number;
  displayTuRate?: number;
  catBreakdown?: { category: string; avg: number }[];
  sapCatBreakdown?: { category: string; avg: number }[] | null;
  forecastCatBreakdown?: { category: string; avg: number }[] | null;
  workDays?: number;
  _calDays?: number;
  theoTU?: number;
  potTU?: number;
  isSap?: boolean;
  isFullSap?: boolean;
  hasStaffing?: boolean;
  isForcedAbsence?: boolean;
  isInactive?: boolean;
  forecastTuRate?: number;
  forecastTuRateBucket?: number | null;
  varianceRate?: number | null;
  varianceHours?: number | null;
  sapChHours?: number | null;
  forecastChHours?: number | null;
  sapDayCount?: number;
  avgSapEmpCount?: number;
  avgForecastEmpCount?: number;
  totalSapEmpDays?: number;
  activeEmpDays?: number;
  bucketRealBaseH?: number;
  bucketRealChH?: number;
  bucketRealAbsH?: number;
  bucketRealHolH?: number;
  bucketRealGoH?: number;
  bucketRealTrH?: number;
  sapTuRate?: number | null;
  [key: string]: unknown;
}

export interface AggregateHeatmapCalcResult {
  cells: AggregateBucketCell[] | null;
  sapWallMonthData: { idx: number; frac: number; color: string } | null;
}

/** Internal per-day aggregate computed in the fast path */
interface DailyAggregateDay {
  date: Date;
  dow: number;
  isWE: boolean;
  isHoliday?: boolean;
  isInactive?: boolean;
  sumTotal: number;
  sumCappedTotal: number;
  catMap: Record<string, number>;
  sapCatMap: Record<string, number>;
  forecastCatMap: Record<string, number>;
  sapEmpCount: number;
  forecastEmpCount?: number;
  activeN: number;
  monthStart: boolean;
  tuRate: number;
  toRate: number;
  absRate: number;
  goRate: number;
  sumChU: number;
  sumGoU: number;
  sumTrU: number;
  sumAbsU: number;
  displayChU?: number;
  displayAbsU?: number;
  empDayData: { netU: number; chU: number }[];
  isSap: boolean;
  hasStaffing: boolean;
  isForcedAbsence?: boolean;
  forecastTuRate: number;
  sapActualChU: number;
  sapForecastChU: number;
  sapActualAbsU: number;
  sapForecastAbsU: number;
  sapActualChH?: number;
  sapForecastChH?: number;
  sapWithMdsCount?: number;
  daySapPipeChH: number;
  dayMdsChH: number;
  dayMdsBaseH: number;
  dayRealBaseH: number;
  dayRealChH: number;
  dayRealAbsH: number;
  dayRealHolH: number;
  dayRealGoH: number;
  dayRealTrH: number;
  workDays?: number;
}

const fmtDayMonth = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function computeAggregateHeatmapCells(params: AggregateHeatmapCalcParams): AggregateHeatmapCalcResult {
  const {
    employees,
    timelineStart,
    timelineEnd,
    calendarProp,
    dailyGrid,
    granularity,
    chargeableCombined,
    theoreticalTU,
    useSapActuals,
  } = params;

  if (!employees || employees.length === 0) return { cells: null, sapWallMonthData: null };
  const start = new Date(timelineStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(timelineEnd);
  end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  if (totalDays <= 0) return { cells: null, sapWallMonthData: null };

  const n = employees.length;

  // SAP mode M+1 cutoff: compute next month start once
  const nextMonthStart = useSapActuals
    ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      })()
    : "";
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Build the daily aggregate array — fast path uses pre-computed dailyGrid
  const daily: DailyAggregateDay[] = [];

  if (dailyGrid && calendarProp && calendarProp.length === totalDays && dailyGrid.size > 0) {
    // ── Fast path: sum pre-computed cells from buildDailyGrid ──
    let prevMonth = -1;
    for (let d = 0; d < totalDays; d++) {
      const { date, dow, isWE, month, dateStr: calDateStr, isHoliday: calIsHoliday } = calendarProp[d];
      const monthStart = prevMonth !== -1 && month !== prevMonth;
      const isMdsAvailable = calDateStr >= MDS_EXTRACT_START;
      prevMonth = month;

      if (isWE) {
        // Weekend SAP data: accumulate into variance pipeline AND display metrics
        let weSapPipeChH = 0,
          weMdsChH = 0,
          weMdsBaseH = 0,
          weAnySap = false;
        let weActiveN = 0,
          weSumChU = 0,
          weSumAbsU = 0,
          weSumTotal = 0,
          weSapEmpCount = 0;
        let weRealBaseH = 0,
          weRealChH = 0,
          weRealAbsH = 0;
        const weCatMap: Record<string, number> = {};
        const weSapCatMap: Record<string, number> = {};
        const weProcessed = new Set<string>();
        for (const emp of employees) {
          const realId = getRealEmpId(emp);
          if (weProcessed.has(realId)) continue;
          const empGrid = dailyGrid.get(emp.empId);
          const c = empGrid?.cells?.[d];
          if (!c || !c.isSap || !c.segments || c.segments.length === 0) continue;
          weProcessed.add(realId);
          weAnySap = true;
          weActiveN++;
          weSapEmpCount++;
          const empHPD = getHoursPerDay(emp.grade);
          weRealBaseH += empHPD;
          // Display metrics from weekend SAP segments
          for (const seg of c.segments) {
            const scale = getSegmentScale(seg.category, c, chargeableCombined);
            const scaledU = seg.util * scale;
            weSapCatMap[seg.category] = (weSapCatMap[seg.category] || 0) + scaledU;
            weCatMap[seg.category] = (weCatMap[seg.category] || 0) + scaledU;
            if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
              weSumChU += scaledU;
              weRealChH += (scaledU * empHPD) / 100;
            } else if (ABSENCE_CATS.has(seg.category)) {
              weSumAbsU += scaledU;
              weRealAbsH += (scaledU * empHPD) / 100;
            }
            weSumTotal += scaledU;
          }
          // Variance pipeline
          if (isMdsAvailable) {
            weSapPipeChH += computeSapChH(c.segments, c.chScale ?? 1, empHPD, chargeableCombined);
            if (c.forecastSegments) {
              weMdsBaseH += empHPD;
              weMdsChH += computeMdsChargeableHours(c.forecastSegments, empHPD, chargeableCombined);
            } else {
              weMdsBaseH += empHPD;
            }
          }
        }
        daily.push({
          date,
          dow,
          isWE: true,
          sumTotal: weSumTotal,
          sumCappedTotal: weSumTotal,
          catMap: weCatMap,
          sapCatMap: weSapCatMap,
          forecastCatMap: {},
          sapEmpCount: weSapEmpCount,
          activeN: weActiveN,
          monthStart,
          tuRate: 0,
          toRate: 0,
          absRate: weSumAbsU,
          goRate: 0,
          sumChU: weSumChU,
          sumGoU: 0,
          sumTrU: 0,
          sumAbsU: weSumAbsU,
          empDayData: [],
          isSap: weAnySap,
          hasStaffing: weAnySap,
          forecastTuRate: 0,
          sapActualChU: 0,
          sapForecastChU: 0,
          sapActualAbsU: 0,
          sapForecastAbsU: 0,
          daySapPipeChH: weSapPipeChH,
          dayMdsChH: weMdsChH,
          dayMdsBaseH: weMdsBaseH,
          dayRealBaseH: weRealBaseH,
          dayRealChH: weRealChH,
          dayRealAbsH: weRealAbsH,
          dayRealHolH: 0,
          dayRealGoH: 0,
          dayRealTrH: 0,
        });
        continue;
      }

      let sumTotal = 0,
        sumCappedTotal = 0;
      let sumAbsU = 0,
        sumChU = 0,
        sumGoU = 0,
        sumTrU = 0,
        sumRawGoU = 0;
      let displayChU = 0,
        displayAbsU = 0; // same logic as modal: substitute SAP with MDS forecast
      const catMap: Record<string, number> = {};
      const sapCatMap: Record<string, number> = {};
      const forecastCatMap: Record<string, number> = {};
      let sapEmpCount = 0;
      let activeN = 0; // employees with actual data this day (for denominator)
      const empDayData: { netU: number; chU: number }[] = [];
      let anySap = false;
      let dayHasStaffing = false;
      let fSumAbsU = 0,
        fSumChU = 0;
      let sapActualChU = 0,
        sapForecastChU = 0;
      let sapActualAbsU = 0,
        sapForecastAbsU = 0;
      let sapActualChH = 0,
        sapForecastChH = 0; // hours (per-employee HPD)
      let sapWithMdsCount = 0;
      let forecastEmpCount = 0;
      // Real hours accumulators (per-employee HPD) — mirrors handlePeriodClick in StaffingTab
      let dayRealBaseH = 0,
        dayRealChH = 0,
        dayRealAbsH = 0,
        dayRealTrH = 0,
        dayRealGoH = 0,
        dayRealHolH = 0;
      // Independent pipeline accumulators (mirrors handlePeriodClick / computeBucketFromGrid)
      let daySapPipeChH = 0; // SAP pipeline: chargeable hours for all isSap employees
      let dayMdsChH = 0,
        dayMdsBaseH = 0;
      let forcedAbsenceCount = 0;

      // ── Holiday: mirror modal's explicit handling (check arrival/departure, track holH separately) ──
      if (calIsHoliday) {
        // SAP mode M+1: holidays don't count — treat as empty day
        if (useSapActuals && calDateStr >= nextMonthStart) {
          daily.push({
            date,
            dow,
            isWE: false,
            sumTotal: 0,
            sumCappedTotal: 0,
            catMap: {},
            sapCatMap: {},
            forecastCatMap: {},
            sapEmpCount: 0,
            activeN: 0,
            monthStart,
            tuRate: 0,
            toRate: 0,
            absRate: 0,
            goRate: 0,
            sumChU: 0,
            sumGoU: 0,
            sumTrU: 0,
            sumAbsU: 0,
            empDayData: [],
            isSap: false,
            hasStaffing: false,
            forecastTuRate: 0,
            sapActualChU: 0,
            sapForecastChU: 0,
            sapActualAbsU: 0,
            sapForecastAbsU: 0,
            isHoliday: true,
            workDays: 0,
            dayRealBaseH: 0,
            dayRealChH: 0,
            dayRealAbsH: 0,
            dayRealTrH: 0,
            dayRealGoH: 0,
            dayRealHolH: 0,
            daySapPipeChH: 0,
            dayMdsChH: 0,
            dayMdsBaseH: 0,
          });
          continue;
        }
        let holidayActive = 0;
        for (const emp of employees) {
          const active = useSapActuals
            ? (!emp._arrivalDate || calDateStr >= emp._arrivalDate) &&
              (!emp._departureDate || calDateStr <= emp._departureDate)
            : isEmployeeActive(false, calDateStr, emp._arrivalDate, emp._departureDate, false, false, true);
          empDayData.push({ netU: 0, chU: 0 });
          if (!active) continue;
          holidayActive++;
          const empHPD = getHoursPerDay(emp.grade);
          dayRealBaseH += empHPD;
          dayRealHolH += empHPD;
          // Holiday with SAP data: feed variance pipelines (real activity on that day)
          const empGrid = dailyGrid.get(emp.empId);
          const c = empGrid?.cells?.[d];
          if (c && c.isSap && c.segments && c.segments.length > 0) {
            daySapPipeChH += computeSapChH(c.segments, c.chScale ?? 1, empHPD, chargeableCombined);
            // MDS side
            if (c.forecastSegments) {
              dayMdsBaseH += empHPD;
              dayMdsChH += computeMdsChargeableHours(c.forecastSegments, empHPD, chargeableCombined);
            } else if (calDateStr >= MDS_EXTRACT_START) {
              dayMdsBaseH += empHPD;
              // No forecastSegments → bench (0% chargeable)
            }
            anySap = true;
          }
        }
        activeN = holidayActive;
        catMap["holiday"] = 100 * holidayActive;
        forecastCatMap["holiday"] = 100 * holidayActive;
        displayAbsU = 100 * holidayActive;
        sumAbsU = 100 * holidayActive;
        sumTotal = 100 * holidayActive;
        sumCappedTotal = 100 * holidayActive;
        forecastEmpCount = holidayActive;
        if (useSapActuals && holidayActive > 0) {
          sapEmpCount = holidayActive;
          anySap = true;
        }
        dayHasStaffing = holidayActive > 0;
      } else {
        // ── Regular day: process through processEmployeeDayForAggregate ──
        for (const emp of employees) {
          const empGrid = dailyGrid.get(emp.empId);
          if (!empGrid) {
            empDayData.push({ netU: 0, chU: 0 });
            continue;
          }
          const c = empGrid.cells[d];
          if (!c || c.isWE) {
            empDayData.push({ netU: 0, chU: 0 });
            continue;
          }

          if (c.isSap) {
            anySap = true;
            sapEmpCount++;
          }
          if (c.hasStaffing) dayHasStaffing = true;
          if (c.isForcedAbsence) forcedAbsenceCount++;

          const result = processEmployeeDayForAggregate(
            c,
            calDateStr,
            c.isSap,
            emp._arrivalDate,
            emp._departureDate,
            chargeableCombined,
            catMap,
            sapCatMap,
            forecastCatMap,
            useSapActuals
          );
          if (!result) {
            empDayData.push({ netU: 0, chU: 0 });
            continue;
          }
          const etpR = getEtpRatio(emp._etpAdjustments, calDateStr);
          activeN += etpR;

          empDayData.push({ netU: result.netU, chU: result.cappedChU });
          sumTotal += result.rawTotal * etpR;
          sumCappedTotal += result.cappedTotal * etpR;
          sumAbsU += result.cappedAbsU * etpR;
          sumChU += result.cappedChU * etpR;
          sumGoU += result.cappedGoU * etpR;
          sumRawGoU += result.rawGoU * etpR;
          sumTrU += result.cappedTrU * etpR;

          const dv = result.display;
          displayChU += dv.displayChU * etpR;
          displayAbsU += dv.displayAbsU * etpR;
          // Real hours using per-employee HPD, weighted by ETP ratio
          const empHPDDay = getHoursPerDay(emp.grade);
          dayRealBaseH += empHPDDay * etpR;
          dayRealChH += ((dv.displayChU * empHPDDay) / 100) * etpR;
          dayRealAbsH += ((dv.displayAbsU * empHPDDay) / 100) * etpR;
          dayRealTrH += ((result.cappedTrU * empHPDDay) / 100) * etpR;
          dayRealGoH += ((result.cappedGoU * empHPDDay) / 100) * etpR;
          if (dv.isSapWithMds) {
            sapWithMdsCount++;
            sapActualChU += dv.sapActualChU;
            sapActualAbsU += dv.sapActualAbsU;
            sapForecastChU += dv.sapForecastChU;
            sapForecastAbsU += dv.sapForecastAbsU;
            const empHPD = getHoursPerDay(emp.grade);
            sapActualChH += (dv.sapActualChU * empHPD) / 100;
            sapForecastChH += (dv.sapForecastChU * empHPD) / 100;
          }

          // SAP independent pipeline: iterate segments with cell scales (same as accumulateDay)
          if (c.isSap) {
            daySapPipeChH += computeSapChH(c.segments, c.chScale ?? 1, empHPDDay, chargeableCombined);
          }

          // MDS independent pipeline: same logic as computeBucketFromGrid
          const empHPDMds = empHPDDay;
          if (c.isSap && c.forecastSegments && isMdsAvailable) {
            // SAP+MDS after MDS_EXTRACT_START: compute from forecastSegments with own capping
            dayMdsBaseH += empHPDMds;
            dayMdsChH += computeMdsChargeableHours(c.forecastSegments, empHPDMds, chargeableCombined);
          } else if (!c.isSap && c.hasStaffing && calDateStr.slice(0, 7) < currentMonthStr) {
            // Pure MDS day from completed months (exclude current month: SAP not yet filled)
            dayMdsBaseH += empHPDMds;
            dayMdsChH += computeSapChH(c.segments, c.chScale ?? 1, empHPDMds, chargeableCombined);
          } else if (c.isSap && !c.forecastSegments && calDateStr >= MDS_EXTRACT_START) {
            // SAP-only after MDS start: bench (0% chargeable)
            dayMdsBaseH += empHPDMds;
          }

          if (result.forecastCounted) {
            forecastEmpCount++;
            fSumAbsU += result.forecastAbsU;
            fSumChU += result.forecastChU;
          }
        }
      } // end else (non-holiday)

      // Inactive = all employees are outside their arrival/departure range (not just "no data")
      const isInactive =
        activeN === 0 &&
        employees.length > 0 &&
        employees.every((emp: Employee) => {
          const arr = emp._arrivalDate;
          const dep = emp._departureDate;
          return (arr && calDateStr < arr) || (dep && calDateStr > dep);
        });
      if (activeN === 0) {
        dayHasStaffing = false;
        anySap = false;
        sapEmpCount = 0;
      }

      const effN = activeN > 0 ? activeN : 1;
      const avgNet = (effN * 100 - sumAbsU) / effN;
      const avgCh = sumChU / effN;
      const avgGo = sumGoU / effN;
      const avgTr = sumTrU / effN;
      const avgAbsRate = sumAbsU / effN;
      const avgGoRate = sumRawGoU / effN;
      // Net hours: base - absence - holidays (mirrors modal's netH = totalBase - absH - holH)
      const dayNetH = dayRealBaseH - dayRealAbsH - dayRealHolH;
      const tuRate = computeTuRate(dayRealChH, dayNetH);
      const toRate = computeToRate(dayRealChH, dayRealGoH, dayRealTrH, dayNetH);
      const fAvgNet = forecastEmpCount > 0 ? (forecastEmpCount * 100 - fSumAbsU) / forecastEmpCount : 0;
      const fAvgCh = forecastEmpCount > 0 ? fSumChU / forecastEmpCount : 0;
      const forecastTuRate = fAvgNet > 0 ? (fAvgCh / fAvgNet) * 100 : 0;

      // Forced absence hatch only when majority of employees have forced absence this day
      const dayForcedAbsence = forcedAbsenceCount > 0 && forcedAbsenceCount > employees.length / 2;
      daily.push({
        date,
        dow,
        isWE: false,
        isHoliday: calIsHoliday,
        isInactive,
        sumTotal,
        sumCappedTotal,
        catMap,
        sapCatMap,
        forecastCatMap,
        sapEmpCount,
        forecastEmpCount,
        activeN,
        monthStart,
        tuRate,
        toRate,
        absRate: avgAbsRate,
        goRate: avgGoRate,
        sumChU,
        sumGoU,
        sumTrU,
        sumAbsU,
        displayChU,
        displayAbsU,
        empDayData,
        isSap: anySap,
        hasStaffing: dayHasStaffing,
        isForcedAbsence: dayForcedAbsence,
        forecastTuRate,
        sapActualChU,
        sapForecastChU,
        sapActualAbsU,
        sapForecastAbsU,
        sapActualChH,
        sapForecastChH,
        sapWithMdsCount,
        dayRealBaseH,
        dayRealChH,
        dayRealAbsH,
        dayRealTrH,
        dayRealGoH,
        dayRealHolH,
        daySapPipeChH,
        dayMdsChH,
        dayMdsBaseH,
      });
    }
  } else {
    // Legacy path removed — dailyGrid is always available when this component renders
    return { cells: null, sapWallMonthData: null };
  }

  // Helper: build cat breakdown from daily slices (divided by total active employee-days)
  const catBreakdownFrom = (days: DailyAggregateDay[]) => {
    const catAcc: Record<string, number> = {};
    days.forEach((d) => {
      Object.entries(d.catMap).forEach(([cat, val]) => {
        catAcc[cat] = (catAcc[cat] || 0) + (val as number);
      });
    });
    const totalActiveEmpDays = days.reduce((s: number, d) => s + (d.activeN || 1), 0);
    return Object.entries(catAcc)
      .map(([cat, sum]) => ({ category: cat, avg: totalActiveEmpDays > 0 ? (sum as number) / totalActiveEmpDays : 0 }))
      .sort((a, b) => b.avg - a.avg);
  };

  // Helper: compute TU/TO from real hours (per-employee HPD) across all active employees
  const computeAggBucketRates = (working: DailyAggregateDay[]) => {
    const totalActiveEmpDays = working.reduce((s: number, d) => s + (d.activeN || 0), 0);
    const totalBaseH = working.reduce((s: number, d) => s + (d.dayRealBaseH || 0), 0);
    const totalChH = working.reduce((s: number, d) => s + (d.dayRealChH || 0), 0);
    const totalAbsH = working.reduce((s: number, d) => s + (d.dayRealAbsH || 0), 0);
    const totalGoH = working.reduce((s: number, d) => s + (d.dayRealGoH || 0), 0);
    const totalTrH = working.reduce((s: number, d) => s + (d.dayRealTrH || 0), 0);
    const totalHolH = working.reduce((s: number, d) => s + (d.dayRealHolH || 0), 0);
    const totalNetH = totalBaseH - totalAbsH - totalHolH;
    const tuRate = computeTuRate(totalChH, totalNetH);
    const toRate = computeToRate(totalChH, totalGoH, totalTrH, totalNetH);
    const avgAbs = totalActiveEmpDays > 0 ? working.reduce((s: number, d) => s + d.sumAbsU, 0) / totalActiveEmpDays : 0;
    const avgGo =
      totalActiveEmpDays > 0 ? working.reduce((s: number, d) => s + (d.sumGoU || 0), 0) / totalActiveEmpDays : 0;
    return { tuRate, toRate, avgAbs, avgGo };
  };

  // Helper: compute period-specific TU theorique + potentiel
  const computePeriodTheoAndPot = (working: DailyAggregateDay[]) => {
    const perEmp = employees.map(() => ({ netU: 0, chU: 0 }));
    working.forEach((d) => {
      (d.empDayData || []).forEach((ed, ei: number) => {
        perEmp[ei].netU += ed.netU;
        perEmp[ei].chU += ed.chU;
      });
    });
    let totalNetU = 0,
      targetChU = 0,
      adjustedChU = 0;
    perEmp.forEach((t: { netU: number; chU: number }, ei: number) => {
      const tgt = getGradeTarget(employees[ei].grade);
      const tu = computeTuRate(t.chU, t.netU);
      totalNetU += t.netU;
      targetChU += (tgt / 100) * t.netU;
      adjustedChU += tu < tgt ? (tgt / 100) * t.netU : t.chU;
    });
    const theoTU = totalNetU > 0 ? (targetChU / totalNetU) * 100 : 0;
    const potTU = totalNetU > 0 ? (adjustedChU / totalNetU) * 100 : 0;
    return { theoTU, potTU };
  };

  if (granularity === "day") {
    const result: AggregateBucketCell[] = [];
    let i = 0;
    while (i < daily.length) {
      const d = daily[i];
      if (d.isWE) {
        let weEnd = i + 1;
        while (weEnd < daily.length && daily[weEnd].isWE) weEnd++;
        const label = d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        result.push({
          fill: "#f0f0f0",
          label,
          isWeekend: true,
          span: Math.max(1, Math.round((weEnd - i) / 2)),
          monthStart: d.monthStart,
          startDate: d.date,
          endDate: daily[weEnd - 1].date,
        });
        i = weEnd;
      } else {
        const label = d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const dayEffN = d.activeN > 0 ? d.activeN : 1;
        const avg = d.sumTotal / dayEffN;
        const avgCapped = d.sumCappedTotal / dayEffN;
        const breakdown = Object.entries(d.catMap)
          .map(([cat, sum]) => ({ category: cat, avg: sum as number }))
          .sort((a, b) => b.avg - a.avg);
        const { theoTU, potTU } = computePeriodTheoAndPot([d]);
        // Display TU — use real hours (per-employee HPD), mirrors modal: netH = base - abs - hol
        const dayNetH = (d.dayRealBaseH || 0) - (d.dayRealAbsH || 0) - (d.dayRealHolH || 0);
        const dayDisplayTuRate = computeTuRate(d.dayRealChH || 0, dayNetH);
        result.push({
          fill: getHeatmapStyle(avg, undefined, theoreticalTU).backgroundColor,
          total: avg,
          cappedTotal: avgCapped,
          tuRate: d.tuRate,
          toRate: d.toRate,
          absRate: d.absRate,
          goRate: d.goRate,
          displayTuRate: dayDisplayTuRate,
          catBreakdown: breakdown,
          label,
          span: 1,
          monthStart: d.monthStart,
          startDate: d.date,
          endDate: d.date,
          theoTU,
          potTU,
          isSap: d.isSap,
          hasStaffing: d.hasStaffing,
          forecastTuRate: d.forecastTuRate,
          varianceRate: d.isSap && (d.sapWithMdsCount || 0) > 0 ? d.tuRate - d.forecastTuRate : null,
          sapChHours: d.isSap ? d.daySapPipeChH : null,
          forecastChHours: d.dayMdsBaseH > 0 ? d.dayMdsChH : null,
          varianceHours: d.isSap && d.dayMdsBaseH > 0 ? d.daySapPipeChH - d.dayMdsChH : null,
          bucketRealBaseH: d.dayRealBaseH || 0,
          bucketRealChH: d.dayRealChH || 0,
          bucketRealAbsH: d.dayRealAbsH || 0,
          bucketRealGoH: d.dayRealGoH || 0,
          bucketRealTrH: d.dayRealTrH || 0,
          totalSapEmpDays: d.sapEmpCount || 0,
          activeEmpDays: d.activeN || 0,
        });
        i++;
      }
    }
    // SAP wall for day granularity: compute from daily on current month
    let sapWallMonthDataDay: { idx: number; frac: number; color: string } | null = null;
    const nowD = new Date();
    const cmD = nowD.getMonth(),
      cyD = nowD.getFullYear();
    let mSapEmpDays = 0,
      mActiveEmpDays = 0,
      mStartIdx = -1,
      mWdCount = 0;
    for (let di = 0; di < daily.length; di++) {
      const dd = daily[di];
      if (dd.date.getMonth() !== cmD || dd.date.getFullYear() !== cyD) continue;
      if (dd.isWE || dd.isHoliday) continue;
      if (mStartIdx === -1) mStartIdx = di;
      mWdCount++;
      mSapEmpDays += dd.sapEmpCount || 0;
      mActiveEmpDays += dd.activeN || 0;
    }
    if (mActiveEmpDays > 0 && mSapEmpDays > 0) {
      const frac = Math.min(1, mSapEmpDays / mActiveEmpDays);
      const targetIdx = mStartIdx + Math.round(frac * mWdCount);
      let spanAcc = 0;
      for (let bi = 0; bi < result.length; bi++) {
        const bEnd = spanAcc + (result[bi].span || 1);
        if (targetIdx < bEnd) {
          const fracInB = (targetIdx - spanAcc) / (result[bi].span || 1);
          sapWallMonthDataDay = { idx: bi, frac: fracInB, color: getSapWallColor(nowD.toISOString().slice(0, 10)) };
          break;
        }
        spanAcc = bEnd;
      }
    }
    return { cells: result, sapWallMonthData: sapWallMonthDataDay };
  }

  // Helper: compute SAP-related bucket info
  const computeAggSapInfo = (working: DailyAggregateDay[], allDays: DailyAggregateDay[] = []) => {
    const hasSap = working.some((d) => d.isSap);
    // Include weekend SAP days (e.g. travel) in SAP TU calculation
    const weSapDays = allDays.filter((d) => d.isWE && d.isSap);
    const sapDaysAll = [...working.filter((d) => d.isSap), ...weSapDays];
    const sapDaysWithMds = sapDaysAll.filter((d) => (d.sapWithMdsCount || 0) > 0);
    const sapDayCount = sapDaysAll.length;
    let sapTuRate: number | null = null,
      forecastTuRateBucket: number | null = null,
      varianceRate: number | null = null;
    // SAP TU from all SAP days — use real hours (per-employee HPD), subtract holidays
    if (sapDaysAll.length > 0) {
      const sBaseH = sapDaysAll.reduce((s, d) => s + (d.dayRealBaseH || 0), 0);
      const sChH = sapDaysAll.reduce((s, d) => s + (d.dayRealChH || 0), 0);
      const sAbsH = sapDaysAll.reduce((s, d) => s + (d.dayRealAbsH || 0), 0);
      const sHolH = sapDaysAll.reduce((s, d) => s + (d.dayRealHolH || 0), 0);
      const sNetH = sBaseH - sAbsH - sHolH;
      sapTuRate = computeTuRate(sChH, sNetH);
    }
    // Variance only from SAP days that also have MDS data
    if (sapDaysWithMds.length > 0) {
      const sCh = sapDaysWithMds.reduce((s, d) => s + (d.sapActualChU || 0), 0);
      const sAbs = sapDaysWithMds.reduce((s, d) => s + (d.sapActualAbsU || 0), 0);
      const sEmpDays = sapDaysWithMds.reduce((s, d) => s + (d.sapWithMdsCount || 0), 0);
      const fCh = sapDaysWithMds.reduce((s, d) => s + (d.sapForecastChU || 0), 0);
      const fAbs = sapDaysWithMds.reduce((s, d) => s + (d.sapForecastAbsU || 0), 0);
      varianceRate = computeVarianceRate(sEmpDays, sCh, sAbs, fCh, fAbs);
      const fNet = sEmpDays * 100 - fAbs;
      forecastTuRateBucket = computeTuRate(fCh, fNet);
    }
    const isFullSap = working.length > 0 && working.every((d) => (d.sapEmpCount || 0) >= (d.activeN || 1));
    const totalSapEmpDays = working.reduce((s, d) => s + (d.sapEmpCount || 0), 0);
    const activeEmpDays = working.reduce((s, d) => s + (d.activeN || 0), 0);
    let sapCatBreakdown: { category: string; avg: number }[] | null = null;
    if (sapDaysAll.length > 0) {
      const acc: Record<string, number> = {};
      sapDaysAll.forEach((d) => {
        Object.entries(d.sapCatMap || {}).forEach(([cat, val]) => {
          acc[cat] = (acc[cat] || 0) + (val as number);
        });
      });
      sapCatBreakdown = Object.entries(acc)
        .map(([cat, sum]) => ({ category: cat, avg: (sum as number) / sapDaysAll.length }))
        .sort((a, b) => b.avg - a.avg);
    }
    // Forecast cat breakdown — only from employees with forecast data (forecastCatMap already excludes SAP-no-MDS)
    const fAcc: Record<string, number> = {};
    const daysWithForecast = working.filter((d) => (d.forecastEmpCount || 0) > 0);
    working.forEach((d) => {
      Object.entries(d.forecastCatMap || {}).forEach(([cat, val]) => {
        fAcc[cat] = (fAcc[cat] || 0) + (val as number);
      });
    });
    const forecastCatBreakdown =
      daysWithForecast.length > 0
        ? Object.entries(fAcc)
            .map(([cat, sum]) => ({ category: cat, avg: (sum as number) / daysWithForecast.length }))
            .sort((a, b) => b.avg - a.avg)
        : null;
    const avgSapEmpCount =
      sapDaysAll.length > 0
        ? Math.round(sapDaysAll.reduce((s, d) => s + (d.sapEmpCount || 0), 0) / sapDaysAll.length)
        : 0;
    const avgForecastEmpCount =
      daysWithForecast.length > 0
        ? Math.round(daysWithForecast.reduce((s, d) => s + (d.forecastEmpCount || 0), 0) / daysWithForecast.length)
        : 0;
    const hasStaffing = working.some((d) => d.hasStaffing);
    // Hours variance: SAP days only, after MDS_EXTRACT_START (dayMdsBaseH > 0 implies after MDS start)
    // sapDaysAll already includes weekend SAP days — no separate weSapDaysForVar needed
    const sapDaysForVar = sapDaysAll.filter((d) => (d.dayMdsBaseH || 0) > 0);
    const sapChHours = sapDaysForVar.length > 0 ? sapDaysForVar.reduce((s, d) => s + (d.daySapPipeChH || 0), 0) : null;
    const mdsChHours = sapDaysForVar.length > 0 ? sapDaysForVar.reduce((s, d) => s + (d.dayMdsChH || 0), 0) : null;
    const varianceHours = sapChHours != null && mdsChHours != null ? sapChHours - mdsChHours : null;
    // Display TU — use real hours (per-employee HPD), mirrors modal: netH = base - abs - hol
    // Include weekend SAP days in display TU base
    const allBaseH =
      working.reduce((s, d) => s + (d.dayRealBaseH || 0), 0) + weSapDays.reduce((s, d) => s + (d.dayRealBaseH || 0), 0);
    const allChH =
      working.reduce((s, d) => s + (d.dayRealChH || 0), 0) + weSapDays.reduce((s, d) => s + (d.dayRealChH || 0), 0);
    const allAbsH =
      working.reduce((s, d) => s + (d.dayRealAbsH || 0), 0) + weSapDays.reduce((s, d) => s + (d.dayRealAbsH || 0), 0);
    const allHolH = working.reduce((s, d) => s + (d.dayRealHolH || 0), 0);
    const allNetH = allBaseH - allAbsH - allHolH;
    const forecastTuRateAll = computeTuRate(allChH, allNetH);
    const displayTuRate = isFullSap && sapTuRate != null ? sapTuRate : forecastTuRateAll;
    // Real hours for the bucket — passed to modal to avoid recomputation
    const allGoH = working.reduce((s, d) => s + (d.dayRealGoH || 0), 0);
    const allTrH = working.reduce((s, d) => s + (d.dayRealTrH || 0), 0);
    // Bucket has forced-absence styling when any working day is forced-absence
    const forcedDays = working.filter((d) => d.isForcedAbsence).length;
    const isForcedAbsence = forcedDays > 0 && forcedDays > working.length / 2;
    // Bucket is inactive when ALL working days are inactive (all employees departed/not arrived)
    const isInactive = working.length > 0 && working.every((d) => d.isInactive);
    return {
      isSap: hasSap,
      isFullSap,
      sapDayCount,
      varianceRate,
      sapTuRate,
      forecastTuRateBucket,
      varianceHours,
      sapChHours,
      forecastChHours: mdsChHours,
      sapCatBreakdown,
      forecastCatBreakdown,
      avgSapEmpCount,
      avgForecastEmpCount,
      totalSapEmpDays,
      activeEmpDays,
      hasStaffing,
      displayTuRate,
      isForcedAbsence,
      isInactive,
      bucketRealBaseH: allBaseH,
      bucketRealChH: allChH,
      bucketRealAbsH: allAbsH,
      bucketRealHolH: allHolH,
      bucketRealGoH: allGoH,
      bucketRealTrH: allTrH,
    };
  };

  // Helper: compute column span for a slice (workdays + merged weekend blocks)
  // This matches PeriodBar's column model where each Sat+Sun block = 1 column
  const colSpan = (slice: DailyAggregateDay[]) => {
    let cols = 0;
    let i = 0;
    while (i < slice.length) {
      if (slice[i].isWE) {
        cols++; // one merged weekend block
        while (i < slice.length && slice[i].isWE) i++;
      } else {
        cols++; // one workday
        i++;
      }
    }
    return cols;
  };

  // Aggregate into buckets (week / 2week / month)
  const buckets: AggregateBucketCell[] = [];
  const makeBucket = (slice: DailyAggregateDay[]) => {
    const working = slice.filter((d) => !d.isWE);
    if (working.length === 0)
      return {
        fill: "#f0f0f0",
        isWeekend: true,
        label: "Weekend",
        span: colSpan(slice),
        _calDays: slice.length,
        startDate: slice[0].date,
        endDate: slice[slice.length - 1].date,
      };
    const totalActiveEmpDays = working.reduce((s: number, d) => s + (d.activeN || 0), 0);
    const avg = totalActiveEmpDays > 0 ? working.reduce((s: number, d) => s + d.sumTotal, 0) / totalActiveEmpDays : 0;
    const avgCapped =
      totalActiveEmpDays > 0
        ? working.reduce((s: number, d) => s + (d.sumCappedTotal || 0), 0) / totalActiveEmpDays
        : 0;
    const { tuRate: avgTU, toRate: avgTO, avgAbs } = computeAggBucketRates(working);
    const bucketGoRate =
      working.length > 0 ? working.reduce((s: number, d) => s + (d.goRate || 0), 0) / working.length : 0;
    const sLabel = slice[0].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const eLabel = slice[slice.length - 1].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const { theoTU, potTU } = computePeriodTheoAndPot(working);
    return {
      fill: avg === 0 ? "#f9fafb" : getHeatmapStyle(avg, undefined, theoreticalTU).backgroundColor,
      total: avg,
      cappedTotal: avgCapped,
      tuRate: avgTU,
      toRate: avgTO,
      absRate: avgAbs,
      goRate: bucketGoRate,
      label: `${sLabel} \u2013 ${eLabel}`,
      catBreakdown: catBreakdownFrom(working),
      workDays: working.length,
      span: colSpan(slice),
      _calDays: slice.length,
      startDate: slice[0].date,
      endDate: slice[slice.length - 1].date,
      theoTU,
      potTU,
      ...computeAggSapInfo(working, slice),
    };
  };

  if (granularity === "week") {
    let j = 0;
    while (j < totalDays) {
      if (daily[j].isWE) {
        let e = j + 1;
        while (e < totalDays && daily[e].isWE) e++;
        buckets.push({
          fill: "#f0f0f0",
          isWeekend: true,
          label: "Weekend",
          span: 1,
          _calDays: e - j,
          startDate: daily[j].date,
          endDate: daily[e - 1].date,
        });
        j = e;
      } else {
        let e = j + 1;
        while (e < totalDays && !daily[e].isWE) e++;
        buckets.push(makeBucket(daily.slice(j, e)));
        j = e;
      }
    }
  } else if (granularity === "2week") {
    let j = 0;
    while (j < totalDays) {
      let e = j + 1;
      let mondays = 0;
      while (e < totalDays) {
        if (daily[e].dow === 1 && ++mondays === 2) break;
        e++;
      }
      buckets.push(makeBucket(daily.slice(j, e)));
      j = e;
    }
  } else if (granularity === "halfmonth") {
    let j = 0;
    while (j < totalDays) {
      const curMonth = daily[j].date.getMonth();
      const curHalf = daily[j].date.getDate() <= 15 ? 1 : 2;
      let e = j + 1;
      while (e < totalDays) {
        const dd = daily[e].date;
        if (dd.getMonth() !== curMonth || (dd.getDate() <= 15 ? 1 : 2) !== curHalf) break;
        e++;
      }
      const slice = daily.slice(j, e);
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
        const hmTotalActive = working.reduce((s: number, d) => s + (d.activeN || 0), 0);
        const avg = hmTotalActive > 0 ? working.reduce((s: number, d) => s + d.sumTotal, 0) / hmTotalActive : 0;
        const { tuRate: avgTU, toRate: avgTO, avgAbs } = computeAggBucketRates(working);
        const bucketGoRate =
          working.length > 0 ? working.reduce((s: number, d) => s + (d.goRate || 0), 0) / working.length : 0;
        const mLabel = MONTHS_EN[curMonth];
        const label = `C${curHalf} ${mLabel} (${fmtDayMonth(slice[0].date)} \u2013 ${fmtDayMonth(slice[slice.length - 1].date)})`;
        const { theoTU, potTU } = computePeriodTheoAndPot(working);
        buckets.push({
          fill: avg === 0 ? "#f9fafb" : getHeatmapStyle(avg, undefined, theoreticalTU).backgroundColor,
          total: avg,
          tuRate: avgTU,
          toRate: avgTO,
          absRate: avgAbs,
          goRate: bucketGoRate,
          label,
          catBreakdown: catBreakdownFrom(working),
          workDays: working.length,
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
          theoTU,
          potTU,
          ...computeAggSapInfo(working, slice),
        });
      }
      j = e;
    }
  } else {
    let j = 0;
    while (j < totalDays) {
      const curMonth = daily[j].date.getMonth();
      let e = j + 1;
      while (e < totalDays && daily[e].date.getMonth() === curMonth) e++;
      const slice = daily.slice(j, e);
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
        const moTotalActive = working.reduce((s: number, d) => s + (d.activeN || 0), 0);
        const avg = moTotalActive > 0 ? working.reduce((s: number, d) => s + d.sumTotal, 0) / moTotalActive : 0;
        const { tuRate: avgTU, toRate: avgTO, avgAbs } = computeAggBucketRates(working);

        const bucketGoRate =
          working.length > 0 ? working.reduce((s: number, d) => s + (d.goRate || 0), 0) / working.length : 0;
        const label = `${slice[0].date.toLocaleDateString("en-GB", { month: "long" })} (${fmtDayMonth(slice[0].date)} \u2013 ${fmtDayMonth(slice[slice.length - 1].date)})`;
        const { theoTU, potTU } = computePeriodTheoAndPot(working);
        buckets.push({
          fill: avg === 0 ? "#f9fafb" : getHeatmapStyle(avg, undefined, theoreticalTU).backgroundColor,
          total: avg,
          tuRate: avgTU,
          toRate: avgTO,
          absRate: avgAbs,
          goRate: bucketGoRate,
          label,
          catBreakdown: catBreakdownFrom(working),
          workDays: working.length,
          span: colSpan(slice),
          _calDays: slice.length,
          startDate: slice[0].date,
          endDate: slice[slice.length - 1].date,
          theoTU,
          potTU,
          ...computeAggSapInfo(working, slice),
        });
      }
      j = e;
    }
  }

  let dayIdx = 0;
  for (const b of buckets) {
    b.monthStart = dayIdx > 0 && daily[dayIdx].date.getMonth() !== daily[dayIdx - 1].date.getMonth();
    dayIdx += b._calDays || b.span;
  }

  // SAP wall: compute fill rate for current month from daily array, position independently of buckets
  let sapWallMonthData: { idx: number; frac: number; color: string } | null = null;
  const now = new Date();
  const curMonth = now.getMonth(),
    curYear = now.getFullYear();
  // Collect current month working days and count SAP fill
  const monthWorkingDays: Date[] = [];
  let monthSapEmpDays = 0,
    monthActiveEmpDays = 0;
  for (let i = 0; i < daily.length; i++) {
    const d = daily[i];
    if (d.date.getMonth() !== curMonth || d.date.getFullYear() !== curYear) continue;
    if (d.isWE || d.isHoliday) continue;
    monthWorkingDays.push(d.date);
    monthSapEmpDays += d.sapEmpCount || 0;
    monthActiveEmpDays += d.activeN || 0;
  }
  if (monthActiveEmpDays > 0 && monthSapEmpDays > 0 && monthWorkingDays.length > 0) {
    const frac = Math.min(1, monthSapEmpDays / monthActiveEmpDays);
    // Find the Nth working day of the current month (N = frac × total working days)
    const targetWorkDay = Math.min(monthWorkingDays.length - 1, Math.round(frac * monthWorkingDays.length));
    const targetDate = monthWorkingDays[targetWorkDay];
    // Find which bucket contains this date and position within it
    for (let bi = 0; bi < buckets.length; bi++) {
      const b = buckets[bi];
      if (!b.startDate || !b.endDate) continue;
      if (targetDate >= b.startDate && targetDate <= b.endDate) {
        // Fraction within bucket: count working days before target vs total in bucket
        let daysBeforeInBucket = 0,
          totalDaysInBucket = 0;
        for (const wd of monthWorkingDays) {
          if (wd >= b.startDate && wd <= b.endDate) {
            totalDaysInBucket++;
            if (wd < targetDate) daysBeforeInBucket++;
          }
        }
        const fracInBucket = totalDaysInBucket > 0 ? daysBeforeInBucket / totalDaysInBucket : 0;
        const color = getSapWallColor(now.toISOString().slice(0, 10));
        sapWallMonthData = { idx: bi, frac: fracInBucket, color };
        break;
      }
    }
  }

  return { cells: buckets, sapWallMonthData };
}
