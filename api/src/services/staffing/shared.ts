/**
 * Shared constants, types, helpers, and data loading for staffing calculations.
 *
 * Used by availability, candidates, kpis, opportunities, and impact sub-modules.
 */

import db from "../../db/database.js";

// ── Constants ──

export const HOURS_PER_DAY: Record<string, number> = { Intern: 7 };
export const DEFAULT_HPD = 8;
export const MS_PER_DAY = 86400000;

// ── Categories (aligned with frontend calcPrimitives.ts) ──
export const CHARGEABLE_CATS = new Set(["chargeable", "pending", "overtime"]);
export const ABSENCE_CATS = new Set(["vacation", "rtt", "illness", "loa", "otherAbsence", "holiday"]);
export const TRAINING_CATS = new Set(["training"]);
export const GO_CATS = new Set(["generalOppty"]);

// ── MDS extract start (aligned with frontend constants) ──
export let MDS_EXTRACT_START = "2025-09-01";
// Try to load from var_config if available
try {
  const row = db
    .prepare("SELECT value FROM var_config WHERE category = 'appSetting' AND key = 'mdsExtractStart'")
    .get() as any;
  if (row?.value) MDS_EXTRACT_START = row.value;
} catch {
  /* use default */
}

// ── French public holidays (aligned with frontend constants/index.ts) ──

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function generateFrenchHolidays(year: number): string[] {
  const easter = getEasterDate(year);
  const addD = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtYMD = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return [
    fmtYMD(year, 1, 1), // New Year
    fmt(addD(easter, 1)), // Easter Monday
    fmtYMD(year, 5, 1), // Labor Day
    fmtYMD(year, 5, 8), // Victory Day
    fmt(addD(easter, 39)), // Ascension
    fmt(addD(easter, 50)), // Whit Monday
    fmtYMD(year, 7, 14), // National Day
    fmtYMD(year, 8, 15), // Assumption
    fmtYMD(year, 11, 1), // All Saints
    fmtYMD(year, 11, 11), // Armistice
    fmtYMD(year, 12, 25), // Christmas
  ];
}

// Pre-compute holidays for year-1, year, year+1
const currentYear = new Date().getFullYear();
const PUBLIC_HOLIDAYS = new Set([
  ...generateFrenchHolidays(currentYear - 1),
  ...generateFrenchHolidays(currentYear),
  ...generateFrenchHolidays(currentYear + 1),
]);

export function isPublicHoliday(dateStr: string): boolean {
  return PUBLIC_HOLIDAYS.has(dateStr);
}

export const GRADE_ORDER = [
  "Partner",
  "Director",
  "Senior Manager",
  "Manager",
  "Senior Consultant",
  "Consultant",
  "Analyst",
  "Intern",
];
export const GRADE_TU_TARGET: Record<string, number> = {
  Partner: 25,
  Director: 50,
  "Senior Manager": 65,
  Manager: 75,
  "Senior Consultant": 90,
  Consultant: 90,
  Analyst: 90,
  Intern: 95,
};

export function hpd(grade: string): number {
  return HOURS_PER_DAY[grade] || DEFAULT_HPD;
}
export function gradeIndex(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i >= 0 ? i : 99;
}

