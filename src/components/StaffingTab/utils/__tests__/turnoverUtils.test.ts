import { describe, it, expect } from "vitest";
import {
  countArrivalDepartures,
  countGradeTransitionsByDate,
  countTurnoverInRange,
  countGradeTransitionsInRange,
} from "../turnoverUtils";
import type { Employee } from "../../types";

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeEmp = (overrides: Record<string, any>): Employee =>
  ({
    empId: "E001",
    grade: "Consultant",
    ...overrides,
  }) as Employee;

const makeSplitPair = (realId: string, overrides: Record<string, any> = {}) => [
  makeEmp({
    empId: `${realId}::g0`,
    _realEmpId: realId,
    _isGradeSplit: true,
    _gradeIndex: 0,
    _gradeSplitCount: 2,
    ...overrides,
  }),
  makeEmp({
    empId: `${realId}::g1`,
    _realEmpId: realId,
    _isGradeSplit: true,
    _gradeIndex: 1,
    _gradeSplitCount: 2,
    ...overrides,
  }),
];

// ─── countArrivalDepartures ─────────────────────────────────────────────────

describe("countArrivalDepartures", () => {
  it("returns null maps for empty array", () => {
    const result = countArrivalDepartures([]);
    expect(result.arrivalCounts).toBeNull();
    expect(result.departureCounts).toBeNull();
  });

  it("returns null maps for undefined input", () => {
    const result = countArrivalDepartures(undefined as any);
    expect(result.arrivalCounts).toBeNull();
    expect(result.departureCounts).toBeNull();
  });

  it("counts arrivals and departures for non-split employees", () => {
    const employees = [
      makeEmp({ empId: "E001", _arrivalDate: "2025-03-01", _departureDate: "2025-12-31" }),
      makeEmp({ empId: "E002", _arrivalDate: "2025-03-01" }),
      makeEmp({ empId: "E003", _arrivalDate: "2025-06-15", _departureDate: "2025-12-31" }),
    ];
    const result = countArrivalDepartures(employees);
    expect(result.arrivalCounts!.get("2025-03-01")).toBe(2);
    expect(result.arrivalCounts!.get("2025-06-15")).toBe(1);
    expect(result.departureCounts!.get("2025-12-31")).toBe(2);
  });

  it("returns null departureCounts when no departures exist", () => {
    const employees = [makeEmp({ empId: "E001", _arrivalDate: "2025-01-01" })];
    const result = countArrivalDepartures(employees);
    expect(result.arrivalCounts).not.toBeNull();
    expect(result.departureCounts).toBeNull();
  });

  it("only counts g0 for arrival and last split for departure", () => {
    const [g0, g1] = makeSplitPair("E001", {
      _arrivalDate: "2025-01-01",
      _departureDate: "2025-12-31",
    });
    const result = countArrivalDepartures([g0, g1]);
    // arrival counted on g0 (index 0)
    expect(result.arrivalCounts!.get("2025-01-01")).toBe(1);
    // departure counted on g1 (last split, index 1 === splitCount-1)
    expect(result.departureCounts!.get("2025-12-31")).toBe(1);
  });

  it("deduplicates by realEmpId across grade splits", () => {
    const [g0a, g1a] = makeSplitPair("E001", {
      _arrivalDate: "2025-01-01",
      _departureDate: "2025-12-31",
    });
    // Duplicate entries for same realEmpId should not double-count
    const result = countArrivalDepartures([g0a, g1a, g0a, g1a]);
    expect(result.arrivalCounts!.get("2025-01-01")).toBe(1);
    expect(result.departureCounts!.get("2025-12-31")).toBe(1);
  });

  it("does not count arrival on non-first split", () => {
    const [, g1] = makeSplitPair("E001", { _arrivalDate: "2025-01-01" });
    const result = countArrivalDepartures([g1]);
    expect(result.arrivalCounts).toBeNull();
  });

  it("does not count departure on first split (non-last)", () => {
    const [g0] = makeSplitPair("E001", { _departureDate: "2025-12-31" });
    const result = countArrivalDepartures([g0]);
    expect(result.departureCounts).toBeNull();
  });
});

// ─── countGradeTransitionsByDate ────────────────────────────────────────────

