import { describe, it, expect } from "vitest";
import {
  makePipeline,
  extractResH,
  extractNcH,
  buildHoursSummary,
  accumulateDayForPipeline,
  accumulateHolidayForPipeline,
  buildCatBreakdown,
  buildPeriodSummary,
  buildTopProjects,
  calculatePresenceFTE,
} from "../periodDetailCalc";

// ─── makePipeline ──────────────────────────────────────────────────────────

describe("makePipeline", () => {
  it("returns a fresh pipeline with all numeric fields at zero", () => {
    const pipe = makePipeline();
    expect(pipe.baseH).toBe(0);
    expect(pipe.absH).toBe(0);
    expect(pipe.holH).toBe(0);
    expect(pipe.chH).toBe(0);
    expect(pipe.goH).toBe(0);
    expect(pipe.trH).toBe(0);
    expect(pipe.overH).toBe(0);
    expect(pipe.missingH).toBe(0);
    expect(pipe.empDayCount).toBe(0);
    expect(Object.keys(pipe.catHoursMap)).toHaveLength(0);
    expect(Object.keys(pipe.catMap)).toHaveLength(0);
    expect(Object.keys(pipe.projectHoursMap)).toHaveLength(0);
    expect(pipe.daysSet.size).toBe(0);
  });
});

// ─── extractResH ───────────────────────────────────────────────────────────

describe("extractResH", () => {
  it("extracts reservation hours from the map", () => {
    expect(extractResH({ reservation: 16, chargeable: 40 })).toBe(16);
  });

  it("returns 0 when reservation key is absent", () => {
    expect(extractResH({ chargeable: 40 })).toBe(0);
  });

  it("returns 0 for empty map", () => {
    expect(extractResH({})).toBe(0);
  });
});

// ─── extractNcH ────────────────────────────────────────────────────────────

describe("extractNcH", () => {
  it("sums only non-categorized hours", () => {
    const hm: Record<string, number> = {
      vacation: 8, // absence → excluded
      chargeable: 40, // chargeable → excluded
      generalOppty: 4, // GO → excluded
      training: 4, // training → excluded
      reservation: 2, // reservation → excluded
      holiday: 8, // holiday → excluded
      meeting: 6, // NC → included
      admin: 4, // NC → included
    };
    expect(extractNcH(hm)).toBe(10);
  });

  it("returns 0 when all categories are known", () => {
    expect(extractNcH({ vacation: 8, chargeable: 32 })).toBe(0);
  });

  it("returns 0 for empty map", () => {
    expect(extractNcH({})).toBe(0);
  });
});

// ─── buildHoursSummary ─────────────────────────────────────────────────────

describe("buildHoursSummary", () => {
  it("divides all values by divBy and computes netH, tu, to", () => {
    // 10 days worth: baseH=80, absH=8, holH=8 => netH=64, chH=32, goH=8, trH=4
    const s = buildHoursSummary(800, 80, 80, 320, 80, 40, 0, 0, 0, 10);
    expect(s.totalBase).toBe(80);
    expect(s.absH).toBe(8);
    expect(s.holH).toBe(8);
    expect(s.netH).toBe(64); // max(0, 80 - 8 - 8)
    expect(s.chH).toBe(32);
    expect(s.goH).toBe(8);
    expect(s.trH).toBe(4);
    expect(s.tu).toBeCloseTo((32 / 64) * 100); // 50%
    expect(s.to).toBeCloseTo(((32 + 8 + 4) / 64) * 100); // 68.75%
  });

  it("returns tu=100 and to=100 when netH is near zero", () => {
    // base=8, abs=8, hol=0 => net = 0
    const s = buildHoursSummary(8, 8, 0, 0, 0, 0, 0, 0, 0, 1);
    expect(s.netH).toBe(0);
    expect(s.tu).toBe(100);
    expect(s.to).toBe(100);
  });

  it("computes diH as remaining net hours", () => {
    // base=80, no abs/hol => net=80, ch=40, go=10, tr=5, res=5, nc=5
    const s = buildHoursSummary(80, 0, 0, 40, 10, 5, 5, 5, 0, 1);
    expect(s.diH).toBe(80 - 40 - 10 - 5 - 5 - 5); // 15
    expect(s.otH).toBe(10); // resH + ncH = 5 + 5
  });

  it("clamps diH to zero when work exceeds net", () => {
    // net=80, but ch+go+tr+res+nc = 90
    const s = buildHoursSummary(80, 0, 0, 50, 20, 10, 5, 5, 0, 1);
    expect(s.diH).toBe(0);
  });
});

// ─── accumulateHolidayForPipeline ──────────────────────────────────────────

describe("accumulateHolidayForPipeline", () => {
  it("adds base and holiday hours for a holiday day", () => {
    const pipe = makePipeline();
    accumulateHolidayForPipeline(pipe, 8, 3);
    expect(pipe.baseH).toBe(8);
    expect(pipe.holH).toBe(8);
    expect(pipe.catHoursMap["holiday"]).toBe(8);
    expect(pipe.catMap["holiday"]).toBe(100);
    expect(pipe.empDayCount).toBe(1);
    expect(pipe.daysSet.has(3)).toBe(true);
  });

  it("accumulates across multiple holiday calls", () => {
    const pipe = makePipeline();
    accumulateHolidayForPipeline(pipe, 8, 0);
    accumulateHolidayForPipeline(pipe, 8, 5);
    expect(pipe.baseH).toBe(16);
    expect(pipe.holH).toBe(16);
    expect(pipe.empDayCount).toBe(2);
    expect(pipe.daysSet.size).toBe(2);
  });
});

