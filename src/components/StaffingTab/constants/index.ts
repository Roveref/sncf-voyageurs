import { getSegmentColor } from "../../Sidebars/segmentConstants";
import { gradeColors, brand } from "../../../config/brandConfig";
import { applyGradeTheme } from "./theme";

// ─── Main categories (top-level grouping) ────────────────────────────────────

export interface ColorScheme {
  bg: string;
  text: string;
  border: string;
}

export interface GradeColor extends ColorScheme {}

export interface SubTeamColor extends ColorScheme {
  hex: string;
}

export interface Holiday {
  id: string;
  date: string;
  label: string;
  year: number;
}

export interface TimeframeOffset {
  days?: number;
  months?: number;
}

export interface TimeframeConfigEntry {
  label: string;
  pastOffset: TimeframeOffset;
  futureOffset: TimeframeOffset;
  labelStep: string;
}

export const MAIN_CATEGORIES = {
  ABSENCE: "absence",
  CHARGEABLE: "chargeable",
  TRAINING: "training",
  RESERVATION: "reservation",
  NON_CHARGEABLE: "nonChargeable",
} as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[keyof typeof MAIN_CATEGORIES];

export const MAIN_CATEGORY_LABELS: Record<MainCategory, string> = {
  [MAIN_CATEGORIES.ABSENCE]: "Absence",
  [MAIN_CATEGORIES.CHARGEABLE]: "Chargeable",
  [MAIN_CATEGORIES.TRAINING]: "Training",
  [MAIN_CATEGORIES.RESERVATION]: "Reservation",
  [MAIN_CATEGORIES.NON_CHARGEABLE]: "Non-Billable",
};

// ─── Sub-categories (the actual category stored on each record) ──────────────
export const JOB_CATEGORIES = {
  // Absence sub-categories
  VACATION: "vacation",
  RTT: "rtt",
  LOA: "loa",
  ILLNESS: "illness",
  OTHER_ABSENCE: "otherAbsence",
  HOLIDAY: "holiday",
  // Chargeable sub-categories
  CHARGEABLE: "chargeable",
  GENERAL_OPPTY: "generalOppty",
  PENDING: "pending",
  OVERTIME: "overtime",
  TRAVEL: "travel",
  TRAVEL_WE: "travelWe",
  // Training sub-categories
  TRAINING: "training",
  // Reservation (standalone)
  RESERVATION: "reservation",
  // Non-chargeable sub-categories
  MEETING: "meeting",
  EVENT: "event",
  ADMIN: "admin",
  CORPORATE: "corporate",
  COMMUNITY: "community",
  BUSINESS_DEV: "businessDev",
  OTHER: "other",
  // Meta
  UNKNOWN: "unknown",
  // Legacy alias – existing code may still reference JOB_CATEGORIES.ABSENCE
  ABSENCE: "otherAbsence",
} as const;

export type JobCategory = (typeof JOB_CATEGORIES)[keyof typeof JOB_CATEGORIES];

// ─── Hierarchy: sub-category → main category ────────────────────────────────
// Populated at hydration from var_config.category
export const CATEGORY_HIERARCHY: Record<string, MainCategory> = {};

/** Look up main category for a sub-category */
export const getMainCategory = (subCategory: string): MainCategory =>
  CATEGORY_HIERARCHY[subCategory] || MAIN_CATEGORIES.NON_CHARGEABLE;

// ─── Canonical sets (single source of truth for TU/TO calculations) ──────────
// Populated at hydration from var_config.category
export const ABSENCE_CATS = new Set<string>();
export const CHARGEABLE_CATS = new Set<string>();
export const GO_CATS = new Set<string>();
export const TRAINING_CATS = new Set<string>();

// ─── Structured hierarchy for filters / UI ───────────────────────────────────
// Populated at hydration from var_config.category
export let CATEGORY_TREE: { main: string; label: string; subs: string[] }[] = [];

// ─── Labels ──────────────────────────────────────────────────────────────────
// Populated at hydration from var_config.category
export const CATEGORY_LABELS: Record<string, string> = {};

// ─── Category colours ───────────────────────────────────────────────────────
// Populated at hydration from var_config.category
import { CATEGORY_THEME, applyCategoryTheme, type CategoryColor } from "./theme";
export { CATEGORY_THEME };

