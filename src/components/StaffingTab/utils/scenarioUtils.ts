import type {
  AssignmentOverride,
  EmployeeOverride,
  EmployeeMetadata,
  StaffingRecord,
  StaffingNeedItem,
} from "../types";
import { getHoursPerDay } from "../constants";
import { countWorkingDaysInRange } from "./dateUtils";

/**
 * Build a composite key for an assignment override.
 * endDate is included when provided to avoid collisions between assignments
 * with the same empId+jobNo+startDate but different endDates.
 */
export const assignmentKey = (empId: string, jobNo: string, startDate: string, endDate?: string): string =>
  endDate ? `${empId}::${jobNo}::${startDate}::${endDate}` : `${empId}::${jobNo}::${startDate}`;

/**
 * Normalize a date value to YYYY-MM-DD string.
 */
const toDateStr = (d: Date | string): string => {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) {
    // Use local date to avoid UTC timezone shift
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d);
};

/**
 * Apply assignment overrides (from a resolved scenario) on top of base raw data.
 * Returns a new array — does not mutate baseData.
 */
export const applyAssignmentOverrides = (
  baseData: StaffingRecord[],
  overrides: Record<string, AssignmentOverride>
): StaffingRecord[] => {
  if (!overrides || Object.keys(overrides).length === 0) return baseData;

  // Index overrides by type for efficient processing
  const deletes = new Set<string>();
  const edits = new Map<string, AssignmentOverride>();
  const creates: AssignmentOverride[] = [];

  Object.entries(overrides).forEach(([key, ov]) => {
    switch (ov.type) {
      case "delete":
        deletes.add(key);
        break;
      case "edit":
        edits.set(key, ov);
        break;
      case "create":
        creates.push(ov);
        break;
    }
  });

  // Process base data: filter deletes, apply edits
  const result = baseData
    .filter((r) => {
      const key = assignmentKey(r.empId, r.jobNo, toDateStr(r.startDate));
      return !deletes.has(key);
    })
    .map((r) => {
      const key = assignmentKey(r.empId, r.jobNo, toDateStr(r.startDate));
      const edit = edits.get(key);
      if (edit) {
        const merged = { ...r, ...edit.data, isModified: true };
        // Ensure utilization is a number and hoursPerDay is consistent
        if (edit.data.utilization != null) {
          merged.utilization = parseFloat(String(edit.data.utilization)) || r.utilization;
          // Derive base HPD from original record (grade-aware) or fallback to 8
          const baseHPD = r.utilization > 0 ? (r.hoursPerDay ?? 8) / (r.utilization / 100) : 8;
          merged.hoursPerDay = (merged.utilization / 100) * baseHPD;
        }
        if (edit.data.startDate) merged.startDateParsed = edit.data.startDate;
        if (edit.data.endDate) merged.endDateParsed = edit.data.endDate;
        return merged;
      }
      return r;
    });

  // Append creates
  creates.forEach((ov) => {
    const util = parseFloat(String(ov.data.utilization)) || 100;
    result.push({
      ...ov.data,
      _uid: ov.data._uid || crypto.randomUUID(),
      utilization: util,
      startDateParsed: ov.data.startDate,
      endDateParsed: ov.data.endDate,
      hoursPerDay: ov.data.hoursPerDay || (util / 100) * 8,
      isNew: true,
    } as StaffingRecord);
  });

  return result;
};

/**
 * Merge employee overrides (from a resolved scenario) on top of base metadata.
 * Returns a new object — does not mutate baseMetadata.
 */
export const mergeEmployeeOverrides = (
  baseMetadata: Record<string, EmployeeMetadata>,
  overrides: Record<string, EmployeeOverride>
): Record<string, EmployeeMetadata> => {
  if (!overrides || Object.keys(overrides).length === 0) return baseMetadata;

  const merged = { ...baseMetadata };
  Object.entries(overrides).forEach(([empId, ov]) => {
    if (ov.metadata) {
      const base = merged[empId] || ({} as EmployeeMetadata);
      merged[empId] = { ...base, ...ov.metadata } as EmployeeMetadata;
    }
  });
  return merged;
};

/**
 * Compute delta between real and scenario team stats.
 */
export const computeScenarioDelta = (
  realStats: { currentTU: number; totalNet?: number; totalCh?: number },
  scenarioStats: { currentTU: number; totalNet?: number; totalCh?: number }
): { deltaTU: number; deltaChH: number; deltaNetH: number } => ({
  deltaTU: scenarioStats.currentTU - realStats.currentTU,
  deltaChH: (scenarioStats.totalCh || 0) - (realStats.totalCh || 0),
  deltaNetH: (scenarioStats.totalNet || 0) - (realStats.totalNet || 0),
});

import { useUserDataStore } from "../../../stores/useUserDataStore";

/**
 * Read all staffing needs from the store.
 */
