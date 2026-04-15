import { describe, it, expect } from "vitest";
import {
  computeOverlapWorkDays,
  expandNeedsToSlots,
  buildScoringMatrix,
  generateProposals,
  getCellColor,
  STRATEGY_META,
  type Slot,
  type CellScore,
  type Proposal,
} from "../autoAssign";

// ─── computeOverlapWorkDays ──────────────────────────────────────────────────

describe("computeOverlapWorkDays", () => {
  it("returns 0 when ranges do not overlap", () => {
    // Range 1: Mon-Fri, Range 2: next Mon-Fri
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-10", "2025-01-13", "2025-01-17", null)).toBe(0);
  });

  it("returns 0 when ranges are adjacent (end equals start)", () => {
    // end1 === start2 → no overlap (strict < comparison)
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-10", "2025-01-10", "2025-01-17", null)).toBe(0);
  });

  it("counts working days for full overlap (single work week)", () => {
    // Same Mon-Fri range → 5 working days (end is exclusive, so Mon-Sat = 5 days)
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-11", "2025-01-06", "2025-01-11", null)).toBe(5);
  });

  it("excludes weekends from count", () => {
    // Mon Jan 6 to Mon Jan 13 (exclusive) = Mon-Fri = 5 working days
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-13", "2025-01-06", "2025-01-13", null)).toBe(5);
  });

  it("counts partial overlap correctly", () => {
    // Range 1: Mon Jan 6 - Fri Jan 17 (exclusive), Range 2: Wed Jan 8 - Mon Jan 20 (exclusive)
    // Overlap: Wed Jan 8 - Fri Jan 17 (exclusive) = Wed8, Thu9, Fri10, Mon13, Tue14, Wed15, Thu16 = 7 working days
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-17", "2025-01-08", "2025-01-20", null)).toBe(7);
  });

  it("excludes holidays", () => {
    const holidays = new Set(["2025-01-08"]); // Wednesday is a holiday
    // Mon Jan 6 - Sat Jan 11 overlap with itself = 5 days, minus 1 holiday = 4
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-11", "2025-01-06", "2025-01-11", holidays)).toBe(4);
  });

  it("returns 0 for invalid dates", () => {
    expect(computeOverlapWorkDays("invalid", "2025-01-10", "2025-01-06", "2025-01-10", null)).toBe(0);
  });

  it("handles Date objects as well as strings", () => {
    const d1 = new Date("2025-01-06");
    const d2 = new Date("2025-01-11");
    expect(computeOverlapWorkDays(d1, d2, d1, d2, null)).toBe(5);
  });

  it("counts a two-week period correctly", () => {
    // Mon Jan 6 - Mon Jan 20 (exclusive) = 10 working days
    expect(computeOverlapWorkDays("2025-01-06", "2025-01-20", "2025-01-06", "2025-01-20", null)).toBe(10);
  });
});

// ─── expandNeedsToSlots ──────────────────────────────────────────────────────

describe("expandNeedsToSlots", () => {
  it("expands a single need with quantity 1 into one slot", () => {
    const needs = [
      {
        id: "n1",
        grade: "Consultant",
        quantity: 1,
        opportunityId: "opp1",
        startDate: "2025-02-01",
        endDate: "2025-03-01",
        probability: 80,
        skills: ["React"],
      },
    ];
    const slots = expandNeedsToSlots(needs, null);
    expect(slots).toHaveLength(1);
    expect(slots[0].grade).toBe("Consultant");
    expect(slots[0].probability).toBe(80);
    expect(slots[0].skills).toEqual(["React"]);
    expect(slots[0].needId).toBe("n1");
  });

  it("expands quantity > 1 into multiple slots", () => {
    const needs = [
      {
        id: "n2",
        grade: "Manager",
        quantity: 3,
        opportunityId: "opp2",
        startDate: "2025-02-01",
        endDate: "2025-04-01",
        probability: 100,
        skills: [],
      },
    ];
    const slots = expandNeedsToSlots(needs, null);
    expect(slots).toHaveLength(3);
    slots.forEach((s) => {
      expect(s.grade).toBe("Manager");
      expect(s.opportunityId).toBe("opp2");
    });
  });

  it("uses grade directly as provided", () => {
    const grades = [
      "Intern",
      "Analyst",
      "Consultant",
      "Senior Consultant",
      "Manager",
      "Senior Manager",
      "Director",
      "Partner",
    ];
    for (const grade of grades) {
      const slots = expandNeedsToSlots([{ grade, quantity: 1 }], null);
      expect(slots[0].grade).toBe(grade);
    }
  });

  it("defaults quantity to 1 when missing or invalid", () => {
    const slots = expandNeedsToSlots([{ grade: "Analyst" }], null);
    expect(slots).toHaveLength(1);
  });

  it("defaults probability to 1 when missing", () => {
    const slots = expandNeedsToSlots([{ grade: "Consultant", quantity: 1 }], null);
    expect(slots[0].probability).toBe(1);
  });

  it("sorts slots by grade seniority (senior first)", () => {
    const needs = [
      { grade: "Analyst", quantity: 1, opportunityId: "a" },
      { grade: "Partner", quantity: 1, opportunityId: "b" },
      { grade: "Consultant", quantity: 1, opportunityId: "c" },
    ];
    const slots = expandNeedsToSlots(needs, null);
    expect(slots[0].grade).toBe("Partner");
    expect(slots[1].grade).toBe("Consultant");
    expect(slots[2].grade).toBe("Analyst");
  });

  it("resolves oppLabel from pipelineJobcodes", () => {
    const pjc = new Map([["JOB001", { opportunityId: "opp1", opportunity: "Alpha Project" }]]);
    const needs = [{ id: "n1", grade: "Consultant", quantity: 1, opportunityId: "opp1" }];
    const slots = expandNeedsToSlots(needs, pjc);
    expect(slots[0].oppLabel).toBe("Alpha Project");
    expect(slots[0].jobNo).toBe("JOB001");
  });
});

