import { logger } from "./logger";
import {
  parseDate,
  isWeekend,
  isHolidayEnabled,
  toISODateString,
  addDays,
  getPositionFromDate,
  countWorkingDays,
} from "./dateUtils";
import {
  WORK_HOURS_PER_DAY,
  getHoursPerDay,
  JOB_CATEGORIES,
  UNKNOWN_GRADE,
  ABSENCE_CATS,
  CHARGEABLE_CATS,
  GO_CATS,
  TRAINING_CATS,
  MS_PER_DAY,
  MDS_EXTRACT_START,
} from "../constants";
import type {
  Employee,
  Assignment,
  DailyCell,
  DailyCellSegment,
  EmployeeDailyData,
  EmployeeGridMetrics,
  CalendarDay,
  EtpAdjustment,
  StaffingRecord,
  SapRecord,
  SapDayData,
  ConsolidatedAssignment,
} from "../types";
import { getEtpRatio } from "../types";
import { computeVarianceRate } from "./varianceEngine";
import { getRealEmpId, type EmpLike } from "./empIdUtils";
import { getToday } from "../../../utils/formatters";
import { capUtilizations, computeTuRate, computeToRate } from "./calcPrimitives";
import {
  buildPeriodIndex,
  computeDayCellSegments,
  assembleDailyCell,
  buildWeekendSapCell,
  accumulateFromCachedCell,
  accumulateFromNewCell,
  computeEmployeeMetrics,
  createEmptyAccumulators,
  computeTransitionLoss,
} from "./dailyGridBuilder";
import type { DayInfo, EmpContext, GridSettings } from "./dailyGridBuilder";

/** Strip French civility prefixes (M, Mme, M., Mme.) from names */
export const stripCivility = (name: string): string => name.replace(/^(?:Mme|Mds|Mrs|Mr|Ms|Mlle|M)\.?\s+/i, "").trim();

/**
 * Phase 1: Build employee structures from raw data (no timeline dependency).
 * Pure parser — no metric computation. All metrics are derived by buildDailyGrid().
 * Pre-computes _consolidated/_periods for downstream consumers.
 */
