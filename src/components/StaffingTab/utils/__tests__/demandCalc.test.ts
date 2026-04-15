import { describe, it, expect } from "vitest";
import {
  sanitizeGrade,
  generateMonthBuckets,
  computeDemandByMonth,
  buildDemandSupplyRows,
  getNeedsForCell,
} from "../demandCalc";
import type { MonthBucket, GradeDemand, GradeSupply } from "../demandCalc";
import type { StaffingNeedItem, StaffingAssignment } from "../../../../types";

// ─── sanitizeGrade ─────────────────────────────────────────────────────────

describe("sanitizeGrade", () => {
  it("removes spaces from grade names", () => {
    expect(sanitizeGrade("Senior Consultant")).toBe("SeniorConsultant");
    expect(sanitizeGrade("Senior Manager")).toBe("SeniorManager");
  });

  it("returns single-word grades unchanged", () => {
    expect(sanitizeGrade("Manager")).toBe("Manager");
    expect(sanitizeGrade("Partner")).toBe("Partner");
  });

  it("handles empty string", () => {
    expect(sanitizeGrade("")).toBe("");
  });
});

// ─── generateMonthBuckets ──────────────────────────────────────────────────

describe("generateMonthBuckets", () => {
  it("generates correct number of buckets", () => {
    const buckets = generateMonthBuckets("2026-01-15", 3);
    expect(buckets).toHaveLength(3);
  });

  it("aligns to first of month regardless of input day", () => {
    const buckets = generateMonthBuckets("2026-03-20", 2);
    expect(buckets[0].startDate).toBe("2026-03-01");
    expect(buckets[0].endDate).toBe("2026-04-01");
    expect(buckets[1].startDate).toBe("2026-04-01");
    expect(buckets[1].endDate).toBe("2026-05-01");
  });

  it("generates correct month keys", () => {
    const buckets = generateMonthBuckets("2026-11-01", 3);
    expect(buckets[0].key).toBe("2026-11");
    expect(buckets[1].key).toBe("2026-12");
    expect(buckets[2].key).toBe("2027-01");
  });

  it("counts working days excluding weekends", () => {
    // April 2026 has 22 working days (no holidays passed)
    const buckets = generateMonthBuckets("2026-04-01", 1);
    expect(buckets[0].workingDays).toBeGreaterThan(0);
    expect(buckets[0].workingDays).toBeLessThanOrEqual(23); // max possible
  });

  it("excludes holidays from working day count", () => {
    const noHoliday = generateMonthBuckets("2026-04-01", 1, () => false);
    const withHoliday = generateMonthBuckets("2026-04-01", 1, () => true);
    expect(withHoliday[0].workingDays).toBe(0);
    expect(noHoliday[0].workingDays).toBeGreaterThan(0);
  });

  it("returns empty array for zero months", () => {
    expect(generateMonthBuckets("2026-01-01", 0)).toHaveLength(0);
  });
});

// ─── computeDemandByMonth ──────────────────────────────────────────────────

describe("computeDemandByMonth", () => {
  const makeBuckets = (): MonthBucket[] => [
    { key: "2026-04", label: "avr. 26", startDate: "2026-04-01", endDate: "2026-05-01", workingDays: 22 },
  ];

  const makeNeed = (overrides: Partial<StaffingNeedItem> = {}): StaffingNeedItem => ({
    id: "n1",
    grade: "Consultant",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    utilization: 100,
    quantity: 1,
    ...overrides,
  });

  it("computes ETP for a need fully overlapping a bucket", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed()];
    const result = computeDemandByMonth(needs, [], buckets);
    const byGrade = result.get("2026-04")!;
    // Full overlap: 22 working days / 22 bucket days * qty 1 * util 1 = 1.0 ETP
    expect(byGrade["Consultant"]).toBeDefined();
    expect(byGrade["Consultant"].etp).toBeCloseTo(1.0, 1);
  });

  it("excludes cancelled needs", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ status: "cancelled" })];
    const result = computeDemandByMonth(needs, [], buckets);
    const byGrade = result.get("2026-04")!;
    expect(Object.keys(byGrade)).toHaveLength(0);
  });

  it("excludes fully filled needs (assignments cover all quantity)", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ id: "n1", quantity: 1 })];
    const assignments: StaffingAssignment[] = [
      {
        id: "a1",
        needId: "n1",
        empId: "E1",
        empName: "Test",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        utilization: 100,
        status: "confirmed",
        source: "manual",
        scenarioId: null,
        createdAt: "2026-01-01",
      },
    ];
    const result = computeDemandByMonth(needs, assignments, buckets);
    const byGrade = result.get("2026-04")!;
    expect(Object.keys(byGrade)).toHaveLength(0);
  });

  it("applies probability weighting to etpWeighted", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ probability: 0.5 })];
    const result = computeDemandByMonth(needs, [], buckets);
    const d = result.get("2026-04")!["Consultant"];
    expect(d.etpWeighted).toBeCloseTo(d.etp * 0.5, 2);
  });

  it("applies utilization percentage to ETP", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ utilization: 50 })]; // 50% → 0.5 ETP
    const result = computeDemandByMonth(needs, [], buckets);
    const d = result.get("2026-04")!["Consultant"];
    expect(d.etp).toBeCloseTo(0.5, 1);
  });

  it("handles needs with no dates gracefully", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ startDate: "", endDate: "" })];
    const result = computeDemandByMonth(needs, [], buckets);
    const byGrade = result.get("2026-04")!;
    expect(Object.keys(byGrade)).toHaveLength(0);
  });

  it("falls back to Unknown when grade is empty", () => {
    const buckets = makeBuckets();
    const needs = [makeNeed({ grade: "" })];
    const result = computeDemandByMonth(needs, [], buckets);
    const byGrade = result.get("2026-04")!;
    expect(byGrade["Unknown"]).toBeDefined();
  });
});

