import React, { memo, useMemo, useCallback, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { GANTT_LEFT_COL_WIDTH, getHoursPerDay, TL_WARN, TL_ALERT } from "../../constants";
import { computeBucketFromGrid } from "../../utils/aggregateCalc";
import { getHeatmapStyle, getGradeTarget } from "../../constants/theme";

import { getToday } from "../../../../utils/formatters";
import { AggregateHeatmapGrid } from "./AggregateHeatmapGrid";
import { computeAggregateHeatmapCells } from "../../utils/aggregateHeatmapCalc";
import type { Employee, CalendarDay } from "../../types";

const LEFT_COL = GANTT_LEFT_COL_WIDTH;

interface AggregateHeatmapStripProps {
  employees: Employee[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  calendar: CalendarDay[];
  dailyGrid: Map<string, any>;
  granularity?: string;
  mode?: string;
  chargeableCombined?: boolean;
  theoreticalTU?: number;
  enabledHolidayDates?: Set<string> | string[];
  onDateRangeSelect?: (start: Date | string, end: Date | string) => void;
  sapLookup?: any;
  embedded?: boolean;
  leftColShrink?: number;
  hideLeftCol?: boolean;
  showIO?: string;
  ioTU?: number | null;
  useSapActuals?: boolean;
  stableEmpCount?: number | null;
  onVarianceComputed?: ((v: number) => void) | null;
}

// Aggregate summary strip (average across all employees)
export const AggregateHeatmapStrip = memo(
  ({
    employees,
    timelineStart,
    timelineEnd,
    calendar: calendarProp,
    dailyGrid,
    granularity = "day",
    mode = "utilization",
    chargeableCombined = true,
    theoreticalTU,
    enabledHolidayDates = [],
    onDateRangeSelect,
    sapLookup,
    embedded = false,
    leftColShrink = 0,
    hideLeftCol = false,
    showIO,
    ioTU,
    useSapActuals = false,
    stableEmpCount = null,
    onVarianceComputed = null,
  }: AggregateHeatmapStripProps) => {
    const { cells, sapWallMonthData } = useMemo(
      () =>
        computeAggregateHeatmapCells({
          employees,
          timelineStart,
          timelineEnd,
          calendarProp,
          dailyGrid,
          granularity,
          chargeableCombined,
          theoreticalTU,
          useSapActuals,
        }),
      [
        employees,
        timelineStart,
        timelineEnd,
        calendarProp,
        dailyGrid,
        granularity,
        chargeableCombined,
        theoreticalTU,
        useSapActuals,
      ]
    );

    // Count present employees (exclude not-yet-arrived and already departed relative to today)
    // Use stableEmpCount when provided (stable across timeline panning)
    const activeEmpCount = useMemo(() => {
      if (stableEmpCount != null) return stableEmpCount;
      if (!employees || employees.length === 0) return 0;
      const today = getToday();
      const activeRealIds = new Set<string>();
      employees.forEach((emp: any) => {
        const arr = emp._arrivalDate;
        const dep = emp._departureDate;
        if ((!arr || today >= arr) && (!dep || today <= dep)) {
          activeRealIds.add(emp._realEmpId || emp.empId);
        }
      });
      return activeRealIds.size || new Set(employees.map((e: any) => e._realEmpId || e.empId)).size;
    }, [employees, stableEmpCount]);

    // Working-day FTE and real FTE (excluding forced absence)
    const { fte: aggFte, realFte: aggRealFte } = useMemo(() => {
      if (!employees || employees.length === 0 || !timelineStart || !timelineEnd) return { fte: 0, realFte: 0 };
      let totalWorkDays = 0;
      const c = new Date(timelineStart);
      c.setHours(0, 0, 0, 0);
      const eDate = new Date(timelineEnd);
      eDate.setHours(0, 0, 0, 0);
      while (c < eDate) {
        const dw = c.getDay();
        if (dw !== 0 && dw !== 6) totalWorkDays++;
        c.setDate(c.getDate() + 1);
      }
      if (totalWorkDays <= 0) return { fte: 0, realFte: 0 };
      let f = 0,
        rf = 0;
      employees.forEach((emp: any) => {
        f += Math.min(1, (emp._presenceActiveN || emp._displayActiveN || 0) / totalWorkDays);
        rf = f;
      });
      return { fte: f, realFte: rf };
    }, [employees, timelineStart, timelineEnd]);

    const handleCellClick = useCallback(
      (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest("[data-idx]");
        const idx = (el as HTMLElement)?.dataset?.idx;
        if (idx === undefined) return;
        if (!cells) return;
        const cell = cells[+idx];
        if (!cell || cell.isWeekend) return;
        if (onDateRangeSelect && cell.startDate && cell.endDate) onDateRangeSelect(cell.startDate, cell.endDate);
      },
      [cells, onDateRangeSelect]
    );

    const isDay = granularity === "day";

    // SAP wall — computed from daily array in cells memo (month-level, bucket-independent)
    const sapWallInfo = sapWallMonthData;

    // Sum-based aggregate TU/TO
    let totalChH = 0,
      totalTrH = 0,
      totalNetH = 0;
    employees.forEach((e: any) => {
      totalNetH += e._displayNetH || 0;
      totalChH += e._displayChH || 0;
      totalTrH += e._displayTrH || 0;
    });
    const totalActiveN = employees.reduce((s: number, e: any) => s + ((e._displayActiveN || 0) > 0 ? 1 : 0), 0);
    const aggTU = totalNetH > 0.01 ? (totalChH / totalNetH) * 100 : totalActiveN > 0 ? 100 : 0;
    const aggTO = totalNetH > 0.01 ? ((totalChH + totalTrH) / totalNetH) * 100 : totalActiveN > 0 ? 100 : 0;
    const isDispo = mode === "availability";
    const isTO = mode === "to";
    const isVariance = mode === "variance";
    const isVarianceHours = mode === "variance_hours";
    const isVarianceHoursPct = mode === "variance_hours_pct";
    const isAnyVariance = isVariance || isVarianceHours || isVarianceHoursPct;
    const isHours = mode === "hours";
    const totalVarianceH = cells
      ? cells.filter((c) => !c.isWeekend && c.varianceHours != null).reduce((s, c) => s + (c.varianceHours ?? 0), 0)
      : 0;
    useEffect(() => {
      if (onVarianceComputed) onVarianceComputed(totalVarianceH);
    }, [totalVarianceH, onVarianceComputed]);
    const displayRate = isHours ? totalChH : isDispo ? Math.max(0, 100 - aggTO) : isTO ? aggTO : aggTU;

    const borderColor = isAnyVariance
      ? { borderColor: "#fed7aa", bgcolor: "rgba(255,237,213,0.3)" }
      : isHours
        ? { borderColor: "#c7d2fe", bgcolor: "rgba(238,242,255,0.3)" }
        : isDispo
          ? { borderColor: "#a7f3d0", bgcolor: "rgba(236,253,245,0.3)" }
          : isTO
            ? { borderColor: "#ddd6fe", bgcolor: "rgba(245,243,255,0.3)" }
            : { borderColor: "#bfdbfe", bgcolor: "rgba(239,246,255,0.3)" };
    const textColor = "text.primary";
    const rateColor = isAnyVariance
      ? "#f97316"
      : isHours
        ? "#6366f1"
        : isDispo
          ? "#10b981"
          : isTO
            ? "#8b5cf6"
            : "#0ea5e9";
    const modeLabel = isVarianceHoursPct
      ? "Delta Var h%"
      : isVarianceHours
        ? "Delta Var h"
        : isVariance
          ? "Delta Var"
          : isHours
            ? "h"
            : isDispo
              ? "Avail"
              : isTO
                ? "TO"
                : "TU";

    // Team-level TU transition loss
    const teamTLHours = employees.reduce((s: number, e: any) => s + (e.tuTransitionLossHours || 0), 0);
    const teamTLPct = totalNetH > 0 ? (teamTLHours / totalNetH) * 100 : 0;

    // Potential TU gain for the team
    let aggAdjustedCh = 0;
    employees.forEach((e: any) => {
      const net = e._displayNetH || 0;
      const ch = e._displayChH || 0;
      const tu = net > 0 ? (ch / net) * 100 : 0;
      const tgt = getGradeTarget(e.grade);
      aggAdjustedCh += tu < tgt ? (tgt / 100) * net : ch;
    });
    const aggPotentialDelta = totalNetH > 0 ? ((aggAdjustedCh - totalChH) / totalNetH) * 100 : 0;
    const aggGainHours = aggAdjustedCh - totalChH;

    // Waterfall tooltip for header TU
    const [wfHover, setWfHover] = useState<{ x: number; y: number } | null>(null);
    const wfSteps = useMemo(() => {
      let gross = 0,
        abs = 0,
        hol = 0,
        chOnly = 0,
        go = 0,
        tr = 0;
      employees.forEach((e: any) => {
        const eHPD = getHoursPerDay(e.grade);
        gross += ((e.totalWorkingDaysInPeriod || 0) + (e.totalHolidayDaysInPeriod || 0)) * eHPD;
        abs += e.totalAbsenceHoursInPeriod || 0;
        hol += (e.totalHolidayDaysInPeriod || 0) * eHPD;
        const chAll = e.totalChargeableHoursInPeriod || 0;
        const chOnlyE = e.totalChargeableOnlyHoursInPeriod || 0;
        chOnly += chOnlyE;
        go += Math.max(0, chAll - chOnlyE);
        tr += e.totalTrainingHoursInPeriod || 0;
      });
      if (gross <= 0) return { steps: [], grossH: 0 };
      const steps: any[] = [];
      let running = gross;
      steps.push({ label: "Total", value: gross, offset: 0, type: "result", color: "#d1d5db" });
      if (abs > 0) {
        running -= abs;
        steps.push({ label: "- Absences", value: abs, offset: running, type: "sub", color: "#fb7185", tc: "#fb7185" });
      }
      if (hol > 0) {
        running -= hol;
        steps.push({ label: "- Holidays", value: hol, offset: running, type: "sub", color: "#fca5a5", tc: "#fca5a5" });
      }
      steps.push({ label: "= Net", value: running, offset: 0, type: "result", color: "#d1d5db" });
      if (chOnly > 0) {
        running -= chOnly;
        steps.push({
          label: "- Billable",
          value: chOnly,
          offset: running,
          type: "sub",
          color: "#60a5fa",
          tc: "#60a5fa",
        });
      }
      if (go > 0) {
        running -= go;
        steps.push({ label: "- Gen. Oppty", value: go, offset: running, type: "sub", color: "#22d3ee", tc: "#22d3ee" });
      }
      if (tr > 0) {
        running -= tr;
        steps.push({ label: "- Training", value: tr, offset: running, type: "sub", color: "#34d399", tc: "#34d399" });
      }
      steps.push({
        label: "= Avail",
        value: Math.max(0, running),
        offset: 0,
        type: "result",
        color: "#34d399",
        tc: "#34d399",
      });
      return { steps, grossH: gross };
    }, [employees]);

    const handleWfEnter = useCallback((e: React.MouseEvent) => setWfHover({ x: e.clientX, y: e.clientY }), []);
    const handleWfMove = useCallback((e: React.MouseEvent) => setWfHover({ x: e.clientX, y: e.clientY }), []);
    const handleWfLeave = useCallback(() => setWfHover(null), []);

    const _aggNow = new Date();
    const _aggNowMonth = _aggNow.getMonth(),
      _aggNowYear = _aggNow.getFullYear();

    // Pre-compute SAP/MDS TU for current month buckets via computeBucketFromGrid (same as modal)
    const curMonthGridTU = useMemo(() => {
      if (!cells || !dailyGrid || !calendarProp)
        return new Map<number, { sapTU: number | null; mdsTU: number | null }>();
      const calIdx = new Map<string, number>();
      for (let ci = 0; ci < calendarProp.length; ci++) calIdx.set(calendarProp[ci].dateStr, ci);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const result = new Map<number, { sapTU: number | null; mdsTU: number | null }>();
      cells.forEach((cell, i) => {
        if (cell.isWeekend || !cell.startDate || !cell.endDate) return;
        if (cell.startDate.getMonth() !== _aggNowMonth || cell.startDate.getFullYear() !== _aggNowYear) return;
        const bEnd = new Date(cell.endDate);
        bEnd.setDate(bEnd.getDate() + 1);
        const grid = computeBucketFromGrid(
          employees,
          dailyGrid,
          calIdx,
          fmt(cell.startDate),
          fmt(bEnd),
          chargeableCombined,
          null,
          useSapActuals,
          calendarProp
        );
        if (grid) result.set(i, { sapTU: grid.sapTU, mdsTU: grid.mdsTU });
      });
      return result;
    }, [cells, dailyGrid, calendarProp, employees, chargeableCombined, useSapActuals, _aggNowMonth, _aggNowYear]);

    if (!cells) return null;

    return (
      <Box
        sx={{
          ...(!embedded && {
            borderRadius: 3,
            bgcolor: "#e2e5e9",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            transition: "background-color 0.3s ease, transform 0.3s ease",
            "&:hover": {
              bgcolor: "#d8dce1",
              transform: "translateY(-3px)",
            },
          }),
          ...(embedded &&
            !hideLeftCol && {
              borderTop: "1px solid #d1d5db",
              mt: 2,
              pt: 1,
            }),
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        {!embedded && (
          <Box
            sx={{ flexShrink: 0, px: 1.25, py: 1, display: "flex", alignItems: "center", gap: 0.5 }}
            style={{ width: LEFT_COL - leftColShrink }}
          >
            <Typography
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: "0.8125rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                color: textColor,
              }}
            >
              {modeLabel} (
              {(() => {
                const totalUniqueEmps = new Set(employees.map((e: any) => e._realEmpId || e.empId)).size;
                return `${aggFte > 0 && aggFte.toFixed(1) !== String(activeEmpCount) && aggFte.toFixed(1) !== `${activeEmpCount}.0` ? `${aggFte.toFixed(1)} FTE / ` : ""}${activeEmpCount}${activeEmpCount !== totalUniqueEmps ? ` / ${totalUniqueEmps}` : ""}${aggRealFte > 0 && aggRealFte < aggFte - 0.05 ? ` · ${aggRealFte.toFixed(1)} actual` : ""}`;
              })()}
              )
            </Typography>
            {teamTLPct > 0 && (
              <Box
                component="span"
                sx={{
                  fontSize: "9px",
                  fontWeight: 700,
                  px: 0.5,
                  borderRadius: 1,
                  flexShrink: 0,
                  bgcolor: teamTLPct >= TL_ALERT ? "#fee2e2" : teamTLPct >= TL_WARN ? "#fef3c7" : "#ffedd5",
                  color: teamTLPct >= TL_ALERT ? "#ef4444" : teamTLPct >= TL_WARN ? "#d97706" : "#ea580c",
                }}
              >
                {teamTLPct.toFixed(2)}%
              </Box>
            )}
            {aggPotentialDelta > 0 && (
              <Box
                component="span"
                sx={{
                  fontSize: "9px",
                  fontWeight: 700,
                  px: 0.5,
                  borderRadius: 1,
                  flexShrink: 0,
                  bgcolor: "#dcfce7",
                  color: "#047857",
                }}
              >
                +{aggPotentialDelta.toFixed(1)}pts
              </Box>
            )}
            <Typography
              component="span"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                flexShrink: 0,
                lineHeight: 1,
                cursor: "default",
                color: rateColor,
              }}
            >
              {isVarianceHours
                ? `Δh ${totalVarianceH >= 0 ? "+" : ""}${totalVarianceH.toFixed(1)}h`
                : isHours
                  ? `${totalChH.toFixed(0)}h / ${totalNetH.toFixed(0)}h`
                  : `${displayRate === 100 ? "100" : displayRate.toFixed(1)}%`}
            </Typography>
          </Box>
        )}
        {embedded && !hideLeftCol && (
          <Box
            onClick={
              onDateRangeSelect
                ? () => {
                    const end = new Date(timelineEnd);
                    end.setDate(end.getDate() - 1);
                    onDateRangeSelect(timelineStart, end);
                  }
                : undefined
            }
            sx={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              pr: 1,
              cursor: onDateRangeSelect ? "pointer" : "default",
              "&:hover": onDateRangeSelect ? { opacity: 0.7 } : {},
            }}
            style={{ width: LEFT_COL - (leftColShrink || 0) }}
          >
            <Typography
              component="span"
              sx={{ fontSize: "0.875rem", fontWeight: 400, lineHeight: 1, color: rateColor }}
            >
              {isVarianceHours
                ? `Δh ${totalVarianceH >= 0 ? "+" : ""}${totalVarianceH.toFixed(1)}h`
                : isHours
                  ? `${totalChH.toFixed(0)}h / ${totalNetH.toFixed(0)}h`
                  : `${displayRate === 100 ? "100" : displayRate.toFixed(1)}%`}
              {showIO === "show" && ioTU != null && (
                <Typography component="span" sx={{ color: "#7c3aed", fontSize: "0.65rem", fontWeight: 500, ml: 0.3 }}>
                  (I&O {ioTU.toFixed(1)}%)
                </Typography>
              )}
            </Typography>
          </Box>
        )}
        <Box sx={{ flex: 1, py: "7px", pr: 1.5, minWidth: 0 }}>
          <AggregateHeatmapGrid
            cells={cells}
            mode={mode}
            isDay={isDay}
            theoreticalTU={theoreticalTU}
            sapWallInfo={sapWallInfo}
            curMonthGridTU={curMonthGridTU}
            onCellClick={handleCellClick}
          />
        </Box>
      </Box>
    );
  }
);
AggregateHeatmapStrip.displayName = "AggregateHeatmapStrip";
