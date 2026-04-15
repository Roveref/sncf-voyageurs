import { describe, it, expect } from "vitest";
import {
  getCategoryLabel,
  getCategoryBadgeColor,
  getCategoryBarColor,
  isChargeableCategory,
  categorizeSapRecord,
} from "./categoryUtils";
import { JOB_CATEGORIES } from "../constants";

describe("getCategoryLabel", () => {
  it("returns correct label for known categories", () => {
    expect(getCategoryLabel(JOB_CATEGORIES.CHARGEABLE)).toBe("Chargeable");
    expect(getCategoryLabel(JOB_CATEGORIES.VACATION)).toBe("Vacation");
    expect(getCategoryLabel(JOB_CATEGORIES.TRAINING)).toBe("Training");
    expect(getCategoryLabel(JOB_CATEGORIES.RTT)).toBe("RTT");
    expect(getCategoryLabel(JOB_CATEGORIES.LOA)).toBe("LOA (Leave of Absence)");
    expect(getCategoryLabel(JOB_CATEGORIES.ILLNESS)).toBe("Sick Leave");
    expect(getCategoryLabel(JOB_CATEGORIES.MEETING)).toBe("Team Meeting");
    expect(getCategoryLabel(JOB_CATEGORIES.RESERVATION)).toBe("Reservation w/o jobcode");
  });

  it("returns 'Unknown' label for unrecognized categories", () => {
    expect(getCategoryLabel("nonexistent_category")).toBe("Unknown");
  });

  it("returns 'Unknown' label for the UNKNOWN category itself", () => {
    expect(getCategoryLabel(JOB_CATEGORIES.UNKNOWN)).toBe("Unknown");
  });
});

describe("getCategoryBadgeColor", () => {
  it("returns a non-empty string for known categories", () => {
    const color = getCategoryBadgeColor(JOB_CATEGORIES.CHARGEABLE);
    expect(typeof color).toBe("string");
    expect(color.length).toBeGreaterThan(0);
  });

  it("returns a fallback color for unknown categories", () => {
    const color = getCategoryBadgeColor("nonexistent_category");
    expect(typeof color).toBe("string");
    expect(color.length).toBeGreaterThan(0);
  });

  it("returns consistent results for the same category", () => {
    const a = getCategoryBadgeColor(JOB_CATEGORIES.VACATION);
    const b = getCategoryBadgeColor(JOB_CATEGORIES.VACATION);
    expect(a).toBe(b);
  });
});

