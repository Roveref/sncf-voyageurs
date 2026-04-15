/** Tooltip fixed dimensions */
export const TOOLTIP_FIXED_W = 680;
export const TOOLTIP_FIXED_H = 340;
export const TOOLTIP_MIRROR_W = 1080;
export const TOOLTIP_MIRROR_H = 520;

/** Tooltip inline style object — glassmorphism dark variant aligned with Dashboard */
export const TOOLTIP_STYLE = {
  position: "fixed",
  zIndex: 50,
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  color: "#fff",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)",
  px: 3,
  py: 2.5,
  pointerEvents: "none",
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
};

/** Legacy class-based tooltip (kept for compatibility with components that still use className) */
export const TOOLTIP_CLASS = "app-tooltip";

/**
 * Compute tooltip position, flipping when it would overflow viewport.
 */
export const getTooltipStyle = (
  x: number,
  y: number,
  w: number = TOOLTIP_FIXED_W,
  h: number = TOOLTIP_FIXED_H
): Record<string, any> => {
  const gap = 14;
  const flipX = x + gap + w > window.innerWidth;
  const flipY = y + h > window.innerHeight;
  const tx = flipX ? "translateX(-100%)" : "";
  const ty = flipY ? "translateY(-100%)" : "";
  return {
    left: flipX ? x - gap : x + gap,
    top: flipY ? y + 10 : y - 10,
    width: w,
    minHeight: h,
    ...((tx || ty) && { transform: `${tx} ${ty}`.trim() }),
  };
};

/**
 * Collision-avoidance for vertical bar markers — spread overlapping markers apart.
 */
export const spreadMarkers = (
  markers: { pct: number; [key: string]: any }[],
  barH: number,
  minGap: number = 13
): { pct: number; px: number; [key: string]: any }[] => {
  if (markers.length === 0) return [];
  const sorted = markers.map((m) => ({ ...m, px: (m.pct / 100) * barH })).sort((a, b) => a.px - b.px);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].px - sorted[i - 1].px < minGap) sorted[i].px = sorted[i - 1].px + minGap;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    sorted[i].px = Math.min(sorted[i].px, barH);
    if (i > 0 && sorted[i].px - sorted[i - 1].px < minGap) sorted[i - 1].px = sorted[i].px - minGap;
  }
  return sorted.map((m) => ({ ...m, px: Math.max(0, Math.min(barH, m.px)) }));
};

/** Format percentage: 1 decimal always, except 100% which shows no decimal */
export const fmtP = (v: number): string => (v >= 99.95 ? "100" : v.toFixed(1));

/** Blue shades for individual chargeable projects in bar */
export const CH_COLORS = ["#60a5fa", "#3b82f6", "#93c5fd", "#2563eb", "#7dd3fc"];
export const GO_COLORS = ["#22d3ee", "#06b6d4", "#67e8f9", "#0891b2", "#a5f3fc"];
