import { CATEGORY_THEME } from "../../constants/theme";
import { brand } from "../../../../config/brandConfig";

// ── Types ──

export interface EditableAssignment {
  tempId: string;
  originalKey: string | null;
  _uid?: string;
  empId: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  status: string;
  category: string;
  isDeleted: boolean;
  isNew: boolean;
  isModified: boolean;
  original: Record<string, any> | null;
}

export interface BulkSelection {
  groupKey: string;
  subRange?: { start: string; end: string };
}

export interface DisplayGroup {
  groupKey: string;
  items: EditableAssignment[];
  jobNo: string;
  jobName: string;
  category: string;
  periods: { startDate: string; endDate: string; utilization: number; status: string }[];
  startDate: string;
  endDate: string;
  isDeleted: boolean;
  isModified: boolean;
  hasNewItems: boolean;
  isEntirelyNew?: boolean;
  totalHours: number;
}

export interface BulkEditOperation {
  type: "create" | "edit" | "delete";
  data: Record<string, any>;
  originalKey?: string;
}

export type BulkEditAction =
  | { type: "UPDATE_FIELD"; tempId: string; field: string; value: any }
  | { type: "TOGGLE_DELETE"; tempId: string }
  | { type: "ADD_NEW"; data: Partial<EditableAssignment> }
  | { type: "SPLIT_DELETE"; tempId: string; start: string; end: string }
  | { type: "REDUCE_UTIL"; tempId: string; start: string; end: string; newUtil: number }
  | { type: "REDUCE_UTIL_MULTI"; tempId: string; zones: { start: string; end: string; newUtil: number }[] }
  | { type: "REDUCE_DAYS"; tempId: string; start: string; end: string; keepDays: number; holidays?: Set<string> }
  | { type: "RESET"; assignments: any[] }
  | { type: "RESTORE"; snapshot: EditableAssignment[] };

export interface LabelParts {
  account?: string;
  oppName?: string;
  name: string;
  jobNo: string;
  hours: string;
  days: string;
}

export type InsertMode = "fill_extend" | "fill_truncate" | "replace" | "fit_in" | "";

/** Unified create mode — replaces separate addMode + gapFillTarget */
export type CreateMode = {
  type: "new" | "gap_fill";
  range: { start: string; end: string } | null;
  /** Pre-filled job info (gap fill auto-populates from existing row) */
  jobNo?: string;
  jobName?: string;
  category?: string;
  groupKey?: string;
  utilization?: number;
} | null;

export type PendingActionInfo = {
  action: "" | "truncate" | "reduce_util" | "reduce_days" | "revert";
  reduceUtil: number;
  reduceDays: number;
} | null;

// ── Baseline + Action Log types ──

export interface BaselineSegment {
  _uid: string;
  empId: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  status: string;
  category: string;
  needId?: string;
  source?: "mds" | "staffing_need" | "manual";
}

export interface EditAction {
  actionId: string;
  groupKey: string;
  type: "create" | "delete" | "split_delete" | "reduce_util" | "reduce_days" | "reduce_util_multi" | "update_field";
  sourceUids: string[];
  produced: BaselineSegment[];
}

export interface EditorState {
  baseline: BaselineSegment[];
  actionLog: EditAction[];
  redoStack: EditAction[];
  current: BaselineSegment[];
}

export type EditorReducerAction =
  | { type: "INIT"; assignments: any[]; empId: string }
  | { type: "APPLY"; action: EditAction }
  | { type: "APPLY_BATCH"; actions: EditAction[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "UNDO_GROUP"; groupKey: string }
  | { type: "REDO_GROUP"; groupKey: string }
  | { type: "REVERT_GROUP"; groupKey: string }
  | { type: "REVERT_ALL" }
  | { type: "RESTORE_SNAPSHOT"; snapshot: EditorState };

// ── Shared bar styles ──

const GAP = 8;

export const barSx = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  px: 0,
  py: "6px",
  borderTop: "1px solid",
  borderColor: "divider",
  bgcolor: "#F3EFED",
};

export const barInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.7rem", height: 28, py: 0, bgcolor: "#fff", borderRadius: 1 },
  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
  "& input[type=number]": { MozAppearance: "textfield" },
  "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
};