describe("countGradeTransitionsByDate", () => {
  it("returns null for empty array", () => {
    expect(countGradeTransitionsByDate([])).toBeNull();
  });

  it("returns null when no employees have grade history", () => {
    const employees = [makeEmp({ empId: "E001" })];
    expect(countGradeTransitionsByDate(employees)).toBeNull();
  });

  it("returns null for single-entry grade history (no transition)", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [{ grade: "Consultant", since: "2024-01-01" }],
      }),
    ];
    expect(countGradeTransitionsByDate(employees)).toBeNull();
  });

  it("counts transitions from grade history (skips first entry)", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-03-03" }, // Monday
        ],
      }),
    ];
    const result = countGradeTransitionsByDate(employees);
    expect(result).not.toBeNull();
    expect(result!.get("2025-03-03")).toBe(1);
  });

  it("shifts Saturday transition to Monday", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-03-01" }, // Saturday
        ],
      }),
    ];
    const result = countGradeTransitionsByDate(employees);
    expect(result).not.toBeNull();
    // Saturday 2025-03-01 → Monday 2025-03-03
    expect(result!.get("2025-03-03")).toBe(1);
    expect(result!.has("2025-03-01")).toBe(false);
  });

  it("shifts Sunday transition to Monday", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-03-02" }, // Sunday
        ],
      }),
    ];
    const result = countGradeTransitionsByDate(employees);
    expect(result).not.toBeNull();
    // Sunday 2025-03-02 → Monday 2025-03-03
    expect(result!.get("2025-03-03")).toBe(1);
  });

  it("deduplicates by realEmpId across grade splits", () => {
    const history = [
      { grade: "Consultant", since: "2024-01-01" },
      { grade: "Senior Consultant", since: "2025-06-02" }, // Monday
    ];
    const [g0, g1] = makeSplitPair("E001", { _gradeHistory: history });
    const result = countGradeTransitionsByDate([g0, g1]);
    expect(result).not.toBeNull();
    // Should count only once despite two split rows
    expect(result!.get("2025-06-02")).toBe(1);
  });

  it("counts multiple transitions for same employee", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Analyst", since: "2023-01-01" },
          { grade: "Consultant", since: "2024-03-04" }, // Monday
          { grade: "Senior Consultant", since: "2025-06-02" }, // Monday
        ],
      }),
    ];
    const result = countGradeTransitionsByDate(employees);
    expect(result).not.toBeNull();
    expect(result!.get("2024-03-04")).toBe(1);
    expect(result!.get("2025-06-02")).toBe(1);
  });
});

// ─── countTurnoverInRange ───────────────────────────────────────────────────

