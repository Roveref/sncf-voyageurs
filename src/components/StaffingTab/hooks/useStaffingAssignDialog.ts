import { useState, useCallback, useEffect, useMemo } from "react";
import { useUIStore } from "../../../stores/useUIStore";
import type { Employee } from "../types";

type BulkEditPrefill = {
  empId: string;
  jobNo?: string;
  jobName?: string;
  startDate?: string;
  endDate?: string;
  utilization?: number;
  needId?: string;
} | null;

interface UseStaffingAssignDialogArgs {
  employeeStructures: Employee[];
  setEmployeeLevel: React.Dispatch<React.SetStateAction<Map<string, number>>>;
}

/**
 * Manages bulk-edit prefill and the floating assign-dialog panel:
 * - bulkEditPrefill: expands an employee row and pre-fills the add form
 * - assignDialogPrefill: shows a floating panel driven by cross-component signal (UIStore)
 */
export function useStaffingAssignDialog({ employeeStructures, setEmployeeLevel }: UseStaffingAssignDialogArgs) {
  const [bulkEditPrefill, setBulkEditPrefill] = useState<BulkEditPrefill>(null);
  const [assignDialogPrefill, setAssignDialogPrefill] = useState<BulkEditPrefill>(null);

  const handleOpenBulkEditWithPrefill = useCallback(
    (prefill?: {
      empId?: string;
      jobNo?: string;
      jobName?: string;
      startDate?: string;
      endDate?: string;
      utilization?: number;
      needId?: string;
    }) => {
      if (!prefill?.empId) return;
      setEmployeeLevel((prev) => {
        const m = new Map(prev);
        m.set(prefill.empId!, 2);
        return m;
      });
      setBulkEditPrefill({
        empId: prefill.empId,
        jobNo: prefill.jobNo,
        jobName: prefill.jobName,
        startDate: prefill.startDate,
        endDate: prefill.endDate,
        utilization: prefill.utilization,
        needId: prefill.needId,
      });
    },
    [setEmployeeLevel]
  );

  // Listen for cross-component bulk edit prefill (from NeedsBoardV2 in App.tsx)
  const globalBulkEditPrefill = useUIStore((s) => s.bulkEditPrefill);
  useEffect(() => {
    if (globalBulkEditPrefill) {
      setAssignDialogPrefill(globalBulkEditPrefill);
      useUIStore.getState().setBulkEditPrefill(null);
    }
  }, [globalBulkEditPrefill]);

  const assignDialogEmployee = useMemo(() => {
    if (!assignDialogPrefill?.empId) return null;
    return employeeStructures.find((e) => (e._realEmpId || e.empId) === assignDialogPrefill.empId) || null;
  }, [assignDialogPrefill?.empId, employeeStructures]);

  const handleAssignDialogClose = useCallback(() => {
    setAssignDialogPrefill(null);
  }, []);

  const handleDropNeedOnEmployee = useCallback(
    (empId: string, needData: any) => {
      handleOpenBulkEditWithPrefill({
        empId,
        jobNo: needData.opportunityId || "",
        startDate: needData.startDate || "",
        endDate: needData.endDate || "",
        needId: needData.needId || "",
      });
    },
    [handleOpenBulkEditWithPrefill]
  );

  return {
    bulkEditPrefill,
    setBulkEditPrefill,
    assignDialogPrefill,
    setAssignDialogPrefill,
    assignDialogEmployee,
    handleOpenBulkEditWithPrefill,
    handleAssignDialogClose,
    handleDropNeedOnEmployee,
  };
}