export const buildEmployeeStructures = (data: StaffingRecord[], enabledHolidayDates: string[] = []): Employee[] => {
  // Use a mutable builder shape while accumulating records; cast to Employee[] at return.
  const employees: Record<string, Employee & { projects: Set<string> }> = {};
  const wdCache = new Map(); // Cache for countWorkingDays (same date ranges appear often)

  data.forEach((record) => {
    const empKey = record.empId;

    if (!employees[empKey]) {
      employees[empKey] = {
        empId: record.empId,
        name: stripCivility(`${record.firstName || ""} ${record.lastName || ""}`),
        grade: UNKNOWN_GRADE,
        subTeam: record.subTeam || "",
        assignments: [],
        projects: new Set(),
        trueUtilizationRate: 0,
        availableCapacityHours: 0,
        projectCount: 0,
        chargeableHours: 0,
      };
    }

    const startDate = parseDate(record.startDateParsed || record.startDate);
    const endDate = parseDate(record.endDateParsed || record.endDate);

    if (startDate && endDate) {
      const workingDays = countWorkingDays(startDate, endDate, enabledHolidayDates, wdCache);
      const hoursPerDay = (record.utilization / 100) * WORK_HOURS_PER_DAY;
      const totalAssignmentHours = hoursPerDay * workingDays;

      employees[empKey].assignments.push({
        _uid: (record._uid as string | undefined) || crypto.randomUUID(),
        empId: record.empId,
        jobName: record.jobName,
        startDate,
        endDate,
        utilization: record.utilization || 0,
        status: record.status || "",
        jobNo: record.jobNo,
        hoursPerDay,
        workingDays,
        totalHours: totalAssignmentHours,
        category: record.category,
        ...(record.isNew && { isNew: true }),
        ...(record.isModified && { isModified: true }),
      });

      employees[empKey].projects.add(record.jobName);
    }
  });

  // Sort assignments, cache consolidated/periods, build search index
  const empList = Object.values(employees);
  empList.forEach((emp) => {
    emp.projectCount = emp.projects.size;
    emp.assignments.sort(
      (a: Assignment, b: Assignment) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    // Pre-compute consolidated assignments + normalized periods (used by buildDailyGrid)
    emp._consolidated = consolidateAssignments(emp.assignments);
    emp._periods = normalizePeriods(emp._consolidated);
    // Pre-compute lowercase search index (avoids repeated toLowerCase in filters)
    emp._searchIndex =
      `${emp.name}\t${emp.empId}\t${emp.assignments.map((a: Assignment) => `${a.jobName}\t${a.jobNo || ""}`).join("\t")}`.toLowerCase();
  });

  return empList;
};

/**
 * Build minimal employee entries for SAP-only employees (not present in staffing data).
 * These have no forecast assignments but will display SAP actuals in the heatmap.
 */
export const buildSapOnlyEmployees = (sapLookup: Record<string, any>, existingEmpIds: Set<string>): Employee[] => {
  const sapOnly: Employee[] = [];
  for (const [empId, days] of Object.entries(sapLookup)) {
    if (existingEmpIds.has(empId)) continue;
    // Get name from first SAP record (if available)
    const firstDay = Object.values(days as Record<string, SapDayData>)[0] as SapDayData | undefined;
    const rawName = (firstDay?.records?.[0] as (SapRecord & { name?: string }) | undefined)?.name || empId;
    const name = stripCivility(rawName);
    sapOnly.push({
      empId,
      name,
      grade: UNKNOWN_GRADE,
      subTeam: "",
      assignments: [],
      totalUtilization: 0,
      projectCount: 0,
      projects: new Set(),
      chargeableHours: 0,
      generalOpptyHours: 0,
      trainingHours: 0,
      absenceHours: 0,
      otherHours: 0,
      totalHours: 0,
      netAvailableHours: 0,
      trueUtilizationRate: 0,
      chargeableOnlyRate: 0,
      trueOccupationRate: 0,
      availableCapacityHours: 0,
      fragScore: 0,
      _searchIndex: `${name}\t${empId}`.toLowerCase(),
      _sapOnly: true,
    });
  }
  return sapOnly;
};

/**
 * Phase 2: Compute timeline-dependent metrics on pre-built employee structures.
 * Only this runs when the user pans/zooms.
 */
export const computeTimelineMetrics = (
  empList: Employee[],
  enabledHolidayDates: string[] = [],
  timelineStart: Date | null = null,
  timelineEnd: Date | null = null
): Employee[] => {
  const result = empList.map((emp) => ({ ...emp }));
  result.forEach((emp) => {
    // Pre-compute and cache consolidated assignments + normalized periods
    // so downstream consumers (computeDisplayTuTo, EmployeeRow, HeatmapStrip) reuse them
    if (!emp._consolidated) {
      emp._consolidated = consolidateAssignments(emp.assignments);
      emp._periods = normalizePeriods(emp._consolidated);
    }

    if (!emp.assignments || emp.assignments.length === 0) {
      emp.netAvailableHours = getHoursPerDay(emp.grade);
      emp.availableCapacityHours = getHoursPerDay(emp.grade);
      emp.trueUtilizationRate = 0;
      emp.fragScore = 0;
      emp.totalNetHours = 0;
      emp.tuTransitionLossHours = 0;
      emp.tuTransitionLossPoints = 0;
      return;
    }

    // Use timeline bounds if provided, otherwise use assignment date range
    let minDate: Date, maxDate: Date;
    if (timelineStart && timelineEnd) {
      minDate = new Date(timelineStart);
      maxDate = new Date(timelineEnd);
    } else {
      minDate = new Date(emp.assignments[0].startDate);
      maxDate = new Date(emp.assignments[0].endDate);
      emp.assignments.forEach((a) => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
      });
    }

    // Use raw assignment periods for computeTimelineMetrics (original behavior).
    // _periods (consolidated) is cached for downstream consumers only.
    const periods = emp.assignments.map((a) => {
      const ps = new Date(a.startDate);
      ps.setHours(0, 0, 0, 0);
      const pe = new Date(a.endDate);
      pe.setHours(0, 0, 0, 0);
      return { start: ps.getTime(), end: pe.getTime(), util: a.utilization || 0, category: a.category };
    });

    // computeDailyMetrics uses exclusive end date (numDays = (end-start)/MS_PER_DAY),
    // but computeTimelineMetrics historically uses inclusive end (while <= maxDate).
    // Add 1 day to maxDate to preserve inclusive behavior.
    const inclusiveEnd = addDays(maxDate, 1);

    // Use chargeableCombined=false to get Ch and GO separately (needed for pyramid)
    const empHPD = getHoursPerDay(emp.grade);
    const m = computeDailyMetrics(periods, minDate, inclusiveEnd, enabledHolidayDates, {
      chargeableCombined: false,
      computeFragScore: true,
      computeTransitionLoss: true,
      hoursPerDay: empHPD,
    });

    // Derive actual working days (excluding holidays) from totals
    const HPD = empHPD;
    const holidayDays = Math.round(m.holidayH / HPD);
    const actualWorkingDays = m.workDays - holidayDays;

    // Per-day averages (matching original computeTimelineMetrics contract)
    const avgDailyCh = actualWorkingDays > 0 ? (m.chargeableH + m.generalOpptyH) / actualWorkingDays : 0;
    const avgDailyAbs = actualWorkingDays > 0 ? m.absenceH / actualWorkingDays : 0;
    const avgDailyTr = actualWorkingDays > 0 ? m.trainingH / actualWorkingDays : 0;

    emp.netAvailableHours = Math.max(0, HPD - avgDailyAbs);
    emp.availableCapacityHours = Math.max(0, emp.netAvailableHours - avgDailyCh);
    emp.trueUtilizationRate = emp.netAvailableHours > 0 ? (avgDailyCh / emp.netAvailableHours) * 100 : 100;
    emp.chargeableOnlyRate = emp.trueUtilizationRate;
    emp.trueOccupationRate =
      emp.netAvailableHours > 0 ? ((avgDailyCh + avgDailyTr) / emp.netAvailableHours) * 100 : 100;

    // Per-category period totals for pyramid composition
    emp.totalChargeableHoursInPeriod = m.chargeableH + m.generalOpptyH;
    emp.totalChargeableOnlyHoursInPeriod = m.chargeableH;
    emp.totalTrainingHoursInPeriod = m.trainingH;
    emp.totalAbsenceHoursInPeriod = m.absenceH;
    emp.totalHolidayDaysInPeriod = holidayDays;
    emp.totalWorkingDaysInPeriod = actualWorkingDays;

    // Overwrite raw hour totals with period values
    emp.chargeableHours = m.chargeableH;
    emp.generalOpptyHours = m.generalOpptyH;
    emp.trainingHours = m.trainingH;
    emp.absenceHours = m.absenceH;

    // Fragmentation and transition loss
    emp.fragScore = m.fragScore;
    emp.totalNetHours = m.netH;
    emp.tuTransitionLossHours = m.tuTransitionLossHours;
    emp.tuTransitionLossPoints = m.tuTransitionLossPoints;
  });

  return result.sort((a, b) => b.trueUtilizationRate - a.trueUtilizationRate);
};