export const readAllStaffingNeeds = (): StaffingNeedItem[] => {
  const all: StaffingNeedItem[] = [];
  Object.entries(useUserDataStore.getState().staffingNeeds).forEach(([opportunityId, items]) => {
    items.forEach((n) => all.push({ ...n, opportunityId: n.opportunityId || opportunityId }));
  });
  return all;
};

/**
 * Compute extra chargeable hours from staffing needs that overlap a given time bucket.
 * Returns the total additional hours to add to the numerator (totalCh) of TU calculation.
 * Does NOT add to the denominator (totalNet) — this is the key difference vs creating virtual employees.
 *
 * @param needs - Array of staffing needs (from readAllStaffingNeeds)
 * @param bStart - Bucket start date
 * @param bEnd - Bucket end date
 * @param enabledHolidayDates - Holiday dates to exclude from working days
 * @param probabilized - If true, weight hours by each need's probability
 */
/**
 * Grade-capped infinite capacity: for each grade, cap (existing_ch + needs_ch) at the grade's net capacity.
 * Returns the total capped chargeable hours across all grades.
 */
export const computeGradeCappedInfiniteCh = (
  needs: StaffingNeedItem[],
  bStart: Date,
  bEnd: Date,
  enabledHolidayDates: Set<string> | string[] | null,
  gradeBreakdown: Record<string, { ch: number; net: number }>,
  probabilized: boolean
): number => {
  const WORK_H = 8;
  const isHoliday = enabledHolidayDates
    ? enabledHolidayDates instanceof Set
      ? (d: string) => enabledHolidayDates.has(d)
      : (d: string) => (enabledHolidayDates as string[]).includes(d)
    : () => false;

  // Accumulate needs hours per grade
  const needsPerGrade: Record<string, number> = {};
  for (const need of needs) {
    const qty = Math.max(1, parseInt(need.quantity) || 1);
    const needStart = need.startDate ? new Date(need.startDate) : null;
    const needEnd = need.endDate ? new Date(need.endDate) : null;
    if (!needStart || !needEnd || isNaN(needStart.getTime()) || isNaN(needEnd.getTime())) continue;
    if (needEnd <= bStart || needStart >= bEnd) continue;

    const overlapStart = needStart > bStart ? needStart : bStart;
    const overlapEnd = needEnd < bEnd ? needEnd : bEnd;

    const workDays = countWorkingDaysInRange(overlapStart, overlapEnd, isHoliday);

    const probability = Math.max(0, Math.min(1, need.probability ?? 1));
    if (probabilized && probability === 0) continue;
    const util = probabilized ? probability : 1;
    const grade = need.grade || "Unknown";
    needsPerGrade[grade] = (needsPerGrade[grade] || 0) + qty * workDays * WORK_H * util;
  }

  // For each grade: cap (existing_ch + needs_ch) at net capacity
  let totalCappedCh = 0;
  const allGrades = new Set([...Object.keys(gradeBreakdown), ...Object.keys(needsPerGrade)]);
  for (const grade of allGrades) {
    const existing = gradeBreakdown[grade] || { ch: 0, net: 0 };
    const needsH = needsPerGrade[grade] || 0;
    // Cap at grade's net capacity (can't exceed 100% TU for that grade)
    totalCappedCh += Math.min(existing.ch + needsH, existing.net);
  }

  return totalCappedCh;
};

export const computeNeedsExtraHours = (
  needs: StaffingNeedItem[],
  bStart: Date,
  bEnd: Date,
  enabledHolidayDates: Set<string> | string[] | null,
  probabilized: boolean
): number => {
  let extraH = 0;
  const WORK_H = 8;

  // Normalize holiday lookup: support both Set and Array
  const isHoliday = enabledHolidayDates
    ? enabledHolidayDates instanceof Set
      ? (d: string) => enabledHolidayDates.has(d)
      : (d: string) => (enabledHolidayDates as string[]).includes(d)
    : () => false;

  for (const need of needs) {
    const qty = Math.max(1, parseInt(need.quantity) || 1);
    const needStart = need.startDate ? new Date(need.startDate) : null;
    const needEnd = need.endDate ? new Date(need.endDate) : null;
    if (!needStart || !needEnd || isNaN(needStart.getTime()) || isNaN(needEnd.getTime())) continue;

    // Check overlap with bucket
    if (needEnd <= bStart || needStart >= bEnd) continue;

    const overlapStart = needStart > bStart ? needStart : bStart;
    const overlapEnd = needEnd < bEnd ? needEnd : bEnd;

    // Count working days in overlap (exclude weekends + holidays)
    const workDays = countWorkingDaysInRange(overlapStart, overlapEnd, isHoliday);

    const probability = Math.max(0, Math.min(1, need.probability ?? 1));
    if (probabilized && probability === 0) continue;

    const util = probabilized ? probability : 1;
    extraH += qty * workDays * WORK_H * util;
  }

  return extraH;
};
