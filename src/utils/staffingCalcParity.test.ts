/**
 * Parity tests: Frontend vs Backend staffing calculations.
 *
 * Replicates the frontend's exact calculation logic (from calcPrimitives.ts
 * and dataProcessing.ts) and compares with the backend's staffingCalc.ts
 * to verify they produce identical results.
 */

import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════
// FRONTEND LOGIC (exact copy from calcPrimitives.ts + dataProcessing.ts)
// ══════════════════════════════════════════════════════════════════════════════

const FE_CHARGEABLE_CATS = new Set(["chargeable", "pending", "overtime"]);
const FE_ABSENCE_CATS = new Set(["vacation", "rtt", "illness", "loa", "otherAbsence", "holiday"]);
const FE_GO_CATS = new Set(["generalOppty"]);
const FE_TRAINING_CATS = new Set(["training"]);

// Frontend capUtilizations (exact copy from calcPrimitives.ts)
function feCapUtilizations(raw: { absU: number; chU: number; goU: number; trU: number; otU?: number }) {
  const cappedAbsU = Math.min(raw.absU, 100);
  const netU = Math.max(0, 100 - cappedAbsU);
  const cappedChU = Math.min(raw.chU, netU);
  const cappedGoU = Math.min(raw.goU, Math.max(0, netU - cappedChU));
  const cappedTrU = Math.min(raw.trU, Math.max(0, netU - cappedChU - cappedGoU));
  const otU = raw.otU ?? 0;
  const cappedOtU = Math.min(otU, Math.max(0, netU - cappedChU - cappedGoU - cappedTrU));
  return { cappedAbsU, netU, cappedChU, cappedGoU, cappedTrU, cappedOtU };
}

// Frontend TU/TO formulas (exact copy from calcPrimitives.ts)
function feTuRate(chU: number, netU: number): number {
  return netU > 0 ? (chU / netU) * 100 : 100;
}
function feToRate(chU: number, goU: number, trU: number, netU: number): number {
  return netU > 0 ? ((chU + goU + trU) / netU) * 100 : 100;
}