export let CATEGORY_BADGE_COLORS: Record<string, string> = {};
export let CATEGORY_BAR_COLORS: Record<string, string> = {};
export let CATEGORY_COLORS: Record<string, ColorScheme> = {};

// ─── applyCategoryConfig — single entry point for all category data ──────────
import { updateJobCategoriesFromConfig } from "../../../utils/jobCategories";

export function applyCategoryConfig(config: Record<string, string>): void {
  // Clear all mutable structures
  for (const k of Object.keys(CATEGORY_HIERARCHY)) delete CATEGORY_HIERARCHY[k];
  for (const k of Object.keys(CATEGORY_LABELS)) delete CATEGORY_LABELS[k];
  ABSENCE_CATS.clear();
  CHARGEABLE_CATS.clear();
  GO_CATS.clear();
  TRAINING_CATS.clear();

  const themeEntries: Record<string, CategoryColor> = {};
  const jobCodes: Record<string, string> = {};
  const defaultColor: CategoryColor = {
    bg: "#f9fafb",
    text: "#6b7280",
    bar: "#d1d5db",
    border: "#e5e7eb",
    hex: "#d1d5db",
  };

  for (const [sub, raw] of Object.entries(config)) {
    try {
      const val = typeof raw === "string" ? JSON.parse(raw) : raw;
      const main = (val.main ?? "nonChargeable") as MainCategory;

      // Hierarchy + labels
      CATEGORY_HIERARCHY[sub] = main;
      CATEGORY_LABELS[sub] = val.label ?? sub;

      // Colors
      themeEntries[sub] = {
        bg: val.bg ?? defaultColor.bg,
        text: val.text ?? defaultColor.text,
        bar: val.bar ?? defaultColor.bar,
        border: val.border ?? defaultColor.border,
        hex: val.bar ?? defaultColor.hex,
      };

      // Job codes → SPECIAL_JOB_CODES
      if (Array.isArray(val.jobCodes)) {
        for (const code of val.jobCodes) jobCodes[String(code)] = sub;
      }
      // Route codes (e.g. 0800 → chargeable_route)
      if (Array.isArray(val.routeCodes)) {
        for (const code of val.routeCodes) jobCodes[String(code)] = `${sub}_route`;
      }

      // Canonical sets
      if (main === "absence") ABSENCE_CATS.add(sub);
      if (main === "chargeable" && sub !== "generalOppty") CHARGEABLE_CATS.add(sub);
      if (sub === "generalOppty") GO_CATS.add(sub);
      if (main === "training") TRAINING_CATS.add(sub);
    } catch {
      /* skip malformed */
    }
  }

  // Apply theme colors
  applyCategoryTheme(themeEntries);

  // Rebuild derived color maps
  CATEGORY_BADGE_COLORS = Object.fromEntries(Object.entries(themeEntries).map(([k, t]) => [k, `${t.bg} ${t.text}`]));
  CATEGORY_BAR_COLORS = Object.fromEntries(Object.entries(themeEntries).map(([k, t]) => [k, t.bar]));
  CATEGORY_COLORS = Object.fromEntries(
    Object.entries(themeEntries).map(([k, t]) => [k, { bg: t.bg, text: t.text, border: t.border }])
  );

  // Rebuild CATEGORY_TREE
  CATEGORY_TREE = Object.entries(MAIN_CATEGORY_LABELS)
    .map(([main, mainLabel]) => ({
      main,
      label: mainLabel,
      subs: Object.entries(CATEGORY_HIERARCHY)
        .filter(([sub, m]) => m === main && sub !== "unknown")
        .map(([sub]) => sub),
    }))
    .filter((g) => g.subs.length > 0);

  // Update job categories
  updateJobCategoriesFromConfig(jobCodes);
}

// ─── Dynamic French public holidays ─────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");
const fmtDate = (y: number, m: number, d: number): string => `${y}-${pad2(m)}-${pad2(d)}`;
const addDaysToDate = (date: Date, days: number): Date => {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
};

/**
 * Compute Easter Sunday for a given year (Anonymous Gregorian algorithm)
 */
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

/**
 * Generate French public holidays for a given year.
 * Returns array of { id, date, label, year } with date in YYYY-MM-DD format.
 */
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