/**
 * Backward-compatible wrapper: builds structures + computes metrics in one call.
 */
export const getEnhancedGanttData = (
  data: StaffingRecord[],
  enabledHolidayDates: string[] = [],
  timelineStart: Date | null = null,
  timelineEnd: Date | null = null
): Employee[] => {
  const empList = buildEmployeeStructures(data, enabledHolidayDates);
  return computeTimelineMetrics(empList, enabledHolidayDates, timelineStart, timelineEnd);
};

/**
 * Consolidate assignments by job, merging consecutive periods
 * @param {Array} assignments - Array of assignments
 * @returns {Array} - Consolidated assignments
 */

export const consolidateAssignments = (assignments: Assignment[]): ConsolidatedAssignment[] => {
  if (!assignments || !Array.isArray(assignments)) return [];
  const consolidated: Record<string, ConsolidatedAssignment> = {};

  assignments.forEach((assignment) => {
    const jobKey = assignment.jobNo || assignment.jobName;

    if (!consolidated[jobKey]) {
      consolidated[jobKey] = {
        jobName: assignment.jobName,
        jobNo: assignment.jobNo,
        periods: [],
        totalUtilization: 0,
        totalHours: 0,
        status: assignment.status,
        hasProvisional: false,
        isNew: false,
        isModified: false,
        category: assignment.category,
      };
    }

    consolidated[jobKey].periods.push({
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      utilization: assignment.utilization,
      hoursPerDay: assignment.hoursPerDay,
      status: assignment.status,
      category: assignment.category,
    });

    consolidated[jobKey].totalUtilization += assignment.utilization;
    consolidated[jobKey].totalHours += assignment.hoursPerDay;
    if (assignment.status === "P") {
      consolidated[jobKey].hasProvisional = true;
    }
    if (assignment.isNew) consolidated[jobKey].isNew = true;
    if (assignment.isModified) consolidated[jobKey].isModified = true;
    if (assignment._isNewCreation) consolidated[jobKey]._isNewCreation = true;
    if (assignment._isProposed) consolidated[jobKey]._isProposed = true;
    if (assignment._isUserAssignment) consolidated[jobKey]._isUserAssignment = true;
  });

  // Merge consecutive periods
  Object.values(consolidated).forEach((job) => {
    job.periods.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    job.periods = mergeConsecutivePeriods(job.periods);
  });

  return Object.values(consolidated);
};

/**
 * Merge consecutive periods with same parameters
 * @param {Array} periods - Sorted periods array
 * @returns {Array} - Merged periods
 */
interface AssignmentPeriod {
  startDate: string | Date;
  endDate: string | Date;
  utilization: number;
  hoursPerDay: number;
  status: string;
  category: string;
}

const mergeConsecutivePeriods = (periods: AssignmentPeriod[]): AssignmentPeriod[] => {
  if (periods.length === 0) return [];

  const merged: AssignmentPeriod[] = [];
  let current = { ...periods[0] };

  for (let i = 1; i < periods.length; i++) {
    const period = periods[i];
    const currentEnd = new Date(current.endDate);
    const periodStart = new Date(period.startDate);
    const dayAfterEnd = addDays(currentEnd, 1);

    const canMerge =
      periodStart <= dayAfterEnd &&
      current.utilization === period.utilization &&
      current.hoursPerDay === period.hoursPerDay &&
      current.status === period.status &&
      current.category === period.category;

    if (canMerge) {
      current.endDate = period.endDate;
    } else {
      merged.push(current);
      current = { ...period };
    }
  }

  merged.push(current);
  return merged;
};

// ─── Core TU/TO engine (single source of truth) ─────────────────────────────

/**
 * Normalize consolidated assignments into flat period array with timestamps.
 * @param {Array} consolidatedAssignments - Output of consolidateAssignments()
 * @returns {Array<{start: number, end: number, util: number, category: string}>}
 */
export const normalizePeriods = (
  consolidatedAssignments: ConsolidatedAssignment[]
): Array<{ start: number; end: number; util: number; category: string; isNew?: boolean }> => {
  if (!consolidatedAssignments || !Array.isArray(consolidatedAssignments)) return [];
  const periods: Array<{ start: number; end: number; util: number; category: string; isNew?: boolean }> = [];
  consolidatedAssignments.forEach((job) => {
    const isNew = !!job._isNewCreation;
    job.periods.forEach((p) => {
      const ps = new Date(p.startDate);
      ps.setHours(0, 0, 0, 0);
      const pe = new Date(p.endDate);
      pe.setHours(0, 0, 0, 0);
      periods.push({
        start: ps.getTime(),
        end: pe.getTime(),
        util: p.utilization || 0,
        category: job.category,
        ...(isNew && { isNew: true }),
      });
    });
  });
  return periods;
};