// ─── buildCatBreakdown ─────────────────────────────────────────────────────

describe("buildCatBreakdown", () => {
  it("divides by divBy and sorts descending by avg", () => {
    const catMap = { chargeable: 200, vacation: 100, training: 50 };
    const result = buildCatBreakdown(catMap, 10);
    expect(result).toHaveLength(3);
    expect(result[0].category).toBe("chargeable");
    expect(result[0].avg).toBe(20);
    expect(result[1].category).toBe("vacation");
    expect(result[1].avg).toBe(10);
    expect(result[2].category).toBe("training");
    expect(result[2].avg).toBe(5);
  });

  it("includes avgH when hoursMap is provided", () => {
    const catMap = { chargeable: 200 };
    const hoursMap = { chargeable: 160 };
    const result = buildCatBreakdown(catMap, 10, hoursMap);
    expect(result[0].avgH).toBe(16);
  });

  it("does not include avgH when hoursMap is omitted", () => {
    const result = buildCatBreakdown({ chargeable: 100 }, 5);
    expect(result[0]).not.toHaveProperty("avgH");
  });

  it("handles empty catMap", () => {
    expect(buildCatBreakdown({}, 10)).toHaveLength(0);
  });
});

// ─── buildPeriodSummary ────────────────────────────────────────────────────

describe("buildPeriodSummary", () => {
  it("returns null when dayCount is zero", () => {
    const pipe = makePipeline();
    expect(buildPeriodSummary(pipe, 0)).toBeNull();
  });

  it("returns null when dayCount is negative", () => {
    const pipe = makePipeline();
    expect(buildPeriodSummary(pipe, -1)).toBeNull();
  });

  it("returns a valid summary when pipeline has data", () => {
    const pipe = makePipeline();
    pipe.baseH = 160;
    pipe.absH = 16;
    pipe.holH = 0;
    pipe.chH = 80;
    pipe.goH = 16;
    pipe.trH = 8;
    pipe.overH = 0;
    pipe.catHoursMap = { chargeable: 80, vacation: 16, generalOppty: 16, training: 8 };
    const result = buildPeriodSummary(pipe, 2);
    expect(result).not.toBeNull();
    expect(result!.totalBase).toBe(80);
    expect(result!.chH).toBe(40);
    expect(result!.netH).toBe(72); // 80 - 8 - 0
  });
});

// ─── buildTopProjects ──────────────────────────────────────────────────────

describe("buildTopProjects", () => {
  it("returns all entries when 5 or fewer", () => {
    const pipe = makePipeline();
    pipe.projectHoursMap = {
      "Alpha::J001": { hours: 40, account: "Acme", jobNo: "J001", oppName: "Alpha" },
      "Beta::J002": { hours: 20, account: "Acme", jobNo: "J002", oppName: "Beta" },
    };
    const result = buildTopProjects(pipe, 1);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alpha");
    expect(result[0].hours).toBe(40);
    expect(result[1].name).toBe("Beta");
  });

  it("rolls up entries beyond top 5 into 'Others...'", () => {
    const pipe = makePipeline();
    for (let i = 0; i < 7; i++) {
      pipe.projectHoursMap[`P${i}::J${i}`] = {
        hours: (7 - i) * 10,
        account: "A",
        jobNo: `J${i}`,
        oppName: `P${i}`,
      };
    }
    const result = buildTopProjects(pipe, 1);
    expect(result).toHaveLength(6); // 5 + Others
    expect(result[5].name).toBe("Others\u2026");
    // Others = P5 (20) + P6 (10) = 30
    expect(result[5].hours).toBe(30);
  });

  it("divides hours by divBy", () => {
    const pipe = makePipeline();
    pipe.projectHoursMap = {
      "Alpha::J1": { hours: 80, account: "A", jobNo: "J1", oppName: "Alpha" },
    };
    const result = buildTopProjects(pipe, 4);
    expect(result[0].hours).toBe(20);
  });

  it("returns empty array for empty pipeline", () => {
    const pipe = makePipeline();
    expect(buildTopProjects(pipe, 1)).toHaveLength(0);
  });
});

// ─── calculatePresenceFTE ──────────────────────────────────────────────────

describe("calculatePresenceFTE", () => {
  it("returns fallback when workDays is zero", () => {
    const map = new Map<string, number>();
    map.set("E001", 20);
    expect(calculatePresenceFTE(map, 0, 5)).toBe(5);
  });

  it("caps each employee contribution at 1.0", () => {
    const map = new Map<string, number>();
    map.set("E001", 100); // 100/20 = 5 → capped at 1
    map.set("E002", 10); // 10/20 = 0.5
    expect(calculatePresenceFTE(map, 20, 0)).toBeCloseTo(1.5);
  });

  it("returns 0 for empty map with positive workDays", () => {
    const map = new Map<string, number>();
    expect(calculatePresenceFTE(map, 20, 3)).toBe(0);
  });

  it("computes fractional FTE correctly", () => {
    const map = new Map<string, number>();
    map.set("E001", 15); // 15/20 = 0.75
    map.set("E002", 5); // 5/20 = 0.25
    expect(calculatePresenceFTE(map, 20, 0)).toBeCloseTo(1.0);
  });
});