// ── Date helpers ──

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function eachWorkday(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (d <= e) {
    if (!isWeekend(d)) {
      const ds = d.toISOString().slice(0, 10);
      if (!isPublicHoliday(ds)) days.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function countWorkdays(start: string, end: string): number {
  return eachWorkday(start, end).length;
}

export function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): string[] {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (s > e) return [];
  return eachWorkday(s, e);
}

// ── ETP & Grade transition types (aligned with frontend types.ts) ──

export interface EtpAdjustment {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
  ratio: number; // 0.0–1.0 (e.g. 0.5 = mi-temps)
}

export interface GradeTransition {
  grade: string;
  since: string; // ISO date YYYY-MM-DD
  until?: string; // ISO date YYYY-MM-DD
}

/** Get ETP ratio for an employee on a given date. Returns 1.0 if no adjustments. */
export function getEtpRatio(adjustments: EtpAdjustment[] | undefined, dateStr: string): number {
  if (!adjustments?.length) return 1.0;
  for (const adj of adjustments) {
    if (dateStr >= adj.startDate && dateStr <= adj.endDate) return adj.ratio;
  }
  return 1.0;
}

/** Resolve effective grade from grade history at a given date. */
export function getEffectiveGrade(history: GradeTransition[] | undefined, refDate: string): string | null {
  if (!history || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => (a.since || "").localeCompare(b.since || ""));
  let effective: string | null = sorted[0].grade;
  for (const t of sorted) {
    if (t.since && t.since <= refDate) effective = t.grade;
    else break;
  }
  return effective;
}

// ── Types ──

export interface EmployeeRow {
  empId: string;
  name: string;
  grade: string;
  subTeam: string;
  serviceLine: string;
  arrival: string | null;
  departure: string | null;
  gradeHistory?: GradeTransition[];
  etpAdjustments?: EtpAdjustment[];
}

export interface AssignmentRow {
  empId: string;
  jobNo: string;
  jobName: string;
  category: string;
  startDate: string;
  endDate: string;
  utilization: number;
  hoursPerDay: number;
}

export interface SkillRow {
  empId: string;
  name: string;
  level: number;
  category: string;
}

export interface AvailabilityResult {
  empId: string;
  name: string;
  grade: string;
  periodStart: string;
  periodEnd: string;
  workDays: number;
  totalHours: number;
  netHours: number;
  chargeableHours: number;
  absenceHours: number;
  trainingHours: number;
  goHours: number;
  availableHours: number;
  tuPct: number;
  availablePct: number;
  activeAssignments: { jobNo: string; jobName: string; utilization: number; overlapDays: number }[];
  /** Fragmentation score: 0 = mono-task, 100 = perfectly distributed across projects */
  fragScore: number;
  /** TU transition loss in percentage points */
  transitionLossPoints: number;
  /** ETP ratio applied (1.0 = full-time, <1.0 = part-time) */
  etpRatio?: number;
  /** Effective grade used (may differ from current grade if grade transitions exist) */
  effectiveGrade?: string;
}

export interface CandidateMatch {
  empId: string;
  name: string;
  grade: string;
  totalScore: number;
  gradeFit: number;
  dateOverlap: number;
  availabilityScore: number;
  skillsMatch: number;
  techBonus: number;
  serviceLineBonus: number;
  serviceLineMatch: boolean;
  scoreBreakdown: {
    gradeFit: number;
    dateOverlap: number;
    availability: number;
    skills: number;
    tech: number;
    serviceLine: number;
  };
  gradeDist: number;
  dispoCoveragePct: number;
  skillsMatchPct: number;
  availableHours: number;
  availablePct: number;
  tuPct: number;
  matchedSkills: string[];
  matchedTechPartners: string[];
  activeAssignments: string[];
  /** Date à partir de laquelle la personne est dispo (si après le début du besoin) */
  availableFrom: string | null;
  /** Décalage en jours ouvrés par rapport au début du besoin (0 = dispo immédiatement) */
  delayDays: number;
  /** Fragmentation score (0 = focused, 100 = scattered) */
  fragScore: number;
  /** TU transition loss in percentage points */
  transitionLossPoints: number;
  /** Effective grade at need start date (may differ from current grade) */
  effectiveGrade?: string;
  /** Scoring mode used (standard/urgent/technical) */
  scoringMode?: string;
  /** Bonus for past work on same client account */
  clientBonus?: number;
  /** Malus for overloaded employee (TU > 100%) */
  overloadMalus?: number;
}

export interface TeamKPIs {
  employeeCount: number;
  totalNetHours: number;
  totalChargeableHours: number;
  totalAbsenceHours: number;
  totalTrainingHours: number;
  tuPct: number;
  toPct: number;
  benchPct: number;
  byGrade: { grade: string; count: number; tuPct: number; target: number }[];
}

export interface ImpactResult {
  scenario: string;
  pipelineImpact: { lostRevenue: number; remainingRevenue: number; lostOpps: number; remainingOpps: number };
  staffingImpact: { freedEmployees: string[]; tuBefore: number; tuAfter: number; tuDelta: number };
}

// ── Data loading with TTL cache (5 seconds) ──

let _empCache: { data: EmployeeRow[]; ts: number } | null = null;
let _assCache: { data: AssignmentRow[]; ts: number } | null = null;
let _skillCache: { data: SkillRow[]; ts: number } | null = null;
const EMP_CACHE_TTL = 30000; // 30s — employee data rarely changes
const ASS_CACHE_TTL = 10000; // 10s — assignments change on MDS import
const SKILL_CACHE_TTL = 60000; // 60s — skills very rarely change

export function loadEmployees(): EmployeeRow[] {
  if (_empCache && Date.now() - _empCache.ts < EMP_CACHE_TTL) return _empCache.data;
  const rows = db
    .prepare(
      "SELECT empId, name, grade, subTeam, serviceLine, arrivalDate AS arrival, departureDate AS departure, gradeHistory FROM employees"
    )
    .all() as any[];

  // Load ETP adjustments and manual gradeHistory from user_overrides (EAV)
  const overrides = new Map<string, { etp?: EtpAdjustment[]; gradeHistory?: GradeTransition[] }>();
  try {
    const oRows = db
      .prepare(
        "SELECT entityId, field, newValue FROM user_overrides WHERE entityType = 'employee' AND field IN ('etp_adjustments', 'gradeHistory')"
      )
      .all() as any[];
    for (const o of oRows) {
      if (!overrides.has(o.entityId)) overrides.set(o.entityId, {});
      const entry = overrides.get(o.entityId)!;
      if (o.field === "etp_adjustments")
        try {
          entry.etp = JSON.parse(o.newValue);
        } catch {
          /* */
        }
      if (o.field === "gradeHistory")
        try {
          entry.gradeHistory = JSON.parse(o.newValue);
        } catch {
          /* */
        }
    }
  } catch {
    /* table may not exist in old schemas */
  }

  const data: EmployeeRow[] = rows.map((r) => {
    const ov = overrides.get(r.empId);
    let gradeHistory: GradeTransition[] | undefined;
    // Prefer override gradeHistory, fallback to employees table
    if (ov?.gradeHistory?.length) gradeHistory = ov.gradeHistory;
    else if (r.gradeHistory)
      try {
        gradeHistory = JSON.parse(r.gradeHistory);
      } catch {
        /* */
      }

    return {
      empId: r.empId,
      name: r.name,
      grade: r.grade,
      subTeam: r.subTeam,
      serviceLine: r.serviceLine,
      arrival: r.arrival,
      departure: r.departure,
      gradeHistory: gradeHistory,
      etpAdjustments: ov?.etp,
    };
  });
  _empCache = { data, ts: Date.now() };
  return data;
}

export function loadAssignments(): AssignmentRow[] {
  if (_assCache && Date.now() - _assCache.ts < ASS_CACHE_TTL) return _assCache.data;
  const data = db
    .prepare(
      "SELECT empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay FROM mds_assignments"
    )
    .all() as AssignmentRow[];
  _assCache = { data, ts: Date.now() };
  return data;
}

export function loadSkills(): SkillRow[] {
  if (_skillCache && Date.now() - _skillCache.ts < SKILL_CACHE_TTL) return _skillCache.data;
  const data = db.prepare("SELECT empId, name, level, category FROM hr_skills").all() as SkillRow[];
  _skillCache = { data, ts: Date.now() };
  return data;
}

export function indexByEmpId<T extends { empId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const arr = map.get(row.empId);
    if (arr) arr.push(row);
    else map.set(row.empId, [row]);
  }
  return map;
}

function loadSapDatesByEmployee(): Map<string, Set<string>> {
  const rows = db.prepare("SELECT DISTINCT empId, date FROM sap_records").all() as { empId: string; date: string }[];
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    let s = map.get(r.empId);
    if (!s) {
      s = new Set();
      map.set(r.empId, s);
    }
    s.add(r.date);
  }
  return map;
}

