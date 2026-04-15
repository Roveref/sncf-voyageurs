import {
  normalizeFilterValue,
  initializeFilters,
  getIncludedValues,
  getExcludedValues,
  toggleFilterValue,
  includeValue,
  excludeValue,
  removeValue,
  clearFilter,
  isIncluded,
  isExcluded,
  hasActiveFilters,
  FilterValue,
  Filters,
} from "../filterHelpers";

describe("normalizeFilterValue", () => {
  it("returns empty structure for null/undefined", () => {
    expect(normalizeFilterValue(null)).toEqual({ included: [], excluded: [] });
    expect(normalizeFilterValue(undefined)).toEqual({ included: [], excluded: [] });
  });

  it("passes through already-normalized objects", () => {
    const val = { included: ["a"], excluded: ["b"] };
    expect(normalizeFilterValue(val)).toEqual(val);
  });

  it("migrates arrays to included-only format", () => {
    expect(normalizeFilterValue(["x", "y"])).toEqual({ included: ["x", "y"], excluded: [] });
  });

  it("handles unexpected types gracefully", () => {
    expect(normalizeFilterValue(42)).toEqual({ included: [], excluded: [] });
    expect(normalizeFilterValue("string")).toEqual({ included: [], excluded: [] });
  });
});

describe("initializeFilters", () => {
  it("returns all filter keys with empty arrays", () => {
    const filters = initializeFilters();
    const keys = Object.keys(filters);
    expect(keys).toContain("accounts");
    expect(keys).toContain("status");
    expect(keys).toContain("serviceLine1");
    expect(keys).toContain("people");
    keys.forEach((key) => {
      expect(filters[key as keyof Filters]).toEqual({ included: [], excluded: [] });
    });
  });
});

describe("getIncludedValues / getExcludedValues", () => {
  it("extracts included values", () => {
    expect(getIncludedValues({ included: ["a", "b"], excluded: ["c"] })).toEqual(["a", "b"]);
  });

  it("extracts excluded values", () => {
    expect(getExcludedValues({ included: ["a"], excluded: ["b", "c"] })).toEqual(["b", "c"]);
  });

  it("handles array-format backward compat", () => {
    expect(getIncludedValues(["x"])).toEqual(["x"]);
    expect(getExcludedValues(["x"])).toEqual([]);
  });
});

describe("toggleFilterValue", () => {
  it("cycles: not selected → included → excluded → not selected", () => {
    let filter: FilterValue = { included: [], excluded: [] };

    // Not selected → included
    filter = toggleFilterValue(filter, "A");
    expect(filter.included).toContain("A");
    expect(filter.excluded).not.toContain("A");

    // Included → excluded
    filter = toggleFilterValue(filter, "A");
    expect(filter.included).not.toContain("A");
    expect(filter.excluded).toContain("A");

    // Excluded → not selected
    filter = toggleFilterValue(filter, "A");
    expect(filter.included).not.toContain("A");
    expect(filter.excluded).not.toContain("A");
  });
});

describe("includeValue / excludeValue / removeValue", () => {
  it("includeValue adds to included and removes from excluded", () => {
    const result = includeValue({ included: [], excluded: ["A"] }, "A");
    expect(result.included).toContain("A");
    expect(result.excluded).not.toContain("A");
  });

  it("excludeValue adds to excluded and removes from included", () => {
    const result = excludeValue({ included: ["A"], excluded: [] }, "A");
    expect(result.excluded).toContain("A");
    expect(result.included).not.toContain("A");
  });

  it("removeValue removes from both arrays", () => {
    const result = removeValue({ included: ["A"], excluded: ["B"] }, "A");
    expect(result.included).not.toContain("A");
    expect(result.excluded).toContain("B");
  });
});

describe("clearFilter", () => {
  it("returns empty structure", () => {
    expect(clearFilter({ included: ["a"], excluded: ["b"] })).toEqual({ included: [], excluded: [] });
  });
});

describe("isIncluded / isExcluded", () => {
  const filter = { included: ["a"], excluded: ["b"] };

  it("detects included values", () => {
    expect(isIncluded(filter, "a")).toBe(true);
    expect(isIncluded(filter, "b")).toBe(false);
  });

  it("detects excluded values", () => {
    expect(isExcluded(filter, "b")).toBe(true);
    expect(isExcluded(filter, "a")).toBe(false);
  });
});

describe("hasActiveFilters", () => {
  it("returns false when all filters are empty", () => {
    expect(hasActiveFilters(initializeFilters() as any)).toBe(false);
  });

  it("returns true when any filter has values", () => {
    const filters = initializeFilters();
    filters.accounts = { included: ["Acme"], excluded: [] };
    expect(hasActiveFilters(filters as any)).toBe(true);
  });
});
