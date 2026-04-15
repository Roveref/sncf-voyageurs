import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isEmployeeActive,
  getSegmentScale,
  resolveDisplayValues,
  computeDisplayTU,
  computeVarianceRate,
  accumulateForecastForEmployee,
  processEmployeeDayForAggregate,
  computeBucketFromGrid,
} from "../aggregateCalc";
import type { DailyCell, DailyCellSegment, Employee } from "../../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal DailyCell for testing. Override any fields as needed. */
const makeCell = (overrides: Partial<DailyCell> = {}): DailyCell => ({
  dateStr: "2025-10-15",
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
  hasStaffing: true,
  dayWorkUtils: null,
  ...overrides,
});

const makeSeg = (category: string, util: number, jobNo: string | null = null): DailyCellSegment => ({
  name: `seg-${category}`,
  jobNo,
  category,
  util,
});

// ─── 1. isEmployeeActive ─────────────────────────────────────────────────────

describe("isEmployeeActive", () => {
  it("returns true when employee has staffing data and no date constraints", () => {
    expect(isEmployeeActive(true, "2025-10-15")).toBe(true);
  });

  it("returns true when employee has no dates and date is after MDS_EXTRACT_START", () => {
    // MDS_EXTRACT_START = '2025-09-01', date after that → active
    expect(isEmployeeActive(false, "2025-10-15")).toBe(true);
  });

  it("returns false when employee has no staffing and date is before MDS_EXTRACT_START", () => {
    expect(isEmployeeActive(false, "2025-06-15")).toBe(false);
  });

  it("returns false when date is before arrival", () => {
    expect(isEmployeeActive(true, "2025-10-01", "2025-10-10")).toBe(false);
  });

  it("returns true on exact arrival date", () => {
    expect(isEmployeeActive(true, "2025-10-10", "2025-10-10")).toBe(true);
  });

  it("returns false when date is after departure", () => {
    expect(isEmployeeActive(true, "2025-11-01", null, "2025-10-31")).toBe(false);
  });

  it("returns true on exact departure date", () => {
    expect(isEmployeeActive(true, "2025-10-31", null, "2025-10-31")).toBe(true);
  });

  it("returns true when date is within arrival-departure range", () => {
    expect(isEmployeeActive(true, "2025-10-15", "2025-10-01", "2025-10-31")).toBe(true);
  });

  it("returns false when date is outside arrival-departure range", () => {
    expect(isEmployeeActive(true, "2025-11-15", "2025-10-01", "2025-10-31")).toBe(false);
  });

  it("handles null arrival and departure gracefully", () => {
    expect(isEmployeeActive(true, "2025-10-15", null, null)).toBe(true);
  });

  // SAP-only mode
  it("returns true for SAP day in SAP-only mode when present", () => {
    expect(isEmployeeActive(false, "2025-10-15", null, null, true, true)).toBe(true);
  });

  it("returns true for holiday in SAP-only mode when present", () => {
    expect(isEmployeeActive(false, "2025-10-15", null, null, true, false, true)).toBe(true);
  });

  it("returns false in SAP-only mode when not present (before arrival)", () => {
    expect(isEmployeeActive(false, "2025-10-01", "2025-10-10", null, true, true)).toBe(false);
  });
});

// ─── 2. getSegmentScale ──────────────────────────────────────────────────────

