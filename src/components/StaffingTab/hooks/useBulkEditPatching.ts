import { useState, useMemo, useCallback } from "react";
import type { DailyCell, Employee, EmployeeGridMetrics } from "../types";

interface BulkLiveCellsOverride {
  empId: string;
  cells: DailyCell[];
  metrics?: EmployeeGridMetrics;
  liveAssignments?: any[] | null;
}

interface UseBulkEditPatchingArgs {
  effectiveDailyGrid: Map<string, { cells: DailyCell[] }>;
  displayedEmployees: Employee[];
  deferredFilteredEmployees: any[];
  allEmployeesForTrend: any[];
  timelineStart: any;
  timelineEnd: any;
}

/**
 * Manages bulk-edit state: tracks which employee editors are open, provides a cancel-all signal,
 * and patches the AggregateHeatmapStrip with live cell overrides while an edit is in progress.
 */
export function useBulkEditPatching({
  effectiveDailyGrid,
  displayedEmployees,
  deferredFilteredEmployees,
  allEmployeesForTrend,
  timelineStart,
  timelineEnd,
}: UseBulkEditPatchingArgs) {
  // Bulk edit coordination: track open editors and cancel-all signal
  const [bulkEditOpenSet, setBulkEditOpenSet] = useState<Set<string>>(() => new Set());
  const [bulkCancelAllSignal, setBulkCancelAllSignal] = useState(0);
  const handleBulkEditChange = useCallback((empId: string, open: boolean) => {
    setBulkEditOpenSet((prev) => {
      const next = new Set(prev);
      if (open) next.add(empId);
      else next.delete(empId);
      return next;
    });
  }, []);
  const handleBulkCancelAll = useCallback(() => {
    setBulkCancelAllSignal((s) => s + 1);
  }, []);

  // Bulk edit live cells override for AggregateHeatmapStrip
  const [bulkLiveCellsOverride, setBulkLiveCellsOverride] = useState<BulkLiveCellsOverride | null>(null);
  const handleBulkLiveCells = useCallback(
    (empId: string, cells: DailyCell[] | null, metrics?: EmployeeGridMetrics, liveAssignments?: any[] | null) => {
      setBulkLiveCellsOverride(cells ? { empId, cells, metrics, liveAssignments } : null);
    },
    []
  );

  // ── Combined bulk-edit patching (grid + 3 employee arrays in one pass) ───
  const { aggregateGrid, aggregateEmployees, effectiveFilteredEmployees, patchedAllEmployeesForTrend } = useMemo(() => {
    // Short-circuit: no bulk edit active -> return all originals, no allocation
    if (!bulkLiveCellsOverride) {
      return {
        aggregateGrid: effectiveDailyGrid,
        aggregateEmployees: displayedEmployees,
        effectiveFilteredEmployees: deferredFilteredEmployees,
        patchedAllEmployeesForTrend: allEmployeesForTrend,
      };
    }

    const targetId = bulkLiveCellsOverride.empId;
    const m = bulkLiveCellsOverride.metrics;
    const liveAssignments = bulkLiveCellsOverride.liveAssignments;
    const matchEmp = (e: any) => e.empId === targetId || (e._realEmpId && targetId.startsWith(e._realEmpId));

    // 1. Patch grid for the bulk-edited employee (try empId directly, then realEmpId for grade-split)
    let patchedGrid = effectiveDailyGrid;
    {
      const grid = new Map(effectiveDailyGrid);
      let key = targetId;
      if (!grid.has(key)) {
        const realId = key.replace(/::g\d+$/, "");
        if (grid.has(realId)) key = realId;
      }
      const existing = grid.get(key);
      if (existing) {
        grid.set(key, { ...existing, cells: bulkLiveCellsOverride.cells });
        patchedGrid = grid;
      }
    }

    // 2. Patch displayedEmployees with live display metrics (no _displayAbsH)
    const patchedDisplayed = m
      ? displayedEmployees.map((e) => {
          if (!matchEmp(e)) return e;
          return {
            ...e,
            _displayChH: m.chargeableH ?? e._displayChH,
            _displayNetH: m.netH ?? e._displayNetH,
            _displayTrH: m.trainingH ?? e._displayTrH,
            _displayTU: m.tu ?? e._displayTU,
            _displayTO: m.to ?? e._displayTO,
          };
        })
      : displayedEmployees;

    // 3. Patch filteredEmployees with live metrics for aggregate stats (includes _displayAbsH)
    const patchedFiltered = m
      ? deferredFilteredEmployees.map((e: any) => {
          if (!matchEmp(e)) return e;
          return {
            ...e,
            _displayChH: m.chargeableH ?? e._displayChH,
            _displayNetH: m.netH ?? e._displayNetH,
            _displayTrH: m.trainingH ?? e._displayTrH,
            _displayAbsH: m.absenceH ?? e._displayAbsH,
            _displayTU: m.tu ?? e._displayTU,
            _displayTO: m.to ?? e._displayTO,
          };
        })
      : deferredFilteredEmployees;

    // 4. Patch allEmployeesForTrend with live assignments for TU Trend chart
    //    Live assignments only cover the visible timeline -- merge with originals outside that range.
    let patchedTrend = allEmployeesForTrend;
    if (liveAssignments) {
      const tlStartStr = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : "";
      const tlEndStr = timelineEnd ? new Date(timelineEnd).toISOString().slice(0, 10) : "";
      patchedTrend = allEmployeesForTrend.map((e: any) => {
        if (!matchEmp(e)) return e;
        const outside = (e.assignments || []).filter((a: any) => {
          const sd = typeof a.startDate === "string" ? a.startDate : String(a.startDate).slice(0, 10);
          const ed = typeof a.endDate === "string" ? a.endDate : String(a.endDate).slice(0, 10);
          return ed < tlStartStr || sd > tlEndStr;
        });
        return { ...e, assignments: [...outside, ...liveAssignments], _consolidated: null, _periods: null };
      });
    }

    return {
      aggregateGrid: patchedGrid,
      aggregateEmployees: patchedDisplayed,
      effectiveFilteredEmployees: patchedFiltered,
      patchedAllEmployeesForTrend: patchedTrend,
    };
  }, [
    effectiveDailyGrid,
    displayedEmployees,
    deferredFilteredEmployees,
    allEmployeesForTrend,
    bulkLiveCellsOverride,
    timelineStart,
    timelineEnd,
  ]);

  return {
    bulkEditOpenSet,
    bulkCancelAllSignal,
    handleBulkEditChange,
    handleBulkCancelAll,
    handleBulkLiveCells,
    aggregateGrid,
    aggregateEmployees,
    effectiveFilteredEmployees,
    patchedAllEmployeesForTrend,
  };
}
