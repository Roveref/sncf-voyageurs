/**
 * Shared test factories for creating typed test fixtures.
 * All factories return minimal valid objects — override specific fields as needed.
 */

import type {
  Employee,
  Assignment,
  DailyCell,
  DailyCellSegment,
  CalendarDay,
  SapRecord,
  EmployeeMetadata,
  GradeTransition,
} from "../components/StaffingTab/types";

// ─── Employee ──────────────────────────────────────────────────────────────

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    empId: "E001",
    name: "Test Employee",
    grade: "Consultant",
    subTeam: "FIN",
    assignments: [],
    trueUtilizationRate: 0,
    availableCapacityHours: 0,
    chargeableHours: 0,
    projectCount: 0,
    ...overrides,
  };
}

// ─── Assignment ────────────────────────────────────────────────────────────

export function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    _uid: `uid-${Math.random().toString(36).slice(2, 8)}`,
    empId: "E001",
    jobNo: "J001",
    jobName: "Test Project",
    startDate: "2025-01-06",
    endDate: "2025-03-31",
    utilization: 100,
    hoursPerDay: 8,
    workingDays: 60,
    totalHours: 480,
    status: "Confirmed",
    category: "Chargeable",
    ...overrides,
  };
}

// ─── CalendarDay ───────────────────────────────────────────────────────────

export function makeCalendarDay(dateStr: string, overrides: Partial<CalendarDay> = {}): CalendarDay {
  const d = new Date(dateStr);
  const dow = d.getDay();
  return {
    date: d,
    dow,
    isWE: dow === 0 || dow === 6,
    dateStr,
    ts: d.getTime(),
    month: d.getMonth(),
    isHoliday: false,
    ...overrides,
  };
}

/** Generate a range of CalendarDay objects between two ISO dates (inclusive) */
export function makeCalendarRange(startStr: string, endStr: string, holidays: Set<string> = new Set()): CalendarDay[] {
  const days: CalendarDay[] = [];
  const cursor = new Date(startStr);
  const end = new Date(endStr);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dow = cursor.getDay();
    const isWE = dow === 0 || dow === 6;
    days.push({
      date: new Date(cursor),
      dow,
      isWE,
      dateStr,
      ts: cursor.getTime(),
      month: cursor.getMonth(),
      isHoliday: !isWE && holidays.has(dateStr),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ─── DailyCell ─────────────────────────────────────────────────────────────

export function makeDailyCell(dateStr: string, overrides: Partial<DailyCell> = {}): DailyCell {
  return {
    dateStr,
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
    netU: 100,
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
    ...overrides,
  } as DailyCell;
}

// ─── DailyCellSegment ──────────────────────────────────────────────────────

export function makeSegment(overrides: Partial<DailyCellSegment> = {}): DailyCellSegment {
  return {
    name: "Test Project",
    jobNo: "J001",
    category: "Chargeable",
    util: 100,
    ...overrides,
  };
}

// ─── SapRecord ─────────────────────────────────────────────────────────────

export function makeSapRecord(overrides: Partial<SapRecord> = {}): SapRecord {
  return {
    category: "Chargeable",
    hours: 8,
    ...overrides,
  };
}

// ─── EmployeeMetadata ──────────────────────────────────────────────────────

export function makeMetadata(overrides: Partial<EmployeeMetadata> = {}): EmployeeMetadata {
  return {
    gradeHistory: [{ grade: "Consultant", since: "2024-01-01" }],
    ...overrides,
  };
}

// ─── GradeTransition ───────────────────────────────────────────────────────

export function makeGradeTransition(overrides: Partial<GradeTransition> = {}): GradeTransition {
  return {
    grade: "Consultant",
    since: "2024-01-01",
    ...overrides,
  };
}
