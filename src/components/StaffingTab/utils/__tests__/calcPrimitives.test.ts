import { describe, it, expect } from "vitest";
import { accumulateSegmentsByCategory, capUtilizations, computeTuRate, computeToRate } from "../calcPrimitives";
import { computeMdsChargeableHours } from "../varianceEngine";

// ─── accumulateSegmentsByCategory ────────────────────────────────────────────

describe("accumulateSegmentsByCategory", () => {
  it("classifies mixed segments correctly", () => {
    const segments = [
      { category: "vacation", util: 20 },
      { category: "chargeable", util: 50 },
      { category: "generalOppty", util: 15 },
      { category: "training", util: 10 },
      { category: "unknown_cat", util: 5 },
    ];
    const result = accumulateSegmentsByCategory(segments, false);
    expect(result.absU).toBe(20);
    expect(result.chU).toBe(50);
    expect(result.goU).toBe(15);
    expect(result.trU).toBe(10);
    expect(result.otU).toBe(5);
    expect(result.rawGoU).toBe(15);
  });

  it("merges GO into chargeable when chargeableCombined=true", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 20 },
    ];
    const result = accumulateSegmentsByCategory(segments, true);
    expect(result.chU).toBe(60);
    expect(result.goU).toBe(0);
    expect(result.rawGoU).toBe(20);
  });

  it("keeps GO separate when chargeableCombined=false", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 20 },
    ];
    const result = accumulateSegmentsByCategory(segments, false);
    expect(result.chU).toBe(40);
    expect(result.goU).toBe(20);
    expect(result.rawGoU).toBe(20);
  });

  it("handles empty segments", () => {
    const result = accumulateSegmentsByCategory([], true);
    expect(result.absU).toBe(0);
    expect(result.chU).toBe(0);
    expect(result.goU).toBe(0);
    expect(result.trU).toBe(0);
    expect(result.otU).toBe(0);
  });

  it("handles multiple absence categories", () => {
    const segments = [
      { category: "vacation", util: 30 },
      { category: "rtt", util: 20 },
      { category: "illness", util: 10 },
    ];
    const result = accumulateSegmentsByCategory(segments, true);
    expect(result.absU).toBe(60);
  });

  it("handles chargeable sub-categories (pending, overtime) and excludes travel", () => {
    const segments = [
      { category: "chargeable", util: 30 },
      { category: "pending", util: 20 },
      { category: "overtime", util: 10 },
      { category: "travel", util: 5 },
    ];
    const result = accumulateSegmentsByCategory(segments, true);
    expect(result.chU).toBe(60);
  });
});

// ─── capUtilizations ─────────────────────────────────────────────────────────

describe("capUtilizations", () => {
  it("caps normally when under 100%", () => {
    const result = capUtilizations({ absU: 20, chU: 50, goU: 10, trU: 10 });
    expect(result.cappedAbsU).toBe(20);
    expect(result.netU).toBe(80);
    expect(result.cappedChU).toBe(50);
    expect(result.cappedGoU).toBe(10);
    expect(result.cappedTrU).toBe(10);
    expect(result.absScale).toBe(1);
    expect(result.chScale).toBe(1);
  });

  it("caps chargeable when exceeding net capacity", () => {
    const result = capUtilizations({ absU: 30, chU: 90, goU: 0, trU: 0 });
    expect(result.netU).toBe(70);
    expect(result.cappedChU).toBe(70);
    expect(result.chScale).toBeCloseTo(70 / 90);
  });

  it("handles absence > 100%", () => {
    const result = capUtilizations({ absU: 120, chU: 50, goU: 10, trU: 5 });
    expect(result.cappedAbsU).toBe(100);
    expect(result.netU).toBe(0);
    expect(result.cappedChU).toBe(0);
    expect(result.cappedGoU).toBe(0);
    expect(result.cappedTrU).toBe(0);
    expect(result.absScale).toBeCloseTo(100 / 120);
    expect(result.chScale).toBe(0);
  });

  it("applies priority: ch before go before tr", () => {
    // 40% abs → 60% net, 50 ch + 20 go + 10 tr = 80 > 60
    const result = capUtilizations({ absU: 40, chU: 50, goU: 20, trU: 10 });
    expect(result.cappedChU).toBe(50); // fits in 60
    expect(result.cappedGoU).toBe(10); // 60-50=10 remaining
    expect(result.cappedTrU).toBe(0); // nothing left
    expect(result.goScale).toBeCloseTo(10 / 20);
    expect(result.trScale).toBe(0);
  });

  it("handles zero values", () => {
    const result = capUtilizations({ absU: 0, chU: 0, goU: 0, trU: 0 });
    expect(result.netU).toBe(100);
    expect(result.cappedTotal).toBe(0);
    expect(result.absScale).toBe(1);
    expect(result.chScale).toBe(1);
    expect(result.goScale).toBe(1);
    expect(result.trScale).toBe(1);
  });

  it("computes cappedTotal correctly", () => {
    const result = capUtilizations({ absU: 10, chU: 40, goU: 15, trU: 10 });
    expect(result.cappedTotal).toBe(10 + 40 + 15 + 10);
  });

  it("caps otU after tr", () => {
    // 0 abs → 100 net, 60 ch + 0 go + 10 tr + 50 ot → 30 remaining for ot
    const result = capUtilizations({ absU: 0, chU: 60, goU: 0, trU: 10, otU: 50 });
    expect(result.cappedOtU).toBe(30);
  });
});

