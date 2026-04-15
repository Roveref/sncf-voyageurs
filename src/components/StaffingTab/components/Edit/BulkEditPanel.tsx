import React, { memo, useReducer, useMemo, useCallback, useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import {
  GANTT_LEFT_COL_WIDTH,
  CHARGEABLE_CATS,
  GO_CATS,
  ABSENCE_CATS,
  TRAINING_CATS,
  getHoursPerDay,
  MDS_EXTRACT_START,
} from "../../constants";
import { CATEGORY_THEME } from "../../constants/theme";
import { toDateString } from "../../utils/dateUtils";
import { useTimelineData, useTimelineHandlers } from "../../contexts/TimelineContext";
import { AddRow } from "./BulkEditAddRow";
import { countWorkingDays } from "./bulkEditTypes";
import { buildDisplayGroups } from "./bulkEditCalc";
import { useLiveAssignmentsPreview } from "./useLiveAssignmentsPreview";
import { useBulkEditModeTransitions } from "./useBulkEditModeTransitions";
import { useBulkEditCreateMode } from "./useBulkEditCreateMode";
import { useBulkEditActions } from "./useBulkEditActions";
import { BulkEditCategorySections } from "./BulkEditCategorySections";
import { BulkEditToolbarSection } from "./BulkEditToolbarSection";
import {
  editorReducer,
  replayActions,
  computeOps,
  toBaselineSegment,
  buildCreateAction,
  buildDeleteAction,
  buildSplitDeleteAction,
  buildReduceUtilAction,
  buildReduceDaysAction,
  buildReduceUtilMultiAction,
  buildUpdateFieldAction,
  simulateEditAction,
} from "./bulkEditEngine";
import type {
  BulkSelection,
  DisplayGroup,
  BulkEditOperation,
  BulkEditAction,
  LabelParts,
  PendingActionInfo,
  CreateMode,
  BaselineSegment,
  EditAction,
  EditorState,
} from "./bulkEditTypes";

// Re-export types needed by consumers
export type { BulkEditOperation } from "./bulkEditTypes";

const LEFT_COL = GANTT_LEFT_COL_WIDTH;

// ── Main BulkEditPanel ──

interface BulkEditPanelProps {
  employee: any;
  tl: any;
  timelineStart: Date;
  timelineEnd: Date;
  pipelineJobcodes: Map<string, any> | null;
  enabledHolidayDates: Set<string>;
  leftColShrink: number;
  onSaveAll: (operations: BulkEditOperation[]) => void;
  onCancel: () => void;
  onLiveAssignmentsChange?: (assignments: any[] | null) => void;
  onSelectedJobNoChange?: (info: { jobNo: string; changeDate?: string; newUtil?: number } | null) => void;
  onEditActive?: (active: boolean) => void;
  onHasChanges?: (hasChanges: boolean) => void;
  globalBarOpen?: boolean;
  onGlobalBarClose?: () => void;
  /** Increment to close active edit/create mode without remounting */
  clearModeSignal?: number;
  /** Saved editor state to restore after remount (preserves action log across collapse/expand) */
  savedEditorState?: EditorState | null;
  onEditorStateChange?: (state: EditorState) => void;
  startWithAdd?: boolean;
  /** @deprecated No longer used — baseline is captured internally */
  sessionOriginals?: any[] | null;
  prefill?: {
    empId: string;
    jobNo?: string;
    jobName?: string;
    startDate?: string;
    endDate?: string;
    utilization?: number;
    needId?: string;
  } | null;
  onClearPrefill?: (v: null) => void;
  changesOnly?: boolean;
  readOnly?: boolean;
}

export const BulkEditPanel = memo(
  ({
    employee,
    tl,
    timelineStart,
    timelineEnd,
    pipelineJobcodes,
    enabledHolidayDates,
    leftColShrink,
    onSaveAll,
    onCancel,
    onLiveAssignmentsChange,
    onSelectedJobNoChange,
    onEditActive,
    onHasChanges,
    globalBarOpen = false,
    onGlobalBarClose,
    clearModeSignal = 0,
    savedEditorState = null,
    onEditorStateChange,
    startWithAdd = false,
    prefill,
    onClearPrefill,
    changesOnly = false,
    readOnly = false,
  }: BulkEditPanelProps) => {
    // Filter assignments to only those overlapping the visible timeline
    const visibleAssignments = useMemo(() => {
      const tlStartStr = new Date(timelineStart).toISOString().slice(0, 10);
      const tlEndStr = new Date(timelineEnd).toISOString().slice(0, 10);
      return (employee.assignments || []).filter((a: any) => {
        const sd = typeof a.startDate === "string" ? a.startDate : toDateString(a.startDate);
        const ed = typeof a.endDate === "string" ? a.endDate : toDateString(a.endDate);
        return sd <= tlEndStr && ed >= tlStartStr;
      });
    }, [employee.assignments, timelineStart, timelineEnd]);

    // ── Baseline + Action Log reducer ──
    const empId = employee._realEmpId || employee.empId;
    const [editorState, dispatch] = useReducer(
      editorReducer,
      { assignments: visibleAssignments, empId, saved: savedEditorState },
      ({
        assignments,
        empId: eid,
        saved,
      }: {
        assignments: any[];
        empId: string;
        saved?: EditorState | null;
      }): EditorState => {
        // Restore saved state if available (preserves action log across collapse/expand)
        if (saved && saved.actionLog.length > 0) return saved;
        const baseline = assignments.map((a: any) => toBaselineSegment(a, eid));
        return { baseline, actionLog: [], redoStack: [], current: [...baseline] };
      }
    );

    // Ref to current editor state for stable callbacks
    const editorStateRef = useRef(editorState);
    editorStateRef.current = editorState;

    // Report editor state changes to parent (for persistence across collapse/expand)
    useEffect(() => {
      onEditorStateChange?.(editorState);
    }, [editorState, onEditorStateChange]);

    // ── Direct save: build EditActions, dispatch + persist in one call ──
    const dispatchAndPersist = useCallback(
      (actions: EditAction[]) => {
        if (actions.length === 0) return;
        // Compute ops as diff from current state → new state (not from baseline)
        // This ensures we only send incremental changes to the parent
        const prevCurrent = editorStateRef.current.current;
        const newLog = [...editorStateRef.current.actionLog, ...actions];
        const newCurrent = replayActions(editorStateRef.current.baseline, newLog);
        if (actions.length === 1) dispatch({ type: "APPLY", action: actions[0] });
        else dispatch({ type: "APPLY_BATCH", actions });
        const ops = computeOps(prevCurrent, newCurrent);
        if (ops.length > 0) onSaveAll(ops);
      },
      [onSaveAll]
    );

    // Bridge: convert legacy BulkEditAction[] (from ToolBar) to EditAction[] and persist
    const dispatchLegacyBatch = useCallback(
      (legacyActions: BulkEditAction[]) => {
        if (legacyActions.length === 0) return;
        const curState = editorStateRef.current.current;
        const editActions: EditAction[] = [];
        for (const la of legacyActions) {
          const findSeg = (tempId: string) => curState.find((s) => s._uid === tempId);
          if (la.type === "TOGGLE_DELETE") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildDeleteAction(seg));
          } else if (la.type === "SPLIT_DELETE") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildSplitDeleteAction(seg, la.start, la.end));
          } else if (la.type === "REDUCE_UTIL") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildReduceUtilAction(seg, la.start, la.end, la.newUtil));
          } else if (la.type === "REDUCE_DAYS") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildReduceDaysAction(seg, la.start, la.end, la.keepDays, la.holidays));
          } else if (la.type === "REDUCE_UTIL_MULTI") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildReduceUtilMultiAction(seg, la.zones));
          } else if (la.type === "UPDATE_FIELD") {
            const seg = findSeg(la.tempId);
            if (seg) editActions.push(buildUpdateFieldAction(seg, la.field, la.value));
          } else if (la.type === "ADD_NEW") {
            const d = la.data;
            editActions.push(
              buildCreateAction(d.empId || "", {
                jobNo: d.jobNo || "",
                jobName: d.jobName || "",
                startDate: d.startDate || "",
                endDate: d.endDate || "",
                utilization: d.utilization ?? 100,
                status: d.status || "C",
                category: d.category || "chargeable",
              })
            );
          }
        }
        dispatchAndPersist(editActions);
      },
      [dispatchAndPersist]
    );

    const [selection, setSelection] = useState<BulkSelection | null>(null);

    // ── Create mode (state + handlers extracted to hook) ──
    const {
      createMode,
      setCreateMode,
      createUtilization,
      setCreateUtilization,
      createSegments,
      setCreateSegments,
      createExistingOverrides,
      setCreateExistingOverrides,
      clearCreate,
      prefillNeedIdRef,
      prefillJobInfo,
      handleCreateConfirm,
      handleCreateCancel,
      handleCreateDateChange,
    } = useBulkEditCreateMode({
      startWithAdd,
      prefill,
      onClearPrefill,
      pipelineJobcodes,
      employee,
      editorStateRef,
      dispatchAndPersist,
    });

    const effectiveLeft = LEFT_COL - leftColShrink;
    const [revertAllPreview, setRevertAllPreview] = useState(false);
    // Snapshot of editor state when global bar opens — for Cancel to restore
    const globalBarSnapshotRef = useRef<EditorState | null>(null);

    // Group flat state items by jobName::category for display (like consolidateAssignments)
    const rawTlStart = new Date(timelineStart).toISOString().slice(0, 10);
    const tlStartStr = rawTlStart > MDS_EXTRACT_START ? rawTlStart : MDS_EXTRACT_START;
    const tlEndStr = new Date(timelineEnd).toISOString().slice(0, 10);
    const hpd = getHoursPerDay(employee.grade);

    // Build display groups from editorState.current (BaselineSegment[]) and derive flags from baseline comparison
    const { baseline, actionLog, redoStack, current } = editorState;
    const hasChanges = actionLog.length > 0;

    // Notify parent of change state
    useEffect(() => {
      onHasChanges?.(hasChanges);
    }, [hasChanges, onHasChanges]);

    // Global bar actions
    // Undo/Redo in global bar: local preview only, no persist
    const handleGlobalUndo = useCallback(() => {
      dispatch({ type: "UNDO" });
    }, []);

    const handleGlobalRedo = useCallback(() => {
      dispatch({ type: "REDO" });
    }, []);

    const handleGlobalApply = useCallback(() => {
      // Persist the diff from snapshot (state when bar opened) to current state
      const snapshot = globalBarSnapshotRef.current;
      if (!snapshot) return;
      const snapshotCurrent = snapshot.current;
      const nowCurrent = editorStateRef.current.current;
      const ops = computeOps(snapshotCurrent, nowCurrent);
      if (ops.length > 0) onSaveAll(ops);
      // Clear snapshot so closing the bar doesn't restore it
      globalBarSnapshotRef.current = null;
      setRevertAllPreview(false);
    }, [onSaveAll]);

    const handleGlobalApplyAndClose = useCallback(() => {
      handleGlobalApply();
      onGlobalBarClose?.();
    }, [handleGlobalApply, onGlobalBarClose]);

    const handleToggleRevertAll = useCallback(() => {
      setRevertAllPreview((p) => !p);
    }, []);

    const globalBarApplyDisabled = useMemo(() => {
      if (!globalBarSnapshotRef.current) return true;
      return computeOps(globalBarSnapshotRef.current.current, current).length === 0;
    }, [current]);

    // Capture snapshot when global bar opens; restore when it closes from external (close all editors)
    useEffect(() => {
      if (globalBarOpen) {
        globalBarSnapshotRef.current = { ...editorStateRef.current };
        // Close any active edit/create mode
        clearCreate();
        setSelection(null);
        setRevertPreviewGroupKey(null);
        setPendingActionInfo(null);
      } else {
        // Restore snapshot if still present (closeGlobalBar clears it before closing, so this
        // only fires for external closes like "close all editors")
        if (globalBarSnapshotRef.current) {
          dispatch({ type: "RESTORE_SNAPSHOT", snapshot: globalBarSnapshotRef.current });
          globalBarSnapshotRef.current = null;
        }
        setRevertAllPreview(false);
      }
    }, [globalBarOpen]);

    // External signal to close active edit/create mode (without remounting)
    const clearModeSignalRef = useRef(clearModeSignal);
    useEffect(() => {
      if (clearModeSignal !== clearModeSignalRef.current) {
        clearModeSignalRef.current = clearModeSignal;
        clearCreate();
        setSelection(null);
        setRevertPreviewGroupKey(null);
        setPendingActionInfo(null);
      }
    }, [clearModeSignal, clearCreate]);

    const baselineUidSet = useMemo(() => new Set(baseline.map((s) => s._uid)), [baseline]);
    // Per-group undo/redo availability
    const undoableGroupKeys = useMemo(() => new Set(actionLog.map((a) => a.groupKey)), [actionLog]);
    const redoableGroupKeys = useMemo(() => new Set(redoStack.map((a) => a.groupKey)), [redoStack]);
    // Employee object with current (in-session) assignments for conflict detection in ToolBar
    const currentEmployee = useMemo(() => ({ ...employee, assignments: current }), [employee, current]);

    const displayGroups = useMemo(
      () =>
        buildDisplayGroups({
          current,
          baseline,
          actionLog,
          redoStack,
          tlStartStr,
          tlEndStr,
          hpd,
          enabledHolidayDates,
          baselineUidSet,
          revertAllPreview,
        }),
      [
        current,
        baseline,
        actionLog,
        redoStack,
        tlStartStr,
        tlEndStr,
        hpd,
        enabledHolidayDates,
        baselineUidSet,
        revertAllPreview,
      ]
    );

    // ── Revert: simply track which groups have actions in the log ──
    const revertableGroups = useMemo(() => {
      return new Set(actionLog.map((a) => a.groupKey));
    }, [actionLog]);

    // ── Revert + undo/redo (state + handlers extracted to hook) ──
    const {
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
    } = useBulkEditActions({
      editorStateRef,
      dispatch,
      onSaveAll,
      baseline,
      clearCreate,
    });

    // Group display groups into category sections (same structure as read-only view)
    const chCats = useMemo(() => new Set([...CHARGEABLE_CATS, ...GO_CATS]), []);
    const allDisplayGroups = changesOnly
      ? displayGroups.filter((g) => g.isModified || g.hasNewItems || g.isDeleted)
      : displayGroups;
    const categorySections = useMemo(() => {
      const sortDesc = (groups: DisplayGroup[]) => [...groups].sort((a, b) => b.totalHours - a.totalHours);
      const sections = [
        {
          title: "Billable",
          key: "edit-ch",
          dotColor: CATEGORY_THEME.chargeable.hex,
          groups: sortDesc(allDisplayGroups.filter((g) => chCats.has(g.category))),
        },
        {
          title: "Training",
          key: "edit-tr",
          dotColor: CATEGORY_THEME.training.hex,
          groups: sortDesc(allDisplayGroups.filter((g) => TRAINING_CATS.has(g.category))),
        },
        {
          title: "Absences",
          key: "edit-abs",
          dotColor: CATEGORY_THEME.otherAbsence.hex,
          groups: sortDesc(allDisplayGroups.filter((g) => ABSENCE_CATS.has(g.category))),
        },
        {
          title: "Non-Billable",
          key: "edit-oth",
          dotColor: CATEGORY_THEME.other?.hex || "#9ca3af",
          groups: sortDesc(
            allDisplayGroups.filter(
              (g) => !chCats.has(g.category) && !TRAINING_CATS.has(g.category) && !ABSENCE_CATS.has(g.category)
            )
          ),
        },
      ].filter((s) => s.groups.length > 0);
      return sections;
    }, [allDisplayGroups, chCats]);

    // Selected group lookup
    const selectedGroup = useMemo(
      () => (selection ? allDisplayGroups.find((g) => g.groupKey === selection.groupKey) : undefined),
      [selection, displayGroups]
    );

    // Clear selection if the selected group no longer exists
    const validSelection = selectedGroup ? selection : null;

    // Report toolbar active state to parent
    const toolbarActive = !!(validSelection && selectedGroup) || !!createMode?.range || globalBarOpen;
    useEffect(() => {
      onEditActive?.(toolbarActive);
    }, [toolbarActive, onEditActive]);

    // ── Edit action preview ──
    const [pendingActionInfo, setPendingActionInfo] = useState<PendingActionInfo>(null);

    const previewPeriods = useMemo(() => {
      if (!pendingActionInfo || !pendingActionInfo.action || !validSelection || !selectedGroup) return null;
      const { action, reduceUtil: rUtil, reduceDays: rDays } = pendingActionInfo;
      if (action === "revert") return null;
      const rawS = validSelection.subRange?.start || selectedGroup.startDate;
      const s = rawS > MDS_EXTRACT_START ? rawS : MDS_EXTRACT_START;
      const e = validSelection.subRange?.end || selectedGroup.endDate;
      const hasSubRange = !!validSelection.subRange || s > selectedGroup.startDate;
      return simulateEditAction(selectedGroup.items, action, s, e, hasSubRange, {
        reduceUtil: rUtil,
        reduceDays: rDays,
        holidays: enabledHolidayDates,
      });
    }, [pendingActionInfo, validSelection, selectedGroup, enabledHolidayDates]);

    // Notify parent of selected jobNo for flame chart highlight
    useEffect(() => {
      if (!selectedGroup?.jobNo) {
        onSelectedJobNoChange?.(null);
        return;
      }
      let changeDate: string | undefined;
      let newUtil: number | undefined;
      if (previewPeriods && pendingActionInfo?.action && validSelection) {
        const subStart = validSelection.subRange?.start || selectedGroup.startDate;
        if (pendingActionInfo.action === "reduce_util") {
          changeDate = subStart;
          newUtil = pendingActionInfo.reduceUtil;
        } else if (pendingActionInfo.action === "truncate") {
          changeDate = subStart;
          newUtil = 0;
        } else if (pendingActionInfo.action === "reduce_days") {
          changeDate = subStart;
        }
      }
      onSelectedJobNoChange?.({ jobNo: selectedGroup.jobNo, changeDate, newUtil });
    }, [selectedGroup?.jobNo, onSelectedJobNoChange, previewPeriods, pendingActionInfo, validSelection, selectedGroup]);

    useLiveAssignmentsPreview({
      current,
      baseline,
      actionLog,
      onLiveAssignmentsChange,
      revertAllPreview,
      createMode,
      createUtilization,
      createSegments,
      createExistingOverrides,
      previewPeriods,
      selectedGroup,
      revertPreviewGroupKey,
      revertPreviewPeriods,
      displayGroups,
      globalBarOpen,
    });

    // ── Row & selection handlers (extracted to useBulkEditModeTransitions) ──
    const {
      closeGlobalBar,
      enterEditMode,
      enterCreateMode,
      handleRowSelect,
      handleRowDragSelect,
      handleClearSelection,
      handleAddDragSelect,
      handleAddRowClick,
    } = useBulkEditModeTransitions({
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
    });

    // Escape key → cancel editing
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    // Build label like EmployeeRow's getJobLabel: Client - OppName - JobCode - Xh - Yj
    const { jobcodeOppsList, pipelineJobcodes: ctxPipelineJobcodes, ioJobcodes, showIO } = useTimelineData();
    const { onNavigateToOpportunity } = useTimelineHandlers();
    const pJobs = pipelineJobcodes || ctxPipelineJobcodes;

    const resolveOpp = useCallback(
      (jobNo: string) => {
        const key = String(jobNo).trim();
        if (jobcodeOppsList) {
          const opps = jobcodeOppsList.get(key);
          if (opps && opps.length > 0) return opps[0];
        }
        const single = pJobs?.get(key);
        return single ? { oppName: single.opportunityName, account: single.account } : null;
      },
      [jobcodeOppsList, pJobs]
    );

    const getLabelParts = useCallback(
      (group: DisplayGroup): LabelParts => {
        const resolved = resolveOpp(group.jobNo);
        const isChargeable = CHARGEABLE_CATS.has(group.category) || GO_CATS.has(group.category);

        // Sum hours & days across all non-deleted items in group, clipped to visible timeline
        let totalH = 0;
        for (const item of group.items.filter((i) => !i.isDeleted)) {
          const clippedStart = item.startDate > tlStartStr ? item.startDate : tlStartStr;
          const clippedEnd = item.endDate < tlEndStr ? item.endDate : tlEndStr;
          if (clippedStart > clippedEnd) continue;
          const wd = countWorkingDays(clippedStart, clippedEnd, enabledHolidayDates);
          totalH += wd * (item.utilization / 100) * hpd;
        }
        const totalDays = Math.round((totalH / hpd) * 10) / 10;
        const hStr = totalH % 1 === 0 ? `${totalH}` : `${totalH.toFixed(1)}`;
        const dStr = totalDays % 1 === 0 ? `${totalDays}` : `${totalDays.toFixed(1)}`;

        if (resolved?.account) {
          return {
            account: resolved.account,
            oppName: resolved.oppName || resolved.opportunityName || "",
            name: `${resolved.account} - ${resolved.oppName || resolved.opportunityName || ""}`,
            jobNo: isChargeable ? group.jobNo : "",
            hours: hStr,
            days: dStr,
          };
        }
        return { name: group.jobName, jobNo: isChargeable ? group.jobNo : "", hours: hStr, days: dStr };
      },
      [resolveOpp, tlStartStr, tlEndStr, hpd, enabledHolidayDates]
    );

    const handleSelectionChange = useCallback((sel: BulkSelection) => {
      setSelection(sel);
    }, []);

    return (
      <Box>
        {/* Assignment rows grouped by category sections */}
        <BulkEditCategorySections
          categorySections={categorySections}
          tl={tl}
          effectiveLeft={effectiveLeft}
          validSelection={validSelection}
          createMode={createMode}
          createUtilization={createUtilization}
          createSegments={createSegments}
          revertPreviewGroupKey={revertPreviewGroupKey}
          revertPreviewPeriods={revertPreviewPeriods}
          previewPeriods={previewPeriods}
          revertableGroups={revertableGroups}
          handleRowSelect={handleRowSelect}
          handleRowDragSelect={readOnly ? undefined : handleRowDragSelect}
          handleRevertClick={handleRevertClick}
          onNavigateToOpportunity={onNavigateToOpportunity}
          getLabelParts={getLabelParts}
          leftColShrink={leftColShrink}
          pipelineJobcodes={pipelineJobcodes}
          showIO={showIO}
          ioJobcodes={ioJobcodes}
          readOnly={readOnly}
          hpd={hpd}
          tlStartStr={tlStartStr}
          tlEndStr={tlEndStr}
          enabledHolidayDates={enabledHolidayDates}
        />

        {/* Add row — empty PeriodBar for drag-to-create (hidden in readOnly) */}
        {!readOnly && (
          <AddRow
            tl={tl}
            isActive={createMode?.type === "new"}
            selectionRange={createMode?.type === "new" && createMode.range ? createMode.range : undefined}
            onDragSelect={handleAddDragSelect}
            onClick={handleAddRowClick}
            leftColShrink={leftColShrink}
            utilization={createMode?.type === "new" ? createUtilization : 0}
          />
        )}

        {/* Edit toolbar, create toolbar, and global bar */}
        <BulkEditToolbarSection
          readOnly={readOnly}
          validSelection={validSelection}
          selectedGroup={selectedGroup}
          enabledHolidayDates={enabledHolidayDates}
          dispatchLegacyBatch={dispatchLegacyBatch}
          handleClearSelection={handleClearSelection}
          setRevertPreviewGroupKey={setRevertPreviewGroupKey}
          setPendingActionInfo={setPendingActionInfo}
          handleSelectionChange={handleSelectionChange}
          getLabelParts={getLabelParts}
          leftColShrink={leftColShrink}
          revertableGroups={revertableGroups}
          handleRevertClick={handleRevertClick}
          revertPreviewGroupKey={revertPreviewGroupKey}
          handleRevertConfirm={handleRevertConfirm}
          handleRevertCancel={handleRevertCancel}
          handleGroupUndo={handleGroupUndo}
          handleGroupRedo={handleGroupRedo}
          undoableGroupKeys={undoableGroupKeys}
          redoableGroupKeys={redoableGroupKeys}
          undoRedoActive={undoRedoActive}
          handleUndoRedoApply={handleUndoRedoApply}
          handleUndoRedoCancel={handleUndoRedoCancel}
          createMode={createMode}
          pJobs={pJobs}
          currentEmployee={currentEmployee}
          handleCreateConfirm={handleCreateConfirm}
          handleCreateCancel={handleCreateCancel}
          handleCreateDateChange={handleCreateDateChange}
          setCreateUtilization={setCreateUtilization}
          setCreateSegments={setCreateSegments}
          setCreateExistingOverrides={setCreateExistingOverrides}
          prefillJobInfo={prefillJobInfo}
          resolveOpp={resolveOpp}
          globalBarOpen={globalBarOpen}
          effectiveLeft={effectiveLeft}
          revertAllPreview={revertAllPreview}
          handleToggleRevertAll={handleToggleRevertAll}
          actionLog={actionLog}
          redoStack={redoStack}
          handleGlobalUndo={handleGlobalUndo}
          handleGlobalRedo={handleGlobalRedo}
          closeGlobalBar={closeGlobalBar}
          handleGlobalApplyAndClose={handleGlobalApplyAndClose}
          globalBarApplyDisabled={globalBarApplyDisabled}
        />
      </Box>
    );
  }
);
BulkEditPanel.displayName = "BulkEditPanel";