describe("getSegmentScale", () => {
  const cell = { absScale: 0.8, chScale: 0.7, goScale: 0.5, trScale: 0.6 };

  it("returns absScale for absence categories", () => {
    expect(getSegmentScale("vacation", cell, false)).toBe(0.8);
    expect(getSegmentScale("rtt", cell, false)).toBe(0.8);
    expect(getSegmentScale("illness", cell, false)).toBe(0.8);
  });

  it("returns chScale for chargeable categories", () => {
    expect(getSegmentScale("chargeable", cell, false)).toBe(0.7);
    expect(getSegmentScale("pending", cell, false)).toBe(0.7);
    expect(getSegmentScale("overtime", cell, false)).toBe(0.7);
  });

  it("returns 1 for travel (non-chargeable)", () => {
    expect(getSegmentScale("travel", cell, false)).toBe(1);
  });

  it("returns chScale for GO category when chargeableCombined=true", () => {
    expect(getSegmentScale("generalOppty", cell, true)).toBe(0.7);
  });

  it("returns goScale for GO category when chargeableCombined=false", () => {
    expect(getSegmentScale("generalOppty", cell, false)).toBe(0.5);
  });

  it("returns trScale for training category", () => {
    expect(getSegmentScale("training", cell, false)).toBe(0.6);
  });

  it("returns 1 for unknown category", () => {
    expect(getSegmentScale("something_unknown", cell, false)).toBe(1);
  });

  it("works with all scales at 1 (no capping)", () => {
    const noCapCell = { absScale: 1, chScale: 1, goScale: 1, trScale: 1 };
    expect(getSegmentScale("vacation", noCapCell, false)).toBe(1);
    expect(getSegmentScale("chargeable", noCapCell, false)).toBe(1);
    expect(getSegmentScale("generalOppty", noCapCell, false)).toBe(1);
    expect(getSegmentScale("training", noCapCell, false)).toBe(1);
  });

  it("works with all scales at 0 (fully capped)", () => {
    const zeroCell = { absScale: 0, chScale: 0, goScale: 0, trScale: 0 };
    expect(getSegmentScale("vacation", zeroCell, false)).toBe(0);
    expect(getSegmentScale("chargeable", zeroCell, false)).toBe(0);
  });
});

// ─── 3. resolveDisplayValues ─────────────────────────────────────────────────

describe("resolveDisplayValues", () => {
  it("returns cell's capped values as display for non-SAP employee", () => {
    const cell = makeCell({ cappedChU: 60, cappedAbsU: 20 });
    const result = resolveDisplayValues(cell, false);
    expect(result.displayChU).toBe(60);
    expect(result.displayAbsU).toBe(20);
    expect(result.sapActualChU).toBe(0);
    expect(result.sapActualAbsU).toBe(0);
    expect(result.isSapWithMds).toBe(false);
  });

  it("returns SAP actuals for SAP employee without MDS", () => {
    const cell = makeCell({ cappedChU: 70, cappedAbsU: 10, isSap: true, forecastSegments: null });
    const result = resolveDisplayValues(cell, true);
    expect(result.displayChU).toBe(70);
    expect(result.displayAbsU).toBe(10);
    expect(result.sapActualChU).toBe(70);
    expect(result.sapActualAbsU).toBe(10);
    expect(result.sapForecastChU).toBe(0);
    expect(result.sapForecastAbsU).toBe(0);
    expect(result.isSapWithMds).toBe(false);
  });

  it("returns MDS forecast values for SAP+MDS employee", () => {
    const cell = makeCell({
      cappedChU: 70,
      cappedAbsU: 10,
      isSap: true,
      forecastSegments: [makeSeg("chargeable", 55)],
      forecastChU: 55,
      forecastAbsRate: 15,
    });
    const result = resolveDisplayValues(cell, true);
    expect(result.displayChU).toBe(70); // display shows cell cappedChU
    expect(result.displayAbsU).toBe(10);
    expect(result.sapActualChU).toBe(70);
    expect(result.sapActualAbsU).toBe(10);
    expect(result.sapForecastChU).toBe(55);
    expect(result.sapForecastAbsU).toBe(15);
    expect(result.isSapWithMds).toBe(true);
  });

  it("returns zero forecast when SAP employee has no MDS", () => {
    const cell = makeCell({ cappedChU: 80, cappedAbsU: 5, isSap: true });
    const result = resolveDisplayValues(cell, true);
    expect(result.sapForecastChU).toBe(0);
    expect(result.sapForecastAbsU).toBe(0);
    expect(result.isSapWithMds).toBe(false);
  });
});

// ─── 4. computeDisplayTU ─────────────────────────────────────────────────────

