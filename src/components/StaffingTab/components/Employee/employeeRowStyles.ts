/**
 * Shared sx style constants for EmployeeRow and related components.
 * Extracted to avoid re-creation on each render and reduce file size.
 */

import { GANTT_LEFT_COL_WIDTH } from "../../constants";

export const LEFT_COL = GANTT_LEFT_COL_WIDTH;

export const SX_FLEX_CENTER = { display: "flex", alignItems: "center" } as const;
export const SX_FLEX_CENTER_GAP05 = { display: "flex", alignItems: "center", gap: 0.5 } as const;
export const SX_LEFT_COL_PAD = { flexShrink: 0, px: 1.5, py: 1 } as const;
export const SX_BADGE_BASE = { fontSize: "9px", fontWeight: 700, px: 0.5, borderRadius: 1, flexShrink: 0 } as const;
export const SX_GRADE_CHIP_BASE = {
  height: 18,
  fontSize: "0.6rem",
  fontWeight: 700,
  "& .MuiChip-label": { px: 0.5 },
} as const;
export const SX_TEAM_CHIP = {
  height: 18,
  fontSize: "0.6rem",
  fontWeight: 500,
  bgcolor: "grey.100",
  color: "text.secondary",
  "& .MuiChip-label": { px: 0.5 },
} as const;
export const SX_NAME_TYPO = {
  fontWeight: 400,
  fontSize: "0.875rem",
  color: "text.primary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;
export const SX_METRIC_TYPO = { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1, color: "text.primary" } as const;
export const SX_IO_INLINE = { color: "#7c3aed", fontSize: "0.65rem", fontWeight: 500, ml: 0.3 } as const;
export const SX_SECTION_LABEL = {
  fontSize: "0.875rem",
  color: "text.secondary",
  letterSpacing: 0.5,
  textTransform: "uppercase",
} as const;
export const SX_CHEVRON_ICON = {
  height: 12,
  width: 12,
  color: "text.disabled",
  flexShrink: 0,
  cursor: "pointer",
} as const;
export const SX_FLEX_1 = { flex: 1 } as const;
export const SX_BADGES_ROW = { display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 } as const;
export const SX_TU_CLICK = { flexShrink: 0, display: "flex", alignItems: "center", cursor: "pointer" } as const;
export const SX_MERGED_GRADE_BOX = { display: "inline-flex", alignItems: "center", gap: 0.25 } as const;
export const SX_GRADE_ARROW = { fontSize: "0.55rem", color: "text.secondary", lineHeight: 1 } as const;
export const SX_SECTION_HEADER_LEFT = {
  flexShrink: 0,
  px: 1.5,
  py: 0.75,
  display: "flex",
  alignItems: "center",
  gap: 1,
} as const;
export const SX_FLEX_1_PR = { flex: 1, pr: 1.5, minWidth: 0 } as const;
export const SX_HEATMAP_PY = { py: 0.25 } as const;
