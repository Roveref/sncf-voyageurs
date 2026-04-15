import { alpha, Theme } from "@mui/material/styles";

/** Standardized divider opacity tiers (3 levels instead of 13) */
export const DIVIDER_ALPHA = {
  /** Dense grids, month column separators, background surfaces */
  subtle: 0.08,
  /** List items, section borders, card outlines */
  default: 0.2,
  /** Modal headers/footers, column separators */
  strong: 0.5,
} as const;

type Tier = keyof typeof DIVIDER_ALPHA;

/** 1px solid border at the given tier */
export const dividerBorder = (theme: Theme, tier: Tier = "default") =>
  `1px solid ${alpha(theme.palette.divider, DIVIDER_ALPHA[tier])}`;

/** 1px dashed border at the given tier */
export const dashedDivider = (theme: Theme, tier: Tier = "default") =>
  `1px dashed ${alpha(theme.palette.divider, DIVIDER_ALPHA[tier])}`;

/** Alpha'd divider color (for borderColor props) */
export const dividerColor = (theme: Theme, tier: Tier = "default") => alpha(theme.palette.divider, DIVIDER_ALPHA[tier]);
