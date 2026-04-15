/**
 * CellStrip — heatmap-grid row primitive, visually consistent with the
 * StaffingTab HeatmapStrip but fed by simple, generic inputs.
 *
 * Renders a CSS grid with one column per week (or per month when the
 * timeline is very long) across the timeline. The caller decides how
 * each cell is coloured via `getCellFill(cellStart, cellEnd)`. Cells
 * are small rounded rectangles with a 1-2px gap, month boundaries are
 * marked with a left border, and each cell has a constant height so
 * rows feel dense like the StaffingTab employee rows.
 */
import { memo, useMemo, type CSSProperties } from "react";
import Tooltip from "@mui/material/Tooltip";

const MS_PER_DAY = 86_400_000;

export type CellGranularity = "day" | "week" | "month";

export interface CellStripProps {
  timelineStart: Date | string;
  timelineEnd: Date | string;
  /** Explicit granularity override. If omitted, picks auto: day (<90 days), week (<2y), month (≥2y). */
  granularity?: CellGranularity;
  /** Called per cell — return a CSS background (colour, gradient) or null for a blank cell. */
  getCellFill: (cellStart: Date, cellEnd: Date) => string | null;
  /** Optional tooltip builder per cell. */
  getCellTooltip?: (cellStart: Date, cellEnd: Date) => string | null;
  /** Cell height in px — defaults to 18 to match StaffingTab's "day" granularity. */
  height?: number;
  /** Blank cell background colour. Visible by default so the row reads as a
   *  continuous "calendar strip" instead of a floating bar on whitespace —
   *  this is the critical visual ingredient that makes StaffingTab rows feel dense. */
  blankColor?: string;
  /** Weekend shading colour (only used at day granularity). */
  weekendColor?: string;
  /** Gap between cells in px. Default 1 to match StaffingTab density. */
  gapPx?: number;
}

const pickGranularity = (startMs: number, endMs: number): CellGranularity => {
  const days = (endMs - startMs) / MS_PER_DAY;
  if (days <= 90) return "day";
  if (days <= 730) return "week";
  return "month";
};

const alignDown = (d: Date, granularity: CellGranularity): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  if (granularity === "day") return out;
  if (granularity === "week") {
    // Monday start (ISO)
    const dow = out.getDay();
    const delta = (dow + 6) % 7; // Monday = 0
    out.setDate(out.getDate() - delta);
    return out;
  }
  // month
  out.setDate(1);
  return out;
};

const advance = (d: Date, granularity: CellGranularity): Date => {
  const out = new Date(d);
  if (granularity === "day") {
    out.setDate(out.getDate() + 1);
  } else if (granularity === "week") {
    out.setDate(out.getDate() + 7);
  } else {
    out.setMonth(out.getMonth() + 1);
  }
  return out;
};

const CellStrip = memo(
  ({
    timelineStart,
    timelineEnd,
    granularity: explicitGranularity,
    getCellFill,
    getCellTooltip,
    height = 16,
    blankColor = "rgba(148, 163, 184, 0.22)",
    weekendColor = "rgba(100, 116, 139, 0.35)",
    gapPx = 1,
  }: CellStripProps) => {
    const cells = useMemo(() => {
      const startMs = new Date(timelineStart).getTime();
      const endMs = new Date(timelineEnd).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
      const gran = explicitGranularity || pickGranularity(startMs, endMs);

      const result: {
        start: Date;
        end: Date;
        fill: string | null;
        tooltip: string | null;
        isWeekend: boolean;
        isMonthStart: boolean;
      }[] = [];

      let cursor = alignDown(new Date(startMs), gran);
      const endBoundary = new Date(endMs);
      while (cursor <= endBoundary) {
        const nextCursor = advance(cursor, gran);
        // Clamp cell to timeline range for the boundary cells
        const cellStart = new Date(Math.max(cursor.getTime(), startMs));
        const cellEnd = new Date(Math.min(nextCursor.getTime() - 1, endMs));
        const isWeekend = gran === "day" && (cursor.getDay() === 0 || cursor.getDay() === 6);
        const isMonthStart = cursor.getDate() === 1 || (gran === "week" && cellStart.getDate() <= 7);
        const fill = getCellFill(cellStart, cellEnd);
        const tooltip = getCellTooltip ? getCellTooltip(cellStart, cellEnd) : null;
        result.push({ start: cellStart, end: cellEnd, fill, tooltip, isWeekend, isMonthStart });
        cursor = nextCursor;
      }
      return result;
    }, [timelineStart, timelineEnd, explicitGranularity, getCellFill, getCellTooltip]);

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cells.length || 1}, 1fr)`,
          gap: `${gapPx}px`,
          height,
          alignItems: "center",
          width: "100%",
        }}
      >
        {cells.map((cell, i) => {
          const bg: CSSProperties["background"] = cell.fill || (cell.isWeekend ? weekendColor : blankColor);
          const style: CSSProperties = {
            height,
            borderRadius: 4,
            background: bg,
            marginLeft: cell.isMonthStart && i > 0 ? 2 : undefined,
            transition: "box-shadow 0.15s, opacity 0.15s, background-color 0.3s ease",
          };
          const cellEl = <div key={i} style={style} />;
          return cell.tooltip ? (
            <Tooltip key={i} title={cell.tooltip} arrow placement="top" disableInteractive>
              {cellEl}
            </Tooltip>
          ) : (
            cellEl
          );
        })}
      </div>
    );
  }
);
CellStrip.displayName = "CellStrip";

export { CellStrip };