/**
 * Compute TU/TO metrics over a timeline using a daily loop.
 * This is the SINGLE implementation used by EmployeeRow, computeDisplayTuTo,
 * and computeTimelineMetrics.
 *
 * @param {Array<{start, end, util, category}>} periods - Normalized periods (timestamps)
 * @param {Date|string} timelineStart
 * @param {Date|string} timelineEnd
 * @param {Array|Set} enabledHolidayDates - Holiday date strings (YYYY-MM-DD)
 * @param {object} options
 * @param {boolean} [options.chargeableCombined=true] - Merge GO into chargeable
 * @param {boolean} [options.computeFragScore=false] - Compute fragmentation index
 * @param {boolean} [options.computeTransitionLoss=false] - Compute TU transition loss
 * @param {boolean} [options.collectShortfallDetails=false] - Collect per-day shortfall info
 * @returns {object} Full metrics breakdown
 */
export interface NormalizedPeriod {
  start: number;
  end: number;
  util: number;
  category: string;
  isNew?: boolean;
}

export interface DailyMetricsOptions {
  chargeableCombined?: boolean;
  computeFragScore?: boolean;
  computeTransitionLoss?: boolean;
  collectShortfallDetails?: boolean;
  hoursPerDay?: number;
  etpAdjustments?: EtpAdjustment[];
}

export interface DailyMetricsResult {
  workDays: number;
  totalH: number;
  absenceH: number;
  holidayH: number;
  netH: number;
  chargeableH: number;
  generalOpptyH: number;
  trainingH: number;
  otherH: number;
  dispoH: number;
  tu: number;
  to: number;
  fragScore?: number;
  tuTransitionLossHours?: number;
  tuTransitionLossPoints?: number;
  shortfallDetails?: Array<{ dayIdx: number; rate: number; neighborMax: number; shortfall: number }>;
}

