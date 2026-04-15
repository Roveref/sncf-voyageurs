/**
 * Pure staffing constants — shared between frontend and backend.
 * No React, no browser APIs, no color/theme dependencies.
 */

// ─── Main categories ────────────────────────────────────────────────────────

export const MAIN_CATEGORIES = {
  ABSENCE: "absence",
  CHARGEABLE: "chargeable",
  TRAINING: "training",
  RESERVATION: "reservation",
  NON_CHARGEABLE: "nonChargeable",
} as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[keyof typeof MAIN_CATEGORIES];

// ─── Sub-categories ─────────────────────────────────────────────────────────

export const JOB_CATEGORIES = {
  VACATION: "vacation",
  RTT: "rtt",
  LOA: "loa",
  ILLNESS: "illness",
  OTHER_ABSENCE: "otherAbsence",
  HOLIDAY: "holiday",
  CHARGEABLE: "chargeable",
  GENERAL_OPPTY: "generalOppty",
  PENDING: "pending",
  OVERTIME: "overtime",
  TRAVEL: "travel",
  TRAVEL_WE: "travelWe",
  TRAINING: "training",
  RESERVATION: "reservation",
  MEETING: "meeting",
  EVENT: "event",
  ADMIN: "admin",
  CORPORATE: "corporate",
  COMMUNITY: "community",
  BUSINESS_DEV: "businessDev",
  OTHER: "other",
  UNKNOWN: "unknown",
  ABSENCE: "otherAbsence",
} as const;

export type JobCategory = (typeof JOB_CATEGORIES)[keyof typeof JOB_CATEGORIES];

// ─── Hierarchy: sub-category → main category ────────────────────────────────

export const CATEGORY_HIERARCHY: Record<string, MainCategory> = {
  [JOB_CATEGORIES.VACATION]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.RTT]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.LOA]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.ILLNESS]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.OTHER_ABSENCE]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.HOLIDAY]: MAIN_CATEGORIES.ABSENCE,
  [JOB_CATEGORIES.CHARGEABLE]: MAIN_CATEGORIES.CHARGEABLE,
  [JOB_CATEGORIES.GENERAL_OPPTY]: MAIN_CATEGORIES.CHARGEABLE,
  [JOB_CATEGORIES.PENDING]: MAIN_CATEGORIES.CHARGEABLE,
  [JOB_CATEGORIES.OVERTIME]: MAIN_CATEGORIES.CHARGEABLE,
  [JOB_CATEGORIES.TRAVEL]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.TRAVEL_WE]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.TRAINING]: MAIN_CATEGORIES.TRAINING,
  [JOB_CATEGORIES.RESERVATION]: MAIN_CATEGORIES.RESERVATION,
  [JOB_CATEGORIES.MEETING]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.EVENT]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.ADMIN]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.CORPORATE]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.COMMUNITY]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.BUSINESS_DEV]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.OTHER]: MAIN_CATEGORIES.NON_CHARGEABLE,
  [JOB_CATEGORIES.UNKNOWN]: MAIN_CATEGORIES.NON_CHARGEABLE,
};

export const getMainCategory = (subCategory: string): MainCategory =>
  CATEGORY_HIERARCHY[subCategory] || MAIN_CATEGORIES.NON_CHARGEABLE;

// ─── Canonical category sets (single source of truth for TU/TO) ─────────────

export const ABSENCE_CATS = new Set<string>([
  JOB_CATEGORIES.VACATION,
  JOB_CATEGORIES.RTT,
  JOB_CATEGORIES.LOA,
  JOB_CATEGORIES.ILLNESS,
  JOB_CATEGORIES.OTHER_ABSENCE,
  JOB_CATEGORIES.HOLIDAY,
]);

