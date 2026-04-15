/**
 * Tests for shared formatting utilities.
 */

import { describe, it, expect } from "vitest";
import {
  getToday,
  formatCurrency,
  formatCompactCurrency,
  formatDateFR,
  formatDateWithOptions,
  getMonthNameFR,
  formatPercentage,
  getWinPercentageColor,
} from "../formatters";

describe("getToday", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getToday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns same value when called twice (cached)", () => {
    expect(getToday()).toBe(getToday());
  });
});

describe("formatCurrency", () => {
  it("formats positive number as EUR", () => {
    const result = formatCurrency(1234567);
    expect(result).toContain("1 234 567");
    expect(result).toContain("€");
  });

  it("formats null as 0 €", () => {
    const result = formatCurrency(null);
    expect(result).toContain("0");
    expect(result).toContain("€");
  });

  it("formats undefined as 0 €", () => {
    const result = formatCurrency(undefined);
    expect(result).toContain("0");
  });

  it("respects fraction digits options", () => {
    const result = formatCurrency(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(result).toContain("1 234,56");
  });
});

describe("formatCompactCurrency", () => {
  it("formats millions compactly", () => {
    const result = formatCompactCurrency(1500000);
    // French compact notation: "1,5 M €" or similar
    expect(result).toContain("€");
    expect(result.length).toBeLessThan(15);
  });

  it("formats null as 0", () => {
    const result = formatCompactCurrency(null);
    expect(result).toContain("0");
  });
});

describe("formatDateFR", () => {
  it("formats ISO string to French date", () => {
    const result = formatDateFR("2025-01-15");
    expect(result).toBe("15/01/2025");
  });

  it("formats Date object", () => {
    const result = formatDateFR(new Date(2025, 0, 15));
    expect(result).toBe("15/01/2025");
  });

  it("returns dash for null", () => {
    expect(formatDateFR(null)).toBe("-");
  });

  it("returns dash for undefined", () => {
    expect(formatDateFR(undefined)).toBe("-");
  });

  it("returns dash for empty string", () => {
    expect(formatDateFR("")).toBe("-");
  });

  it("returns dash for '-'", () => {
    expect(formatDateFR("-")).toBe("-");
  });

  it("returns dash for invalid date", () => {
    expect(formatDateFR("not-a-date")).toBe("-");
  });
});

describe("formatDateWithOptions", () => {
  it("formats with default options (DD/MM/YYYY)", () => {
    const result = formatDateWithOptions("2025-03-20");
    expect(result).toBe("20/03/2025");
  });

  it("formats with custom options", () => {
    const result = formatDateWithOptions("2025-03-20", { month: "long", year: "numeric" });
    expect(result).toContain("2025");
  });

  it("returns empty string for null", () => {
    expect(formatDateWithOptions(null)).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateWithOptions("invalid")).toBe("");
  });
});

describe("getMonthNameFR", () => {
  it("returns French month name", () => {
    const result = getMonthNameFR("2025-01-15");
    expect(result).toBe("janvier");
  });

  it("returns empty string for null", () => {
    expect(getMonthNameFR(null)).toBe("");
  });

  it("handles Date object", () => {
    const result = getMonthNameFR(new Date(2025, 11, 1)); // December
    expect(result).toBe("décembre");
  });
});

describe("formatPercentage", () => {
  it("formats number with 1 decimal by default", () => {
    expect(formatPercentage(75.5)).toBe("75.5%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercentage(75.567, 2)).toBe("75.57%");
  });

  it("returns 0% for null", () => {
    expect(formatPercentage(null)).toBe("0%");
  });

  it("returns 0% for undefined", () => {
    expect(formatPercentage(undefined)).toBe("0%");
  });

  it("returns 0% for NaN", () => {
    expect(formatPercentage(NaN)).toBe("0%");
  });

  it("formats 100 correctly", () => {
    expect(formatPercentage(100, 0)).toBe("100%");
  });

  it("formats 0 correctly", () => {
    expect(formatPercentage(0)).toBe("0.0%");
  });
});

describe("getWinPercentageColor", () => {
  it("returns 'default' for null", () => {
    expect(getWinPercentageColor(null)).toBe("default");
  });

  it("returns 'default' for 0", () => {
    expect(getWinPercentageColor(0)).toBe("default");
  });

  it("returns 'error' for < 25%", () => {
    expect(getWinPercentageColor(10)).toBe("error");
  });

  it("returns 'warning' for 25-49%", () => {
    expect(getWinPercentageColor(30)).toBe("warning");
  });

  it("returns 'info' for 50-74%", () => {
    expect(getWinPercentageColor(60)).toBe("info");
  });

  it("returns 'success' for >= 75%", () => {
    expect(getWinPercentageColor(80)).toBe("success");
  });
});
