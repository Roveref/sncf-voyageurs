import { useMemo } from "react";
import { compareGrades, getGradeColor, getHoursPerDay, CHARGEABLE_CATS, GO_CATS } from "../constants";
import { getGradeTarget } from "../constants/theme";
import { buildWaterfallSteps } from "../utils/groupingUtils";
import { getRealEmpId } from "../utils/empIdUtils";
import { countTurnoverInRange } from "../utils/turnoverUtils";
import { accumulateCoreStats, computeModeDependentValues } from "../utils/teamStatsCalc";

interface TeamTuStats {
  currentTU: number;
  potentialTU: number;
  theoreticalTU: number;
  delta: number;
  gainHours: number;
  totalNet: number;
  totalGross: number;
  totalAbs: number;
  totalChOnly: number;
  totalGO: number;
  totalTr: number;
  mplusTU: number;
  mminusTU: number;
  mplusIoTU: number | null;
  mminusIoTU: number | null;
  mplusCount: number;
  mminusCount: number;
  mplusFTE: number;
  mminusFTE: number;
  mplusRealFTE: number;
  mminusRealFTE: number;
  sapAvgPct: number;
  sapComplete: number;
  sapPartial: number;
  sapEmpty: number;
  sapVarianceRate: number | null;
  sapVarianceHours: number | null;
  sapEmployeesWithVariance: number;
  modeLabel: string;
  modeUnit: string;
  isVarianceMode: boolean;
  isHoursMode: boolean;
  ioTU: number | null;
  ioChHours: number;
  ioNetHours: number;
  totalWorkDays: number;
  // Churn metrics
  turnoverArrivals: number;
  turnoverDepartures: number;
  turnoverArrivalsAll: number;
  turnoverDeparturesAll: number;
  avgHeadcount: number;
  turnoverChurnRate: number | null;
  projectRotationChanges: number;
  projectRotationRate: number | null;
}

interface GradeItem {
  label: string;
  avgUtilization: number;
  count: number;
  colors: Record<string, any>;
}

/**
 * Computes aggregated team KPI stats (TU/TO, bench, by-grade breakdown, SAP variance, churn)
 * from the filtered employee list. Mode-dependent values recompute independently from the core
 * accumulation to minimize recalculation when only heatmapMode changes.
 */
