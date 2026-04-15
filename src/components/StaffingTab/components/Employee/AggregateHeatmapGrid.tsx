import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { MS_PER_DAY } from "../../constants";
import { getHeatmapStyle, getAvailabilityStyle } from "../../constants/theme";
import { getVarianceColor, getVarianceHoursColor, getVarianceHoursPctColor } from "../../utils/sapUtils";
import { setCrosshairRange, useCrosshairRange } from "../../hooks/useCrosshairSync";

// Shared visual constants
const HATCH_ABS =
  "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,1) 3px, rgba(255,255,255,1) 5px)";
const HATCH_SAP =
  "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 5px)";
const INACTIVE_DOT = "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)";
const INACTIVE_DOT_SIZE = "6px 6px";

// ── Types ──────────────────────────────────────────────────────────────────

/** Minimal cell shape consumed by the grid — keeps the contract explicit without
 *  forcing callers to type the full computed-cell structure. */
interface AggCellData {
  span?: number;
  isWeekend?: boolean;
  isInactive?: boolean;
  isSap?: boolean;
  isFullSap?: boolean;
  isForcedAbsence?: boolean;
  hasStaffing?: boolean;
  monthStart?: boolean;
  startDate?: Date;
  endDate?: Date;
  tuRate?: number;
  toRate?: number;
  displayTuRate?: number;
  absRate?: number;
  varianceRate?: number | null;
  varianceHours?: number | null;
  bucketRealChH?: number;
  bucketRealBaseH?: number;
  bucketRealAbsH?: number;
  bucketRealHolH?: number;
  totalSapEmpDays?: number;
  activeEmpDays?: number;
  workDays?: number;
  fill?: string;
  [key: string]: unknown;
}

interface SapWallInfo {
  idx: number;
  frac: number;
  color: string;
}

export interface AggregateHeatmapGridProps {
  cells: AggCellData[];
  mode: string;
  isDay: boolean;
  theoreticalTU?: number;
  sapWallInfo: SapWallInfo | null;
  curMonthGridTU: Map<number, { sapTU: number | null; mdsTU: number | null }>;
  onCellClick: (e: React.MouseEvent) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getDisplayFill(cell: AggCellData, mode: string, theoreticalTU?: number): string {
  if (cell.isWeekend) return cell.fill || "#f0f0f0";
  if (cell.isInactive) return "#e0e0e0";
  if (!cell.hasStaffing) return "#f9fafb";
  if (mode === "variance") return getVarianceColor(cell.varianceRate ?? null);
  if (mode === "variance_hours") {
    const days = cell.workDays || 1;
    return getVarianceHoursColor(cell.varianceHours != null ? cell.varianceHours / days : null);
  }
  if (mode === "variance_hours_pct") {
    return getVarianceHoursPctColor(cell.varianceRate ?? null);
  }
  if (mode === "availability") {
    const avail = Math.max(0, 100 - (cell.toRate || 0));
    return getAvailabilityStyle(avail).backgroundColor;
  }
  if (mode === "hours") {
    const rate = cell.displayTuRate ?? cell.tuRate ?? 0;
    return getHeatmapStyle(rate, undefined, theoreticalTU).backgroundColor;
  }
  if (mode === "to") {
    const rate = cell.toRate || 0;
    if (rate === 0 && cell.isSap) return "#ef4444";
    return getHeatmapStyle(rate, undefined, theoreticalTU).backgroundColor;
  }
  const rate = cell.displayTuRate ?? cell.tuRate ?? 0;
  if (rate === 0 && cell.isSap) return "#ef4444";
  return getHeatmapStyle(rate, undefined, theoreticalTU).backgroundColor;
}

function computeCellValue(
  cell: AggCellData,
  index: number,
  mode: string,
  nowMonth: number,
  nowYear: number,
  curMonthGridTU: Map<number, { sapTU: number | null; mdsTU: number | null }>
): string | null {
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
    const chH = cell.bucketRealChH || 0;
    const netH = (cell.bucketRealBaseH || 0) - (cell.bucketRealAbsH || 0) - (cell.bucketRealHolH || 0);
    if (netH < 0.5) return null;
    return `${chH.toFixed(0)}/${netH.toFixed(0)}`;
  }
  let v;
  if (mode === "availability") v = Math.max(0, 100 - (cell.toRate || 0));
  else if (mode === "to") v = cell.toRate || 0;
  else v = cell.displayTuRate ?? cell.tuRate ?? 0;
  // Current month with SAP data: show "SAP - MDS"
  const _isCurMonth =
    cell.startDate && cell.startDate.getMonth() === nowMonth && cell.startDate.getFullYear() === nowYear;
  if (_isCurMonth && cell.isSap && !cell.isFullSap && mode !== "availability" && mode !== "to") {
    const gridVals = curMonthGridTU.get(index);
    if (gridVals?.sapTU != null) {
      return `${gridVals.sapTU.toFixed(1)} - ${(gridVals.mdsTU ?? v).toFixed(1)}`;
    }
  }
  return v === 0 || v === 100 ? null : v.toFixed(1);
}

