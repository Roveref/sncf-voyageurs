import { describe, it, expect, vi } from "vitest";

// Force UTC timezone to avoid local TZ issues with toISOString
process.env.TZ = "UTC";

// Mock the database before importing shared.ts (top-level db access)
vi.mock("../../../db/database.js", () => ({
  default: { prepare: () => ({ get: () => null, all: () => [] }) },
}));

import {
  eachWorkday,
  countWorkdays,
  overlapDays,
  addDays,
  isWeekend,
  isPublicHoliday,
  hpd,
  gradeIndex,
  GRADE_ORDER,
  GRADE_TU_TARGET,
  CHARGEABLE_CATS,
  ABSENCE_CATS,
  TRAINING_CATS,
  GO_CATS,
  DEFAULT_HPD,
} from "../shared.js";

// ── Constants ──

describe("constants", () => {
  it("GRADE_ORDER has 8 grades from Partner to Intern", () => {
    expect(GRADE_ORDER).toHaveLength(8);
    expect(GRADE_ORDER[0]).toBe("Partner");
    expect(GRADE_ORDER[7]).toBe("Intern");
  });

  it("every grade in GRADE_ORDER has a TU target", () => {
    for (const g of GRADE_ORDER) {
      expect(GRADE_TU_TARGET[g]).toBeGreaterThan(0);
    }
  });

  it("category sets are non-empty and disjoint", () => {
    expect(CHARGEABLE_CATS.size).toBeGreaterThan(0);
    expect(ABSENCE_CATS.size).toBeGreaterThan(0);
    expect(TRAINING_CATS.size).toBeGreaterThan(0);
    expect(GO_CATS.size).toBeGreaterThan(0);

    const all = [...CHARGEABLE_CATS, ...ABSENCE_CATS, ...TRAINING_CATS, ...GO_CATS];
    expect(new Set(all).size).toBe(all.length); // no overlap
  });
});

// ── hpd / gradeIndex ──

describe("hpd", () => {
  it("returns 7 for Intern", () => {
    expect(hpd("Intern")).toBe(7);
  });

  it("returns 8 (default) for other grades", () => {
    expect(hpd("Manager")).toBe(DEFAULT_HPD);
    expect(hpd("Partner")).toBe(DEFAULT_HPD);
    expect(hpd("Consultant")).toBe(DEFAULT_HPD);
  });

  it("returns default for unknown grades", () => {
    expect(hpd("Unknown")).toBe(DEFAULT_HPD);
  });
});

describe("gradeIndex", () => {
  it("returns correct index for known grades", () => {
    expect(gradeIndex("Partner")).toBe(0);
    expect(gradeIndex("Intern")).toBe(7);
    expect(gradeIndex("Manager")).toBe(3);
  });

  it("returns 99 for unknown grades", () => {
    expect(gradeIndex("Unknown")).toBe(99);
  });
});

// ── Date helpers ──

describe("isWeekend", () => {
  it("Saturday is weekend", () => {
    expect(isWeekend(new Date("2026-03-28"))).toBe(true); // Saturday
  });

  it("Sunday is weekend", () => {
    expect(isWeekend(new Date("2026-03-29"))).toBe(true); // Sunday
  });

  it("Monday is not weekend", () => {
    expect(isWeekend(new Date("2026-03-30"))).toBe(false); // Monday
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    expect(addDays("2026-03-30", 1)).toBe("2026-03-31");
    expect(addDays("2026-03-30", 7)).toBe("2026-04-06");
  });

  it("handles month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("handles negative days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("isPublicHoliday", () => {
  it("Jan 1 is a holiday", () => {
    expect(isPublicHoliday("2026-01-01")).toBe(true);
  });

  it("Christmas is a holiday", () => {
    expect(isPublicHoliday("2026-12-25")).toBe(true);
  });

  it("regular day is not a holiday", () => {
    expect(isPublicHoliday("2026-03-30")).toBe(false);
  });

  it("May 1 (Labor Day) is a holiday", () => {
    expect(isPublicHoliday("2026-05-01")).toBe(true);
  });
});

// ── Workday calculations ──

describe("eachWorkday", () => {
  it("returns only weekdays excluding holidays", () => {
    // Mon Jun 1 to Fri Jun 5 2026 = 5 weekdays, no holidays
    const days = eachWorkday("2026-06-01", "2026-06-05");
    expect(days).toHaveLength(5);
    expect(days[0]).toBe("2026-06-01");
    expect(days[4]).toBe("2026-06-05");
  });

  it("excludes weekends", () => {
    // Mon Jun 1 to Sun Jun 7 = 5 weekdays
    const days = eachWorkday("2026-06-01", "2026-06-07");
    expect(days).toHaveLength(5);
    for (const d of days) {
      const date = new Date(d + "T12:00:00");
      expect(isWeekend(date)).toBe(false);
    }
  });

  it("excludes public holidays", () => {
    // Week containing Jan 1 2026 (Thursday)
    const days = eachWorkday("2025-12-29", "2026-01-02");
    expect(days).not.toContain("2026-01-01");
  });

  it("returns empty for reversed range", () => {
    expect(eachWorkday("2026-06-05", "2026-06-01")).toEqual([]);
  });

  it("returns single day for same start/end on weekday", () => {
    // Wednesday Jun 3
    expect(eachWorkday("2026-06-03", "2026-06-03")).toEqual(["2026-06-03"]);
  });

  it("returns empty for same start/end on weekend", () => {
    expect(eachWorkday("2026-06-06", "2026-06-06")).toEqual([]); // Saturday
  });
});

describe("countWorkdays", () => {
  it("counts correctly for a normal week", () => {
    expect(countWorkdays("2026-06-01", "2026-06-05")).toBe(5);
  });

  it("returns 0 for weekend-only range", () => {
    expect(countWorkdays("2026-06-06", "2026-06-07")).toBe(0);
  });
});

describe("overlapDays", () => {
  it("returns workdays in the overlap of two ranges", () => {
    // Range A: Jun 1 - Jun 12, Range B: Jun 8 - Jun 19
    // Overlap: Jun 8 - Jun 12 (Mon-Fri = 5 days)
    const days = overlapDays("2026-06-01", "2026-06-12", "2026-06-08", "2026-06-19");
    expect(days).toHaveLength(5);
    expect(days[0]).toBe("2026-06-08");
    expect(days[4]).toBe("2026-06-12");
  });

  it("returns empty for non-overlapping ranges", () => {
    const days = overlapDays("2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15");
    expect(days).toEqual([]);
  });

  it("handles identical ranges", () => {
    const days = overlapDays("2026-06-01", "2026-06-05", "2026-06-01", "2026-06-05");
    expect(days).toHaveLength(5);
  });

  it("handles single-day overlap", () => {
    // Wednesday Jun 3
    const days = overlapDays("2026-06-03", "2026-06-03", "2026-06-03", "2026-06-10");
    expect(days).toHaveLength(1);
    expect(days[0]).toBe("2026-06-03");
  });
});