export const barDatePickerSx = {
  width: 110,
  flexShrink: 0,
  "& .MuiInputBase-root": { fontSize: "0.7rem", height: 28, py: 0, bgcolor: "#fff", borderRadius: 1 },
  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
  "& .MuiInputAdornment-root": { ml: 0, mr: "2px" },
  "& .MuiIconButton-root": { p: 0, width: 22, height: 22 },
  "& .MuiIconButton-root .MuiSvgIcon-root": { fontSize: 13 },
} as const;

export const barDatePickerPopperSx = {
  "& .MuiPaper-root": {
    borderRadius: 2,
    boxShadow: "0 4px 20px rgba(128,102,89,0.15)",
    border: "none",
    overflow: "hidden",
  },
  "& .MuiPickersDay-root": {
    fontSize: "0.75rem",
    "&.Mui-selected": { bgcolor: brand.secondary, "&:hover": { bgcolor: brand.secondaryDark } },
    "&:hover": { bgcolor: "rgba(128,102,89,0.08)" },
  },
  "& .MuiPickersCalendarHeader-label": { fontSize: "0.8rem", color: brand.secondary, fontWeight: 600 },
  "& .MuiPickersArrowSwitcher-button": { color: brand.secondary },
  "& .MuiDayCalendar-weekDayLabel": { fontSize: "0.7rem", color: brand.secondaryLight },
  "& .MuiPickersDay-today:not(.Mui-selected)": { border: `1px solid ${brand.secondaryLightest}` },
} as const;

export const barBtnSx = {
  textTransform: "none",
  fontSize: "0.7rem",
  minWidth: 0,
  px: 1.25,
  height: 28,
  borderRadius: 1,
  lineHeight: 1,
  flexShrink: 0,
  border: "none",
  boxShadow: "none",
  "&:hover": { boxShadow: "none" },
} as const;

export const barBtnInactive = {
  ...barBtnSx,
  color: brand.secondary,
  bgcolor: "transparent",
  "&:hover": { bgcolor: "rgba(128,102,89,0.08)", boxShadow: "none" },
};

export const barBtnDanger = (active: boolean) =>
  active
    ? {
        ...barBtnSx,
        bgcolor: brand.primaryDark,
        color: "#fff",
        "&:hover": { bgcolor: brand.primaryDeep, boxShadow: "none" },
      }
    : {
        ...barBtnSx,
        color: brand.primaryDark,
        bgcolor: "transparent",
        "&:hover": { bgcolor: "rgba(204,41,49,0.06)", boxShadow: "none" },
      };

export const barBtnAccent = (active: boolean) =>
  active
    ? {
        ...barBtnSx,
        bgcolor: brand.secondary,
        color: "#fff",
        "&:hover": { bgcolor: brand.secondaryDark, boxShadow: "none" },
      }
    : {
        ...barBtnSx,
        color: brand.secondary,
        bgcolor: "transparent",
        "&:hover": { bgcolor: "rgba(128,102,89,0.08)", boxShadow: "none" },
      };

export const barLabel = { fontSize: "0.65rem", color: brand.secondaryLight, flexShrink: 0 };

export const BAR_GAP = GAP;

export const barDivider = { width: "1px", height: 20, bgcolor: brand.secondaryLightest, flexShrink: 0 };

export const zoneSx = {
  display: "flex",
  alignItems: "center",
  gap: `${GAP}px`,
  flexShrink: 0,
  px: `${GAP}px`,
} as const;

export const getBarColor = (cat: string) => CATEGORY_THEME[cat]?.hex || "#d1d5db";

/** Parse "YYYY-MM-DD" → Date (local midnight) */
export const parseLocalDate = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Date → "YYYY-MM-DD" */
export const toLocalDateStr = (d: Date | null): string => {
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Count working days (excl weekends) between two dates inclusive */
export function countWorkingDays(start: string, end: string, holidays?: Set<string>): number {
  let count = 0;
  const cursor = new Date(start);
  const endD = new Date(end);
  while (cursor <= endD) {
    const dow = cursor.getDay();
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (dow !== 0 && dow !== 6 && !(holidays && holidays.has(ds))) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