export const computeDailyMetrics = (
  periods: NormalizedPeriod[],
  timelineStart: Date | string,
  timelineEnd: Date | string,
  enabledHolidayDates: string[] | Set<string> = [],
  options: DailyMetricsOptions = {}
): DailyMetricsResult => {
  const {
    chargeableCombined = true,
    computeFragScore = false,
    computeTransitionLoss: computeTransitionLossOpt = false,
    collectShortfallDetails = false,
    hoursPerDay = WORK_HOURS_PER_DAY,
    etpAdjustments = undefined as EtpAdjustment[] | undefined,
  } = options;

  const s = new Date(timelineStart);
  s.setHours(0, 0, 0, 0);
  const e = new Date(timelineEnd);
  e.setHours(0, 0, 0, 0);
  const numDays = Math.round((e.getTime() - s.getTime()) / MS_PER_DAY);

  if (numDays <= 0) {
    return {
      workDays: 0,
      totalH: 0,
      absenceH: 0,
      holidayH: 0,
      netH: 0,
      chargeableH: 0,
      generalOpptyH: 0,
      trainingH: 0,
      otherH: 0,
      dispoH: 0,
      tu: 0,
      to: 0,
      ...(computeFragScore ? { fragScore: 0 } : {}),
      ...(computeTransitionLossOpt ? { tuTransitionLossHours: 0, tuTransitionLossPoints: 0 } : {}),
      ...(collectShortfallDetails ? { shortfallDetails: [] } : {}),
    };
  }

  let workDays = 0;
  let absenceUtil = 0;
  let holidayUtil = 0;
  let chargeableUtil = 0;
  let generalOpptyUtil = 0;
  let trainingUtil = 0;
  let otherUtil = 0;
  let effectiveChUtil = 0; // chargeable with new assignments capped to remaining capacity
  // Per-day ETP-weighted hour accumulators (used when etpAdjustments is set)
  const hasEtp = !!etpAdjustments?.length;
  let etpTotalH = 0,
    etpAbsH = 0,
    etpHolH = 0,
    etpChH = 0,
    etpGoH = 0,
    etpTrH = 0,
    etpOtH = 0;
  let fragSum = 0;
  let fragDays = 0;
  const dailyChRates: number[] | null = computeTransitionLossOpt || collectShortfallDetails ? [] : null;
  const dailyIsAbsence: boolean[] | null = computeTransitionLossOpt || collectShortfallDetails ? [] : null;

  const dt = new Date(s);
  for (let d = 0; d < numDays; d++) {
    if (d > 0) dt.setDate(dt.getDate() + 1);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    workDays++;
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (isHolidayEnabled(dtStr, enabledHolidayDates)) {
      holidayUtil += 100;
      if (hasEtp) {
        const dayHPD = hoursPerDay * getEtpRatio(etpAdjustments, dtStr);
        etpTotalH += dayHPD;
        etpHolH += dayHPD;
      }
      if (dailyChRates) {
        dailyChRates.push(0);
        dailyIsAbsence!.push(true);
      }
      continue;
    }
    const ts = dt.getTime();
    const dayWorkUtils: number[] | null = computeFragScore ? [] : null;
    let dayChUtil = 0;
    let dayAbsUtil = 0;
    let dayTrUtil = 0;
    let dayOtUtil = 0;
    let dayGoUtil = 0;
    let dayExistingWork = 0,
      dayExistingCh = 0,
      dayNewCh = 0;

    for (const p of periods) {
      if (ts >= p.start && ts <= p.end) {
        if (ABSENCE_CATS.has(p.category)) {
          dayAbsUtil += p.util;
        } else {
          const isCh = CHARGEABLE_CATS.has(p.category) || (GO_CATS.has(p.category) && chargeableCombined);
          if (CHARGEABLE_CATS.has(p.category)) {
            dayChUtil += p.util;
          } else if (GO_CATS.has(p.category)) {
            if (chargeableCombined) dayChUtil += p.util;
            else dayGoUtil += p.util;
          } else if (TRAINING_CATS.has(p.category)) dayTrUtil += p.util;
          else dayOtUtil += p.util;
          if (dayWorkUtils) dayWorkUtils.push(p.util);
          // Track existing vs new for overcapacity TU
          if (p.isNew) {
            if (isCh) dayNewCh += p.util;
          } else {
            dayExistingWork += p.util;
            if (isCh) dayExistingCh += p.util;
          }
        }
      }
    }

    // Cap daily values: cannot exceed net available
    const dayCap = capUtilizations({
      absU: dayAbsUtil,
      chU: dayChUtil,
      goU: dayGoUtil,
      trU: dayTrUtil,
      otU: dayOtUtil,
    });
    dayChUtil = dayCap.cappedChU;
    dayGoUtil = dayCap.cappedGoU;
    dayTrUtil = dayCap.cappedTrU;
    dayOtUtil = dayCap.cappedOtU;

    // Effective chargeable for TU: existing capped to net, new fills remaining capacity only
    const dayRemainingForNew = Math.max(0, dayCap.netU - dayExistingWork);
    const dayEffectiveCh = Math.min(dayExistingCh, dayCap.netU) + Math.min(dayNewCh, dayRemainingForNew);

    absenceUtil += dayAbsUtil;
    chargeableUtil += dayChUtil;
    generalOpptyUtil += dayGoUtil;
    trainingUtil += dayTrUtil;
    otherUtil += dayOtUtil;
    effectiveChUtil += dayEffectiveCh;

    if (hasEtp) {
      const dayHPD = hoursPerDay * getEtpRatio(etpAdjustments, dtStr);
      etpTotalH += dayHPD;
      etpAbsH += (dayAbsUtil * dayHPD) / 100;
      etpChH += (dayChUtil * dayHPD) / 100;
      etpGoH += (dayGoUtil * dayHPD) / 100;
      etpTrH += (dayTrUtil * dayHPD) / 100;
      etpOtH += (dayOtUtil * dayHPD) / 100;
    }

    if (dailyChRates) {
      dailyChRates.push(dayChUtil);
      dailyIsAbsence!.push(dayAbsUtil >= 100);
    }

    // Fragmentation: Herfindahl index on non-absence work
    if (computeFragScore && dayWorkUtils) {
      if (dayWorkUtils.length > 1) {
        const totalWork = dayWorkUtils.reduce((a, b) => a + b, 0);
        if (totalWork > 0) {
          const hhi = dayWorkUtils.reduce((acc, u) => acc + (u / totalWork) ** 2, 0);
          fragSum += 1 - hhi;
          fragDays++;
        }
      } else if (dayWorkUtils.length === 1) {
        fragDays++;
      }
    }
  }

  // TU Transition Loss (delegates to shared O(n) algorithm)
  let totalShortfall = 0;
  let shortfallDetails: Array<{ dayIdx: number; rate: number; neighborMax: number; shortfall: number }> | undefined =
    collectShortfallDetails ? [] : undefined;
  if (computeTransitionLossOpt && dailyChRates) {
    const tlResult = computeTransitionLoss(dailyChRates, dailyIsAbsence!, collectShortfallDetails);
    totalShortfall = tlResult.totalShortfall;
    shortfallDetails = tlResult.shortfallDetails;
  }

  // Convert utilization percentages to hours (ETP-weighted per day if adjustments provided)
  const HPD = hoursPerDay;
  const totalH = hasEtp ? etpTotalH : workDays * HPD;
  const absenceH = hasEtp ? etpAbsH : (absenceUtil * HPD) / 100;
  const holidayH = hasEtp ? etpHolH : (holidayUtil * HPD) / 100;
  const netH = totalH - absenceH - holidayH;
  const chargeableH = hasEtp ? etpChH : (chargeableUtil * HPD) / 100;
  const generalOpptyH = hasEtp ? etpGoH : (generalOpptyUtil * HPD) / 100;
  const trainingH = hasEtp ? etpTrH : (trainingUtil * HPD) / 100;
  const otherH = hasEtp ? etpOtH : (otherUtil * HPD) / 100;
  const dispoH = Math.max(0, netH - chargeableH - generalOpptyH - trainingH - otherH);
  // TU uses effective chargeable (new assignments capped to remaining capacity after existing work)
  const effectiveChH = (effectiveChUtil * HPD) / 100;
  const tu = computeTuRate(effectiveChH, netH);
  const to = computeToRate(chargeableH, generalOpptyH, trainingH, netH);

  const result: DailyMetricsResult = {
    workDays,
    totalH,
    absenceH,
    holidayH,
    netH,
    chargeableH,
    generalOpptyH,
    trainingH,
    otherH,
    dispoH,
    tu,
    to,
  };

  if (computeFragScore) {
    result.fragScore = fragDays > 0 ? (fragSum / fragDays) * 100 : 0;
  }
  if (computeTransitionLossOpt) {
    result.tuTransitionLossHours = (totalShortfall * HPD) / 100;
    result.tuTransitionLossPoints = netH > 0 ? (result.tuTransitionLossHours / netH) * 100 : 0;
  }
  if (collectShortfallDetails) {
    result.shortfallDetails = shortfallDetails;
  }

  return result;
};

