/**
 * Custom hook encapsulating undo/redo/revert action handlers for BulkEditPanel.
 */

import { useState, useCallback, useRef } from "react";
import { replayActions, computeOps } from "./bulkEditEngine";
import type { EditorState, BulkEditOperation } from "./bulkEditTypes";

interface UseBulkEditActionsParams {
  editorStateRef: React.MutableRefObject<EditorState>;
  dispatch: React.Dispatch<any>;
  onSaveAll: (operations: BulkEditOperation[]) => void;
  baseline: any[];
  clearCreate: () => void;
}

export function useBulkEditActions({
  editorStateRef,
  dispatch,
  onSaveAll,
  baseline,
  clearCreate,
}: UseBulkEditActionsParams) {
  // ── Revert preview ──
  const [revertPreviewGroupKey, setRevertPreviewGroupKey] = useState<string | null>(null);

  const handleRevertClick = useCallback(
    (groupKey: string) => {
      clearCreate();
      setRevertPreviewGroupKey(groupKey);
    },
    [clearCreate]
  );

  const handleRevertConfirm = useCallback(() => {
    if (!revertPreviewGroupKey) return;
    const currentState = editorStateRef.current.current;
    const newLog = editorStateRef.current.actionLog.filter((a) => a.groupKey !== revertPreviewGroupKey);
    const reverted = replayActions(editorStateRef.current.baseline, newLog);
    const ops = computeOps(currentState, reverted);
    dispatch({ type: "REVERT_GROUP", groupKey: revertPreviewGroupKey });
    if (ops.length > 0) onSaveAll(ops);
    setRevertPreviewGroupKey(null);
  }, [revertPreviewGroupKey, onSaveAll, editorStateRef, dispatch]);

  const handleRevertCancel = useCallback(() => {
    setRevertPreviewGroupKey(null);
  }, []);

  // ── Per-group undo/redo ──
  const undoRedoSnapshotRef = useRef<EditorState | null>(null);
  const [undoRedoActive, setUndoRedoActive] = useState(false);

  const handleGroupUndo = useCallback(
    (groupKey: string) => {
      if (!undoRedoSnapshotRef.current) undoRedoSnapshotRef.current = { ...editorStateRef.current };
      dispatch({ type: "UNDO_GROUP", groupKey });
      setUndoRedoActive(true);
    },
    [editorStateRef, dispatch]
  );

  const handleGroupRedo = useCallback(
    (groupKey: string) => {
      if (!undoRedoSnapshotRef.current) undoRedoSnapshotRef.current = { ...editorStateRef.current };
      dispatch({ type: "REDO_GROUP", groupKey });
      setUndoRedoActive(true);
    },
    [editorStateRef, dispatch]
  );

  const handleUndoRedoApply = useCallback(() => {
    const snapshot = undoRedoSnapshotRef.current;
    if (!snapshot) return;
    const ops = computeOps(snapshot.current, editorStateRef.current.current);
    if (ops.length > 0) onSaveAll(ops);
    undoRedoSnapshotRef.current = null;
    setUndoRedoActive(false);
  }, [onSaveAll, editorStateRef]);

  const handleUndoRedoCancel = useCallback(() => {
    const snapshot = undoRedoSnapshotRef.current;
    if (snapshot) dispatch({ type: "RESTORE_SNAPSHOT", snapshot });
    undoRedoSnapshotRef.current = null;
    setUndoRedoActive(false);
  }, [dispatch]);

  // ── Revert preview periods (derived) ──
  const revertPreviewPeriods = revertPreviewGroupKey
    ? baseline
        .filter((s: any) => `${s.jobName}::${s.category}` === revertPreviewGroupKey)
        .map((s: any) => ({ startDate: s.startDate, endDate: s.endDate, utilization: s.utilization, status: s.status }))
    : null;

  return {
    revertPreviewGroupKey,
    setRevertPreviewGroupKey,
    handleRevertClick,
    handleRevertConfirm,
    handleRevertCancel,
    revertPreviewPeriods,
    undoRedoActive,
    handleGroupUndo,
    handleGroupRedo,
    handleUndoRedoApply,
    handleUndoRedoCancel,
  };
}
