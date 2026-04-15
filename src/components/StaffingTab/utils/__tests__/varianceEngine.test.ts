import { describe, it, expect } from "vitest";
import { computeSapChH, computeMdsChH, computeVarianceDelta, computeVarianceRate } from "../varianceEngine";

// ─── computeSapChH ──────────────────────────────────────────────────────────

describe("computeSapChH", () => {
  it("computes chargeable hours from segments with full scale", () => {
    const segments = [
      { category: "chargeable", util: 80 },
      { category: "vacation", util: 20 },
    ];
    // only chargeable counted: 80 * 1.0 * 8 / 100 = 6.4
    expect(computeSapChH(segments, 1.0, 8, false)).toBeCloseTo(6.4);
  });

  it("applies chScale to chargeable segments", () => {
    const segments = [{ category: "chargeable", util: 100 }];
    // 100 * 0.7 * 8 / 100 = 5.6
    expect(computeSapChH(segments, 0.7, 8, false)).toBeCloseTo(5.6);
  });

  it("includes GO when chargeableCombined=true", () => {
    const segments = [
      { category: "chargeable", util: 50 },
      { category: "generalOppty", util: 30 },
    ];
    // (50 + 30) * 1.0 * 8 / 100 = 6.4
    expect(computeSapChH(segments, 1.0, 8, true)).toBeCloseTo(6.4);
  });

  it("excludes GO when chargeableCombined=false", () => {
    const segments = [
      { category: "chargeable", util: 50 },
      { category: "generalOppty", util: 30 },
    ];
    // 50 * 1.0 * 8 / 100 = 4.0
    expect(computeSapChH(segments, 1.0, 8, false)).toBeCloseTo(4.0);
  });

  it("returns 0 for empty segments", () => {
    expect(computeSapChH([], 1.0, 8, true)).toBe(0);
  });

  it("returns 0 when no chargeable segments", () => {
    const segments = [
      { category: "vacation", util: 50 },
      { category: "training", util: 30 },
    ];
    expect(computeSapChH(segments, 1.0, 8, true)).toBe(0);
  });

  it("applies chScale of 0 (fully capped)", () => {
    const segments = [{ category: "chargeable", util: 100 }];
    expect(computeSapChH(segments, 0, 8, false)).toBe(0);
  });

  it("uses intern hours (7h)", () => {
    const segments = [{ category: "chargeable", util: 100 }];
    expect(computeSapChH(segments, 1.0, 7, false)).toBeCloseTo(7.0);
  });

  it("excludes travel from chargeable", () => {
    const segments = [{ category: "travel", util: 50 }];
    expect(computeSapChH(segments, 1.0, 8, false)).toBeCloseTo(0);
  });
});

// ─── computeMdsChH ──────────────────────────────────────────────────────────

describe("computeMdsChH", () => {
  it("computes MDS chargeable hours from forecast segments", () => {
    const segments = [
      { category: "vacation", util: 20 },
      { category: "chargeable", util: 60 },
    ];
    // abs=20, ch=60, net=80, cappedCh=60 => (60/100)*8 = 4.8
    expect(computeMdsChH(segments, 8, true)).toBeCloseTo(4.8);
  });

  it("caps chargeable when over net capacity", () => {
    const segments = [
      { category: "vacation", util: 50 },
      { category: "chargeable", util: 80 },
    ];
    // abs=50, net=50, cappedCh=50 => (50/100)*8 = 4.0
    expect(computeMdsChH(segments, 8, true)).toBeCloseTo(4.0);
  });

  it("returns 0 for empty segments", () => {
    expect(computeMdsChH([], 8, true)).toBe(0);
  });

  it("includes GO when chargeableCombined=true", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 30 },
    ];
    // ch=70, cappedCh=70 => (70/100)*8 = 5.6
    expect(computeMdsChH(segments, 8, true)).toBeCloseTo(5.6);
  });

  it("excludes GO when chargeableCombined=false", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 30 },
    ];
    // ch=40, cappedCh=40 => (40/100)*8 = 3.2
    expect(computeMdsChH(segments, 8, false)).toBeCloseTo(3.2);
  });
});

// ─── computeVarianceDelta ───────────────────────────────────────────────────

describe("computeVarianceDelta", () => {
  it("returns positive when SAP exceeds MDS", () => {
    expect(computeVarianceDelta(6.0, 4.0)).toBeCloseTo(2.0);
  });

  it("returns negative when SAP is below MDS", () => {
    expect(computeVarianceDelta(3.0, 5.0)).toBeCloseTo(-2.0);
  });

  it("returns 0 when SAP equals MDS", () => {
    expect(computeVarianceDelta(4.0, 4.0)).toBe(0);
  });

  it("handles zero values", () => {
    expect(computeVarianceDelta(0, 0)).toBe(0);
  });

  it("handles large values", () => {
    expect(computeVarianceDelta(1000, 500)).toBeCloseTo(500);
  });
});

// ─── computeVarianceRate ────────────────────────────────────────────────────

describe("computeVarianceRate", () => {
  it("returns null when no SAP emp days", () => {
    expect(computeVarianceRate(0, 0, 0, 0, 0)).toBeNull();
  });

  it("returns 0 when SAP and forecast TU are equal", () => {
    expect(computeVarianceRate(10, 600, 200, 600, 200)).toBeCloseTo(0);
  });

  it("returns positive delta when SAP TU > forecast TU", () => {
    // sapNet = 10*100 - 200 = 800, sapTU = 700/800*100 = 87.5
    // fNet = 10*100 - 200 = 800, forecastTU = 600/800*100 = 75
    const result = computeVarianceRate(10, 700, 200, 600, 200);
    expect(result).toBeCloseTo(12.5);
  });

  it("returns negative delta when SAP TU < forecast TU", () => {
    const result = computeVarianceRate(10, 500, 200, 600, 200);
    expect(result).toBeCloseTo(-12.5);
  });

  it("handles full absence (net=0) -> returns 0 variance (both TU=100)", () => {
    expect(computeVarianceRate(1, 0, 100, 0, 100)).toBeCloseTo(0);
  });

  it("handles different absence rates between SAP and forecast", () => {
    // sapNet = 5*100 - 100 = 400, sapTU = 300/400*100 = 75
    // fNet = 5*100 - 50 = 450, forecastTU = 300/450*100 = 66.67
    const result = computeVarianceRate(5, 300, 100, 300, 50);
    expect(result).toBeCloseTo(75 - 66.6667, 1);
  });
});
