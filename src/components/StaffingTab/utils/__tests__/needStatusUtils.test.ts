import { describe, it, expect } from "vitest";
import {
  computeNeedStatus,
  computeAllNeedStatuses,
  computeNeedsSummary,
  getAssignmentsForNeed,
} from "../needStatusUtils";
import type { StaffingNeedItem, StaffingAssignment } from "../../../../types";

const makeNeed = (overrides: Partial<StaffingNeedItem> = {}): StaffingNeedItem => ({
  id: "n1",
  grade: "Consultant",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  utilization: 100,
  quantity: 2,
  ...overrides,
});

const makeAssignment = (overrides: Partial<StaffingAssignment> = {}): StaffingAssignment => ({
  id: "a1",
  needId: "n1",
  empId: "E001",
  empName: "John Doe",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  utilization: 100,
  status: "confirmed",
  source: "manual",
  scenarioId: null,
  createdAt: "2026-03-30T00:00:00Z",
  ...overrides,
});

describe("computeNeedStatus", () => {
  it("returns open when no assignments", () => {
    expect(computeNeedStatus(makeNeed(), [])).toBe("open");
  });

  it("returns partiallyFilled when some slots filled", () => {
    const need = makeNeed({ quantity: 3 });
    const assignments = [makeAssignment()];
    expect(computeNeedStatus(need, assignments)).toBe("partiallyFilled");
  });

  it("returns filled when all slots filled", () => {
    const need = makeNeed({ quantity: 2 });
    const assignments = [makeAssignment({ id: "a1" }), makeAssignment({ id: "a2", empId: "E002" })];
    expect(computeNeedStatus(need, assignments)).toBe("filled");
  });

  it("returns cancelled when need is explicitly cancelled", () => {
    const need = makeNeed({ status: "cancelled" });
    const assignments = [makeAssignment()];
    expect(computeNeedStatus(need, assignments)).toBe("cancelled");
  });

  it("ignores cancelled assignments", () => {
    const need = makeNeed({ quantity: 1 });
    const assignments = [makeAssignment({ status: "cancelled" })];
    expect(computeNeedStatus(need, assignments)).toBe("open");
  });

  it("filters by scenarioId when provided", () => {
    const need = makeNeed({ quantity: 1 });
    const assignments = [makeAssignment({ scenarioId: "sc1" })];
    expect(computeNeedStatus(need, assignments, "sc1")).toBe("filled");
    expect(computeNeedStatus(need, assignments, "sc2")).toBe("open");
  });

  it("includes real assignments (scenarioId=null) regardless of scenarioId filter", () => {
    const need = makeNeed({ quantity: 1 });
    const assignments = [makeAssignment({ scenarioId: null })];
    expect(computeNeedStatus(need, assignments, "sc1")).toBe("filled");
  });

  it("defaults quantity to 1 when undefined", () => {
    const need = makeNeed({ quantity: undefined });
    const assignments = [makeAssignment()];
    expect(computeNeedStatus(need, assignments)).toBe("filled");
  });
});

describe("computeAllNeedStatuses", () => {
  it("returns statuses for all needs", () => {
    const needs = [
      makeNeed({ id: "n1", quantity: 1 }),
      makeNeed({ id: "n2", quantity: 2 }),
      makeNeed({ id: "n3", status: "cancelled" }),
    ];
    const assignments = [makeAssignment({ needId: "n1" }), makeAssignment({ id: "a2", needId: "n2" })];
    const statuses = computeAllNeedStatuses(needs, assignments);
    expect(statuses.get("n1")).toBe("filled");
    expect(statuses.get("n2")).toBe("partiallyFilled");
    expect(statuses.get("n3")).toBe("cancelled");
  });

  it("returns empty map for empty needs", () => {
    const statuses = computeAllNeedStatuses([], []);
    expect(statuses.size).toBe(0);
  });
});

describe("getAssignmentsForNeed", () => {
  it("returns assignments for a specific need", () => {
    const assignments = [
      makeAssignment({ id: "a1", needId: "n1" }),
      makeAssignment({ id: "a2", needId: "n2" }),
      makeAssignment({ id: "a3", needId: "n1", status: "cancelled" }),
    ];
    const result = getAssignmentsForNeed("n1", assignments);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("filters by scenarioId", () => {
    const assignments = [
      makeAssignment({ id: "a1", needId: "n1", scenarioId: null }),
      makeAssignment({ id: "a2", needId: "n1", scenarioId: "sc1" }),
    ];
    const result = getAssignmentsForNeed("n1", assignments, "sc1");
    expect(result).toHaveLength(2); // both: real (null) + matching scenario
  });
});

describe("computeNeedsSummary", () => {
  it("computes correct summary", () => {
    const needs = [
      makeNeed({ id: "n1", quantity: 2 }),
      makeNeed({ id: "n2", quantity: 1 }),
      makeNeed({ id: "n3", quantity: 1, status: "cancelled" }),
    ];
    const assignments = [
      makeAssignment({ needId: "n1" }),
      makeAssignment({ id: "a2", needId: "n1", empId: "E002" }),
      makeAssignment({ id: "a3", needId: "n2" }),
    ];
    const summary = computeNeedsSummary(needs, assignments);
    expect(summary.total).toBe(3);
    expect(summary.filled).toBe(2);
    expect(summary.open).toBe(0);
    expect(summary.cancelled).toBe(1);
    expect(summary.totalSlots).toBe(4);
    expect(summary.filledSlots).toBe(3);
  });

  it("handles empty inputs", () => {
    const summary = computeNeedsSummary([], []);
    expect(summary.total).toBe(0);
    expect(summary.totalSlots).toBe(0);
    expect(summary.filledSlots).toBe(0);
  });
});