let _sapDatesCache: { data: Map<string, Set<string>>; ts: number } | null = null;

export function getSapDatesIndex(): Map<string, Set<string>> {
  if (_sapDatesCache && Date.now() - _sapDatesCache.ts < ASS_CACHE_TTL) return _sapDatesCache.data;
  const data = loadSapDatesByEmployee();
  _sapDatesCache = { data, ts: Date.now() };
  return data;
}

/** Invalidate all in-memory caches. Call when switching between real/demo DB. */
export function clearStaffingCaches(): void {
  _empCache = null;
  _assCache = null;
  _skillCache = null;
  _sapDatesCache = null;
}

// ── Transition loss (aligned with frontend dailyGridBuilder.ts::computeTransitionLoss) ──

/**
 * Compute TU transition loss: sum of shortfalls when TU dips below neighboring non-absence days.
 * Returns total shortfall in utilization-units (divide by netH to get percentage points).
 */
function computeTransitionLoss(dailyChRates: number[], dailyIsAbsence: boolean[]): number {
  const len = dailyChRates.length;
  if (len === 0) return 0;

  const prevNonAbsRate = new Array(len).fill(-1);
  const nextNonAbsRate = new Array(len).fill(-1);

  let lastRate = -1;
  for (let i = 0; i < len; i++) {
    if (!dailyIsAbsence[i]) lastRate = dailyChRates[i];
    prevNonAbsRate[i] = lastRate;
  }
  lastRate = -1;
  for (let i = len - 1; i >= 0; i--) {
    if (!dailyIsAbsence[i]) lastRate = dailyChRates[i];
    nextNonAbsRate[i] = lastRate;
  }

  let totalShortfall = 0;
  for (let i = 0; i < len; i++) {
    if (dailyIsAbsence[i]) continue;
    const prev = i > 0 ? prevNonAbsRate[i - 1] : -1;
    const next = i < len - 1 ? nextNonAbsRate[i + 1] : -1;
    const neighborMax = Math.max(prev, next);
    if (neighborMax > dailyChRates[i]) {
      totalShortfall += neighborMax - dailyChRates[i];
    }
  }
  return totalShortfall;
}

