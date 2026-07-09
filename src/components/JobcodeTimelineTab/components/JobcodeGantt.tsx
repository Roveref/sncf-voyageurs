/**
 * JobcodeGantt — main Gantt view for the JobcodeTimelineTab.
 *
 * Visual parity with staffing's GanttSection.tsx:
 *   - Two stacked Papers (FilterHeader top + Employee content bottom)
 *     visually merged via shared rounded corners.
 *   - Sticky timeline header sandwiched between them, containing:
 *       · sort controls in the left column (~MonthHeaderBar)
 *       · the month axis
 *       · an aggregate density strip
 *   - Rows live inside Paper #2 with `p:3 pt:1` padding.
 *
 * Always renders — empty / no-results states are handled inline so that
 * the filter bar (passed via `filterBarSlot`) stays visible at all times.
 */
import { memo, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { useTimeline } from "../../../hooks/useTimeline";
import { GanttTodayLine } from "../../common/Gantt/GanttTodayLine";
import { JobcodeGanttRow } from "./JobcodeGanttRow";
import { JobcodeGroup } from "./JobcodeGroup";
import type { JobcodeGroup as JobcodeGroupData } from "../hooks/useJobcodeOpportunities";
import { GANTT_LEFT_COL_WIDTH } from "../../../constants/gantt";

const LEFT_COLUMN_WIDTH = GANTT_LEFT_COL_WIDTH;
const ROW_HEIGHT = 52;
const ROW_GAP = 12;
const MS_PER_DAY = 86_400_000;

type ZoomPreset = "all" | "2y" | "1y" | "6m" | "3m" | "1m";

const PRESETS: { value: ZoomPreset; label: string; days: number | "all" }[] = [
  { value: "all", label: "Tout", days: "all" },
  { value: "2y", label: "2 ans", days: 730 },
  { value: "1y", label: "1 an", days: 365 },
  { value: "6m", label: "6 mois", days: 183 },
  { value: "3m", label: "3 mois", days: 91 },
  { value: "1m", label: "Mois", days: 30 },
];

type SortBy = "date" | "revenue" | "status" | "name";
type SortOrder = "asc" | "desc";

const fmtLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseMs = (v?: string | null): number => {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const computeAutoRange = (opportunities: Record<string, unknown>[]): { start: string; end: string } | null => {
  if (!opportunities.length) return null;
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  const consider = (v: unknown) => {
    if (typeof v !== "string") return;
    const ms = new Date(v).getTime();
    if (!Number.isFinite(ms)) return;
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  };
  for (const opp of opportunities) {
    consider((opp as { creationDate?: string }).creationDate);
    consider((opp as { bookingDate?: string }).bookingDate);
    consider((opp as { lastStatusChangeDate?: string }).lastStatusChangeDate);
  }
  if (!Number.isFinite(minMs)) return null;
  const today = Date.now();
  const padded = Math.max(maxMs, today + 30 * MS_PER_DAY);
  const start = new Date(minMs - 15 * MS_PER_DAY);
  const end = new Date(padded + 15 * MS_PER_DAY);
  return { start: fmtLocalDate(start), end: fmtLocalDate(end) };
};

const sortComparator = (sortBy: SortBy, sortOrder: SortOrder) => {
  const dir = sortOrder === "asc" ? 1 : -1;
  return (a: Record<string, unknown>, b: Record<string, unknown>): number => {
    let v = 0;
    if (sortBy === "date") {
      const ad = parseMs((a.creationDate as string) || (a.bookingDate as string));
      const bd = parseMs((b.creationDate as string) || (b.bookingDate as string));
      v = (Number.isFinite(ad) ? ad : 0) - (Number.isFinite(bd) ? bd : 0);
    } else if (sortBy === "revenue") {
      v = ((a.grossRevenue as number) || 0) - ((b.grossRevenue as number) || 0);
    } else if (sortBy === "status") {
      v = ((a.status as number) || 0) - ((b.status as number) || 0);
    } else if (sortBy === "name") {
      v = String((a.opportunity as string) || "").localeCompare(String((b.opportunity as string) || ""), "fr");
    }
    return v * dir;
  };
};

interface JobcodeGanttProps {
  /** Filter bar rendered inside Paper #1 above the zoom toolbar. */
  filterBarSlot?: ReactNode;
  /** Optional secondary slot rendered to the right of the filter bar (e.g. New BCS). */
  filterBarRightSlot?: ReactNode;
  /** Grouped view: non-null when groupByJobcode is true. */
  groups?: JobcodeGroupData[];
  /** Flat view: non-null when groupByJobcode is false. */
  flatOpportunities?: Record<string, unknown>[];
  /** Used for auto-fit range and the total count display. */
  allVisibleOpportunities: Record<string, unknown>[];
  /** Whether the consumer thinks the data section should render. False → empty state. */
  showContent?: boolean;
  /** Empty-state title (shown when showContent is false). */
  emptyTitle?: string;
  /** Empty-state body. */
  emptyBody?: string;
  onOpportunityClick?: (opp: Record<string, unknown>) => void;
}

const JobcodeGantt = memo(
  ({
    filterBarSlot,
    filterBarRightSlot,
    groups,
    flatOpportunities,
    allVisibleOpportunities,
    showContent = true,
    emptyTitle,
    emptyBody,
    onOpportunityClick,
  }: JobcodeGanttProps) => {
    const { timelineStart, timelineEnd, setCustomDateRangeDirect, handleZoomIn, handleZoomOut } = useTimeline();

    const totalOpps = allVisibleOpportunities.length;

    // ── Sort: fixed default (date desc) since the sort toolbar was removed ──
    const sortBy: SortBy = "date";
    const sortOrder: SortOrder = "desc";

    const sortedFlat = useMemo(() => {
      if (!flatOpportunities) return undefined;
      return [...flatOpportunities].sort(sortComparator(sortBy, sortOrder));
    }, [flatOpportunities, sortBy, sortOrder]);

    const sortedGroups = useMemo(() => {
      if (!groups) return undefined;
      const cmp = sortComparator(sortBy, sortOrder);
      return groups.map((g) => ({ ...g, opportunities: [...g.opportunities].sort(cmp) }));
    }, [groups, sortBy, sortOrder]);

    // ── Auto-fit timeline to the visible opportunities ──
    const rangeSignature = useMemo(() => {
      if (!allVisibleOpportunities.length) return "";
      let minMs = Number.POSITIVE_INFINITY;
      let maxMs = Number.NEGATIVE_INFINITY;
      for (const opp of allVisibleOpportunities) {
        const cd = (opp as { creationDate?: string }).creationDate;
        const bd = (opp as { bookingDate?: string }).bookingDate;
        if (cd) {
          const ms = new Date(cd).getTime();
          if (Number.isFinite(ms)) minMs = Math.min(minMs, ms);
        }
        if (bd) {
          const ms = new Date(bd).getTime();
          if (Number.isFinite(ms)) maxMs = Math.max(maxMs, ms);
        }
      }
      return `${minMs}|${maxMs}|${allVisibleOpportunities.length}`;
    }, [allVisibleOpportunities]);

    useEffect(() => {
      const range = computeAutoRange(allVisibleOpportunities);
      if (range) setCustomDateRangeDirect(range.start, range.end);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangeSignature]);

    const applyPreset = useCallback(
      (preset: ZoomPreset) => {
        if (preset === "all") {
          const range = computeAutoRange(allVisibleOpportunities);
          if (range) setCustomDateRangeDirect(range.start, range.end);
          return;
        }
        const days = PRESETS.find((p) => p.value === preset)?.days;
        if (typeof days !== "number") return;
        const auto = computeAutoRange(allVisibleOpportunities);
        const today = Date.now();
        const jobMid = auto != null ? (new Date(auto.start).getTime() + new Date(auto.end).getTime()) / 2 : today;
        const insideJobcode =
          auto != null && today >= new Date(auto.start).getTime() && today <= new Date(auto.end).getTime();
        const centre = insideJobcode ? today : jobMid;
        const half = (days * MS_PER_DAY) / 2;
        const start = new Date(centre - half);
        const end = new Date(centre + half);
        setCustomDateRangeDirect(fmtLocalDate(start), fmtLocalDate(end));
      },
      [allVisibleOpportunities, setCustomDateRangeDirect]
    );

    return (
      <Box
        sx={{
          animation: "fadeInUp 0.6s ease 200ms both",
          "@keyframes fadeInUp": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {/* Paper #1 — filter bar + zoom toolbar (mirrors staffing FilterHeader paper) */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: showContent ? "24px 24px 0 0" : 3,
            bgcolor: "background.paper",
            overflow: "hidden",
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {(filterBarSlot || filterBarRightSlot) && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              {filterBarSlot && <Box sx={{ flex: 1, minWidth: 0 }}>{filterBarSlot}</Box>}
              {filterBarRightSlot && <Box sx={{ flexShrink: 0 }}>{filterBarRightSlot}</Box>}
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mr: 1 }}>
              {totalOpps} actif{totalOpps > 1 ? "s" : ""}
              {sortedGroups ? ` · ${sortedGroups.length} projet${sortedGroups.length > 1 ? "s" : ""}` : ""}
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              onChange={(_, v: ZoomPreset | null) => v && applyPreset(v)}
              sx={{
                bgcolor: "action.hover",
                borderRadius: 2,
                p: 0.25,
                gap: 0.25,
                "& .MuiToggleButton-root": {
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "none",
                  px: 1.25,
                  py: 0.5,
                  border: "none",
                  borderRadius: 1.5,
                  color: "text.secondary",
                  "&.Mui-selected": {
                    bgcolor: "background.paper",
                    color: "text.primary",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    "&:hover": { bgcolor: "background.paper" },
                  },
                },
              }}
            >
              {PRESETS.map((p) => (
                <ToggleButton key={p.value} value={p.value}>
                  {p.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Zoom avant" arrow>
              <IconButton size="small" onClick={handleZoomIn}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom arrière" arrow>
              <IconButton size="small" onClick={handleZoomOut}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Paper #2 — content (rows OR empty state) */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: showContent ? "0 0 24px 24px" : 3,
            p: 3,
            pt: showContent ? 1 : 3,
            mt: showContent ? 0 : 2,
            bgcolor: "background.paper",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {showContent ? (
            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: sortedGroups != null ? "6px" : `${ROW_GAP}px`,
              }}
            >
              {sortedGroups != null
                ? sortedGroups.map((g) => (
                    <JobcodeGroup
                      key={g.jobcode.jobcode}
                      jobcode={g.jobcode}
                      opportunities={g.opportunities}
                      timelineStart={timelineStart}
                      timelineEnd={timelineEnd}
                      leftColumnWidth={LEFT_COLUMN_WIDTH}
                      rowHeight={ROW_HEIGHT}
                      onOpportunityClick={onOpportunityClick}
                    />
                  ))
                : (sortedFlat || []).map((opp, i) => (
                    <JobcodeGanttRow
                      key={(opp as { opportunityId?: string }).opportunityId || i}
                      opportunity={opp}
                      timelineStart={timelineStart}
                      timelineEnd={timelineEnd}
                      leftColumnWidth={LEFT_COLUMN_WIDTH}
                      rowHeight={ROW_HEIGHT}
                      onOpportunityClick={onOpportunityClick}
                    />
                  ))}
              <GanttTodayLine
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                leftOffsetPx={LEFT_COLUMN_WIDTH}
                rightPaddingPx={12}
                color="rgba(239, 68, 68, 0.7)"
              />
            </Box>
          ) : (
            <Box
              sx={{
                textAlign: "center",
                py: 5,
                color: "text.secondary",
              }}
            >
              {emptyTitle && (
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, mb: 0.75 }}>{emptyTitle}</Typography>
              )}
              {emptyBody && <Typography sx={{ fontSize: "0.8125rem" }}>{emptyBody}</Typography>}
            </Box>
          )}
        </Paper>
      </Box>
    );
  }
);
JobcodeGantt.displayName = "JobcodeGantt";

export { JobcodeGantt };
