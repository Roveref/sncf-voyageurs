import { useCallback } from "react";
import { CHARGEABLE_CATS, GO_CATS, getHoursPerDay, MDS_EXTRACT_START } from "../constants";
import { isEmployeeActive, getSegmentScale } from "../utils/aggregateCalc";
import { computeMdsChargeableHours } from "../utils/varianceEngine";
import { getEtpRatio } from "../types";
import { getRealEmpId, countUniqueReal } from "../utils/empIdUtils";
import {
  makePipeline,
  accumulateDayForPipeline,
  accumulateHolidayForPipeline,
  buildCatBreakdown,
  buildPeriodSummary,
  buildTopProjects,
  calculatePresenceFTE,
} from "../utils/periodDetailCalc";

/**
 * Handles heatmap period-click events: aggregates daily cells over the selected date range
 * for all displayed employees and opens the PeriodDetailModal with hours breakdown + top projects.
 */
export function usePeriodDetail({
  displayedEmployees,
  effectiveDailyGrid,
  timelineCalendar,
  chargeableCombined,
  dataSourceDebug,
  useSapActuals,
  jobcodeOppsList,
  setPeriodDetailModal,
}: {
  displayedEmployees: any[];
  effectiveDailyGrid: Map<string, any>;
  timelineCalendar: any[];
  chargeableCombined: boolean;
  dataSourceDebug: string;
  useSapActuals: boolean;
  jobcodeOppsList: Map<string, any[]> | null;
  setPeriodDetailModal: (data: any) => void;
}) {
  const handlePeriodClick = useCallback(
    (startDate: any, endDate: any, employee: any = null) => {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(0, 0, 0, 0);
      const sTs = s.getTime(),
        eTs = e.getTime();

      // Scope: single employee, explicit array, or all displayed
      const employees = employee ? (Array.isArray(employee) ? employee : [employee]) : displayedEmployees;

      // ── Two symmetric pipelines: SAP and MDS ──
      const sapPipe = makePipeline();
      const mdsPipe = makePipeline();
      // Variance accumulators: only days with BOTH SAP and MDS data
      let varSapChH = 0,
        varMdsChH = 0;

      // Resolve best opp for a jobNo based on bucket period
      const bucketStartStr = s.toISOString().slice(0, 10);
      const bucketEndStr = e.toISOString().slice(0, 10);
      const oppCache = new Map<string, { oppName: string; account: string } | null>();
      const resolveOpp = (jobNo: string) => {
        if (!jobNo || !jobcodeOppsList) return null;
        const key = String(jobNo).trim();
        if (oppCache.has(key)) return oppCache.get(key)!;
        const opps = jobcodeOppsList.get(key);
        if (!opps || opps.length === 0) {
          oppCache.set(key, null);
          return null;
        }
        if (opps.length === 1) {
          oppCache.set(key, opps[0]);
          return opps[0];
        }
        // Find opp whose booking date falls within the bucket period
        let best = opps.find((o) => o.endDate && o.endDate >= bucketStartStr && o.endDate <= bucketEndStr);
        // Fallback: closest booking date to bucket start
        if (!best) {
          best =
            opps
              .filter((o) => o.endDate)
              .sort(
                (a, b) =>
                  Math.abs(new Date(a.endDate).getTime() - s.getTime()) -
                  Math.abs(new Date(b.endDate).getTime() - s.getTime())
              )[0] || opps[opps.length - 1];
        }
        oppCache.set(key, best);
        return best;
      };

      // Global counters (for ETP, variance, etc.)
      let workDays = 0;
      let totalActiveEmpDays = 0,
        totalRealActiveEmpDays = 0;
      const activeEmpIds = new Set();
      // Presence-based FTE: per-employee presence days (arrival/departure only, ETP-weighted, capped at 1)
      const presenceDaysMap = new Map<string, number>(); // realEmpId → presence days (ETP-weighted)
      const realPresenceDaysMap = new Map<string, number>(); // realEmpId → real presence days (excl forced absence)

      for (let d = 0; d < timelineCalendar.length; d++) {
        const cal = timelineCalendar[d];
        if (cal.ts < sTs || cal.ts > eTs) continue;

        // Weekend: accumulate SAP hours if present, but don't count as workDay
        if (cal.isWE) {
          for (const emp of employees) {
            const empGrid = effectiveDailyGrid.get(emp.empId);
            if (!empGrid) continue;
            const cell = empGrid.cells?.[d];
            if (!cell || !cell.isSap || cell.segments.length === 0) continue;
            const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, cal.dateStr);
            sapPipe.empDayCount++;
            sapPipe.daysSet.add(d);
            accumulateDayForPipeline(sapPipe, cell, cell.segments, empHPD, chargeableCombined, resolveOpp, false, true);
            // Weekend variance: SAP side + MDS side (bench if no forecastSegments)
            if (cal.dateStr >= MDS_EXTRACT_START) {
              for (const seg of cell.segments) {
                const scale = getSegmentScale(seg.category, cell, chargeableCombined);
                const scaledU = seg.util * scale;
                if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
                  varSapChH += (scaledU * empHPD) / 100;
                }
              }
              if (cell.forecastSegments) {
                varMdsChH += computeMdsChargeableHours(cell.forecastSegments, empHPD, chargeableCombined);
              }
            }
          }
          continue;
        }

        workDays++;

        // Track presence-based FTE (arrival/departure only, ETP-weighted)
        for (const emp of employees) {
          const isPresent =
            (!emp._arrivalDate || cal.dateStr >= emp._arrivalDate) &&
            (!emp._departureDate || cal.dateStr <= emp._departureDate);
          if (!isPresent) continue;
          const realId = getRealEmpId(emp);
          const etpR = getEtpRatio(emp._etpAdjustments, cal.dateStr);
          presenceDaysMap.set(realId, (presenceDaysMap.get(realId) || 0) + etpR);
          // Real presence: exclude forced absence days
          const empGrid = effectiveDailyGrid.get(emp.empId);
          const cell = empGrid?.cells?.[d];
          if (!cell?.isForcedAbsence) {
            realPresenceDaysMap.set(realId, (realPresenceDaysMap.get(realId) || 0) + etpR);
          }
        }

        if (cal.isHoliday) {
          for (const emp of employees) {
            const isPresent =
              (!emp._arrivalDate || cal.dateStr >= emp._arrivalDate) &&
              (!emp._departureDate || cal.dateStr <= emp._departureDate);
            if (!isPresent) continue;
            activeEmpIds.add(getRealEmpId(emp));
            totalActiveEmpDays++;
            totalRealActiveEmpDays++;
            const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, cal.dateStr);
            // Holiday with SAP data: process through normal SAP/MDS pipeline (real activity)
            const empGrid = effectiveDailyGrid.get(emp.empId);
            const cell = empGrid?.cells?.[d];
            if (cell && cell.isSap && cell.segments.length > 0) {
              sapPipe.empDayCount++;
              sapPipe.daysSet.add(d);
              accumulateDayForPipeline(
                sapPipe,
                cell,
                cell.segments,
                empHPD,
                chargeableCombined,
                resolveOpp,
                false,
                true
              );
              // MDS side: use forecastSegments if available, else bench
              const isSapWithMds = !!cell.forecastSegments;
              if (isSapWithMds) {
                mdsPipe.empDayCount++;
                mdsPipe.daysSet.add(d);
                accumulateDayForPipeline(
                  mdsPipe,
                  cell,
                  cell.forecastSegments,
                  empHPD,
                  chargeableCombined,
                  resolveOpp,
                  true
                );
              } else if (cal.dateStr >= MDS_EXTRACT_START) {
                mdsPipe.empDayCount++;
                mdsPipe.daysSet.add(d);
                mdsPipe.baseH += empHPD;
              }
              // Holiday variance: SAP side + MDS side
              if (cal.dateStr >= MDS_EXTRACT_START) {
                for (const seg of cell.segments) {
                  const scale = getSegmentScale(seg.category, cell, chargeableCombined);
                  const scaledU = seg.util * scale;
                  if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
                    varSapChH += (scaledU * empHPD) / 100;
                  }
                }
                if (cell.forecastSegments) {
                  varMdsChH += computeMdsChargeableHours(cell.forecastSegments, empHPD, chargeableCombined);
                }
              }
            } else {
              // Holiday without SAP data: only accumulate in MDS pipeline.
              // Don't add to SAP pipeline — avoids showing a SAP section with only holidays
              // (typical in the future where no SAP data has been recorded yet).
              if (cal.dateStr >= MDS_EXTRACT_START) {
                accumulateHolidayForPipeline(mdsPipe, empHPD, d);
              }
            }
          }
          continue;
        }

        for (const emp of employees) {
          const empGrid = effectiveDailyGrid.get(emp.empId);
          if (!empGrid) continue;
          const cell = empGrid.cells?.[d];
          if (!cell || cell.isWE) continue;

          // Check if employee is active on this day
          const isActive = isEmployeeActive(
            cell.hasStaffing,
            cal.dateStr,
            emp._arrivalDate,
            emp._departureDate,
            useSapActuals,
            cell.isSap,
            cell.isHoliday
          );
          if (!isActive) continue;

          totalActiveEmpDays++;
          if (!cell.isForcedAbsence) totalRealActiveEmpDays++;
          activeEmpIds.add(getRealEmpId(emp));

          const empHPD = getHoursPerDay(emp.grade) * getEtpRatio(emp._etpAdjustments, cal.dateStr);

          // ── SAP pipeline: days with SAP data → use cell.segments ──
          if (cell.isSap) {
            sapPipe.empDayCount++;
            sapPipe.daysSet.add(d);
            accumulateDayForPipeline(
              sapPipe,
              cell,
              cell.segments,
              empHPD,
              chargeableCombined,
              resolveOpp,
              false,
              cell.isForcedAbsence || false
            );
          }

          // ── MDS pipeline: use forecastSegments for SAP+MDS days, segments for pure MDS days ──
          const isSapWithMds = cell.isSap && !!cell.forecastSegments;
          const mdsSegs = isSapWithMds
            ? cell.forecastSegments // SAP+MDS → forecast segments
            : cell.hasStaffing && !cell.isSap
              ? cell.segments
              : null; // Pure MDS day
          if (mdsSegs) {
            mdsPipe.empDayCount++;
            mdsPipe.daysSet.add(d);
            // For SAP+MDS days, recompute capping scales from MDS segments (cell scales are SAP-based)
            accumulateDayForPipeline(mdsPipe, cell, mdsSegs, empHPD, chargeableCombined, resolveOpp, isSapWithMds);
          } else if (cell.isSap && !cell.forecastSegments && cal.dateStr >= MDS_EXTRACT_START) {
            // SAP day without MDS data: in MDS-only mode this employee would be counted as
            // available/bench (0% chargeable). Count them the same way here for consistency.
            mdsPipe.empDayCount++;
            mdsPipe.daysSet.add(d);
            mdsPipe.baseH += empHPD;
            // No segments to accumulate → 0% chargeable = fully available
          }

          // ── Variance: only days with BOTH SAP and MDS (forecastSegments or bench after MDS start) ──
          if (cell.isSap && cal.dateStr >= MDS_EXTRACT_START) {
            // SAP side
            for (const seg of cell.segments) {
              const scale = getSegmentScale(seg.category, cell, chargeableCombined);
              const scaledU = seg.util * scale;
              if (CHARGEABLE_CATS.has(seg.category) || (chargeableCombined && GO_CATS.has(seg.category))) {
                varSapChH += (scaledU * empHPD) / 100;
              }
            }
            // MDS side
            if (cell.forecastSegments) {
              varMdsChH += computeMdsChargeableHours(cell.forecastSegments, empHPD, chargeableCombined);
            }
            // else: bench → 0h MDS chargeable (already implicit)
          }
        }
      }

      if (workDays <= 0) return;

      // ── Build results from pipelines ──
      const sapDayCount = sapPipe.daysSet.size;
      const mdsDayCount = mdsPipe.daysSet.size;
      const hasSapData = sapDayCount > 0;
      const hasMdsData = mdsDayCount > 0;

      const sapCatBreakdown = hasSapData ? buildCatBreakdown(sapPipe.catMap, sapDayCount, sapPipe.catHoursMap) : null;
      // MDS: divide by mdsDayCount (days with MDS data), not workDays, to match MDS-only mode
      const mdsDivBy = mdsDayCount || workDays;
      const mdsCatBreakdown = hasMdsData ? buildCatBreakdown(mdsPipe.catMap, mdsDivBy, mdsPipe.catHoursMap) : [];

      const precomputedSapH = hasSapData ? buildPeriodSummary(sapPipe, sapDayCount) : null;
      const precomputedMdsH = hasMdsData ? buildPeriodSummary(mdsPipe, mdsDivBy) : null;

      // Variance: only from days with BOTH SAP and MDS data
      const varianceRate = varSapChH > 0 || varMdsChH > 0 ? varSapChH - varMdsChH : null;

      // TU rate for header display (uses active pipeline based on mode)
      const activePipeH = dataSourceDebug === "sap" ? precomputedSapH : precomputedMdsH;
      const tuRate = activePipeH ? activePipeH.tu : 0;

      const avgSapEmpCount = sapDayCount > 0 ? sapPipe.empDayCount / sapDayCount : 0;
      const avgMdsEmpCount = hasMdsData ? mdsPipe.empDayCount / mdsDivBy : 0;

      const fmt = (d: any) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      const isSingleEmp = employee && !Array.isArray(employee);
      const isSingleDay = s.getTime() === e.getTime();
      const dateRange = isSingleDay ? fmt(s) : `${fmt(s)} \u2190 ${workDays} d \u2192 ${fmt(e)}`;
      const title = dateRange;
      const employeeName = isSingleEmp ? employee.name : null;

      const pad2 = (v: any) => String(v).padStart(2, "0");
      const endDateStr = `${e.getFullYear()}-${pad2(e.getMonth() + 1)}-${pad2(e.getDate())}`;
      const startDateStr = `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`;

      // FTE = presence-based (arrival/departure), ETP-weighted, capped at 1 per real employee
      const uniqueEmpCount = countUniqueReal(employees);
      const fte = calculatePresenceFTE(presenceDaysMap, workDays, uniqueEmpCount);
      const realFte = calculatePresenceFTE(realPresenceDaysMap, workDays, uniqueEmpCount);

      // Detect if single employee is not yet arrived during this period
      const notYetArrived = isSingleEmp && employee._arrivalDate && endDateStr < employee._arrivalDate;
      const alreadyDeparted = isSingleEmp && employee._departureDate && startDateStr > employee._departureDate;

      // Build top-5 chargeable projects per pipeline
      const sapTopProjects = hasSapData ? buildTopProjects(sapPipe, sapDayCount) : null;
      const mdsTopProjects = hasMdsData ? buildTopProjects(mdsPipe, mdsDivBy) : null;

      setPeriodDetailModal({
        title,
        employeeName,
        sapCatBreakdown,
        mdsCatBreakdown,
        varianceRate,
        tuRate,
        workDays,
        sapDayCount,
        mdsDayCount: mdsDivBy,
        isSap: sapPipe.empDayCount > 0,
        empCount: activeEmpIds.size || uniqueEmpCount,
        fte,
        realFte,
        avgSapEmpCount,
        avgMdsEmpCount,
        chargeableCombined,
        isMdsAvailable: endDateStr >= MDS_EXTRACT_START,
        dataSource: dataSourceDebug,
        notYetArrived: notYetArrived ? employee._arrivalDate : null,
        alreadyDeparted: alreadyDeparted ? employee._departureDate : null,
        grade: isSingleEmp
          ? employee.grade
          : employees.length > 0 && employees.every((emp) => emp.grade === employees[0].grade)
            ? employees[0].grade
            : null,
        precomputedSapH,
        precomputedMdsH,
        sapMissingH: hasSapData ? sapPipe.missingH : 0,
        sapTopProjects,
        mdsTopProjects,
      });
    },
    [
      displayedEmployees,
      effectiveDailyGrid,
      timelineCalendar,
      chargeableCombined,
      dataSourceDebug,
      useSapActuals,
      jobcodeOppsList,
      setPeriodDetailModal,
    ]
  );

  return { handlePeriodClick };
}
