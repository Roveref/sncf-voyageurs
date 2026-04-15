/**
 * gridCalc.ts — Server-side raw segment computation.
 *
 * Returns per-employee per-day SEGMENTS IN HOURS only.
 * NO capping, NO TU%, NO metrics — those are computed client-side by buildDailyGrid.
 * This ensures the AI agent and frontend use the same raw data source.
 */

import db from "../../db/database.js";
import {
  loadEmployees,
  loadAssignments,
  indexByEmpId,
  hpd,
  isPublicHoliday,
  getEffectiveGrade,
  getEtpRatio,
  getSapDatesIndex,
} from "./shared.js";
import { ABSENCE_CATS } from "../../../../shared/staffingConstants.js";

// ── Types ──

export interface GridSegment {
  jobNo: string;
  jobName: string;
  category: string;
  hours: number;
  segment?: string;
  serviceLine?: string;
}

export interface GridDay {
  segments: GridSegment[];
  sapSegments: GridSegment[] | null;
  isSap: boolean;
  isPresent: boolean;
  isForcedAbsence?: boolean;
  hpd: number;
}

export interface EmployeeGridData {
  empId: string;
  hpd: number;
  days: Record<string, GridDay>;
}

export interface CalendarDay {
  dateStr: string;
  dow: number;
  isWE: boolean;
  isHoliday: boolean;
}

export interface GridResult {
  calendar: CalendarDay[];
  grid: Record<string, EmployeeGridData>;
  computeMs: number;
}

// ── Jobcode → segment/serviceLine mapping from CRM ──

function loadJobcodeMapping(): Map<string, { segment: string; serviceLine: string }> {
  const map = new Map<string, { segment: string; serviceLine: string }>();
  try {
    const rows = db
      .prepare(
        "SELECT jobCode, subSegmentCode, serviceLine1 FROM crm_opportunities WHERE jobCode IS NOT NULL AND jobCode != ''"
      )
      .all() as { jobCode: string; subSegmentCode: string; serviceLine1: string }[];
    for (const r of rows) {
      map.set(r.jobCode, {
        segment: r.subSegmentCode || "",
        serviceLine: r.serviceLine1 && r.serviceLine1 !== "-" ? r.serviceLine1 : "",
      });
    }
  } catch {
    /* CRM data optional */
  }
  return map;
}

// ── SAP data loader ──

interface SapDayRecord {
  hours: number;
  category: string;
  salesOrder: string;
  text: string;
}

function loadSapLookup(): Record<string, Record<string, SapDayRecord[]>> {
  const lookup: Record<string, Record<string, SapDayRecord[]>> = {};
  try {
    const rows = db
      .prepare("SELECT empId, date, hours, category, salesOrder, text FROM sap_records ORDER BY empId, date")
      .all() as { empId: string; date: string; hours: number; category: string; salesOrder: string; text: string }[];
    for (const r of rows) {
      if (!lookup[r.empId]) lookup[r.empId] = {};
      if (!lookup[r.empId][r.date]) lookup[r.empId][r.date] = [];
      lookup[r.empId][r.date].push({ hours: r.hours, category: r.category, salesOrder: r.salesOrder, text: r.text });
    }
  } catch {
    /* SAP data optional */
  }
  return lookup;
}

// ── Main computation — RAW SEGMENTS ONLY ──

