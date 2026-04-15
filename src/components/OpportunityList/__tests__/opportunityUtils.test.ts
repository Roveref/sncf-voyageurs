import { describe, it, expect } from "vitest";
import {
  getTechnologyPartnerTags,
  hasTechnologyPartner,
  getRevenueForSorting,
  getRevenueSortModeLabel,
} from "../utils/opportunityUtils";

// ─── getTechnologyPartnerTags ─────────────────────────────────────────────────

describe("getTechnologyPartnerTags", () => {
  it("returns unique partner names from the four partner fields", () => {
    const opp = {
      "Technology Partner": "Microsoft",
      techPartner1: "SAP",
      techPartner2: "Microsoft", // duplicate
      techPartner3: null,
    };
    const tags = getTechnologyPartnerTags(opp);
    expect(tags).toContain("Microsoft");
    expect(tags).toContain("SAP");
    // Deduplicated: Microsoft appears only once
    expect(tags.filter((t) => t === "Microsoft")).toHaveLength(1);
  });

  it("filters out excluded placeholder values", () => {
    const opp = {
      "Technology Partner": "-",
      techPartner1: "N/A",
      techPartner2: "None",
      techPartner3: "SAP",
    };
    const tags = getTechnologyPartnerTags(opp);
    expect(tags).not.toContain("-");
    expect(tags).not.toContain("N/A");
    expect(tags).not.toContain("None");
    expect(tags).toContain("SAP");
  });

  it("returns empty array when all partners are excluded or missing", () => {
    const opp = {
      "Technology Partner": null,
      techPartner1: "",
      techPartner2: "N/A",
      techPartner3: undefined,
    };
    expect(getTechnologyPartnerTags(opp)).toHaveLength(0);
  });

  it("returns empty array for empty object", () => {
    expect(getTechnologyPartnerTags({})).toHaveLength(0);
  });

  it("handles whitespace-padded partner names by trimming", () => {
    const opp = {
      techPartner1: "  AWS  ",
      techPartner2: undefined,
      techPartner3: undefined,
    };
    // The function trims before checking exclusion, so "  AWS  " passes through
    // Note: it trims only for the exclusion check, but the raw value is stored
    const tags = getTechnologyPartnerTags(opp);
    // Should not be empty — the value is valid after trimming
    expect(tags.length).toBeGreaterThan(0);
  });
});

// ─── hasTechnologyPartner ─────────────────────────────────────────────────────

describe("hasTechnologyPartner", () => {
  it("returns true for an exact case-insensitive match", () => {
    const opp = {
      techPartner1: "Microsoft",
      techPartner2: undefined,
      techPartner3: undefined,
      "Technology Partner": undefined,
    };
    expect(hasTechnologyPartner(opp, "microsoft")).toBe(true);
  });

  it("returns true for a partial match", () => {
    const opp = {
      techPartner1: "Microsoft Azure",
      techPartner2: undefined,
      techPartner3: undefined,
      "Technology Partner": undefined,
    };
    expect(hasTechnologyPartner(opp, "Azure")).toBe(true);
  });

  it("returns false when partner is not present", () => {
    const opp = {
      techPartner1: "SAP",
      techPartner2: undefined,
      techPartner3: undefined,
      "Technology Partner": undefined,
    };
    expect(hasTechnologyPartner(opp, "Oracle")).toBe(false);
  });

  it("returns false when all partner fields are excluded values", () => {
    const opp = { techPartner1: "N/A", techPartner2: "-", techPartner3: undefined, "Technology Partner": undefined };
    expect(hasTechnologyPartner(opp, "SAP")).toBe(false);
  });
});

// ─── getRevenueForSorting ─────────────────────────────────────────────────────

describe("getRevenueForSorting", () => {
  const grossOpp = { grossRevenue: 100_000, netRevenue: 80_000 };
  const netOpp = { grossRevenue: 200_000, netRevenue: 150_000 };
  const allocatedOpp = {
    grossRevenue: 200_000,
    netRevenue: 160_000,
    allocatedGrossRevenue: 60_000,
    allocatedNetRevenue: 45_000,
    isAllocated: true,
  };

  it("returns grossRevenue for 'total' mode when showNetRevenue is false", () => {
    expect(getRevenueForSorting(grossOpp, false, "total")).toBe(100_000);
  });

  it("returns netRevenue for 'total' mode when showNetRevenue is true", () => {
    expect(getRevenueForSorting(netOpp, true, "total")).toBe(150_000);
  });

  it("returns grossRevenue for unknown mode (default branch)", () => {
    expect(getRevenueForSorting(grossOpp, false, "unknown")).toBe(100_000);
  });

  it("returns allocatedGrossRevenue for 'filtered' mode on an allocated item", () => {
    expect(getRevenueForSorting(allocatedOpp, false, "filtered")).toBe(60_000);
  });

  it("returns grossRevenue for 'filtered' mode on a non-allocated item", () => {
    expect(getRevenueForSorting(grossOpp, false, "filtered")).toBe(100_000);
  });

  it("returns 0 when revenue field is missing", () => {
    expect(getRevenueForSorting({}, false, "total")).toBe(0);
  });
});

// ─── getRevenueSortModeLabel ──────────────────────────────────────────────────

describe("getRevenueSortModeLabel", () => {
  it("returns 'Total Gross' for mode=total and showNetRevenue=false", () => {
    expect(getRevenueSortModeLabel("total", false)).toBe("Total Gross");
  });

  it("returns 'Total Net' for mode=total and showNetRevenue=true", () => {
    expect(getRevenueSortModeLabel("total", true)).toBe("Total Net");
  });

  it("returns 'I&O Gross' for mode=io and showNetRevenue=false", () => {
    expect(getRevenueSortModeLabel("io", false)).toBe("I&O Gross");
  });

  it("returns 'I&O Net' for mode=io and showNetRevenue=true", () => {
    expect(getRevenueSortModeLabel("io", true)).toBe("I&O Net");
  });

  it("returns 'Filtre Gross' for mode=filtered and showNetRevenue=false", () => {
    expect(getRevenueSortModeLabel("filtered", false)).toBe("Filtre Gross");
  });

  it("returns 'Total Gross' for an unknown mode (default branch)", () => {
    expect(getRevenueSortModeLabel("unknown", false)).toBe("Total Gross");
  });
});