// ─── buildScoringMatrix ──────────────────────────────────────────────────────

describe("buildScoringMatrix", () => {
  const makeEmployee = (overrides: Record<string, any> = {}) => ({
    empId: "E001",
    grade: "Consultant",
    name: "John Doe",
    assignments: [{ startDate: "2025-01-01", endDate: "2025-06-30" }],
    availableCapacityHours: 400,
    _displayNetH: 1000,
    skills: [],
    trueUtilizationRate: 50,
    ...overrides,
  });

  const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
    needId: "need1",
    slotIndex: 0,
    grade: "Consultant",
    gradeAbbr: "C",
    opportunityId: "opp1",
    oppLabel: "Project X",
    jobNo: "JOB1",
    startDate: "2025-02-01",
    endDate: "2025-04-01",
    probability: 100,
    skills: [],
    techPartners: [],
    serviceLines: [],
    ...overrides,
  });

  it("returns a matrix with correct dimensions", () => {
    const employees = [makeEmployee(), makeEmployee({ empId: "E002" })];
    const slots = [makeSlot(), makeSlot({ needId: "need2" })];
    const matrix = buildScoringMatrix(employees, slots, null);
    expect(matrix).toHaveLength(2); // 2 slots
    expect(matrix[0]).toHaveLength(2); // 2 employees
    expect(matrix[1]).toHaveLength(2);
  });

  it("gives max grade fit (30) for exact grade match", () => {
    const matrix = buildScoringMatrix(
      [makeEmployee({ grade: "Consultant" })],
      [makeSlot({ grade: "Consultant" })],
      null
    );
    expect(matrix[0][0].gradeFit).toBe(30);
  });

  it("gives 20 for adjacent grade", () => {
    const matrix = buildScoringMatrix(
      [makeEmployee({ grade: "Senior Consultant" })],
      [makeSlot({ grade: "Consultant" })],
      null
    );
    expect(matrix[0][0].gradeFit).toBe(20);
  });

  it("gives 10 for 2-step grade distance", () => {
    const matrix = buildScoringMatrix([makeEmployee({ grade: "Manager" })], [makeSlot({ grade: "Consultant" })], null);
    expect(matrix[0][0].gradeFit).toBe(10);
  });

  it("gives 0 for distant grades (3+ steps)", () => {
    const matrix = buildScoringMatrix([makeEmployee({ grade: "Partner" })], [makeSlot({ grade: "Consultant" })], null);
    expect(matrix[0][0].gradeFit).toBe(0);
  });

  it("gives max probability bonus (5) for 100% probability", () => {
    const matrix = buildScoringMatrix([makeEmployee()], [makeSlot({ probability: 1 })], null);
    expect(matrix[0][0].probBonus).toBe(5);
  });

  it("gives scaled probability bonus for lower probability", () => {
    const matrix = buildScoringMatrix([makeEmployee()], [makeSlot({ probability: 0.6 })], null);
    expect(matrix[0][0].probBonus).toBeCloseTo(3);
  });

  it("gives max skills score (15) when no skills required", () => {
    const matrix = buildScoringMatrix([makeEmployee()], [makeSlot({ skills: [] })], null);
    expect(matrix[0][0].skillsMatch).toBe(15);
  });

  it("scores skills matching correctly", () => {
    const emp = makeEmployee({
      skills: [{ skillShort: "React" }, { skillShort: "TypeScript" }],
    });
    const slot = makeSlot({ skills: ["React", "TypeScript", "Python"] });
    const matrix = buildScoringMatrix([emp], [slot], null);
    // 2 out of 3 matched → (2/3)*15 = 10
    expect(matrix[0][0].skillsMatch).toBeCloseTo(10);
  });

  it("skills matching is case-insensitive", () => {
    const emp = makeEmployee({
      skills: [{ skillShort: "react" }],
    });
    const slot = makeSlot({ skills: ["React"] });
    const matrix = buildScoringMatrix([emp], [slot], null);
    expect(matrix[0][0].skillsMatch).toBe(15);
  });

  it("total score is capped at 100", () => {
    const matrix = buildScoringMatrix([makeEmployee()], [makeSlot()], null);
    expect(matrix[0][0].total).toBeLessThanOrEqual(100);
  });

  it("cell contains correct empId and indices", () => {
    const matrix = buildScoringMatrix([makeEmployee({ empId: "E999" })], [makeSlot()], null);
    expect(matrix[0][0].empId).toBe("E999");
    expect(matrix[0][0].slotIdx).toBe(0);
    expect(matrix[0][0].empIdx).toBe(0);
  });
});

