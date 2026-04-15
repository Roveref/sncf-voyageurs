/**
 * Pure functions extracted from useTeamStats for testability and readability.
 */
import { getHoursPerDay, CHARGEABLE_CATS, GO_CATS } from "../constants";
import { getGradeTarget, M_PLUS_GRADES, M_MINUS_GRADES } from "../constants/theme";
import { getRealEmpId } from "./empIdUtils";
import type { Employee } from "../types";

// ── Core accumulation ──────────────────────────────────────────────────────

export interface CoreAccResult {
  totalCh: number;
  totalNet: number;
  adjustedCh: number;
  targetCh: number;
  totalGross: number;
  totalAbs: number;
  totalChOnly: number;
  totalGO: number;
  totalTr: number;
  mplusCh: number;
  mplusNet: number;
  mplusTr: number;
  mminusCh: number;
  mminusNet: number;
  mminusTr: number;
  mplusCount: number;
  mminusCount: number;
  mplusFTE: number;
  mminusFTE: number;
  mplusRealFTE: number;
  mminusRealFTE: number;
  mplusIoH: number;
  mminusIoH: number;
  sapTotalPct: number;
  sapComplete: number;
  sapPartial: number;
  sapEmpty: number;
  sapTotalDays: number;
  sapTotalActiveDays: number;
  sapAnomalyCount: number;
  sapTotalOverH: number;
  sapTotalMissingH: number;
  sapVarRateSum: number;
  sapVarHoursSum: number;
  sapVarCount: number;
  mplusVarRateSum: number;
  mplusVarCount: number;
  mplusVarHoursSum: number;
  mminusVarRateSum: number;
  mminusVarCount: number;
  mminusVarHoursSum: number;
  activeCount: number;
  ioChHours: number;
  totalWorkDays: number;
}

