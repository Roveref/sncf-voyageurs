import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import type { BulkSelection, CreateMode, PendingActionInfo, EditorState } from "./bulkEditTypes";
import type { DisplayGroup } from "./bulkEditTypes";

interface ModeTransitionDeps {
  globalBarSnapshotRef: MutableRefObject<EditorState | null>;
  dispatch: Dispatch<any>;
  setRevertAllPreview: (v: boolean) => void;
  onGlobalBarClose?: () => void;
  setSelection: Dispatch<SetStateAction<BulkSelection | null>>;
  clearCreate: () => void;
  setRevertPreviewGroupKey: (key: string | null) => void;
  setPendingActionInfo: (info: PendingActionInfo) => void;
  setCreateMode: (mode: CreateMode) => void;
  setCreateUtilization: (v: number) => void;
  setCreateSegments: (v: null) => void;
  setCreateExistingOverrides: (v: null) => void;
  handleUndoRedoCancel: () => void;
  displayGroups: DisplayGroup[];
}

export function useBulkEditModeTransitions({
  globalBarSnapshotRef,
  dispatch,
  setRevertAllPreview,
  onGlobalBarClose,
  setSelection,
  clearCreate,
  setRevertPreviewGroupKey,
  setPendingActionInfo,
  setCreateMode,
  setCreateUtilization,
  setCreateSegments,
  setCreateExistingOverrides,
  handleUndoRedoCancel,
  displayGroups,
}: ModeTransitionDeps) {
  // Close global bar with snapshot restore (cancel any undo/redo preview)
  const closeGlobalBar = useCallback(() => {
    if (globalBarSnapshotRef.current) {
      dispatch({ type: "RESTORE_SNAPSHOT", snapshot: globalBarSnapshotRef.current });
      globalBarSnapshotRef.current = null;
    }
    setRevertAllPreview(false);
    onGlobalBarClose?.();
  }, [onGlobalBarClose]);

  const enterEditMode = useCallback(
    (sel: BulkSelection | null) => {
      handleUndoRedoCancel();
      setSelection(sel);
      clearCreate();
      setRevertPreviewGroupKey(null);
      setPendingActionInfo(null);
      closeGlobalBar();
    },
    [clearCreate, closeGlobalBar, handleUndoRedoCancel]
  );

  const enterCreateMode = useCallback(
    (mode: any) => {
      handleUndoRedoCancel();
      setCreateMode(mode);
      setCreateUtilization(0);
      setCreateSegments(null);
      setCreateExistingOverrides(null);
      setSelection(null);
      setRevertPreviewGroupKey(null);
      setPendingActionInfo(null);
      closeGlobalBar();
    },
    [closeGlobalBar, handleUndoRedoCancel]
  );

  const handleRowSelect = useCallback(
    (groupKey: string) => {
      handleUndoRedoCancel();
      setSelection((prev) => {
        const toggle = prev?.groupKey === groupKey && !prev.subRange ? null : { groupKey };
        return toggle;
      });
      clearCreate();
      setRevertPreviewGroupKey(null);
      setPendingActionInfo(null);
      closeGlobalBar();
    },
    [clearCreate, closeGlobalBar, handleUndoRedoCancel]
  );

  const handleRowDragSelect = useCallback(
    (groupKey: string, range: { start: string; end: string }) => {
      const group = displayGroups.find((g) => g.groupKey === groupKey);
      const hasOverlap = group?.periods.some((p) => p.startDate <= range.end && p.endDate >= range.start);
      if (group && !hasOverlap) {
        // Gap selection -> gap fill mode (reset create state fully)
        enterCreateMode({
          type: "gap_fill",
          range,
          jobNo: group.jobNo,
          jobName: group.jobName,
          category: group.category,
          groupKey,
        });
      } else {
        // Period overlap -> normal sub-range selection
        enterEditMode({ groupKey, subRange: range });
      }
    },
    [displayGroups, enterCreateMode, enterEditMode]
  );

  const handleClearSelection = useCallback(() => setSelection(null), []);

  const handleAddDragSelect = useCallback(
    (range: { start: string; end: string }) => {
      enterCreateMode({ type: "new", range });
    },
    [enterCreateMode]
  );

  const handleAddRowClick = useCallback(() => {
    enterCreateMode({ type: "new", range: null });
  }, [enterCreateMode]);

  return {
    closeGlobalBar,
    enterEditMode,
    enterCreateMode,
    handleRowSelect,
    handleRowDragSelect,
    handleClearSelection,
    handleAddDragSelect,
    handleAddRowClick,
  };
}