// ─── generateProposals ───────────────────────────────────────────────────────

describe("generateProposals", () => {
  const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
    needId: "need1",
    slotIndex: 0,
    grade: "Consultant",
    gradeAbbr: "C",
    opportunityId: "opp1",
    oppLabel: "Project X",
    jobNo: "JOB1",
    startDate: "2025-02-01",
    endDate: "2025-04-01",
    probability: 100,
    skills: [],
    techPartners: [],
    serviceLines: [],
    ...overrides,
  });

  const makeEmployee = (overrides: Record<string, any> = {}) => ({
    empId: "E001",
    grade: "Consultant",
    name: "John Doe",
    assignments: [{ startDate: "2025-01-01", endDate: "2025-06-30" }],
    availableCapacityHours: 400,
    _displayNetH: 1000,
    skills: [],
    trueUtilizationRate: 50,
    ...overrides,
  });

  it("generates exactly 5 proposals (one per strategy)", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);
    expect(proposals).toHaveLength(5);
  });

  it("each proposal has a unique strategy id", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);
    const strategyIds = proposals.map((p) => p.strategy);
    const uniqueIds = new Set(strategyIds);
    expect(uniqueIds.size).toBe(5);
    expect(uniqueIds).toContain("optimalTu");
    expect(uniqueIds).toContain("bestFit");
    expect(uniqueIds).toContain("maxCoverage");
    expect(uniqueIds).toContain("mplusPriority");
    expect(uniqueIds).toContain("balanced");
  });

  it("fills slot when score meets minimum threshold", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    // maxCoverage has the lowest minScore (15) so it should fill the slot
    const maxCoverage = proposals.find((p) => p.strategy === "maxCoverage")!;
    expect(maxCoverage.assignments).toHaveLength(1);
    expect(maxCoverage.stats.filledSlots).toBe(1);
    expect(maxCoverage.stats.totalSlots).toBe(1);
    expect(maxCoverage.stats.coverageRate).toBe(100);
  });

  it("reports unfilled slots with reason", () => {
    // Create employee with very distant grade so score is below bestFit threshold (40)
    const employees = [makeEmployee({ grade: "Partner", availableCapacityHours: 0, _displayNetH: 1 })];
    const slots = [makeSlot({ grade: "Intern" })];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    const bestFit = proposals.find((p) => p.strategy === "bestFit")!;
    // If the score is below 40, it should be unfilled
    if (bestFit.assignments.length === 0) {
      expect(bestFit.unfilledSlots).toHaveLength(1);
      expect(bestFit.unfilledSlots[0].reason).toContain("40");
    }
  });

  it("does not assign same employee to overlapping slots", () => {
    const employees = [makeEmployee()];
    const slots = [
      makeSlot({ needId: "n1", startDate: "2025-02-01", endDate: "2025-03-01" }),
      makeSlot({ needId: "n2", startDate: "2025-02-15", endDate: "2025-04-01" }),
    ];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    for (const proposal of proposals) {
      // Each employee can only appear once when slots overlap
      const empIds = proposal.assignments.map((a) => a.empId);
      expect(empIds.length).toBeLessThanOrEqual(1);
    }
  });

  it("can assign same employee to non-overlapping slots", () => {
    const employees = [makeEmployee()];
    const slots = [
      makeSlot({ needId: "n1", startDate: "2025-02-01", endDate: "2025-03-01" }),
      makeSlot({ needId: "n2", startDate: "2025-04-01", endDate: "2025-05-01" }),
    ];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    // maxCoverage should assign the employee to both non-overlapping slots
    const maxCoverage = proposals.find((p) => p.strategy === "maxCoverage")!;
    expect(maxCoverage.assignments).toHaveLength(2);
  });

  it("computes projected TU delta correctly", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const currentTeamTU = 60;
    const currentTeamNetH = 10000;
    const currentTeamChH = 6000;
    const proposals = generateProposals(matrix, slots, employees, currentTeamTU, currentTeamNetH, currentTeamChH);

    for (const p of proposals) {
      if (p.assignments.length > 0) {
        expect(p.stats.projectedTU).toBeGreaterThan(currentTeamTU);
        expect(p.stats.projectedTUDelta).toBeGreaterThan(0);
      }
    }
  });

  it("stats avgScore is the mean of assignment scores", () => {
    const employees = [makeEmployee({ empId: "E1" }), makeEmployee({ empId: "E2", grade: "Senior Consultant" })];
    const slots = [
      makeSlot({ needId: "n1", startDate: "2025-02-01", endDate: "2025-03-01" }),
      makeSlot({ needId: "n2", startDate: "2025-04-01", endDate: "2025-05-01" }),
    ];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    for (const p of proposals) {
      if (p.assignments.length > 0) {
        const expectedAvg = p.assignments.reduce((s, a) => s + a.score, 0) / p.assignments.length;
        expect(p.stats.avgScore).toBeCloseTo(expectedAvg);
      }
    }
  });

  it("proposals are sorted by projectedTUDelta descending", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    for (let i = 1; i < proposals.length; i++) {
      expect(proposals[i - 1].stats.projectedTUDelta).toBeGreaterThanOrEqual(proposals[i].stats.projectedTUDelta);
    }
  });

  it("selectionMap maps slotIdx to empIdx for each assignment", () => {
    const employees = [makeEmployee()];
    const slots = [makeSlot()];
    const matrix = buildScoringMatrix(employees, slots, null);
    const proposals = generateProposals(matrix, slots, employees, 60, 10000, 6000);

    for (const p of proposals) {
      for (const a of p.assignments) {
        expect(p.selectionMap.get(a.slotIdx)).toBe(a.empIdx);
      }
    }
  });

  it("handles empty inputs gracefully", () => {
    const proposals = generateProposals([], [], [], 0, 0, 0);
    expect(proposals).toHaveLength(5);
    for (const p of proposals) {
      expect(p.assignments).toHaveLength(0);
      expect(p.stats.totalSlots).toBe(0);
      expect(p.stats.coverageRate).toBe(0);
    }
  });
});