describe("computeDisplayTU", () => {
  it("computes TU from active emp days and display values", () => {
    // 10 active emp days → net = 10*100 - 200 = 800, TU = 600/800*100 = 75
    const result = computeDisplayTU(10, 600, 200);
    expect(result).toBeCloseTo(75);
  });

  it("returns 0 when net is 0 (all absence)", () => {
    // net = 1*100 - 100 = 0 → no available time → TU = 0
    expect(computeDisplayTU(1, 0, 100)).toBe(0);
  });

  it("handles zero active emp days", () => {
    // net = 0 - 0 = 0 → no available time → TU = 0
    expect(computeDisplayTU(0, 0, 0)).toBe(0);
  });

  it("computes correctly with no absence", () => {
    // net = 5*100 - 0 = 500, TU = 400/500*100 = 80
    expect(computeDisplayTU(5, 400, 0)).toBeCloseTo(80);
  });
});

// ─── 5. computeVarianceRate ──────────────────────────────────────────────────

describe("computeVarianceRate", () => {
  it("returns null when no SAP emp days", () => {
    expect(computeVarianceRate(0, 0, 0, 0, 0)).toBeNull();
  });

  it("returns 0 when SAP and forecast TU are equal", () => {
    // sapNet = 10*100 - 200 = 800, sapTU = 600/800*100 = 75
    // fNet = 10*100 - 200 = 800, forecastTU = 600/800*100 = 75
    expect(computeVarianceRate(10, 600, 200, 600, 200)).toBeCloseTo(0);
  });

  it("returns positive delta when SAP TU > forecast TU", () => {
    // sapNet = 10*100 - 200 = 800, sapTU = 700/800*100 = 87.5
    // fNet = 10*100 - 200 = 800, forecastTU = 600/800*100 = 75
    const result = computeVarianceRate(10, 700, 200, 600, 200);
    expect(result).toBeCloseTo(12.5);
  });

  it("returns negative delta when SAP TU < forecast TU", () => {
    // sapNet = 10*100 - 200 = 800, sapTU = 500/800*100 = 62.5
    // fNet = 10*100 - 200 = 800, forecastTU = 600/800*100 = 75
    const result = computeVarianceRate(10, 500, 200, 600, 200);
    expect(result).toBeCloseTo(-12.5);
  });

  it("handles different absence rates between SAP and forecast", () => {
    // sapNet = 5*100 - 100 = 400, sapTU = 300/400*100 = 75
    // fNet = 5*100 - 50 = 450, forecastTU = 300/450*100 = 66.67
    const result = computeVarianceRate(5, 300, 100, 300, 50);
    expect(result).toBeCloseTo(75 - 66.6667, 1);
  });

  it("handles full absence (net=0) → returns 0 variance (both TU=100)", () => {
    // sapNet = 1*100 - 100 = 0 → sapTU = 100
    // fNet = 1*100 - 100 = 0 → forecastTU = 100
    expect(computeVarianceRate(1, 0, 100, 0, 100)).toBeCloseTo(0);
  });
});

// ─── 6. accumulateForecastForEmployee ────────────────────────────────────────