// ─── Display-consistent TU/TO computation (delegates to computeDailyMetrics) ─
export const computeDisplayTuTo = (
  employee: Employee | null,
  timelineStart: Date | string,
  timelineEnd: Date | string,
  chargeableCombined: boolean = true,
  enabledHolidayDates: string[] = []
): { tu: number; to: number; netH: number; chargeableH: number; trainingH: number } => {
  if (!employee) return { tu: 0, to: 0, netH: 0, chargeableH: 0, trainingH: 0 };
  // Reuse cached periods if available (pre-computed in computeTimelineMetrics)
  const periods = employee._periods || normalizePeriods(consolidateAssignments(employee.assignments));
  const m = computeDailyMetrics(periods, timelineStart, timelineEnd, enabledHolidayDates, {
    chargeableCombined,
    hoursPerDay: getHoursPerDay(employee.grade),
  });
  return { tu: m.tu, to: m.to, netH: m.netH, chargeableH: m.chargeableH, trainingH: m.trainingH };
};

/**
 * Compute per-employee SAP vs Staffing variance over the visible timeline.
 * Returns { varianceRate (TU pts), varianceHours (total delta CH hours) } or nulls if no SAP data.
 */
export const computeEmployeeVariance = (
  employee: Employee | null,
  sapLookup: Record<string, any> | null,
  timelineStart: Date | string,
  timelineEnd: Date | string,
  chargeableCombined: boolean = true,
  enabledHolidayDates: string[] = []
): { varianceRate: number | null; varianceHours: number | null } => {
  const empSapId = employee ? getRealEmpId(employee as EmpLike) : undefined;
  if (!employee || !sapLookup || !empSapId || !sapLookup[empSapId]) return { varianceRate: null, varianceHours: null };
  const empSap = sapLookup[empSapId];

  // Build the employee's SAP date range
  const sapDates = Object.keys(empSap);
  if (sapDates.length === 0) return { varianceRate: null, varianceHours: null };
  const sapMinDate = sapDates.reduce((a, b) => (a < b ? a : b));
  const sapMaxDate = sapDates.reduce((a, b) => (a > b ? a : b));

  // Reuse cached periods if available (pre-computed in computeTimelineMetrics)
  const periods = employee._periods || normalizePeriods(consolidateAssignments(employee.assignments));

  const HPD = getHoursPerDay(employee.grade);
  const s = new Date(timelineStart);
  s.setHours(0, 0, 0, 0);
  const e = new Date(timelineEnd);
  e.setHours(0, 0, 0, 0);
  const numDays = Math.round((e.getTime() - s.getTime()) / MS_PER_DAY);

  let sapChSum = 0,
    sapAbsSum = 0,
    fChSum = 0,
    fAbsSum = 0,
    sapDayCount = 0;

  const dt = new Date(s);
  for (let di = 0; di < numDays; di++) {
    if (di > 0) dt.setDate(dt.getDate() + 1);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    const dtStr = toISODateString(dt)!;
    if (isHolidayEnabled(dtStr, enabledHolidayDates)) continue;

    const sapDay = empSap[dtStr];
    if (!sapDay) continue;

    sapDayCount++;
    const ts = dt.getTime();

    // SAP actuals
    let dayChU = 0,
      dayAbsU = 0;
    if (sapDay) {
      sapDay.records.forEach((r: SapRecord) => {
        const util = (r.hours / HPD) * 100;
        if (ABSENCE_CATS.has(r.category)) dayAbsU += util;
        else if (CHARGEABLE_CATS.has(r.category)) dayChU += util;
        else if (GO_CATS.has(r.category) && chargeableCombined) dayChU += util;
      });
    } else {
      dayAbsU = 100; // SAP holiday
    }
    const netU = Math.max(0, 100 - dayAbsU);
    dayChU = Math.min(dayChU, netU);
    sapChSum += dayChU;
    sapAbsSum += Math.min(dayAbsU, 100);

    // Forecast for same day
    let fDayAbsU = 0,
      fDayChU = 0;
    for (const p of periods) {
      if (ts >= p.start && ts <= p.end) {
        if (ABSENCE_CATS.has(p.category)) fDayAbsU += p.util;
        else if (CHARGEABLE_CATS.has(p.category)) fDayChU += p.util;
        else if (GO_CATS.has(p.category) && chargeableCombined) fDayChU += p.util;
      }
    }
    const fNetU = Math.max(0, 100 - fDayAbsU);
    fDayChU = Math.min(fDayChU, fNetU);
    fChSum += fDayChU;
    fAbsSum += Math.min(fDayAbsU, 100);
  }

  if (sapDayCount === 0) return { varianceRate: null, varianceHours: null };

  const varianceRate = computeVarianceRate(sapDayCount, sapChSum, sapAbsSum, fChSum, fAbsSum);
  const varianceHours = ((sapChSum - fChSum) * HPD) / 100;

  return { varianceRate, varianceHours };
};

