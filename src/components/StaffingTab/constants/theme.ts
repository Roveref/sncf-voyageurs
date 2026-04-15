/**
 * Design tokens – single source of truth for the UI.
 *
 * Two palettes only:
 *   1. Utilization palette  → semantic colours for rates (0 → 200 %)
 *   2. Category palette     → muted colours for job-category badges / bars
 *
 * Every component should import from here instead of hard-coding colours.
 *
 * NOTE: All color values are hex/rgb strings compatible with MUI sx props.
 * The original Tailwind class names have been replaced with hex equivalents.
 */

import { utilizationColors, mainCatColors } from "../../../config/brandConfig";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface UtilizationToken {
  label: string;
  bg: string;
  text: string;
  bar: string;
  dot: string;
  hex: string;
}

export interface CategoryColor {
  bg: string;
  text: string;
  bar: string;
  border: string;
  hex: string;
}

export interface SkillTheme {
  bg: string;
  text: string;
  hex: string;
}

export interface SkillLevelTheme {
  bg: string;
  text: string;
  label: string;
  hex?: string;
}

export interface HeatmapStyle {
  backgroundColor: string;
}

// ---------------------------------------------------------------------------
// 1. Utilization palette  (rate → visual)
// ---------------------------------------------------------------------------

export const UTILIZATION: Record<string, UtilizationToken> = {
  available: {
    label: "Available",
    bg: utilizationColors.available.bg,
    text: utilizationColors.available.text,
    bar: utilizationColors.available.bar,
    dot: utilizationColors.available.dot,
    hex: utilizationColors.available.dot,
  },
  low: {
    label: "Underutilized",
    bg: utilizationColors.low.bg,
    text: utilizationColors.low.text,
    bar: utilizationColors.low.bar,
    dot: utilizationColors.low.dot,
    hex: utilizationColors.low.bar,
  },
  partial: {
    label: "Partially staffed",
    bg: utilizationColors.partial.bg,
    text: utilizationColors.partial.text,
    bar: utilizationColors.partial.bar,
    dot: utilizationColors.partial.dot,
    hex: utilizationColors.partial.bar,
  },
  optimal: {
    label: "Fully staffed",
    bg: utilizationColors.optimal.bg,
    text: utilizationColors.optimal.text,
    bar: utilizationColors.optimal.bar,
    dot: utilizationColors.optimal.dot,
    hex: utilizationColors.optimal.bar,
  },
  overbooked: {
    label: "Overloaded",
    bg: utilizationColors.overbooked.bg,
    text: utilizationColors.overbooked.text,
    bar: utilizationColors.overbooked.bar,
    dot: utilizationColors.overbooked.dot,
    hex: utilizationColors.overbooked.bar,
  },
};

/**
 * Map a utilization rate (0-200) to the matching token.
 */
export const getUtilizationToken = (rate: number): UtilizationToken => {
  if (rate === 0) return UTILIZATION.available;
  if (rate < 50) return UTILIZATION.low;
  if (rate < 80) return UTILIZATION.partial;
  if (rate <= 100) return UTILIZATION.optimal;
  return UTILIZATION.overbooked;
};

// ---------------------------------------------------------------------------
// 2. Category palette  (muted, consistent)
// ---------------------------------------------------------------------------

// Populated at hydration from var_config.category
export let CATEGORY_THEME: Record<string, CategoryColor> = {};

/** Apply category colors from applyCategoryConfig */
export function applyCategoryTheme(entries: Record<string, CategoryColor>): void {
  CATEGORY_THEME = { ...entries };
}

// ---------------------------------------------------------------------------
// 3. Grade utilization targets
// ---------------------------------------------------------------------------

// Mutable: overridden at hydration from var_config.grade.*.target
export let GRADE_TARGETS: Record<string, number> = {
  Analyst: 90,
  Consultant: 90,
  "Senior Consultant": 90,
  Manager: 75,
  "Senior Manager": 65,
  Director: 50,
  Partner: 25,
  Intern: 95,
};

export const getGradeTarget = (grade: string): number => GRADE_TARGETS[grade] ?? 90;

// Mutable: overridden at hydration from var_config.grade.*.family
export let M_MINUS_GRADES: string[] = ["Analyst", "Consultant", "Senior Consultant", "Intern"];
export let M_PLUS_GRADES: string[] = ["Manager", "Senior Manager", "Director", "Partner"];

/** Apply grade theme from var_config (called from applyGradeConfig) */
export function applyGradeTheme(entries: { name: string; target: number; family: string }[]): void {
  GRADE_TARGETS = Object.fromEntries(entries.map((e) => [e.name, e.target]));
  M_PLUS_GRADES = entries.filter((e) => e.family === "M+").map((e) => e.name);
  M_MINUS_GRADES = entries.filter((e) => e.family !== "M+").map((e) => e.name);
}

/** Format hours with day equivalent (1 day = 8h): "240h (30d)" */
export const fmtHD = (hours: number, hDec = 0): string => {
  const h = Number(hours);
  const dDec = hDec > 0 ? 1 : 0;
  return `${h.toFixed(hDec)}h (${(h / 8).toFixed(dDec)}d)`;
};

// ---------------------------------------------------------------------------
// 4. Heatmap color interpolation
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

/**
 * Grade-relative heatmap colouring — aligned with Dashboard UTILIZATION palette.
 *
 * Colour progression (cold → warm):
 *   amber (#f59e0b) → sky (#38bdf8) → blue (#3b82f6) → green (#10b981) → deep green (#059669)
 *   Red (#ef4444) is reserved for overbooked (>100 %).
 */
