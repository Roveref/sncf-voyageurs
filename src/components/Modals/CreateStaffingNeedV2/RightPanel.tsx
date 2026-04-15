/**
 * RightPanel — Right side of the split-panel modal.
 * Contains: EnhancedStaffingTimeline + NeedsList (existing + staged).
 */

import React, { memo, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import EnhancedStaffingTimeline from "./EnhancedStaffingTimeline";
import AddedNeedsList from "./AddedNeedsList";
import type { TimelineAssignment, StagedNeed, NeedFormState } from "./types";
import type { StaffingNeedItem } from "../../../types/actions";

interface RightPanelProps {
  pastAssignments: TimelineAssignment[];
  currentAssignments: TimelineAssignment[];
  upcomingAssignments: TimelineAssignment[];
  existingNeeds: StaffingNeedItem[];
  stagedNeeds: StagedNeed[];
  form: NeedFormState;
  canAdd: boolean;
  editingNeedId: string | null;
  editingExistingNeedId: string | null;
  lastAddedId: string | null;
  onEditNeed: (need: StagedNeed) => void;
  onRemoveNeed: (id: string) => void;
  onEditExistingNeed: (need: StaffingNeedItem) => void;
  onDeleteExistingNeed: (id: string) => void;
}

const RightPanel = memo(
  ({
    pastAssignments,
    currentAssignments,
    upcomingAssignments,
    existingNeeds,
    stagedNeeds,
    form,
    canAdd,
    editingNeedId,
    editingExistingNeedId,
    lastAddedId,
    onEditNeed,
    onRemoveNeed,
    onEditExistingNeed,
    onDeleteExistingNeed,
  }: RightPanelProps) => {
    const previewNeed = useMemo(() => {
      if (!form.grade || !form.startDate || !form.endDate || form.endDate < form.startDate) return null;
      if (editingNeedId || editingExistingNeedId) return null;
      // Don't show preview if an identical staged need already exists (prevents ghost "NEW" after add)
      const isDuplicate = stagedNeeds.some(
        (n) =>
          n.grade === form.grade &&
          n.startDate === form.startDate &&
          n.endDate === form.endDate &&
          n.utilization === form.utilization
      );
      if (isDuplicate) return null;
      return {
        grade: form.grade,
        startDate: form.startDate,
        endDate: form.endDate,
        utilization: form.utilization,
        quantity: form.quantity,
      };
    }, [
      canAdd,
      form.grade,
      form.startDate,
      form.endDate,
      form.utilization,
      form.quantity,
      editingNeedId,
      editingExistingNeedId,
      stagedNeeds,
    ]);

    // Handle click on a need bar in the timeline
    const handleClickNeed = useCallback(
      (needId: string, isExisting: boolean) => {
        if (isExisting) {
          const need = existingNeeds.find((n) => n.id === needId);
          if (need) onEditExistingNeed(need);
        } else {
          const need = stagedNeeds.find((n) => n.id === needId);
          if (need) onEditNeed(need);
        }
      },
      [existingNeeds, stagedNeeds, onEditExistingNeed, onEditNeed]
    );

    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          overflow: "hidden",
        }}
      >
        <EnhancedStaffingTimeline
          pastAssignments={pastAssignments}
          currentAssignments={currentAssignments}
          upcomingAssignments={upcomingAssignments}
          existingNeeds={existingNeeds}
          stagedNeeds={stagedNeeds}
          previewNeed={previewNeed}
          lastAddedId={lastAddedId}
          editingExistingNeedId={editingExistingNeedId}
          editingNeedId={editingNeedId}
          onClickNeed={handleClickNeed}
        />

        <AddedNeedsList
          existingNeeds={existingNeeds}
          stagedNeeds={stagedNeeds}
          editingNeedId={editingNeedId}
          editingExistingNeedId={editingExistingNeedId}
          lastAddedId={lastAddedId}
          onEditStaged={onEditNeed}
          onRemoveStaged={onRemoveNeed}
          onEditExisting={onEditExistingNeed}
          onDeleteExisting={onDeleteExistingNeed}
        />
      </Box>
    );
  }
);

RightPanel.displayName = "RightPanel";
export default RightPanel;
