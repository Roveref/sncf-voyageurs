/**
 * Tests for dateUtils — date manipulation and working-day calculations.
 */

import { describe, it, expect } from "vitest";
import {
  getMonthDay,
  isWeekend,
  isHolidayEnabled,
  isWorkingDay,
  countWorkingDays,
  countWorkingDaysInRange,
  parseDate,
  getPositionFromDate,
  addDays,
  addMonths,
  toDateString,
  formatLocalDate,
  daysBetween,
  toISODateString,
} from "../dateUtils";

describe("getMonthDay", () => {
  it("returns MM-DD from string", () => {
    expect(getMonthDay("2025-01-15")).toBe("01-15");
  });

  it("returns MM-DD from Date", () => {
    expect(getMonthDay(new Date(2025, 11, 25))).toBe("12-25");
  });

  it("pads single-digit month", () => {
    expect(getMonthDay("2025-03-05")).toBe("03-05");
  });
});

describe("isWeekend", () => {
  it("Saturday is weekend", () => {
    expect(isWeekend("2025-04-05")).toBe(true); // Saturday
  });

  it("Sunday is weekend", () => {
    expect(isWeekend("2025-04-06")).toBe(true); // Sunday
  });

  it("Monday is not weekend", () => {
    expect(isWeekend("2025-04-07")).toBe(false); // Monday
  });

  it("Friday is not weekend", () => {
    expect(isWeekend("2025-04-04")).toBe(false); // Friday
  });

  it("accepts Date object", () => {
    expect(isWeekend(new Date(2025, 3, 5))).toBe(true); // Saturday April 5
  });
});

describe("isHolidayEnabled", () => {
  it("returns true for date in Set", () => {
    const holidays = new Set(["2025-01-01", "2025-12-25"]);
    expect(isHolidayEnabled("2025-01-01", holidays)).toBe(true);
  });

  it("returns false for date not in Set", () => {
    const holidays = new Set(["2025-01-01"]);
    expect(isHolidayEnabled("2025-01-02", holidays)).toBe(false);
  });

  it("works with array", () => {
    expect(isHolidayEnabled("2025-01-01", ["2025-01-01", "2025-12-25"])).toBe(true);
    expect(isHolidayEnabled("2025-01-02", ["2025-01-01", "2025-12-25"])).toBe(false);
  });
});

describe("isWorkingDay", () => {
  it("weekday without holiday is working day", () => {
    expect(isWorkingDay("2025-04-07")).toBe(true); // Monday
  });

  it("weekend is not working day", () => {
    expect(isWorkingDay("2025-04-05")).toBe(false); // Saturday
  });

  it("holiday is not working day", () => {
    const holidays = new Set(["2025-04-07"]);
    expect(isWorkingDay("2025-04-07", holidays)).toBe(false);
  });
});

describe("countWorkingDays", () => {
  it("counts 5 working days in a full week", () => {
    // Mon Apr 7 to Fri Apr 11 = 5 working days
    expect(countWorkingDays("2025-04-07", "2025-04-11")).toBe(5);
  });

  it("counts 0 for weekend-only range", () => {
    expect(countWorkingDays("2025-04-05", "2025-04-06")).toBe(0);
  });

  it("counts 1 for a single working day", () => {
    expect(countWorkingDays("2025-04-07", "2025-04-07")).toBe(1);
  });

  it("excludes holidays", () => {
    // 5 working days minus 1 holiday = 4
    expect(countWorkingDays("2025-04-07", "2025-04-11", ["2025-04-09"])).toBe(4);
  });

  it("returns 0 for invalid dates", () => {
    expect(countWorkingDays("invalid", "also-invalid")).toBe(0);
  });

  it("uses cache when provided", () => {
    const cache = new Map<string, number>();
    const result1 = countWorkingDays("2025-04-07", "2025-04-11", [], cache);
    expect(cache.size).toBe(1);
    const result2 = countWorkingDays("2025-04-07", "2025-04-11", [], cache);
    expect(result1).toBe(result2);
  });
});