/** Accumulate core metrics from filtered employees in a single pass. */
export const accumulateCoreStats = (
  filteredEmployees: Employee[],
  timelineStart: Date,
  timelineEnd: Date,
  ioJobcodes?: Set<string> | null
): CoreAccResult => {
  let totalCh = 0,
    totalNet = 0,
    adjustedCh = 0,
    targetCh = 0;
  let totalGross = 0,
    totalAbs = 0,
    totalChOnly = 0,
    totalGO = 0,
    totalTr = 0;
  let mplusCh = 0,
    mplusNet = 0,
    mplusTr = 0,
    mminusCh = 0,
    mminusNet = 0,
    mminusTr = 0;
  let mplusCount = 0,
    mminusCount = 0;
  let sapTotalPct = 0,
    sapComplete = 0,
    sapPartial = 0,
    sapEmpty = 0;
  let sapTotalDays = 0,
    sapTotalActiveDays = 0;
  let sapAnomalyCount = 0,
    sapTotalOverH = 0,
    sapTotalMissingH = 0;
  let sapVarRateSum = 0,
    sapVarHoursSum = 0,
    sapVarCount = 0;
  let mplusVarRateSum = 0,
    mplusVarCount = 0,
    mminusVarRateSum = 0,
    mminusVarCount = 0;
  let mplusVarHoursSum = 0,
    mminusVarHoursSum = 0;
  let mplusIoH = 0,
    mminusIoH = 0;
  let mplusFTE = 0,
    mminusFTE = 0,
    mplusRealFTE = 0,
    mminusRealFTE = 0;
  let activeCount = 0;
  let ioChHours = 0;

  const activeRealIds = new Set<string>();
  const mplusRealIds = new Set<string>();
  const mminusRealIds = new Set<string>();
  const sapRealIds = new Set<string>();

  let totalWorkDays = 0;
  if (timelineStart && timelineEnd) {
    const c = new Date(timelineStart);
    c.setHours(0, 0, 0, 0);
    const eDate = new Date(timelineEnd);
    eDate.setHours(0, 0, 0, 0);
    while (c < eDate) {
      const dw = c.getDay();
      if (dw !== 0 && dw !== 6) totalWorkDays++;
      c.setDate(c.getDate() + 1);
    }
  }

  const pStart = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : null;
  const pEnd = timelineEnd ? new Date(timelineEnd).toISOString().slice(0, 10) : null;

  filteredEmployees.forEach((emp) => {
    if (!emp._displayActiveN) return;
    const realId = getRealEmpId(emp);
    if (!activeRealIds.has(realId)) {
      activeRealIds.add(realId);
      activeCount++;
    }
    const net = emp._displayNetH || emp.totalNetHours || 0;
    const ch = emp._displayChH || 0;
    const tr = emp._displayTrH || 0;
    totalCh += ch;
    totalNet += net;
    totalTr += tr;
    totalGross += (emp.totalWorkingDaysInPeriod || 0) * getHoursPerDay(emp.grade);
    totalAbs += emp.totalAbsenceHoursInPeriod || 0;
    const chAll = emp.totalChargeableHoursInPeriod || 0;
    const chOnlyEmp = emp.totalChargeableOnlyHoursInPeriod || 0;
    totalChOnly += chOnlyEmp;
    totalGO += Math.max(0, chAll - chOnlyEmp);
    const tu = net > 0 ? (ch / net) * 100 : 0;
    const target = getGradeTarget(emp.grade);
    adjustedCh += tu < target ? (target / 100) * net : ch;
    targetCh += (target / 100) * net;
    const empFTE =
      totalWorkDays > 0 ? Math.min(1, (emp._presenceActiveN || emp._displayActiveN || 0) / totalWorkDays) : 1;
    const empRealFTE = empFTE;
    const countHeadcount =
      !emp._isGradeSplit ||
      ((!emp._arrivalDate || !pEnd || emp._arrivalDate < pEnd) &&
        (!emp._departureDate || !pStart || emp._departureDate >= pStart));
    if (M_PLUS_GRADES.includes(emp.grade)) {
      mplusCh += ch;
      mplusNet += net;
      mplusTr += tr;
      if (countHeadcount && !mplusRealIds.has(realId)) {
        mplusRealIds.add(realId);
        mplusCount++;
      }
      mplusFTE += empFTE;
      mplusRealFTE += empRealFTE;
      if ((emp._ioChHours ?? 0) > 0) mplusIoH += emp._ioChHours!;
      if (emp._varianceRate != null) {
        mplusVarRateSum += emp._varianceRate;
        mplusVarCount++;
      }
      if (emp._varianceHours != null) mplusVarHoursSum += emp._varianceHours;
    } else if (M_MINUS_GRADES.includes(emp.grade)) {
      mminusCh += ch;
      mminusNet += net;
      mminusTr += tr;
      if (countHeadcount && !mminusRealIds.has(realId)) {
        mminusRealIds.add(realId);
        mminusCount++;
      }
      mminusFTE += empFTE;
      mminusRealFTE += empRealFTE;
      if ((emp._ioChHours ?? 0) > 0) mminusIoH += emp._ioChHours!;
      if (emp._varianceRate != null) {
        mminusVarRateSum += emp._varianceRate;
        mminusVarCount++;
      }
      if (emp._varianceHours != null) mminusVarHoursSum += emp._varianceHours;
    }
    // SAP stats: hours always summed (grade splits have distinct cells covering different periods)
    // Headcount metrics deduped by realId
    if ((emp._sapOverH ?? 0) > 0) sapTotalOverH += emp._sapOverH!;
    if ((emp._sapMissingH ?? 0) > 0) sapTotalMissingH += emp._sapMissingH!;
    if (emp._varianceHours != null) sapVarHoursSum += emp._varianceHours;
    if (!sapRealIds.has(realId)) {
      sapRealIds.add(realId);
      const sp = emp._sapPct || 0;
      sapTotalPct += sp;
      sapTotalDays += emp._sapDayCount || 0;
      sapTotalActiveDays += emp._sapActiveDayCount || 0;
      if (sp >= 100) sapComplete++;
      else if (sp > 0) sapPartial++;
      else sapEmpty++;
      if (emp._hasSapAnomaly) sapAnomalyCount++;
      if (emp._varianceRate != null) {
        sapVarRateSum += emp._varianceRate;
        sapVarCount++;
      }
    }
  });

  if (ioJobcodes && ioJobcodes.size > 0) {
    filteredEmployees.forEach((emp) => {
      if ((emp._ioChHours ?? 0) > 0) ioChHours += emp._ioChHours!;
    });
  }

  return {
    totalCh,
    totalNet,
    adjustedCh,
    targetCh,
    totalGross,
    totalAbs,
    totalChOnly,
    totalGO,
    totalTr,
    mplusCh,
    mplusNet,
    mplusTr,
    mminusCh,
    mminusNet,
    mminusTr,
    mplusCount,
    mminusCount,
    mplusFTE,
    mminusFTE,
    mplusRealFTE,
    mminusRealFTE,
    mplusIoH,
    mminusIoH,
    sapTotalPct,
    sapComplete,
    sapPartial,
    sapEmpty,
    sapTotalDays,
    sapTotalActiveDays,
    sapAnomalyCount,
    sapTotalOverH,
    sapTotalMissingH,
    sapVarRateSum,
    sapVarHoursSum,
    sapVarCount,
    mplusVarRateSum,
    mplusVarCount,
    mplusVarHoursSum,
    mminusVarRateSum,
    mminusVarCount,
    mminusVarHoursSum,
    activeCount,
    ioChHours,
    totalWorkDays,
  };
};