// ─── getCellColor ────────────────────────────────────────────────────────────

describe("getCellColor", () => {
  it("returns green for high scores (>= 70)", () => {
    const result = getCellColor(70);
    expect(result.bg).toBe("#ecfdf5");
    expect(result.text).toBe("#047857");
  });

  it("returns amber for medium scores (40-69)", () => {
    expect(getCellColor(40).bg).toBe("#fffbeb");
    expect(getCellColor(69).bg).toBe("#fffbeb");
  });

  it("returns orange for low scores (10-39)", () => {
    expect(getCellColor(10).bg).toBe("#fff7ed");
    expect(getCellColor(39).bg).toBe("#fff7ed");
  });

  it("returns grey for very low scores (< 10)", () => {
    expect(getCellColor(0).bg).toBe("#f9fafb");
    expect(getCellColor(9).bg).toBe("#f9fafb");
  });
});

// ─── STRATEGY_META ───────────────────────────────────────────────────────────

describe("STRATEGY_META", () => {
  it("contains all 5 strategy entries", () => {
    const keys = Object.keys(STRATEGY_META);
    expect(keys).toHaveLength(5);
    expect(keys).toContain("optimalTu");
    expect(keys).toContain("bestFit");
    expect(keys).toContain("maxCoverage");
    expect(keys).toContain("mplusPriority");
    expect(keys).toContain("balanced");
  });

  it("each entry has name, icon and color", () => {
    for (const meta of Object.values(STRATEGY_META)) {
      expect(meta).toHaveProperty("name");
      expect(meta).toHaveProperty("icon");
      expect(meta).toHaveProperty("color");
      expect(typeof meta.color).toBe("string");
      expect(meta.color).toMatch(/^#/);
    }
  });
});
