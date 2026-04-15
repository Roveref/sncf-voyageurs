/**
 * EnhancedStaffingTimeline — Gantt-style timeline with 4 sections:
 * Past staffing (grey), Current staffing (blue), Upcoming staffing (amber), Staffing needs (purple).
 * Default view: M-3 to M+6. Supports horizontal pan (drag) and zoom (Ctrl+wheel).
 * Clicking a need bar selects it for editing.
 */

import React, { memo, useMemo, useState, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { getGradeColor, getGradeAbbr } from "../../StaffingTab/constants";
import { formatLocalDate } from "../../StaffingTab/utils/dateUtils";
import { buildMonthColumns } from "../staffingNeedUtils";
import type { TimelineAssignment, StagedNeed, GanttRange, MonthColumn } from "./types";
import type { StaffingNeedItem } from "../../../types/actions";

const SECTION_CONFIG = {
  past: { label: "Past staffing", color: "#9ca3af", barAlpha: 0.4 },
  current: { label: "Current staffing", color: "#3b82f6", barAlpha: 0.9 },
  upcoming: { label: "Upcoming staffing", color: "#f59e0b", barAlpha: 0.7 },
  needs: { label: "Staffing needs", color: "#8b5cf6", barAlpha: 0.8 },
} as const;

type Section = keyof typeof SECTION_CONFIG;

const BAR_HEIGHT = 24;
const ROW_HEIGHT = 32;

const dayMs = 86_400_000;

const toMs = (d: string) => new Date(d + "T00:00:00").getTime();
const fmtDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "";

/** Default minimum range: 3 months ago to 12 months ahead */
const defaultRange = (): { minDate: string; maxDate: string } => {
  const now = new Date();
  const min = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const max = new Date(now.getFullYear(), now.getMonth() + 13, 0); // end of M+12
  return { minDate: formatLocalDate(min), maxDate: formatLocalDate(max) };
};

interface EnhancedStaffingTimelineProps {
  pastAssignments: TimelineAssignment[];
  currentAssignments: TimelineAssignment[];
  upcomingAssignments: TimelineAssignment[];
  existingNeeds: StaffingNeedItem[];
  stagedNeeds: StagedNeed[];
  previewNeed: { grade: string; startDate: string; endDate: string; utilization: number } | null;
  lastAddedId: string | null;
  editingExistingNeedId?: string | null;
  editingNeedId?: string | null;
  onClickNeed?: (needId: string, isExisting: boolean) => void;
}

const EnhancedStaffingTimeline = memo(
  ({
    pastAssignments,
    currentAssignments,
    upcomingAssignments,
    existingNeeds,
    stagedNeeds,
    previewNeed,
    lastAddedId,
    editingExistingNeedId,
    editingNeedId,
    onClickNeed,
  }: EnhancedStaffingTimelineProps) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const todayStr = useMemo(() => formatLocalDate(new Date()), []);

    // ── Pan & zoom state ──
    const [zoomLevel, setZoomLevel] = useState(1); // 1 = default, >1 = zoomed in
    const [panOffset, setPanOffset] = useState(0); // pixels offset (negative = scroll left)
    const dragRef = useRef<{ startX: number; startPan: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build need bars
    const needBars = useMemo(() => {
      const bars: (TimelineAssignment & { isNeed: true; isPreview?: boolean; isStaged?: boolean; needId?: string })[] =
        [];
      for (const n of existingNeeds) {
        if (n.status === "filled" || n.status === "cancelled") continue;
        bars.push({
          empId: "",
          empName: n.assignedTo || "",
          grade: n.grade || "",
          jobNo: "",
          jobName: (n.skills || []).join(", "),
          startDate: n.startDate || "",
          endDate: n.endDate || "",
          utilization: n.utilization ?? 100,
          category: "",
          isNeed: true,
          needId: n.id,
        });
      }
      for (const n of stagedNeeds) {
        bars.push({
          empId: "",
          empName: n.preferredPerson || "",
          grade: n.grade,
          jobNo: "",
          jobName: (n.skills || []).join(", "),
          startDate: n.startDate,
          endDate: n.endDate,
          utilization: n.utilization,
          category: "",
          isNeed: true,
          isStaged: true,
          needId: n.id,
        });
      }
      return bars;
    }, [existingNeeds, stagedNeeds]);

    const needsSectionItems = useMemo(() => {
      const items = [...needBars];
      if (previewNeed?.grade && previewNeed.startDate && previewNeed.endDate) {
        items.push({
          empId: "",
          empName: "",
          grade: previewNeed.grade,
          jobNo: "",
          jobName: "",
          startDate: previewNeed.startDate,
          endDate: previewNeed.endDate,
          utilization: previewNeed.utilization,
          category: "",
          isNeed: true,
          isPreview: true,
        });
      }
      return items;
    }, [needBars, previewNeed]);

    // Compute visible range: 2 months before earliest item → 2 months after latest item
    // Falls back to default M-3 to M+12 when no data
    const range = useMemo<GanttRange>(() => {
      const allItems = [...pastAssignments, ...currentAssignments, ...upcomingAssignments, ...needBars];
      if (previewNeed?.startDate) allItems.push(previewNeed as any);

      if (!allItems.length) {
        const def = defaultRange();
        return {
          minDate: def.minDate,
          maxDate: def.maxDate,
          totalDays: Math.round((toMs(def.maxDate) - toMs(def.minDate)) / dayMs) + 1,
        };
      }

      // Find actual data bounds
      let dataMin = allItems[0].startDate;
      let dataMax = allItems[0].endDate;
      for (const item of allItems) {
        if (item.startDate && (!dataMin || item.startDate < dataMin)) dataMin = item.startDate;
        if (item.endDate && (!dataMax || item.endDate > dataMax)) dataMax = item.endDate;
      }

      // Pad: 2 months before first item, 2 months after last item
      const padMin = new Date(dataMin + "T00:00:00");
      padMin.setMonth(padMin.getMonth() - 2, 1);
      const padMax = new Date(dataMax + "T00:00:00");
      padMax.setMonth(padMax.getMonth() + 3, 0); // end of month+2

      const minD = formatLocalDate(padMin);
      const maxD = formatLocalDate(padMax);
      return {
        minDate: minD,
        maxDate: maxD,
        totalDays: Math.round((toMs(maxD) - toMs(minD)) / dayMs) + 1,
      };
    }, [pastAssignments, currentAssignments, upcomingAssignments, needBars, previewNeed]);

    // Monthly columns (always computed — used for grid lines)
    const months = useMemo<MonthColumn[]>(() => {
      if (!range.minDate) return [];
      const cols = buildMonthColumns(range.minDate, range.maxDate, range.totalDays);
      const now = new Date();
      const nowY = now.getFullYear();
      const nowM = now.getMonth();
      // Tag each column with year/month for grouping
      const start = new Date(range.minDate + "T00:00:00");
      const cursor = new Date(start);
      return cols.map((c, i) => {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const isCurrent = y === nowY && m === nowM;
        cursor.setMonth(cursor.getMonth() + 1);
        return { ...c, isCurrent, _year: y, _month: m } as MonthColumn & { _year: number; _month: number };
      });
    }, [range]);

    // Adaptive label columns — merge months into quarters/semesters/years when zoomed out
    type LabelCol = { label: string; widthPct: number; isCurrent: boolean };
    const labelColumns = useMemo<LabelCol[]>(() => {
      if (!months.length) return [];
      const totalMonths = months.length;
      const avgPctPerMonth = 100 / totalMonths;
      const effectiveAvgPct = avgPctPerMonth * zoomLevel;

      // Decide granularity based on effective % per month
      // >6% → monthly, >2.5% → quarterly, >1.2% → semesterly, else → yearly
      let groupSize: number;
      let labelFn: (year: number, startMonth: number) => string;

      if (effectiveAvgPct > 6) {
        // Monthly
        groupSize = 1;
        labelFn = (y, m) => {
          const d = new Date(y, m, 1);
          return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        };
      } else if (effectiveAvgPct > 2.5) {
        // Quarterly
        groupSize = 3;
        labelFn = (y, m) => `Q${Math.floor(m / 3) + 1} ${String(y).slice(2)}`;
      } else if (effectiveAvgPct > 1.2) {
        // Semesterly
        groupSize = 6;
        labelFn = (y, m) => `${m < 6 ? "H1" : "H2"} ${String(y).slice(2)}`;
      } else {
        // Yearly
        groupSize = 12;
        labelFn = (y) => String(y);
      }

      const cols: LabelCol[] = [];
      let i = 0;
      while (i < months.length) {
        const m = months[i] as MonthColumn & { _year: number; _month: number };
        // Find the boundary: group starts at i, extends groupSize months or until end
        let groupStart: number;
        if (groupSize === 1) {
          groupStart = m._month;
        } else {
          groupStart = Math.floor(m._month / groupSize) * groupSize;
        }
        const groupEnd = groupStart + groupSize;

        let widthPct = 0;
        let hasCurrent = false;
        const startIdx = i;
        while (i < months.length) {
          const mi = months[i] as MonthColumn & { _year: number; _month: number };
          if (mi._year !== m._year || mi._month >= groupEnd) break;
          widthPct += mi.widthPct;
          if (mi.isCurrent) hasCurrent = true;
          i++;
        }
        // If we didn't advance (edge case: month starts after groupEnd), advance at least one
        if (i === startIdx) {
          widthPct = months[i].widthPct;
          if (months[i].isCurrent) hasCurrent = true;
          i++;
        }

        cols.push({
          label: labelFn(m._year, groupSize === 1 ? m._month : groupStart),
          widthPct,
          isCurrent: hasCurrent,
        });
      }
      return cols;
    }, [months, zoomLevel]);

    const todayPct = useMemo(() => {
      if (!range.minDate || !range.maxDate || todayStr < range.minDate || todayStr > range.maxDate) return null;
      const min = toMs(range.minDate);
      const max = toMs(range.maxDate);
      return ((toMs(todayStr) - min) / (max - min || 1)) * 100;
    }, [range, todayStr]);

    // ── Clamp helper: keep pan within bounds ──
    const clampPan = useCallback((offset: number, zoom: number): number => {
      if (zoom <= 1) return 0; // everything fits, no pan needed
      const cw = containerRef.current?.clientWidth || 600;
      const maxPan = 0; // can't pan past the left edge
      const minPan = -(cw * zoom - cw); // can't pan past the right edge
      return Math.max(minPan, Math.min(maxPan, offset));
    }, []);

    // ── Zoom / pan handlers ──
    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoomLevel((prev) => {
            const next = Math.max(1, Math.min(4, prev + (e.deltaY < 0 ? 0.15 : -0.15)));
            // Re-clamp pan for new zoom
            setPanOffset((p) => clampPan(p, next));
            return next;
          });
        } else {
          // Horizontal pan — only when zoomed in
          setPanOffset((p) => clampPan(p - e.deltaX - e.deltaY, zoomLevel));
        }
      },
      [zoomLevel, clampPan]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (e.button !== 0 || zoomLevel <= 1) return; // no drag when not zoomed
        dragRef.current = { startX: e.clientX, startPan: panOffset };
        e.preventDefault();
      },
      [panOffset, zoomLevel]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        setPanOffset(clampPan(dragRef.current.startPan + dx, zoomLevel));
      },
      [zoomLevel, clampPan]
    );

    const handleMouseUp = useCallback(() => {
      dragRef.current = null;
    }, []);

    const resetView = useCallback(() => {
      setZoomLevel(1);
      setPanOffset(0);
    }, []);

    // ── Bar position helpers (using range) ──
    const datePct = (dateStr: string): number => {
      if (!range.totalDays || !range.minDate) return 0;
      return ((toMs(dateStr) - toMs(range.minDate)) / (toMs(range.maxDate) - toMs(range.minDate) || 1)) * 100;
    };

    const barWidthPct = (startDate: string, endDate: string): number => {
      if (!range.totalDays) return 0;
      return ((toMs(endDate) - toMs(startDate)) / (toMs(range.maxDate) - toMs(range.minDate) || 1)) * 100;
    };

    // ── Render bar ──
    const renderBar = (
      item: TimelineAssignment & { isNeed?: boolean; isPreview?: boolean; isStaged?: boolean; needId?: string },
      section: Section,
      index: number
    ) => {
      if (!item.startDate || !item.endDate || !range.totalDays) return null;
      const gc = getGradeColor(item.grade);
      const left = datePct(item.startDate);
      const width = barWidthPct(item.startDate, item.endDate);
      const cfg = SECTION_CONFIG[section];
      const isFlash = item.needId === lastAddedId;
      const isClickable = section === "needs" && item.isNeed && !item.isPreview && onClickNeed;
      const isSelected = item.needId && (item.needId === editingExistingNeedId || item.needId === editingNeedId);

      let label = "";
      if (item.isNeed) {
        const parts = [item.isPreview ? "NEW" : item.grade || "?"];
        if (item.empName) parts.push(item.empName);
        if (item.jobName) parts.push(item.jobName);
        parts.push(`${Math.round(item.utilization)}%`);
        label = parts.join(" \u00b7 ");
      } else {
        const initials = item.empName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2);
        label = `${getGradeAbbr(item.grade)} ${initials}`;
      }

      const tooltipParts = [
        item.grade || "?",
        `${fmtDate(item.startDate)} \u2013 ${fmtDate(item.endDate)}`,
        `${Math.round(item.utilization)}%`,
      ];
      if (item.isNeed && item.empName) tooltipParts.push(item.empName);
      if (item.isNeed && item.jobName) tooltipParts.push(item.jobName);
      tooltipParts.push(item.isNeed ? (item.isPreview ? "Preview" : item.isStaged ? "New" : "Open") : item.empName);
      const tooltipText = item.isNeed
        ? tooltipParts.join(" \u00b7 ")
        : `${item.grade} \u00b7 ${fmtDate(item.startDate)} \u2013 ${fmtDate(item.endDate)} \u00b7 ${item.empName} \u00b7 ${Math.round(item.utilization)}%`;

      return (
        <Tooltip key={`${section}-${index}`} title={tooltipText} arrow placement="top" enterDelay={200}>
          <Box
            onClick={isClickable ? () => onClickNeed!(item.needId!, !item.isStaged) : undefined}
            sx={{
              position: "absolute",
              left: `${left}%`,
              width: `${Math.max(width, 1.5)}%`,
              height: BAR_HEIGHT,
              top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
              borderRadius: "5px",
              display: "flex",
              alignItems: "center",
              px: 1,
              overflow: "hidden",
              whiteSpace: "nowrap",
              cursor: isClickable ? "pointer" : "default",
              opacity: cfg.barAlpha,
              bgcolor: gc.bg || cfg.color,
              color: gc.text || "#fff",
              ...(section === "needs" && {
                border: `2px dashed ${alpha(gc.text || cfg.color, 0.4)}`,
                bgcolor: alpha(gc.bg || cfg.color, isDark ? 0.2 : 0.5),
              }),
              ...(isSelected && {
                outline: `2px solid ${gc.text || cfg.color}`,
                outlineOffset: 1,
                opacity: 1,
                boxShadow: `0 0 8px ${alpha(gc.text || cfg.color, 0.3)}`,
              }),
              ...(item.isPreview && {
                animation: "pulseNeed 1.8s ease infinite",
                "@keyframes pulseNeed": {
                  "0%, 100%": { boxShadow: "none" },
                  "50%": { boxShadow: `0 0 10px ${alpha(cfg.color, 0.4)}` },
                },
              }),
              ...(isFlash && {
                animation: "flashGlow 0.7s ease",
                "@keyframes flashGlow": {
                  "0%, 100%": { boxShadow: "none" },
                  "50%": { boxShadow: `0 0 12px ${alpha(theme.palette.success.main, 0.5)}` },
                },
              }),
              "&:hover": { filter: "brightness(1.1)", ...(isClickable && { opacity: 1 }) },
            }}
          >
            <Typography
              sx={{
                fontSize: "0.62rem",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "inherit",
              }}
            >
              {label}
            </Typography>
          </Box>
        </Tooltip>
      );
    };

    const renderSection = (
      section: Section,
      items: (TimelineAssignment & { isNeed?: boolean; isPreview?: boolean; isStaged?: boolean; needId?: string })[]
    ) => {
      const cfg = SECTION_CONFIG[section];
      return (
        <Box key={section} sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 2, pt: 0.75, pb: 0.25, flexShrink: 0 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: cfg.color, flexShrink: 0 }} />
            <Typography
              sx={{
                fontSize: "0.62rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: cfg.color,
              }}
            >
              {cfg.label}
            </Typography>
            <Typography sx={{ fontSize: "0.58rem", color: "text.disabled", ml: 0.25 }}>({items.length})</Typography>
          </Box>
          {items.length === 0 ? (
            <Box sx={{ px: 3, py: 0.5, flex: 1 }}>
              <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", fontStyle: "italic" }}>None</Typography>
            </Box>
          ) : (
            <Box sx={{ py: 0.25, flex: 1 }}>
              {items.map((item, i) => (
                <Box key={`${section}-row-${i}`} sx={{ position: "relative", height: ROW_HEIGHT }}>
                  {renderBar(item, section, i)}
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ mx: 2, my: 0.5, borderBottom: 1, borderColor: alpha(theme.palette.divider, 0.5) }} />
        </Box>
      );
    };

    const innerWidth = `${100 * zoomLevel}%`;

    return (
      <Box
        sx={{
          borderRadius: 2.5,
          overflow: "hidden",
          bgcolor: "background.paper",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700 }}>Staffing Timeline</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {/* Legend */}
            {(Object.keys(SECTION_CONFIG) as Section[]).map((s) => (
              <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.3, mr: 0.75 }}>
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: "2px",
                    bgcolor: SECTION_CONFIG[s].color,
                    ...(s === "needs" && { border: `1.5px dashed ${SECTION_CONFIG[s].color}`, bgcolor: "transparent" }),
                  }}
                />
                <Typography sx={{ fontSize: "0.58rem", fontWeight: 500, color: "text.secondary" }}>
                  {SECTION_CONFIG[s].label.split(" ")[0]}
                </Typography>
              </Box>
            ))}
            {/* Zoom controls */}
            <IconButton
              size="small"
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.3))}
              sx={{ width: 24, height: 24 }}
            >
              <ZoomInIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.3))}
              sx={{ width: 24, height: 24 }}
            >
              <ZoomOutIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton size="small" onClick={resetView} sx={{ width: 24, height: 24 }}>
              <CenterFocusStrongIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Scrollable / pannable body */}
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          sx={{
            overflow: "hidden",
            cursor: zoomLevel <= 1 ? "default" : dragRef.current ? "grabbing" : "grab",
            userSelect: "none",
            flex: 1,
            minHeight: 0,
          }}
        >
          {months.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.disabled" sx={{ fontSize: "0.78rem" }}>
                Select an opportunity to see staffing assignments
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                width: innerWidth,
                transform: `translateX(${panOffset}px)`,
                transition: dragRef.current ? "none" : "transform 0.1s ease",
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              {/* Adaptive label axis */}
              <Box sx={{ display: "flex", borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
                {labelColumns.map((col, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: `${col.widthPct}%`,
                      textAlign: "center",
                      py: 0.75,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      color: col.isCurrent ? "info.main" : "text.secondary",
                      bgcolor: col.isCurrent ? alpha(theme.palette.info.main, 0.03) : "transparent",
                      borderRight: 1,
                      borderColor: alpha(theme.palette.divider, 0.3),
                      textTransform: "uppercase",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      px: 0.5,
                    }}
                  >
                    {col.label}
                  </Box>
                ))}
              </Box>

              {/* Timeline body */}
              <Box
                sx={{ position: "relative", py: 0.5, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              >
                {/* Grid lines */}
                <Box sx={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
                  {months.map((m, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: `${m.widthPct}%`,
                        borderRight: 1,
                        borderColor: alpha(theme.palette.divider, 0.15),
                        bgcolor: m.isCurrent ? alpha(theme.palette.info.main, 0.02) : "transparent",
                      }}
                    />
                  ))}
                </Box>

                {/* Today line */}
                {todayPct !== null && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: `${todayPct}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      bgcolor: theme.palette.primary.main,
                      opacity: 0.5,
                      zIndex: 10,
                      "&::before": {
                        content: '"Today"',
                        position: "absolute",
                        top: -1,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "0.52rem",
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        bgcolor: "background.paper",
                        px: 0.4,
                        borderRadius: "2px",
                        whiteSpace: "nowrap",
                      },
                    }}
                  />
                )}

                {/* Sections */}
                {renderSection("past", pastAssignments as any)}
                {renderSection("current", currentAssignments as any)}
                {renderSection("upcoming", upcomingAssignments as any)}
                {renderSection("needs", needsSectionItems)}
              </Box>
            </Box>
          )}
        </Box>

        {/* Stats bar */}
        <Box
          sx={{
            display: "flex",
            gap: 2.5,
            px: 2,
            py: 0.75,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
            <b>{currentAssignments.length}</b> current
          </Typography>
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
            <b>{upcomingAssignments.length}</b> upcoming
          </Typography>
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
            <b>{existingNeeds.filter((n) => n.status !== "filled" && n.status !== "cancelled").length}</b> open needs
          </Typography>
          {stagedNeeds.length > 0 && (
            <Typography sx={{ fontSize: "0.65rem", color: SECTION_CONFIG.needs.color, fontWeight: 600 }}>
              <b>{stagedNeeds.length}</b> new
            </Typography>
          )}
          {zoomLevel !== 1 && (
            <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", ml: "auto" }}>
              {Math.round(zoomLevel * 100)}%
            </Typography>
          )}
        </Box>
      </Box>
    );
  }
);

EnhancedStaffingTimeline.displayName = "EnhancedStaffingTimeline";
export default EnhancedStaffingTimeline;
