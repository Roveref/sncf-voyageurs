import { memo, type CSSProperties, type MouseEvent } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

/**
 * Generic Gantt bar primitive.
 *
 * Pure positioning: takes `left` and `width` as percentages of the
 * timeline container. The parent is responsible for deciding what a
 * "timeline" means (it already computed the percentages via the shared
 * `calculateBarPosition` util).
 *
 * This primitive does NOT replace StaffingTab's `AssignmentBar`, which
 * has its own drag/edit chrome. It is intentionally minimal so it can
 * be used for any time-range entity (opportunities, bookings, etc.).
 */
export interface GanttBarEvent {
  /** Position as percent from timeline start (NOT from the bar). */
  leftPct: number;
  /** Label shown on hover. */
  label: string;
  /** Dot colour — falls back to the bar colour if omitted. */
  color?: string;
  /** Visual style hint (circle by default, diamond for milestones, etc.). */
  shape?: "circle" | "diamond";
}

interface GanttBarProps {
  /** Percent from the timeline container start (0–100). */
  left: number;
  /** Percent width (0–100). */
  width: number;
  /** Bar fill colour. */
  color: string;
  /** Tooltip text on hover. */
  tooltip?: string;
  /** Optional row of event markers — each positioned relative to the timeline (not the bar). */
  events?: GanttBarEvent[];
  /** Bar height in px. Default 16. */
  height?: number;
  /** Bar border radius in px. Default 3. */
  borderRadius?: number;
  /** Extra CSS vertical offset (e.g. to align with a row centre). */
  top?: CSSProperties["top"];
  /** Click handler — typically opens a detail panel. */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const GanttBar = memo(
  ({ left, width, color, tooltip, events, height = 16, borderRadius = 3, top, onClick }: GanttBarProps) => {
    const clampedLeft = Math.max(0, Math.min(100, left));
    const clampedWidth = Math.max(0, Math.min(100 - clampedLeft, width));

    const bar = (
      <Box
        onClick={onClick}
        sx={{
          position: "absolute",
          left: `${clampedLeft}%`,
          width: `${clampedWidth}%`,
          top: top ?? "50%",
          transform: top == null ? "translateY(-50%)" : undefined,
          height,
          minWidth: 3,
          borderRadius: `${borderRadius}px`,
          bgcolor: color,
          cursor: onClick ? "pointer" : "default",
          transition: "filter 120ms ease",
          "&:hover": onClick ? { filter: "brightness(1.1)" } : undefined,
        }}
      />
    );

    return (
      <>
        {tooltip ? (
          <Tooltip title={tooltip} arrow placement="top" disableInteractive>
            {bar}
          </Tooltip>
        ) : (
          bar
        )}
        {events?.map((ev, i) => {
          const dotColor = ev.color || color;
          const pos = Math.max(0, Math.min(100, ev.leftPct));
          return (
            <Tooltip key={i} title={ev.label} arrow placement="top" disableInteractive>
              <Box
                sx={{
                  position: "absolute",
                  left: `${pos}%`,
                  top: top ?? "50%",
                  transform: top == null ? "translate(-50%, -50%)" : "translateX(-50%)",
                  width: 10,
                  height: 10,
                  borderRadius: ev.shape === "diamond" ? "2px" : "50%",
                  bgcolor: dotColor,
                  border: "2px solid rgba(255,255,255,0.85)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                  rotate: ev.shape === "diamond" ? "45deg" : undefined,
                  zIndex: 2,
                  cursor: "default",
                }}
              />
            </Tooltip>
          );
        })}
      </>
    );
  }
);
GanttBar.displayName = "GanttBar";

export { GanttBar };
