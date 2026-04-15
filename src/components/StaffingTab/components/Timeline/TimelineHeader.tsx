import React, { memo, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import GroupsIcon from "@mui/icons-material/Groups";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOffIcon from "@mui/icons-material/EditOff";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import SortByAlphaIcon from "@mui/icons-material/SortByAlpha";
import { MS_PER_DAY, GANTT_LEFT_COL_WIDTH, GANTT_RIGHT_PADDING, MONTHS_EN } from "../../constants";
import { useCrosshairRange } from "../../hooks/useCrosshairSync";

/**
 * Vertical "today" line overlay spanning the full gantt height.
 */
// Helper: count PeriodBar-style columns in a day range (workday=1col, Sat+Sun block=1col)
const colSpanForDayRange = (start: Date, from: number, to: number) => {
  let cols = 0,
    i = from;
  while (i < to) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) {
      cols++;
      while (i < to) {
        const dt2 = new Date(start);
        dt2.setDate(dt2.getDate() + i);
        const d2 = dt2.getDay();
        if (d2 !== 0 && d2 !== 6) break;
        i++;
      }
    } else {
      cols++;
      i++;
    }
  }
  return cols;
};

export const TodayLine = memo(({ timelineStart, timelineEnd }: any) => {
  const style = useMemo(() => {
    const start = new Date(timelineStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(timelineEnd);
    const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIdx = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
    if (todayIdx < 0 || todayIdx >= totalDays) return null;
    const todayCol = colSpanForDayRange(start, 0, todayIdx);
    const totalCols = colSpanForDayRange(start, 0, totalDays);
    const frac = (todayCol + 0.5) / totalCols;
    return {
      position: "absolute",
      top: 0,
      bottom: 0,
      zIndex: 1,
      pointerEvents: "none",
      left: `calc(${GANTT_LEFT_COL_WIDTH}px + (100% - ${GANTT_LEFT_COL_WIDTH + GANTT_RIGHT_PADDING}px) * ${frac})`,
      width: 2,
      backgroundColor: "rgba(239, 68, 68, 0.7)",
    };
  }, [timelineStart, timelineEnd]);

  if (!style) return null;

  return <Box sx={style} />;
});

TodayLine.displayName = "TodayLine";

/**
 * Semi-transparent overlay band on the timeline for crosshair sync.
 * Highlights the columns matching the hovered TU Trend bucket.
 */
export const TimelineCrosshair = memo(({ timelineStart, timelineEnd, inset = 0 }: any) => {
  const crosshair = useCrosshairRange();

  // Crosshair overlay removed — dimming is now handled by HeatmapStrip cells directly
  return null;
});

TimelineCrosshair.displayName = "TimelineCrosshair";

/**
 * Draggable month header bar with month labels.
 */
const chevronSx = {
  fontSize: 16,
  color: "text.secondary",
  transition: "transform 0.2s ease",
};

export const MonthHeaderBar = memo(
  ({
    timelineStart,
    timelineEnd,
    onMouseDown,
    onProgressiveExpand,
    onProgressiveCollapse,
    sortOrder,
    onSortOrderToggle,
    sortBy,
    onSortByChange,
    dmGroupingActive,
    onDmGroupingToggle,
    dispoRange,
    onDispoRangeChange,
    gradeTransitionOnly,
    onGradeTransitionToggle,
    mergeGradeRows,
    onMergeGradeRowsToggle,
    hideTeamTU,
    onHideTeamTUToggle,
    sapAnomalyOnly,
    onSapAnomalyToggle,
    showAllEmployees,
    onShowAllEmployeesToggle,
    bulkEditCount,
    onBulkCancelAll,
    gradeTransitionCounts,
    arrivalCounts,
    departureCounts,
    churnFilter,
    onBadgeClick,
    onMonthDoubleClick,
    showBadges = true,
    onShowBadgesToggle,
    showDetails = true,
    onShowDetailsToggle,
  }: any) => {
    const theme = useTheme();
    const SORT_CYCLE = [
      { key: "utilization", label: "TU" },
      { key: "name", label: "Name" },
      { key: "grade", label: "Grade" },
    ];
    const currentSortLabel = SORT_CYCLE.find((s) => s.key === sortBy)?.label || "TU";
    const cycleSortBy = () => {
      if (!onSortByChange) return;
      const idx = SORT_CYCLE.findIndex((s) => s.key === sortBy);
      const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
      onSortByChange(next.key);
    };
    const months = useMemo(() => {
      const start = new Date(timelineStart);
      const end = new Date(timelineEnd);
      const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
      const result: { label: string; s: number; e: number; cols: number }[] = [];
      let cur = -1,
        ms = 0;
      for (let d = 0; d < totalDays; d++) {
        const dt = new Date(start);
        dt.setDate(dt.getDate() + d);
        const m = dt.getMonth();
        if (m !== cur) {
          if (cur !== -1) result.push({ label: MONTHS_EN[cur], s: ms, e: d, cols: 0 });
          cur = m;
          ms = d;
        }
      }
      if (cur !== -1) result.push({ label: MONTHS_EN[cur], s: ms, e: totalDays, cols: 0 });

      // Compute column-based spans matching PeriodBar model (workday=1col, Sat+Sun=1col)
      const totalCols = colSpanForDayRange(start, 0, totalDays);
      for (const item of result) {
        item.cols = colSpanForDayRange(start, item.s, item.e);
      }

      return { items: result, totalDays, totalCols };
    }, [timelineStart, timelineEnd]);

    const controlBtnSx = (active: boolean) => ({
      p: 0.25,
      borderRadius: 0.5,
      backgroundColor: active ? theme.palette.grey[400] : "transparent",
      color: active ? theme.palette.getContrastText(theme.palette.grey[400]) : "text.secondary",
      "&:hover": { backgroundColor: active ? theme.palette.grey[500] : theme.palette.grey[200] },
    });

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Left column: expand/collapse + sort + grouping + availability */}
        <Box
          sx={{
            flexShrink: 0,
            width: GANTT_LEFT_COL_WIDTH,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            overflow: "visible",
          }}
        >
          <Tooltip title="Collapse one level" placement="top">
            <IconButton size="small" onClick={onProgressiveCollapse} sx={{ p: 0.25 }}>
              <ChevronRightIcon sx={{ ...chevronSx, transform: "rotate(-90deg)" }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Expand one level" placement="top">
            <IconButton size="small" onClick={onProgressiveExpand} sx={{ p: 0.25 }}>
              <ExpandMoreIcon sx={chevronSx} />
            </IconButton>
          </Tooltip>

          <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />

          <Tooltip
            title={sortOrder === "asc" ? "Ascending sort — click to reverse" : "Descending sort — click to reverse"}
            placement="top"
          >
            <IconButton size="small" onClick={onSortOrderToggle} sx={controlBtnSx(false)}>
              {sortOrder === "asc" ? (
                <ArrowUpwardIcon sx={{ fontSize: 16 }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>

          {onSortByChange && (
            <Tooltip title={`Sort by: ${currentSortLabel} — click to cycle`} placement="top">
              <IconButton size="small" onClick={cycleSortBy} sx={{ ...controlBtnSx(false), minWidth: 0, px: 0.5 }}>
                <Typography sx={{ fontSize: 9, fontWeight: 700, color: "text.secondary", lineHeight: 1 }}>
                  {currentSortLabel}
                </Typography>
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />

          <Tooltip title={dmGroupingActive ? "Disable DM grouping" : "Enable DM grouping"} placement="top">
            <IconButton size="small" onClick={onDmGroupingToggle} sx={controlBtnSx(dmGroupingActive)}>
              <AccountTreeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {onDispoRangeChange && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Box sx={{ width: 90, display: "flex", alignItems: "center", mx: 0.5 }}>
                <Slider
                  value={dispoRange}
                  onChange={(_, v) => onDispoRangeChange(v as number[])}
                  min={0}
                  max={100}
                  step={5}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                  disableSwap
                  sx={{
                    color: dispoRange[0] > 0 || dispoRange[1] < 100 ? "primary.main" : "grey.400",
                    "& .MuiSlider-thumb": { width: 12, height: 12 },
                    "& .MuiSlider-rail": { opacity: 0.3 },
                  }}
                />
              </Box>
            </>
          )}

          {onGradeTransitionToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={gradeTransitionOnly ? "Show all employees" : "Filter grade transitions"} placement="top">
                <IconButton size="small" onClick={onGradeTransitionToggle} sx={controlBtnSx(gradeTransitionOnly)}>
                  <TrendingUpIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onMergeGradeRowsToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={mergeGradeRows ? "Split rows by grade" : "Merge grade changes"} placement="top">
                <IconButton size="small" onClick={onMergeGradeRowsToggle} sx={controlBtnSx(!mergeGradeRows)}>
                  <CallMergeIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onHideTeamTUToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={hideTeamTU ? "Show Team TU rows" : "Hide Team TU rows"} placement="top">
                <IconButton size="small" onClick={onHideTeamTUToggle} sx={controlBtnSx(hideTeamTU)}>
                  <GroupsIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onSapAnomalyToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip
                title={sapAnomalyOnly ? "Show all employees" : "Filter SAP anomalies (missing/overcharged)"}
                placement="top"
              >
                <IconButton
                  size="small"
                  onClick={onSapAnomalyToggle}
                  sx={{
                    ...controlBtnSx(sapAnomalyOnly),
                    ...(sapAnomalyOnly
                      ? { backgroundColor: "#f97316", color: "#fff", "&:hover": { backgroundColor: "#ea580c" } }
                      : {}),
                  }}
                >
                  <ReportProblemIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onShowBadgesToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={showBadges ? "Hide badges" : "Show badges"} placement="top">
                <IconButton size="small" onClick={onShowBadgesToggle} sx={controlBtnSx(showBadges)}>
                  <LocalOfferIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onShowDetailsToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={showDetails ? "Hide details" : "Show details"} placement="top">
                <IconButton size="small" onClick={onShowDetailsToggle} sx={controlBtnSx(showDetails)}>
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {onShowAllEmployeesToggle && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip
                title={showAllEmployees ? "Show only filtered employees" : "Show all employees (keep filtered TU)"}
                placement="top"
              >
                <IconButton
                  size="small"
                  onClick={onShowAllEmployeesToggle}
                  sx={{
                    ...controlBtnSx(showAllEmployees),
                    ...(showAllEmployees
                      ? { backgroundColor: "#8b5cf6", color: "#fff", "&:hover": { backgroundColor: "#7c3aed" } }
                      : {}),
                  }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {bulkEditCount > 0 && (
            <>
              <Box sx={{ width: "1px", height: 16, bgcolor: "divider", mx: 0.25 }} />
              <Tooltip title={`Close all editors (${bulkEditCount})`} placement="top">
                <IconButton
                  size="small"
                  onClick={onBulkCancelAll}
                  sx={{
                    ...controlBtnSx(false),
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    "&:hover": { backgroundColor: "#1d4ed8" },
                  }}
                >
                  <EditOffIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
        {/* Right column: month labels */}
        <Box sx={{ flex: 1, pr: 1.5 }}>
          <Box
            sx={{ display: "flex", userSelect: "none", cursor: "grab", overflow: "visible", position: "relative" }}
            onMouseDown={onMouseDown}
          >
            {(() => {
              const start = new Date(timelineStart);
              start.setHours(0, 0, 0, 0);
              const total = months.totalDays;

              // Build per-month arrival/departure counts
              const monthArrDep: Map<number, { arr: number; dep: number }> = new Map();
              const addToMonth = (countsMap: Map<string, number> | null, field: "arr" | "dep") => {
                if (!countsMap) return;
                countsMap.forEach((count: number, dateStr: string) => {
                  const d = new Date(dateStr + "T00:00:00");
                  const dayIdx = Math.round((d.getTime() - start.getTime()) / MS_PER_DAY);
                  if (dayIdx < 0 || dayIdx >= total) return;
                  const segIdx = months.items.findIndex((m) => dayIdx >= m.s && dayIdx < m.e);
                  if (segIdx < 0) return;
                  const entry = monthArrDep.get(segIdx) || { arr: 0, dep: 0 };
                  entry[field] += count;
                  monthArrDep.set(segIdx, entry);
                });
              };
              addToMonth(arrivalCounts, "arr");
              addToMonth(departureCounts, "dep");

              // Grade transition badges: position centered on month boundary dividers
              const boundaries: number[] = [0]; // include timeline start as boundary
              for (let bi = 1; bi < months.items.length; bi++) boundaries.push(months.items[bi].s);
              const gtBadges: React.ReactNode[] = [];
              if (gradeTransitionCounts) {
                const byBoundary = new Map<number, { count: number; monthKey: string }>();
                gradeTransitionCounts.forEach((count: number, dateStr: string) => {
                  const d = new Date(dateStr + "T00:00:00");
                  const dayIdx = Math.round((d.getTime() - start.getTime()) / MS_PER_DAY);
                  if (dayIdx < 0 || dayIdx >= total) return;
                  // Snap to nearest month boundary for visual centering on divider
                  let best = boundaries[0];
                  let bestDist = Math.abs(dayIdx - best);
                  for (let bi = 1; bi < boundaries.length; bi++) {
                    const dist = Math.abs(dayIdx - boundaries[bi]);
                    if (dist < bestDist) {
                      bestDist = dist;
                      best = boundaries[bi];
                    }
                  }
                  const existing = byBoundary.get(best);
                  byBoundary.set(best, { count: (existing?.count || 0) + count, monthKey: dateStr.slice(0, 7) });
                });
                byBoundary.forEach(({ count, monthKey: gtMonthKey }, bDay) => {
                  const leftPct = (colSpanForDayRange(start, 0, bDay) / months.totalCols) * 100;
                  const isActive = churnFilter === `gt::${gtMonthKey}`;
                  gtBadges.push(
                    <Box
                      key={`gt-${bDay}`}
                      onClick={
                        onBadgeClick
                          ? (e) => {
                              e.stopPropagation();
                              onBadgeClick("gt", gtMonthKey);
                            }
                          : undefined
                      }
                      sx={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 20,
                        cursor: onBadgeClick ? "pointer" : "default",
                        opacity: isActive ? 1 : churnFilter ? 0.4 : 1,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        backgroundColor: "#7c3aed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1,
                        "&:hover": onBadgeClick ? { transform: "translate(-50%, -50%) scale(1.15)" } : {},
                      }}
                    >
                      {count}
                    </Box>
                  );
                });
              }

              return (
                <>
                  {months.items.map((m, i) => {
                    const ad = monthArrDep.get(i);
                    // Compute month key (YYYY-MM) for this segment
                    const segDate = new Date(start);
                    segDate.setDate(segDate.getDate() + m.s);
                    const monthKey = `${segDate.getFullYear()}-${String(segDate.getMonth() + 1).padStart(2, "0")}`;
                    return (
                      <Box
                        key={i}
                        onDoubleClick={
                          onMonthDoubleClick
                            ? (e) => {
                                e.stopPropagation();
                                const mStart = new Date(segDate.getFullYear(), segDate.getMonth(), 1);
                                const mEnd = new Date(segDate.getFullYear(), segDate.getMonth() + 1, 1);
                                const pad = (n: number) => String(n).padStart(2, "0");
                                const fmt = (d: Date) =>
                                  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                                onMonthDoubleClick(fmt(mStart), fmt(mEnd));
                              }
                            : undefined
                        }
                        sx={{
                          textAlign: "center",
                          fontSize: "0.75rem",
                          fontWeight: 400,
                          color: "#374151",
                          width: `${((m.cols || m.e - m.s) / months.totalCols) * 100}%`,
                          borderLeft: "1px solid",
                          borderColor: "divider",
                          py: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {showBadges && ad && ad.arr > 0 && (
                          <Box
                            onClick={
                              onBadgeClick
                                ? (e) => {
                                    e.stopPropagation();
                                    onBadgeClick("arr", monthKey);
                                  }
                                : undefined
                            }
                            sx={{
                              position: "absolute",
                              left: "25%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              backgroundColor: "#16a34a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              fontWeight: 700,
                              color: "#fff",
                              lineHeight: 1,
                              cursor: onBadgeClick ? "pointer" : "default",
                              opacity: churnFilter === `arr::${monthKey}` ? 1 : churnFilter ? 0.4 : 1,
                              "&:hover": onBadgeClick ? { transform: "translate(-50%, -50%) scale(1.15)" } : {},
                              zIndex: 2,
                            }}
                          >
                            {ad.arr}
                          </Box>
                        )}
                        {m.label}
                        {showBadges && ad && ad.dep > 0 && (
                          <Box
                            onClick={
                              onBadgeClick
                                ? (e) => {
                                    e.stopPropagation();
                                    onBadgeClick("dep", monthKey);
                                  }
                                : undefined
                            }
                            sx={{
                              position: "absolute",
                              left: "75%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              backgroundColor: "#dc2626",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              fontWeight: 700,
                              color: "#fff",
                              lineHeight: 1,
                              cursor: onBadgeClick ? "pointer" : "default",
                              opacity: churnFilter === `dep::${monthKey}` ? 1 : churnFilter ? 0.4 : 1,
                              "&:hover": onBadgeClick ? { transform: "translate(-50%, -50%) scale(1.15)" } : {},
                              zIndex: 2,
                            }}
                          >
                            {ad.dep}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  {showBadges && gtBadges}
                </>
              );
            })()}
          </Box>
        </Box>
      </Box>
    );
  }
);

MonthHeaderBar.displayName = "MonthHeaderBar";