// ── Core: compute daily utilization for one employee ──

export function computeEmployeeAvailability(
  emp: EmployeeRow,
  empAssignments: AssignmentRow[], // already filtered for this employee
  periodStart: string,
  periodEnd: string,
  sapDates?: Set<string>
): AvailabilityResult {
  const baseH = hpd(emp.grade);
  const workdays = eachWorkday(periodStart, periodEnd);
  const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM" for forced absence check

  let totalH = 0,
    absH = 0,
    chH = 0,
    trH = 0,
    goH = 0,
    otH = 0;

  // Fragmentation & transition loss accumulators
  const dailyChRates: number[] = [];
  const dailyIsAbsence: boolean[] = [];
  let fragSum = 0,
    fragDays = 0;

  for (const day of workdays) {
    // Check employee presence
    if (emp.arrival && day < emp.arrival) continue;
    if (emp.departure && day > emp.departure) continue;

    // Apply ETP ratio for part-time employees (aligned with frontend getEtpRatio)
    const etpRatio = getEtpRatio(emp.etpAdjustments, day);
    // Use effective grade for HPD if grade transitions exist
    const effectiveGrade = getEffectiveGrade(emp.gradeHistory, day) || emp.grade;
    const h = hpd(effectiveGrade) * etpRatio;

    totalH += h;

    // Forced absence: past completed month with SAP data elsewhere but no SAP entry this day
    if (sapDates && sapDates.size > 0 && day.slice(0, 7) < currentMonthStr && !sapDates.has(day)) {
      absH += h;
      dailyChRates.push(0);
      dailyIsAbsence.push(true);
      continue;
    }

    // Sum utilizations by category for this day
    // chargeableCombined=true (frontend default): GO merges into chargeable for capping
    let absU = 0,
      chU = 0,
      trU = 0,
      goU = 0,
      otU = 0;

    for (const a of empAssignments) {
      if (day >= a.startDate && day <= a.endDate) {
        const u = a.utilization || 0;
        if (ABSENCE_CATS.has(a.category)) absU += u;
        else if (CHARGEABLE_CATS.has(a.category)) chU += u;
        else if (GO_CATS.has(a.category))
          chU += u; // GO merged into ch (chargeableCombined=true)
        else if (TRAINING_CATS.has(a.category)) trU += u;
        else otU += u;
      }
    }

    // Cap (priority: abs → ch → go → tr → ot) — matches frontend capUtilizations()
    const cappedAbs = Math.min(absU, 100);
    const netU = Math.max(0, 100 - cappedAbs);
    const cappedCh = Math.min(chU, netU);
    const cappedGo = Math.min(goU, Math.max(0, netU - cappedCh));
    const cappedTr = Math.min(trU, Math.max(0, netU - cappedCh - cappedGo));
    const cappedOt = Math.min(otU, Math.max(0, netU - cappedCh - cappedGo - cappedTr));

    absH += (cappedAbs * h) / 100;
    chH += (cappedCh * h) / 100;
    goH += (cappedGo * h) / 100;
    trH += (cappedTr * h) / 100;
    otH += (cappedOt * h) / 100;

    // Track fragmentation (HHI) — aligned with frontend accumulateFragmentation
    const workUtils: number[] = [];
    for (const a of empAssignments) {
      if (day >= a.startDate && day <= a.endDate && !ABSENCE_CATS.has(a.category)) {
        workUtils.push(a.utilization || 0);
      }
    }
    if (workUtils.length > 1) {
      const totalWork = workUtils.reduce((a, b) => a + b, 0);
      if (totalWork > 0) {
        const hhi = workUtils.reduce((acc, u) => acc + (u / totalWork) ** 2, 0);
        fragSum += 1 - hhi;
        fragDays++;
      }
    } else if (workUtils.length === 1) {
      fragDays++;
    }

    // Track daily chargeable rate for transition loss
    const isAbsDay = cappedAbs >= 100;
    dailyChRates.push(netU > 0 ? (cappedCh / netU) * 100 : 0);
    dailyIsAbsence.push(isAbsDay);
  }

  const netH = totalH - absH;
  const availH = Math.max(0, netH - chH - goH - trH - otH);
  const tuPct = netH > 0 ? Math.round((chH / netH) * 1000) / 10 : 0;
  const availPct = netH > 0 ? Math.round((availH / netH) * 1000) / 10 : 0;

  // Compute fragmentation score (0 = mono-task, 100 = perfectly distributed)
  const fragScore = fragDays > 0 ? Math.round((fragSum / fragDays) * 1000) / 10 : 0;

  // Compute transition loss (aligned with frontend computeTransitionLoss)
  const transitionLoss = computeTransitionLoss(dailyChRates, dailyIsAbsence);
  const transitionLossPoints = netH > 0 ? Math.round((transitionLoss / netH) * 1000) / 10 : 0;

  // Active assignments in the period
  const active = empAssignments
    .filter((a) => a.endDate >= periodStart && a.startDate <= periodEnd && CHARGEABLE_CATS.has(a.category))
    .map((a) => ({
      jobNo: a.jobNo,
      jobName: a.jobName,
      utilization: a.utilization,
      overlapDays: overlapDays(a.startDate, a.endDate, periodStart, periodEnd).length,
    }));

  return {
    empId: emp.empId,
    name: emp.name,
    grade: emp.grade,
    periodStart,
    periodEnd,
    workDays: workdays.length,
    totalHours: Math.round(totalH * 10) / 10,
    netHours: Math.round(netH * 10) / 10,
    chargeableHours: Math.round(chH * 10) / 10,
    absenceHours: Math.round(absH * 10) / 10,
    trainingHours: Math.round(trH * 10) / 10,
    goHours: Math.round(goH * 10) / 10,
    availableHours: Math.round(availH * 10) / 10,
    tuPct,
    availablePct: availPct,
    activeAssignments: active,
    fragScore,
    transitionLossPoints,
    etpRatio: emp.etpAdjustments?.length ? getEtpRatio(emp.etpAdjustments, periodStart) : undefined,
    effectiveGrade: getEffectiveGrade(emp.gradeHistory, periodStart) || undefined,
  };
}

