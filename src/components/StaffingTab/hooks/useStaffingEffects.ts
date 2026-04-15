import { useEffect, useRef } from "react";
import { useComputedStore } from "../../../stores/useComputedStore";
import { useUIStore } from "../../../stores/useUIStore";

/**
 * Side effects that sync StaffingTab state to global stores and localStorage.
 * Extracts effects from StaffingTab.tsx that don't return data.
 */
export function useStaffingEffects(
  employeeStructures: any[],
  heatmapMode: string,
  dataSourceDebug: string,
  setHeatmapMode: (mode: string) => void,
  setShowDebug: (fn: (prev: boolean) => boolean) => void
) {
  // Expose staffing employees to the global store (for Projet tab)
  useEffect(() => {
    useComputedStore.getState().setStaffingEmployees(employeeStructures);
  }, [employeeStructures]);

  // Expose staffing data to other tabs via localStorage
  useEffect(() => {
    if (employeeStructures.length === 0) {
      localStorage.removeItem("staffing_employee_index");
      return;
    }
    const index: Record<string, any[]> = {};
    employeeStructures.forEach((emp) => {
      emp.assignments.forEach((a: any) => {
        if (!a.jobNo) return;
        const key = String(a.jobNo).trim();
        if (!index[key]) index[key] = [];
        if (index[key].some((e) => e.empId === emp.empId)) return;
        index[key].push({
          empId: emp.empId,
          name: emp.name,
          grade: emp.grade || "",
          utilization: a.utilization,
          startDate: a.startDate instanceof Date ? a.startDate.toISOString().slice(0, 10) : a.startDate,
          endDate: a.endDate instanceof Date ? a.endDate.toISOString().slice(0, 10) : a.endDate,
          status: a.status,
          jobName: a.jobName,
        });
      });
    });
    localStorage.setItem("staffing_employee_index", JSON.stringify(index));
    useComputedStore.getState().bumpStaffingIndex();
  }, [employeeStructures]);

  // Auto-switch heatmap mode when toggling data source
  useEffect(() => {
    if ((heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct") && dataSourceDebug !== "all") {
      setHeatmapMode("hours");
    } else if (heatmapMode === "hours" && dataSourceDebug === "all") {
      setHeatmapMode("variance_hours");
    }
  }, [dataSourceDebug, heatmapMode]);

  // Debug toggle (triggered from App header via store signal)
  const debugToggleVersion = useUIStore((s) => s.staffingDebugToggleVersion);
  const debugToggleRef = useRef(debugToggleVersion);
  useEffect(() => {
    if (debugToggleVersion !== debugToggleRef.current) {
      debugToggleRef.current = debugToggleVersion;
      setShowDebug((prev) => !prev);
    }
  }, [debugToggleVersion]);
}
