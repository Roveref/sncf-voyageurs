/**
 * JobcodeSapEmployeeRow — nested row revealed when a jobcode group's
 * SAP expand is active. Shows one employee with their SAP charging
 * density over the timeline.
 *
 * Visual parity with StaffingTab employee rows: each cell in the strip
 * is coloured by the charge intensity for that period (using the
 * dominant category colour). Higher hours = darker fill.
 */
import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { CellStrip } from "../../common/Gantt/CellStrip";
import type { SapEmployeeForJobcode, SapEmployeePeriod } from "../hooks/useSapForJobcode";

const CATEGORY_COLOR: Record<string, string> = {
  chargeable: "#2563eb",
  generalOppty: "#8b5cf6",
  businessDev: "#a855f7",
  nonChargeable: "#64748b",
  training: "#f59e0b",
  absence: "#94a3b8",
  otherAbsence: "#94a3b8",
  travelWe: "#475569",
  other: "#94a3b8",
};

interface JobcodeSapEmployeeRowProps {
  employee: SapEmployeeForJobcode;
  timelineStart: Date | string;
  timelineEnd: Date | string;
  leftColumnWidth: number;
  rowHeight?: number;
  /** Cumulative left-col shrink for nested grouped rows. */
  leftColShrink?: number;
}

/**
 * Build a flat list of (timestamp → color) for fast cell lookup, keyed
 * by period index.
 */
const buildPeriodIndex = (periods: SapEmployeePeriod[]) =>
  periods
    .map((p) => {
      const s = new Date(p.startDate).setHours(0, 0, 0, 0);
      const e = new Date(p.endDate).setHours(23, 59, 59, 999);
      const color = CATEGORY_COLOR[p.category] || CATEGORY_COLOR.other;
      return { start: s, end: e, color, totalHours: p.totalHours, category: p.category };
    })
    .filter((p) => Number.isFinite(p.start) && Number.isFinite(p.end));

const JobcodeSapEmployeeRow = memo(
  ({
    employee,
    timelineStart,
    timelineEnd,
    leftColumnWidth,
    rowHeight = 28,
    leftColShrink = 0,
  }: JobcodeSapEmployeeRowProps) => {
    const effectiveLeftCol = leftColumnWidth - leftColShrink;
    const periodIndex = useMemo(() => buildPeriodIndex(employee.periods), [employee.periods]);
    const dominantColor = CATEGORY_COLOR[employee.dominantCategory] || CATEGORY_COLOR.other;

    // Project each period to an absolute (left%, width%) bar within the
    // timeline so colored segments line up with the exact day boundaries.
    const periodBars = useMemo(() => {
      const tlStart = new Date(timelineStart).getTime();
      const tlEnd = new Date(timelineEnd).getTime();
      if (!Number.isFinite(tlStart) || !Number.isFinite(tlEnd) || tlEnd <= tlStart) return [];
      const span = tlEnd - tlStart;
      return periodIndex
        .map((p) => {
          const s = Math.max(p.start, tlStart);
          const e = Math.min(p.end, tlEnd);
          if (e <= s) return null;
          const left = ((s - tlStart) / span) * 100;
          const width = ((e - s) / span) * 100;
          return { left, width, color: p.color, totalHours: p.totalHours, category: p.category };
        })
        .filter(
          (b): b is { left: number; width: number; color: string; totalHours: number; category: string } => b != null
        );
    }, [periodIndex, timelineStart, timelineEnd]);

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          minHeight: rowHeight,
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "rgba(241, 245, 249, 0.6)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
          transition: "background-color 0.3s ease",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {/* Fixed left column — staffing EmployeeRowHeader typography */}
        <Box
          sx={{
            width: effectiveLeftCol,
            minWidth: effectiveLeftCol,
            flexShrink: 0,
            px: 1.5,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: dominantColor,
              flexShrink: 0,
            }}
          />
          <Typography
            component="span"
            sx={{
              fontWeight: 400,
              fontSize: "0.875rem",
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
            title={employee.name}
          >
            {employee.name}
          </Typography>
          {employee.grade && (
            <Typography
              component="span"
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 700,
                color: "text.secondary",
                bgcolor: "grey.100",
                px: 0.5,
                borderRadius: 0.5,
                flexShrink: 0,
                lineHeight: "18px",
              }}
            >
              {employee.grade}
            </Typography>
          )}
          <Typography
            component="span"
            sx={{
              fontSize: "0.875rem",
              fontWeight: 400,
              color: "text.primary",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              minWidth: 40,
              textAlign: "right",
            }}
          >
            {Math.round(employee.totalHours)}h
          </Typography>
        </Box>

        {/* Right cell strip with absolute period overlays */}
        <Box sx={{ flex: 1, minWidth: 0, pr: 1.5, py: 0.25, position: "relative" }}>
          <CellStrip timelineStart={timelineStart} timelineEnd={timelineEnd} getCellFill={() => null} height={16} />
          {periodBars.map((b, i) => (
            <Tooltip
              key={i}
              title={`${Math.round(b.totalHours)}h · ${b.category}`}
              arrow
              placement="top"
              disableInteractive
            >
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  left: `${b.left}%`,
                  width: `max(3px, ${b.width}%)`,
                  height: 16,
                  bgcolor: b.color,
                  borderRadius: "4px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>
    );
  }
);
JobcodeSapEmployeeRow.displayName = "JobcodeSapEmployeeRow";

export { JobcodeSapEmployeeRow };
