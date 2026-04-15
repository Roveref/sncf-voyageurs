import { describe, it, expect } from "vitest";
import { accumulateSegments } from "../segmentHelpers";

// ─── accumulateSegments ─────────────────────────────────────────────────────

describe("accumulateSegments", () => {
  it("classifies mixed segments correctly", () => {
    const segments = [
      { category: "vacation", util: 20 },
      { category: "chargeable", util: 50 },
      { category: "generalOppty", util: 15 },
      { category: "training", util: 10 },
      { category: "unknown_cat", util: 5 },
    ];
    const result = accumulateSegments(segments, false);
    expect(result.absU).toBe(20);
    expect(result.chU).toBe(50);
    expect(result.goU).toBe(15);
    expect(result.trU).toBe(10);
    expect(result.otherU).toBe(5);
  });

  it("merges GO into chargeable when chargeableCombined=true", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 20 },
    ];
    const result = accumulateSegments(segments, true);
    expect(result.chU).toBe(60);
    expect(result.goU).toBe(0);
  });

  it("keeps GO separate when chargeableCombined=false", () => {
    const segments = [
      { category: "chargeable", util: 40 },
      { category: "generalOppty", util: 20 },
    ];
    const result = accumulateSegments(segments, false);
    expect(result.chU).toBe(40);
    expect(result.goU).toBe(20);
  });

  it("handles empty segments", () => {
    const result = accumulateSegments([], true);
    expect(result.absU).toBe(0);
    expect(result.chU).toBe(0);
    expect(result.goU).toBe(0);
    expect(result.trU).toBe(0);
    expect(result.otherU).toBe(0);
  });

  it("handles multiple absence categories", () => {
    const segments = [
      { category: "vacation", util: 30 },
      { category: "rtt", util: 20 },
      { category: "illness", util: 10 },
    ];
    const result = accumulateSegments(segments, true);
    expect(result.absU).toBe(60);
  });

  it("handles chargeable sub-categories (pending, overtime) and excludes travel", () => {
    const segments = [
      { category: "chargeable", util: 30 },
      { category: "pending", util: 20 },
      { category: "overtime", util: 10 },
      { category: "travel", util: 5 },
    ];
    const result = accumulateSegments(segments, true);
    expect(result.chU).toBe(60);
  });

  it("converts hours to utilization via hoursPerDay", () => {
    const segments = [
      { category: "chargeable", hours: 4 },
      { category: "vacation", hours: 2 },
    ];
    const result = accumulateSegments(segments, false, 8);
    // 4/8 * 100 = 50, 2/8 * 100 = 25
    expect(result.chU).toBeCloseTo(50);
    expect(result.absU).toBeCloseTo(25);
  });

  it("uses utilization field as fallback when util is undefined and no hoursPerDay", () => {
    const segments = [
      { category: "chargeable", utilization: 75 },
      { category: "vacation", utilization: 20 },
    ];
    const result = accumulateSegments(segments as any, false);
    expect(result.chU).toBe(75);
    expect(result.absU).toBe(20);
  });

  it("prefers util over hours and utilization", () => {
    const segments = [{ category: "chargeable", util: 50, hours: 8, utilization: 100 }];
    const result = accumulateSegments(segments, false);
    expect(result.chU).toBe(50);
  });

  it("prefers hours (with hoursPerDay) over utilization", () => {
    const segments = [{ category: "chargeable", hours: 4, utilization: 100 }];
    const result = accumulateSegments(segments, false, 8);
    expect(result.chU).toBeCloseTo(50);
  });

  it("handles training category", () => {
    const segments = [{ category: "training", util: 40 }];
    const result = accumulateSegments(segments, false);
    expect(result.trU).toBe(40);
    expect(result.chU).toBe(0);
  });

  it("handles intern hours (7h)", () => {
    const segments = [{ category: "chargeable", hours: 7 }];
    const result = accumulateSegments(segments, false, 7);
    expect(result.chU).toBeCloseTo(100);
  });
});