/**
 * Generate holidays for years N-1, N, N+1 (relative to current year).
 */
export const generateAllHolidays = (): Holiday[] => {
  const currentYear = new Date().getFullYear();
  return [
    ...generateFrenchHolidays(currentYear - 1),
    ...generateFrenchHolidays(currentYear),
    ...generateFrenchHolidays(currentYear + 1),
  ];
};

// Pre-generated holidays for backward compat (used by isPublicHoliday)
export const FRENCH_PUBLIC_HOLIDAYS: Holiday[] = generateAllHolidays();

// Fast lookup set of all public holiday dates (YYYY-MM-DD)
// Initialized with computed holidays, overwritten by backend data when available
export const PUBLIC_HOLIDAY_DATES: Set<string> = new Set(FRENCH_PUBLIC_HOLIDAYS.map((h) => h.date));

/** Replace the computed holidays with backend-loaded holidays. */
export function updatePublicHolidays(dates: string[]): void {
  PUBLIC_HOLIDAY_DATES.clear();
  for (const d of dates) PUBLIC_HOLIDAY_DATES.add(d);
}

// Timeframe options
export const TIMEFRAME_OPTIONS = {
  WEEK: "week",
  MONTH: "month",
  QUARTER: "quarter",
  CUSTOM: "custom",
} as const;

// Timeframe configurations
export const TIMEFRAME_CONFIG: Record<string, TimeframeConfigEntry> = {
  [TIMEFRAME_OPTIONS.WEEK]: {
    label: "4 Weeks",
    pastOffset: { days: 7 },
    futureOffset: { days: 21 },
    labelStep: "day",
  },
  [TIMEFRAME_OPTIONS.MONTH]: {
    label: "3 Months",
    pastOffset: { months: 1 },
    futureOffset: { months: 2 },
    labelStep: "week",
  },
  [TIMEFRAME_OPTIONS.QUARTER]: {
    label: "9 Months",
    pastOffset: { months: 3 },
    futureOffset: { months: 6 },
    labelStep: "month",
  },
};

// Allowed file types for upload
export const ALLOWED_FILE_TYPES: string[] = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
];

// Max employees to display per page
export const MAX_EMPLOYEES_DISPLAY = 150;

// Short English month names (shared across HeatmapStrip, AggregateHeatmapStrip, TimelineHeader)
export const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Standard work hours per day
export const WORK_HOURS_PER_DAY = 8;

/** Hours per day by grade — mutable: overridden at hydration from var_config.grade.*.hoursPerDay */
let GRADE_HOURS_PER_DAY: Record<string, number> = { Intern: 7 };
export const getHoursPerDay = (grade?: string): number => (grade ? (GRADE_HOURS_PER_DAY[grade] ?? 8) : 8);

// Default grade for employees without skills data
export const UNKNOWN_GRADE = "No grade";

// BearingPoint corporate palette — aligned with booking charts (from brandConfig)
// Deterministic mapping per known grade; fallback for unknown grades
const BP_GRADE_COLORS: Record<string, GradeColor> = Object.fromEntries(
  Object.entries(gradeColors).map(([grade, c]) => [grade, { bg: c.bg, text: c.text, border: c.border }])
);
const BP_FALLBACK_PALETTE: GradeColor[] = [
  { bg: "#ffe4e6", text: "#c4232d", border: "#fca5ab" },
  { bg: "#f2edeb", text: "#6b554a", border: "#b8a89e" },
  { bg: "#f5f0ee", text: "#7a6b62", border: "#c4b5ad" },
  { bg: "#ede8e6", text: "#5C4A3F", border: "#a89890" },
  { bg: "#f5f2f0", text: "#8a7d75", border: "#ccc1bc" },
  { bg: "#f0ebe8", text: "#5e4d42", border: "#ad9c92" },
];
const UNKNOWN_GRADE_COLOR: GradeColor = { bg: "#f5f3f2", text: "#8a7d75", border: "#d6ccc5" };