// ─── buildDemandSupplyRows ─────────────────────────────────────────────────

describe("buildDemandSupplyRows", () => {
  it("builds a row per bucket with totals at zero when no data", () => {
    const buckets: MonthBucket[] = [
      { key: "2026-04", label: "avr. 26", startDate: "2026-04-01", endDate: "2026-05-01", workingDays: 22 },
    ];
    const demand = new Map<string, Record<string, GradeDemand>>();
    const supply = new Map<string, Record<string, GradeSupply>>();
    const rows = buildDemandSupplyRows(buckets, demand, supply);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthKey).toBe("2026-04");
    expect(rows[0].demandTotal).toBe(0);
    expect(rows[0].supplyTotal).toBe(0);
    expect(rows[0].gapTotal).toBe(0);
  });

  it("computes gapTotal = demandTotal - matchedTotal", () => {
    const buckets: MonthBucket[] = [
      { key: "2026-04", label: "avr. 26", startDate: "2026-04-01", endDate: "2026-05-01", workingDays: 22 },
    ];
    const demand = new Map<string, Record<string, GradeDemand>>();
    demand.set("2026-04", {
      Consultant: { etp: 2, etpWeighted: 1.5, headcount: 2, needIds: ["n1"], opportunityIds: [] },
    });
    const supply = new Map<string, Record<string, GradeSupply>>();
    supply.set("2026-04", {
      Consultant: { availableEtp: 0.8, totalEtp: 3 },
    });
    const rows = buildDemandSupplyRows(buckets, demand, supply);
    expect(rows[0].demandTotal).toBe(2);
    expect(rows[0].matchedTotal).toBe(0.8);
    expect(rows[0].gapTotal).toBe(1.2);
  });
});

// ─── getNeedsForCell ───────────────────────────────────────────────────────

describe("getNeedsForCell", () => {
  const buckets: MonthBucket[] = [
    { key: "2026-04", label: "avr. 26", startDate: "2026-04-01", endDate: "2026-05-01", workingDays: 22 },
    { key: "2026-05", label: "mai 26", startDate: "2026-05-01", endDate: "2026-06-01", workingDays: 21 },
  ];

  const makeNeed = (overrides: Partial<StaffingNeedItem> = {}): StaffingNeedItem => ({
    id: "n1",
    grade: "Consultant",
    startDate: "2026-04-10",
    endDate: "2026-04-20",
    utilization: 100,
    ...overrides,
  });

  it("returns needs overlapping the given month and grade", () => {
    const needs = [makeNeed()];
    const result = getNeedsForCell("2026-04", "Consultant", needs, buckets);
    expect(result).toHaveLength(1);
  });

  it("excludes needs for a different grade", () => {
    const needs = [makeNeed()];
    const result = getNeedsForCell("2026-04", "Manager", needs, buckets);
    expect(result).toHaveLength(0);
  });

  it("excludes cancelled needs", () => {
    const needs = [makeNeed({ status: "cancelled" })];
    const result = getNeedsForCell("2026-04", "Consultant", needs, buckets);
    expect(result).toHaveLength(0);
  });

  it("returns empty for unknown month key", () => {
    const needs = [makeNeed()];
    const result = getNeedsForCell("2099-01", "Consultant", needs, buckets);
    expect(result).toHaveLength(0);
  });
});
