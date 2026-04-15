/**
 * JobcodeGroupHeader — visual parity with staffing's GroupedEmployeeList
 * depth-0 header (GroupedEmployeeList.tsx:138-330).
 *
 * Card: borderRadius 3, soft shadow, per-group bgcolor (hashed from jobcode).
 * Left col (440px): chevron + name + count + revenue pill + SAP toggle.
 * Right col (flex: 1): CellStrip showing per-group opportunity density —
 * mirrors staffing's `<AggregateHeatmapStrip />` filling the timeline area.
 */
import { memo, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { CellStrip } from "../../common/Gantt/CellStrip";
import type { Jobcode } from "../hooks/useJobcodeData";
import { getJobcodeGroupColors } from "../utils/groupColors";

const MS_PER_DAY = 86_400_000;
const TODAY_PADDING_DAYS = 30;

const formatRevenue = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
};

const parseMs = (v?: string | null): number => {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};

interface JobcodeGroupHeaderProps {
  jobcode: Jobcode;
  /** Opportunities of this group — needed for the per-group aggregate strip. */
  opportunities: Record<string, unknown>[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  leftColumnWidth: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const JobcodeGroupHeader = memo(
  ({
    jobcode,
    opportunities,
    timelineStart,
    timelineEnd,
    leftColumnWidth,
    collapsed,
    onToggleCollapsed,
  }: JobcodeGroupHeaderProps) => {
    const colors = getJobcodeGroupColors(jobcode.jobcode);

    // Pre-resolve each opp to a [start, end] window (same fallback chain as
    // JobcodeGanttRow), then count overlaps per cell.
    const oppRanges = useMemo(() => {
      const todayMs = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })();
      return opportunities
        .map((opp) => {
          const o = opp as {
            creationDate?: string;
            bookingDate?: string;
            lastStatusChangeDate?: string;
          };
          const c = parseMs(o.creationDate);
          const b = parseMs(o.bookingDate);
          const sc = parseMs(o.lastStatusChangeDate);
          let s = c;
          let e = b;
          if (!Number.isFinite(s)) {
            if (Number.isFinite(sc)) s = sc;
            else if (Number.isFinite(e)) s = e - TODAY_PADDING_DAYS * MS_PER_DAY;
          }
          if (!Number.isFinite(e)) {
            e = Number.isFinite(sc)
              ? Math.max(sc, todayMs + TODAY_PADDING_DAYS * MS_PER_DAY)
              : todayMs + TODAY_PADDING_DAYS * MS_PER_DAY;
          }
          if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
          if (s > e) {
            const tmp = s;
            s = e;
            e = tmp;
          }
          return [s, e] as [number, number];
        })
        .filter((r): r is [number, number] => r != null);
    }, [opportunities]);

    const aggregateFill = useCallback(
      (cellStart: Date, cellEnd: Date): string | null => {
        const cs = cellStart.getTime();
        const ce = cellEnd.getTime();
        let count = 0;
        for (const [s, e] of oppRanges) {
          if (s <= ce && e >= cs) count++;
        }
        if (count === 0) return null;
        const intensity = Math.min(1, count / Math.max(3, oppRanges.length / 4));
        const alpha = 0.22 + intensity * 0.6;
        return colors.text.replace(
          /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/,
          (_, h, s, _l) => `hsla(${h}, ${s}%, 45%, ${alpha.toFixed(3)})`
        );
      },
      [oppRanges, colors.text]
    );

    const aggregateTooltip = useCallback(
      (cellStart: Date, cellEnd: Date): string | null => {
        const cs = cellStart.getTime();
        const ce = cellEnd.getTime();
        let count = 0;
        for (const [s, e] of oppRanges) {
          if (s <= ce && e >= cs) count++;
        }
        if (count === 0) return null;
        return `${count} opp${count > 1 ? "s" : ""}`;
      },
      [oppRanges]
    );

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: colors.bg,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          transition: "opacity 0.3s ease",
          "&:hover": { opacity: 0.92 },
        }}
      >
        {/* Left column — staffing GROUP_STYLES[0]: px:2 py:1.25 */}
        <Box
          sx={{
            width: leftColumnWidth,
            minWidth: leftColumnWidth,
            flexShrink: 0,
            px: 2,
            py: 1.25,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            cursor: "pointer",
            userSelect: "none",
            overflow: "hidden",
          }}
          onClick={onToggleCollapsed}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {collapsed ? (
              <ChevronRightIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
            )}
            <Typography
              component="span"
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "text.primary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
              title={jobcode.jobcode}
            >
              {jobcode.jobcode}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: "0.75rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexShrink: 1,
                minWidth: 0,
              }}
              title={jobcode.account}
            >
              · {jobcode.account}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: "0.75rem",
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              ({jobcode.opportunityCount})
            </Typography>

            <Box sx={{ flex: 1 }} />

            {/* Revenue pill — staffing pts pill style (GroupedEmployeeList:232) */}
            <Typography
              component="span"
              sx={{
                px: 0.5,
                py: 0.125,
                borderRadius: "9999px",
                bgcolor: "#f0f9ff",
                color: "#0369a1",
                fontWeight: 600,
                fontSize: "0.7rem",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {formatRevenue(jobcode.totalRevenue)}
            </Typography>
          </Box>
        </Box>

        {/* Right — per-group aggregate density strip */}
        <Box sx={{ flex: 1, minWidth: 0, pr: 1.5, py: 0.25 }}>
          <CellStrip
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            getCellFill={aggregateFill}
            getCellTooltip={aggregateTooltip}
            height={16}
          />
        </Box>
      </Box>
    );
  }
);
JobcodeGroupHeader.displayName = "JobcodeGroupHeader";

export { JobcodeGroupHeader };
