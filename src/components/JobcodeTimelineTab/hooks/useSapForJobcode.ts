/**
 * useSapForJobcode — for a given jobcode, collect every employee who
 * charged SAP hours on it, aggregate their time into contiguous periods,
 * and return them ready to be rendered as nested rows under the jobcode
 * group header.
 *
 * Join: `sap_records.salesOrder === jobCode` (confirmed by
 * `EmployeeRowSapSection.tsx:116` and `api/src/services/dummyData.ts:803`).
 *
 * The SAP lookup shape is `Record<empId, Record<dateStr, SapDayData>>`
 * where `SapDayData.records` is the per-day array of raw SAP rows.
 * Each row contains `salesOrder` among other dynamic fields.
 */
import { useMemo } from "react";
import { useSapData } from "../../../queries/useSapData";
import { useStaffingData } from "../../../queries/useStaffingData";

export interface SapEmployeePeriod {
  /** First date of a contiguous charging window (inclusive). */
  startDate: string;
  /** Last date of a contiguous charging window (inclusive). */
  endDate: string;
  /** Total hours charged in the period. */
  totalHours: number;
  /** Dominant category in the period (for colouring). */
  category: string;
}

export interface SapEmployeeForJobcode {
  empId: string;
  name: string;
  grade: string;
  totalHours: number;
  totalDays: number;
  periods: SapEmployeePeriod[];
  /** Dominant category across the whole jobcode charge. */
  dominantCategory: string;
}

/**
 * Build contiguous periods from a sorted list of dates, bridging weekends
 * and holidays naturally (up to 3-day gaps).
 */
function buildPeriodsFromDates(dateMap: Map<string, { hours: number; category: string }>): SapEmployeePeriod[] {
  if (dateMap.size === 0) return [];
  const sorted = Array.from(dateMap.keys()).sort();
  const periods: SapEmployeePeriod[] = [];

  let startDate = sorted[0];
  let prevDate = sorted[0];
  let windowHours = 0;
  const windowCategoryCounts: Record<string, number> = {};

  const pushWindow = () => {
    // Pick the dominant category in this window.
    let dominant = "other";
    let max = -1;
    for (const [cat, count] of Object.entries(windowCategoryCounts)) {
      if (count > max) {
        max = count;
        dominant = cat;
      }
    }
    periods.push({ startDate, endDate: prevDate, totalHours: windowHours, category: dominant });
  };

  for (const date of sorted) {
    const entry = dateMap.get(date)!;
    if (date === startDate) {
      windowHours = entry.hours;
      windowCategoryCounts[entry.category] = 1;
      continue;
    }
    const prev = new Date(prevDate);
    const cur = new Date(date);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    // Bridge weekends and short gaps so the period bar renders as a single block.
    const bridged = diffDays <= 3;
    if (bridged) {
      windowHours += entry.hours;
      windowCategoryCounts[entry.category] = (windowCategoryCounts[entry.category] || 0) + 1;
      prevDate = date;
    } else {
      pushWindow();
      startDate = date;
      prevDate = date;
      windowHours = entry.hours;
      for (const k of Object.keys(windowCategoryCounts)) delete windowCategoryCounts[k];
      windowCategoryCounts[entry.category] = 1;
    }
  }
  pushWindow();
  return periods;
}

export function useSapForJobcode(jobcode: string | null | undefined): SapEmployeeForJobcode[] {
  const { sapData } = useSapData();
  const { records: staffingRecords } = useStaffingData();

  return useMemo(() => {
    if (!jobcode || !sapData?.lookup) return [];
    const target = jobcode.trim().toUpperCase();
    if (!target) return [];

    // First pass: collect per-employee date→{hours, category} maps + capture
    // the name embedded in the matching SAP record (sap_records.name column).
    // Mirrors the resolution pattern in `buildSapOnlyEmployees`
    // (StaffingTab/utils/dataProcessing.ts:143).
    const byEmployee = new Map<string, Map<string, { hours: number; category: string }>>();
    const sapNameByEmp = new Map<string, string>();

    for (const [empId, perDay] of Object.entries(sapData.lookup)) {
      for (const [dateStr, day] of Object.entries(perDay)) {
        const records = (
          day as {
            records?: { salesOrder?: string; hours?: number; category?: string; name?: string }[];
          }
        ).records;
        if (!records) continue;
        let hoursForDate = 0;
        const catCounts: Record<string, number> = {};
        for (const rec of records) {
          if (!rec.salesOrder) continue;
          if (rec.salesOrder.trim().toUpperCase() !== target) continue;
          hoursForDate += rec.hours || 0;
          const cat = rec.category || "other";
          catCounts[cat] = (catCounts[cat] || 0) + 1;
          const recName = (rec.name || "").trim();
          if (recName && !sapNameByEmp.has(empId)) {
            sapNameByEmp.set(empId, recName);
          }
        }
        if (hoursForDate <= 0) continue;
        // Dominant category for this day
        let dominant = "other";
        let max = -1;
        for (const [cat, count] of Object.entries(catCounts)) {
          if (count > max) {
            max = count;
            dominant = cat;
          }
        }
        let empMap = byEmployee.get(empId);
        if (!empMap) {
          empMap = new Map();
          byEmployee.set(empId, empMap);
        }
        empMap.set(dateStr, { hours: hoursForDate, category: dominant });
      }
    }

    // Second pass: employee metadata from staffingRecords (firstName+lastName).
    // For employees absent from staffingRecords (no MDS assignment), we fall
    // back to the name captured from sap_records.name above.
    const empMeta = new Map<string, { name: string; grade: string }>();
    for (const rec of staffingRecords) {
      if (empMeta.has(rec.empId)) continue;
      const first = (rec.firstName || "").trim();
      const last = (rec.lastName || "").trim();
      const name = `${first} ${last}`.trim() || rec.empId;
      empMeta.set(rec.empId, { name, grade: rec.grade || "" });
    }

    // Third pass: build the result, sorted by total hours desc.
    const result: SapEmployeeForJobcode[] = [];
    for (const [empId, dateMap] of byEmployee.entries()) {
      const meta = empMeta.get(empId) ?? { name: sapNameByEmp.get(empId) || empId, grade: "" };
      const name = meta.name;
      const grade = meta.grade;
      const periods = buildPeriodsFromDates(dateMap);
      let totalHours = 0;
      const categoryCounts: Record<string, number> = {};
      for (const entry of dateMap.values()) {
        totalHours += entry.hours;
        categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      }
      let dominantCategory = "other";
      let max = -1;
      for (const [cat, count] of Object.entries(categoryCounts)) {
        if (count > max) {
          max = count;
          dominantCategory = cat;
        }
      }
      result.push({
        empId,
        name,
        grade,
        totalHours,
        totalDays: dateMap.size,
        periods,
        dominantCategory,
      });
    }
    result.sort((a, b) => b.totalHours - a.totalHours);
    return result;
  }, [jobcode, sapData, staffingRecords]);
}