describe("getCategoryBarColor", () => {
  it("returns utilization-dependent blue for CHARGEABLE", () => {
    expect(getCategoryBarColor(JOB_CATEGORIES.CHARGEABLE, 100)).toBe("#2563eb");
    expect(getCategoryBarColor(JOB_CATEGORIES.CHARGEABLE, 80)).toBe("#3b82f6");
    expect(getCategoryBarColor(JOB_CATEGORIES.CHARGEABLE, 50)).toBe("#60a5fa");
    expect(getCategoryBarColor(JOB_CATEGORIES.CHARGEABLE, 25)).toBe("#93c5fd");
  });

  it("returns utilization-dependent cyan for GENERAL_OPPTY", () => {
    expect(getCategoryBarColor(JOB_CATEGORIES.GENERAL_OPPTY, 100)).toBe("#0891b2");
    expect(getCategoryBarColor(JOB_CATEGORIES.GENERAL_OPPTY, 75)).toBe("#06b6d4");
    expect(getCategoryBarColor(JOB_CATEGORIES.GENERAL_OPPTY, 50)).toBe("#22d3ee");
    expect(getCategoryBarColor(JOB_CATEGORIES.GENERAL_OPPTY, 10)).toBe("#67e8f9");
  });

  it("returns a valid color string for other categories", () => {
    const color = getCategoryBarColor(JOB_CATEGORIES.TRAINING);
    expect(typeof color).toBe("string");
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("returns fallback gray for unrecognized categories", () => {
    expect(getCategoryBarColor("nonexistent_category")).toBe("#9ca3af");
  });

  it("defaults utilization to 0 when not provided", () => {
    // CHARGEABLE with default (0) utilization should return the lowest bracket
    expect(getCategoryBarColor(JOB_CATEGORIES.CHARGEABLE)).toBe("#93c5fd");
  });
});

describe("isChargeableCategory", () => {
  it("returns true for CHARGEABLE", () => {
    expect(isChargeableCategory(JOB_CATEGORIES.CHARGEABLE)).toBe(true);
  });

  it("returns true for GENERAL_OPPTY", () => {
    expect(isChargeableCategory(JOB_CATEGORIES.GENERAL_OPPTY)).toBe(true);
  });

  it("returns false for non-chargeable categories", () => {
    expect(isChargeableCategory(JOB_CATEGORIES.VACATION)).toBe(false);
    expect(isChargeableCategory(JOB_CATEGORIES.TRAINING)).toBe(false);
    expect(isChargeableCategory(JOB_CATEGORIES.RESERVATION)).toBe(false);
    expect(isChargeableCategory(JOB_CATEGORIES.MEETING)).toBe(false);
    expect(isChargeableCategory(JOB_CATEGORIES.PENDING)).toBe(false);
    expect(isChargeableCategory(JOB_CATEGORIES.UNKNOWN)).toBe(false);
  });

  it("returns false for arbitrary strings", () => {
    expect(isChargeableCategory("whatever")).toBe(false);
  });
});

describe("categorizeSapRecord", () => {
  it("categorizes vacation codes", () => {
    expect(categorizeSapRecord({ absenceType: "0010" })).toBe(JOB_CATEGORIES.VACATION);
    expect(categorizeSapRecord({ absenceType: "0013" })).toBe(JOB_CATEGORIES.VACATION);
    expect(categorizeSapRecord({ absenceType: "0015" })).toBe(JOB_CATEGORIES.VACATION);
  });

  it("categorizes RTT codes", () => {
    expect(categorizeSapRecord({ absenceType: "F035" })).toBe(JOB_CATEGORIES.RTT);
    expect(categorizeSapRecord({ absenceType: "F036" })).toBe(JOB_CATEGORIES.RTT);
  });

  it("categorizes LOA codes", () => {
    expect(categorizeSapRecord({ absenceType: "F600" })).toBe(JOB_CATEGORIES.LOA);
    expect(categorizeSapRecord({ absenceType: "F605" })).toBe(JOB_CATEGORIES.LOA);
    expect(categorizeSapRecord({ absenceType: "F613" })).toBe(JOB_CATEGORIES.LOA);
    expect(categorizeSapRecord({ absenceType: "F631" })).toBe(JOB_CATEGORIES.LOA);
    expect(categorizeSapRecord({ absenceType: "F016" })).toBe(JOB_CATEGORIES.LOA);
  });

  it("categorizes illness codes", () => {
    expect(categorizeSapRecord({ absenceType: "0200" })).toBe(JOB_CATEGORIES.ILLNESS);
    expect(categorizeSapRecord({ absenceType: "F056" })).toBe(JOB_CATEGORIES.ILLNESS);
    expect(categorizeSapRecord({ absenceType: "F210" })).toBe(JOB_CATEGORIES.ILLNESS);
  });

  it("categorizes other absence codes", () => {
    expect(categorizeSapRecord({ absenceType: "0024" })).toBe(JOB_CATEGORIES.OTHER_ABSENCE);
    expect(categorizeSapRecord({ absenceType: "F010" })).toBe(JOB_CATEGORIES.OTHER_ABSENCE);
    expect(categorizeSapRecord({ absenceType: "F014" })).toBe(JOB_CATEGORIES.OTHER_ABSENCE);
    expect(categorizeSapRecord({ absenceType: "F045" })).toBe(JOB_CATEGORIES.OTHER_ABSENCE);
  });

  it("categorizes training code 0049", () => {
    expect(categorizeSapRecord({ absenceType: "0049" })).toBe(JOB_CATEGORIES.TRAINING);
  });

  it("categorizes overtime code F810", () => {
    expect(categorizeSapRecord({ absenceType: "F810" })).toBe(JOB_CATEGORIES.OVERTIME);
  });

  it("categorizes travel code F816", () => {
    expect(categorizeSapRecord({ absenceType: "F816" })).toBe(JOB_CATEGORIES.TRAVEL);
  });

  it("categorizes weekend travel code F817", () => {
    expect(categorizeSapRecord({ absenceType: "F817" })).toBe(JOB_CATEGORIES.TRAVEL_WE);
  });

  it("categorizes non-chargeable codes", () => {
    expect(categorizeSapRecord({ absenceType: "0061" })).toBe(JOB_CATEGORIES.MEETING);
    expect(categorizeSapRecord({ absenceType: "0062" })).toBe(JOB_CATEGORIES.EVENT);
    expect(categorizeSapRecord({ absenceType: "0092" })).toBe(JOB_CATEGORIES.EVENT);
    expect(categorizeSapRecord({ absenceType: "0093" })).toBe(JOB_CATEGORIES.EVENT);
    expect(categorizeSapRecord({ absenceType: "0077" })).toBe(JOB_CATEGORIES.ADMIN);
    expect(categorizeSapRecord({ absenceType: "0080" })).toBe(JOB_CATEGORIES.CORPORATE);
    expect(categorizeSapRecord({ absenceType: "0081" })).toBe(JOB_CATEGORIES.COMMUNITY);
    expect(categorizeSapRecord({ absenceType: "0083" })).toBe(JOB_CATEGORIES.BUSINESS_DEV);
  });

  it("routes 0800 without salesOrder to chargeable", () => {
    expect(categorizeSapRecord({ absenceType: "0800" })).toBe(JOB_CATEGORIES.CHARGEABLE);
  });

  it("routes 0800 with 7-digit salesOrder to chargeable", () => {
    expect(categorizeSapRecord({ absenceType: "0800", salesOrder: "1234567" })).toBe("chargeable");
  });

  it("routes 0800 with 6-digit salesOrder to generalOppty", () => {
    expect(categorizeSapRecord({ absenceType: "0800", salesOrder: "123456" })).toBe("generalOppty");
  });

  it("returns null for empty absenceType", () => {
    expect(categorizeSapRecord({ absenceType: "" })).toBeNull();
  });

  it("returns unknown for unrecognized codes", () => {
    expect(categorizeSapRecord({ absenceType: "ZZZZ" })).toBe(JOB_CATEGORIES.UNKNOWN);
  });

  it("handles numeric absenceType input", () => {
    // Numeric 10 becomes string "10", which maps to "vacation" (MDS short code)
    expect(categorizeSapRecord({ absenceType: 10 as any })).toBe(JOB_CATEGORIES.VACATION);
  });
});
