import { describe, it, expect } from "vitest";
import {
  getRevenueValue,
  calculateBaseTotalRevenue,
  calculateTotalRevenue,
  calculateAllocatedRevenue,
  type OpportunityItem,
} from "../utils/revenueCalculations";
import {
  calculateMedianOpportunitySize,
  calculateMinMaxOpportunitySize,
  calculateParetoConcentration,
  calculateStandardDeviation,
} from "../utils/sizeCalculations";
import { computePipelineStock } from "../utils/pipelineStockCalculations";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makeOpp = (overrides: Partial<OpportunityItem> = {}): OpportunityItem => ({
  grossRevenue: 100_000,
  netRevenue: 80_000,
  ...overrides,
});

const makeAllocatedOpp = (overrides: Partial<OpportunityItem> = {}): OpportunityItem => ({
  grossRevenue: 200_000,
  netRevenue: 160_000,
  isAllocated: true,
  allocatedGrossRevenue: 50_000,
  allocatedNetRevenue: 40_000,
  ...overrides,
});

// ─── getRevenueValue ─────────────────────────────────────────────────────────

describe("getRevenueValue", () => {
  it("returns grossRevenue when showNetRevenue is false and item is not allocated", () => {
    const opp = makeOpp();
    expect(getRevenueValue(opp, false)).toBe(100_000);
  });

  it("returns netRevenue when showNetRevenue is true and item is not allocated", () => {
    const opp = makeOpp();
    expect(getRevenueValue(opp, true)).toBe(80_000);
  });

  it("returns allocatedGrossRevenue when item is allocated and showNetRevenue is false", () => {
    const opp = makeAllocatedOpp();
    expect(getRevenueValue(opp, false)).toBe(50_000);
  });

  it("returns allocatedNetRevenue when item is allocated and showNetRevenue is true", () => {
    const opp = makeAllocatedOpp();
    expect(getRevenueValue(opp, true)).toBe(40_000);
  });

  it("returns 0 when grossRevenue is undefined", () => {
    expect(getRevenueValue({}, false)).toBe(0);
  });
});

// ─── calculateBaseTotalRevenue ────────────────────────────────────────────────

describe("calculateBaseTotalRevenue", () => {
  it("sums grossRevenue across items", () => {
    const opps = [makeOpp({ grossRevenue: 100_000 }), makeOpp({ grossRevenue: 200_000 })];
    expect(calculateBaseTotalRevenue(opps, false)).toBe(300_000);
  });

  it("sums netRevenue when showNetRevenue is true", () => {
    const opps = [makeOpp({ netRevenue: 50_000 }), makeOpp({ netRevenue: 70_000 })];
    expect(calculateBaseTotalRevenue(opps, true)).toBe(120_000);
  });

  it("returns 0 for empty array", () => {
    expect(calculateBaseTotalRevenue([], false)).toBe(0);
  });

  it("uses base revenue even for allocated items (ignores allocation)", () => {
    const opps = [makeAllocatedOpp()];
    // calculateBaseTotalRevenue always uses base revenue, never allocated
    expect(calculateBaseTotalRevenue(opps, false)).toBe(200_000);
  });
});

// ─── calculateTotalRevenue ────────────────────────────────────────────────────

describe("calculateTotalRevenue", () => {
  it("uses allocatedGrossRevenue for allocated items", () => {
    const opps = [makeAllocatedOpp()];
    expect(calculateTotalRevenue(opps, false)).toBe(50_000);
  });

  it("falls back to grossRevenue for non-allocated items", () => {
    const opps = [makeOpp()];
    expect(calculateTotalRevenue(opps, false)).toBe(100_000);
  });

  it("mixes allocated and non-allocated items correctly", () => {
    const opps = [makeOpp({ grossRevenue: 100_000 }), makeAllocatedOpp({ allocatedGrossRevenue: 25_000 })];
    expect(calculateTotalRevenue(opps, false)).toBe(125_000);
  });
});

// ─── calculateAllocatedRevenue ────────────────────────────────────────────────

describe("calculateAllocatedRevenue", () => {
  it("sums allocatedGrossRevenue when showNetRevenue is false", () => {
    const opps = [
      makeAllocatedOpp({ allocatedGrossRevenue: 30_000 }),
      makeAllocatedOpp({ allocatedGrossRevenue: 20_000 }),
    ];
    expect(calculateAllocatedRevenue(opps, false)).toBe(50_000);
  });

  it("returns 0 for items without allocated revenue fields", () => {
    const opps = [makeOpp()];
    expect(calculateAllocatedRevenue(opps, false)).toBe(0);
  });
});

// ─── calculateMedianOpportunitySize ──────────────────────────────────────────