/**
 * Batch-compute display TU/TO and SAP variance for all employees in a single pass.
 * Shares cached _periods per employee, avoiding duplicate consolidateAssignments + normalizePeriods.
 * Returns a new array with _displayTU, _displayTO, etc. attached.
 */
export const computeDisplayMetricsBatch = (
  employees: Employee[],
  timelineStart: Date | string,
  timelineEnd: Date | string,
  chargeableCombined: boolean,
  enabledHolidayDates: string[],
  sapLookup: Record<string, any> | null,
  sapMonthDateStrs: Set<string>,
  sapMonthWorkDays: number
): Employee[] => {
  return employees.map((emp): Employee => {
    // Reuse cached periods (pre-computed in computeTimelineMetrics)
    const periods = emp._periods || normalizePeriods(consolidateAssignments(emp.assignments));

    // Compute full hoursInfo (TU/TO + frag + transition loss + shortfall details)
    // Reused by EmployeeRow as a fast-path, eliminating a duplicate computeDailyMetrics call per row
    const m = computeDailyMetrics(periods, timelineStart, timelineEnd, enabledHolidayDates, {
      chargeableCombined,
      computeFragScore: true,
      computeTransitionLoss: true,
      collectShortfallDetails: true,
      hoursPerDay: getHoursPerDay(emp.grade),
      etpAdjustments: emp._etpAdjustments,
    });

    // Compute SAP completion percentage
    let _sapPct = 0;
    const sapIdForPct = getRealEmpId(emp);
    if (sapLookup && sapLookup[sapIdForPct] && sapMonthWorkDays > 0) {
      const empSap = sapLookup[sapIdForPct];
      let sapDays = 0;
      for (const ds of sapMonthDateStrs) {
        if (empSap[ds]) sapDays++;
      }
      _sapPct = (sapDays / sapMonthWorkDays) * 100;
    }

    // Compute SAP vs forecast variance (reusing same periods)
    const v = computeEmployeeVariance(
      emp,
      sapLookup,
      timelineStart,
      timelineEnd,
      chargeableCombined,
      enabledHolidayDates
    );

    return {
      ...emp,
      _displayTU: m.tu,
      _displayTO: m.to,
      _displayNetH: m.netH,
      _displayChH: m.chargeableH,
      _displayTrH: m.trainingH,
      _sapPct,
      _varianceRate: v.varianceRate ?? undefined,
      _varianceHours: v.varianceHours ?? undefined,
      _hoursInfo: m as EmployeeGridMetrics,
    };
  });
};

// ─── Daily Grid — single source of truth for all per-day computations ───────

/** Shared weekend singleton to avoid allocating identical objects per employee */
const WEEKEND_CELL: DailyCell = {
  dateStr: "",
  isWE: true,
  isHoliday: false,
  absU: 0,
  chU: 0,
  goU: 0,
  trU: 0,
  otU: 0,
  rawGoU: 0,
  cappedAbsU: 0,
  cappedChU: 0,
  cappedGoU: 0,
  cappedTrU: 0,
  cappedTotal: 0,
  tuRate: 0,
  toRate: 0,
  netU: 0,
  segments: [],
  absScale: 1,
  chScale: 1,
  goScale: 1,
  trScale: 1,
  isSap: false,
  forecastSegments: null,
  forecastTuRate: null,
  forecastChU: null,
  forecastAbsRate: null,
  hasStaffing: false,
  dayWorkUtils: null,
};

/**
 * Build segment periods from consolidated assignments, preserving job metadata for tooltips.
 */
const buildSegmentPeriods = (
  consolidated: ConsolidatedAssignment[]
): Array<{ start: number; end: number; util: number; jobName: string; jobNo: string | null; category: string }> => {
  if (!consolidated) return [];
  const periods: Array<{
    start: number;
    end: number;
    util: number;
    jobName: string;
    jobNo: string | null;
    category: string;
  }> = [];
  for (const job of consolidated) {
    for (const p of job.periods) {
      const ps = new Date(p.startDate);
      ps.setHours(0, 0, 0, 0);
      const pe = new Date(p.endDate);
      pe.setHours(0, 0, 0, 0);
      periods.push({
        start: ps.getTime(),
        end: pe.getTime(),
        util: p.utilization || 0,
        jobName: job.jobName,
        jobNo: job.jobNo || null,
        category: job.category,
      });
    }
  }
  return periods;
};

