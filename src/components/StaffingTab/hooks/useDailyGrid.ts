import { useMemo, useRef, useEffect, useState } from "react";
import { buildDailyGrid } from "../utils/dataProcessing";
import { recordGridStep } from "../utils/perf";
import { isHolidayEnabled } from "../utils/dateUtils";
import { isEmployeeActive, resolveDisplayValues } from "../utils/aggregateCalc";
import { computeSapChH, computeMdsChargeableHours } from "../utils/varianceEngine";
import { MS_PER_DAY, ABSENCE_CATS, JOB_CATEGORIES, MDS_EXTRACT_START, getHoursPerDay } from "../constants";
import { getEtpRatio } from "../types";
import type { Employee, SapLookup } from "../types";
import { useFrozenWhileDragging } from "./useFrozenWhileDragging";
import { getToday } from "../../../utils/formatters";
import type { GridWorkerRequest, GridWorkerResponse } from "../workers/gridWorker";

/**
 * Daily grid computation + employee rate enrichment.
 * Produces timelineCalendar, dailyGrid, and employeesWithRates.
 */
export function useDailyGrid(
  assignmentFilteredData: Employee[],
  timelineStart: Date,
  timelineEnd: Date,
  enabledHolidayDates: Set<string>,
  sapLookup: SapLookup | null,
  chargeableCombined: boolean,
  dataSourceDebug: string,
  ioJobcodes: Set<string> | null,
  isDraggingRef: React.MutableRefObject<boolean>
) {
  // Shared calendar: pre-compute day metadata once for all employees.
  const timelineCalendar = useMemo(() => {
    const start = new Date(timelineStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(timelineEnd);
    end.setHours(0, 0, 0, 0);
    const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
    if (totalDays <= 0) return [];
    const cal: {
      date: Date;
      dow: number;
      isWE: boolean;
      dateStr: string;
      ts: number;
      month: number;
      isHoliday: boolean;
    }[] = [];
    const cursor = new Date(start);
    for (let d = 0; d < totalDays; d++) {
      if (d > 0) cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      const isWE = dow === 0 || dow === 6;
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const isHoliday = !isWE && isHolidayEnabled(dateStr, enabledHolidayDates);
      cal.push({
        date: new Date(cursor.getTime()),
        dow,
        isWE,
        dateStr,
        ts: cursor.getTime(),
        month: cursor.getMonth(),
        isHoliday,
      });
    }
    return cal;
  }, [timelineStart, timelineEnd, enabledHolidayDates]);

  const workingDaysCount = useMemo(
    () => timelineCalendar.filter((d) => !d.isWE && !d.isHoliday).length,
    [timelineCalendar]
  );

  // SAP month date strings (for SAP completion percentage)
  const { sapMonthDateStrs, sapMonthWorkDays } = useMemo(() => {
    const now = new Date();
    const sapMonthY = now.getFullYear(),
      sapMonthM = now.getMonth();
    const sapMonthFirst = new Date(sapMonthY, sapMonthM, 1);
    const sapMonthLast = new Date(sapMonthY, sapMonthM + 1, 0);
    const strs = new Set<string>();
    for (let d = new Date(sapMonthFirst); d <= sapMonthLast; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!enabledHolidayDates || !enabledHolidayDates.has(ds)) strs.add(ds);
    }
    return { sapMonthDateStrs: strs, sapMonthWorkDays: strs.size };
  }, [enabledHolidayDates]);

  // Cell cache for incremental pan computation
  const cellCacheRef = useRef<{ cells: Map<string, any>; key: string; empFingerprints: Map<string, string> }>({
    cells: new Map(),
    key: "",
    empFingerprints: new Map(),
  });

  // Effective SAP lookup: null when in MDS-only mode
  const effectiveSapLookup = dataSourceDebug === "mds" ? null : sapLookup;

  // ── Web Worker for cold-cache grid computation ──────────────────────────────
  // workerResult holds the last result produced by the worker (plain object keyed
  // by empId). It is consumed once by the useMemo below to warm the cell cache,
  // then cleared so the synchronous incremental path takes over for pans.
  const [workerResult, setWorkerResult] = useState<Record<string, any> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Reset stale worker result whenever any key dep changes so the useMemo
    // doesn't apply an outdated grid on the next cold-cache invalidation.
    setWorkerResult(null);

    if (assignmentFilteredData.length === 0 || timelineCalendar.length === 0) return;
    // Only offload to worker when the cell cache is empty (initial load or full invalidation).
    // When the cache is warm, incremental panning is fast and stays on the main thread.
    if (cellCacheRef.current.cells.size > 0) return;

    // Abort any previous in-flight worker
    workerRef.current?.terminate();

    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/gridWorker.ts", import.meta.url), { type: "module" });
    } catch {
      // Web Workers not supported in this environment — fall back to synchronous path
      return;
    }
    workerRef.current = worker;

    // Serialize: Sets must become arrays for structured clone
    const serializedEmployees = assignmentFilteredData.map((emp) => ({
      ...emp,
      projects: emp.projects instanceof Set ? [...emp.projects] : emp.projects,
    }));

    const msg: GridWorkerRequest = {
      type: "build",
      employees: serializedEmployees,
      calendar: timelineCalendar,
      sapLookup: effectiveSapLookup,
      chargeableCombined,
      enabledHolidayDates: [...enabledHolidayDates],
      sapMonthDateStrs: [...sapMonthDateStrs],
      sapMonthWorkDays,
      dataSourceFilter: dataSourceDebug === "sap" ? "sap" : undefined,
    };
    worker.postMessage(msg);

    worker.onmessage = (e: MessageEvent<GridWorkerResponse>) => {
      if (e.data.type === "result") {
        setWorkerResult(e.data.grid);
      } else {
        console.error("[useDailyGrid] Worker error:", e.data.message);
      }
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = (err) => {
      console.error("[useDailyGrid] Worker uncaught error:", err.message);
      worker.terminate();
      workerRef.current = null;
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // Key deps only: we want this to fire whenever the "cold cache" scenario arises.
    // timelineCalendar covers timelineStart/timelineEnd/enabledHolidayDates changes.
    // sapLookup is intentionally listed (not effectiveSapLookup) to match useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assignmentFilteredData,
    timelineCalendar,
    sapLookup,
    chargeableCombined,
    enabledHolidayDates,
    sapMonthDateStrs,
    sapMonthWorkDays,
    dataSourceDebug,
  ]);

  // Daily grid: single O(E×D×P) pass producing all per-day cells + metrics
  const dailyGrid = useMemo(() => {
    if (assignmentFilteredData.length === 0 || timelineCalendar.length === 0) return new Map();
    // Invalidate cache when non-range deps change
    const totalAssignments = assignmentFilteredData.reduce((s, e) => s + (e.assignments?.length || 0), 0);
    // Include arrival/departure fingerprint so grade-split boundary changes invalidate cached cells
    let dateFP = 0;
    for (const e of assignmentFilteredData) {
      if (e._arrivalDate)
        for (let i = 0; i < e._arrivalDate.length; i++) dateFP = (dateFP * 31 + e._arrivalDate.charCodeAt(i)) | 0;
      if (e._departureDate)
        for (let i = 0; i < e._departureDate.length; i++) dateFP = (dateFP * 31 + e._departureDate.charCodeAt(i)) | 0;
    }
    const globalKey = `${assignmentFilteredData.length}|${totalAssignments}|${chargeableCombined}|${enabledHolidayDates?.size ?? 0}|${sapLookup ? Object.keys(sapLookup).length : 0}|${dataSourceDebug}|${dateFP}`;
    if (globalKey !== cellCacheRef.current.key) {
      // Global deps changed — full cache invalidation (also resets any stale workerResult)
      cellCacheRef.current = { cells: new Map(), key: globalKey, empFingerprints: new Map() };
    }

    // ── Worker fast-path: consume result computed off the main thread ──
    // Only valid while the cache is still empty (worker ran on the cold-cache scenario).
    if (workerResult !== null && cellCacheRef.current.cells.size === 0) {
      try {
        const t0 = performance.now();
        // Convert plain object back to Map<empId, EmployeeDailyData>
        const map = new Map<string, any>();
        for (const [empId, empData] of Object.entries(workerResult)) {
          map.set(empId, empData);
          // Populate cell cache from worker result so future pans are incremental
          if (empData && Array.isArray(empData.cells)) {
            for (const cell of empData.cells) {
              if (cell && !cell.isWE && cell.dateStr) {
                cellCacheRef.current.cells.set(`${empId}|${cell.dateStr}`, cell);
              }
            }
          }
        }
        recordGridStep(
          "buildDailyGrid",
          performance.now() - t0,
          `${assignmentFilteredData.length} employees · worker=true · cache warmed=${cellCacheRef.current.cells.size}`
        );
        return map;
      } catch (err) {
        console.error("[StaffingTab] buildDailyGrid worker result error:", err);
        // Fall through to synchronous computation
      }
    }

    // ── Synchronous path: incremental updates (cache warm) or worker not yet ready ──
    try {
      const t0 = performance.now();
      const result = buildDailyGrid(
        assignmentFilteredData,
        timelineCalendar,
        effectiveSapLookup,
        chargeableCombined,
        [...enabledHolidayDates],
        sapMonthDateStrs,
        sapMonthWorkDays,
        cellCacheRef.current.cells,
        dataSourceDebug === "sap" ? "sap" : undefined
      );
      recordGridStep(
        "buildDailyGrid",
        performance.now() - t0,
        `${assignmentFilteredData.length} employees · cache=${cellCacheRef.current.cells.size}`
      );
      return result;
    } catch (err) {
      console.error("[StaffingTab] buildDailyGrid error:", err);
      console.warn(
        "[StaffingTab] buildDailyGrid: returning empty Map due to grid build failure — check assignment data, timeline calendar, or SAP lookup inputs"
      );
      return new Map();
    }
  }, [
    assignmentFilteredData,
    timelineCalendar,
    sapLookup,
    chargeableCombined,
    enabledHolidayDates,
    sapMonthDateStrs,
    sapMonthWorkDays,
    dataSourceDebug,
    workerResult,
  ]);

  // Deferred grid for metrics pipeline (frozen during drag)
  const deferredDailyGrid = useFrozenWhileDragging(dailyGrid, isDraggingRef);
  const deferredCalendar = useFrozenWhileDragging(timelineCalendar, isDraggingRef);

  // Employees with computed display rates: O(E) read from pre-computed grid
  const hasIoJobcodes = ioJobcodes && ioJobcodes.size > 0;
  const useSapActuals = dataSourceDebug === "sap";
  const employeesWithRates = useMemo(() => {
    return assignmentFilteredData.map((emp) => {
      const data = deferredDailyGrid.get(emp.empId);
      if (!data) return { ...emp, _varianceHours: null, _varianceRate: null };
      const m = data.metrics;
      // Per-employee I&O: compute raw hours + TU rate
      let ioTU: number | null = null;
      let ioChHours = 0;
      if (hasIoJobcodes) {
        for (const cell of data.cells) {
          if (cell.isWE || cell.isHoliday) continue;
          for (const seg of cell.segments) {
            if (
              seg.jobNo &&
              ioJobcodes!.has(String(seg.jobNo).trim()) &&
              (seg.category === "chargeable" || seg.category === "generalOppty")
            ) {
              ioChHours += (seg.util / 100) * getHoursPerDay(emp.grade);
            }
          }
        }
        if (m.netH > 0) ioTU = (ioChHours / m.netH) * 100;
      }
      // Compute display TU from cells.
      let dispChU = 0,
        dispAbsU = 0,
        dispTrU = 0,
        dispActiveN = 0,
        dispRealActiveN = 0,
        presenceActiveN = 0;
      let hasOvercharge = false,
        hasMissingSap = false;
      let empOverH = 0,
        empMissingH = 0;
      // Period-aware SAP fill rate: count working days with SAP data vs active working days up to end of current month
      let sapDayCount = 0,
        activeDayCount = 0;
      const todayStr = getToday();
      const now = new Date();
      const currentMonthEndStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      // Independent SAP/MDS chargeable hours for delta h
      let sapPipeChH = 0,
        mdsPipeChH = 0;
      let hasSapPipe = false,
        hasMdsPipe = false;
      const baseHPD = getHoursPerDay(emp.grade);
      const hasEtp = !!emp._etpAdjustments?.length;
      // ETP-weighted hour accumulators
      let etpChH = 0,
        etpAbsH = 0,
        etpTrH = 0,
        etpTotalH = 0;
      for (const cell of data.cells) {
        // Weekend SAP cells: skip for secondary grade-splits (prevent double-counting same SAP data)
        if (cell.isWE && cell.isSap) {
          const isFirstOrNoSplit = !emp._isGradeSplit || emp.empId.endsWith("::g0");
          if (!isFirstOrNoSplit) continue;
          const weDateStr = cell.dateStr || "";
          const weHPD = hasEtp ? baseHPD * getEtpRatio(emp._etpAdjustments, weDateStr) : baseHPD;
          // Display metrics: count weekend SAP work in TU
          dispActiveN++;
          dispChU += cell.cappedChU;
          dispAbsU += cell.cappedAbsU || 0;
          dispTrU += cell.cappedTrU || 0;
          if (hasEtp) {
            etpTotalH += weHPD;
            etpChH += (cell.cappedChU * weHPD) / 100;
            etpAbsH += ((cell.cappedAbsU || 0) * weHPD) / 100;
            etpTrH += ((cell.cappedTrU || 0) * weHPD) / 100;
          }
          // Variance pipeline
          if (weDateStr >= MDS_EXTRACT_START) {
            hasSapPipe = true;
            hasMdsPipe = true;
            sapPipeChH += computeSapChH(cell.segments, cell.chScale ?? 1, weHPD, chargeableCombined);
            if (cell.forecastSegments) {
              mdsPipeChH += computeMdsChargeableHours(cell.forecastSegments, weHPD, chargeableCombined);
            }
          }
          continue;
        }
        if (cell.isWE) continue;
        const hasStaffing = cell.hasStaffing;
        const dateStr = cell.dateStr || "";
        // Mode-independent presence count for FTE (arrival/departure only), weighted by ETP ratio
        const isPresent =
          (!emp._arrivalDate || dateStr >= emp._arrivalDate) && (!emp._departureDate || dateStr <= emp._departureDate);
        if (isPresent) presenceActiveN += getEtpRatio(emp._etpAdjustments, dateStr);
        if (
          !isEmployeeActive(
            hasStaffing,
            dateStr,
            emp._arrivalDate,
            emp._departureDate,
            useSapActuals,
            cell.isSap,
            cell.isHoliday
          )
        )
          continue;
        dispActiveN++;
        if (!cell.isForcedAbsence) dispRealActiveN++;
        // SAP fill rate: both numerator and denominator capped at end of current month
        if (!cell.isHoliday && !cell.isForcedAbsence && dateStr <= currentMonthEndStr) {
          activeDayCount++;
          if (cell.isSap) sapDayCount++;
        }
        const disp = resolveDisplayValues(cell, cell.isSap, useSapActuals);
        dispChU += disp.displayChU;
        dispAbsU += disp.displayAbsU;
        dispTrU += cell.cappedTrU;
        // ETP-weighted hours: accumulate per day
        if (hasEtp) {
          const dayHPD = baseHPD * getEtpRatio(emp._etpAdjustments, dateStr);
          etpTotalH += dayHPD;
          etpChH += (disp.displayChU * dayHPD) / 100;
          etpAbsH += (disp.displayAbsU * dayHPD) / 100;
          etpTrH += (cell.cappedTrU * dayHPD) / 100;
        }
        // Delta h: SAP ch - MDS ch (only days after MDS_EXTRACT_START)
        // Holidays with SAP data are included (real activity); holidays without SAP are excluded
        const dayHPDVar = hasEtp ? baseHPD * getEtpRatio(emp._etpAdjustments, dateStr) : baseHPD;
        if (dateStr >= MDS_EXTRACT_START && cell.isSap) {
          hasSapPipe = true;
          sapPipeChH += computeSapChH(cell.segments, cell.chScale ?? 1, dayHPDVar, chargeableCombined);
          hasMdsPipe = true;
          if (cell.forecastSegments) {
            mdsPipeChH += computeMdsChargeableHours(cell.forecastSegments, dayHPDVar, chargeableCombined);
          }
        }
        // SAP anomaly detection: total SAP hours vs HPD (overcharge = >HPD, missing = <HPD)
        if (cell.isSap && !cell.isHoliday && !cell.isForcedAbsence && cell.segments.length > 0) {
          const totalSapU = cell.segments.reduce((s: number, seg: any) => s + seg.util, 0);
          if (totalSapU > 100) {
            hasOvercharge = true;
            empOverH += ((totalSapU - 100) * dayHPDVar) / 100;
          }
          if (totalSapU < 100) {
            hasMissingSap = true;
            empMissingH += ((100 - totalSapU) * dayHPDVar) / 100;
          }
        }
      }
      const dispNetU = dispActiveN * 100 - dispAbsU;
      const displayTU = dispNetU > 0 ? (dispChU / dispNetU) * 100 : dispActiveN > 0 ? 100 : 0;
      const displayChH = hasEtp ? etpChH : (dispChU * baseHPD) / 100;
      const displayNetH = hasEtp ? etpTotalH - etpAbsH : (dispNetU * baseHPD) / 100;
      const displayTrH = hasEtp ? etpTrH : (dispTrU * baseHPD) / 100;
      const displayAbsH = hasEtp ? etpAbsH : (dispAbsU * baseHPD) / 100;
      const displayTO = dispNetU > 0 ? ((dispChU + dispTrU) / dispNetU) * 100 : 100;
      return {
        ...emp,
        _displayTU: displayTU,
        _displayTO: displayTO,
        _displayNetH: displayNetH,
        _displayChH: displayChH,
        _displayTrH: displayTrH,
        _displayAbsH: displayAbsH,
        _displayActiveN: dispActiveN,
        _displayRealActiveN: dispRealActiveN,
        _presenceActiveN: presenceActiveN,
        _sapPct: activeDayCount > 0 ? (sapDayCount / activeDayCount) * 100 : m.sapPct,
        _sapDayCount: sapDayCount,
        _sapActiveDayCount: activeDayCount,
        _varianceRate: m.varianceRate,
        _varianceHours: hasSapPipe ? sapPipeChH - mdsPipeChH : null,
        _hoursInfo: m,
        _ioTU: ioTU,
        _ioChHours: ioChHours,
        _hasSapAnomaly: hasOvercharge || hasMissingSap,
        _sapOverH: empOverH,
        _sapMissingH: empMissingH,
      };
    });
  }, [assignmentFilteredData, deferredDailyGrid, hasIoJobcodes, ioJobcodes, useSapActuals]);

  return {
    timelineCalendar,
    workingDaysCount,
    sapMonthDateStrs,
    sapMonthWorkDays,
    dailyGrid,
    deferredDailyGrid,
    deferredCalendar,
    employeesWithRates,
    useSapActuals,
  };
}