// Frontend holiday check
function feGetEasterDate(year: number): Date {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4;
  const f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function feGenerateHolidays(year: number): string[] {
  const easter = feGetEasterDate(year);
  const addD = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtYMD = (y: number, m: number, dd: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return [
    fmtYMD(year, 1, 1),
    fmt(addD(easter, 1)),
    fmtYMD(year, 5, 1),
    fmtYMD(year, 5, 8),
    fmt(addD(easter, 39)),
    fmt(addD(easter, 50)),
    fmtYMD(year, 7, 14),
    fmtYMD(year, 8, 15),
    fmtYMD(year, 11, 1),
    fmtYMD(year, 11, 11),
    fmtYMD(year, 12, 25),
  ];
}
const FE_HOLIDAYS = new Set([...feGenerateHolidays(2025), ...feGenerateHolidays(2026), ...feGenerateHolidays(2027)]);

// Frontend computeDailyMetrics (simplified, chargeableCombined=true)
function feComputeMetrics(
  assignments: { category: string; startDate: string; endDate: string; utilization: number }[],
  periodStart: string,
  periodEnd: string,
  hpd: number,
  chargeableCombined: boolean = true
): {
  workDays: number;
  totalH: number;
  absH: number;
  holidayH: number;
  netH: number;
  chH: number;
  goH: number;
  trH: number;
  otH: number;
  dispoH: number;
  tu: number;
  to: number;
} {
  const s = new Date(periodStart + "T00:00:00");
  const e = new Date(periodEnd + "T00:00:00");

  let workDays = 0,
    absUtil = 0,
    holUtil = 0,
    chUtil = 0,
    goUtil = 0,
    trUtil = 0,
    otUtil = 0;

  for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) {
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    workDays++;

    const dtStr = dt.toISOString().slice(0, 10);
    if (FE_HOLIDAYS.has(dtStr)) {
      holUtil += 100;
      continue;
    }

    let dayAbs = 0,
      dayCh = 0,
      dayGo = 0,
      dayTr = 0,
      dayOt = 0;
    for (const a of assignments) {
      if (dtStr >= a.startDate && dtStr <= a.endDate) {
        const u = a.utilization;
        if (FE_ABSENCE_CATS.has(a.category)) dayAbs += u;
        else if (FE_CHARGEABLE_CATS.has(a.category)) dayCh += u;
        else if (FE_GO_CATS.has(a.category)) {
          if (chargeableCombined) dayCh += u;
          else dayGo += u;
        } else if (FE_TRAINING_CATS.has(a.category)) dayTr += u;
        else dayOt += u;
      }
    }

    const cap = feCapUtilizations({ absU: dayAbs, chU: dayCh, goU: dayGo, trU: dayTr, otU: dayOt });
    absUtil += dayAbs;
    chUtil += cap.cappedChU;
    goUtil += cap.cappedGoU;
    trUtil += cap.cappedTrU;
    otUtil += cap.cappedOtU;
  }

  const totalH = workDays * hpd;
  const absH = (absUtil * hpd) / 100;
  const holH = (holUtil * hpd) / 100;
  const netH = totalH - absH - holH;
  const chH = (chUtil * hpd) / 100;
  const goH = (goUtil * hpd) / 100;
  const trH = (trUtil * hpd) / 100;
  const otH = (otUtil * hpd) / 100;
  const dispoH = Math.max(0, netH - chH - goH - trH - otH);
  const tu = feTuRate(chH, netH);
  const to = feToRate(chH, goH, trH, netH);

  return { workDays, totalH, absH, holidayH: holH, netH, chH, goH, trH, otH, dispoH, tu, to };
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND LOGIC (exact copy from staffingCalc.ts)
// ══════════════════════════════════════════════════════════════════════════════

const BE_CHARGEABLE_CATS = new Set(["chargeable", "pending", "overtime"]);
const BE_ABSENCE_CATS = new Set(["vacation", "rtt", "illness", "loa", "otherAbsence", "holiday"]);
const BE_TRAINING_CATS = new Set(["training"]);
const BE_GO_CATS = new Set(["generalOppty"]);

// Backend holiday computation (exact copy)
function beGetEasterDate(year: number): Date {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4;
  const f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function beGenerateHolidays(year: number): string[] {
  const easter = beGetEasterDate(year);
  const addD = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtYMD = (y: number, m: number, dd: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return [
    fmtYMD(year, 1, 1),
    fmt(addD(easter, 1)),
    fmtYMD(year, 5, 1),
    fmtYMD(year, 5, 8),
    fmt(addD(easter, 39)),
    fmt(addD(easter, 50)),
    fmtYMD(year, 7, 14),
    fmtYMD(year, 8, 15),
    fmtYMD(year, 11, 1),
    fmtYMD(year, 11, 11),
    fmtYMD(year, 12, 25),
  ];
}
const BE_HOLIDAYS = new Set([...beGenerateHolidays(2025), ...beGenerateHolidays(2026), ...beGenerateHolidays(2027)]);

function beEachWorkday(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (d <= e) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const ds = d.toISOString().slice(0, 10);
      if (!BE_HOLIDAYS.has(ds)) days.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Backend computeEmployeeAvailability (exact copy, no DB deps)
function beComputeAvailability(
  assignments: { category: string; startDate: string; endDate: string; utilization: number }[],
  periodStart: string,
  periodEnd: string,
  hpd: number
): {
  workDays: number;
  totalH: number;
  absH: number;
  netH: number;
  chH: number;
  goH: number;
  trH: number;
  otH: number;
  availH: number;
  tuPct: number;
} {
  const workdays = beEachWorkday(periodStart, periodEnd);
  let totalH = 0,
    absH = 0,
    chH = 0,
    trH = 0,
    goH = 0,
    otH = 0;

  for (const day of workdays) {
    totalH += hpd;

    let absU = 0,
      chU = 0,
      trU = 0,
      goU = 0,
      otU = 0;
    for (const a of assignments) {
      if (day >= a.startDate && day <= a.endDate) {
        const u = a.utilization;
        if (BE_ABSENCE_CATS.has(a.category)) absU += u;
        else if (BE_CHARGEABLE_CATS.has(a.category)) chU += u;
        else if (BE_TRAINING_CATS.has(a.category)) trU += u;
        else if (BE_GO_CATS.has(a.category)) goU += u;
        else otU += u;
      }
    }

    const cappedAbs = Math.min(absU, 100);
    const netU = Math.max(0, 100 - cappedAbs);
    const cappedCh = Math.min(chU, netU);
    const cappedGo = Math.min(goU, Math.max(0, netU - cappedCh));
    const cappedTr = Math.min(trU, Math.max(0, netU - cappedCh - cappedGo));
    const cappedOt = Math.min(otU, Math.max(0, netU - cappedCh - cappedGo - cappedTr));

    absH += (cappedAbs * hpd) / 100;
    chH += (cappedCh * hpd) / 100;
    goH += (cappedGo * hpd) / 100;
    trH += (cappedTr * hpd) / 100;
    otH += (cappedOt * hpd) / 100;
  }

  const netH = totalH - absH;
  const availH = Math.max(0, netH - chH - goH - trH - otH);
  const tuPct = netH > 0 ? Math.round((chH / netH) * 1000) / 10 : 0;
  return { workDays: workdays.length, totalH, absH, netH, chH, goH, trH, otH, availH, tuPct };
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Holiday parity", () => {
  it("generates the same holidays for 2026", () => {
    const fe = feGenerateHolidays(2026).sort();
    const be = beGenerateHolidays(2026).sort();
    expect(be).toEqual(fe);
  });

  it("Easter 2026 matches", () => {
    const fe = feGetEasterDate(2026);
    const be = beGetEasterDate(2026);
    expect(be.toISOString().slice(0, 10)).toBe(fe.toISOString().slice(0, 10));
  });

  it("Easter 2025 matches", () => {
    const fe = feGetEasterDate(2025);
    const be = beGetEasterDate(2025);
    expect(be.toISOString().slice(0, 10)).toBe(fe.toISOString().slice(0, 10));
  });
});

describe("Workday counting parity", () => {
  it("January 2026: frontend and backend produce same net hours despite different workday counting", () => {
    const fe = feComputeMetrics([], "2026-01-01", "2026-01-31", 8);
    const be = beComputeAvailability([], "2026-01-01", "2026-01-31", 8);
    // Frontend counts holidays in workDays (22) then subtracts as holidayH
    // Backend excludes holidays from workDays (21) directly
    // workDays differ but netH must match:
    expect(fe.workDays).toBe(22); // frontend includes holiday in count
    expect(be.workDays).toBe(21); // backend excludes holiday from count
    expect(be.totalH).toBeCloseTo(fe.netH, 1); // same effective hours
  });

  it("May 2026: 3 holidays (1 May, 8 May, Ascension)", () => {
    const feWorkdays: string[] = [];
    const beWorkdays = beEachWorkday("2026-05-01", "2026-05-31");
    const d = new Date("2026-05-01T00:00:00");
    while (d <= new Date("2026-05-31T00:00:00")) {
      if (d.getDay() !== 0 && d.getDay() !== 6 && !FE_HOLIDAYS.has(d.toISOString().slice(0, 10))) {
        feWorkdays.push(d.toISOString().slice(0, 10));
      }
      d.setDate(d.getDate() + 1);
    }
    expect(beWorkdays).toEqual(feWorkdays);
  });
});

describe("Category classification parity", () => {
  it("CHARGEABLE_CATS match", () => {
    expect([...BE_CHARGEABLE_CATS].sort()).toEqual([...FE_CHARGEABLE_CATS].sort());
  });

  it("ABSENCE_CATS match", () => {
    expect([...BE_ABSENCE_CATS].sort()).toEqual([...FE_ABSENCE_CATS].sort());
  });

  it("GO_CATS match", () => {
    expect([...BE_GO_CATS].sort()).toEqual([...FE_GO_CATS].sort());
  });

  it("TRAINING_CATS match", () => {
    expect([...BE_TRAINING_CATS].sort()).toEqual([...FE_TRAINING_CATS].sort());
  });
});

describe("Capping parity", () => {
  it("simple 100% chargeable", () => {
    const raw = { absU: 0, chU: 100, goU: 0, trU: 0, otU: 0 };
    const fe = feCapUtilizations(raw);
    expect(fe.cappedChU).toBe(100);
    expect(fe.netU).toBe(100);
  });

  it("30% absence + 80% chargeable → ch capped to 70%", () => {
    const raw = { absU: 30, chU: 80, goU: 0, trU: 0, otU: 0 };
    const fe = feCapUtilizations(raw);
    expect(fe.cappedAbsU).toBe(30);
    expect(fe.netU).toBe(70);
    expect(fe.cappedChU).toBe(70);
  });

  it("overcapacity: 60% ch + 50% ch → capped to 100%", () => {
    const raw = { absU: 0, chU: 110, goU: 0, trU: 0, otU: 0 };
    const fe = feCapUtilizations(raw);
    expect(fe.cappedChU).toBe(100);
  });

  it("all categories competing", () => {
    const raw = { absU: 20, chU: 50, goU: 20, trU: 15, otU: 10 };
    const fe = feCapUtilizations(raw);
    expect(fe.cappedAbsU).toBe(20);
    expect(fe.netU).toBe(80);
    expect(fe.cappedChU).toBe(50);
    expect(fe.cappedGoU).toBe(20);
    expect(fe.cappedTrU).toBe(10); // only 10 left (80-50-20)
    expect(fe.cappedOtU).toBe(0); // nothing left
  });
});

describe("TU/TO formula parity", () => {
  it("TU = ch / net", () => {
    expect(feTuRate(80, 160)).toBeCloseTo(50);
  });

  it("TO = (ch + go + tr) / net — includes GO", () => {
    // Frontend: TO = (ch + go + tr) / net
    expect(feToRate(80, 20, 10, 160)).toBeCloseTo(68.75);
  });
});

describe("Full computation parity: chargeableCombined=false", () => {
  const assignments = [
    { category: "chargeable", startDate: "2026-03-02", endDate: "2026-03-31", utilization: 80 },
    { category: "generalOppty", startDate: "2026-03-02", endDate: "2026-03-31", utilization: 10 },
    { category: "training", startDate: "2026-03-16", endDate: "2026-03-20", utilization: 20 },
    { category: "vacation", startDate: "2026-03-09", endDate: "2026-03-13", utilization: 100 },
  ];
  const period = { start: "2026-03-01", end: "2026-03-31" };

  it("chH matches between frontend and backend", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, false);
    const be = beComputeAvailability(assignments, period.start, period.end, 8);
    expect(be.chH).toBeCloseTo(fe.chH, 1);
  });

  it("goH matches", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, false);
    const be = beComputeAvailability(assignments, period.start, period.end, 8);
    expect(be.goH).toBeCloseTo(fe.goH, 1);
  });

  it("trH matches", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, false);
    const be = beComputeAvailability(assignments, period.start, period.end, 8);
    expect(be.trH).toBeCloseTo(fe.trH, 1);
  });

  it("absH matches", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, false);
    const be = beComputeAvailability(assignments, period.start, period.end, 8);
    expect(be.absH).toBeCloseTo(fe.absH, 1);
  });

  // KEY DIFFERENCE: netH
  // Frontend: netH = totalH - absH - holidayH (holidays deducted from net)
  // Backend: netH = totalH - absH (holidays already excluded from workdays)
  // Both should give the same netH since backend doesn't count holidays in totalH
  it("netH matches (holidays handled differently but same result)", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, false);
    const be = beComputeAvailability(assignments, period.start, period.end, 8);
    expect(be.netH).toBeCloseTo(fe.netH, 1);
  });
});

