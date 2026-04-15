/**
 * Display computation functions for HeatmapStrip cells.
 * Extracted to reduce HeatmapStrip.tsx line count.
 */
import { getHeatmapStyle, getAvailabilityStyle } from "../../constants/theme";
import { getVarianceColor, getVarianceHoursColor, getVarianceHoursPctColor } from "../../utils/sapUtils";
import { getHoursPerDay } from "../../constants";

interface DisplayCell {
  isInactive?: boolean;
  isWeekend?: boolean;
  hasStaffing?: boolean;
  fill: string;
  varianceRate?: number | null;
  varianceHours?: number | null;
  toRate?: number;
  tuRate?: number;
  displayTuRate?: number | null;
  isSap?: boolean;
  workDays?: number;
  isCurrentMonth?: boolean;
  isFullSap?: boolean;
  sapTuRate?: number | null;
  forecastTuRateBucket?: number | null;
  forecastTuRateAll?: number | null;
  sumChU?: number;
  sumNetU?: number;
  chU?: number;
  absRate?: number;
}

/** Compute display fill at render time based on mode */
export const getDisplayFill = (cell: DisplayCell, mode: string, grade: string): string => {
  if (cell.isInactive) return "#e0e0e0";
  if (cell.isWeekend) return cell.fill;
  if (!cell.hasStaffing) return "#ffffff";
  if (mode === "variance") return getVarianceColor(cell.varianceRate);
  if (mode === "variance_hours") {
    const days = cell.workDays || 1;
    return getVarianceHoursColor(cell.varianceHours != null ? cell.varianceHours / days : null);
  }
  if (mode === "variance_hours_pct") {
    return getVarianceHoursPctColor(cell.varianceRate);
  }
  if (mode === "availability") {
    const avail = Math.max(0, 100 - (cell.toRate || 0));
    return getAvailabilityStyle(avail).backgroundColor;
  }
  if (mode === "hours") {
    const rate = cell.displayTuRate ?? cell.tuRate ?? 0;
    return getHeatmapStyle(rate, grade).backgroundColor;
  }
  if (mode === "to") {
    const rate = cell.toRate || 0;
    if (rate === 0 && cell.isSap) return "#ef4444";
    return getHeatmapStyle(rate, grade).backgroundColor;
  }
  const rate = cell.displayTuRate ?? cell.tuRate ?? 0;
  if (rate === 0 && cell.isSap) return "#ef4444";
  return getHeatmapStyle(rate, grade).backgroundColor;
};

/** Compute display value for in-cell text (non-day granularities) */
export const getCellValue = (cell: DisplayCell, mode: string, grade: string): string | null => {
  if (cell.isWeekend) return null;
  if (mode === "variance") {
    if (cell.varianceRate == null) return null;
    const r = Math.round(cell.varianceRate * 10) / 10;
    return r === 0 ? null : (r > 0 ? "+" : "") + r.toFixed(1);
  }
  if (mode === "variance_hours") {
    if (cell.varianceHours == null) return null;
    const h = cell.varianceHours;
    if (Math.abs(h) < 0.1) return null;
    const sign = h > 0 ? "+" : "";
    return `${sign}${h.toFixed(1)}`;
  }
  if (mode === "variance_hours_pct") {
    if (cell.varianceRate == null) return null;
    const r = Math.round(cell.varianceRate * 10) / 10;
    if (Math.abs(r) < 0.5) return null;
    const sign = r > 0 ? "+" : "";
    return `${sign}${r.toFixed(1)}`;
  }
  if (mode === "hours") {
    const empHPD = getHoursPerDay(grade);
    const rawChU = cell.sumChU != null ? cell.sumChU : cell.chU || 0;
    const rawNetU = cell.sumNetU != null ? cell.sumNetU : 100 - (cell.absRate || 0);
    const chH = (rawChU * empHPD) / 100;
    const netH = (rawNetU * empHPD) / 100;
    if (netH < 0.1) return null;
    return `${chH.toFixed(0)}/${netH.toFixed(0)}`;
  }
  let v;
  if (mode === "availability") v = Math.max(0, 100 - (cell.toRate || 0));
  else if (mode === "to") v = cell.toRate || 0;
  else v = cell.displayTuRate ?? cell.tuRate ?? 0;
  const r = Math.round(v * 10) / 10;
  // Current month with SAP data: show "SAP - MDS"
  if (
    cell.isCurrentMonth &&
    !cell.isFullSap &&
    cell.isSap &&
    cell.sapTuRate != null &&
    mode !== "availability" &&
    mode !== "to"
  ) {
    const s = cell.sapTuRate.toFixed(1);
    const m = (cell.forecastTuRateBucket ?? cell.forecastTuRateAll ?? cell.tuRate ?? 0).toFixed(1);
    return `${s} - ${m}`;
  }
  return r === 0 || r === 100 ? null : r.toFixed(1);
};
