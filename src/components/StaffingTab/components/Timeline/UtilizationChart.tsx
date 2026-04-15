import React, { memo, useMemo, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { getCategoryLabel, isChargeableCategory } from "../../utils/categoryUtils";
import { CATEGORY_THEME } from "../../constants/theme";
import {
  JOB_CATEGORIES,
  ABSENCE_CATS,
  CHARGEABLE_CATS,
  GO_CATS,
  TRAINING_CATS,
  MS_PER_DAY,
  getHoursPerDay,
} from "../../constants";
import { isHolidayEnabled } from "../../utils/dateUtils";
// ─── Category colors (same as Level 2 for consistency) ──────────────────────
const getCatColor = (cat: string) => CATEGORY_THEME[cat]?.hex || "#d1d5db";

const CHART_HEIGHT = 54;
const GAP_FRAC = 0.15; // fraction of column-width used as gap
const MONTHS_FR = ["Jan", "Fev", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sep", "Oct", "Nov", "Dec"];

// Category sets imported from constants (ABSENCE_CATS, CHARGEABLE_CATS, GO_CATS, TRAINING_CATS)

// Stacking order for work segments (bottom to top): chargeable, general oppty, reservation, training, other
const WORK_CAT_ORDER = {
  chargeable: 0,
  pending: 0,
  overtime: 0,
  generalOppty: 1,
  reservation: 2,
  training: 3,
  meeting: 4,
  event: 4,
  admin: 4,
  corporate: 4,
  community: 4,
  businessDev: 4,
  travel: 4,
  travelWe: 4,
};
const getWorkCatOrder = (cat: string) => (WORK_CAT_ORDER as Record<string, number>)[cat] ?? 4;

// ─── Build day-by-day stacked data + column layout (merged weekends) ────────
const buildChartData = (
  assignments: any,
  timelineStart: any,
  timelineEnd: any,
  enabledHolidayDates: any[] = [],
  sapDayData: any = null,
  grade?: string
) => {
  const HOURS_PER_DAY = getHoursPerDay(grade);
  const start = new Date(timelineStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(timelineEnd);
  end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  if (totalDays <= 0) return null;

  // ── Build per-day data ──
  const days: any[] = [];
  let maxTotal = 0;
  const usedCats = new Set<string>();

  for (let d = 0; d < totalDays; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;

    const workSegments: any[] = [];
    const absenceSegments: any[] = [];
    let workTotal = 0;
    let absenceTotal = 0;
    let holidayTotal = 0;
    let chargeableTotal = 0;
    let trainingTotal = 0;
    let reservationTotal = 0;

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const isHoliday = !isWeekend && isHolidayEnabled(dateStr, enabledHolidayDates);

    if (!isWeekend && !isHoliday) {
      if (sapDayData) {
        // SAP mode: read hours from sapDayData per day
        const dayEntry = sapDayData[dateStr];
        if (dayEntry?.records) {
          dayEntry.records.forEach((r: any) => {
            const cat = r.category || "other";
            const util = ((r.hours || 0) / HOURS_PER_DAY) * 100;
            const seg = {
              category: cat,
              util,
              jobName: r.text || r.absenceType || "?",
              jobNo: r.salesOrder || "",
              provisional: false,
            };
            if (ABSENCE_CATS.has(cat)) {
              absenceSegments.push(seg);
              if (cat === JOB_CATEGORIES.HOLIDAY) holidayTotal += util;
              else absenceTotal += util;
            } else {
              workSegments.push(seg);
              workTotal += util;
              if (CHARGEABLE_CATS.has(cat) || GO_CATS.has(cat)) chargeableTotal += util;
              else if (TRAINING_CATS.has(cat)) trainingTotal += util;
              else if (cat === JOB_CATEGORIES.RESERVATION) reservationTotal += util;
            }
            usedCats.add(cat);
          });
        }
      } else {
        // Staffing mode: read from assignments
        assignments.forEach((job: any) => {
          job.periods.forEach((period: any) => {
            const pStart = new Date(period.startDate);
            pStart.setHours(0, 0, 0, 0);
            const pEnd = new Date(period.endDate);
            pEnd.setHours(0, 0, 0, 0);
            if (date >= pStart && date <= pEnd) {
              const util = period.utilization || 0;
              const seg = {
                category: job.category,
                util,
                jobName: job.jobName,
                jobNo: job.jobNo,
                provisional: period.status === "P",
                isNewCreation: !!job._isNewCreation,
                isProposed: !!job._isProposed,
              };
              if (ABSENCE_CATS.has(job.category)) {
                absenceSegments.push(seg);
                if (job.category === JOB_CATEGORIES.HOLIDAY) holidayTotal += util;
                else absenceTotal += util;
              } else {
                workSegments.push(seg);
                workTotal += util;
                if (CHARGEABLE_CATS.has(job.category) || GO_CATS.has(job.category)) chargeableTotal += util;
                else if (TRAINING_CATS.has(job.category)) trainingTotal += util;
                else if (job.category === JOB_CATEGORIES.RESERVATION) reservationTotal += util;
              }
              usedCats.add(job.category);
            }
          });
        });
      }
    }
    if (isHoliday) {
      absenceSegments.push({
        category: JOB_CATEGORIES.HOLIDAY,
        util: 100,
        jobName: "Holiday",
        jobNo: "",
        provisional: false,
      });
      holidayTotal = 100;
      usedCats.add(JOB_CATEGORIES.HOLIDAY);
    }

    // New-creation segments always on top (highest order) so they don't push existing segments
    workSegments.sort((a, b) => {
      const aNew = a.isNewCreation ? 1 : 0;
      const bNew = b.isNewCreation ? 1 : 0;
      if (aNew !== bNew) return aNew - bNew;
      return getWorkCatOrder(a.category) - getWorkCatOrder(b.category);
    });

    // Cap: absences + holidays cannot exceed 100% of a day
    holidayTotal = Math.min(holidayTotal, 100);
    absenceTotal = Math.min(absenceTotal, Math.max(0, 100 - holidayTotal));

    // maxTotal drives the chart scale; absences are drawn within the 0-100 zone (from top down),
    // so they don't add to the vertical extent — only workTotal can push above 100%.
    const total = workTotal + absenceTotal + holidayTotal;
    const scaleTotal = Math.max(workTotal, 100);
    if (scaleTotal > maxTotal) maxTotal = scaleTotal;

    const netAvailable = 100 - absenceTotal - holidayTotal;
    // Existing assignments keep their capacity; new assignment only fills remaining space for TU
    let existingWork = 0,
      existingCh = 0,
      newCh = 0;
    for (const seg of workSegments) {
      const isCh = CHARGEABLE_CATS.has(seg.category) || GO_CATS.has(seg.category);
      if (seg.isNewCreation) {
        if (isCh) newCh += seg.util;
      } else {
        existingWork += seg.util;
        if (isCh) existingCh += seg.util;
      }
    }
    const remainingForNew = Math.max(0, netAvailable - existingWork);
    const effectiveCh = Math.min(existingCh, netAvailable) + Math.min(newCh, remainingForNew);
    const tu = netAvailable > 0 ? (effectiveCh / netAvailable) * 100 : 100;
    const ncTotal = workTotal - chargeableTotal - trainingTotal - reservationTotal;

    days.push({
      date,
      dow,
      isWeekend,
      label: date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      workSegments,
      absenceSegments,
      workTotal,
      absenceTotal,
      holidayTotal,
      chargeableTotal,
      trainingTotal,
      reservationTotal,
      ncTotal,
      total,
      tu,
    });
  }

  // ── Build column layout: merge consecutive weekend days into 1 column ──
  // Each column has width 1 → same proportions as Level 0 CSS grid (1fr per cell)
  const cols: any[] = []; // { type: 'work'|'weekend', dayIdx?, dayIndices? }
  const dayToCol: number[] = []; // dayIdx → colIdx
  const mondays: any[] = [];
  const months: any[] = [];
  let curMonth = -1;
  let monthStartCol = 0;
  let i = 0;

  while (i < totalDays) {
    const day = days[i];

    // Track month boundaries (use first day of each month)
    const m = day.date.getMonth();
    if (m !== curMonth) {
      if (curMonth !== -1) months.push({ label: MONTHS_FR[curMonth], startCol: monthStartCol, endCol: cols.length });
      curMonth = m;
      monthStartCol = cols.length;
    }

    if (day.isWeekend) {
      // Merge consecutive weekend days
      const indices: number[] = [];
      while (i < totalDays && days[i].isWeekend) {
        dayToCol.push(cols.length);
        indices.push(i);
        i++;
      }
      cols.push({ type: "weekend", dayIndices: indices });
    } else {
      if (day.dow === 1) mondays.push({ col: cols.length, day: day.date.getDate() });
      dayToCol.push(cols.length);
      cols.push({ type: "work", dayIdx: i });
      i++;
    }
  }
  // Last month
  months.push({ label: MONTHS_FR[curMonth], startCol: monthStartCol, endCol: cols.length });

  const numCols = cols.length;
  const maxScale = Math.max(maxTotal, 110);
  return { days, totalDays, cols, numCols, dayToCol, maxScale, usedCats: Array.from(usedCats), mondays, months };
};

// ─── Main component ─────────────────────────────────────────────────────────
export const UtilizationChart = memo(
  ({
    assignments,
    _empId,
    timelineStart,
    timelineEnd,
    _onEdit,
    showLegend = true,
    showMonths = true,
    enabledHolidayDates = [],
    sapDayData = null,
    grade,
    highlightJobNo = null,
    baseAssignments = null,
  }: any) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState<any>(null);

    const data = useMemo(
      () => buildChartData(assignments || [], timelineStart, timelineEnd, enabledHolidayDates, sapDayData, grade),
      [assignments, timelineStart, timelineEnd, enabledHolidayDates, sapDayData, grade]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!data || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const colIdx = Math.min(Math.floor((px / rect.width) * data.numCols), data.numCols - 1);
        if (colIdx < 0) return;
        const col = data.cols[colIdx];
        // Resolve to day index for tooltip
        const dayIdx = col.type === "work" ? col.dayIdx : col.dayIndices[0];
        setHovered({ colIdx, dayIdx, x: e.clientX, y: e.clientY });
      },
      [data]
    );

    const handleMouseLeave = useCallback(() => setHovered(null), []);

    // Build base utilization per column for highlighted job (must be before early return to preserve hook order)
    const baseUtilByCol = useMemo(() => {
      if (!highlightJobNo || !baseAssignments || !data) return null;
      const map = new Array(data.numCols).fill(null);
      const start = new Date(timelineStart);
      start.setHours(0, 0, 0, 0);
      for (const job of baseAssignments) {
        if (job.jobNo !== highlightJobNo) continue;
        for (const period of job.periods || []) {
          const ps = new Date(period.startDate);
          ps.setHours(0, 0, 0, 0);
          const pe = new Date(period.endDate);
          pe.setHours(0, 0, 0, 0);
          for (
            let d = Math.max(0, Math.round((ps.getTime() - start.getTime()) / MS_PER_DAY));
            d <= Math.min(data.totalDays - 1, Math.round((pe.getTime() - start.getTime()) / MS_PER_DAY));
            d++
          ) {
            const ci = data.dayToCol[d];
            if (ci != null && data.cols[ci].type !== "weekend") {
              map[ci] = (map[ci] || 0) + (period.utilization || 0);
            }
          }
        }
      }
      return map;
    }, [highlightJobNo, baseAssignments, data, timelineStart]);

    if (!data) return <Box sx={{ height: CHART_HEIGHT }} />;

    const { days, cols, numCols, maxScale, usedCats, mondays, months } = data;
    const line100Bottom = (100 / maxScale) * CHART_HEIGHT;

    // Pre-build static SVG elements
    const svgRects: React.ReactNode[] = [];
    // Track highlighted segments per column: util value and top position (cumulated y including the segment)
    const highlightUtilByCol: (number | null)[] = highlightJobNo ? new Array(numCols).fill(null) : [];
    const highlightTopByCol: number[] = highlightJobNo ? new Array(numCols).fill(0) : [];

    cols.forEach((col, ci) => {
      if (col.type === "weekend") {
        // Single merged weekend column
        svgRects.push(<rect key={`w${ci}`} x={ci} y={0} width={1} height={maxScale} fill="#f0f0f0" />);
      } else {
        // Work day column
        const day = days[col.dayIdx];
        const off = GAP_FRAC / 2;
        const cw = 1 - GAP_FRAC;
        let y = 0;
        day.workSegments.forEach((seg: any, j: number) => {
          const isNew = seg.isNewCreation;
          const isProposed = seg.isProposed;
          const isHighlighted = highlightJobNo && seg.jobNo === highlightJobNo;
          const isDimmed = highlightJobNo && !isHighlighted;
          const baseOpacity = isProposed ? 0.45 : isNew ? 0.7 : 0.85;
          const opacity = isDimmed ? 0.15 : baseOpacity;
          if (isHighlighted) {
            highlightUtilByCol[ci] = (highlightUtilByCol[ci] || 0) + seg.util;
            highlightTopByCol[ci] = y + seg.util; // top of highlighted segment in the stack
          }
          const fillColor = isProposed ? "#6366f1" : isNew ? "#1e3a5f" : getCatColor(seg.category);
          svgRects.push(
            <rect
              key={`s${ci}-${j}`}
              x={ci + off}
              y={maxScale - y - seg.util}
              width={cw}
              height={seg.util}
              rx={0.25}
              ry={7}
              fill={fillColor}
              opacity={opacity}
              strokeDasharray={isProposed ? "2 1" : undefined}
              stroke={isProposed ? "#4f46e5" : undefined}
              strokeWidth={isProposed ? 0.3 : undefined}
            />
          );
          y += seg.util;
        });

        // Absence segments stacked from top (within 0-100 zone)
        let absY = maxScale - 100;
        day.absenceSegments.forEach((seg: any, j: number) => {
          svgRects.push(
            <rect
              key={`a${ci}-${j}`}
              x={ci + off}
              y={absY}
              width={cw}
              height={seg.util}
              rx={0.25}
              ry={7}
              fill={getCatColor(seg.category)}
              opacity={0.2}
            />
          );
          const patId =
            seg.category === JOB_CATEGORIES.HOLIDAY
              ? "hatchHoliday"
              : seg.category === JOB_CATEGORIES.LOA
                ? "hatchLoa"
                : "hatchAbsence";
          svgRects.push(
            <rect
              key={`ah${ci}-${j}`}
              x={ci + off}
              y={absY}
              width={cw}
              height={seg.util}
              rx={0.25}
              ry={7}
              fill={`url(#${patId})`}
            />
          );
          absY += seg.util;
        });
      }
    });

    const hDay = hovered ? days[hovered.dayIdx] : null;

    return (
      <Box>
        {/* ── Month labels ─────────────────────────── */}
        {showMonths && (
          <Box sx={{ display: "flex", mb: 0.25 }}>
            {months.map((m, i) => (
              <Box
                key={i}
                sx={{
                  textAlign: "center",
                  fontSize: "10px",
                  fontWeight: 700,
                  bgcolor: i % 2 === 0 ? "action.hover" : "transparent",
                  color: i % 2 === 0 ? "text.primary" : "text.secondary",
                  width: `${((m.endCol - m.startCol) / numCols) * 100}%`,
                  ...(i > 0 && { borderLeft: (theme) => `1px solid ${alpha(theme.palette.divider, 0.2)}` }),
                  py: "2px",
                }}
              >
                {m.label}
              </Box>
            ))}
          </Box>
        )}

        {/* ── SVG chart area ───────────────────────── */}
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            borderRadius: 2,
            overflow: "visible",
            cursor: "default",
            height: CHART_HEIGHT,
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 8,
            }}
            viewBox={`0 0 ${numCols} ${maxScale}`}
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="hatchAbsence"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="2" opacity="0.8" />
              </pattern>
              <pattern id="hatchLoa" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="2" opacity="0.8" />
              </pattern>
              <pattern
                id="hatchHoliday"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="2" opacity="0.8" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={numCols} height={maxScale} fill="#fafafa" />

            {/* Overflow zone above 100% */}
            {maxScale > 100 && <rect x={0} y={0} width={numCols} height={maxScale - 100} fill="rgba(239,68,68,0.06)" />}

            {/* Day separator lines between each column */}
            {Array.from({ length: numCols - 1 }, (_, ci) => (
              <line
                key={`sep${ci}`}
                x1={ci + 1}
                y1={0}
                x2={ci + 1}
                y2={maxScale}
                stroke="#ffffff"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {svgRects}
          </svg>

          {/* Utilization labels for highlighted job */}
          {highlightJobNo &&
            (() => {
              // Collect work-day entries, skip weekends and days where job is absent
              const workEntries: { ci: number; u: number }[] = [];
              for (let ci = 0; ci < numCols; ci++) {
                if (cols[ci].type === "weekend") continue;
                const u = highlightUtilByCol[ci];
                if (u == null) continue;
                workEntries.push({ ci, u: Math.round(u) });
              }
              if (workEntries.length === 0) return null;
              const labels: React.ReactNode[] = [];
              const makeLabel = (ci: number, u: number, color = "#4a3f3a") => {
                const segTop = highlightTopByCol[ci] || 0;
                const bottomPct = (segTop / maxScale) * 100;
                return (
                  <Box
                    key={`hl-${ci}`}
                    sx={{
                      position: "absolute",
                      left: `${((ci + 0.5) / numCols) * 100}%`,
                      bottom: `${Math.max(bottomPct, 2)}%`,
                      transform: "translate(-50%, -1px)",
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      color,
                      pointerEvents: "none",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u}%
                  </Box>
                );
              };
              // Always show label on first column
              labels.push(makeLabel(workEntries[0].ci, workEntries[0].u));
              // Show additional labels at transition points
              for (let i = 1; i < workEntries.length; i++) {
                if (workEntries[i].u !== workEntries[i - 1].u) {
                  labels.push(
                    makeLabel(workEntries[i].ci, workEntries[i].u, workEntries[i].u === 0 ? "#d32f2f" : "#4a3f3a")
                  );
                }
              }
              return labels;
            })()}

          {/* 100% reference line (crisp div) */}
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              borderTop: (theme) => `1px dashed ${theme.palette.text.disabled}`,
              bottom: line100Bottom,
            }}
          />
        </Box>

        {/* ── Week start dates ─────────────────────── */}
        <Box sx={{ position: "relative", height: 12, mt: "1px" }}>
          {mondays.map(({ col, day }: any) => (
            <Typography
              component="span"
              key={col}
              sx={{
                position: "absolute",
                fontSize: "9px",
                color: "text.disabled",
                lineHeight: 1,
                left: `${(col / numCols) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              {day}
            </Typography>
          ))}
        </Box>

        {/* ── Legend ────────────────────────────────── */}
        {showLegend && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mt: 0.25,
              fontSize: "10px",
              color: "text.secondary",
              flexWrap: "wrap",
            }}
          >
            {usedCats
              .filter((c) => !ABSENCE_CATS.has(c))
              .map((cat) => (
                <Box component="span" key={cat} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box component="span" sx={{ width: 10, height: 8, borderRadius: "2px", bgcolor: getCatColor(cat) }} />
                  {getCategoryLabel(cat)}
                </Box>
              ))}
            {usedCats
              .filter((c) => ABSENCE_CATS.has(c))
              .map((cat) => (
                <Box component="span" key={cat} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <svg width="10" height="8" style={{ flexShrink: 0 }}>
                    <rect width="10" height="8" rx="1" fill={getCatColor(cat)} opacity="0.35" />
                    <line x1="0" y1="2" x2="10" y2="6" stroke={getCatColor(cat)} strokeWidth="0.8" opacity="0.6" />
                    <line x1="0" y1="5" x2="6" y2="8" stroke={getCatColor(cat)} strokeWidth="0.8" opacity="0.6" />
                    <line x1="4" y1="0" x2="10" y2="3" stroke={getCatColor(cat)} strokeWidth="0.8" opacity="0.6" />
                  </svg>
                  {getCategoryLabel(cat)}
                </Box>
              ))}
            <Box
              component="span"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5, color: "text.disabled" }}
            >
              <Box
                component="span"
                sx={{ width: 16, borderTop: (theme) => `1px dashed ${theme.palette.text.disabled}` }}
              />
              100%
            </Box>
          </Box>
        )}
      </Box>
    );
  }
);

UtilizationChart.displayName = "UtilizationChart";