describe("accumulateForecastForEmployee", () => {
  it("returns not counted for SAP employee without MDS forecast", () => {
    const cell = makeCell({ isSap: true, forecastSegments: null });
    const forecastCatMap: Record<string, number> = {};
    const result = accumulateForecastForEmployee(cell, true, false, forecastCatMap);
    expect(result.counted).toBe(false);
    expect(result.fAbsU).toBe(0);
    expect(result.fChU).toBe(0);
    expect(Object.keys(forecastCatMap)).toHaveLength(0);
  });

  it("accumulates forecast segments for SAP employee with MDS", () => {
    const cell = makeCell({
      isSap: true,
      forecastSegments: [makeSeg("chargeable", 60), makeSeg("vacation", 20), makeSeg("training", 10)],
      forecastAbsRate: 20,
      forecastChU: 60,
    });
    const forecastCatMap: Record<string, number> = {};
    const result = accumulateForecastForEmployee(cell, true, false, forecastCatMap);
    expect(result.counted).toBe(true);
    expect(result.fAbsU).toBe(20);
    expect(result.fChU).toBe(60);
    expect(result.fTrU).toBe(10);
    expect(forecastCatMap["chargeable"]).toBe(60);
    expect(forecastCatMap["vacation"]).toBe(20);
    expect(forecastCatMap["training"]).toBe(10);
  });

  it("returns not counted for non-SAP employee without staffing", () => {
    const cell = makeCell({ isSap: false, hasStaffing: false });
    const forecastCatMap: Record<string, number> = {};
    const result = accumulateForecastForEmployee(cell, false, false, forecastCatMap);
    expect(result.counted).toBe(false);
  });

  it("accumulates segments with scale for non-SAP employee with staffing", () => {
    const cell = makeCell({
      isSap: false,
      hasStaffing: true,
      segments: [makeSeg("chargeable", 50), makeSeg("vacation", 30)],
      chScale: 0.8,
      absScale: 0.9,
      cappedAbsU: 27,
      cappedChU: 40,
      cappedGoU: 0,
      cappedTrU: 0,
    });
    const forecastCatMap: Record<string, number> = {};
    const result = accumulateForecastForEmployee(cell, false, false, forecastCatMap);
    expect(result.counted).toBe(true);
    expect(result.fAbsU).toBe(27);
    expect(result.fChU).toBe(40);
    expect(forecastCatMap["chargeable"]).toBeCloseTo(50 * 0.8);
    expect(forecastCatMap["vacation"]).toBeCloseTo(30 * 0.9);
  });

  it("accumulates GO util into forecast for SAP+MDS", () => {
    const cell = makeCell({
      isSap: true,
      forecastSegments: [makeSeg("generalOppty", 25)],
      forecastAbsRate: 0,
      forecastChU: 0,
    });
    const forecastCatMap: Record<string, number> = {};
    const result = accumulateForecastForEmployee(cell, true, false, forecastCatMap);
    expect(result.counted).toBe(true);
    expect(result.fGoU).toBe(25);
    expect(forecastCatMap["generalOppty"]).toBe(25);
  });
});

// ─── 7. processEmployeeDayForAggregate ───────────────────────────────────────

describe("processEmployeeDayForAggregate", () => {
  it("returns null for inactive employee (before arrival)", () => {
    const cell = makeCell({ hasStaffing: true });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    const result = processEmployeeDayForAggregate(
      cell,
      "2025-10-15",
      false,
      "2025-11-01",
      null,
      false,
      catMap,
      sapCatMap,
      forecastCatMap
    );
    expect(result).toBeNull();
  });

  it("returns aggregated result for active employee", () => {
    const cell = makeCell({
      hasStaffing: true,
      segments: [makeSeg("chargeable", 60), makeSeg("vacation", 20)],
      cappedChU: 60,
      cappedAbsU: 20,
      cappedGoU: 0,
      cappedTrU: 0,
      absU: 20,
      chU: 60,
      goU: 0,
      trU: 0,
      otU: 0,
      rawGoU: 0,
      netU: 80,
    });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    const result = processEmployeeDayForAggregate(
      cell,
      "2025-10-15",
      false,
      null,
      null,
      false,
      catMap,
      sapCatMap,
      forecastCatMap
    );
    expect(result).not.toBeNull();
    expect(result!.cappedChU).toBe(60);
    expect(result!.cappedAbsU).toBe(20);
    expect(result!.netU).toBe(80);
    expect(result!.rawTotal).toBe(80); // 20 + 60 + 0 + 0 + 0
    expect(catMap["chargeable"]).toBe(60);
    expect(catMap["vacation"]).toBe(20);
  });

  it("populates sapCatMap for SAP employee", () => {
    const cell = makeCell({
      hasStaffing: true,
      isSap: true,
      segments: [makeSeg("chargeable", 50)],
      cappedChU: 50,
      absU: 0,
      chU: 50,
      goU: 0,
      trU: 0,
      otU: 0,
    });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    processEmployeeDayForAggregate(cell, "2025-10-15", true, null, null, false, catMap, sapCatMap, forecastCatMap);
    expect(sapCatMap["chargeable"]).toBe(50);
  });

  it("accumulates into existing catMap values", () => {
    const cell = makeCell({
      hasStaffing: true,
      segments: [makeSeg("chargeable", 30)],
      cappedChU: 30,
      absU: 0,
      chU: 30,
      goU: 0,
      trU: 0,
      otU: 0,
    });
    const catMap: Record<string, number> = { chargeable: 20 }; // pre-existing
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    processEmployeeDayForAggregate(cell, "2025-10-15", false, null, null, false, catMap, sapCatMap, forecastCatMap);
    expect(catMap["chargeable"]).toBe(50); // 20 + 30
  });

  it("applies segment scale factors when accumulating", () => {
    const cell = makeCell({
      hasStaffing: true,
      segments: [makeSeg("chargeable", 80)],
      chScale: 0.75,
      cappedChU: 60,
      absU: 0,
      chU: 80,
      goU: 0,
      trU: 0,
      otU: 0,
    });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    processEmployeeDayForAggregate(cell, "2025-10-15", false, null, null, false, catMap, sapCatMap, forecastCatMap);
    expect(catMap["chargeable"]).toBeCloseTo(80 * 0.75);
  });

  it("skips forecast accumulation in useSapActuals mode", () => {
    const cell = makeCell({
      hasStaffing: true,
      isSap: true,
      segments: [makeSeg("chargeable", 50)],
      forecastSegments: [makeSeg("chargeable", 40)],
      cappedChU: 50,
      absU: 0,
      chU: 50,
      goU: 0,
      trU: 0,
      otU: 0,
    });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    const result = processEmployeeDayForAggregate(
      cell,
      "2025-10-15",
      true,
      null,
      null,
      false,
      catMap,
      sapCatMap,
      forecastCatMap,
      true
    );
    expect(result).not.toBeNull();
    expect(result!.forecastCounted).toBe(false);
    // forecastCatMap should not be populated
    expect(Object.keys(forecastCatMap)).toHaveLength(0);
  });

  it("includes display values in result", () => {
    const cell = makeCell({
      hasStaffing: true,
      isSap: true,
      segments: [makeSeg("chargeable", 70)],
      cappedChU: 70,
      cappedAbsU: 10,
      absU: 10,
      chU: 70,
      goU: 0,
      trU: 0,
      otU: 0,
    });
    const catMap: Record<string, number> = {};
    const sapCatMap: Record<string, number> = {};
    const forecastCatMap: Record<string, number> = {};
    const result = processEmployeeDayForAggregate(
      cell,
      "2025-10-15",
      true,
      null,
      null,
      false,
      catMap,
      sapCatMap,
      forecastCatMap
    );
    expect(result!.display.displayChU).toBe(70);
    expect(result!.display.sapActualChU).toBe(70);
    expect(result!.display.isSapWithMds).toBe(false);
  });
});

