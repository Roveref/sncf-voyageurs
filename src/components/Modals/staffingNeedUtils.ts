/**
 * staffingNeedUtils — Helpers for CreateStaffingNeedModal.
 * Date helpers, gantt range builders, and form constants.
 */

import { GRADE_ORDER, PUBLIC_HOLIDAY_DATES } from "../StaffingTab/constants";
import { M_PLUS_GRADES } from "../StaffingTab/constants/theme";
import { formatLocalDate } from "../StaffingTab/utils/dateUtils";

// ─── Grade mappings ─────────────────────────────────────────────────────────

/** Returns current valid grades (reflects dynamic GRADE_ORDER from var_config) */
export const getValidGrades = (): string[] => GRADE_ORDER;
export const getGradeIndex = (): Map<string, number> => new Map(GRADE_ORDER.map((g, i) => [g, i]));

/** Lazy — rebuilt each access so it reflects dynamic M_PLUS_GRADES from var_config */
export const getMPlusSet = (): Set<string> => new Set(M_PLUS_GRADES);

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface NeedItem {
  id: string;
  grade: string;
  startDate: string;
  endDate: string;
  skills: string[];
  utilization: number;
  preferredPerson?: string;
}

export interface EditForm {
  startDate: string;
  endDate: string;
  skills: string[];
  skillInput: string;
  utilization: number;
  preferredPerson: string;
}

export const emptyEditForm = (): EditForm => ({
  startDate: "",
  endDate: "",
  skills: [],
  skillInput: "",
  utilization: 100,
  preferredPerson: "",
});

// ─── ID generator ───────────────────────────────────────────────────────────

export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ─── Date helpers ───────────────────────────────────────────────────────────

export const nextMonday = (): Date => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 1 : day === 1 ? 7 : 8 - day));
  return d;
};

export const firstOfNextMonth = (): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d;
};

export const firstOfNextQuarter = (): Date => {
  const d = new Date();
  d.setMonth((Math.floor(d.getMonth() / 3) + 1) * 3, 1);
  return d;
};

export const endOfQuarter = (ref: string): Date => {
  const d = ref ? new Date(ref + "T00:00:00") : new Date();
  d.setFullYear(d.getFullYear(), (Math.floor(d.getMonth() / 3) + 1) * 3, 0);
  return d;
};

export const computeWorkingDays = (s: string, e: string): number => {
  if (!s || !e || e < s) return 0;
  const start = new Date(s + "T00:00:00"),
    end = new Date(e + "T00:00:00");
  let n = 0;
  const c = new Date(start);
  while (c <= end) {
    const d = c.getDay();
    if (d !== 0 && d !== 6 && !PUBLIC_HOLIDAY_DATES.has(formatLocalDate(c))) n++;
    c.setDate(c.getDate() + 1);
  }
  return n;
};

// ─── Gantt helpers ──────────────────────────────────────────────────────────

export const buildGanttRange = (needs: NeedItem[]) => {
  const valid = needs.filter((n) => n.startDate && n.endDate);
  if (!valid.length) return { minDate: "", maxDate: "", totalDays: 0 };
  let min = valid[0].startDate,
    max = valid[0].endDate;
  for (const n of valid) {
    if (n.startDate < min) min = n.startDate;
    if (n.endDate > max) max = n.endDate;
  }
  if (!min || !max) return { minDate: "", maxDate: "", totalDays: 0 };
  return {
    minDate: min,
    maxDate: max,
    totalDays:
      Math.round((new Date(max + "T00:00:00").getTime() - new Date(min + "T00:00:00").getTime()) / 86_400_000) + 1,
  };
};

export const buildMonthColumns = (minDate: string, maxDate: string, totalDays: number) => {
  if (!minDate || !maxDate || totalDays <= 0) return [];
  const start = new Date(minDate + "T00:00:00"),
    end = new Date(maxDate + "T00:00:00");
  const months: { label: string; widthPct: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear(),
      m = cursor.getMonth();
    const ms = new Date(y, m, 1),
      me = new Date(y, m + 1, 0);
    const vs = ms < start ? start : ms,
      ve = me > end ? end : me;
    const days = Math.round((ve.getTime() - vs.getTime()) / 86_400_000) + 1;
    months.push({
      label: vs.toLocaleDateString("fr-FR", { month: "short", year: totalDays > 180 ? "2-digit" : undefined }),
      widthPct: (days / totalDays) * 100,
    });
    cursor.setFullYear(y, m + 1, 1);
  }
  return months;
};

// ─── Shared styles ──────────────────────────────────────────────────────────

export const filledSx = {
  "& .MuiFilledInput-root": { borderRadius: 1, bgcolor: "action.hover", "&:before, &:after": { display: "none" } },
};
export const filledSmallSx = { ...filledSx, "& .MuiFilledInput-input": { fontSize: "0.78rem" } };

export const UTIL_PRESETS = [25, 50, 75, 100];

// ─── Timeline helpers (V2) ─────────────────────────────────────────────────

export interface DateClassified<T> {
  past: T[];
  current: T[];
  upcoming: T[];
}

/**
 * Classify items with startDate/endDate into past, current, and upcoming
 * relative to today.
 */
export const classifyByDate = <T extends { startDate: string; endDate: string }>(
  items: T[],
  todayStr: string
): DateClassified<T> => {
  const past: T[] = [];
  const current: T[] = [];
  const upcoming: T[] = [];
  for (const item of items) {
    if (!item.startDate || !item.endDate) continue;
    if (item.endDate < todayStr) past.push(item);
    else if (item.startDate <= todayStr) current.push(item);
    else upcoming.push(item);
  }
  return { past, current, upcoming };
};

/**
 * Build a unified gantt range from multiple date arrays.
 * Accepts any objects with startDate/endDate strings.
 */
export const buildUnifiedGanttRange = (
  ...groups: { startDate: string; endDate: string }[][]
): { minDate: string; maxDate: string; totalDays: number } => {
  let min = "";
  let max = "";
  for (const group of groups) {
    for (const item of group) {
      if (!item.startDate || !item.endDate) continue;
      if (!min || item.startDate < min) min = item.startDate;
      if (!max || item.endDate > max) max = item.endDate;
    }
  }
  if (!min || !max) return { minDate: "", maxDate: "", totalDays: 0 };
  return {
    minDate: min,
    maxDate: max,
    totalDays:
      Math.round((new Date(max + "T00:00:00").getTime() - new Date(min + "T00:00:00").getTime()) / 86_400_000) + 1,
  };
};