// ─── computeMdsChargeableHours ───────────────────────────────────────────────

describe("computeMdsChargeableHours", () => {
  it("computes chargeable hours from forecast segments", () => {
    const segments = [
      { category: "vacation", util: 20 },
      { category: "chargeable", util: 60 },
    ];
    // abs=20, ch=60, net=80, cappedCh=60 → hours = (60/100)*8 = 4.8
    const result = computeMdsChargeableHours(segments, 8, true);
    expect(result).toBeCloseTo(4.8);
  });

  it("caps chargeable when over net capacity", () => {
    const segments = [
      { category: "vacation", util: 50 },
      { category: "chargeable", util: 80 },
    ];
    // abs=50, ch=80, net=50, cappedCh=50 → hours = (50/100)*8 = 4.0
    const result = computeMdsChargeableHours(segments, 8, true);
    expect(result).toBeCloseTo(4.0);
  });

  it("uses intern hours (7h)", () => {
    const segments = [{ category: "chargeable", util: 100 }];
    const result = computeMdsChargeableHours(segments, 7, true);
    expect(result).toBeCloseTo(7.0);
  });

  it("includes GO when chargeableCombined", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 30 },
    ];
    const result = computeMdsChargeableHours(segments, 8, true);
    // ch=70, cappedCh=70 → (70/100)*8 = 5.6
    expect(result).toBeCloseTo(5.6);
  });

  it("excludes GO when not chargeableCombined", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 30 },
    ];
    const result = computeMdsChargeableHours(segments, 8, false);
    // ch=40, cappedCh=40 → (40/100)*8 = 3.2
    expect(result).toBeCloseTo(3.2);
  });

  it("returns 0 for empty segments", () => {
    expect(computeMdsChargeableHours([], 8, true)).toBe(0);
  });
});

// ─── computeTuRate / computeToRate ───────────────────────────────────────────

describe("computeTuRate", () => {
  it("computes normal TU", () => {
    expect(computeTuRate(60, 80)).toBeCloseTo(75);
  });

  it("returns fallback when netU is 0", () => {
    expect(computeTuRate(0, 0)).toBe(100);
    expect(computeTuRate(0, 0, 0)).toBe(0);
  });

  it("returns 100% when fully chargeable", () => {
    expect(computeTuRate(100, 100)).toBeCloseTo(100);
  });
});

describe("computeToRate", () => {
  it("computes TO including go and training", () => {
    // (50 + 10 + 20) / 100 * 100 = 80
    expect(computeToRate(50, 10, 20, 100)).toBeCloseTo(80);
  });

  it("returns fallback when netU is 0", () => {
    expect(computeToRate(0, 0, 0, 0)).toBe(100);
    expect(computeToRate(0, 0, 0, 0, 0)).toBe(0);
  });
});
