import { describe, it, expect } from "vitest";
import { extractProjects, getProjectStats, searchProjects } from "../projectUtils";

// ─── Helper: minimal Employee-like object ──────────────────────────────────

const makeEmployee = (overrides: Record<string, any> = {}): any => ({
  empId: "E001",
  name: "Alice",
  grade: "Consultant",
  subTeam: "Team A",
  assignments: [],
  trueUtilizationRate: 80,
  availableCapacityHours: 40,
  projectCount: 0,
  chargeableHours: 0,
  ...overrides,
});

const makeAssignment = (overrides: Record<string, any> = {}): any => ({
  jobNo: "J001",
  jobName: "Alpha Project",
  category: "chargeable",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  utilization: 80,
  hoursPerDay: 6.4,
  totalHours: 400,
  status: "C",
  ...overrides,
});

// ─── extractProjects ───────────────────────────────────────────────────────

describe("extractProjects", () => {
  it("returns empty array for employees with no assignments", () => {
    const result = extractProjects([makeEmployee()]);
    expect(result).toHaveLength(0);
  });

  it("groups assignments by jobNo into projects", () => {
    const emp1 = makeEmployee({
      empId: "E001",
      assignments: [makeAssignment({ jobNo: "J001" }), makeAssignment({ jobNo: "J002", jobName: "Beta" })],
    });
    const result = extractProjects([emp1]);
    expect(result).toHaveLength(2);
  });

  it("aggregates employees across multiple records for same project", () => {
    const emp1 = makeEmployee({
      empId: "E001",
      assignments: [makeAssignment({ jobNo: "J001" })],
    });
    const emp2 = makeEmployee({
      empId: "E002",
      name: "Bob",
      assignments: [makeAssignment({ jobNo: "J001" })],
    });
    const result = extractProjects([emp1, emp2]);
    expect(result).toHaveLength(1);
    expect(result[0].employeeCount).toBe(2);
    expect(result[0].totalHours).toBe(800); // 400 + 400
  });

  it("merges multiple periods for the same employee on the same project", () => {
    const emp = makeEmployee({
      assignments: [
        makeAssignment({ jobNo: "J001", startDate: "2026-01-01", endDate: "2026-03-31" }),
        makeAssignment({ jobNo: "J001", startDate: "2026-04-01", endDate: "2026-06-30" }),
      ],
    });
    const result = extractProjects([emp]);
    expect(result).toHaveLength(1);
    const proj = result[0];
    expect(proj.employees).toHaveLength(1);
    expect(proj.employees[0].periods).toHaveLength(2);
  });

  it("sorts chargeable projects before non-chargeable", () => {
    const emp = makeEmployee({
      assignments: [
        makeAssignment({ jobNo: "J001", category: "vacation" }),
        makeAssignment({ jobNo: "J002", category: "chargeable" }),
      ],
    });
    const result = extractProjects([emp]);
    expect(result[0].category).toBe("chargeable");
    expect(result[1].category).toBe("vacation");
  });

  it("tracks date ranges (earliestStart, latestEnd)", () => {
    const emp = makeEmployee({
      assignments: [
        makeAssignment({ jobNo: "J001", startDate: "2026-03-01", endDate: "2026-05-31" }),
        makeAssignment({ jobNo: "J001", startDate: "2026-01-01", endDate: "2026-09-30" }),
      ],
    });
    const result = extractProjects([emp]);
    // Second assignment has earlier start and later end
    expect(result[0].earliestStart).toBe("2026-01-01");
    expect(result[0].latestEnd).toBe("2026-09-30");
  });

  it("sets hasProvisional when any assignment has status 'P'", () => {
    const emp = makeEmployee({
      assignments: [makeAssignment({ jobNo: "J001", status: "C" }), makeAssignment({ jobNo: "J001", status: "P" })],
    });
    const result = extractProjects([emp]);
    expect(result[0].hasProvisional).toBe(true);
  });
});

// ─── getProjectStats ───────────────────────────────────────────────────────

describe("getProjectStats", () => {
  it("returns zeros for empty project list", () => {
    const stats = getProjectStats([]);
    expect(stats.totalProjects).toBe(0);
    expect(stats.chargeableProjects).toBe(0);
    expect(stats.totalEmployeesAssigned).toBe(0);
    expect(stats.totalHours).toBe(0);
    expect(stats.avgEmployeesPerProject).toBe(0);
  });

  it("counts chargeable vs total projects", () => {
    const projects = [
      { category: "chargeable", employees: [{ empId: "E1" }], totalHours: 100, employeeCount: 1 },
      { category: "vacation", employees: [{ empId: "E2" }], totalHours: 50, employeeCount: 1 },
      { category: "chargeable", employees: [{ empId: "E3" }], totalHours: 200, employeeCount: 1 },
    ];
    const stats = getProjectStats(projects);
    expect(stats.totalProjects).toBe(3);
    expect(stats.chargeableProjects).toBe(2);
    expect(stats.totalHours).toBe(350);
  });

  it("deduplicates employees across projects", () => {
    const projects = [
      { category: "chargeable", employees: [{ empId: "E1" }, { empId: "E2" }], totalHours: 100, employeeCount: 2 },
      { category: "chargeable", employees: [{ empId: "E2" }, { empId: "E3" }], totalHours: 100, employeeCount: 2 },
    ];
    const stats = getProjectStats(projects);
    expect(stats.totalEmployeesAssigned).toBe(3); // E1, E2, E3
    expect(stats.avgEmployeesPerProject).toBe(2); // (2+2)/2
  });
});

// ─── searchProjects ────────────────────────────────────────────────────────

describe("searchProjects", () => {
  const projects = [
    { jobName: "Alpha Digital", jobNo: "J001", category: "chargeable" },
    { jobName: "Beta Analytics", jobNo: "J002", category: "chargeable" },
    { jobName: "Gamma Consulting", jobNo: "J003", category: "training" },
  ];

  it("returns all projects for empty query", () => {
    expect(searchProjects(projects, "")).toEqual(projects);
    expect(searchProjects(projects, "  ")).toEqual(projects);
  });

  it("filters by job name (case-insensitive)", () => {
    const result = searchProjects(projects, "alpha");
    expect(result).toHaveLength(1);
    expect(result[0].jobName).toBe("Alpha Digital");
  });

  it("filters by job number", () => {
    const result = searchProjects(projects, "J002");
    expect(result).toHaveLength(1);
    expect(result[0].jobNo).toBe("J002");
  });

  it("returns empty array when nothing matches", () => {
    expect(searchProjects(projects, "nonexistent")).toHaveLength(0);
  });

  it("handles partial matches", () => {
    const result = searchProjects(projects, "consult");
    expect(result).toHaveLength(1);
    expect(result[0].jobName).toBe("Gamma Consulting");
  });
});