/**
 * Build the unified daily grid for all employees in a single O(E×D×P) pass.
 *
 * Orchestrates focused sub-functions from dailyGridBuilder.ts:
 *   - buildPeriodIndex()          → O(1) day lookups
 *   - computeDayCellSegments()    → segments + raw utilization per day
 *   - assembleDailyCell()         → capping, rates, final DailyCell
 *   - buildWeekendSapCell()       → weekend days with SAP data
 *   - accumulateFromCachedCell()  → metric re-accumulation from cache
 *   - accumulateFromNewCell()     → metric accumulation from fresh cells
 *   - computeEmployeeMetrics()    → TU/TO/frag/variance/transition loss
 *
 * @returns Map<empId, EmployeeDailyData> with pre-computed cells and metrics
 */
export const buildDailyGrid = (
  employees: Employee[],
  calendar: CalendarDay[],
  sapLookup: Record<string, any> | null,
  chargeableCombined: boolean,
  enabledHolidayDates: string[],
  sapMonthDateStrs: Set<string>,
  sapMonthWorkDays: number,
  cellCache?: Map<string, DailyCell>,
  dataSourceFilter?: "sap"
): Map<string, EmployeeDailyData> => {
  const grid = new Map<string, EmployeeDailyData>();
  const totalDays = calendar ? calendar.length : 0;
  if (totalDays === 0) return grid;

  const todayStrNorm = getToday();
  const currentMonthStartStrGlobal = todayStrNorm.slice(0, 7) + "-01";
  const todayStr = dataSourceFilter === "sap" ? todayStrNorm : "";
  const currentMonthStartStr = dataSourceFilter === "sap" ? todayStr.slice(0, 7) + "-01" : "";
  const nextMonthStartStr =
    dataSourceFilter === "sap"
      ? (() => {
          const d = new Date(todayStr);
          d.setMonth(d.getMonth() + 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        })()
      : "";

  // Grid-level settings (constant for all employees)
  const settings: GridSettings = {
    chargeableCombined,
    dataSourceFilter,
    currentMonthStartStr,
    currentMonthStartStrGlobal,
    nextMonthStartStr,
  };

  for (const emp of employees) {
    const HPD = getHoursPerDay(emp.grade);
    const empId = emp.empId;
    const consolidated = emp._consolidated || consolidateAssignments(emp.assignments);
    const segmentPeriods = buildSegmentPeriods(consolidated);
    const periodsByTs = buildPeriodIndex(segmentPeriods);

    // SAP data for this employee
    const empSap = sapLookup ? sapLookup[empId] || (emp._realEmpId ? sapLookup[emp._realEmpId] : null) : null;
    let sapMinDate: string | null = null;
    let sapMaxDate: string | null = null;
    if (empSap) {
      for (const ds of Object.keys(empSap)) {
        if (!sapMinDate || ds < sapMinDate) sapMinDate = ds;
        if (!sapMaxDate || ds > sapMaxDate) sapMaxDate = ds;
      }
    }

    // Employee-level context (constant for all days of this employee)
    const empCtx: EmpContext = { empSap, sapMinDate, sapMaxDate, HPD, periodsByTs };

    const acc = createEmptyAccumulators();
    const cells: DailyCell[] = new Array(totalDays);

    for (let d = 0; d < totalDays; d++) {
      const { isWE, dateStr, ts, isHoliday } = calendar[d];

      // ── Weekend ──
      if (isWE) {
        const weCell = buildWeekendSapCell(dateStr, empSap, HPD, chargeableCombined);
        if (!weCell) {
          cells[d] = WEEKEND_CELL;
          continue;
        }
        cells[d] = weCell;
        acc.weekendSapDays++;
        acc.chargeableUtil += weCell.cappedChU;
        acc.absenceUtil += weCell.cappedAbsU;
        acc.generalOpptyUtil += weCell.cappedGoU;
        acc.trainingUtil += weCell.cappedTrU;
        acc.otherUtil += Math.min(
          weCell.otU,
          Math.max(0, weCell.netU - weCell.cappedChU - weCell.cappedGoU - weCell.cappedTrU)
        );
        continue;
      }

      acc.workDays++;

      // ── Cache hit ──
      const cacheKey = cellCache ? `${empId}|${dateStr}` : null;
      const cached = cacheKey ? cellCache!.get(cacheKey) : null;
      if (cached) {
        cells[d] = cached;
        accumulateFromCachedCell(cached, acc, empSap, sapMonthDateStrs, chargeableCombined);
        continue;
      }

      // ── Employee presence ──
      const empArrival = emp._arrivalDate;
      const empDeparture = emp._departureDate;
      const isPresent = (!empArrival || dateStr >= empArrival) && (!empDeparture || dateStr <= empDeparture);

      // ── Build segments + assemble cell ──
      const day: DayInfo = { dateStr, ts, isHoliday };
      const result = computeDayCellSegments(day, isPresent, empCtx, settings);
      const cell = assembleDailyCell(day, isPresent, result, settings);
      cells[d] = cell;

      // Store in cache for reuse during future pans
      if (cacheKey) cellCache!.set(cacheKey, cell);

      // ── Accumulate metrics ──
      const isMdsAvailable = dateStr >= MDS_EXTRACT_START;
      accumulateFromNewCell(cell, result, acc, empSap, sapMonthDateStrs, isMdsAvailable);
    }

    const metrics = computeEmployeeMetrics(acc, HPD, sapMonthWorkDays);
    grid.set(empId, { empId, cells, metrics });
  }

  return grid;
};
