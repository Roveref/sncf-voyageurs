import { describe, it, expect } from "vitest";
import { getRealEmpId, getUniqueRealIds, countUniqueReal } from "../empIdUtils";

// ─── getRealEmpId ─────────────────────────────────────────────────────────────

describe("getRealEmpId", () => {
  it("returns _realEmpId when present", () => {
    expect(getRealEmpId({ empId: "E001::g0", _realEmpId: "E001" })).toBe("E001");
  });

  it("returns empId when _realEmpId is absent", () => {
    expect(getRealEmpId({ empId: "E002" })).toBe("E002");
  });

  it("returns empId when _realEmpId is undefined", () => {
    expect(getRealEmpId({ empId: "E003", _realEmpId: undefined })).toBe("E003");
  });

  it("returns empId when _realEmpId is empty string", () => {
    expect(getRealEmpId({ empId: "E004", _realEmpId: "" })).toBe("E004");
  });
});

// ─── getUniqueRealIds ─────────────────────────────────────────────────────────

describe("getUniqueRealIds", () => {
  it("deduplicates grade splits with same _realEmpId", () => {
    const employees = [
      { empId: "E001::g0", _realEmpId: "E001" },
      { empId: "E001::g1", _realEmpId: "E001" },
    ];
    const result = getUniqueRealIds(employees);
    expect(result.size).toBe(1);
    expect(result.has("E001")).toBe(true);
  });

  it("counts mix of split and non-split employees correctly", () => {
    const employees = [
      { empId: "E001::g0", _realEmpId: "E001" },
      { empId: "E001::g1", _realEmpId: "E001" },
      { empId: "E002" },
      { empId: "E003" },
    ];
    const result = getUniqueRealIds(employees);
    expect(result.size).toBe(3);
    expect(result.has("E001")).toBe(true);
    expect(result.has("E002")).toBe(true);
    expect(result.has("E003")).toBe(true);
  });

  it("returns empty Set for empty array", () => {
    const result = getUniqueRealIds([]);
    expect(result.size).toBe(0);
  });

  it("handles all non-split employees", () => {
    const employees = [{ empId: "E001" }, { empId: "E002" }, { empId: "E003" }];
    const result = getUniqueRealIds(employees);
    expect(result.size).toBe(3);
  });
});

// ─── countUniqueReal ──────────────────────────────────────────────────────────

describe("countUniqueReal", () => {
  it("returns correct count for grade splits", () => {
    const employees = [
      { empId: "E001::g0", _realEmpId: "E001" },
      { empId: "E001::g1", _realEmpId: "E001" },
      { empId: "E002" },
    ];
    expect(countUniqueReal(employees)).toBe(2);
  });

  it("returns 0 for empty array", () => {
    expect(countUniqueReal([])).toBe(0);
  });
});