// ── Component ──────────────────────────────────────────────────────────────

const AggregateHeatmapGrid = memo(
  ({ cells, mode, isDay, theoreticalTU, sapWallInfo, curMonthGridTU, onCellClick }: AggregateHeatmapGridProps) => {
    const [hovered, setHovered] = useState<{ idx: number; x: number; y: number } | null>(null);
    const trendCrosshair = useCrosshairRange();
    const rafRef = useRef<number | null>(null);

    useEffect(
      () => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      },
      []
    );

    const _now = new Date();
    const nowMonth = _now.getMonth();
    const nowYear = _now.getFullYear();

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        const idx = (e.target as HTMLElement).dataset.idx;
        if (idx === undefined) return;
        const x = e.clientX,
          y = e.clientY,
          i = +idx;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setHovered({ idx: i, x, y });
          const cell = cells[i];
          if (cell?.startDate && cell?.endDate) {
            const sMs = new Date(cell.startDate).setHours(0, 0, 0, 0);
            const eMs = new Date(cell.endDate).getTime() + MS_PER_DAY;
            setCrosshairRange({ startMs: sMs, endMs: eMs, source: "timeline" });
          }
        });
      },
      [cells]
    );

    const handleMouseLeave = useCallback(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setHovered(null);
      setCrosshairRange(null);
    }, []);

    // Suppress unused-var lint — hovered drives RAF cycle and will be consumed by tooltip in the future
    void hovered;

    return (
      <Box
        role="grid"
        aria-label="Team utilization heatmap"
        style={{
          display: "grid",
          gridTemplateColumns: cells.map((c) => `${c.span || 1}fr`).join(" "),
          gap: isDay ? "1px" : "2px",
          cursor: "pointer",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onCellClick}
      >
        {cells.map((cell, i) => {
          const aggCellVal = computeCellValue(cell, i, mode, nowMonth, nowYear, curMonthGridTU);
          // Current month: hatch only when SAP emp-days cover all active emp-days in bucket
          const _isCurrentMonthBucket =
            cell.startDate && cell.startDate.getMonth() === nowMonth && cell.startDate.getFullYear() === nowYear;
          const hasSapHatch =
            !cell.isWeekend &&
            !cell.isInactive &&
            (_isCurrentMonthBucket ? (cell.totalSapEmpDays || 0) >= (cell.activeEmpDays || 1) : cell.isSap);
          const hasAbsHatch = !cell.isWeekend && !cell.isInactive && (cell.absRate || 0) > 50;
          const hatchBg = cell.isInactive
            ? INACTIVE_DOT
            : cell.isForcedAbsence
              ? HATCH_ABS
              : hasSapHatch
                ? HATCH_SAP
                : hasAbsHatch
                  ? HATCH_ABS
                  : null;
          const wallHere = sapWallInfo && sapWallInfo.idx === i;
          const trendDimmed =
            trendCrosshair?.source === "trend" &&
            cell.startDate &&
            cell.endDate &&
            !(
              new Date(cell.endDate).getTime() + MS_PER_DAY > trendCrosshair.startMs &&
              new Date(cell.startDate).getTime() < trendCrosshair.endMs
            );
          return (
            <Box
              key={i}
              data-idx={i}
              role="gridcell"
              sx={{
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(!wallHere && { overflow: "hidden" }),
                transition: "box-shadow 0.15s, opacity 0.15s, background-color 0.3s ease",
                "&:hover": { boxShadow: "0 0 0 1px #60a5fa" },
                ...(trendDimmed && { opacity: 0.25 }),
              }}
              style={{
                height: 16,
                backgroundColor: getDisplayFill(cell, mode, theoreticalTU),
                ...(hatchBg && {
                  backgroundImage: hatchBg,
                  ...(cell.isInactive && { backgroundSize: INACTIVE_DOT_SIZE }),
                }),
                ...(cell.monthStart && { borderLeft: "2px solid rgba(100, 116, 139, 0.35)" }),
                ...(wallHere && { position: "relative", zIndex: 6 }),
              }}
            >
              {!isDay && !cell.isWeekend && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "11px",
                    fontWeight: 600,
                    lineHeight: 1,
                    color: "#fff",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                  style={{ textShadow: "0 0 3px rgba(0,0,0,0.7)" }}
                >
                  {aggCellVal}
                </Typography>
              )}
              {wallHere && (
                <Box
                  style={{
                    position: "absolute",
                    top: -4,
                    bottom: -4,
                    left: `${sapWallInfo.frac * 100}%`,
                    width: 2.5,
                    background: sapWallInfo.color,
                    pointerEvents: "none",
                    transform: "translateX(-1.25px)",
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    );
  }
);
AggregateHeatmapGrid.displayName = "AggregateHeatmapGrid";

export { AggregateHeatmapGrid };