export const useTeamStats = (
  filteredEmployees: any[],
  heatmapMode: string = "utilization",
  dailyGrid?: Map<string, any>,
  ioJobcodes?: Set<string> | null,
  timelineStart?: any,
  timelineEnd?: any,
  employeeMetadata?: Record<string, any>
): {
  teamTuStats: TeamTuStats;
  gradeItems: GradeItem[];
  buildWaterfallData: (employees: any[]) => any[];
} => {
  // ── Fast/slow split: coreStats is expensive (employee iteration), modeValues is cheap ──
  // When heatmapMode changes, only modeValues recomputes.
  const coreStats = useMemo(() => {
    // Core accumulation (extracted to pure function)
    const core = accumulateCoreStats(filteredEmployees, timelineStart, timelineEnd, ioJobcodes);
    const {
      totalCh,
      totalNet,
      adjustedCh,
      totalChOnly,
      totalGO,
      totalTr,
      totalGross,
      totalAbs,
      mplusCount,
      mminusCount,
      mplusFTE,
      mminusFTE,
      mplusRealFTE,
      mminusRealFTE,
      mplusIoH,
      mplusNet,
      mminusIoH,
      mminusNet,
      sapTotalPct,
      sapComplete,
      sapPartial,
      sapEmpty,
      sapTotalDays,
      sapTotalActiveDays,
      sapAnomalyCount,
      sapTotalOverH,
      sapTotalMissingH,
      sapVarHoursSum,
      sapVarCount,
      activeCount,
      ioChHours,
      totalWorkDays,
    } = core;

    // Churn computation
    const tlStartStr = timelineStart
      ? typeof timelineStart === "string"
        ? timelineStart
        : new Date(timelineStart).toISOString().slice(0, 10)
      : null;
    const tlEndStr = timelineEnd
      ? typeof timelineEnd === "string"
        ? timelineEnd
        : new Date(timelineEnd).toISOString().slice(0, 10)
      : null;
    const activeEmployees = filteredEmployees.filter((e) => e._displayActiveN);
    let avgHeadcount = 0,
      projectRotationChanges = 0;
    const projectChangeKeys = new Set<string>();
    activeEmployees.forEach((emp) => {
      const realId = getRealEmpId(emp);
      const countHC =
        !emp._isGradeSplit ||
        ((!emp._arrivalDate || !tlEndStr || emp._arrivalDate < tlEndStr) &&
          (!emp._departureDate || !tlStartStr || emp._departureDate >= tlStartStr));
      if (countHC) {
        const empFte =
          totalWorkDays > 0 ? Math.min(1, (emp._presenceActiveN || emp._displayActiveN || 0) / totalWorkDays) : 0;
        avgHeadcount += empFte;
      }
      if (tlStartStr && tlEndStr) {
        for (const a of emp.assignments || []) {
          if (!CHARGEABLE_CATS.has(a.category) && !GO_CATS.has(a.category)) continue;
          const startsIn = a.startDate >= tlStartStr && a.startDate < tlEndStr;
          const endsIn = a.endDate >= tlStartStr && a.endDate < tlEndStr;
          if (startsIn || endsIn) projectChangeKeys.add(`${realId}::${a.jobNo}::${a.startDate}`);
        }
      }
    });
    projectRotationChanges = projectChangeKeys.size;
    const turnoverResult =
      tlStartStr && tlEndStr
        ? countTurnoverInRange(activeEmployees, tlStartStr, tlEndStr)
        : { arrivals: 0, departures: 0, arrivalsAll: 0, departuresAll: 0 };
    const {
      arrivals: turnoverArrivals,
      departures: turnoverDepartures,
      arrivalsAll: turnoverArrivalsAll,
      departuresAll: turnoverDeparturesAll,
    } = turnoverResult;
    const turnoverChurnRate = avgHeadcount > 0 ? (turnoverDepartures / avgHeadcount) * 100 : null;
    const projectRotationRate = avgHeadcount > 0 ? (projectRotationChanges / avgHeadcount) * 100 : null;

    return {
      core,
      totalNet,
      totalGross,
      totalAbs,
      totalChOnly,
      totalGO,
      totalTr,
      mplusCount,
      mminusCount,
      mplusFTE,
      mminusFTE,
      mplusRealFTE,
      mminusRealFTE,
      mplusIoTU: mplusNet > 0 && mplusIoH > 0 ? (mplusIoH / mplusNet) * 100 : null,
      mminusIoTU: mminusNet > 0 && mminusIoH > 0 ? (mminusIoH / mminusNet) * 100 : null,
      sapAvgPct: activeCount > 0 ? sapTotalPct / activeCount : 0,
      sapTotalDays,
      sapTotalActiveDays,
      sapComplete,
      sapPartial,
      sapEmpty,
      sapAnomalyCount,
      sapTotalOverH,
      sapTotalMissingH,
      sapVarianceRate: sapVarCount > 0 ? core.sapVarRateSum / sapVarCount : null,
      sapVarianceHours: sapVarHoursSum,
      sapEmployeesWithVariance: sapVarCount,
      ioTU: ioJobcodes && ioJobcodes.size > 0 && totalNet > 0 ? (ioChHours / totalNet) * 100 : null,
      ioChHours,
      ioNetHours: totalNet,
      totalWorkDays,
      turnoverArrivals,
      turnoverDepartures,
      turnoverArrivalsAll,
      turnoverDeparturesAll,
      avgHeadcount,
      turnoverChurnRate,
      projectRotationChanges,
      projectRotationRate,
      adjustedCh,
      totalCh,
    };
  }, [filteredEmployees, ioJobcodes, timelineStart, timelineEnd, employeeMetadata]);

  // Cheap: only re-runs when heatmapMode changes (or coreStats ref changes)
  const teamTuStats = useMemo(() => {
    const { core, adjustedCh, totalCh, ...rest } = coreStats;
    const mode = computeModeDependentValues(core, heatmapMode);
    return {
      ...mode,
      delta: mode.isVarianceMode || mode.isHoursMode ? 0 : mode.potentialTU - mode.currentTU,
      gainHours: mode.isVarianceMode || mode.isHoursMode ? 0 : adjustedCh - totalCh,
      ...rest,
    };
  }, [coreStats, heatmapMode]);

  const gradeItems = useMemo(() => {
    const tlStart = timelineStart ? new Date(timelineStart).getTime() : 0;
    const tlEnd = timelineEnd ? new Date(timelineEnd).getTime() : 0;
    const tlDays = tlStart && tlEnd ? Math.max(1, Math.round((tlEnd - tlStart) / 86400000)) : 0;
    const groups: Record<string, { total: number; count: number; realIds: Set<string> }> = {};
    const globalRealIds = new Set<string>();
    filteredEmployees.forEach((e) => {
      const g = e.grade || "Unassigned";
      if (!groups[g]) groups[g] = { total: 0, count: 0, realIds: new Set() };
      let val: number;
      switch (heatmapMode) {
        case "to":
          val = e._displayTO ?? e._displayTU ?? e.trueUtilizationRate ?? 0;
          break;
        case "availability":
          val = 100 - (e._displayTU ?? e.trueUtilizationRate ?? 0);
          break;
        case "variance_hours":
          val = e._varianceHours ?? 0;
          break;
        case "variance_hours_pct":
          val = e._varianceRate ?? 0;
          break;
        default:
          val = e._displayTU ?? e.trueUtilizationRate ?? 0;
          break;
      }
      const realId = getRealEmpId(e);
      if (e._isGradeSplit && tlDays > 0) {
        // Fractional ETP: proportion of the timeline period this split covers
        const arrMs = e._arrivalDate ? new Date(e._arrivalDate).getTime() : tlStart;
        const depMs = e._departureDate ? new Date(e._departureDate).getTime() : tlEnd;
        const overlapStart = Math.max(arrMs, tlStart);
        const overlapEnd = Math.min(depMs, tlEnd);
        const overlapDays = Math.max(0, Math.round((overlapEnd - overlapStart) / 86400000));
        const fraction = tlDays > 0 ? overlapDays / tlDays : 0;
        groups[g].total += val * fraction;
        groups[g].count += fraction;
      } else {
        groups[g].total += val;
        if (!globalRealIds.has(realId)) {
          globalRealIds.add(realId);
          groups[g].count++;
        }
      }
    });
    return Object.keys(groups)
      .sort(compareGrades)
      .filter((g) => groups[g].count > 0.01)
      .map((g) => ({
        label: g,
        avgUtilization: groups[g].total / groups[g].count,
        count: Math.round(groups[g].count * 10) / 10,
        colors: getGradeColor(g),
      }));
  }, [filteredEmployees, heatmapMode, timelineStart, timelineEnd]);

  // Waterfall tooltip handler helpers
  const buildWaterfallData = useMemo(() => {
    return (employees: any[]): any[] => {
      let gross = 0,
        abs = 0,
        net = 0,
        chOnly = 0,
        go = 0,
        tr = 0;
      employees.forEach((emp) => {
        gross += (emp.totalWorkingDaysInPeriod || 0) * getHoursPerDay(emp.grade);
        abs += emp.totalAbsenceHoursInPeriod || 0;
        net += emp._displayNetH || emp.totalNetHours || 0;
        const chAll = emp.totalChargeableHoursInPeriod || 0;
        const chOnlyE = emp.totalChargeableOnlyHoursInPeriod || 0;
        chOnly += chOnlyE;
        go += Math.max(0, chAll - chOnlyE);
        tr += emp.totalTrainingHoursInPeriod || 0;
      });
      return buildWaterfallSteps(gross, abs, net, chOnly, go, tr);
    };
  }, []);

  return { teamTuStats, gradeItems, buildWaterfallData };
};
