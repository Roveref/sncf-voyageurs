import React, { memo, useMemo, useState, useRef, useEffect, useCallback } from "react";
import { MS_PER_DAY } from "../../constants";
import { getSapWallColor } from "../../utils/sapUtils";
import { getDisplayFill, getCellValue } from "./heatmapCellDisplay";
import { buildGradeTransitionMap, buildDailyEntries, buildHeatmapBuckets } from "../../utils/bucketing";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import { setCrosshairRange, useCrosshairRange } from "../../hooks/useCrosshairSync";
import type { DailyCell, CalendarDay, GradeTransition } from "../../types";

/** Props for the HeatmapStrip component */
interface HeatmapStripProps {
  dailyCells: DailyCell[] | null;
  timelineStart: Date | string;
  timelineEnd: Date | string;
  calendar: CalendarDay[];
  grade: string;
  granularity?: "day" | "week" | "2week" | "halfmonth" | "month";
  mode?: string;
  chargeableCombined?: boolean;
  teamNetHours?: number;
  enabledHolidayDates?: Set<string> | string[];
  onDateRangeSelect?: (start: Date, end: Date) => void;
  sapDayData?: Record<string, unknown> | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  gradeTransitions?: GradeTransition[] | null;
  mergedGradeRow?: boolean;
  /** Allow additional props to be passed through without errors */
  [key: string]: unknown;
}

// Shared constants
const HATCH_ABS =
  "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,1) 3px, rgba(255,255,255,1) 5px)";
const HATCH_GO =
  "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,210,211,0.4) 3px, rgba(0,210,211,0.4) 5px)";
const HATCH_SAP =
  "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 5px)";

// Level 0: compact heatmap strip (CSS grid)
// Pattern for inactive cells (before arrival / after departure): gray bg + white dots
const INACTIVE_DOT = "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)";
const INACTIVE_DOT_SIZE = "6px 6px";