// ── Mode-dependent TU/TO/Variance calculation ──────────────────────────────

export interface ModeResult {
  currentTU: number;
  potentialTU: number;
  theoreticalTU: number;
  mplusTU: number;
  mminusTU: number;
  modeLabel: string;
  modeUnit: string;
  isVarianceMode: boolean;
  isHoursMode: boolean;
}

/** Compute mode-adapted display values from core accumulators. */
export const computeModeDependentValues = (core: CoreAccResult, heatmapMode: string): ModeResult => {
  const {
    totalCh,
    totalNet,
    adjustedCh,
    targetCh,
    totalTr,
    mplusCh,
    mplusNet,
    mplusTr,
    mminusCh,
    mminusNet,
    mminusTr,
    sapVarRateSum,
    sapVarHoursSum,
    sapVarCount,
    mplusVarRateSum,
    mplusVarCount,
    mplusVarHoursSum,
    mminusVarRateSum,
    mminusVarCount,
    mminusVarHoursSum,
  } = core;

  const baseTU = totalNet > 0 ? (totalCh / totalNet) * 100 : 0;
  const basePotentialTU = totalNet > 0 ? (adjustedCh / totalNet) * 100 : 0;
  const baseTheoreticalTU = totalNet > 0 ? (targetCh / totalNet) * 100 : 0;
  const baseMplusTU = mplusNet > 0 ? (mplusCh / mplusNet) * 100 : 0;
  const baseMminusTU = mminusNet > 0 ? (mminusCh / mminusNet) * 100 : 0;

  const isVarianceMode = heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct";
  const isHoursMode = heatmapMode === "hours";
  let currentTU: number, potentialTU: number, theoreticalTU: number, mplusTU: number, mminusTU: number;
  let modeLabel: string, modeUnit: string;

  switch (heatmapMode) {
    case "to": {
      currentTU = totalNet > 0 ? ((totalCh + totalTr) / totalNet) * 100 : 0;
      const adjustedTO = totalNet > 0 ? ((adjustedCh + totalTr) / totalNet) * 100 : 0;
      potentialTU = adjustedTO;
      theoreticalTU = baseTheoreticalTU;
      mplusTU = mplusNet > 0 ? ((mplusCh + mplusTr) / mplusNet) * 100 : 0;
      mminusTU = mminusNet > 0 ? ((mminusCh + mminusTr) / mminusNet) * 100 : 0;
      modeLabel = "TO";
      modeUnit = "%";
      break;
    }
    case "availability": {
      currentTU = 100 - baseTU;
      potentialTU = 100 - basePotentialTU;
      theoreticalTU = 100 - baseTheoreticalTU;
      mplusTU = 100 - baseMplusTU;
      mminusTU = 100 - baseMminusTU;
      modeLabel = "Avail";
      modeUnit = "%";
      break;
    }
    case "variance_hours": {
      currentTU = sapVarCount > 0 ? sapVarHoursSum : 0;
      potentialTU = 0;
      theoreticalTU = 0;
      mplusTU = mplusVarCount > 0 ? mplusVarHoursSum : 0;
      mminusTU = mminusVarCount > 0 ? mminusVarHoursSum : 0;
      modeLabel = "Δh";
      modeUnit = "h";
      break;
    }
    case "variance_hours_pct": {
      currentTU = sapVarCount > 0 ? sapVarRateSum / sapVarCount : 0;
      potentialTU = 0;
      theoreticalTU = 0;
      mplusTU = mplusVarCount > 0 ? mplusVarRateSum / mplusVarCount : 0;
      mminusTU = mminusVarCount > 0 ? mminusVarRateSum / mminusVarCount : 0;
      modeLabel = "Δh%";
      modeUnit = "pts";
      break;
    }
    case "hours": {
      currentTU = totalCh;
      potentialTU = adjustedCh;
      theoreticalTU = targetCh;
      mplusTU = mplusCh;
      mminusTU = mminusCh;
      modeLabel = "h";
      modeUnit = "h";
      break;
    }
    default: {
      currentTU = baseTU;
      potentialTU = basePotentialTU;
      theoreticalTU = baseTheoreticalTU;
      mplusTU = baseMplusTU;
      mminusTU = baseMminusTU;
      modeLabel = "TU";
      modeUnit = "%";
      break;
    }
  }

  return { currentTU, potentialTU, theoreticalTU, mplusTU, mminusTU, modeLabel, modeUnit, isVarianceMode, isHoursMode };
};