export const CHARGEABLE_CATS = new Set<string>([
  JOB_CATEGORIES.CHARGEABLE,
  JOB_CATEGORIES.PENDING,
  JOB_CATEGORIES.OVERTIME,
]);
export const GO_CATS = new Set<string>([JOB_CATEGORIES.GENERAL_OPPTY]);
export const TRAINING_CATS = new Set<string>([JOB_CATEGORIES.TRAINING]);

// ─── Labels ─────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  [JOB_CATEGORIES.VACATION]: "Vacation",
  [JOB_CATEGORIES.RTT]: "RTT",
  [JOB_CATEGORIES.LOA]: "LOA (Leave of Absence)",
  [JOB_CATEGORIES.ILLNESS]: "Sick Leave",
  [JOB_CATEGORIES.OTHER_ABSENCE]: "Other Absences",
  [JOB_CATEGORIES.HOLIDAY]: "Public Holiday",
  [JOB_CATEGORIES.CHARGEABLE]: "Chargeable",
  [JOB_CATEGORIES.GENERAL_OPPTY]: "General Oppty Code",
  [JOB_CATEGORIES.PENDING]: "Pending jobcode",
  [JOB_CATEGORIES.OVERTIME]: "Overtime",
  [JOB_CATEGORIES.TRAVEL]: "Travel",
  [JOB_CATEGORIES.TRAVEL_WE]: "Travel WE",
  [JOB_CATEGORIES.TRAINING]: "Training",
  [JOB_CATEGORIES.MEETING]: "Team Meeting",
  [JOB_CATEGORIES.EVENT]: "Event / Forum",
  [JOB_CATEGORIES.ADMIN]: "Administration",
  [JOB_CATEGORIES.CORPORATE]: "Corporate / Union",
  [JOB_CATEGORIES.COMMUNITY]: "Communities",
  [JOB_CATEGORIES.BUSINESS_DEV]: "Business Dev / Proposals",
  [JOB_CATEGORIES.RESERVATION]: "Reservation w/o jobcode",
  [JOB_CATEGORIES.OTHER]: "Other",
  [JOB_CATEGORIES.UNKNOWN]: "Unknown",
};

// ─── Grades ─────────────────────────────────────────────────────────────────

export const GRADE_ORDER: string[] = [
  "Partner",
  "Director",
  "Senior Manager",
  "Manager",
  "Senior Consultant",
  "Consultant",
  "Analyst",
  "Intern",
];

export const GRADE_ABBR: Record<string, string> = {
  Partner: "P",
  Director: "Dir",
  "Senior Manager": "SM",
  Manager: "M",
  "Senior Consultant": "SC",
  Consultant: "C",
  Analyst: "A",
  Intern: "Int",
};

export const getGradeAbbr = (grade: string): string => GRADE_ABBR[grade] || grade;

export const UNKNOWN_GRADE = "No grade";

const gradeIndex = (g: string): number => {
  const idx = GRADE_ORDER.indexOf(g);
  return idx >= 0 ? idx : GRADE_ORDER.length;
};

export const compareGrades = (a: string, b: string): number => {
  if (a === UNKNOWN_GRADE && b === UNKNOWN_GRADE) return 0;
  if (a === UNKNOWN_GRADE) return 1;
  if (b === UNKNOWN_GRADE) return -1;
  return gradeIndex(a) - gradeIndex(b);
};

export const isMoreSenior = (a: string, b: string): boolean => gradeIndex(a) < gradeIndex(b);

// ─── Work constants ─────────────────────────────────────────────────────────

export const WORK_HOURS_PER_DAY = 8;
export const getHoursPerDay = (grade?: string): number => (grade === "Intern" ? 7 : 8);
export const MS_PER_DAY = 86_400_000;

// ─── MAGR (SAP Activity Type) → Grade mapping ──────────────────────────────

// Mutable: overridden at server startup from var_config.magrProfile
// Populated at startup from var_config.magrProfile
export let MAGR_TO_GRADE: Record<string, string> = {};

