import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { animations, easing } from "../../../../styles/animations";
import {
  getGradeColor,
  compareGrades,
  CHARGEABLE_CATS,
  GO_CATS,
  JOB_CATEGORIES,
  CATEGORY_BAR_COLORS,
  getHoursPerDay,
} from "../../constants";
import { getSegmentScale } from "../../utils/aggregateCalc";
import { getGradeTarget, getHeatmapStyle, fmtHD, M_PLUS_GRADES } from "../../constants/theme";
import { UTILIZATION_FILTERS } from "../../utils/filterUtils";
import { getRealEmpId, countUniqueReal } from "../../utils/empIdUtils";
import { getToday } from "../../../../utils/formatters";
import type { Employee, DailyCell, EmployeeDailyData } from "../../types";
import type { SxProps, Theme } from "@mui/material/styles";

// Mapping bucket keys → UTILIZATION_FILTERS values
export const BUCKET_TO_FILTER = {
  bench: UTILIZATION_FILTERS.BENCH,
  critical: UTILIZATION_FILTERS.CRITICAL,
  low: UTILIZATION_FILTERS.LOW,
  partial: UTILIZATION_FILTERS.PARTIAL,
  on_target: UTILIZATION_FILTERS.ON_TARGET,
};

// ─── Utilization distribution bar ─────────────────────────────────────────────
// Variance-mode buckets for Δh (hours)
const VARIANCE_H_BUCKETS = [
  { key: "far_below", label: "< -20h", color: "#4a3728", count: 0 },
  { key: "below", label: "-20h to 0", color: "#a8917e", count: 0 },
  { key: "neutral", label: "0", color: "#cdbdaf", count: 0 },
  { key: "above", label: "0 to +20h", color: "#a8abb2", count: 0 },
  { key: "far_above", label: "> +20h", color: "#d8dade", count: 0 },
];
// Variance-mode buckets for Δh% (points)
const VARIANCE_PCT_BUCKETS = [
  { key: "far_below", label: "< -10pts", color: "#4a3728", count: 0 },
  { key: "below", label: "-10 to 0", color: "#a8917e", count: 0 },
  { key: "neutral", label: "0", color: "#cdbdaf", count: 0 },
  { key: "above", label: "0 to +10pts", color: "#a8abb2", count: 0 },
  { key: "far_above", label: "> +10pts", color: "#d8dade", count: 0 },
];

interface UtilizationDistributionProps {
  employees: Employee[];
  onBucketClick?: (key: string) => void;
  activeBucket?: string | null;
  heatmapMode?: string;
  vertical?: boolean;
  timelineStart?: Date | string;
  timelineEnd?: Date | string;
  [key: string]: unknown;
}