const HeatmapStrip = memo(
  ({
    dailyCells: precomputedCells,
    timelineStart,
    timelineEnd,
    calendar,
    grade,
    granularity = "day",
    mode = "utilization",
    chargeableCombined = true,
    teamNetHours = 0,
    enabledHolidayDates = [],
    onDateRangeSelect,
    sapDayData,
    arrivalDate,
    departureDate,
    gradeTransitions = null,
    mergedGradeRow = false,
  }: HeatmapStripProps) => {
    const [hovered, setHovered] = useState<{ idx: number; x: number; y: number } | null>(null);
    const trendCrosshair = useCrosshairRange();

    // Build a map of grade transition dates for fast lookup
    // Maps both: arrival date (new grade starts) and departure date (old grade's last working day)
    const gradeTransitionMap = useMemo(
      () => buildGradeTransitionMap(gradeTransitions, mergedGradeRow),
      [gradeTransitions, mergedGradeRow]
    );

    const cells = useMemo(() => {
      if (!calendar || calendar.length === 0) return null;
      const daily = buildDailyEntries(precomputedCells, calendar, gradeTransitionMap);
      if (daily.length === 0) return null;
      return buildHeatmapBuckets(daily, grade, granularity, chargeableCombined, gradeTransitionMap);
    }, [precomputedCells, calendar, grade, granularity, chargeableCombined, sapDayData, gradeTransitionMap]);

    // Mark cells that fall outside arrival/departure dates as inactive
    const markedCells = useMemo(() => {
      if (!cells || (!arrivalDate && !departureDate)) return cells;
      return cells.map((cell) => {
        if (cell.isWeekend) return cell;
        // For aggregated cells (week/month), use startDate/endDate
        // Use local date formatting to avoid UTC timezone shift (toISOString gives UTC)
        const pad = (n: number) => String(n).padStart(2, "0");
        const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const cellEndStr = cell.endDate ? toLocalStr(cell.endDate) : null;
        const cellStartStr = cell.startDate ? toLocalStr(cell.startDate) : null;
        const beforeArrival = arrivalDate && cellEndStr && cellEndStr < arrivalDate;
        const afterDeparture = departureDate && cellStartStr && cellStartStr > departureDate;
        if (beforeArrival || afterDeparture) return { ...cell, isInactive: true };
        return cell;
      });
    }, [cells, arrivalDate, departureDate]);

    const handleCellClick = useCallback(
      (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest("[data-idx]");
        const idx = (el as HTMLElement)?.dataset?.idx;
        if (idx === undefined) return;
        const cell = markedCells?.[+idx];
        if (!cell || cell.isWeekend || cell.isInactive) return;
        if (onDateRangeSelect) onDateRangeSelect(cell.startDate, cell.endDate);
      },
      [markedCells, onDateRangeSelect]
    );

    // Display computation delegated to heatmapCellDisplay utility

    // RAF-throttled mousemove to avoid 60+ setState calls per second
    const rafRef = useRef<number | null>(null);
    useEffect(
      () => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      },
      []
    );

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
      const idx = (e.target as HTMLElement).dataset.idx;
      if (idx === undefined) return;
      const x = e.clientX,
        y = e.clientY,
        i = +idx;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setHovered({ idx: i, x, y });
        // Emit crosshair for TU Trend sync
        const cell = markedCells?.[i];
        if (cell?.startDate && cell?.endDate) {
          const sMs = new Date(cell.startDate).setHours(0, 0, 0, 0);
          const eMs = new Date(cell.endDate).getTime() + MS_PER_DAY;
          // Compute column fractions for pixel-perfect crosshair alignment
          let colBefore = 0;
          for (let k = 0; k < i; k++) colBefore += markedCells![k].span || 1;
          const cellSpan = cell.span || 1;
          let totalSpan = 0;
          for (let k = 0; k < markedCells!.length; k++) totalSpan += markedCells![k].span || 1;
          setCrosshairRange({
            startMs: sMs,
            endMs: eMs,
            source: "timeline",
            fracStart: colBefore / totalSpan,
            fracWidth: cellSpan / totalSpan,
          });
        }
      });
    };

    const hoveredCell = hovered ? markedCells?.[hovered.idx] : null;

    // SAP wall: find the cell that contains the last SAP day and fractional position within it
    const isDay = granularity === "day";

    const sapWallInfo = useMemo(() => {
      if (!cells || cells.length === 0) return null;
      let maxSapDate: string | null = null;
      if (sapDayData) {
        for (const ds of Object.keys(sapDayData)) {
          // For non-merged grade-split rows, cap at departureDate (= grade transition date)
          if (!mergedGradeRow && departureDate && ds > departureDate) continue;
          if (!maxSapDate || ds > maxSapDate) maxSapDate = ds;
        }
      }
      if (!maxSapDate) return null;
      const color = getSapWallColor(maxSapDate);
      const sapEnd = new Date(maxSapDate + "T00:00:00");
      // Find the cell/bucket containing maxSapDate
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.isWeekend) continue;
        const cStart = new Date(c.startDate);
        cStart.setHours(0, 0, 0, 0);
        const cEnd = new Date(c.endDate);
        cEnd.setHours(0, 0, 0, 0);
        if (sapEnd >= cStart && sapEnd <= cEnd) {
          if (isDay) {
            const cellSpanMs = cEnd.getTime() - cStart.getTime();
            const frac =
              cellSpanMs > 0
                ? Math.min(1, (sapEnd.getTime() - cStart.getTime() + MS_PER_DAY) / (cellSpanMs + MS_PER_DAY))
                : 1;
            return { idx: i, frac, color };
          }
          // Bucket mode: fraction = sapDayCount / workDays (same logic as AggregateHeatmapStrip)
          const wd = c.workDays ?? 0;
          const frac = wd > 0 ? Math.min(1, (c.sapDayCount || 0) / wd) : 1;
          return { idx: i, frac, color };
        }
      }
      // maxSapDate not in visible timeline → no wall
      return null;
    }, [cells, sapDayData, isDay, departureDate]);

    if (!markedCells) return <div style={{ height: 16, backgroundColor: "#ffffff", borderRadius: 4 }} />;

    return (
      <>
        <div
          className="heatmap-grid"
          role="grid"
          aria-label="Employee utilization heatmap"
          style={{
            display: "grid",
            gridTemplateColumns: markedCells.map((c) => `${c.span || 1}fr`).join(" "),
            gap: isDay ? "1px" : "2px",
            cursor: "pointer",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            setHovered(null);
            setCrosshairRange(null);
          }}
          onClick={handleCellClick}
        >
          {markedCells.map((cell, i) => {
            const hasAbsHatch = !cell.isWeekend && !cell.isInactive && (cell.absRate || 0) > 50;
            const hasGoHatch = chargeableCombined && !cell.isWeekend && !cell.isInactive && (cell.goRate || 0) > 0;
            const _isBucket = cell.isFullSap !== undefined;
            const _now = new Date();
            const _isCurrentMonthBucket =
              _isBucket &&
              cell.startDate &&
              cell.startDate.getMonth() === _now.getMonth() &&
              cell.startDate.getFullYear() === _now.getFullYear();
            const hasSapHatch =
              !cell.isWeekend && !cell.isInactive && (_isCurrentMonthBucket ? cell.isFullSap : cell.isSap);
            const hatchBg = cell.isInactive
              ? INACTIVE_DOT
              : cell.isForcedAbsence
                ? HATCH_ABS
                : hasSapHatch
                  ? HATCH_SAP
                  : hasGoHatch
                    ? HATCH_GO
                    : hasAbsHatch
                      ? HATCH_ABS
                      : null;
            const isSelected: boolean = false;
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
              <div
                key={i}
                data-idx={i}
                className="heatmap-cell"
                role="gridcell"
                style={{
                  height: 16,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "box-shadow 0.15s, opacity 0.15s, background-color 0.3s ease",
                  backgroundColor: getDisplayFill(cell, mode, grade),
                  ...(trendDimmed && { opacity: 0.25 }),
                  ...(!wallHere && !cell.gradeTransition && { overflow: "hidden" }),
                  ...(cell.gradeTransition && { position: "relative" }),
                  ...(hatchBg && {
                    backgroundImage: hatchBg,
                    ...(cell.isInactive && { backgroundSize: INACTIVE_DOT_SIZE }),
                  }),
                  ...(cell.monthStart && { borderLeft: "2px solid rgba(100, 116, 139, 0.35)" }),
                  ...(isSelected ? { boxShadow: "inset 0 0 0 50px rgba(59, 130, 246, 0.25)", zIndex: 10 } : {}),
                  ...(wallHere && { position: "relative", zIndex: 6 }),
                }}
              >
                {!isDay && !cell.isWeekend && !cell.isInactive && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: "#fff",
                      pointerEvents: "none",
                      userSelect: "none",
                      textShadow: "0 0 3px rgba(0,0,0,0.7)",
                    }}
                  >
                    {getCellValue(cell, mode, grade)}
                  </span>
                )}
                {wallHere && (
                  <div
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
                {cell.gradeTransition && !cell.isInactive && (
                  <div
                    title={`${cell.gradeTransition.from} → ${cell.gradeTransition.to} (${cell.gradeTransition.since})`}
                    style={{
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      ...(cell.gradeTransition.isDeparture ? { right: -7 } : { left: -7 }),
                      zIndex: 5,
                      pointerEvents: "none",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      backgroundColor: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CallMergeIcon style={{ fontSize: 10, color: "#fff" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }
);
HeatmapStrip.displayName = "HeatmapStrip";

export { HeatmapStrip };