describe("calculateMedianOpportunitySize", () => {
  it("returns 0 for empty array", () => {
    expect(calculateMedianOpportunitySize([], false)).toBe(0);
  });

  it("returns the single value for a one-item array", () => {
    const opps = [makeOpp({ grossRevenue: 50_000 })];
    expect(calculateMedianOpportunitySize(opps, false)).toBe(50_000);
  });

  it("returns middle value for odd-length array", () => {
    const opps = [
      makeOpp({ grossRevenue: 10_000 }),
      makeOpp({ grossRevenue: 30_000 }),
      makeOpp({ grossRevenue: 20_000 }),
    ];
    expect(calculateMedianOpportunitySize(opps, false)).toBe(20_000);
  });

  it("returns average of two middle values for even-length array", () => {
    const opps = [
      makeOpp({ grossRevenue: 10_000 }),
      makeOpp({ grossRevenue: 20_000 }),
      makeOpp({ grossRevenue: 30_000 }),
      makeOpp({ grossRevenue: 40_000 }),
    ];
    expect(calculateMedianOpportunitySize(opps, false)).toBe(25_000);
  });

  it("ignores zero-revenue items when calculating median", () => {
    const opps = [makeOpp({ grossRevenue: 0 }), makeOpp({ grossRevenue: 10_000 }), makeOpp({ grossRevenue: 20_000 })];
    expect(calculateMedianOpportunitySize(opps, false)).toBe(15_000);
  });
});

// ─── calculateMinMaxOpportunitySize ──────────────────────────────────────────

describe("calculateMinMaxOpportunitySize", () => {
  it("returns { min: 0, max: 0 } for empty array", () => {
    expect(calculateMinMaxOpportunitySize([], false)).toEqual({ min: 0, max: 0 });
  });

  it("correctly identifies min and max values", () => {
    const opps = [
      makeOpp({ grossRevenue: 50_000 }),
      makeOpp({ grossRevenue: 300_000 }),
      makeOpp({ grossRevenue: 120_000 }),
    ];
    const result = calculateMinMaxOpportunitySize(opps, false);
    expect(result.min).toBe(50_000);
    expect(result.max).toBe(300_000);
  });
});

// ─── calculateParetoConcentration ────────────────────────────────────────────

describe("calculateParetoConcentration", () => {
  it("returns zeros for empty array", () => {
    const result = calculateParetoConcentration([], false);
    expect(result).toEqual({ top20Count: 0, top20Revenue: 0, top20Percentage: 0 });
  });

  it("top20Percentage is between 0 and 100", () => {
    const opps = Array.from({ length: 10 }, (_, i) => makeOpp({ grossRevenue: (i + 1) * 10_000 }));
    const result = calculateParetoConcentration(opps, false);
    expect(result.top20Percentage).toBeGreaterThan(0);
    expect(result.top20Percentage).toBeLessThanOrEqual(100);
  });

  it("top20Count is ceil(20%) of item count", () => {
    const opps = Array.from({ length: 10 }, () => makeOpp());
    const result = calculateParetoConcentration(opps, false);
    expect(result.top20Count).toBe(2); // ceil(10 * 0.2) = 2
  });
});

// ─── calculateStandardDeviation ──────────────────────────────────────────────

describe("calculateStandardDeviation", () => {
  it("returns 0 for empty array", () => {
    expect(calculateStandardDeviation([], false, 0)).toBe(0);
  });

  it("returns 0 when all values are equal (no variance)", () => {
    const opps = [makeOpp({ grossRevenue: 100 }), makeOpp({ grossRevenue: 100 }), makeOpp({ grossRevenue: 100 })];
    expect(calculateStandardDeviation(opps, false, 100)).toBe(0);
  });

  it("returns a positive number when values vary", () => {
    const opps = [makeOpp({ grossRevenue: 100 }), makeOpp({ grossRevenue: 200 }), makeOpp({ grossRevenue: 300 })];
    const avg = 200;
    expect(calculateStandardDeviation(opps, false, avg)).toBeGreaterThan(0);
  });
});

// ─── computePipelineStock ─────────────────────────────────────────────────────

describe("computePipelineStock", () => {
  it("returns empty result for empty array", () => {
    const result = computePipelineStock([], false);
    expect(result).toEqual({ years: [], monthlyData: [] });
  });

  it("filters out opportunities with irrelevant statuses", () => {
    const opps = [{ status: 99, creationDate: "2024-01-15", grossRevenue: 100_000 }];
    const result = computePipelineStock(opps, false);
    expect(result.years).toHaveLength(0);
  });

  it("includes opportunities with valid pipeline statuses (1-11, 14-15)", () => {
    const opps = [
      { status: 1, creationDate: "2024-03-10", grossRevenue: 50_000 },
      { status: 6, creationDate: "2024-05-20", grossRevenue: 80_000 },
    ];
    const result = computePipelineStock(opps, false, 2024);
    expect(result.years).toContain(2024);
    expect(result.monthlyData).toHaveLength(12);
  });

  it("monthlyData always contains 12 months with monthName", () => {
    const opps = [{ status: 4, creationDate: "2024-06-01", grossRevenue: 100_000 }];
    const { monthlyData } = computePipelineStock(opps, false, 2024);
    expect(monthlyData).toHaveLength(12);
    for (const row of monthlyData) {
      expect(row).toHaveProperty("monthName");
      expect(row.month).toBeGreaterThanOrEqual(0);
      expect(row.month).toBeLessThanOrEqual(11);
    }
  });
});