/** Override MAGR_TO_GRADE from var_config rows */
export function updateMagrToGrade(mapping: Record<string, string>): void {
  MAGR_TO_GRADE = { ...mapping };
}

// ─── MDS Extract Start Date ─────────────────────────────────────────────────

export let MDS_EXTRACT_START = "2025-09-01";

export function updateMdsExtractStart(value: string): void {
  MDS_EXTRACT_START = value;
}

// ─── Public Holidays ────────────────────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");
const fmtDate = (y: number, m: number, d: number): string => `${y}-${pad2(m)}-${pad2(d)}`;
const addDaysToDate = (date: Date, days: number): Date => {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
};

export const getEasterDate = (year: number): Date => {
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
};

export interface Holiday {
  id: string;
  date: string;
  label: string;
  year: number;
}

export const generateFrenchHolidays = (year: number): Holiday[] => {
  const easter = getEasterDate(year);
  const lundiPaques = addDaysToDate(easter, 1);
  const ascension = addDaysToDate(easter, 39);
  const lundiPentecote = addDaysToDate(easter, 50);
  const fmtD = (d: Date): string => fmtDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return [
    { id: `${year}-01-01`, date: fmtDate(year, 1, 1), label: "New Year's Day", year },
    { id: `${year}-lundi-paques`, date: fmtD(lundiPaques), label: "Easter Monday", year },
    { id: `${year}-05-01`, date: fmtDate(year, 5, 1), label: "Labor Day", year },
    { id: `${year}-05-08`, date: fmtDate(year, 5, 8), label: "Victory Day", year },
    { id: `${year}-ascension`, date: fmtD(ascension), label: "Ascension Day", year },
    { id: `${year}-pentecote`, date: fmtD(lundiPentecote), label: "Whit Monday", year },
    { id: `${year}-07-14`, date: fmtDate(year, 7, 14), label: "National Day", year },
    { id: `${year}-08-15`, date: fmtDate(year, 8, 15), label: "Assumption Day", year },
    { id: `${year}-11-01`, date: fmtDate(year, 11, 1), label: "All Saints' Day", year },
    { id: `${year}-11-11`, date: fmtDate(year, 11, 11), label: "Armistice Day", year },
    { id: `${year}-12-25`, date: fmtDate(year, 12, 25), label: "Christmas", year },
  ];
};

export const generateAllHolidays = (): Holiday[] => {
  const currentYear = new Date().getFullYear();
  return [
    ...generateFrenchHolidays(currentYear - 1),
    ...generateFrenchHolidays(currentYear),
    ...generateFrenchHolidays(currentYear + 1),
  ];
};

export const FRENCH_PUBLIC_HOLIDAYS: Holiday[] = generateAllHolidays();
export const PUBLIC_HOLIDAY_DATES: Set<string> = new Set(FRENCH_PUBLIC_HOLIDAYS.map((h) => h.date));

export function updatePublicHolidays(dates: string[]): void {
  PUBLIC_HOLIDAY_DATES.clear();
  for (const d of dates) PUBLIC_HOLIDAY_DATES.add(d);
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = {
  FUNCTIONAL: "Functional",
  TECHNICAL: "Technical",
  SOFTWARE: "Software",
  INDUSTRY: "Industry",
  METHODOLOGY: "Methodology",
  CUSTOMER: "Customer",
  TECHNOLOGY: "Technology",
} as const;

export const SKILL_CATEGORY_ORDER: string[] = Object.values(SKILL_CATEGORIES);

export const SKILL_LEVELS = {
  DECLARED: 0,
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
} as const;

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  [SKILL_LEVELS.DECLARED]: "Declared",
  [SKILL_LEVELS.BASIC]: "Basic",
  [SKILL_LEVELS.INTERMEDIATE]: "Intermediate",
  [SKILL_LEVELS.ADVANCED]: "Advanced",
  [SKILL_LEVELS.EXPERT]: "Expert",
};
