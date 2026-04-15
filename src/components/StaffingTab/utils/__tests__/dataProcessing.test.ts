import { describe, it, expect } from "vitest";
import { stripCivility, buildEmployeeStructures } from "../dataProcessing";

// ─── stripCivility ──────────────────────────────────────────────────────────

describe("stripCivility", () => {
  it("removes 'M ' prefix", () => {
    expect(stripCivility("M Jean Dupont")).toBe("Jean Dupont");
  });

  it("removes 'M. ' prefix", () => {
    expect(stripCivility("M. Jean Dupont")).toBe("Jean Dupont");
  });

  it("removes 'Mme ' prefix", () => {
    expect(stripCivility("Mme Marie Curie")).toBe("Marie Curie");
  });

  it("removes 'Mme. ' prefix", () => {
    expect(stripCivility("Mme. Marie Curie")).toBe("Marie Curie");
  });

  it("is case-insensitive", () => {
    expect(stripCivility("mme Alice")).toBe("Alice");
  });

  it("does not strip from middle of name", () => {
    expect(stripCivility("Jean-M Dupont")).toBe("Jean-M Dupont");
  });

  it("handles name without civility", () => {
    expect(stripCivility("Jean Dupont")).toBe("Jean Dupont");
  });

  it("trims extra whitespace", () => {
    expect(stripCivility("M.  Jean Dupont ")).toBe("Jean Dupont");
  });
});

// ─── buildEmployeeStructures ────────────────────────────────────────────────

describe("buildEmployeeStructures", () => {
  const makeRecord = (overrides = {}) => ({
    empId: "E001",
    firstName: "Jean",
    lastName: "Dupont",
    jobName: "Project Alpha",
    jobNo: "J100",
    startDate: "2025-01-06",
    endDate: "2025-01-10",
    utilization: 100,
    status: "active",
    category: "chargeable",
    ...overrides,
  });

  it("creates employee from single record", () => {
    const result = buildEmployeeStructures([makeRecord()]);
    expect(result).toHaveLength(1);
    expect(result[0].empId).toBe("E001");
    expect(result[0].name).toBe("Jean Dupont");
    expect(result[0].assignments).toHaveLength(1);
  });

  it("strips civility from name", () => {
    const result = buildEmployeeStructures([makeRecord({ firstName: "M.", lastName: " Pierre Martin" })]);
    expect(result[0].name).not.toContain("M.");
  });

  it("groups multiple assignments under same employee", () => {
    const records = [
      makeRecord({ jobName: "Project A", jobNo: "J100" }),
      makeRecord({ jobName: "Project B", jobNo: "J200", startDate: "2025-02-01", endDate: "2025-02-28" }),
    ];
    const result = buildEmployeeStructures(records);
    expect(result).toHaveLength(1);
    expect(result[0].assignments).toHaveLength(2);
    expect(result[0].projectCount).toBe(2);
  });

  it("creates separate employees for different empIds", () => {
    const records = [
      makeRecord({ empId: "E001" }),
      makeRecord({ empId: "E002", firstName: "Marie", lastName: "Curie" }),
    ];
    const result = buildEmployeeStructures(records);
    expect(result).toHaveLength(2);
  });

  it("sorts assignments by startDate ascending", () => {
    const records = [
      makeRecord({ jobName: "Late", startDate: "2025-06-01", endDate: "2025-06-30" }),
      makeRecord({ jobName: "Early", startDate: "2025-01-01", endDate: "2025-01-31" }),
    ];
    const result = buildEmployeeStructures(records);
    expect(result[0].assignments[0].jobName).toBe("Early");
    expect(result[0].assignments[1].jobName).toBe("Late");
  });

  it("returns empty array for empty input", () => {
    expect(buildEmployeeStructures([])).toHaveLength(0);
  });

  it("pre-computes _consolidated and _periods", () => {
    const result = buildEmployeeStructures([makeRecord()]);
    expect(result[0]._consolidated).toBeDefined();
    expect(result[0]._periods).toBeDefined();
  });
});
