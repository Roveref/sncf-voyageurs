import { applyAllFilters, getUniqueValues, getUniqueValuesFromMultipleFields } from "../filterUtils";
import { initializeFilters } from "../filterHelpers";

// Helpers to build test data
const makeOpp = (overrides = {}) => ({
  opportunityId: "OPP-001",
  account: "Acme Corp",
  subSegmentCode: "AMD",
  subSegment: "Financial Services",
  status: 3,
  manager: "Alice",
  partner: "Bob",
  em: "",
  ep: "",
  techPartner1: "AWS",
  techPartner2: "",
  techPartner3: "",
  serviceLine1: "Consulting",
  serviceLine2: "",
  serviceLine3: "",
  serviceOffering1: "Strategy",
  serviceOffering2: "",
  serviceOffering3: "",
  serviceOffering1Pct: "100",
  serviceOffering2Pct: "",
  serviceOffering3Pct: "",
  grossRevenue: 100000,
  netRevenue: 80000,
  ...overrides,
});

const data = [
  makeOpp({ opportunityId: "1", account: "Acme", status: 3, subSegmentCode: "AMD" }),
  makeOpp({ opportunityId: "2", account: "Beta", status: 5, subSegmentCode: "TIS" }),
  makeOpp({ opportunityId: "3", account: "Acme", status: 14, subSegmentCode: "AMD" }),
  makeOpp({ opportunityId: "4", account: "Gamma", status: 3, subSegmentCode: "CED" }),
];

describe("applyAllFilters", () => {
  it("returns all data when no filters are active", () => {
    const filters = initializeFilters();
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(4);
  });

  it("returns empty array for null/empty data", () => {
    expect(applyAllFilters(null as any, initializeFilters(), "inclusive", {})).toEqual([]);
    expect(applyAllFilters([], initializeFilters(), "inclusive", {})).toEqual([]);
  });

  it("filters by account inclusion", () => {
    const filters = initializeFilters();
    filters.accounts = { included: ["Acme"], excluded: [] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.account === "Acme")).toBe(true);
  });

  it("filters by account exclusion", () => {
    const filters = initializeFilters();
    filters.accounts = { included: [], excluded: ["Acme"] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.account !== "Acme")).toBe(true);
  });

  it("filters by status inclusion", () => {
    const filters = initializeFilters();
    filters.status = { included: ["3"], excluded: [] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(2);
    expect(result.every((r) => Number(r.status) === 3)).toBe(true);
  });

  it("filters by segment code inclusion", () => {
    const filters = initializeFilters();
    filters.subSegmentCodes = { included: ["AMD"], excluded: [] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.subSegmentCode === "AMD")).toBe(true);
  });

  it("combines multiple filters (AND logic)", () => {
    const filters = initializeFilters();
    filters.accounts = { included: ["Acme"], excluded: [] };
    filters.status = { included: ["3"], excluded: [] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(1);
    expect(result[0].opportunityId).toBe("1");
  });

  it("filters by people inclusion (checks Manager, Partner, EM, EP)", () => {
    const filters = initializeFilters();
    filters.people = { included: ["Alice"], excluded: [] };
    const result = applyAllFilters(data, filters, "inclusive", {});
    expect(result).toHaveLength(4); // all have Manager=Alice
  });

  it("filters by service line inclusion with allocation", () => {
    const slData = [
      makeOpp({ opportunityId: "1", serviceLine1: "Consulting", serviceOffering1Pct: "60" }),
      makeOpp({ opportunityId: "2", serviceLine1: "Technology", serviceOffering1Pct: "100" }),
    ];
    const filters = initializeFilters();
    filters.serviceLine1 = { included: ["Consulting"], excluded: [] };
    const result = applyAllFilters(slData, filters, "inclusive", {});
    expect(result).toHaveLength(1);
    expect(result[0].allocationPercentage).toBe(60);
    expect(result[0].allocatedGrossRevenue).toBe(60000);
  });
});

describe("getUniqueValues", () => {
  it("extracts unique sorted values for a field", () => {
    const result = getUniqueValues(data, "account");
    expect(result).toEqual(["Acme", "Beta", "Gamma"]);
  });

  it("skips null/undefined/empty values", () => {
    const testData = [{ x: "a" }, { x: null }, { x: "" }, { x: "b" }, { x: undefined }];
    expect(getUniqueValues(testData, "x")).toEqual(["a", "b"]);
  });

  it("returns empty array for empty data", () => {
    expect(getUniqueValues([], "account")).toEqual([]);
    expect(getUniqueValues(null as any, "account")).toEqual([]);
  });
});

describe("getUniqueValuesFromMultipleFields", () => {
  it("extracts unique values across multiple fields", () => {
    const testData = [
      { serviceLine1: "A", serviceLine2: "B" },
      { serviceLine1: "A", serviceLine2: "C" },
    ];
    const result = getUniqueValuesFromMultipleFields(testData, ["serviceLine1", "serviceLine2"]);
    expect(result).toEqual(["A", "B", "C"]);
  });
});
