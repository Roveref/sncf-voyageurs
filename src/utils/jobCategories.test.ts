import { describe, it, expect, afterEach } from "vitest";
import { categorizeJob, SPECIAL_JOB_CODES, updateJobCategoriesFromConfig } from "./jobCategories";

describe("categorizeJob", () => {
  // --- Special codes ---
  it("returns 'reservation' for code 9999999996", () => {
    expect(categorizeJob("9999999996")).toBe("reservation");
  });

  it("returns 'training' for code 9999999980", () => {
    expect(categorizeJob("9999999980")).toBe("training");
  });

  it("returns 'loa' for LOA codes", () => {
    expect(categorizeJob("9999999910")).toBe("loa");
    expect(categorizeJob("9999999911")).toBe("loa");
    expect(categorizeJob("F016")).toBe("loa");
    expect(categorizeJob("F600")).toBe("loa");
    expect(categorizeJob("F605")).toBe("loa");
    expect(categorizeJob("F613")).toBe("loa");
    expect(categorizeJob("F631")).toBe("loa");
  });

  it("returns 'vacation' for vacation codes", () => {
    expect(categorizeJob("0010")).toBe("vacation");
    expect(categorizeJob("0015")).toBe("vacation");
    expect(categorizeJob("9999999999")).toBe("vacation");
  });

  it("returns 'pending' for code 7777777777", () => {
    expect(categorizeJob("7777777777")).toBe("pending");
  });

  it("returns 'rtt' for RTT codes", () => {
    expect(categorizeJob("F035")).toBe("rtt");
    expect(categorizeJob("F036")).toBe("rtt");
  });

  it("returns 'illness' for illness codes", () => {
    expect(categorizeJob("F056")).toBe("illness");
    expect(categorizeJob("F210")).toBe("illness");
  });

  it("returns 'otherAbsence' for other absence codes", () => {
    expect(categorizeJob("F010")).toBe("otherAbsence");
    expect(categorizeJob("F014")).toBe("otherAbsence");
    expect(categorizeJob("F015")).toBe("otherAbsence");
    expect(categorizeJob("F030")).toBe("otherAbsence");
    expect(categorizeJob("F032")).toBe("otherAbsence");
    expect(categorizeJob("F033")).toBe("otherAbsence");
    expect(categorizeJob("F045")).toBe("otherAbsence");
  });

  it("returns 'overtime' for code F810", () => {
    expect(categorizeJob("F810")).toBe("overtime");
  });

  it("returns 'travel' for code F816", () => {
    expect(categorizeJob("F816")).toBe("travel");
  });

  it("returns 'travelWe' for code F817", () => {
    expect(categorizeJob("F817")).toBe("travelWe");
  });

  // --- Digit-length rules ---
  it("returns 'generalOppty' for 6-digit numeric codes", () => {
    expect(categorizeJob("123456")).toBe("generalOppty");
    expect(categorizeJob("000001")).toBe("generalOppty");
    expect(categorizeJob("999999")).toBe("generalOppty");
  });

  it("returns 'chargeable' for 7-digit numeric codes", () => {
    expect(categorizeJob("1234567")).toBe("chargeable");
    expect(categorizeJob("0000001")).toBe("chargeable");
    expect(categorizeJob("9999999")).toBe("chargeable");
  });

  // --- Edge cases ---
  it("returns 'unknown' for empty string", () => {
    expect(categorizeJob("")).toBe("unknown");
  });

  it("returns 'unknown' for whitespace-only string", () => {
    expect(categorizeJob("   ")).toBe("unknown");
  });

  it("returns 'unknown' for null/undefined (cast as any)", () => {
    expect(categorizeJob(null as any)).toBe("unknown");
    expect(categorizeJob(undefined as any)).toBe("unknown");
  });

  it("returns 'unknown' for 5-digit numeric codes", () => {
    expect(categorizeJob("12345")).toBe("unknown");
  });

  it("returns 'unknown' for 8-digit numeric codes", () => {
    expect(categorizeJob("12345678")).toBe("unknown");
  });

  it("returns 'unknown' for non-numeric strings of length 6", () => {
    expect(categorizeJob("abcdef")).toBe("unknown");
  });

  it("accepts numeric input and converts to string", () => {
    expect(categorizeJob(1234567)).toBe("chargeable");
    expect(categorizeJob(123456)).toBe("generalOppty");
  });

  it("trims whitespace before categorization", () => {
    expect(categorizeJob(" 1234567 ")).toBe("chargeable");
    expect(categorizeJob(" F035 ")).toBe("rtt");
  });
});

describe("updateJobCategoriesFromConfig", () => {
  it("fully replaces all mappings", () => {
    // Save current state
    const saved = { ...SPECIAL_JOB_CODES };
    // Replace with minimal set
    updateJobCategoriesFromConfig({ TESTCODE: "training", F035: "vacation" });
    expect(categorizeJob("TESTCODE")).toBe("training");
    expect(categorizeJob("F035")).toBe("vacation");
    // Old codes should be gone (full replacement)
    expect(SPECIAL_JOB_CODES["9999999996"]).toBeUndefined();
    // Restore
    updateJobCategoriesFromConfig(saved);
  });
});
