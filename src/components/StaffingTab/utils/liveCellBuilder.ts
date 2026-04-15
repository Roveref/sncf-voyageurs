/**
 * liveCellBuilder.ts — Pure utility functions extracted from EmployeeRow.
 *
 * buildLiveDailyCells: builds daily cells for live preview during bulk edit.
 * computeJobHoursAndDays: shared hours/days computation used by getJobLabel & getJobLabelParts.
 */
import { capUtilizations, computeTuRate, computeToRate } from "./calcPrimitives";
import { isHolidayEnabled } from "./dateUtils";
import { HOURS_PER_DAY, MDS_EXTRACT_START, CHARGEABLE_CATS, GO_CATS, ABSENCE_CATS, TRAINING_CATS } from "../constants";
import type { Assignment, CalendarDay, DailyCell } from "../types";

// ── buildLiveDailyCells ────────────────────────────────────────────────────────

export function buildLiveDailyCells(params: {
  calendar: CalendarDay[];
  chartAssignments: Assignment[];
  chargeableCombined: boolean;
}): DailyCell[] | null {
  const { calendar, chartAssignments, chargeableCombined } = params;

  if (!calendar || calendar.length === 0) return null;

  const totalDays = calendar.length;

  // Build segment periods from consolidated live assignments (timestamp-based for fast lookup)
  const segPeriods: {
    start: number;
    end: number;
    util: number;
    name: string;
    jobNo: string | null;
    category: string;
    isNew: boolean;
  }[] = [];
  for (const job of chartAssignments) {
    for (const p of job.periods) {
      const ps = new Date(p.startDate);
      ps.setHours(0, 0, 0, 0);
      const pe = new Date(p.endDate);
      pe.setHours(0, 0, 0, 0);
      segPeriods.push({
        start: ps.getTime(),
        end: pe.getTime(),
        util: p.utilization || 0,
        name: job.jobName,
        jobNo: job.jobNo,
        category: job.category,
        isNew: !!job._isNewCreation,
      });
    }
  }

  const cells = new Array(totalDays);
  for (let d = 0; d < totalDays; d++) {
    const cal = calendar[d];
    if (cal.isWE) {
      cells[d] = {
        dateStr: cal.dateStr,
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
      continue;
    }
    if (cal.isHoliday) {
      cells[d] = {
        dateStr: cal.dateStr,
        isWE: false,
        isHoliday: true,
        absU: 100,
        chU: 0,
        goU: 0,
        trU: 0,
        otU: 0,
        rawGoU: 0,
        cappedAbsU: 100,
        cappedChU: 0,
        cappedGoU: 0,
        cappedTrU: 0,
        cappedTotal: 100,
        tuRate: 0,
        toRate: 0,
        netU: 0,
        segments: [{ name: "Holiday", jobNo: null, category: "holiday", util: 100 }],
        absScale: 1,
        chScale: 1,
        goScale: 1,
        trScale: 1,
        isSap: false,
        forecastSegments: null,
        forecastTuRate: null,
        forecastChU: null,
        forecastAbsRate: null,
        hasStaffing: true,
        dayWorkUtils: null,
      };
      continue;
    }
    // Skip days before MDS_EXTRACT_START — treat as empty
    if (cal.dateStr < MDS_EXTRACT_START) {
      cells[d] = {
        dateStr: cal.dateStr,
        isWE: false,
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
      continue;
    }
    // Working day: accumulate utilizations from overlapping segments
    let absU = 0,
      chU = 0,
      goU = 0,
      trU = 0,
      otU = 0,
      rawGoU = 0;
    let existingWork = 0,
      existingCh = 0,
      newCh = 0,
      newWork = 0;
    const segs: { name: string; jobNo: string | null; category: string; util: number }[] = [];
    const ts = cal.ts;
    for (const sp of segPeriods) {
      if (ts >= sp.start && ts <= sp.end) {
        segs.push({ name: sp.name, jobNo: sp.jobNo, category: sp.category, util: sp.util });
        if (ABSENCE_CATS.has(sp.category)) {
          absU += sp.util;
        } else if (CHARGEABLE_CATS.has(sp.category)) {
          chU += sp.util;
          if (sp.isNew) {
            newCh += sp.util;
            newWork += sp.util;
          } else {
            existingCh += sp.util;
            existingWork += sp.util;
          }
        } else if (GO_CATS.has(sp.category)) {
          rawGoU += sp.util;
          if (chargeableCombined) {
            chU += sp.util;
            if (sp.isNew) {
              newCh += sp.util;
              newWork += sp.util;
            } else {
              existingCh += sp.util;
              existingWork += sp.util;
            }
          } else {
            goU += sp.util;
            if (sp.isNew) newWork += sp.util;
            else existingWork += sp.util;
          }
        } else if (TRAINING_CATS.has(sp.category)) {
          trU += sp.util;
          if (sp.isNew) newWork += sp.util;
          else existingWork += sp.util;
        } else {
          otU += sp.util;
          if (sp.isNew) newWork += sp.util;
          else existingWork += sp.util;
        }
      }
    }
    const cap = capUtilizations({ absU, chU, goU, trU, otU });
    // Existing capped to net, new assignment fills remaining capacity only for TU
    const remainingForNew = Math.max(0, cap.netU - existingWork);
    const effectiveCh = Math.min(existingCh, cap.netU) + Math.min(newCh, remainingForNew);
    const tuRate = computeTuRate(effectiveCh, cap.netU);
    const toRate = computeToRate(cap.cappedChU, cap.cappedGoU, cap.cappedTrU, cap.netU);
    cells[d] = {
      dateStr: cal.dateStr,
      isWE: false,
      isHoliday: false,
      absU,
      chU,
      goU,
      trU,
      otU,
      rawGoU,
      cappedAbsU: cap.cappedAbsU,
      cappedChU: cap.cappedChU,
      cappedGoU: cap.cappedGoU,
      cappedTrU: cap.cappedTrU,
      cappedTotal: cap.cappedAbsU + cap.cappedChU + cap.cappedGoU + cap.cappedTrU + cap.cappedOtU,
      effectiveChU: effectiveCh,
      tuRate,
      toRate,
      netU: cap.netU,
      segments: segs,
      absScale: 1,
      chScale: 1,
      goScale: 1,
      trScale: 1,
      isSap: false,
      forecastSegments: null,
      forecastTuRate: null,
      forecastChU: null,
      forecastAbsRate: null,
      hasStaffing: true,
      dayWorkUtils: null,
    };
  }
  return cells;
}

// ── computeJobHoursAndDays ──────────────────────────────────────────────────────

/**
 * Shared computation for getJobLabel / getJobLabelParts:
 * computes total hours and equivalent days for a job's periods within the visible timeline,
 * excluding weekends, public holidays, and MDS holiday assignments.
 */
export function computeJobHoursAndDays(params: {
  periods: { startDate: string; endDate: string; hoursPerDay?: number }[];
  tlStart: string;
  tlEnd: string;
  enabledHolidayDates: string[] | Set<string>;
  mdsHolidayDates: Set<string>;
}): { totalH: number; totalDays: number; hStr: string; dStr: string } {
  const { periods, tlStart, tlEnd, enabledHolidayDates, mdsHolidayDates } = params;

  let totalH = 0;
  for (const p of periods) {
    const pStart = p.startDate > tlStart ? p.startDate : tlStart;
    const pEnd = p.endDate < tlEnd ? p.endDate : tlEnd;
    if (pStart > pEnd) continue;
    const s = new Date(pStart);
    const e = new Date(pEnd);
    let wd = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const dtStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (isHolidayEnabled(dtStr, enabledHolidayDates) || mdsHolidayDates.has(dtStr)) continue;
      wd++;
    }
    totalH += wd * (p.hoursPerDay || HOURS_PER_DAY);
  }
  const totalDays = Math.round((totalH / HOURS_PER_DAY) * 10) / 10;
  const hStr = totalH % 1 === 0 ? `${totalH}` : `${totalH.toFixed(1)}`;
  const dStr = totalDays % 1 === 0 ? `${totalDays}` : `${totalDays.toFixed(1)}`;
  return { totalH, totalDays, hStr, dStr };
}

/**
 * Builds the MDS holiday date set from an employee's holiday assignments.
 * Extracted for reuse by getJobLabel / getJobLabelParts.
 */
export function buildMdsHolidayDates(assignments: Assignment[]): Set<string> {
  const mdsHolidayDates = new Set<string>();
  for (const a of assignments || []) {
    if (a.category !== "holiday") continue;
    const hs = new Date(a.startDate);
    hs.setHours(0, 0, 0, 0);
    const he = new Date(a.endDate);
    he.setHours(0, 0, 0, 0);
    for (let hd = new Date(hs); hd <= he; hd.setDate(hd.getDate() + 1)) {
      mdsHolidayDates.add(
        `${hd.getFullYear()}-${String(hd.getMonth() + 1).padStart(2, "0")}-${String(hd.getDate()).padStart(2, "0")}`
      );
    }
  }
  return mdsHolidayDates;
}