describe("countTurnoverInRange", () => {
  const rangeStart = "2025-01-01";
  const rangeEnd = "2025-07-01";

  it("counts arrivals within range", () => {
    const employees = [
      makeEmp({ empId: "E001", _arrivalDate: "2025-03-01" }),
      makeEmp({ empId: "E002", _arrivalDate: "2025-05-15" }),
    ];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.arrivals).toBe(2);
    expect(result.arrivalsAll).toBe(2);
  });

  it("counts departures within range", () => {
    const employees = [
      makeEmp({ empId: "E001", _departureDate: "2025-03-31" }),
      makeEmp({ empId: "E002", _departureDate: "2025-06-30" }),
    ];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.departures).toBe(2);
    expect(result.departuresAll).toBe(2);
  });

  it("excludes arrivals outside range", () => {
    const employees = [
      makeEmp({ empId: "E001", _arrivalDate: "2024-12-31" }), // before range
      makeEmp({ empId: "E002", _arrivalDate: "2025-07-01" }), // at rangeEnd (exclusive)
      makeEmp({ empId: "E003", _arrivalDate: "2025-09-01" }), // after range
    ];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.arrivals).toBe(0);
    expect(result.arrivalsAll).toBe(0);
  });

  it("excludes departures outside range", () => {
    const employees = [
      makeEmp({ empId: "E001", _departureDate: "2024-12-31" }), // before range
      makeEmp({ empId: "E002", _departureDate: "2025-01-01" }), // at rangeStart (exclusive)
      makeEmp({ empId: "E003", _departureDate: "2025-08-01" }), // after range
    ];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.departures).toBe(0);
    expect(result.departuresAll).toBe(0);
  });

  it("arrival at rangeStart is included (>=)", () => {
    const employees = [makeEmp({ empId: "E001", _arrivalDate: "2025-01-01" })];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.arrivals).toBe(1);
  });

  it("departure at rangeEnd is included (<=)", () => {
    const employees = [makeEmp({ empId: "E001", _departureDate: "2025-07-01" })];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    expect(result.departures).toBe(1);
  });

  it("excludes Interns from non-All counts but includes in All counts", () => {
    const employees = [
      makeEmp({ empId: "E001", grade: "Intern", _arrivalDate: "2025-02-01", _departureDate: "2025-06-30" }),
      makeEmp({ empId: "E002", grade: "Consultant", _arrivalDate: "2025-03-01" }),
    ];
    const result = countTurnoverInRange(employees, rangeStart, rangeEnd);
    // Non-All: only Consultant
    expect(result.arrivals).toBe(1);
    expect(result.departures).toBe(0);
    // All: both Intern and Consultant
    expect(result.arrivalsAll).toBe(2);
    expect(result.departuresAll).toBe(1);
  });

  it("handles grade splits: arrival on g0, departure on last", () => {
    const [g0, g1] = makeSplitPair("E001", {
      _arrivalDate: "2025-03-01",
      _departureDate: "2025-06-30",
    });
    const result = countTurnoverInRange([g0, g1], rangeStart, rangeEnd);
    expect(result.arrivals).toBe(1);
    expect(result.departures).toBe(1);
  });

  it("deduplicates by realEmpId for grade splits", () => {
    const [g0, g1] = makeSplitPair("E001", {
      _arrivalDate: "2025-03-01",
      _departureDate: "2025-06-30",
    });
    // Passing duplicates should still count once
    const result = countTurnoverInRange([g0, g1, g0, g1], rangeStart, rangeEnd);
    expect(result.arrivals).toBe(1);
    expect(result.departures).toBe(1);
  });

  it("returns zeros for empty array", () => {
    const result = countTurnoverInRange([], rangeStart, rangeEnd);
    expect(result.arrivals).toBe(0);
    expect(result.departures).toBe(0);
    expect(result.arrivalsAll).toBe(0);
    expect(result.departuresAll).toBe(0);
  });
});

// ─── countGradeTransitionsInRange ───────────────────────────────────────────

describe("countGradeTransitionsInRange", () => {
  const rangeStart = "2025-01-01";
  const rangeEnd = "2025-07-01";

  it("counts transitions within range", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-03-03" }, // Monday, in range
        ],
      }),
    ];
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(1);
  });

  it("excludes transitions outside range", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Analyst", since: "2023-01-01" },
          { grade: "Consultant", since: "2024-06-03" }, // before range
        ],
      }),
    ];
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(0);
  });

  it("excludes transitions at rangeEnd (exclusive)", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-06-30" }, // Monday, at rangeEnd boundary
        ],
      }),
    ];
    // 2025-06-30 is a Monday, shifted stays 2025-06-30, which is < 2025-07-01
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(1);
  });

  it("handles weekend shifting for transitions near range boundary", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Consultant", since: "2024-01-01" },
          { grade: "Senior Consultant", since: "2025-06-28" }, // Saturday → shifts to Monday 2025-06-30
        ],
      }),
    ];
    // Shifted to 2025-06-30, which is < 2025-07-01 → in range
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(1);
  });

  it("deduplicates by realEmpId across grade splits", () => {
    const history = [
      { grade: "Consultant", since: "2024-01-01" },
      { grade: "Senior Consultant", since: "2025-03-03" },
    ];
    const [g0, g1] = makeSplitPair("E001", { _gradeHistory: history });
    // Only counted once despite two split rows
    expect(countGradeTransitionsInRange([g0, g1], rangeStart, rangeEnd)).toBe(1);
  });

  it("returns 0 for empty array", () => {
    expect(countGradeTransitionsInRange([], rangeStart, rangeEnd)).toBe(0);
  });

  it("returns 0 when no grade history exists", () => {
    const employees = [makeEmp({ empId: "E001" })];
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(0);
  });

  it("counts multiple transitions for one employee", () => {
    const employees = [
      makeEmp({
        empId: "E001",
        _gradeHistory: [
          { grade: "Analyst", since: "2023-01-01" },
          { grade: "Consultant", since: "2025-02-03" }, // Monday, in range
          { grade: "Senior Consultant", since: "2025-05-05" }, // Monday, in range
        ],
      }),
    ];
    expect(countGradeTransitionsInRange(employees, rangeStart, rangeEnd)).toBe(2);
  });
});
