import { describe, it, expect } from "vitest";
import { accumulateCoreStats, computeModeDependentValues } from "../teamStatsCalc";
import type { CoreAccResult } from "../teamStatsCalc";

// ─── Helper: minimal employee-like object ──────────────────────────────────

const makeEmp = (overrides: Record<string, any> = {}): any => ({
  empId: "E001",
  name: "Test Employee",
  grade: "Consultant",
  _displayActiveN: 20,
  _displayNetH: 160,
  _displayChH: 120,
  _displayTrH: 8,
  totalNetHours: 160,
  totalWorkingDaysInPeriod: 20,
  totalChargeableHoursInPeriod: 120,
  totalChargeableOnlyHoursInPeriod: 100,
  totalAbsenceHoursInPeriod: 0,
  _presenceActiveN: 20,
  _ioChHours: 0,
  _varianceRate: null,
  _varianceHours: null,
  _sapOverH: 0,
  _sapMissingH: 0,
  _sapPct: 0,
  _sapDayCount: 0,
  _sapActiveDayCount: 0,
  _hasSapAnomaly: false,
  _isGradeSplit: false,
  ...overrides,
});

// ─── accumulateCoreStats ───────────────────────────────────────────────────

describe("accumulateCoreStats", () => {
  it("returns all zeros for empty employee list", () => {
    const result = accumulateCoreStats([], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.totalCh).toBe(0);
    expect(result.totalNet).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.mplusCount).toBe(0);
    expect(result.mminusCount).toBe(0);
  });

  it("skips employees with _displayActiveN falsy", () => {
    const emp = makeEmp({ _displayActiveN: 0 });
    const result = accumulateCoreStats([emp], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.activeCount).toBe(0);
    expect(result.totalCh).toBe(0);
  });

  it("accumulates chargeable and net hours for a single M- employee", () => {
    const emp = makeEmp({ grade: "Consultant", _displayChH: 80, _displayNetH: 160 });
    const result = accumulateCoreStats([emp], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.totalCh).toBe(80);
    expect(result.totalNet).toBe(160);
    expect(result.mminusCh).toBe(80);
    expect(result.mminusNet).toBe(160);
    expect(result.mminusCount).toBe(1);
    expect(result.mplusCh).toBe(0);
    expect(result.mplusCount).toBe(0);
  });

  it("accumulates M+ employee into mplus accumulators", () => {
    const emp = makeEmp({ grade: "Manager", _displayChH: 60, _displayNetH: 160, _displayTrH: 10 });
    const result = accumulateCoreStats([emp], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.mplusCh).toBe(60);
    expect(result.mplusNet).toBe(160);
    expect(result.mplusTr).toBe(10);
    expect(result.mplusCount).toBe(1);
    expect(result.mminusCount).toBe(0);
  });

  it("deduplicates real employee IDs for grade-split employees", () => {
    const emp1 = makeEmp({ empId: "E001::g0", _realEmpId: "E001", grade: "Consultant", _isGradeSplit: true });
    const emp2 = makeEmp({ empId: "E001::g1", _realEmpId: "E001", grade: "Senior Consultant", _isGradeSplit: true });
    const result = accumulateCoreStats([emp1, emp2], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.activeCount).toBe(1);
  });

  it("counts total working days from timeline range", () => {
    // 2026-04-01 (Wed) to 2026-04-08 (Wed) = 5 working days (Wed-Sun: 3, Mon-Tue: 2, plus nothing on Wed the 8th since <)
    const result = accumulateCoreStats([], new Date("2026-04-01"), new Date("2026-04-08"));
    expect(result.totalWorkDays).toBe(5); // Apr 1(Wed), 2(Thu), 3(Fri), 6(Mon), 7(Tue)
  });

  it("accumulates SAP stats correctly", () => {
    const emp = makeEmp({
      _sapPct: 80,
      _sapDayCount: 15,
      _sapActiveDayCount: 12,
      _sapOverH: 4,
      _sapMissingH: 2,
      _hasSapAnomaly: true,
      _varianceRate: 5,
      _varianceHours: 10,
    });
    const result = accumulateCoreStats([emp], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.sapTotalPct).toBe(80);
    expect(result.sapTotalDays).toBe(15);
    expect(result.sapTotalOverH).toBe(4);
    expect(result.sapTotalMissingH).toBe(2);
    expect(result.sapAnomalyCount).toBe(1);
    expect(result.sapPartial).toBe(1); // 80% → partial
    expect(result.sapComplete).toBe(0);
  });

  it("classifies SAP coverage: complete >= 100, partial > 0, empty = 0", () => {
    const empComplete = makeEmp({ empId: "E1", _sapPct: 100 });
    const empPartial = makeEmp({ empId: "E2", _sapPct: 50 });
    const empEmpty = makeEmp({ empId: "E3", _sapPct: 0 });
    const result = accumulateCoreStats(
      [empComplete, empPartial, empEmpty],
      new Date("2026-04-01"),
      new Date("2026-04-30")
    );
    expect(result.sapComplete).toBe(1);
    expect(result.sapPartial).toBe(1);
    expect(result.sapEmpty).toBe(1);
  });

  it("two employees with distinct grades each count in both M+ and M- totals", () => {
    const mgr = makeEmp({ empId: "E1", grade: "Manager", _displayChH: 40, _displayNetH: 80 });
    const ana = makeEmp({ empId: "E2", grade: "Analyst", _displayChH: 60, _displayNetH: 120 });
    const result = accumulateCoreStats([mgr, ana], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.totalCh).toBe(100);
    expect(result.totalNet).toBe(200);
    expect(result.mplusCount).toBe(1);
    expect(result.mminusCount).toBe(1);
  });

  it("does not double-count SAP pct for grade-split employees", () => {
    // Both rows share same realId, only the first should contribute to SAP stats
    const emp1 = makeEmp({ empId: "E001::g0", _realEmpId: "E001", _sapPct: 75, _isGradeSplit: true });
    const emp2 = makeEmp({ empId: "E001::g1", _realEmpId: "E001", _sapPct: 75, _isGradeSplit: true });
    const result = accumulateCoreStats([emp1, emp2], new Date("2026-04-01"), new Date("2026-04-30"));
    // sapTotalPct should only be incremented once (75, not 150)
    expect(result.sapTotalPct).toBe(75);
  });

  it("accumulates IO hours when ioJobcodes is provided", () => {
    const emp = makeEmp({ empId: "E1", _ioChHours: 16 });
    const ioJobcodes = new Set(["J-IO"]);
    const result = accumulateCoreStats([emp], new Date("2026-04-01"), new Date("2026-04-30"), ioJobcodes);
    expect(result.ioChHours).toBe(16);
  });

  it("accumulates variance rate and hours for M+ and M- independently", () => {
    const mgr = makeEmp({
      empId: "E1",
      grade: "Manager",
      _varianceRate: 5,
      _varianceHours: 10,
    });
    const ana = makeEmp({
      empId: "E2",
      grade: "Analyst",
      _varianceRate: -3,
      _varianceHours: -6,
    });
    const result = accumulateCoreStats([mgr, ana], new Date("2026-04-01"), new Date("2026-04-30"));
    expect(result.mplusVarRateSum).toBe(5);
    expect(result.mplusVarCount).toBe(1);
    expect(result.mminusVarRateSum).toBe(-3);
    expect(result.mminusVarCount).toBe(1);
  });
});

