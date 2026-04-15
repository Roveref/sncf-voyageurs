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
import { memo, useEffect, useMemo, useCallback, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import SortIcon from "@mui/icons-material/Sort";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useTimeline } from "../../../hooks/useTimeline";
import { GanttMonthAxis } from "../../common/Gantt/GanttMonthAxis";
import { GanttTodayLine } from "../../common/Gantt/GanttTodayLine";
import { CellStrip } from "../../common/Gantt/CellStrip";
import { JobcodeGanttRow } from "./JobcodeGanttRow";
import { JobcodeGroup } from "./JobcodeGroup";
import type { JobcodeGroup as JobcodeGroupData } from "../hooks/useJobcodeOpportunities";
import { GANTT_LEFT_COL_WIDTH } from "../../../constants/gantt";

const LEFT_COLUMN_WIDTH = GANTT_LEFT_COL_WIDTH;
const ROW_HEIGHT = 52;
const MONTH_AXIS_HEIGHT = 28;
const AGGREGATE_STRIP_HEIGHT = 16;
const ROW_GAP = 12;
const MS_PER_DAY = 86_400_000;
const TODAY_PADDING_DAYS = 30;

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

const SORT_LABELS: Record<SortBy, string> = {
  date: "Date",
  revenue: "Revenue",
  status: "Status",
  name: "Nom",
};

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

    // ── Sort state (mirror of staffing's MonthHeaderBar sort controls) ──
    const [sortBy, setSortBy] = useState<SortBy>("date");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);

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

    // ── Aggregate density strip (mirror of staffing's AggregateHeatmapStrip) ──
    const oppRanges = useMemo(() => {
      const todayMs = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })();
      return allVisibleOpportunities
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
    }, [allVisibleOpportunities]);

    const aggregateFill = useCallback(
      (cellStart: Date, cellEnd: Date): string | null => {
        const cs = cellStart.getTime();
        const ce = cellEnd.getTime();
        let count = 0;
        for (const [s, e] of oppRanges) {
          if (s <= ce && e >= cs) count++;
        }
        if (count === 0) return null;
        const intensity = Math.min(1, count / 6);
        const alpha = 0.18 + intensity * 0.62;
        return `rgba(37, 99, 235, ${alpha.toFixed(3)})`;
      },
      [oppRanges]
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
        return `${count} opp${count > 1 ? "s" : ""} actives`;
      },
      [oppRanges]
    );

    // ── Sticky header "stuck" detection ──
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [isStuck, setIsStuck] = useState(false);
    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const obs = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px",
      });
      obs.observe(sentinel);
      return () => obs.disconnect();
    }, []);

    const handleSortMenuOpen = (e: React.MouseEvent<HTMLElement>) => setSortMenuAnchor(e.currentTarget);
    const handleSortMenuClose = () => setSortMenuAnchor(null);
    const handleSortByPick = (v: SortBy) => {
      setSortBy(v);
      setSortMenuAnchor(null);
    };
    const toggleSortOrder = () => setSortOrder((o) => (o === "asc" ? "desc" : "asc"));

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
          variant="outlined"
          sx={{
            borderRadius: "24px 24px 0 0",
            bgcolor: "background.paper",
            overflow: "hidden",
            borderBottom: "none",
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
              {totalOpps} opportunité{totalOpps > 1 ? "s" : ""}
              {sortedGroups ? ` · ${sortedGroups.length} jobcode${sortedGroups.length > 1 ? "s" : ""}` : ""}
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              onChange={(_, v: ZoomPreset | null) => v && applyPreset(v)}
              sx={{
                "& .MuiToggleButton-root": {
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "none",
                  px: 1.25,
                  py: 0.25,
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

        {/* Sentinel for sticky-stuck detection */}
        <Box ref={sentinelRef} sx={{ height: 0, visibility: "hidden" }} />

        {/* Sticky timeline header — month axis + density strip + left-col controls */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 9,
            isolation: "isolate",
          }}
        >
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              bgcolor: "background.paper",
              px: 3,
              py: 1,
              borderRadius: isStuck ? "0 0 24px 24px" : 0,
              transition: "box-shadow 0.3s ease, border-radius 0.3s ease",
              boxShadow: isStuck ? "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)" : "none",
              borderLeft: isStuck ? "none" : "1px solid",
              borderRight: isStuck ? "none" : "1px solid",
              borderColor: "divider",
            }}
          >
            {/* Month axis row */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {/* Left col — sort controls (mirrors staffing's MonthHeaderBar left col) */}
              <Box
                sx={{
                  width: LEFT_COLUMN_WIDTH,
                  minWidth: LEFT_COLUMN_WIDTH,
                  flexShrink: 0,
                  height: MONTH_AXIS_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.25,
                  px: 1.25,
                }}
              >
                <Tooltip title={`Trier par : ${SORT_LABELS[sortBy]}`} arrow>
                  <IconButton
                    size="small"
                    onClick={handleSortMenuOpen}
                    sx={{
                      p: 0.25,
                      borderRadius: 0.5,
                      color: "text.secondary",
                    }}
                  >
                    <SortIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={sortMenuAnchor}
                  open={Boolean(sortMenuAnchor)}
                  onClose={handleSortMenuClose}
                  MenuListProps={{ dense: true }}
                >
                  {(["date", "revenue", "status", "name"] as SortBy[]).map((opt) => (
                    <MenuItem
                      key={opt}
                      selected={sortBy === opt}
                      onClick={() => handleSortByPick(opt)}
                      sx={{ fontSize: "0.8125rem" }}
                    >
                      {SORT_LABELS[opt]}
                    </MenuItem>
                  ))}
                </Menu>
                <Tooltip title={sortOrder === "asc" ? "Croissant" : "Décroissant"} arrow>
                  <IconButton
                    size="small"
                    onClick={toggleSortOrder}
                    sx={{ p: 0.25, borderRadius: 0.5, color: "text.secondary" }}
                  >
                    {sortOrder === "asc" ? (
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <Box sx={{ width: 1, height: 16, bgcolor: "divider", mx: 0.5 }} />
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "text.disabled",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {SORT_LABELS[sortBy]} {sortOrder === "asc" ? "↑" : "↓"}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, pr: 1.5 }}>
                <GanttMonthAxis
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  timeframe="quarter"
                  height={MONTH_AXIS_HEIGHT}
                />
              </Box>
            </Box>

            {/* Aggregate density strip row */}
            <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
              <Box
                sx={{
                  width: LEFT_COLUMN_WIDTH,
                  minWidth: LEFT_COLUMN_WIDTH,
                  flexShrink: 0,
                  pl: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Densité
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, pr: 1.5, py: 0.25 }}>
                <CellStrip
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  getCellFill={aggregateFill}
                  getCellTooltip={aggregateTooltip}
                  height={AGGREGATE_STRIP_HEIGHT}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Paper #2 — content (rows OR empty state) */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: "0 0 24px 24px",
            p: 3,
            pt: 1,
            bgcolor: "background.paper",
            position: "relative",
            overflow: "hidden",
            borderTop: "none",
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
