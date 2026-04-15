import { memo, useMemo } from "react";
import Box from "@mui/material/Box";

/**
 * Generic "today" marker for a Gantt timeline.
 *
 * Simple percent-based positioning: `today` is plotted at
 * `(now - timelineStart) / (timelineEnd - timelineStart) * 100%` inside
 * an absolutely-positioned container.
 *
 * This is DIFFERENT from StaffingTab's TodayLine, which compensates
 * for weekend-column collapsing in workday-granular Gantts. Jobcode
 * Gantts span months and don't collapse weekends, so the simple
 * percent model is correct here.
 */
interface GanttTodayLineProps {
  timelineStart: Date | string;
  timelineEnd: Date | string;
  /** Optional left offset (e.g. to skip a fixed left label column). */
  leftOffsetPx?: number;
  /** Optional right padding (e.g. trailing scroll padding in the parent). */
  rightPaddingPx?: number;
  /** Line colour. */
  color?: string;
  /** Line thickness in px. */
  widthPx?: number;
  /** Optional label rendered above the line (e.g. "Today"). */
  label?: string;
}

const GanttTodayLine = memo(
  ({
    timelineStart,
    timelineEnd,
    leftOffsetPx = 0,
    rightPaddingPx = 0,
    color = "rgba(239, 68, 68, 0.75)",
    widthPx = 2,
    label,
  }: GanttTodayLineProps) => {
    const pct = useMemo(() => {
      const start = new Date(timelineStart).getTime();
      const end = new Date(timelineEnd).getTime();
      const now = Date.now();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      if (now < start || now > end) return null;
      return ((now - start) / (end - start)) * 100;
    }, [timelineStart, timelineEnd]);

    if (pct == null) return null;

    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          zIndex: 1,
          pointerEvents: "none",
          left: `calc(${leftOffsetPx}px + (100% - ${leftOffsetPx + rightPaddingPx}px) * ${pct / 100})`,
          width: widthPx,
          backgroundColor: color,
        }}
      >
        {label && (
          <Box
            component="span"
            sx={{
              position: "absolute",
              top: -18,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 10,
              fontWeight: 600,
              color,
              whiteSpace: "nowrap",
              px: 0.5,
              bgcolor: "rgba(0,0,0,0.0)",
            }}
          >
            {label}
          </Box>
        )}
      </Box>
    );
  }
);
GanttTodayLine.displayName = "GanttTodayLine";

export { GanttTodayLine };
