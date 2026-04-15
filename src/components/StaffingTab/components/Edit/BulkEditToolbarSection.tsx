import React, { memo } from "react";
import { ToolBar } from "./BulkEditToolbar";
import { BulkEditGlobalBar } from "./BulkEditGlobalBar";
import type {
  BulkSelection,
  DisplayGroup,
  BulkEditAction,
  LabelParts,
  PendingActionInfo,
  CreateMode,
  EditAction,
} from "./bulkEditTypes";

interface BulkEditToolbarSectionProps {
  readOnly: boolean;
  // Edit toolbar props
  validSelection: BulkSelection | null;
  selectedGroup: DisplayGroup | undefined;
  enabledHolidayDates: Set<string>;
  dispatchLegacyBatch: (actions: BulkEditAction[]) => void;
  handleClearSelection: () => void;
  setRevertPreviewGroupKey: (key: string | null) => void;
  setPendingActionInfo: (info: PendingActionInfo) => void;
  handleSelectionChange: (sel: BulkSelection) => void;
  getLabelParts: (group: DisplayGroup) => LabelParts;
  leftColShrink: number;
  revertableGroups: Set<string>;
  handleRevertClick: (groupKey: string) => void;
  revertPreviewGroupKey: string | null;
  handleRevertConfirm: () => void;
  handleRevertCancel: () => void;
  handleGroupUndo: (groupKey: string) => void;
  handleGroupRedo: (groupKey: string) => void;
  undoableGroupKeys: Set<string>;
  redoableGroupKeys: Set<string>;
  undoRedoActive: boolean;
  handleUndoRedoApply: () => void;
  handleUndoRedoCancel: () => void;
  // Create toolbar props
  createMode: CreateMode;
  pJobs: Map<string, any> | null;
  currentEmployee: any;
  handleCreateConfirm: (data: any) => void;
  handleCreateCancel: () => void;
  handleCreateDateChange: (range: { start: string; end: string }) => void;
  setCreateUtilization: (v: number) => void;
  setCreateSegments: (v: { startDate: string; endDate: string; utilization: number }[] | null) => void;
  setCreateExistingOverrides: (
    v:
      | {
          origJobNo: string;
          origStartDate: string;
          replacements: { startDate: string; endDate: string; utilization: number }[];
        }[]
      | null
  ) => void;
  prefillJobInfo: { jobNo: string; jobName: string; account: string } | null;
  resolveOpp: (jobNo: string) => any;
  // Global bar props
  globalBarOpen: boolean;
  effectiveLeft: number;
  revertAllPreview: boolean;
  handleToggleRevertAll: () => void;
  actionLog: EditAction[];
  redoStack: EditAction[];
  handleGlobalUndo: () => void;
  handleGlobalRedo: () => void;
  closeGlobalBar: () => void;
  handleGlobalApplyAndClose: () => void;
  globalBarApplyDisabled: boolean;
}