export const getGradeColor = (grade: string): GradeColor => {
  if (!grade || grade === UNKNOWN_GRADE) return UNKNOWN_GRADE_COLOR;
  if (BP_GRADE_COLORS[grade]) return BP_GRADE_COLORS[grade];
  // Fallback for unknown grades — hash into BearingPoint palette
  let hash = 0;
  for (let i = 0; i < grade.length; i++) {
    hash = (hash << 5) - hash + grade.charCodeAt(i);
    hash = hash & hash;
  }
  return BP_FALLBACK_PALETTE[Math.abs(hash) % BP_FALLBACK_PALETTE.length];
};

// Hierarchical grade order: most senior = lowest index
// Mutable: overridden at hydration from var_config.grade
export let GRADE_ORDER: string[] = [
  "Partner",
  "Director",
  "Senior Manager",
  "Manager",
  "Senior Consultant",
  "Consultant",
  "Analyst",
  "Intern",
];

// Mutable: overridden at hydration from var_config.grade.*.abbr
export let GRADE_ABBR: Record<string, string> = {
  Partner: "P",
  Director: "Dir",
  "Senior Manager": "SM",
  Manager: "M",
  "Senior Consultant": "SC",
  Consultant: "C",
  Analyst: "A",
  Intern: "Int",
};

// ─── MDS Extract Start Date ─────────────────────────────────────────────────
// MDS extracts can only include employees present at extraction time.
// Data before this date is unreliable (partial coverage) and should be excluded.
// Mutable: overridden at hydration from var_config.appSetting.mdsExtractStart
export let MDS_EXTRACT_START = "2025-09-01";

/** Update MDS_EXTRACT_START from var_config */
export function updateMdsExtractStart(value: string): void {
  MDS_EXTRACT_START = value;
}

// ─── MAGR (SAP Activity Type) → Grade mapping ──────────────────────────────
// Populated at hydration from var_config.magrProfile
export let MAGR_TO_GRADE: Record<string, string> = {};

export const getGradeAbbr = (grade: string): string => GRADE_ABBR[grade] || grade;

/** Parsed grade entry from var_config */
export interface GradeConfigEntry {
  name: string;
  order: number;
  target: number;
  family: string;
  hoursPerDay: number;
  abbr: string;
  bg: string;
  text: string;
  border: string;
}

/** Parsed MAGR profile from var_config.magrProfile */
export interface MagrProfile {
  magrCode: string;
  grade: string;
  scr: number;
  rcAdvisory: number;
  rcImplementation: number;
  rcStrategy: number;
  advanced: boolean;
}

/** All MAGR profiles — mutable: built from var_config.magrProfile */
export let MAGR_PROFILES: MagrProfile[] = [];

/** Apply grade configuration from var_config (called at hydration) */
export function applyGradeConfig(config: Record<string, Record<string, string>>): void {
  if (config.grade) {
    const entries: GradeConfigEntry[] = [];
    for (const [name, raw] of Object.entries(config.grade)) {
      try {
        const val = typeof raw === "string" ? JSON.parse(raw) : raw;
        entries.push({
          name,
          order: val.order ?? 99,
          target: val.target ?? 90,
          family: val.family ?? "M-",
          hoursPerDay: val.hoursPerDay ?? 8,
          abbr: val.abbr ?? name.slice(0, 2),
          bg: val.bg ?? "",
          text: val.text ?? "",
          border: val.border ?? "",
        });
      } catch {
        /* skip malformed */
      }
    }
    if (entries.length > 0) {
      entries.sort((a, b) => b.order - a.order); // senior first (highest order = most senior)
      GRADE_ORDER = entries.map((e) => e.name);
      GRADE_ABBR = Object.fromEntries(entries.map((e) => [e.name, e.abbr]));
      GRADE_HOURS_PER_DAY = Object.fromEntries(
        entries.filter((e) => e.hoursPerDay !== 8).map((e) => [e.name, e.hoursPerDay])
      );

      // Update grade colors in brandConfig
      for (const e of entries) {
        if (e.bg && e.text && e.border) {
          gradeColors[e.name] = { bg: e.bg, text: e.text, border: e.border };
        }
      }

      // Update theme.ts grade targets & families
      applyGradeTheme(entries);
    }
  }

  // var_config.magrProfile: { "MAGR07": '{"grade":"Manager","scr":600,...}', ... }
  if (config.magrProfile) {
    const profiles: MagrProfile[] = [];
    const mapping: Record<string, string> = {};
    for (const [code, raw] of Object.entries(config.magrProfile)) {
      try {
        const val = typeof raw === "string" ? JSON.parse(raw) : raw;
        profiles.push({
          magrCode: code,
          grade: val.grade ?? "",
          scr: val.scr ?? 0,
          rcAdvisory: val.rcAdvisory ?? 0,
          rcImplementation: val.rcImplementation ?? 0,
          rcStrategy: val.rcStrategy ?? 0,
          advanced: val.advanced ?? false,
        });
        if (val.grade) mapping[code] = val.grade;
      } catch {
        /* skip malformed */
      }
    }
    MAGR_PROFILES = profiles;
    MAGR_TO_GRADE = mapping;
  }
}

