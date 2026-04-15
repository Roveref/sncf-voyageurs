import { describe, it, expect } from "vitest";
import {
  getTimelineRange,
  getTimelineLabels,
  getMonthLabels,
  getWeekendMarkers,
  getHolidayMarkers,
  calculateBarPosition,
} from "../timelineUtils";

// ─── getTimelineRange ──────────────────────────────────────────────────────

describe("getTimelineRange", () => {
  it("returns custom range when enabled with valid dates", () => {
    const customRange = { enabled: true, startDate: "2026-01-01", endDate: "2026-06-30" };
    const result = getTimelineRange("quarter", customRange);
    expect(result.startDate.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(result.endDate.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("ignores custom range when disabled", () => {
    const customRange = { enabled: false, startDate: "2026-01-01", endDate: "2026-06-30" };
    const result = getTimelineRange("month", customRange);
    // Should compute from today, not from custom range
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
    expect(result.endDate > result.startDate).toBe(true);
  });

  it("ignores custom range when start/end dates are missing", () => {
    const customRange = { enabled: true, startDate: "", endDate: "" };
    const result = getTimelineRange("month", customRange);
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate > result.startDate).toBe(true);
  });

  it("returns valid dates for 'week' timeframe", () => {
    const result = getTimelineRange("week", {});
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate > result.startDate).toBe(true);
  });

  it("returns valid dates for 'quarter' timeframe", () => {
    const result = getTimelineRange("quarter", {});
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate > result.startDate).toBe(true);
  });

  it("falls back to default (quarter-like) for unknown timeframe", () => {
    const result = getTimelineRange("unknown_value", {});
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate > result.startDate).toBe(true);
  });
});

// ─── getTimelineLabels ─────────────────────────────────────────────────────

describe("getTimelineLabels", () => {
  it("returns empty array for invalid dates", () => {
    const result = getTimelineLabels("month", new Date("invalid"), new Date("2026-06-30"));
    expect(result).toHaveLength(0);
  });

  it("generates labels with positions between 0 and 100", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-04-30");
    const result = getTimelineLabels("week", start, end);
    expect(result.length).toBeGreaterThan(0);
    for (const label of result) {
      expect(label.position).toBeGreaterThanOrEqual(0);
      expect(label.position).toBeLessThanOrEqual(100);
    }
  });

  it("generates more labels for 'week' timeframe than 'quarter'", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-06-30");
    const weekLabels = getTimelineLabels("week", start, end);
    const quarterLabels = getTimelineLabels("quarter", start, end);
    expect(weekLabels.length).toBeGreaterThan(quarterLabels.length);
  });
});

// ─── getMonthLabels ────────────────────────────────────────────────────────

describe("getMonthLabels", () => {
  it("returns empty array for invalid dates", () => {
    const result = getMonthLabels(new Date("invalid"), new Date("2026-06-30"), "quarter");
    expect(result).toHaveLength(0);
  });

  it("generates one label per month in range", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-06-30");
    const result = getMonthLabels(start, end, "quarter");
    // Should have April, May, June
    expect(result.length).toBe(3);
  });

  it("each label has startPos, width, label, and key", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-06-30");
    const result = getMonthLabels(start, end, "quarter");
    for (const label of result) {
      expect(label).toHaveProperty("key");
      expect(label).toHaveProperty("label");
      expect(label).toHaveProperty("startPos");
      expect(label).toHaveProperty("width");
      expect(label.width).toBeGreaterThan(0);
    }
  });
});

// ─── getWeekendMarkers ─────────────────────────────────────────────────────

describe("getWeekendMarkers", () => {
  it("returns empty array for invalid dates", () => {
    const result = getWeekendMarkers(new Date("invalid"), new Date("2026-04-30"));
    expect(result).toHaveLength(0);
  });

  it("identifies Saturday and Sunday days as weekend markers", () => {
    // 2026-04-04 is Saturday, 2026-04-05 is Sunday
    const start = new Date("2026-04-01"); // Wednesday
    const end = new Date("2026-04-07"); // Tuesday
    const result = getWeekendMarkers(start, end);
    // Should find Sat Apr 4 and Sun Apr 5
    expect(result).toHaveLength(2);
  });

  it("returns no markers for a weekday-only range", () => {
    // Mon Apr 6 to Thu Apr 9
    const start = new Date("2026-04-06");
    const end = new Date("2026-04-09");
    const result = getWeekendMarkers(start, end);
    expect(result).toHaveLength(0);
  });

  it("markers have position between 0 and 100", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-04-30");
    const result = getWeekendMarkers(start, end);
    for (const m of result) {
      expect(m.position).toBeGreaterThanOrEqual(0);
      expect(m.position).toBeLessThanOrEqual(100);
      expect(m.width).toBeGreaterThan(0);
    }
  });
});

// ─── getHolidayMarkers ─────────────────────────────────────────────────────

describe("getHolidayMarkers", () => {
  it("returns empty array for invalid dates", () => {
    const result = getHolidayMarkers(new Date("invalid"), new Date("2026-04-30"), () => false);
    expect(result).toHaveLength(0);
  });

  it("returns markers for days the isHolidayFn returns true", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-04-03");
    // Only Apr 2 is a holiday
    const isHoliday = (d: string) => d === "2026-04-02";
    const result = getHolidayMarkers(start, end, isHoliday);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-02");
  });

  it("returns no markers when no holidays", () => {
    const start = new Date("2026-04-01");
    const end = new Date("2026-04-07");
    const result = getHolidayMarkers(start, end, () => false);
    expect(result).toHaveLength(0);
  });
});

// ─── calculateBarPosition ──────────────────────────────────────────────────

describe("calculateBarPosition", () => {
  it("returns {left: 0, width: 0} for invalid dates", () => {
    const result = calculateBarPosition("invalid", "invalid", new Date("2026-04-01"), new Date("2026-06-30"));
    expect(result.left).toBe(0);
    expect(result.width).toBe(0);
  });

  it("computes position within timeline bounds", () => {
    const tlStart = new Date("2026-04-01");
    const tlEnd = new Date("2026-06-30");
    const result = calculateBarPosition("2026-04-15", "2026-05-15", tlStart, tlEnd);
    expect(result.left).toBeGreaterThan(0);
    expect(result.left).toBeLessThan(100);
    expect(result.width).toBeGreaterThan(0);
  });

  it("bar spanning full timeline has left near 0 and width near 100", () => {
    const tlStart = "2026-04-01";
    const tlEnd = "2026-06-30";
    const result = calculateBarPosition("2026-04-01", "2026-06-30", tlStart, tlEnd);
    expect(result.left).toBeCloseTo(0, 0);
    // Width should be close to 100 (extended by +1 day)
    expect(result.width).toBeGreaterThan(90);
  });
});