// ── SAP data helpers ──

export interface SapDayRow {
  empId: string;
  date: string;
  hours: number;
  category: string;
  activityType: string;
  absenceType: string | null;
}

export function loadSapForPeriod(periodStart: string, periodEnd: string, empId?: string): SapDayRow[] {
  if (empId) {
    return db
      .prepare(
        "SELECT empId, date, hours, category, activityType, absenceType FROM sap_records WHERE empId = ? AND date >= ? AND date <= ?"
      )
      .all(empId, periodStart, periodEnd) as SapDayRow[];
  }
  return db
    .prepare(
      "SELECT empId, date, hours, category, activityType, absenceType FROM sap_records WHERE date >= ? AND date <= ?"
    )
    .all(periodStart, periodEnd) as SapDayRow[];
}

export function aggregateSapHours(
  records: SapDayRow[],
  grade: string,
  periodStart: string,
  periodEnd: string
): { chH: number; absH: number; trH: number; goH: number; otherH: number; totalH: number; days: number } {
  // Use the same workday grid as MDS to ensure identical day count
  const workdays = eachWorkday(periodStart, periodEnd);
  const h = hpd(grade);

  // Index SAP records by date for O(1) lookup
  const byDate = new Map<string, SapDayRow[]>();
  for (const r of records) {
    const arr = byDate.get(r.date);
    if (arr) arr.push(r);
    else byDate.set(r.date, [r]);
  }

  let chH = 0,
    absH = 0,
    trH = 0,
    goH = 0,
    otherH = 0,
    totalH = 0;
  let daysWithSap = 0;

  for (const day of workdays) {
    const dayRecords = byDate.get(day);
    if (!dayRecords) continue;

    daysWithSap++;
    totalH += h;

    // Convert SAP hours to utilization % (matching frontend segment.util)
    let absU = 0,
      chU = 0,
      trU = 0,
      goU = 0,
      otU = 0;
    for (const r of dayRecords) {
      const u = h > 0 ? (r.hours / h) * 100 : 0;
      if (ABSENCE_CATS.has(r.category)) absU += u;
      else if (CHARGEABLE_CATS.has(r.category)) chU += u;
      else if (GO_CATS.has(r.category))
        chU += u; // GO merged into ch (chargeableCombined=true)
      else if (TRAINING_CATS.has(r.category)) trU += u;
      else otU += u;
    }

    // Cap with same priority as frontend: abs → ch → go → tr → ot
    const cappedAbs = Math.min(absU, 100);
    const netU = Math.max(0, 100 - cappedAbs);
    const cappedCh = Math.min(chU, netU);
    const cappedGo = Math.min(goU, Math.max(0, netU - cappedCh));
    const cappedTr = Math.min(trU, Math.max(0, netU - cappedCh - cappedGo));
    const cappedOt = Math.min(otU, Math.max(0, netU - cappedCh - cappedGo - cappedTr));

    // Convert back to hours
    absH += (cappedAbs * h) / 100;
    chH += (cappedCh * h) / 100;
    goH += (cappedGo * h) / 100;
    trH += (cappedTr * h) / 100;
    otherH += (cappedOt * h) / 100;
  }

  return {
    chH: Math.round(chH * 10) / 10,
    absH: Math.round(absH * 10) / 10,
    trH: Math.round(trH * 10) / 10,
    goH: Math.round(goH * 10) / 10,
    otherH: Math.round(otherH * 10) / 10,
    totalH: Math.round(totalH * 10) / 10,
    days: daysWithSap,
  };
}

// ── Month splitting helper (used by kpis and opportunities) ──

export function splitIntoMonths(start: string, end: string): { start: string; end: string; label: string }[] {
  const months: { start: string; end: string; label: string }[] = [];
  const d = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (d < endDate) {
    const monthStart = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    const monthEnd = d > endDate ? end : d.toISOString().slice(0, 10);
    months.push({ start: monthStart, end: monthEnd, label });
  }
  return months;
}
