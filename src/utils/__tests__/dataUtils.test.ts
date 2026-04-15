/**
 * Tests for dataUtils — data grouping, summing, and revenue calculation.
 */

import { describe, it, expect } from "vitest";
import { getUniqueValues, groupDataBy, sumBy, calculateRevenueWithSegmentLogic } from "../dataUtils";

describe("getUniqueValues", () => {
  it("returns unique values from a column", () => {
    const data = [{ grade: "Consultant" }, { grade: "Analyst" }, { grade: "Consultant" }, { grade: "Manager" }];
    const result = getUniqueValues(data, "grade");
    expect(result).toHaveLength(3);
    expect(result).toContain("Consultant");
    expect(result).toContain("Analyst");
    expect(result).toContain("Manager");
  });

  it("filters out null, undefined, and empty values", () => {
    const data = [{ grade: "A" }, { grade: null }, { grade: undefined }, { grade: "" }, { grade: "B" }];
    expect(getUniqueValues(data, "grade")).toEqual(["A", "B"]);
  });

  it("returns empty array for empty data", () => {
    expect(getUniqueValues([], "grade")).toEqual([]);
  });

  it("returns empty array when column doesn't exist", () => {
    expect(getUniqueValues([{ a: 1 }], "b")).toEqual([]);
  });
});

describe("groupDataBy", () => {
  it("groups items by column value", () => {
    const data = [
      { grade: "A", name: "Alice" },
      { grade: "B", name: "Bob" },
      { grade: "A", name: "Anna" },
    ];
    const result = groupDataBy(data, "grade");
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["A"]).toHaveLength(2);
    expect(result["B"]).toHaveLength(1);
  });

  it("skips items with falsy group key", () => {
    const data = [
      { grade: "A", name: "Alice" },
      { grade: null, name: "Ghost" },
      { grade: "", name: "Empty" },
    ];
    const result = groupDataBy(data, "grade");
    expect(Object.keys(result)).toEqual(["A"]);
  });

  it("returns empty object for empty data", () => {
    expect(groupDataBy([], "grade")).toEqual({});
  });
});

describe("sumBy", () => {
  it("sums numeric column values", () => {
    const data = [{ revenue: 100 }, { revenue: 200 }, { revenue: 300 }];
    expect(sumBy(data, "revenue")).toBe(600);
  });

  it("ignores non-numeric values", () => {
    const data = [{ revenue: 100 }, { revenue: "not a number" }, { revenue: null }, { revenue: 200 }];
    expect(sumBy(data, "revenue")).toBe(300);
  });

  it("returns 0 for empty data", () => {
    expect(sumBy([], "revenue")).toBe(0);
  });
});

describe("calculateRevenueWithSegmentLogic", () => {
  it("returns full gross revenue for special segment codes (AUTO)", () => {
    const item = { subSegmentCode: "AUTO", grossRevenue: 1000, netRevenue: 800 };
    expect(calculateRevenueWithSegmentLogic(item)).toBe(1000);
  });

  it("returns net revenue for special segment when toggle is on", () => {
    const item = { subSegmentCode: "AUTO", grossRevenue: 1000, netRevenue: 800 };
    expect(calculateRevenueWithSegmentLogic(item, true)).toBe(800);
  });

  it("returns Operations-allocated revenue for non-special segments", () => {
    const item = {
      subSegmentCode: "FIN",
      grossRevenue: 1000,
      serviceLine1: "Operations",
      serviceOffering1Pct: 60,
    };
    expect(calculateRevenueWithSegmentLogic(item)).toBe(600);
  });

  it("returns 0 when no Operations service line", () => {
    const item = {
      subSegmentCode: "FIN",
      grossRevenue: 1000,
      serviceLine1: "Technology",
      serviceOffering1Pct: 100,
    };
    expect(calculateRevenueWithSegmentLogic(item)).toBe(0);
  });

  it("handles missing revenue fields gracefully", () => {
    const item = { subSegmentCode: "AUTO" };
    expect(calculateRevenueWithSegmentLogic(item)).toBe(0);
  });

  it("sums multiple Operations allocations across service lines", () => {
    const item = {
      subSegmentCode: "FIN",
      grossRevenue: 1000,
      serviceLine1: "Operations",
      serviceOffering1Pct: 40,
      serviceLine2: "Operations",
      serviceOffering2Pct: 30,
    };
    expect(calculateRevenueWithSegmentLogic(item)).toBe(700);
  });
});
