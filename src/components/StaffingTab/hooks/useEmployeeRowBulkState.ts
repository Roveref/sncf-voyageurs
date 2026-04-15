/**
 * useEmployeeRowBulkState — Manages all bulk edit state for EmployeeRow.
 *
 * Extracted from EmployeeRow.tsx to reduce file size. Contains:
 * - bulkEditMode, bulkHasChanges, globalBarOpen state
 * - savedEditorStateRef persistence (collapse/expand + F5)
 * - bulkLiveAssignments for live preview
 * - bulkResetKey / bulkClearModeSignal for panel lifecycle
 * - cancel-all signal handling
 * - highlightInfo for selected job highlight
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useAppStore } from "../../../stores/useAppStore";

export function useEmployeeRowBulkState(params: {
  employee: any;
  viewLevel: number;
  bulkCancelAllSignal?: number;
  onBulkEditChange?: (empId: string, active: boolean) => void;
  onBulkSaveAssignment: (empId: string, operations: any[]) => void;
  onBulkLiveCells?: (empId: string, cells: any[] | null, metrics?: any, liveAssignments?: any[] | null) => void;
}) {
  const { employee, viewLevel, bulkCancelAllSignal, onBulkEditChange, onBulkSaveAssignment } = params;

  const empId = employee._realEmpId || employee.empId;

  // ── Bulk edit — active when expanded (viewLevel >= 2) ──
  const bulkEditMode = viewLevel >= 2;
  const [bulkStartWithAdd, setBulkStartWithAdd] = useState(false);
  const [bulkHasChanges, setBulkHasChangesRaw] = useState(false);
  // Sticky: once true, stays true until explicit reset (cancel/remount without changes)
  const bulkHasChangesRef = useRef(false);
  const setBulkHasChanges = useCallback((v: boolean) => {
    if (v) bulkHasChangesRef.current = true;
    setBulkHasChangesRaw(bulkHasChangesRef.current);
  }, []);
  const [globalBarOpen, setGlobalBarOpen] = useState(false);

  // Persist editor state across collapse/expand AND across F5 (via backend)
  const savedEditorStateRef = useRef<any>(null);
  // Initialize from persisted state (restored from backend after F5)
  const persistedEditorState = useUserDataStore((s) => s.editorStates[empId]);
  if (!savedEditorStateRef.current && persistedEditorState) {
    savedEditorStateRef.current = persistedEditorState;
  }
  const handleEditorStateChange = useCallback(
    (state: any) => {
      // Don't persist in Exc. Changes mode (read-only view of base data)
      if (useAppStore.getState().modificationsEnabled === "off") return;
      savedEditorStateRef.current = state;
      // Persist to store -> synced to backend via useBackendSync
      useUserDataStore.getState().setEditorState(empId, state);
    },
    [empId]
  );

  const [bulkLiveAssignments, setBulkLiveAssignments] = useState<any[] | null>(null);

  // Clean up on collapse — close active modes, panel unmounts naturally
  useEffect(() => {
    if (!bulkEditMode) {
      setBulkLiveAssignments(null);
      onBulkEditChange?.(empId, false);
      setGlobalBarOpen(false);
    }
  }, [bulkEditMode]); // intentionally limited deps

  // Relay toolbar active state from BulkEditPanel
  const handleEditActive = useCallback(
    (active: boolean) => {
      onBulkEditChange?.(empId, active);
    },
    [onBulkEditChange, empId]
  );

  const handleBulkSave = useCallback(
    (operations: any[]) => {
      onBulkSaveAssignment(empId, operations);
      setBulkStartWithAdd(false);
      // Don't remount panel (no resetKey++) — keep deleted items visible with strikethrough
    },
    [onBulkSaveAssignment, empId]
  );

  // Reset key — incremented to force BulkEditPanel remount (discard all changes)
  const [bulkResetKey, setBulkResetKey] = useState(0);
  // Signal to close active edit/create mode without remounting (preserves action log)
  const [bulkClearModeSignal, setBulkClearModeSignal] = useState(0);

  const handleBulkCancel = useCallback(() => {
    setBulkStartWithAdd(false);
    setBulkLiveAssignments(null);
    if (globalBarOpen) {
      // Global bar open -> just close it (panel handles snapshot restore internally)
      setGlobalBarOpen(false);
    } else if (bulkHasChanges) {
      // Has accumulated changes -> clean up refs and close active mode
      bulkHasChangesRef.current = false;
      savedEditorStateRef.current = null;
      setBulkClearModeSignal((k) => k + 1);
    } else {
      // No changes -> remount to fully reset
      bulkHasChangesRef.current = false;
      savedEditorStateRef.current = null;
      useUserDataStore.getState().clearEditorState(empId);
      setBulkResetKey((k) => k + 1);
    }
  }, [globalBarOpen, bulkHasChanges, empId]);

  // Close on cancel-all signal
  const cancelAllRef = useRef(bulkCancelAllSignal);
  useEffect(() => {
    if (bulkCancelAllSignal !== cancelAllRef.current) {
      cancelAllRef.current = bulkCancelAllSignal;
      if (bulkEditMode) handleBulkCancel();
    }
  }, [bulkCancelAllSignal, bulkEditMode, handleBulkCancel]);

  const handleBulkLiveChange = useCallback((assignments: any[] | null) => setBulkLiveAssignments(assignments), []);

  const [highlightInfo, setHighlightInfo] = useState<{
    jobNo: string;
    changeDate?: string;
    newUtil?: number;
  } | null>(null);
  const handleSelectedJobNoChange = useCallback(
    (info: { jobNo: string; changeDate?: string; newUtil?: number } | null) => setHighlightInfo(info),
    []
  );

  return {
    bulkEditMode,
    bulkStartWithAdd,
    setBulkStartWithAdd,
    bulkHasChanges,
    setBulkHasChanges,
    globalBarOpen,
    setGlobalBarOpen,
    savedEditorStateRef,
    handleEditorStateChange,
    bulkLiveAssignments,
    handleBulkLiveChange,
    bulkResetKey,
    bulkClearModeSignal,
    handleBulkCancel,
    handleBulkSave,
    handleEditActive,
    highlightInfo,
    handleSelectedJobNoChange,
  };
}
