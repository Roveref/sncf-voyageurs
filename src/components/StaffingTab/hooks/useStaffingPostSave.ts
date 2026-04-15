import { useState, useCallback, useEffect, useRef } from "react";

interface UseStaffingPostSaveArgs {
  modificationsEnabled: string;
  employeeLevel: Map<string, number>;
  handleBulkSaveAssignment: (
    empId: string,
    ops: { type: "create" | "edit" | "delete"; data?: Record<string, unknown>; [key: string]: unknown }[]
  ) => void;
}

/**
 * Manages post-save scroll & highlight state:
 * - justSavedEmpId: highlights the row that was just saved and auto-scrolls to it
 * - clearJustSaved: resets the highlight after the animation
 * - Scrolls to the first expanded employee when modificationsEnabled mode changes
 * - wrappedBulkSave: calls handleBulkSaveAssignment and sets justSavedEmpId
 */
export function useStaffingPostSave({
  modificationsEnabled,
  employeeLevel,
  handleBulkSaveAssignment,
}: UseStaffingPostSaveArgs) {
  const [justSavedEmpId, setJustSavedEmpId] = useState<string | null>(null);
  const clearJustSaved = useCallback(() => setJustSavedEmpId(null), []);

  const prevModificationsMode = useRef(modificationsEnabled);
  useEffect(() => {
    if (prevModificationsMode.current !== modificationsEnabled) {
      prevModificationsMode.current = modificationsEnabled;
      const expandedEmpId = [...(employeeLevel?.entries?.() || [])].find(([, level]) => level > 0)?.[0];
      if (expandedEmpId) setJustSavedEmpId(expandedEmpId);
    }
  }, [modificationsEnabled, employeeLevel]);

  const wrappedBulkSave = useCallback(
    (
      empId: string,
      ops: { type: "create" | "edit" | "delete"; data?: Record<string, unknown>; [key: string]: unknown }[]
    ) => {
      handleBulkSaveAssignment(empId, ops);
      setJustSavedEmpId(empId);
    },
    [handleBulkSaveAssignment]
  );

  return { justSavedEmpId, clearJustSaved, wrappedBulkSave };
}