// ─── computeModeDependentValues ────────────────────────────────────────────

describe("computeModeDependentValues", () => {
  const makeCore = (overrides: Partial<CoreAccResult> = {}): CoreAccResult => ({
    totalCh: 80,
    totalNet: 160,
    adjustedCh: 90,
    targetCh: 100,
    totalGross: 200,
    totalAbs: 16,
    totalChOnly: 70,
    totalGO: 10,
    totalTr: 12,
    mplusCh: 30,
    mplusNet: 80,
    mplusTr: 4,
    mminusCh: 50,
    mminusNet: 80,
    mminusTr: 8,
    mplusCount: 2,
    mminusCount: 3,
    mplusFTE: 2,
    mminusFTE: 3,
    mplusRealFTE: 2,
    mminusRealFTE: 3,
    mplusIoH: 0,
    mminusIoH: 0,
    sapTotalPct: 0,
    sapComplete: 0,
    sapPartial: 0,
    sapEmpty: 0,
    sapTotalDays: 0,
    sapTotalActiveDays: 0,
    sapAnomalyCount: 0,
    sapTotalOverH: 0,
    sapTotalMissingH: 0,
    sapVarRateSum: 10,
    sapVarHoursSum: 20,
    sapVarCount: 2,
    mplusVarRateSum: 4,
    mplusVarCount: 1,
    mplusVarHoursSum: 8,
    mminusVarRateSum: 6,
    mminusVarCount: 1,
    mminusVarHoursSum: 12,
    activeCount: 5,
    ioChHours: 0,
    totalWorkDays: 20,
    ...overrides,
  });

  it("returns TU mode by default", () => {
    const result = computeModeDependentValues(makeCore(), "tu");
    expect(result.modeLabel).toBe("TU");
    expect(result.modeUnit).toBe("%");
    expect(result.currentTU).toBeCloseTo(50); // 80/160 * 100
    expect(result.isVarianceMode).toBe(false);
    expect(result.isHoursMode).toBe(false);
  });

  it("computes TO mode including training", () => {
    const result = computeModeDependentValues(makeCore(), "to");
    expect(result.modeLabel).toBe("TO");
    // (80 + 12) / 160 * 100 = 57.5
    expect(result.currentTU).toBeCloseTo(57.5);
    expect(result.mplusTU).toBeCloseTo(((30 + 4) / 80) * 100);
  });

  it("computes availability mode as 100 - TU", () => {
    const result = computeModeDependentValues(makeCore(), "availability");
    expect(result.modeLabel).toBe("Avail");
    expect(result.currentTU).toBeCloseTo(50); // 100 - 50
  });

  it("computes variance_hours mode from SAP variance", () => {
    const result = computeModeDependentValues(makeCore(), "variance_hours");
    expect(result.modeLabel).toBe("\u0394h");
    expect(result.modeUnit).toBe("h");
    expect(result.currentTU).toBe(20); // sapVarHoursSum
    expect(result.isVarianceMode).toBe(true);
    expect(result.mplusTU).toBe(8);
    expect(result.mminusTU).toBe(12);
  });

  it("computes variance_hours_pct mode as average rate", () => {
    const result = computeModeDependentValues(makeCore(), "variance_hours_pct");
    expect(result.modeLabel).toBe("\u0394h%");
    expect(result.modeUnit).toBe("pts");
    expect(result.currentTU).toBeCloseTo(5); // 10 / 2
    expect(result.isVarianceMode).toBe(true);
  });

  it("computes hours mode returning raw hours", () => {
    const result = computeModeDependentValues(makeCore(), "hours");
    expect(result.modeLabel).toBe("h");
    expect(result.modeUnit).toBe("h");
    expect(result.currentTU).toBe(80);
    expect(result.potentialTU).toBe(90);
    expect(result.isHoursMode).toBe(true);
  });

  it("handles zero net hours gracefully in default mode", () => {
    const result = computeModeDependentValues(makeCore({ totalNet: 0, mplusNet: 0, mminusNet: 0 }), "tu");
    expect(result.currentTU).toBe(0);
    expect(result.mplusTU).toBe(0);
    expect(result.mminusTU).toBe(0);
  });

  it("handles zero variance count by returning 0", () => {
    const result = computeModeDependentValues(
      makeCore({ sapVarCount: 0, mplusVarCount: 0, mminusVarCount: 0 }),
      "variance_hours"
    );
    expect(result.currentTU).toBe(0);
    expect(result.mplusTU).toBe(0);
    expect(result.mminusTU).toBe(0);
  });

  it("unknown mode falls back to TU", () => {
    const result = computeModeDependentValues(makeCore(), "unknown_mode");
    expect(result.modeLabel).toBe("TU");
    expect(result.currentTU).toBeCloseTo(50);
    expect(result.isVarianceMode).toBe(false);
    expect(result.isHoursMode).toBe(false);
  });

  it("potentialTU and theoreticalTU are computed in TU mode", () => {
    // adjustedCh=90, targetCh=100, totalNet=160
    const result = computeModeDependentValues(makeCore(), "tu");
    expect(result.potentialTU).toBeCloseTo((90 / 160) * 100);
    expect(result.theoreticalTU).toBeCloseTo((100 / 160) * 100);
  });

  it("mplus and mminus availability are 100 - their base TU", () => {
    const result = computeModeDependentValues(makeCore(), "availability");
    const expectedMplus = 100 - (30 / 80) * 100;
    const expectedMminus = 100 - (50 / 80) * 100;
    expect(result.mplusTU).toBeCloseTo(expectedMplus);
    expect(result.mminusTU).toBeCloseTo(expectedMminus);
  });

  it("TO mode mminusTU includes training", () => {
    const result = computeModeDependentValues(makeCore(), "to");
    // mminusCh=50, mminusTr=8, mminusNet=80
    expect(result.mminusTU).toBeCloseTo(((50 + 8) / 80) * 100);
  });

  it("variance_hours_pct mplus and mminus use their own counts", () => {
    // mplusVarRateSum=4, mplusVarCount=1 → 4; mminusVarRateSum=6, mminusVarCount=1 → 6
    const result = computeModeDependentValues(makeCore(), "variance_hours_pct");
    expect(result.mplusTU).toBeCloseTo(4);
    expect(result.mminusTU).toBeCloseTo(6);
  });
});