const BulkEditToolbarSection = memo(
  ({
    readOnly,
    validSelection,
    selectedGroup,
    enabledHolidayDates,
    dispatchLegacyBatch,
    handleClearSelection,
    setRevertPreviewGroupKey,
    setPendingActionInfo,
    handleSelectionChange,
    getLabelParts,
    leftColShrink,
    revertableGroups,
    handleRevertClick,
    revertPreviewGroupKey,
    handleRevertConfirm,
    handleRevertCancel,
    handleGroupUndo,
    handleGroupRedo,
    undoableGroupKeys,
    redoableGroupKeys,
    undoRedoActive,
    handleUndoRedoApply,
    handleUndoRedoCancel,
    createMode,
    pJobs,
    currentEmployee,
    handleCreateConfirm,
    handleCreateCancel,
    handleCreateDateChange,
    setCreateUtilization,
    setCreateSegments,
    setCreateExistingOverrides,
    prefillJobInfo,
    resolveOpp,
    globalBarOpen,
    effectiveLeft,
    revertAllPreview,
    handleToggleRevertAll,
    actionLog,
    redoStack,
    handleGlobalUndo,
    handleGlobalRedo,
    closeGlobalBar,
    handleGlobalApplyAndClose,
    globalBarApplyDisabled,
  }: BulkEditToolbarSectionProps) => {
    return (
      <>
        {/* Action bar -- visible when row selected (hidden in readOnly) */}
        {!readOnly && validSelection && selectedGroup && (
          <ToolBar
            mode="edit"
            selection={validSelection}
            selectedGroup={selectedGroup}
            enabledHolidayDates={enabledHolidayDates}
            dispatchBatch={dispatchLegacyBatch}
            onClearSelection={() => {
              handleClearSelection();
              setRevertPreviewGroupKey(null);
              setPendingActionInfo(null);
            }}
            onSelectionChange={handleSelectionChange}
            labelParts={getLabelParts(selectedGroup)}
            leftColShrink={leftColShrink}
            onPendingActionChange={(info: PendingActionInfo) => {
              if (info?.action !== "revert" && revertPreviewGroupKey) setRevertPreviewGroupKey(null);
              setPendingActionInfo(info);
            }}
            onRevert={
              revertableGroups.has(selectedGroup.groupKey) ? () => handleRevertClick(selectedGroup.groupKey) : undefined
            }
            onRevertConfirm={revertPreviewGroupKey ? handleRevertConfirm : undefined}
            onRevertCancel={handleRevertCancel}
            onUndo={() => handleGroupUndo(selectedGroup.groupKey)}
            onRedo={() => handleGroupRedo(selectedGroup.groupKey)}
            canUndo={undoableGroupKeys.has(selectedGroup.groupKey)}
            canRedo={redoableGroupKeys.has(selectedGroup.groupKey)}
            undoRedoActive={undoRedoActive}
            onUndoRedoApply={handleUndoRedoApply}
            onUndoRedoCancel={handleUndoRedoCancel}
          />
        )}

        {/* Create action bar -- unified for both new and gap fill (hidden in readOnly) */}
        {!readOnly &&
          createMode?.range &&
          (() => {
            const isGapFill = createMode.type === "gap_fill";
            const resolved = isGapFill && createMode.jobNo ? resolveOpp(createMode.jobNo) : null;
            return (
              <ToolBar
                mode="create"
                dateRange={createMode.range}
                enabledHolidayDates={enabledHolidayDates}
                pipelineJobcodes={pJobs}
                employee={currentEmployee}
                onConfirm={handleCreateConfirm}
                onCancel={handleCreateCancel}
                onDateChange={handleCreateDateChange}
                onUtilizationChange={setCreateUtilization}
                onSegmentsChange={setCreateSegments}
                onExistingOverrides={setCreateExistingOverrides}
                presetJobNo={createMode.jobNo || prefillJobInfo?.jobNo}
                presetJobName={createMode.jobName || prefillJobInfo?.jobName}
                presetClient={isGapFill ? resolved?.account : prefillJobInfo?.account}
                presetCategory={createMode.category}
                presetUtilization={createMode.utilization}
                leftColShrink={leftColShrink}
              />
            );
          })()}

        {/* Global action bar -- mirrors edit ToolBar 2-column layout */}
        {globalBarOpen && !validSelection && !createMode?.range && (
          <BulkEditGlobalBar
            effectiveLeft={effectiveLeft}
            readOnly={readOnly}
            revertAllPreview={revertAllPreview}
            onToggleRevertAll={handleToggleRevertAll}
            actionLog={actionLog}
            redoStack={redoStack}
            onUndo={handleGlobalUndo}
            onRedo={handleGlobalRedo}
            onClose={closeGlobalBar}
            onApply={handleGlobalApplyAndClose}
            applyDisabled={globalBarApplyDisabled}
          />
        )}
      </>
    );
  }
);
BulkEditToolbarSection.displayName = "BulkEditToolbarSection";

export { BulkEditToolbarSection };
