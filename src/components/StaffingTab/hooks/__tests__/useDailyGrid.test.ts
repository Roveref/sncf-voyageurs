/**
 * Tests for the pure functions consumed by useDailyGrid:
 *   - buildEmployeeStructures   (Phase-1 parser in dataProcessing.ts)
 *   - consolidateAssignments    (groups periods by jobNo)
 *   - normalizePeriods          (flattens consolidated → timestamp array)
 *
 * useDailyGrid itself is a React hook and is not tested here; these tests cover
 * the deterministic computation layer it delegates to.
 */
import { describe, it, expect } from "vitest";
import { buildEmployeeStructures, consolidateAssignments, normalizePeriods } from "../../utils/dataProcessing";
import type { StaffingRecord, Assignment } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal StaffingRecord for a given employee/job combination. */
const makeRecord = (overrides: Partial<StaffingRecord> = {}): StaffingRecord => ({
  empId: "E001",
  firstName: "Jean",
  lastName: "Dupont",
  jobNo: "J100",
  jobName: "Project Alpha",
  startDate: "2025-01-06",
  endDate: "2025-01-10",
  utilization: 100,
  category: "chargeable",
  status: "active",
  ...overrides,
});

/** Build a minimal Assignment object. */
const makeAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  _uid: "uid-1",
  empId: "E001",
  jobNo: "J100",
  jobName: "Project Alpha",
  startDate: "2025-01-06",
  endDate: "2025-01-10",
  utilization: 100,
  hoursPerDay: 8,
  workingDays: 5,
  totalHours: 40,
  status: "active",
  category: "chargeable",
  ...overrides,
});

// ─── buildEmployeeStructures — additional edge cases ─────────────────────────
//
// Basic happy-path tests live in dataProcessing.test.ts.
// This suite focuses on the downstream _consolidated/_periods data used by
// the daily-grid engine.

describe("buildEmployeeStructures — downstream fields", () => {
  it("_consolidated groups periods by jobNo", () => {
    const records = [
      makeRecord({ jobNo: "J100", jobName: "Alpha", startDate: "2025-01-06", endDate: "2025-01-10" }),
      makeRecord({ jobNo: "J100", jobName: "Alpha", startDate: "2025-01-13", endDate: "2025-01-17" }),
      makeRecord({ jobNo: "J200", jobName: "Beta", startDate: "2025-02-03", endDate: "2025-02-07" }),
    ];
    const result = buildEmployeeStructures(records);
    expect(result).toHaveLength(1);
    const consolidated = result[0]._consolidated!;
    expect(consolidated).toHaveLength(2); // J100 and J200
    const alpha = consolidated.find((c: any) => c.jobNo === "J100");
    expect(alpha).toBeDefined();
    // Two non-adjacent weeks (weekend gap) are kept as separate periods
    expect(alpha!.periods).toHaveLength(2);
  });

  it("_periods is a flat array of {start, end, util, category}", () => {
    const result = buildEmployeeStructures([makeRecord()]);
    const periods = result[0]._periods!;
    expect(Array.isArray(periods)).toBe(true);
    expect(periods.length).toBeGreaterThan(0);
    const p = periods[0];
    expect(typeof p.start).toBe("number");
    expect(typeof p.end).toBe("number");
    expect(typeof p.util).toBe("number");
    expect(typeof p.category).toBe("string");
  });

  it("_searchIndex is lowercase and contains empId and jobName", () => {
    const result = buildEmployeeStructures([makeRecord({ empId: "E999", jobName: "Project ALPHA" })]);
    const idx = result[0]._searchIndex!;
    expect(typeof idx).toBe("string");
    expect(idx).toContain("e999");
    expect(idx).toContain("project alpha");
  });

  it("empty startDate or endDate produces no assignment (falsy guard)", () => {
    // parseDate returns null for empty string, so the if(startDate && endDate) guard fires
    const badRecord = makeRecord({ startDate: "", endDate: "" });
    const result = buildEmployeeStructures([badRecord]);
    // Employee created but with 0 assignments because parseDate("") returns null
    expect(result.length).toBeLessThanOrEqual(1);
    if (result.length === 1) {
      expect(result[0].assignments).toHaveLength(0);
    }
  });

  it("uses startDateParsed over startDate when provided", () => {
    const record = makeRecord({
      startDate: "garbage",
      startDateParsed: "2025-03-03",
      endDate: "garbage",
      endDateParsed: "2025-03-07",
    });
    const result = buildEmployeeStructures([record]);
    expect(result).toHaveLength(1);
    expect(result[0].assignments).toHaveLength(1);
  });

  it("employees accumulate correct project count across records", () => {
    const records = [
      makeRecord({ jobNo: "J1", jobName: "Alpha" }),
      makeRecord({ jobNo: "J2", jobName: "Beta" }),
      makeRecord({ jobNo: "J3", jobName: "Gamma" }),
    ];
    const result = buildEmployeeStructures(records);
    expect(result[0].projectCount).toBe(3);
  });

  it("holiday dates are excluded from workingDays count", () => {
    // 2025-01-06 (Mon) to 2025-01-10 (Fri) = 5 working days normally
    // Providing 2025-01-09 as a holiday → 4 working days
    const record = makeRecord({ startDate: "2025-01-06", endDate: "2025-01-10", utilization: 100 });
    const resultNoHoliday = buildEmployeeStructures([record]);
    const resultWithHoliday = buildEmployeeStructures([record], ["2025-01-09"]);
    const noHolWD = resultNoHoliday[0].assignments[0].workingDays;
    const withHolWD = resultWithHoliday[0].assignments[0].workingDays;
    expect(withHolWD).toBe(noHolWD - 1);
  });
});