export const getHeatmapStyle = (
  rate: number | null | undefined,
  grade?: string,
  theoreticalTU?: number
): HeatmapStyle => {
  if (rate === null || rate === undefined) return { backgroundColor: "#ffffff" };

  if (grade) {
    if (rate === 0) return { backgroundColor: "rgba(239,68,68,0.25)" }; // bench (red, subtle)
    if (rate > 100) return { backgroundColor: UTILIZATION.overbooked.hex }; // #ef4444

    const target = getGradeTarget(grade);
    const rel = (rate / target) * 100;

    if (rate >= 100) return { backgroundColor: "#059669" }; // emerald-600 (perfect)
    if (rel >= 100) return { backgroundColor: UTILIZATION.optimal.hex }; // #10b981
    if (rel >= 80) return { backgroundColor: UTILIZATION.partial.hex }; // #3b82f6
    if (rel >= 50) return { backgroundColor: UTILIZATION.low.hex }; // #38bdf8
    return { backgroundColor: "#f59e0b" }; // amber-500 (needs attention)
  }

  if (rate === 0) return { backgroundColor: "rgba(239,68,68,0.25)" }; // bench (red, subtle)
  if (rate > 100) return { backgroundColor: UTILIZATION.overbooked.hex };

  const tuTheo = theoreticalTU ?? 100;
  const rel = (rate / tuTheo) * 100;

  if (rate >= 100) return { backgroundColor: "#059669" }; // emerald-600 (perfect)
  if (rel >= 100) return { backgroundColor: UTILIZATION.optimal.hex }; // #10b981
  if (rel >= 80) return { backgroundColor: UTILIZATION.partial.hex }; // #3b82f6
  if (rel >= 50) return { backgroundColor: UTILIZATION.low.hex }; // #38bdf8
  return { backgroundColor: "#f59e0b" };
};

// ---------------------------------------------------------------------------
// 4b. Availability (inverse) heatmap color interpolation
// ---------------------------------------------------------------------------

export const getAvailabilityStyle = (avail: number | null | undefined): HeatmapStyle => {
  if (avail === null || avail === undefined || avail <= 0) return { backgroundColor: "#f9fafb" };
  if (avail <= 40) {
    const t = avail / 40;
    return { backgroundColor: `rgb(${lerp(229, 153, t)},${lerp(245, 233, t)},${lerp(237, 218, t)})` };
  }
  if (avail <= 70) {
    const t = (avail - 40) / 30;
    return { backgroundColor: `rgb(${lerp(153, 52, t)},${lerp(233, 211, t)},${lerp(218, 153, t)})` };
  }
  const t = Math.min((avail - 70) / 30, 1);
  return { backgroundColor: `rgb(${lerp(52, 6, t)},${lerp(211, 95, t)},${lerp(153, 70, t)})` };
};

// ---------------------------------------------------------------------------
// 5. Sidebar & layout tokens (MUI-compatible)
// ---------------------------------------------------------------------------

export interface SidebarConfig {
  collapsedWidth: number;
  expandedWidth: number;
  bg: string;
  text: string;
  activeText: string;
  activeBg: string;
  hoverBg: string;
}

export const SIDEBAR: SidebarConfig = {
  collapsedWidth: 64,
  expandedWidth: 224,
  bg: "#111827", // gray-900
  text: "#d1d5db", // gray-300
  activeText: "#ffffff",
  activeBg: "#1f2937", // gray-800
  hoverBg: "#1f2937", // gray-800
};

// ---------------------------------------------------------------------------
// 6. Common component tokens (MUI sx-compatible)
// ---------------------------------------------------------------------------

export const CARD = {
  base: {
    bgcolor: "white",
    borderRadius: 3,
    border: "1px solid",
    borderColor: "#e5e7eb",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  header: { px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "#f3f4f6" },
  body: { px: 2.5, py: 2 },
} as const;

export const BADGE = {
  sm: { px: 1, py: 0.25, fontSize: "0.75rem", fontWeight: 500, borderRadius: "9999px" },
  md: { px: 1.25, py: 0.5, fontSize: "0.875rem", fontWeight: 500, borderRadius: "9999px" },
} as const;

// ---------------------------------------------------------------------------
// 7. Skill category colours (YourSkills integration)
// ---------------------------------------------------------------------------

export const SKILL_CATEGORY_THEME: Record<string, SkillTheme> = {
  Functional: { bg: "#eff6ff", text: "#1d4ed8", hex: "#3b82f6" },
  Technical: { bg: "#f5f3ff", text: "#6d28d9", hex: "#8b5cf6" },
  Software: { bg: "#ecfeff", text: "#0e7490", hex: "#06b6d4" },
  Industry: { bg: "#fffbeb", text: "#b45309", hex: "#f59e0b" },
  Methodology: { bg: "#ecfdf5", text: "#047857", hex: "#10b981" },
  Customer: { bg: "#fdf2f8", text: "#be185d", hex: "#ec4899" },
  Technology: { bg: "#eef2ff", text: "#4338ca", hex: "#6366f1" },
};

export const SKILL_LEVEL_THEME: Record<number, SkillLevelTheme> = {
  0: { bg: "#f3f4f6", text: "#6b7280", label: "Declared" },
  1: { bg: "#e0f2fe", text: "#0369a1", label: "Basic" },
  2: { bg: "#dbeafe", text: "#1d4ed8", label: "Intermediate" },
  3: { bg: "#e0e7ff", text: "#4338ca", label: "Advanced" },
  4: { bg: "#f3e8ff", text: "#6b21a8", label: "Expert" },
};