// ─── 8. computeBucketFromGrid ────────────────────────────────────────────────

describe("computeBucketFromGrid", () => {
  it("returns null when dailyGrid is null", () => {
    expect(computeBucketFromGrid([], null, null, "2025-10-01", "2025-10-05", false)).toBeNull();
  });

  it("returns null when calIndex is null", () => {
    const grid = new Map();
    expect(computeBucketFromGrid([], grid, null, "2025-10-01", "2025-10-05", false)).toBeNull();
  });

  it("returns null when no covered days are found", () => {
    const grid = new Map();
    const calIndex = new Map<string, number>();
    // No entries in calIndex, so no days match
    expect(computeBucketFromGrid([], grid, calIndex, "2025-10-01", "2025-10-05", false)).toBeNull();
  });

  it("computes basic bucket for a single employee on a single working day", () => {
    // Wednesday 2025-10-15
    const dateStr = "2025-10-15";
    const cell = makeCell({
      dateStr,
      hasStaffing: true,
      segments: [makeSeg("chargeable", 80), makeSeg("vacation", 10)],
      cappedChU: 80,
      cappedAbsU: 10,
      cappedGoU: 0,
      cappedTrU: 0,
      absU: 10,
      chU: 80,
      goU: 0,
      trU: 0,
      otU: 0,
      netU: 90,
    });

    const empId = "E001";
    const employees = [
      { empId, grade: "Manager", _arrivalDate: null, _departureDate: null, _etpAdjustments: undefined },
    ] as any as Employee[];
    const dailyGrid = new Map([[empId, { cells: [cell] }]]) as any;
    const calIndex = new Map([[dateStr, 0]]);

    const result = computeBucketFromGrid(
      employees,
      dailyGrid,
      calIndex,
      "2025-10-15",
      "2025-10-16", // 1-day range (end exclusive)
      false
    );

    expect(result).not.toBeNull();
    expect(result!.activeEmpDays).toBe(1);
    expect(result!.displayChU).toBe(80);
    expect(result!.displayAbsU).toBe(10);
    expect(result!.realBaseH).toBe(8); // Manager = 8h/day
    expect(result!.realChH).toBeCloseTo((80 / 100) * 8);
    expect(result!.realAbsH).toBeCloseTo((10 / 100) * 8);
  });

  it("skips weekends", () => {
    // Saturday 2025-10-18 and Sunday 2025-10-19
    const calIndex = new Map<string, number>();
    // Don't add weekend dates to calIndex (simulates real behavior)
    const employees: any[] = [];
    const dailyGrid = new Map();

    const result = computeBucketFromGrid(
      employees,
      dailyGrid,
      calIndex,
      "2025-10-18",
      "2025-10-20", // Sat-Sun
      false
    );

    // No weekdays covered
    expect(result).toBeNull();
  });

  it("handles holidays by adding to realHolH", () => {
    const dateStr = "2025-10-15";
    const cell = makeCell({ dateStr, isWE: false, isHoliday: true, hasStaffing: false, isSap: false });

    const empId = "E001";
    const employees = [
      { empId, grade: "Manager", _arrivalDate: null, _departureDate: null, _etpAdjustments: undefined },
    ] as any as Employee[];
    const dailyGrid = new Map([[empId, { cells: [cell] }]]) as any;
    const calIndex = new Map([[dateStr, 0]]);
    const calendarDays = [{ isHoliday: true }] as any;

    const result = computeBucketFromGrid(
      employees,
      dailyGrid,
      calIndex,
      "2025-10-15",
      "2025-10-16",
      false,
      null,
      false,
      calendarDays
    );

    expect(result).not.toBeNull();
    expect(result!.realHolH).toBe(8);
    expect(result!.realBaseH).toBe(8);
  });

  it("accumulates SAP hours for SAP cells", () => {
    const dateStr = "2025-10-15";
    const cell = makeCell({
      dateStr,
      hasStaffing: true,
      isSap: true,
      segments: [makeSeg("chargeable", 60)],
      cappedChU: 60,
      cappedAbsU: 0,
      absU: 0,
      chU: 60,
      goU: 0,
      trU: 0,
      otU: 0,
      netU: 100,
    });

    const empId = "E001";
    const employees = [
      { empId, grade: "Manager", _arrivalDate: null, _departureDate: null, _etpAdjustments: undefined },
    ] as any as Employee[];
    const dailyGrid = new Map([[empId, { cells: [cell] }]]) as any;
    const calIndex = new Map([[dateStr, 0]]);

    const result = computeBucketFromGrid(employees, dailyGrid, calIndex, "2025-10-15", "2025-10-16", false);

    expect(result).not.toBeNull();
    expect(result!.hasSapData).toBe(true);
    expect(result!.sapBaseH).toBe(8);
    expect(result!.sapChH).toBeCloseTo((60 / 100) * 8);
  });

  it("computes TU correctly", () => {
    const dateStr = "2025-10-15";
    const cell = makeCell({
      dateStr,
      hasStaffing: true,
      segments: [makeSeg("chargeable", 75), makeSeg("vacation", 10)],
      cappedChU: 75,
      cappedAbsU: 10,
      cappedGoU: 0,
      cappedTrU: 0,
      absU: 10,
      chU: 75,
      goU: 0,
      trU: 0,
      otU: 0,
      netU: 90,
    });

    const empId = "E001";
    const employees = [
      { empId, grade: "Manager", _arrivalDate: null, _departureDate: null, _etpAdjustments: undefined },
    ] as any as Employee[];
    const dailyGrid = new Map([[empId, { cells: [cell] }]]) as any;
    const calIndex = new Map([[dateStr, 0]]);

    const result = computeBucketFromGrid(employees, dailyGrid, calIndex, "2025-10-15", "2025-10-16", false);

    expect(result).not.toBeNull();
    // displayTU = displayChU / (activeEmpDays*100 - displayAbsU) * 100 = 75 / (100 - 10) * 100 = 83.33
    expect(result!.displayTU).toBeCloseTo((75 / 90) * 100, 1);
  });
});
