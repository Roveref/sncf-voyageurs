/**
 * SAP wall colour based on freshness vs today.
 * Before today → red (late), before end-of-month → amber (in progress), at/past EOM → green (up to date).
 */
export const getSapWallColor = (maxSapDateStr: string | null | undefined): string => {
  if (!maxSapDateStr) return "#f59e0b";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sapEnd = new Date(maxSapDateStr);
  sapEnd.setHours(0, 0, 0, 0);
  const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  eom.setHours(0, 0, 0, 0);
  if (sapEnd < today) return "#ef4444";
  if (sapEnd < eom) return "#f59e0b";
  return "#10b981";
};

/**
 * Variance color: green for positive delta (SAP > forecast), red for negative.
 */
export const getVarianceColor = (delta: number | null | undefined): string => {
  if (delta == null) return "#f3f4f6";
  const a = Math.abs(delta);
  if (a < 0.5) return "#d1d5db";
  if (delta > 0) {
    if (delta >= 10) return "#065f46";
    if (delta >= 5) return "#16a34a";
    return "#86efac";
  }
  if (delta <= -10) return "#991b1b";
  if (delta <= -5) return "#ef4444";
  return "#fca5a5";
};

/**
 * Variance hours color: same palette as pts but thresholds in hours/day.
 */
export const getVarianceHoursColor = (deltaH: number | null | undefined): string => {
  if (deltaH == null) return "#f3f4f6";
  const a = Math.abs(deltaH);
  if (a < 0.2) return "#d1d5db";
  if (deltaH > 0) {
    if (deltaH >= 2) return "#065f46";
    if (deltaH >= 1) return "#16a34a";
    return "#86efac";
  }
  if (deltaH <= -2) return "#991b1b";
  if (deltaH <= -1) return "#ef4444";
  return "#fca5a5";
};

/**
 * Variance TU% color: SAP TU% - Staffing TU% (same thresholds as variance pts).
 */
export const getVarianceHoursPctColor = (delta: number | null | undefined): string => {
  if (delta == null) return "#f3f4f6";
  const a = Math.abs(delta);
  if (a < 0.5) return "#d1d5db";
  if (delta > 0) {
    if (delta >= 10) return "#065f46";
    if (delta >= 5) return "#16a34a";
    return "#86efac";
  }
  if (delta <= -10) return "#991b1b";
  if (delta <= -5) return "#ef4444";
  return "#fca5a5";
};