export function computeGrid(startDate?: string, endDate?: string): GridResult {
  const t0 = Date.now();
  const now = new Date();

  // Load data first so we can derive the range from actual data
  const empRows = loadEmployees();
  const assRows = loadAssignments();
  const assByEmp = indexByEmpId(assRows);
  const sapLookup = loadSapLookup();
  const sapDatesIndex = getSapDatesIndex();
  const jobcodeMap = loadJobcodeMapping();
  const currentMonthStr = now.toISOString().slice(0, 7);

  // Default range: cover ALL data (SAP min → MDS max, with padding)
  let defaultStart = `${now.getFullYear() - 1}-01-01`;
  let defaultEnd = `${now.getFullYear() + 1}-12-31`;
  for (const empDays of Object.values(sapLookup)) {
    for (const dateStr of Object.keys(empDays as Record<string, any>)) {
      if (dateStr < defaultStart) defaultStart = dateStr;
    }
  }
  for (const a of assRows) {
    if (a.endDate > defaultEnd) defaultEnd = a.endDate;
  }

  const start = startDate || defaultStart;
  const end = endDate || defaultEnd;

  // Build calendar
  const calendar: CalendarDay[] = [];
  const d = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");
  while (d <= endD) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    calendar.push({ dateStr, dow, isWE: dow === 0 || dow === 6, isHoliday: isPublicHoliday(dateStr) });
    d.setDate(d.getDate() + 1);
  }

  const workDays = calendar.filter((c) => !c.isWE && !c.isHoliday);

  // Compute grid — raw segments only
  const grid: Record<string, EmployeeGridData> = {};

  for (const emp of empRows) {
    const empAssignments = assByEmp.get(emp.empId) || [];
    const empHpd = hpd(emp.grade);
    const empSapDates = sapDatesIndex.get(emp.empId);
    const empSap = sapLookup[emp.empId];

    const days: Record<string, GridDay> = {};

    for (const day of workDays) {
      const dateStr = day.dateStr;

      // Presence check
      if (emp.arrival && dateStr < emp.arrival) {
        days[dateStr] = { segments: [], sapSegments: null, isSap: false, isPresent: false, hpd: empHpd };
        continue;
      }
      if (emp.departure && dateStr > emp.departure) {
        days[dateStr] = { segments: [], sapSegments: null, isSap: false, isPresent: false, hpd: empHpd };
        continue;
      }

      const etpRatio = getEtpRatio(emp.etpAdjustments, dateStr);
      const effectiveGrade = getEffectiveGrade(emp.gradeHistory, dateStr) || emp.grade;
      const dayHpd = hpd(effectiveGrade) * etpRatio;

      // Forced absence: past month with SAP data elsewhere but nothing this day
      if (empSapDates && empSapDates.size > 0 && dateStr.slice(0, 7) < currentMonthStr && !empSapDates.has(dateStr)) {
        days[dateStr] = {
          segments: [{ jobNo: "", jobName: "Forced Absence", category: "otherAbsence", hours: dayHpd }],
          sapSegments: null,
          isSap: false,
          isPresent: true,
          isForcedAbsence: true,
          hpd: dayHpd,
        };
        continue;
      }

      // Build MDS segments for this day
      const segments: GridSegment[] = [];
      for (const a of empAssignments) {
        if (dateStr >= a.startDate && dateStr <= a.endDate) {
          const segHours = (a.utilization / 100) * dayHpd;
          const jcInfo = jobcodeMap.get(a.jobNo);
          segments.push({
            jobNo: a.jobNo,
            jobName: a.jobName,
            category: a.category,
            hours: Math.round(segHours * 100) / 100,
            segment: jcInfo?.segment,
            serviceLine: jcInfo?.serviceLine,
          });
        }
      }

      // SAP segments for this day
      let sapSegments: GridSegment[] | null = null;
      if (empSap && empSap[dateStr]) {
        sapSegments = empSap[dateStr].map((r) => ({
          jobNo: r.salesOrder || "",
          jobName: r.text || r.salesOrder || "",
          category: r.category,
          hours: Math.round(r.hours * 100) / 100,
        }));
      }

      days[dateStr] = { segments, sapSegments, isSap: !!(empSap && empSap[dateStr]), isPresent: true, hpd: dayHpd };
    }

    grid[emp.empId] = { empId: emp.empId, hpd: empHpd, days };
  }

  return { calendar, grid, computeMs: Date.now() - t0 };
}
