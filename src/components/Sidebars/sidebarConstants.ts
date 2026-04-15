import { M_PLUS_GRADES, M_MINUS_GRADES } from "../StaffingTab/constants/theme";
import { mainCatColors, macroGradeColors } from "../../config/brandConfig";

// Main category colors for category groups (from brandConfig)
export const MAIN_CAT_COLORS = { ...mainCatColors };

// Macro grade definitions for M+ / M- filter chips
export const MACRO_GRADES = [
  { key: "M+", label: "M+", color: macroGradeColors["M+"], grades: M_PLUS_GRADES },
  { key: "M-", label: "M-", color: macroGradeColors["M-"], grades: M_MINUS_GRADES },
];

// Macro category definitions for Chargeable / Non chargeable / Absence filter chips
export const MACRO_CATEGORIES = [
  { key: "chargeable", label: "Billable", color: MAIN_CAT_COLORS.chargeable },
  { key: "training", label: "Training", color: MAIN_CAT_COLORS.training },
  { key: "nonChargeable", label: "Non-Billable", color: MAIN_CAT_COLORS.nonChargeable },
  { key: "absence", label: "Absence", color: MAIN_CAT_COLORS.absence },
];

// ── Extracted static sx objects for .map() loops ──────────────────────────
export const SX_FLEX_ROW = { display: "flex", alignItems: "center", gap: 1 } as const;
export const SX_FLEX_ROW_GAP05 = { display: "flex", alignItems: "center", gap: 0.5 } as const;
export const SX_FLEX_COL_GAP025 = { display: "flex", flexDirection: "column", gap: 0.25 } as const;
export const SX_FLEX_COL_GAP05 = { pl: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 } as const;
export const SX_FLEX_COL_GAP15 = { display: "flex", flexDirection: "column", gap: 1.5 } as const;
export const SX_FLEX_ROW_FLEX1 = { display: "flex", alignItems: "center", gap: 1, flex: 1 } as const;
export const SX_WORD_WRAP = { wordWrap: "break-word", whiteSpace: "normal", flex: 1 } as const;
export const SX_FLEX1 = { flex: 1 } as const;
export const SX_EXPAND_BTN = {
  display: "flex",
  alignItems: "center",
  p: 0.25,
  borderRadius: 1,
  cursor: "pointer",
  ml: 0.5,
  flexShrink: 0,
  "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.1)" },
} as const;
export const SX_FLEX_GAP025 = { display: "flex", gap: 0.25 } as const;
export const SX_SECTION_HEADER = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  mb: 1,
} as const;
