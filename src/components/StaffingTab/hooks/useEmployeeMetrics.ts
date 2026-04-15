import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import { normalizePeriods, computeDailyMetrics } from "../utils/dataProcessing";
import { getEtpRatio } from "../types";
import { getHoursPerDay, TU_LOW, TU_FULL, MDS_EXTRACT_START } from "../constants";
import { getGradeTarget } from "../constants/theme";
import { getToday } from "../../../utils/formatters";

/**
 * Extracted from EmployeeRow.tsx — all pure metric derivations.
 *
 * Returns hoursInfo, mdsHoursInfo, staffAlerts, tlTooltip, potentialTooltip,
 * tuTooltip, sapCompletion, and display-ready metric values.
 */
export function useEmployeeMetrics({
  employee,
  consolidatedAssignments,
  chartAssignments,
  timelineStart,
  timelineEnd,
  enabledHolidayDates,
  chargeableCombined,
  heatmapMode,
  teamNetHours,
  bulkEditMode,
  bulkLiveAssignments,
  suppressEdits,
  showIO,
}: {
  employee: any;
  consolidatedAssignments: any[];
  chartAssignments: any[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  enabledHolidayDates: Set<string>;
  chargeableCombined: boolean;
  heatmapMode: string;
  teamNetHours: number;
  bulkEditMode: boolean;
  bulkLiveAssignments: any[] | null;
  suppressEdits: boolean;
  showIO: string;
}) {
  const theme = useTheme();

  // Clip timeline start to MDS_EXTRACT_START for hours computation
  const mdsClippedStart = useMemo(() => {
    const tlStr = new Date(timelineStart).toISOString().slice(0, 10);
    if (tlStr >= MDS_EXTRACT_START) return timelineStart;
    return new Date(MDS_EXTRACT_START + "T00:00:00");
  }, [timelineStart]);

  const hoursInfo = useMemo(() => {
    // When expanded, always recompute (timeline may have scrolled)
    if (bulkEditMode) {
      const src = bulkLiveAssignments ? chartAssignments : consolidatedAssignments;
      const periods = normalizePeriods(src);
      return computeDailyMetrics(periods, mdsClippedStart, timelineEnd, enabledHolidayDates, {
        chargeableCombined,
        computeFragScore: true,
        computeTransitionLoss: true,
        collectShortfallDetails: true,
      });
    }
    // Fast-path: reuse pre-computed _hoursInfo from computeDisplayMetricsBatch
    if (employee._hoursInfo) return employee._hoursInfo;
    // Fallback: compute from scratch
    const periods = employee._periods || normalizePeriods(consolidatedAssignments);
    return computeDailyMetrics(periods, timelineStart, timelineEnd, enabledHolidayDates, {
      chargeableCombined,
      computeFragScore: true,
      computeTransitionLoss: true,
      collectShortfallDetails: true,
    });
  }, [
    mdsClippedStart,
    timelineEnd,
    consolidatedAssignments,
    chargeableCombined,
    enabledHolidayDates,
    bulkEditMode,
    bulkLiveAssignments,
    chartAssignments,
  ]);

  // MDS-only TU (ignoring SAP substitution) -- used as base TU in the MDS section header
  const mdsHoursInfo = useMemo(() => {
    const periods = employee._periods || normalizePeriods(consolidatedAssignments);
    return computeDailyMetrics(periods, mdsClippedStart, timelineEnd, enabledHolidayDates, {
      chargeableCombined,
      hoursPerDay: getHoursPerDay(employee.grade),
    });
  }, [
    employee._periods,
    consolidatedAssignments,
    mdsClippedStart,
    timelineEnd,
    enabledHolidayDates,
    chargeableCombined,
    employee.grade,
  ]);

  const staffAlerts = useMemo(() => {
    const a: { icon: string; color: string; tip: string }[] = [];
    const avgUtilPerDay =
      hoursInfo.totalH > 0
        ? ((hoursInfo.chargeableH + hoursInfo.trainingH + hoursInfo.otherH + hoursInfo.absenceH) / hoursInfo.totalH) *
          100
        : 0;
    if (avgUtilPerDay > TU_FULL)
      a.push({
        icon: "over",
        color: "#ef4444",
        tip: `Overloaded: ${avgUtilPerDay.toFixed(0)}% avg.`,
      });
    if (hoursInfo.tu < TU_LOW && hoursInfo.chargeableH > 0)
      a.push({ icon: "low", color: "#f59e0b", tip: `Low TU: ${hoursInfo.tu.toFixed(1)}%` });
    if (hoursInfo.chargeableH === 0 && hoursInfo.totalH > 0)
      a.push({ icon: "none", color: "#f59e0b", tip: "No billable assignments" });
    return a;
  }, [hoursInfo]);

  const empTLPct = hoursInfo.tuTransitionLossPoints;
  const teamTLPct = teamNetHours > 0 ? (hoursInfo.tuTransitionLossHours / teamNetHours) * 100 : 0;
  const tlTooltip = useMemo(() => {
    if (empTLPct <= 0) return "";
    const details = hoursInfo.shortfallDetails || [];
    const lines = [`TU transition loss: ${empTLPct.toFixed(2)}% individual | ${teamTLPct.toFixed(2)}% team`, ""];
    lines.push("Calculation:");
    details.forEach((d: any) => {
      const empHPD = getHoursPerDay(employee.grade);
      const lossH = ((d.shortfall * empHPD) / 100).toFixed(2);
      lines.push(
        `  Day ${d.dayIdx + 1}: rate ${d.rate.toFixed(0)}% vs neighbor ${d.neighborMax.toFixed(0)}% -> gap ${d.shortfall.toFixed(0)}% = ${lossH}h`
      );
    });
    const totalLossH = hoursInfo.tuTransitionLossHours;
    lines.push("");
    lines.push(
      `Total gaps: ${details.reduce((s: number, d: any) => s + d.shortfall, 0).toFixed(0)}% x ${getHoursPerDay(employee.grade)}h/100 = ${totalLossH.toFixed(2)}h`
    );
    lines.push(`Individual: ${totalLossH.toFixed(2)}h / ${hoursInfo.netH}h net = ${empTLPct.toFixed(2)}%`);
    if (teamNetHours > 0)
      lines.push(`Team: ${totalLossH.toFixed(2)}h / ${teamNetHours.toFixed(0)}h team net = ${teamTLPct.toFixed(2)}%`);
    return lines.join("\n");
  }, [empTLPct, teamTLPct, hoursInfo, teamNetHours]);

  const gradeTransition = employee._isGradeSplit ? null : employee._gradeTransition;

  const etpAdj = employee._etpAdjustments;
  const currentEtp = etpAdj?.length ? getEtpRatio(etpAdj, getToday()) : null;

  const gradeTarget = getGradeTarget(employee.grade);
  const gapPct = Math.max(0, gradeTarget - hoursInfo.tu);
  const gapHours = (gapPct / 100) * hoursInfo.netH;
  const potentialTeamPts = gapPct > 0 && hoursInfo.netH > 0 && teamNetHours > 0 ? (gapHours / teamNetHours) * 100 : 0;
  const potentialTooltip = useMemo(() => {
    if (potentialTeamPts <= 0) return "";
    const lines = [
      `Team TU potential: +${potentialTeamPts.toFixed(2)}%`,
      "",
      "Calculation:",
      `  Grade: ${employee.grade}`,
      `  Target TU: ${gradeTarget}%`,
      `  Current TU: ${hoursInfo.tu.toFixed(1)}%`,
      `  Gap: ${gradeTarget}% - ${hoursInfo.tu.toFixed(1)}% = ${gapPct}%`,
      `  Net hours: ${hoursInfo.netH}h`,
      `  Hours to gain: ${gapPct}% x ${hoursInfo.netH}h = ${gapHours.toFixed(1)}h`,
      `  Team net hours: ${teamNetHours.toFixed(0)}h`,
      `  Team impact: ${gapHours.toFixed(1)}h / ${teamNetHours.toFixed(0)}h x 100 = +${potentialTeamPts.toFixed(2)}%`,
    ];
    return lines.join("\n");
  }, [potentialTeamPts, employee.grade, gradeTarget, hoursInfo.tu, hoursInfo.netH, gapPct, gapHours, teamNetHours]);

  const teamContribPts = teamNetHours > 0 ? (hoursInfo.chargeableH / teamNetHours) * 100 : 0;

  const sapCompletion = useMemo(() => {
    const pct = employee._sapPct;
    if (pct == null) return null;
    const sapDays = employee._sapDayCount ?? 0;
    const workDays = employee._sapActiveDayCount ?? 0;
    if (!workDays) return null;
    return { sapDays, workDays, pct };
  }, [employee._sapPct, employee._sapDayCount, employee._sapActiveDayCount]);

  // Mode-aware metric color
  const metricColor =
    heatmapMode === "availability"
      ? "#10b981"
      : heatmapMode === "to"
        ? theme.palette.secondary.main
        : heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct"
          ? theme.palette.info.main
          : heatmapMode === "hours"
            ? "#6366f1"
            : theme.palette.primary.main;
  const displayTU =
    bulkEditMode && bulkLiveAssignments && !suppressEdits ? hoursInfo.tu : (employee._displayTU ?? hoursInfo.tu);
  const displayTO =
    bulkEditMode && bulkLiveAssignments && !suppressEdits ? hoursInfo.to : (employee._displayTO ?? hoursInfo.to);
  const isVarHours = heatmapMode === "variance_hours";
  const isHoursMode = heatmapMode === "hours";
  const metricRate =
    heatmapMode === "availability" ? Math.max(0, 100 - displayTO) : heatmapMode === "to" ? displayTO : displayTU;
  const metricLabel = isVarHours
    ? "\u0394h"
    : isHoursMode
      ? "h"
      : heatmapMode === "availability"
        ? "Di"
        : heatmapMode === "to"
          ? "TO"
          : "TU";
  const varH = employee._varianceHours;
  const varHVal = isVarHours ? (varH ?? 0) : 0;
  const chH =
    bulkEditMode && bulkLiveAssignments
      ? (hoursInfo.chargeableH ?? 0)
      : (employee._displayChH ?? hoursInfo.chargeableH ?? 0);
  const netH =
    bulkEditMode && bulkLiveAssignments ? (hoursInfo.netH ?? 0) : (employee._displayNetH ?? hoursInfo.netH ?? 0);
  const metricText = isVarHours
    ? `\u0394h ${varHVal >= 0 ? "+" : ""}${varHVal.toFixed(1)}h`
    : isHoursMode
      ? `${chH.toFixed(0)}/${netH.toFixed(0)}h`
      : `${metricRate === 100 ? "100" : metricRate.toFixed(1)}%`;

  // Tooltip breakdown for TU display -- use same source as header metrics
  const useBaseMetrics = suppressEdits && !(bulkEditMode && bulkLiveAssignments);
  const tuTooltip = useMemo(() => {
    const chH = useBaseMetrics ? (hoursInfo.chargeableH ?? 0) : (employee._displayChH ?? hoursInfo.chargeableH ?? 0);
    const netH = useBaseMetrics ? (hoursInfo.netH ?? 0) : (employee._displayNetH ?? hoursInfo.netH ?? 0);
    const absH = useBaseMetrics ? (hoursInfo.absenceH ?? 0) : (employee._displayAbsH ?? hoursInfo.absenceH ?? 0);
    const trH = useBaseMetrics ? (hoursInfo.trainingH ?? 0) : (employee._displayTrH ?? hoursInfo.trainingH ?? 0);
    const activeN = useBaseMetrics ? (hoursInfo.workDays ?? 0) : (employee._displayActiveN ?? hoursInfo.workDays ?? 0);
    const grossH = activeN * getHoursPerDay(employee.grade);
    const lines = [
      isVarHours
        ? `\u0394h: ${varHVal >= 0 ? "+" : ""}${varHVal.toFixed(1)}h`
        : `${metricLabel}: ${metricRate.toFixed(1)}%`,
      `Ch: ${chH}h / Net: ${netH}h`,
      `Abs: ${absH}h | Tr: ${trH}h`,
      `Gross: ${grossH}h (${activeN}d)`,
    ];
    if (employee._sapPct > 0) lines.push(`SAP: ${employee._sapPct}%`);
    return lines.join("\n");
  }, [employee, hoursInfo, metricLabel, metricRate, isVarHours, varH]);

  return {
    hoursInfo,
    mdsHoursInfo,
    mdsClippedStart,
    staffAlerts,
    empTLPct,
    teamTLPct,
    tlTooltip,
    gradeTransition,
    currentEtp,
    gradeTarget,
    gapPct,
    gapHours,
    potentialTeamPts,
    potentialTooltip,
    teamContribPts,
    sapCompletion,
    metricColor,
    displayTU,
    displayTO,
    isVarHours,
    isHoursMode,
    metricRate,
    metricLabel,
    varH,
    varHVal,
    chH,
    netH,
    metricText,
    tuTooltip,
  };
}
