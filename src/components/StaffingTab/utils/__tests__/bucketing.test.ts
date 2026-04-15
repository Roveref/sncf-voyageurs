/**
 * Tests for pure bucketing utilities extracted from HeatmapStrip.
 *
 * Covers:
 *   - buildGradeTransitionMap  — grade history → lookup map
 *   - buildDailyEntries        — DailyCell[] + CalendarDay[] → DailyEntry[]
 *   - buildHeatmapBuckets      — DailyEntry[] → HeatmapBucket[] (day + month granularity)
 */
import { describe, it, expect } from "vitest";
import { buildGradeTransitionMap, buildDailyEntries, buildHeatmapBuckets } from "../bucketing";
import type { DailyEntry } from "../bucketing";
import type { DailyCell, CalendarDay, GradeTransition } from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal DailyCell for a working day (non-weekend, non-SAP by default).
 */
const makeCell = (overrides: Partial<DailyCell> = {}): DailyCell => ({
  dateStr: "2025-06-02",
  isWE: false,
  isHoliday: false,
  absU: 0,
  chU: 60,
  goU: 0,
  trU: 0,
  otU: 0,
  rawGoU: 0,
  cappedAbsU: 0,
  cappedChU: 60,
  cappedGoU: 0,
  cappedTrU: 0,
  cappedTotal: 60,
  tuRate: 60,
  toRate: 60,
  netU: 100,
  segments: [{ name: "Project Alpha", jobNo: "J100", category: "chargeable", util: 60 }],
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

/**
 * Build a minimal CalendarDay for a given date string.
 */
const makeCalDay = (dateStr: string, overrides: Partial<CalendarDay> = {}): CalendarDay => {
  const d = new Date(dateStr + "T00:00:00");
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
};

/**
 * Build a DailyEntry for a working weekday (not weekend, not holiday).
 */
const makeWorkEntry = (date: Date, overrides: Partial<DailyEntry> = {}): DailyEntry => ({
  date,
  dow: date.getDay(),
  isWE: false,
  isHoliday: false,
  total: 60,
  cappedTotal: 60,
  tuRate: 60,
  toRate: 60,
  absRate: 0,
  goRate: 0,
  chU: 60,
  trU: 0,
  monthStart: false,
  segments: [{ name: "Alpha", jobNo: "J100", category: "chargeable", util: 60 }],
  absScale: 1,
  chScale: 1,
  goScale: 1,
  trScale: 1,
  isSap: false,
  hasStaffing: true,
  forecastSegments: null,
  forecastTuRate: null,
  forecastChU: null,
  forecastAbsRate: null,
  ...overrides,
});

/** Build a weekend DailyEntry. */
const makeWEEntry = (date: Date): DailyEntry => ({
  date,
  dow: date.getDay(),
  isWE: true,
  isHoliday: false,
  total: 0,
  cappedTotal: 0,
  tuRate: 0,
  toRate: 0,
  absRate: 0,
  goRate: 0,
  chU: 0,
  trU: 0,
  monthStart: false,
  segments: [],
  absScale: 1,
  chScale: 1,
  goScale: 1,
  trScale: 1,
  isSap: false,
  hasStaffing: false,
  forecastSegments: null,
  forecastTuRate: null,
  forecastChU: null,
  forecastAbsRate: null,
});

// ─── buildGradeTransitionMap ──────────────────────────────────────────────────

describe("buildGradeTransitionMap", () => {
  it("returns null for null input", () => {
    expect(buildGradeTransitionMap(null, false)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(buildGradeTransitionMap(undefined, false)).toBeNull();
  });

  it("returns null for a single transition (no change to mark)", () => {
    const single: GradeTransition[] = [{ grade: "Analyst", since: "2024-01-01" }];
    expect(buildGradeTransitionMap(single, false)).toBeNull();
  });

  it("returns a map with entries for two transitions", () => {
    const transitions: GradeTransition[] = [
      { grade: "Analyst", since: "2023-01-01" },
      { grade: "Consultant", since: "2025-06-02" }, // Monday
    ];
    const map = buildGradeTransitionMap(transitions, false);
    expect(map).not.toBeNull();
    expect(map!.size).toBeGreaterThan(0);
  });

  it("creates arrival marker on the since date (shifted to weekday)", () => {
    // 2025-06-02 is a Monday — no shift needed
    const transitions: GradeTransition[] = [
      { grade: "Analyst", since: "2023-01-01" },
      { grade: "Consultant", since: "2025-06-02" },
    ];
    const map = buildGradeTransitionMap(transitions, false);
    const arrival = map!.get("2025-06-02");
    expect(arrival).toBeDefined();
    expect(arrival!.isDeparture).toBe(false);
    expect(arrival!.from).toBe("Analyst");
    expect(arrival!.to).toBe("Consultant");
  });

  it("creates departure marker on the last day of old grade (non-merged)", () => {
    // Since = 2025-06-02 (Mon), so departure = 2025-05-30 (Fri)
    const transitions: GradeTransition[] = [
      { grade: "Analyst", since: "2023-01-01" },
      { grade: "Consultant", since: "2025-06-02" },
    ];
    const map = buildGradeTransitionMap(transitions, false);
    const departure = map!.get("2025-05-30");
    expect(departure).toBeDefined();
    expect(departure!.isDeparture).toBe(true);
  });

  it("suppresses departure marker in merged-row mode", () => {
    const transitions: GradeTransition[] = [
      { grade: "Analyst", since: "2023-01-01" },
      { grade: "Consultant", since: "2025-06-02" },
    ];
    const map = buildGradeTransitionMap(transitions, true); // mergedGradeRow = true
    // Should only have the arrival entry, not the departure
    let hasDeparture = false;
    map?.forEach((v) => {
      if (v.isDeparture) hasDeparture = true;
    });
    expect(hasDeparture).toBe(false);
  });

  it("skips transitions with no since date", () => {
    const transitions: GradeTransition[] = [
      { grade: "Analyst", since: "2023-01-01" },
      { grade: "Consultant", since: "" }, // empty since
    ];
    const result = buildGradeTransitionMap(transitions, false);
    // Entries with empty since should be skipped — may return null or empty map
    if (result !== null) {
      expect(result.size).toBe(0);
    }
  });
});

// ─── buildDailyEntries ────────────────────────────────────────────────────────

describe("buildDailyEntries", () => {
  it("returns empty array for empty calendar", () => {
    expect(buildDailyEntries([], [], null)).toHaveLength(0);
  });

  it("returns empty array when precomputedCells length != calendar length", () => {
    const cal = [makeCalDay("2025-06-02")];
    expect(buildDailyEntries([], cal, null)).toHaveLength(0);
    expect(buildDailyEntries([makeCell(), makeCell()], cal, null)).toHaveLength(0);
  });

  it("produces one DailyEntry per calendar day", () => {
    const cal = [makeCalDay("2025-06-02"), makeCalDay("2025-06-03")];
    const cells = [makeCell({ dateStr: "2025-06-02" }), makeCell({ dateStr: "2025-06-03" })];
    const result = buildDailyEntries(cells, cal, null);
    expect(result).toHaveLength(2);
  });

  it("marks weekend entries with isWE=true", () => {
    // 2025-06-07 is a Saturday
    const satCal = makeCalDay("2025-06-07");
    const satCell = makeCell({ isWE: true, dateStr: "2025-06-07" });
    const result = buildDailyEntries([satCell], [satCal], null);
    expect(result[0].isWE).toBe(true);
  });

  it("uses isHoliday from calendar day (not cell)", () => {
    const cal = [{ ...makeCalDay("2025-06-02"), isHoliday: true }];
    const result = buildDailyEntries([makeCell()], cal, null);
    expect(result[0].isHoliday).toBe(true);
  });

  it("attaches grade transition from map if key matches", () => {
    const dateStr = "2025-06-02";
    const transitionInfo = { from: "Analyst", to: "Consultant", since: dateStr, isDeparture: false };
    const gradeMap = new Map([[dateStr, transitionInfo]]);
    const cal = [makeCalDay(dateStr)];
    const result = buildDailyEntries([makeCell({ dateStr })], cal, gradeMap);
    expect(result[0].gradeTransition).toEqual(transitionInfo);
  });

  it("gradeTransition is null when date not in map", () => {
    const gradeMap = new Map([["2025-07-01", { from: "A", to: "B", since: "2025-07-01" }]]);
    const result = buildDailyEntries([makeCell({ dateStr: "2025-06-02" })], [makeCalDay("2025-06-02")], gradeMap);
    expect(result[0].gradeTransition).toBeNull();
  });

  it("monthStart is false for the very first entry", () => {
    const result = buildDailyEntries([makeCell()], [makeCalDay("2025-06-02")], null);
    expect(result[0].monthStart).toBe(false);
  });

  it("monthStart is true when month changes between consecutive entries", () => {
    const cal = [makeCalDay("2025-06-30"), makeCalDay("2025-07-01")];
    const cells = [makeCell({ dateStr: "2025-06-30" }), makeCell({ dateStr: "2025-07-01" })];
    const result = buildDailyEntries(cells, cal, null);
    // Second entry crosses month boundary
    expect(result[1].monthStart).toBe(true);
  });

  it("propagates chU from effectiveChU when set on cell", () => {
    const cell = makeCell({ effectiveChU: 80, cappedChU: 60 });
    const result = buildDailyEntries([cell], [makeCalDay("2025-06-02")], null);
    expect(result[0].chU).toBe(80);
  });
});

// ─── buildHeatmapBuckets — day granularity ────────────────────────────────────

describe("buildHeatmapBuckets — day granularity", () => {
  it("returns empty array for empty daily input", () => {
    expect(buildHeatmapBuckets([], "Consultant", "day", false, null)).toHaveLength(0);
  });

  it("produces one bucket per working day", () => {
    const entries: DailyEntry[] = [
      makeWorkEntry(new Date("2025-06-02T00:00:00")), // Mon
      makeWorkEntry(new Date("2025-06-03T00:00:00")), // Tue
      makeWorkEntry(new Date("2025-06-04T00:00:00")), // Wed
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "day", false, null);
    expect(result).toHaveLength(3);
    result.forEach((b) => expect(b.isWeekend).toBeFalsy());
  });

  it("collapses consecutive weekend days into a single bucket", () => {
    const entries: DailyEntry[] = [
      makeWEEntry(new Date("2025-05-31T00:00:00")), // Sat
      makeWEEntry(new Date("2025-06-01T00:00:00")), // Sun
      makeWorkEntry(new Date("2025-06-02T00:00:00")), // Mon
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "day", false, null);
    expect(result).toHaveLength(2); // 1 WE bucket + 1 workday bucket
    expect(result[0].isWeekend).toBe(true);
    expect(result[1].isWeekend).toBeFalsy();
  });

  it("sets span=1 for each individual workday bucket", () => {
    const entries = [makeWorkEntry(new Date("2025-06-02T00:00:00"))];
    const result = buildHeatmapBuckets(entries, "Consultant", "day", false, null);
    expect(result[0].span).toBe(1);
  });

  it("passes tuRate from daily entry into bucket", () => {
    const entry = makeWorkEntry(new Date("2025-06-02T00:00:00"), { tuRate: 75 });
    const result = buildHeatmapBuckets([entry], "Consultant", "day", false, null);
    expect(result[0].tuRate).toBe(75);
  });

  it("attaches grade transition when present on entry", () => {
    const transitionInfo = { from: "Analyst", to: "Consultant", since: "2025-06-02", isDeparture: false };
    const entry = makeWorkEntry(new Date("2025-06-02T00:00:00"), { gradeTransition: transitionInfo });
    const result = buildHeatmapBuckets([entry], "Consultant", "day", false, null);
    expect(result[0].gradeTransition).toEqual(transitionInfo);
  });
});

// ─── buildHeatmapBuckets — month granularity ─────────────────────────────────

describe("buildHeatmapBuckets — month granularity", () => {
  it("groups all working days in a single month into one bucket", () => {
    // First 5 working days of June 2025
    const entries: DailyEntry[] = [
      makeWorkEntry(new Date("2025-06-02T00:00:00")),
      makeWorkEntry(new Date("2025-06-03T00:00:00")),
      makeWorkEntry(new Date("2025-06-04T00:00:00")),
      makeWorkEntry(new Date("2025-06-05T00:00:00")),
      makeWorkEntry(new Date("2025-06-06T00:00:00")),
    ];
    const result = buildHeatmapBuckets(entries, "Manager", "month", false, null);
    expect(result).toHaveLength(1);
    expect(result[0].workDays).toBe(5);
  });

  it("produces two buckets when entries span two months", () => {
    const entries: DailyEntry[] = [
      makeWorkEntry(new Date("2025-05-30T00:00:00")), // Friday in May
      makeWorkEntry(new Date("2025-06-02T00:00:00")), // Monday in June
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "month", false, null);
    // May bucket + June bucket
    const workBuckets = result.filter((b) => !b.isWeekend);
    expect(workBuckets).toHaveLength(2);
  });

  it("computes average tuRate across working days in bucket", () => {
    const entries: DailyEntry[] = [
      makeWorkEntry(new Date("2025-06-02T00:00:00"), { tuRate: 80, absRate: 0, chU: 80 }),
      makeWorkEntry(new Date("2025-06-03T00:00:00"), { tuRate: 60, absRate: 0, chU: 60 }),
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "month", false, null);
    // tuRate is sum-of-ch / sum-of-net * 100 = (80+60) / (100+100) * 100 = 70
    expect(result[0].tuRate).toBeCloseTo(70);
  });

  it("isSap bucket flag true when any working day has isSap=true", () => {
    const entries: DailyEntry[] = [
      makeWorkEntry(new Date("2025-06-02T00:00:00"), { isSap: true }),
      makeWorkEntry(new Date("2025-06-03T00:00:00"), { isSap: false }),
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "month", false, null);
    expect(result[0].isSap).toBe(true);
  });

  it("hasStaffing is false when no working day has staffing data", () => {
    const entries: DailyEntry[] = [makeWorkEntry(new Date("2025-06-02T00:00:00"), { hasStaffing: false })];
    const result = buildHeatmapBuckets(entries, "Consultant", "month", false, null);
    expect(result[0].hasStaffing).toBe(false);
  });
});

// ─── buildHeatmapBuckets — week granularity ───────────────────────────────────

describe("buildHeatmapBuckets — week granularity", () => {
  it("groups Mon-Fri into a single work bucket with interleaved weekend buckets", () => {
    // Sat, Sun, then Mon-Fri
    const sat = makeWEEntry(new Date("2025-05-31T00:00:00"));
    const sun = makeWEEntry(new Date("2025-06-01T00:00:00"));
    const entries: DailyEntry[] = [
      sat,
      sun,
      makeWorkEntry(new Date("2025-06-02T00:00:00")),
      makeWorkEntry(new Date("2025-06-03T00:00:00")),
      makeWorkEntry(new Date("2025-06-04T00:00:00")),
      makeWorkEntry(new Date("2025-06-05T00:00:00")),
      makeWorkEntry(new Date("2025-06-06T00:00:00")),
    ];
    const result = buildHeatmapBuckets(entries, "Consultant", "week", false, null);
    // 1 weekend bucket + 1 work-week bucket
    expect(result).toHaveLength(2);
    const workBucket = result.find((b) => !b.isWeekend)!;
    expect(workBucket.workDays).toBe(5);
  });
});