const gradeIndex = (g: string): number => {
  const idx = GRADE_ORDER.indexOf(g);
  return idx >= 0 ? idx : GRADE_ORDER.length;
};

// sort(compareGrades) → most senior first, UNKNOWN_GRADE last
export const compareGrades = (a: string, b: string): number => {
  if (a === UNKNOWN_GRADE && b === UNKNOWN_GRADE) return 0;
  if (a === UNKNOWN_GRADE) return 1;
  if (b === UNKNOWN_GRADE) return -1;
  return gradeIndex(a) - gradeIndex(b);
};

// Boolean helper: true if grade a is strictly more senior than grade b
export const isMoreSenior = (a: string, b: string): boolean => gradeIndex(a) < gradeIndex(b);

// Sub-team colors — derives from segment colors dynamically
// Accepts any segment code, returns { bg, text, hex } with a light bg + dark text

const _segmentColorCache: Record<string, SubTeamColor> = {};
export const getSubTeamColor = (code: string): SubTeamColor => {
  if (_segmentColorCache[code]) return _segmentColorCache[code];
  const hex = getSegmentColor(code);
  const result = { bg: hex + "1A", text: hex, border: hex + "40", hex };
  _segmentColorCache[code] = result;
  return result;
};

// Legacy alias — used by components that reference SUB_TEAM_COLORS[name]
// Falls back to getSubTeamColor for any unknown key
export const SUB_TEAM_COLORS: Record<string, SubTeamColor> = new Proxy({} as Record<string, SubTeamColor>, {
  get: (target, key) => {
    if (typeof key !== "string") return undefined;
    return getSubTeamColor(key);
  },
});

// ─── Skills (YourSkills integration) ──────────────────────────────────────────

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

/** Width in pixels of the left (info) column in the Gantt timeline */
export const GANTT_LEFT_COL_WIDTH = 440;

/** Reduced left column width for tablet viewports */
export const GANTT_LEFT_COL_WIDTH_TABLET = 200;

/** Padding-right in pixels for the timeline area */
export const GANTT_RIGHT_PADDING = 12;

/** Milliseconds in one day */
export const MS_PER_DAY = 86_400_000;

/** Number of days within which to snap to assignment boundaries */
export const SNAP_DAYS = 7;

/** Standard work hours per day */
export const HOURS_PER_DAY = 8;

/** Height in pixels of assignment bars */
export const ASSIGNMENT_BAR_HEIGHT = 14;

// ─── Business-rule thresholds ────────────────────────────────────────────────

/** TU thresholds (Utilization Rate) — mutable: overridden at hydration from var_config.tuThreshold */
export let TU_LOW = 50;
export let TU_PARTIAL = 80;
export let TU_FULL = 100;

/** Update TU thresholds from var_config */
export function updateTuThresholds(cfg: Record<string, string>): void {
  if (cfg.tuLow != null) TU_LOW = Number(cfg.tuLow);
  if (cfg.tuPartial != null) TU_PARTIAL = Number(cfg.tuPartial);
  if (cfg.tuFull != null) TU_FULL = Number(cfg.tuFull);
}

/** Fragmentation score thresholds */
export const FRAG_WARN = 30;
export const FRAG_ALERT = 60;

/** TU Transition Loss thresholds (%) */
export const TL_WARN = 5;
export const TL_ALERT = 10;

/** SAP completion thresholds (%) */
export const SAP_WARN = 50;
export const SAP_GOOD = 90;
export const SAP_COMPLETE = 100;

/** Maximum file size for uploads (50 MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