describe("Full computation parity: chargeableCombined=true (frontend default)", () => {
  const assignments = [
    { category: "chargeable", startDate: "2026-06-01", endDate: "2026-06-30", utilization: 70 },
    { category: "generalOppty", startDate: "2026-06-01", endDate: "2026-06-30", utilization: 15 },
    { category: "training", startDate: "2026-06-15", endDate: "2026-06-19", utilization: 10 },
  ];
  const period = { start: "2026-06-01", end: "2026-06-30" };

  it("with chargeableCombined=true, frontend merges GO into ch for capping", () => {
    const fe = feComputeMetrics(assignments, period.start, period.end, 8, true);
    // With chargeableCombined: chU = 70 + 15 = 85, goU = 0 (merged into ch)
    // Without: chU = 70, goU = 15
    // This changes the capping results
    expect(fe.chH).toBeGreaterThan(0);
    expect(fe.goH).toBe(0); // GO merged into ch
  });

  it("backend now merges GO into ch — must match frontend chargeableCombined=true", () => {
    // Update backend to also merge GO into ch
    const beWithGoMerged = (function () {
      const workdays = beEachWorkday(period.start, period.end);
      let totalH = 0,
        chH = 0,
        trH = 0,
        otH = 0,
        absH = 0;
      const hpd = 8;
      for (const day of workdays) {
        totalH += hpd;
        let absU = 0,
          chU = 0,
          trU = 0,
          otU = 0;
        for (const a of assignments) {
          if (day >= a.startDate && day <= a.endDate) {
            if (BE_ABSENCE_CATS.has(a.category)) absU += a.utilization;
            else if (BE_CHARGEABLE_CATS.has(a.category)) chU += a.utilization;
            else if (BE_GO_CATS.has(a.category))
              chU += a.utilization; // GO merged into ch
            else if (BE_TRAINING_CATS.has(a.category)) trU += a.utilization;
            else otU += a.utilization;
          }
        }
        const cappedAbs = Math.min(absU, 100);
        const netU = Math.max(0, 100 - cappedAbs);
        const cappedCh = Math.min(chU, netU);
        const cappedTr = Math.min(trU, Math.max(0, netU - cappedCh));
        absH += (cappedAbs * hpd) / 100;
        chH += (cappedCh * hpd) / 100;
        trH += (cappedTr * hpd) / 100;
      }
      return { chH, trH, absH, totalH };
    })();

    const fe = feComputeMetrics(assignments, period.start, period.end, 8, true);
    expect(beWithGoMerged.chH).toBeCloseTo(fe.chH, 1);
  });
});

describe("HPD: Intern=7, others=8", () => {
  const assignments = [{ category: "chargeable", startDate: "2026-04-01", endDate: "2026-04-30", utilization: 100 }];

  it("Intern gets 7h/day", () => {
    const fe = feComputeMetrics(assignments, "2026-04-01", "2026-04-30", 7);
    const be = beComputeAvailability(assignments, "2026-04-01", "2026-04-30", 7);
    expect(be.totalH).toBe(fe.netH);
    expect(be.chH).toBeCloseTo(fe.chH, 1);
  });

  it("Consultant gets 8h/day", () => {
    const fe = feComputeMetrics(assignments, "2026-04-01", "2026-04-30", 8);
    const be = beComputeAvailability(assignments, "2026-04-01", "2026-04-30", 8);
    expect(be.totalH).toBe(fe.netH);
    expect(be.chH).toBeCloseTo(fe.chH, 1);
  });
});