export const UtilizationDistribution = memo(
  ({
    employees,
    onBucketClick,
    activeBucket,
    heatmapMode = "utilization",
    vertical = false,
    timelineStart,
    timelineEnd,
  }: UtilizationDistributionProps) => {
    // Deduplicate grade-split rows: aggregate hours per real employee, exclude inactive in period
    const dedupedEmployees = useMemo(() => {
      // Period bounds for presence check
      const pStart = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : null;
      const pEnd = timelineEnd ? new Date(timelineEnd).toISOString().slice(0, 10) : null;

      const map = new Map<string, Employee>();
      employees.forEach((emp) => {
        const rid = getRealEmpId(emp);
        const prev = map.get(rid);
        if (!prev) {
          map.set(rid, { ...emp });
        } else {
          // Sum hours across splits
          prev._displayChH = (prev._displayChH ?? 0) + (emp._displayChH ?? 0);
          prev._displayNetH = (prev._displayNetH ?? 0) + (emp._displayNetH ?? 0);
          prev._displayTrH = (prev._displayTrH ?? 0) + (emp._displayTrH ?? 0);
          prev._displayAbsH = (prev._displayAbsH ?? 0) + (emp._displayAbsH ?? 0);
          prev._varianceHours = (prev._varianceHours ?? 0) + (emp._varianceHours ?? 0);
          // Recompute derived rates from summed hours
          const netH = prev._displayNetH || 0;
          prev._displayTU = netH > 0 ? (prev._displayChH / netH) * 100 : 0;
          prev._displayTO = netH > 0 ? ((prev._displayChH + prev._displayTrH) / netH) * 100 : 0;
          prev._varianceRate = netH > 0 ? ((prev._varianceHours ?? 0) / netH) * 100 : 0;
          // Keep earliest arrival / latest departure
          if (emp._arrivalDate && (!prev._arrivalDate || emp._arrivalDate < prev._arrivalDate))
            prev._arrivalDate = emp._arrivalDate;
          if (emp._departureDate && (!prev._departureDate || emp._departureDate > prev._departureDate))
            prev._departureDate = emp._departureDate;
        }
      });
      // Exclude employees not present in the selected period
      return [...map.values()].filter((emp) => {
        const arr = emp._arrivalDate;
        const dep = emp._departureDate;
        if (arr && pEnd && arr >= pEnd) return false;
        if (dep && pStart && dep < pStart) return false;
        return true;
      });
    }, [employees, timelineStart, timelineEnd]);

    const buckets = useMemo(() => {
      const isVarianceH = heatmapMode === "variance_hours";
      const isVariancePct = heatmapMode === "variance_hours_pct";

      if (isVarianceH) {
        const b = VARIANCE_H_BUCKETS.map((x) => ({ ...x, count: 0 }));
        dedupedEmployees.forEach((emp) => {
          const v = emp._varianceHours ?? 0;
          if (v < -20) b[0].count++;
          else if (v < 0) b[1].count++;
          else if (v === 0) b[2].count++;
          else if (v <= 20) b[3].count++;
          else b[4].count++;
        });
        return b;
      }
      if (isVariancePct) {
        const b = VARIANCE_PCT_BUCKETS.map((x) => ({ ...x, count: 0 }));
        dedupedEmployees.forEach((emp) => {
          const v = emp._varianceRate ?? 0;
          if (v < -10) b[0].count++;
          else if (v < 0) b[1].count++;
          else if (v === 0) b[2].count++;
          else if (v <= 10) b[3].count++;
          else b[4].count++;
        });
        return b;
      }

      // Target-relative buckets — GAIF palette (warm brown → cool grey)
      const b = [
        { key: "bench", label: "0% (bench)", color: "#4a3728", count: 0 }, // darkest brown (Partner text)
        { key: "critical", label: "< 50% of target", color: "#a8917e", count: 0 }, // warm brown (Partner border)
        { key: "low", label: "50-80% of target", color: "#cdbdaf", count: 0 }, // light brown (Manager border)
        { key: "partial", label: "80-100% of target", color: "#a8abb2", count: 0 }, // cool grey (SC border)
        { key: "on_target", label: "≥ target", color: "#d8dade", count: 0 }, // lightest grey (Intern border)
      ];
      dedupedEmployees.forEach((emp) => {
        const tu = emp._displayTU ?? 0;
        const target = getGradeTarget(emp.grade) ?? 80;
        if (tu === 0) b[0].count++;
        else if (tu >= target) b[4].count++;
        else {
          const rel = target > 0 ? (tu / target) * 100 : 0;
          if (rel >= 80) b[3].count++;
          else if (rel >= 50) b[2].count++;
          else b[1].count++;
        }
      });
      return b;
    }, [dedupedEmployees, heatmapMode]);

    const total = dedupedEmployees.length || 1;

    return (
      <Box
        sx={
          vertical
            ? {
                display: "flex",
                flexDirection: "column",
                width: 18,
                borderRadius: "9999px",
                overflow: "hidden",
                bgcolor: "grey.100",
                height: "100%",
              }
            : { display: "flex", height: 22, borderRadius: "9999px", overflow: "hidden", bgcolor: "grey.100" }
        }
      >
        {buckets.map((b) => {
          const w = (b.count / total) * 100;
          if (w === 0) return null;
          const isActive = activeBucket === b.key;
          const isDimmed = activeBucket && !isActive;
          return (
            <Box
              key={b.key}
              sx={{
                bgcolor: b.color,
                ...(vertical ? { height: `${w}%` } : { width: `${w}%` }),
                transition: `opacity 0.3s ${easing.elegant}`,
                cursor: onBucketClick ? "pointer" : "default",
                opacity: isDimmed ? 0.3 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(isActive && { outline: "2px solid", outlineColor: "grey.800", outlineOffset: 1 }),
              }}
              title={`${b.label}: ${b.count}`}
              onClick={onBucketClick ? () => onBucketClick(b.key) : undefined}
            >
              {b.count > 0 && w >= 8 && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1,
                    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    ...(vertical && { writingMode: "vertical-rl", transform: "rotate(180deg)" }),
                  }}
                >
                  {b.count}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }
);
UtilizationDistribution.displayName = "UtilizationDistribution";

// ─── Grade pyramid (target vs actual) ─────────────────────────────────────────

// Tiers du plus senior au plus junior — libellés GAIF
export const PYRAMID_TIERS = [
  { grades: ["Partner"], display: "Directeur" },
  { grades: ["Director"], display: "Resp. pôle" },
  { grades: ["Senior Manager"], display: "Chef mission" },
  { grades: ["Manager"], display: "Expert sr" },
  { grades: ["Senior Consultant"], display: "Expert" },
  { grades: ["Consultant"], display: "Chargé mission" },
  { grades: ["Analyst"], display: "Junior" },
  { grades: ["Intern"], display: "Apprenti" },
];

/** Working-day FTE for an employee: presence-based (arrival/departure), mode-independent */
const computeEmpFte = (emp: Employee, totalWorkDays: number): number => {
  if (totalWorkDays <= 0) return 1;
  return Math.min(1, (emp._presenceActiveN || emp._displayActiveN || 0) / totalWorkDays);
};

interface GradePyramidProps {
  items: { label: string; count: number; [key: string]: unknown }[];
  employees?: Employee[];
  onTierClick?: (tier: string) => void;
  activeTier?: string | null;
  timelineStart?: Date | string;
  timelineEnd?: Date | string;
  employeeMetadata?: Record<string, { arrivalDate?: string; departureDate?: string; [key: string]: unknown }> | null;
  pyramidMode?: string;
  pipelineJobcodes?: Map<string, { opportunityName?: string; account?: string; [key: string]: unknown }> | null;
  showIO?: string;
  ioJobcodes?: Set<string> | null;
  chargeableCombined?: boolean;
  topNProjects?: number;
  topNClients?: number;
  sx?: SxProps<Theme>;
  hideLegend?: boolean;
  heatmapMode?: string;
  dailyGrid?: Map<string, EmployeeDailyData>;
  [key: string]: unknown;
}

export const GradePyramid = memo(
  ({
    items,
    employees = [],
    onTierClick,
    activeTier,
    timelineStart,
    timelineEnd,
    employeeMetadata,
    pyramidMode = "grade",
    pipelineJobcodes,
    showIO,
    ioJobcodes,
    chargeableCombined = false,
    topNProjects = 7,
    topNClients = 7,
    sx: sxProp,
    hideLegend = false,
    heatmapMode = "tu",
    dailyGrid,
  }: GradePyramidProps) => {
    // ── Project pyramid tiers (dailyGrid-based, respects SAP/MDS temporal logic) ─
    const projectTiers = useMemo(() => {
      if (pyramidMode !== "project") return [];
      if (!dailyGrid || dailyGrid.size === 0) return [];

      const projMap: Record<
        string,
        { jobNo: string; jobName: string; empIds: Set<string>; totalChH: number; gradeChH: Record<string, number> }
      > = {};
      let teamNetH = 0;

      employees.forEach((emp) => {
        const grid = dailyGrid.get(emp.empId);
        if (!grid?.cells) return;
        const grade = emp.grade || "Unassigned";
        const hpd = getHoursPerDay(emp.grade);
        let empActiveDays = 0;

        for (const cell of grid.cells) {
          if (!cell.segments || cell.segments.length === 0) continue;
          // Count active day for net hours
          const isActive = cell.hasStaffing || cell.isSap || cell.isHoliday;
          if (isActive && !cell.isInactive) empActiveDays++;

          for (const seg of cell.segments) {
            const isCh = CHARGEABLE_CATS.has(seg.category) && seg.category !== JOB_CATEGORIES.PENDING;
            const isGo = chargeableCombined && GO_CATS.has(seg.category);
            if (!isCh && !isGo) continue;
            if (!seg.jobNo) continue;

            const scale = getSegmentScale(seg.category, cell, chargeableCombined);
            const chH = (seg.util / 100) * scale * hpd;

            const key = seg.jobNo;
            if (!projMap[key])
              projMap[key] = {
                jobNo: seg.jobNo,
                jobName: seg.name || seg.jobNo,
                empIds: new Set(),
                totalChH: 0,
                gradeChH: {},
              };
            projMap[key].empIds.add(emp.empId);
            projMap[key].totalChH += chH;
            projMap[key].gradeChH[grade] = (projMap[key].gradeChH[grade] || 0) + chH;
          }
        }
        teamNetH += empActiveDays * hpd;
      });

      const teamChH = Object.values(projMap).reduce((s, p) => s + p.totalChH, 0);
      const gradeOrder = [
        "Partner",
        "Director",
        "Senior Manager",
        "Manager",
        "Senior Consultant",
        "Consultant",
        "Analyst",
        "Intern",
      ];

      return Object.values(projMap)
        .map((p) => {
          const count = p.empIds.size;
          const pctOfTeam = teamChH > 0 ? (p.totalChH / teamChH) * 100 : 0;
          const tuContrib = teamNetH > 0 ? (p.totalChH / teamNetH) * 100 : 0;
          const opp = pipelineJobcodes?.get(p.jobNo);
          const display = opp?.account ? `${opp.account} - ${opp.opportunityName}` : p.jobName;
          const gradeSegments = Object.entries(p.gradeChH)
            .map(([grade, chH]) => ({ grade, chH, pct: p.totalChH > 0 ? (chH / p.totalChH) * 100 : 0 }))
            .sort((a, b) => {
              const ai = gradeOrder.indexOf(a.grade);
              const bi = gradeOrder.indexOf(b.grade);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
          const totalDays = p.totalChH / 8;
          return {
            display,
            jobNo: p.jobNo,
            count,
            totalChH: p.totalChH,
            totalDays,
            pctOfTeam,
            tuContrib,
            gradeSegments,
          };
        })
        .sort((a, b) => b.totalChH - a.totalChH)
        .slice(0, topNProjects);
    }, [employees, pyramidMode, pipelineJobcodes, dailyGrid, chargeableCombined, topNProjects]);

    // ── Client pyramid tiers (dailyGrid-based, respects SAP/MDS temporal logic) ─
    const clientTiers = useMemo(() => {
      if (pyramidMode !== "client") return [];
      if (!dailyGrid || dailyGrid.size === 0) return [];

      const clientMap: Record<
        string,
        { account: string; empIds: Set<string>; totalChH: number; gradeChH: Record<string, number> }
      > = {};
      let teamNetH = 0;

      employees.forEach((emp) => {
        const grid = dailyGrid.get(emp.empId);
        if (!grid?.cells) return;
        const grade = emp.grade || "Unassigned";
        const hpd = getHoursPerDay(emp.grade);
        let empActiveDays = 0;

        for (const cell of grid.cells) {
          if (!cell.segments || cell.segments.length === 0) continue;
          const isActive = cell.hasStaffing || cell.isSap || cell.isHoliday;
          if (isActive && !cell.isInactive) empActiveDays++;

          for (const seg of cell.segments) {
            const isCh = CHARGEABLE_CATS.has(seg.category) && seg.category !== JOB_CATEGORIES.PENDING;
            const isGo = chargeableCombined && GO_CATS.has(seg.category);
            if (!isCh && !isGo) continue;
            if (!seg.jobNo) continue;

            const scale = getSegmentScale(seg.category, cell, chargeableCombined);
            const chH = (seg.util / 100) * scale * hpd;

            const opp = pipelineJobcodes?.get(seg.jobNo);
            const account = opp?.account || seg.name || "Unknown";
            if (!clientMap[account]) clientMap[account] = { account, empIds: new Set(), totalChH: 0, gradeChH: {} };
            clientMap[account].empIds.add(emp.empId);
            clientMap[account].totalChH += chH;
            clientMap[account].gradeChH[grade] = (clientMap[account].gradeChH[grade] || 0) + chH;
          }
        }
        teamNetH += empActiveDays * hpd;
      });

      const teamChH = Object.values(clientMap).reduce((s, p) => s + p.totalChH, 0);
      const gradeOrder = [
        "Partner",
        "Director",
        "Senior Manager",
        "Manager",
        "Senior Consultant",
        "Consultant",
        "Analyst",
        "Intern",
      ];

      return Object.values(clientMap)
        .map((p) => {
          const count = p.empIds.size;
          const pctOfTeam = teamChH > 0 ? (p.totalChH / teamChH) * 100 : 0;
          const tuContrib = teamNetH > 0 ? (p.totalChH / teamNetH) * 100 : 0;
          const gradeSegments = Object.entries(p.gradeChH)
            .map(([grade, chH]) => ({ grade, chH, pct: p.totalChH > 0 ? (chH / p.totalChH) * 100 : 0 }))
            .sort((a, b) => {
              const ai = gradeOrder.indexOf(a.grade);
              const bi = gradeOrder.indexOf(b.grade);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
          const totalDays = p.totalChH / 8;
          return { display: p.account, count, totalChH: p.totalChH, totalDays, pctOfTeam, tuContrib, gradeSegments };
        })
        .sort((a, b) => b.totalChH - a.totalChH)
        .slice(0, topNClients);
    }, [employees, pyramidMode, pipelineJobcodes, dailyGrid, chargeableCombined, topNClients]);

    // ── Grade pyramid tiers ────────────────────────────────────────────────────
    const tiers = useMemo(() => {
      if (pyramidMode !== "grade") return [];
      const itemMap: Record<string, { label: string; count: number; [key: string]: unknown }> = {};
      items.forEach((it) => {
        itemMap[it.label] = it;
      });
      const matched = new Set();

      // FTE computation: count working days in the timeline period (aligned with TU Trend)
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

      // Index employees by grade for composition
      const empByGrade: Record<string, Employee[]> = {};
      employees.forEach((e) => {
        const g = e.grade || "Unassigned";
        if (!empByGrade[g]) empByGrade[g] = [];
        empByGrade[g].push(e);
      });

      const result = PYRAMID_TIERS.map((tier) => {
        let totalCount = 0;
        let tierEmps: Employee[] = [];
        let tierFte = 0,
          tierRealFte = 0;
        tier.grades.forEach((g) => {
          const it = itemMap[g];
          if (it) {
            totalCount += it.count;
            matched.add(g);
          }
          if (empByGrade[g]) tierEmps = tierEmps.concat(empByGrade[g]);
        });
        if (totalCount === 0) return null;
        const target = getGradeTarget(tier.grades[0]);

        // Compute FTE for this tier
        tierEmps.forEach((e) => {
          tierFte += computeEmpFte(e, totalWorkDays);
          tierRealFte = tierFte;
        });

        // Category composition from display metrics (consistent with heatmap strips)
        const totalNet = tierEmps.reduce(
          (s: number, e: Employee) => s + (e._displayNetH ?? e._hoursInfo?.netH ?? e.totalNetHours ?? 0),
          0
        );
        const totalChOnly = tierEmps.reduce(
          (s: number, e: Employee) =>
            s + (e._displayChH ?? e._hoursInfo?.chargeableH ?? e.totalChargeableOnlyHoursInPeriod ?? 0),
          0
        );
        const totalGO = tierEmps.reduce(
          (s: number, e: Employee) => s + (e._hoursInfo?.generalOpptyH ?? e.generalOpptyHours ?? 0),
          0
        );
        const totalTr = tierEmps.reduce(
          (s: number, e: Employee) =>
            s + (e._displayTrH ?? e._hoursInfo?.trainingH ?? e.totalTrainingHoursInPeriod ?? 0),
          0
        );
        const chPct = totalNet > 0 ? (totalChOnly / totalNet) * 100 : 0;
        const goPct = totalNet > 0 ? (totalGO / totalNet) * 100 : 0;
        const trPct = totalNet > 0 ? (totalTr / totalNet) * 100 : 0;

        // Weighted TU/TO from hours (consistent with heatmap strips aggregate)
        const actual =
          totalNet > 0
            ? heatmapMode === "to"
              ? ((totalChOnly + totalGO + totalTr) / totalNet) * 100
              : ((totalChOnly + totalGO) / totalNet) * 100
            : 0;

        // Gap vs target
        const gapPts = Math.max(0, target - actual);
        const gapHours = (gapPts / 100) * totalNet;

        // I&O TU per tier
        let tierIoTU: number | null = null;
        if (ioJobcodes && ioJobcodes.size > 0) {
          let ioH = 0;
          let hasIo = false;
          tierEmps.forEach((e) => {
            if (e._ioTU != null) {
              hasIo = true;
              const net = e._displayNetH ?? e._hoursInfo?.netH ?? e.totalNetHours ?? 0;
              ioH += (e._ioTU / 100) * net;
            }
          });
          if (hasIo && totalNet > 0) tierIoTU = (ioH / totalNet) * 100;
        }

        return {
          display: tier.display,
          avgUtilization: actual,
          count: totalCount,
          fte: tierFte,
          realFte: tierRealFte,
          target,
          chPct,
          goPct,
          trPct,
          gapPts,
          gapHours,
          ioTU: tierIoTU,
        };
      }).filter((x): x is NonNullable<typeof x> => x != null);

      // Unmatched grades
      items.forEach((it) => {
        if (!matched.has(it.label)) {
          const emps = empByGrade[it.label] || [];
          const target = getGradeTarget(it.label);
          let tierFte = 0,
            tierRealFte = 0;
          emps.forEach((e) => {
            tierFte += computeEmpFte(e, totalWorkDays);
            tierRealFte = tierFte;
          });
          const totalNet = emps.reduce(
            (s: number, e: Employee) => s + (e._displayNetH ?? e._hoursInfo?.netH ?? e.totalNetHours ?? 0),
            0
          );
          const totalChOnly = emps.reduce(
            (s: number, e: Employee) =>
              s + (e._displayChH ?? e._hoursInfo?.chargeableH ?? e.totalChargeableOnlyHoursInPeriod ?? 0),
            0
          );
          const totalGO = emps.reduce(
            (s: number, e: Employee) => s + (e._hoursInfo?.generalOpptyH ?? e.generalOpptyHours ?? 0),
            0
          );
          const totalTr = emps.reduce(
            (s: number, e: Employee) =>
              s + (e._displayTrH ?? e._hoursInfo?.trainingH ?? e.totalTrainingHoursInPeriod ?? 0),
            0
          );
          const chPct = totalNet > 0 ? (totalChOnly / totalNet) * 100 : 0;
          const goPct = totalNet > 0 ? (totalGO / totalNet) * 100 : 0;
          const weightedTU =
            totalNet > 0
              ? heatmapMode === "to"
                ? ((totalChOnly + totalGO + totalTr) / totalNet) * 100
                : ((totalChOnly + totalGO) / totalNet) * 100
              : 0;
          const gapPts = Math.max(0, target - weightedTU);
          let tierIoTU: number | null = null;
          if (ioJobcodes && ioJobcodes.size > 0) {
            let ioH = 0;
            let hasIo = false;
            emps.forEach((e) => {
              if (e._ioTU != null) {
                hasIo = true;
                const net = e._displayNetH ?? e._hoursInfo?.netH ?? e.totalNetHours ?? 0;
                ioH += (e._ioTU / 100) * net;
              }
            });
            if (hasIo && totalNet > 0) tierIoTU = (ioH / totalNet) * 100;
          }
          result.push({
            display: it.label,
            avgUtilization: weightedTU,
            count: it.count,
            fte: tierFte,
            realFte: tierRealFte,
            target,
            chPct,
            goPct,
            trPct: totalNet > 0 ? (totalTr / totalNet) * 100 : 0,
            gapPts,
            gapHours: (gapPts / 100) * totalNet,
            ioTU: tierIoTU,
          });
        }
      });

      return result;
    }, [items, employees, timelineStart, timelineEnd, employeeMetadata, pyramidMode, ioJobcodes, heatmapMode]);

    // ── Shared layout helpers ────────────────────────────────────────────────────
    const activeTiers = pyramidMode === "project" ? projectTiers : pyramidMode === "client" ? clientTiers : tiers;
    const maxCount = Math.max(
      ...activeTiers.map((t) =>
        pyramidMode === "grade" && "fte" in t && (t as { fte: number }).fte > 0 ? (t as { fte: number }).fte : t.count
      ),
      1
    );
    const maxChH =
      pyramidMode !== "grade"
        ? Math.max(...(pyramidMode === "client" ? clientTiers : projectTiers).map((t) => t.totalChH), 1)
        : 1;
    const activeCount = useMemo(() => {
      const today = getToday();
      const activeRealIds = new Set<string>();
      employees.forEach((e) => {
        const meta = employeeMetadata?.[getRealEmpId(e)];
        const arr = meta?.arrivalDate || e._arrivalDate;
        const dep = meta?.departureDate || e._departureDate;
        if ((!arr || today >= arr) && (!dep || today <= dep)) {
          activeRealIds.add(getRealEmpId(e));
        }
      });
      return activeRealIds.size || countUniqueReal(employees);
    }, [employees, employeeMetadata]);
    const totalHeadcount = countUniqueReal(employees);
    const totalFte = pyramidMode === "grade" ? tiers.reduce((s, t) => s + t.fte, 0) : 0;
    const totalRealFte = pyramidMode === "grade" ? tiers.reduce((s, t) => s + (t.realFte ?? t.fte), 0) : 0;

    return (
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 2.5,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
          ...animations.cardEntrance(500),
          ...sxProp,
        }}
      >
        {pyramidMode === "project" || pyramidMode === "client" ? (
          /* ── Project / Client Pyramid (grade-segmented bars) ── */
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              minHeight: 0,
              justifyContent: "space-between",
              gap: 0.5,
            }}
          >
            {(pyramidMode === "client" ? clientTiers : projectTiers).map((tier, idx) => {
              const widthPct = Math.max(15, Math.min(100, 30 + (tier.totalChH / maxChH) * 70));
              const isActive = activeTier === tier.display;
              const isDimmed = activeTier && !isActive;
              // Use the dominant grade's color for the tier label & hover
              const dominantGrade = tier.gradeSegments[0]?.grade || "Unassigned";
              const dominantColor = getGradeColor(dominantGrade);

              return (
                <Box
                  key={tier.display}
                  sx={{
                    width: `${widthPct}%`,
                    overflow: "visible",
                    transition: `width 0.4s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.2s ${easing.elegant}, opacity 0.2s ${easing.elegant}`,
                    ...(onTierClick && {
                      cursor: "pointer",
                      "&:hover": { bgcolor: alpha(dominantColor.border, 0.06), borderRadius: 1.5 },
                    }),
                    ...(isDimmed && { opacity: 0.3 }),
                    ...(isActive && {
                      outline: "2px solid",
                      outlineColor: dominantColor.border,
                      borderRadius: 1.5,
                      p: 0.5,
                      m: -0.5,
                    }),
                  }}
                  onClick={onTierClick ? () => onTierClick(tier.display) : undefined}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: "0.875rem",
                      mb: 0.5,
                      whiteSpace: "nowrap",
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: dominantColor.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                      title={tier.display}
                    >
                      {tier.display}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      position: "relative",
                      height: 24,
                      bgcolor: alpha(dominantColor.border, 0.1),
                      borderRadius: "12px",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    {[...tier.gradeSegments].reverse().map((seg) => {
                      const gc = getGradeColor(seg.grade);
                      return (
                        <Box
                          key={seg.grade}
                          sx={{ height: "100%", bgcolor: gc.border, width: `${Math.min(seg.pct, 100)}%` }}
                          title={`${seg.grade}: ${(seg.chH / 8).toFixed(0)}d – ${seg.pct.toFixed(1)}%`}
                        />
                      );
                    })}
                    <Typography
                      variant="body2"
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        pointerEvents: "none",
                      }}
                    >
                      {tier.count} emp. – {tier.totalDays.toFixed(0)}j – {tier.tuContrib.toFixed(1)}% TU
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          /* ── Grade Pyramid ────────────────────────────────────────────────── */
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              minHeight: 0,
              justifyContent: "space-between",
              gap: 0.5,
            }}
          >
            {tiers.map((tier, tierIdx) => {
              const {
                target,
                avgUtilization: actual,
                chPct,
                goPct,
                trPct,
                gapPts,
                gapHours,
                ioTU: tierIoTU,
                realFte: tierRealFte,
              } = tier;
              const tierSize = tier.fte > 0 ? tier.fte : tier.count;
              const widthPct = Math.max(15, (tierSize / maxCount) * 100);
              const isOnTarget = actual >= target;
              const gradeColors = getGradeColor(PYRAMID_TIERS[tierIdx]?.grades[0] || tier.display);
              const isActive = activeTier === tier.display;
              const isDimmed = activeTier && !isActive;

              // Detect M+/M- boundary: current tier is M+ and next tier is M-
              const currentGrade = PYRAMID_TIERS[tierIdx]?.grades[0] || tier.display;
              const nextGrade =
                tierIdx < tiers.length - 1 ? PYRAMID_TIERS[tierIdx + 1]?.grades[0] || tiers[tierIdx + 1].display : null;
              const isMPlusBoundary =
                nextGrade && M_PLUS_GRADES.includes(currentGrade) && !M_PLUS_GRADES.includes(nextGrade);

              return (
                <React.Fragment key={tier.display}>
                  <Box
                    sx={{
                      width: `${widthPct}%`,
                      overflow: "visible",
                      transition: `width 0.4s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.2s ${easing.elegant}, opacity 0.2s ${easing.elegant}`,
                      ...(onTierClick && {
                        cursor: "pointer",
                        "&:hover": { bgcolor: alpha(gradeColors.border, 0.06), borderRadius: 1.5 },
                      }),
                      ...(isDimmed && { opacity: 0.3 }),
                      ...(isActive && {
                        outline: "2px solid",
                        outlineColor: gradeColors.border,
                        borderRadius: 1.5,
                        p: 0.5,
                        m: -0.5,
                      }),
                    }}
                    onClick={onTierClick ? () => onTierClick(tier.display) : undefined}
                  >
                    <Tooltip
                      title={`${tier.display} – ${actual.toFixed(1)}% / cible ${target}%${isOnTarget ? " ✓" : gapHours > 0 ? ` – ${(gapHours / 8).toFixed(0)}j à la cible` : ""}${showIO === "show" && tierIoTU != null ? ` · GAIF ${tierIoTU.toFixed(1)}%` : ""}`}
                      placement="top"
                      arrow
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: "0.875rem",
                          mb: 0.5,
                          whiteSpace: "nowrap",
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="body2" sx={{ color: gradeColors.text }}>
                          {tier.display} – {tier.count} emp.
                          {tier.fte > 0 && tier.fte !== tier.count ? ` / ${tier.fte.toFixed(1)} ETP` : ""}
                          {tierRealFte != null && tierRealFte < tier.fte - 0.05
                            ? ` – ${tierRealFte.toFixed(1)} réel`
                            : ""}
                        </Typography>
                      </Box>
                    </Tooltip>
                    <Box
                      sx={{
                        position: "relative",
                        height: 24,
                        bgcolor: alpha(gradeColors.border, 0.1),
                        borderRadius: "12px",
                        overflow: "hidden",
                        display: "flex",
                      }}
                    >
                      {chargeableCombined ? (
                        chPct + goPct + (heatmapMode === "to" ? trPct : 0) > 0 && (
                          <Box
                            sx={{
                              height: "100%",
                              bgcolor: gradeColors.border,
                              width: `${Math.min(chPct + goPct + (heatmapMode === "to" ? trPct : 0), 100)}%`,
                              transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
                            }}
                            title={
                              heatmapMode === "to"
                                ? `TO: ${(chPct + goPct + trPct).toFixed(0)}%`
                                : `Chargeable: ${(chPct + goPct).toFixed(0)}%`
                            }
                          />
                        )
                      ) : (
                        <>
                          {chPct > 0 && (
                            <Box
                              sx={{
                                height: "100%",
                                bgcolor: gradeColors.border,
                                width: `${Math.min(chPct, 100)}%`,
                                transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
                              }}
                              title={`Chargeable: ${chPct.toFixed(0)}%`}
                            />
                          )}
                          {goPct > 0 && (
                            <Box
                              sx={{
                                height: "100%",
                                bgcolor: alpha(gradeColors.border, 0.55),
                                width: `${Math.min(goPct, 100 - chPct)}%`,
                                transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
                              }}
                              title={`Gen. Oppty: ${goPct.toFixed(0)}%`}
                            />
                          )}
                          {trPct > 0 && (
                            <Box
                              sx={{
                                height: "100%",
                                bgcolor: alpha(gradeColors.border, heatmapMode === "to" ? 0.7 : 0.3),
                                width: `${Math.min(trPct, 100 - chPct - goPct)}%`,
                                transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
                              }}
                              title={`Training: ${trPct.toFixed(0)}%`}
                            />
                          )}
                        </>
                      )}
                      {/* TU value inside the bar */}
                      <Typography
                        variant="body2"
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: actual > 50 ? "#fff" : gradeColors.text,
                          textShadow: actual > 50 ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                          pointerEvents: "none",
                        }}
                      >
                        {actual.toFixed(1)}%
                      </Typography>
                      {/* Target line */}
                      <Box
                        sx={{
                          position: "absolute",
                          top: -1,
                          bottom: -1,
                          width: 0,
                          borderLeft: "1px solid",
                          borderColor: "text.primary",
                          left: `${Math.min(target, 100)}%`,
                          zIndex: 1,
                        }}
                        title={`Cible : ${target}%`}
                      />
                    </Box>
                  </Box>
                  {/* M+ / M- separator */}
                  {isMPlusBoundary && (
                    <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1, my: 0.25 }}>
                      <Divider sx={{ flex: 1 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Encadrement / Opérationnel
                      </Typography>
                      <Divider sx={{ flex: 1 }} />
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
          </Box>
        )}

        {/* Legend */}
        {!hideLegend && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mt: 1.5,
              fontSize: "0.75rem",
              color: "grey.500",
            }}
          >
            <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box
                component="span"
                sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "#a8917e", display: "inline-block" }}
              />
              Chargeable
            </Box>
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                visibility: pyramidMode === "grade" && !chargeableCombined ? "visible" : "hidden",
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: alpha("#a8917e", 0.55),
                  display: "inline-block",
                }}
              />
              Gen. Oppty
            </Box>
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                visibility: pyramidMode === "grade" && !chargeableCombined ? "visible" : "hidden",
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: alpha("#a8917e", 0.3),
                  display: "inline-block",
                }}
              />
              Training
            </Box>
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                visibility: pyramidMode === "grade" ? "visible" : "hidden",
              }}
            >
              <Box component="span" sx={{ width: 10, height: 2, bgcolor: "text.primary", display: "inline-block" }} />
              Target
            </Box>
          </Box>
        )}
      </Paper>
    );
  }
);
GradePyramid.displayName = "GradePyramid";

export const GradePyramidLegend = memo(
  ({ pyramidMode = "grade", chargeableCombined = false }: { pyramidMode?: string; chargeableCombined?: boolean }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        mt: 1,
        fontSize: "0.75rem",
        color: "grey.500",
      }}
    >
      <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box
          component="span"
          sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "#a8917e", display: "inline-block" }}
        />
        Chargeable
      </Box>
      {pyramidMode === "grade" && !chargeableCombined && (
        <>
          <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              component="span"
              sx={{
                width: 10,
                height: 10,
                borderRadius: 0.5,
                bgcolor: alpha("#a8917e", 0.55),
                display: "inline-block",
              }}
            />
            Gen. Oppty
          </Box>
          <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              component="span"
              sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: alpha("#a8917e", 0.3), display: "inline-block" }}
            />
            Training
          </Box>
        </>
      )}
      {pyramidMode === "grade" && (
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box component="span" sx={{ width: 10, height: 2, bgcolor: "text.primary", display: "inline-block" }} />
          Target
        </Box>
      )}
    </Box>
  )
);
GradePyramidLegend.displayName = "GradePyramidLegend";
