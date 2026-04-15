import { describe, it, expect } from "vitest";
import { groupByCriterion, sortGroups, computeGroupStats } from "../../utils/groupingUtils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal employee for grouping tests. */
const makeEmp = (empId: string, grade: string, subTeam = "TeamA", overrides: Record<string, any> = {}) => ({
  empId,
  name: `Emp ${empId}`,
  grade,
  subTeam,
  directManager: null,
  assignments: [],
  availableCapacityHours: 0,
  _displayNetH: 100,
  _displayChH: 50,
  _displayTrH: 10,
  totalWorkingDaysInPeriod: 20,
  totalAbsenceHoursInPeriod: 0,
  totalChargeableHoursInPeriod: 50,
  totalChargeableOnlyHoursInPeriod: 50,
  totalNetHours: 100,
  ...overrides,
});

// ─── groupByCriterion ───────────────────────────────────────────────────────

describe("groupByCriterion", () => {
  it("returns empty groups for empty array", () => {
    const result = groupByCriterion([], "grade");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("groups by grade", () => {
    const employees = [makeEmp("E1", "Manager"), makeEmp("E2", "Manager"), makeEmp("E3", "Analyst")];
    const result = groupByCriterion(employees as any, "grade");
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["Manager"].employees).toHaveLength(2);
    expect(result["Analyst"].employees).toHaveLength(1);
  });

  it("groups by subTeam", () => {
    const employees = [
      makeEmp("E1", "Manager", "Digital"),
      makeEmp("E2", "Analyst", "Digital"),
      makeEmp("E3", "Manager", "Finance"),
    ];
    const result = groupByCriterion(employees as any, "subTeam");
    expect(result["Digital"].employees).toHaveLength(2);
    expect(result["Finance"].employees).toHaveLength(1);
  });

  it("groups by project using chargeable assignments", () => {
    const employees = [
      makeEmp("E1", "Manager", "A", {
        assignments: [{ category: "chargeable", jobName: "ProjectX" }],
      }),
      makeEmp("E2", "Analyst", "A", {
        assignments: [{ category: "chargeable", jobName: "ProjectX" }],
      }),
      makeEmp("E3", "Manager", "A", {
        assignments: [{ category: "vacation", jobName: "Holidays" }],
      }),
    ];
    const result = groupByCriterion(employees as any, "project");
    expect(result["ProjectX"].employees).toHaveLength(2);
    expect(result["No billable project"].employees).toHaveLength(1);
  });

  it("puts employee in multiple project groups if multiple chargeable assignments", () => {
    const employees = [
      makeEmp("E1", "Manager", "A", {
        assignments: [
          { category: "chargeable", jobName: "Proj1" },
          { category: "chargeable", jobName: "Proj2" },
        ],
      }),
    ];
    const result = groupByCriterion(employees as any, "project");
    expect(result["Proj1"].employees).toHaveLength(1);
    expect(result["Proj2"].employees).toHaveLength(1);
  });
});

// ─── sortGroups ─────────────────────────────────────────────────────────────

describe("sortGroups", () => {
  it("sorts grade groups by grade hierarchy", () => {
    const employees = [makeEmp("E1", "Analyst"), makeEmp("E2", "Manager"), makeEmp("E3", "Partner")];
    const groups = groupByCriterion(employees as any, "grade");
    const sorted = sortGroups(groups, "grade");
    // GRADE_ORDER: Partner > Manager > Analyst
    expect(sorted[0].name).toBe("Partner");
    expect(sorted[1].name).toBe("Manager");
    expect(sorted[2].name).toBe("Analyst");
  });

  it("sorts project groups by employee count descending", () => {
    const employees = [
      makeEmp("E1", "Manager", "A", {
        assignments: [{ category: "chargeable", jobName: "BigProj" }],
      }),
      makeEmp("E2", "Manager", "A", {
        assignments: [{ category: "chargeable", jobName: "BigProj" }],
      }),
      makeEmp("E3", "Analyst", "A", {
        assignments: [{ category: "chargeable", jobName: "SmallProj" }],
      }),
    ];
    const groups = groupByCriterion(employees as any, "project");
    const sorted = sortGroups(groups, "project");
    expect(sorted[0].name).toBe("BigProj");
    expect(sorted[1].name).toBe("SmallProj");
  });

  it("sorts subTeam groups alphabetically", () => {
    const employees = [makeEmp("E1", "Manager", "Zebra"), makeEmp("E2", "Manager", "Alpha")];
    const groups = groupByCriterion(employees as any, "subTeam");
    const sorted = sortGroups(groups, "subTeam");
    expect(sorted[0].name).toBe("Alpha");
    expect(sorted[1].name).toBe("Zebra");
  });
});

// ─── computeGroupStats ──────────────────────────────────────────────────────

describe("computeGroupStats", () => {
  it("computes weighted TU from employee display hours", () => {
    const group = {
      employees: [
        makeEmp("E1", "Manager", "A", { _displayNetH: 100, _displayChH: 80, _displayTrH: 0 }),
        makeEmp("E2", "Manager", "A", { _displayNetH: 100, _displayChH: 60, _displayTrH: 0 }),
      ],
    };
    computeGroupStats(group);
    // totalNet=200, totalCh=140, TU = 140/200*100 = 70
    expect((group as any).weightedTU).toBeCloseTo(70);
  });

  it("handles empty employees array", () => {
    const group = { employees: [] };
    computeGroupStats(group);
    // Should not throw, no properties set
    expect(group.employees).toHaveLength(0);
  });

  it("computes weighted TO including training", () => {
    const group = {
      employees: [makeEmp("E1", "Manager", "A", { _displayNetH: 100, _displayChH: 60, _displayTrH: 20 })],
    };
    computeGroupStats(group);
    // TO = (60 + 20) / 100 * 100 = 80
    expect((group as any).weightedTO).toBeCloseTo(80);
  });

  it("computes dispoH as net minus ch minus tr", () => {
    const group = {
      employees: [makeEmp("E1", "Manager", "A", { _displayNetH: 100, _displayChH: 60, _displayTrH: 10 })],
    };
    computeGroupStats(group);
    expect((group as any).totalDispoH).toBeCloseTo(30);
  });
});