describe("countWorkingDaysInRange", () => {
  it("counts working days [start, end) exclusive of end", () => {
    const start = new Date(2025, 3, 7); // Monday
    const end = new Date(2025, 3, 12); // Saturday (exclusive)
    expect(countWorkingDaysInRange(start, end)).toBe(5);
  });

  it("excludes holidays via predicate", () => {
    const start = new Date(2025, 3, 7);
    const end = new Date(2025, 3, 12);
    const isHoliday = (d: string) => d === "2025-04-09";
    expect(countWorkingDaysInRange(start, end, isHoliday)).toBe(4);
  });
});

describe("parseDate", () => {
  it("parses DD/MM/YYYY to YYYY-MM-DD", () => {
    expect(parseDate("15/01/2025")).toBe("2025-01-15");
  });

  it("parses DD/MM/YY to YYYY-MM-DD", () => {
    expect(parseDate("15/01/25")).toBe("2025-01-15");
  });

  it("parses DD.MM.YYYY to YYYY-MM-DD", () => {
    expect(parseDate("15.01.2025")).toBe("2025-01-15");
  });

  it("passes through YYYY-MM-DD unchanged", () => {
    expect(parseDate("2025-01-15")).toBe("2025-01-15");
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("pads single-digit day and month", () => {
    expect(parseDate("5/3/2025")).toBe("2025-03-05");
  });
});

describe("getPositionFromDate", () => {
  it("returns 0 for start date", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 31);
    expect(getPositionFromDate(start, start, end)).toBeCloseTo(0, 0);
  });

  it("returns ~100 for end date", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 31);
    expect(getPositionFromDate(end, start, end)).toBeCloseTo(100, 0);
  });

  it("returns ~50 for midpoint", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 31);
    const mid = new Date(2025, 0, 16);
    expect(getPositionFromDate(mid, start, end)).toBeCloseTo(50, 0);
  });

  it("clamps to 0 for date before range", () => {
    const start = new Date(2025, 0, 10);
    const end = new Date(2025, 0, 31);
    expect(getPositionFromDate("2025-01-01", start, end)).toBe(0);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const result = addDays(new Date(2025, 0, 1), 10);
    expect(result.getDate()).toBe(11);
  });

  it("adds negative days", () => {
    const result = addDays(new Date(2025, 0, 10), -5);
    expect(result.getDate()).toBe(5);
  });

  it("crosses month boundary", () => {
    const result = addDays(new Date(2025, 0, 30), 5);
    expect(result.getMonth()).toBe(1); // February
  });
});

describe("addMonths", () => {
  it("adds months correctly", () => {
    const result = addMonths(new Date(2025, 0, 15), 3);
    expect(result.getMonth()).toBe(3); // April
  });

  it("handles year rollover", () => {
    const result = addMonths(new Date(2025, 10, 1), 3); // November + 3
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February
  });
});

describe("toDateString", () => {
  it("converts Date to YYYY-MM-DD", () => {
    expect(toDateString(new Date(2025, 0, 15))).toBe("2025-01-15");
  });

  it("passes through YYYY-MM-DD string", () => {
    expect(toDateString("2025-01-15")).toBe("2025-01-15");
  });

  it("returns empty for falsy", () => {
    expect(toDateString("" as any)).toBe("");
  });

  it("parses European date strings", () => {
    expect(toDateString("15/01/2025")).toBe("2025-01-15");
  });
});

describe("formatLocalDate", () => {
  it("formats Date to YYYY-MM-DD", () => {
    expect(formatLocalDate(new Date(2025, 0, 5))).toBe("2025-01-05");
  });

  it("pads month and day", () => {
    expect(formatLocalDate(new Date(2025, 2, 3))).toBe("2025-03-03");
  });

  it("passes through strings", () => {
    expect(formatLocalDate("already-a-string")).toBe("already-a-string");
  });
});

describe("toISODateString", () => {
  it("converts valid Date", () => {
    expect(toISODateString(new Date(2025, 0, 15))).toBe("2025-01-15");
  });

  it("returns null for invalid Date", () => {
    expect(toISODateString(new Date("invalid"))).toBeNull();
  });
});

describe("daysBetween", () => {
  it("computes correct day count", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 11);
    expect(daysBetween(start, end)).toBe(10);
  });

  it("returns 0 for same date", () => {
    const d = new Date(2025, 0, 1);
    expect(daysBetween(d, d)).toBe(0);
  });

  it("handles negative range", () => {
    const start = new Date(2025, 0, 11);
    const end = new Date(2025, 0, 1);
    expect(daysBetween(start, end)).toBe(-10);
  });
});