// ─── consolidateAssignments ───────────────────────────────────────────────────

describe("consolidateAssignments", () => {
  it("returns empty array for empty input", () => {
    expect(consolidateAssignments([])).toHaveLength(0);
  });

  it("returns empty array for null/undefined input", () => {
    expect(consolidateAssignments(null as any)).toHaveLength(0);
    expect(consolidateAssignments(undefined as any)).toHaveLength(0);
  });

  it("groups two assignments under the same jobNo into one consolidated entry", () => {
    const assignments = [
      makeAssignment({ jobNo: "J100", startDate: "2025-01-06", endDate: "2025-01-10" }),
      makeAssignment({ jobNo: "J100", startDate: "2025-01-13", endDate: "2025-01-17" }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result).toHaveLength(1);
    expect(result[0].jobNo).toBe("J100");
  });

  it("keeps separate entries for different jobNos", () => {
    const assignments = [
      makeAssignment({ jobNo: "J100", jobName: "Alpha" }),
      makeAssignment({ jobNo: "J200", jobName: "Beta" }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result).toHaveLength(2);
    const jobNos = result.map((c) => c.jobNo).sort();
    expect(jobNos).toEqual(["J100", "J200"]);
  });

  it("merges strictly adjacent periods with same utilization and category", () => {
    // Jan 06 Mon → Jan 10 Fri, then Jan 11 Sat (day+1 from endDate) → Jan 15 Wed
    // mergeConsecutivePeriods merges when periodStart <= dayAfterEnd
    const assignments = [
      makeAssignment({
        jobNo: "J100",
        startDate: "2025-01-06",
        endDate: "2025-01-10",
        utilization: 100,
        category: "chargeable",
      }),
      makeAssignment({
        jobNo: "J100",
        startDate: "2025-01-11",
        endDate: "2025-01-15",
        utilization: 100,
        category: "chargeable",
      }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result[0].periods).toHaveLength(1); // merged because Jan 11 <= Jan 10 + 1
  });

  it("does NOT merge periods separated by a weekend gap", () => {
    // Week 1: Mon-Fri, Week 2: Mon-Fri — gap of Saturday+Sunday means Jan 13 > Jan 11 (Fri+1)
    const assignments = [
      makeAssignment({
        jobNo: "J100",
        startDate: "2025-01-06",
        endDate: "2025-01-10",
        utilization: 100,
        category: "chargeable",
      }),
      makeAssignment({
        jobNo: "J100",
        startDate: "2025-01-13",
        endDate: "2025-01-17",
        utilization: 100,
        category: "chargeable",
      }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result[0].periods).toHaveLength(2); // not merged: Mon Jan 13 > Fri Jan 10 + 1 day
  });

  it("does NOT merge periods with different utilizations", () => {
    const assignments = [
      makeAssignment({ jobNo: "J100", startDate: "2025-01-06", endDate: "2025-01-10", utilization: 50 }),
      makeAssignment({ jobNo: "J100", startDate: "2025-01-13", endDate: "2025-01-17", utilization: 100 }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result[0].periods).toHaveLength(2);
  });

  it("does NOT merge periods with different categories", () => {
    const assignments = [
      makeAssignment({ jobNo: "J100", startDate: "2025-01-06", endDate: "2025-01-10", category: "chargeable" }),
      makeAssignment({ jobNo: "J100", startDate: "2025-01-13", endDate: "2025-01-17", category: "training" }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result[0].periods).toHaveLength(2);
  });

  it("sets hasProvisional flag when any period has status P", () => {
    const assignments = [
      makeAssignment({ jobNo: "J100", status: "active" }),
      makeAssignment({ jobNo: "J100", startDate: "2025-02-03", endDate: "2025-02-07", status: "P" }),
    ];
    const result = consolidateAssignments(assignments);
    expect(result[0].hasProvisional).toBe(true);
  });

  it("preserves isNew and isModified flags", () => {
    const assignments = [makeAssignment({ jobNo: "J100", isNew: true, isModified: true })];
    const result = consolidateAssignments(assignments);
    expect(result[0].isNew).toBe(true);
    expect(result[0].isModified).toBe(true);
  });
});

// ─── normalizePeriods ─────────────────────────────────────────────────────────

describe("normalizePeriods", () => {
  it("returns empty array for empty input", () => {
    expect(normalizePeriods([])).toHaveLength(0);
  });

  it("returns empty array for null/undefined input", () => {
    expect(normalizePeriods(null as any)).toHaveLength(0);
    expect(normalizePeriods(undefined as any)).toHaveLength(0);
  });

  it("produces one period entry per consolidated period", () => {
    // Single consolidated job with two non-consecutive periods
    const consolidated = [
      {
        jobNo: "J100",
        jobName: "Alpha",
        category: "chargeable",
        status: "active",
        hasProvisional: false,
        isNew: false,
        isModified: false,
        totalUtilization: 100,
        totalHours: 40,
        periods: [
          {
            startDate: "2025-01-06",
            endDate: "2025-01-10",
            utilization: 100,
            hoursPerDay: 8,
            status: "active",
            category: "chargeable",
          },
          {
            startDate: "2025-02-03",
            endDate: "2025-02-07",
            utilization: 100,
            hoursPerDay: 8,
            status: "active",
            category: "chargeable",
          },
        ],
      },
    ];
    const result = normalizePeriods(consolidated);
    expect(result).toHaveLength(2);
  });

  it("converts date strings to timestamps (numbers)", () => {
    const consolidated = [
      {
        jobNo: "J100",
        jobName: "Alpha",
        category: "chargeable",
        status: "active",
        hasProvisional: false,
        isNew: false,
        isModified: false,
        totalUtilization: 100,
        totalHours: 40,
        periods: [
          {
            startDate: "2025-01-06",
            endDate: "2025-01-10",
            utilization: 100,
            hoursPerDay: 8,
            status: "active",
            category: "chargeable",
          },
        ],
      },
    ];
    const result = normalizePeriods(consolidated);
    expect(typeof result[0].start).toBe("number");
    expect(typeof result[0].end).toBe("number");
    expect(result[0].start).toBeLessThan(result[0].end);
  });

  it("propagates isNew flag from _isNewCreation on consolidated entry", () => {
    const consolidated = [
      {
        jobNo: "J100",
        jobName: "Alpha",
        category: "chargeable",
        status: "active",
        hasProvisional: false,
        isNew: false,
        isModified: false,
        _isNewCreation: true,
        totalUtilization: 100,
        totalHours: 40,
        periods: [
          {
            startDate: "2025-01-06",
            endDate: "2025-01-10",
            utilization: 100,
            hoursPerDay: 8,
            status: "active",
            category: "chargeable",
          },
        ],
      },
    ];
    const result = normalizePeriods(consolidated);
    expect(result[0].isNew).toBe(true);
  });

  it("preserves category and utilization on each period", () => {
    const consolidated = [
      {
        jobNo: "J100",
        jobName: "Alpha",
        category: "vacation",
        status: "active",
        hasProvisional: false,
        isNew: false,
        isModified: false,
        totalUtilization: 50,
        totalHours: 20,
        periods: [
          {
            startDate: "2025-01-06",
            endDate: "2025-01-10",
            utilization: 50,
            hoursPerDay: 4,
            status: "active",
            category: "vacation",
          },
        ],
      },
    ];
    const result = normalizePeriods(consolidated);
    expect(result[0].util).toBe(50);
    expect(result[0].category).toBe("vacation");
  });
});
