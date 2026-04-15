import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import { getMonthLabels } from "../../../utils/timelineUtils";
import { MONTHS_EN } from "../../../constants/gantt";

/**
 * Generic month axis for a Gantt timeline.
 *
 * Visual parity with StaffingTab's TimelineHeader month row:
 * English short month names (Jan, Feb, …), gray-700 text, borderLeft
 * separator on each month, no background, transparent container so the
 * Paper underneath shows through.
 */
interface GanttMonthAxisProps {
  timelineStart: Date | string;
  timelineEnd: Date | string;
  /** Kept for API compatibility — no longer affects label format. */
  timeframe?: string;
  /** Total bar height in px. Default 28 to match the staffing month row. */
  height?: number;
}

const GanttMonthAxis = memo(
  ({ timelineStart, timelineEnd, timeframe = "quarter", height = 28 }: GanttMonthAxisProps) => {
    const months = useMemo(() => {
      const start = new Date(timelineStart);
      const end = new Date(timelineEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
      // Reuse staffing's positioning math, then replace the (French) label
      // with the English short month name to match TimelineHeader exactly.
      return getMonthLabels(start, end, timeframe).map((m) => {
        const d = new Date(m.key);
        const monthIdx = d.getMonth();
        const isJan = monthIdx === 0;
        return {
          ...m,
          label: MONTHS_EN[monthIdx],
          year: d.getFullYear(),
          isJan,
        };
      });
    }, [timelineStart, timelineEnd, timeframe]);

    return (
      <Box
        sx={{
          position: "relative",
          height,
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        {months.map((m) => (
          <Box
            key={m.key}
            sx={{
              position: "absolute",
              left: `${m.startPos}%`,
              width: `${m.width}%`,
              top: 0,
              bottom: 0,
              borderLeft: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: "4px",
              fontSize: "0.75rem",
              fontWeight: 400,
              color: "#374151",
              lineHeight: 1.1,
            }}
          >
            <Box component="span">{m.label}</Box>
            {m.isJan && (
              <Box component="span" sx={{ fontSize: "0.625rem", color: "#6b7280", fontWeight: 500 }}>
                {m.year}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  }
);
GanttMonthAxis.displayName = "GanttMonthAxis";

export { GanttMonthAxis };
