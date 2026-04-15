/**
 * CreateStaffingNeedModal (V2) — Split-panel staffing need creation modal.
 *
 * Layout: Left form panel (400px) + Right panel (timeline + impact + added list).
 * Flow: Select opportunity → fill form → "+ Add" to stage → repeat → "Create" to persist.
 * Timeline: 4 sections — Past, Current, Upcoming staffing + Needs (with live preview).
 */

import React, { memo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import GroupIcon from "@mui/icons-material/Group";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import DialogTransition from "../../common/DialogTransition";
import useResponsive from "../../../hooks/useResponsive";
import { easing, keyframes } from "../../../styles/animations";
import { useNeedCreatorState } from "./hooks/useNeedCreatorState";
import { useOpportunityStaffing } from "./hooks/useOpportunityStaffing";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import type { CreateStaffingNeedModalProps } from "./types";

const CreateStaffingNeedModal = memo(
  ({ open, onClose, opportunityData = [], initialOpportunity = null }: CreateStaffingNeedModalProps) => {
    const theme = useTheme();
    const { isPhone } = useResponsive();

    const state = useNeedCreatorState(opportunityData, initialOpportunity, open, onClose);

    const opportunityId = state.selectedOpportunity?.opportunityId;
    const jobCode = state.selectedOpportunity?.jobCode || state.selectedOpportunity?.jobNo;
    const staffing = useOpportunityStaffing(opportunityId, jobCode);

    return (
      <Dialog
        open={open}
        onClose={state.handleClose}
        TransitionComponent={DialogTransition}
        maxWidth={false}
        fullScreen={isPhone}
        PaperProps={{
          sx: {
            borderRadius: isPhone ? 0 : 3,
            bgcolor: "background.default",
            backgroundImage: "none",
            width: isPhone ? "100%" : 1320,
            maxWidth: "96vw",
            maxHeight: "92vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* ── Header ── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 3,
            py: 2,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GroupIcon sx={{ color: "primary.main", fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.2 }}>
              New Staffing Need
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
              Stage needs, then create them all at once
            </Typography>
          </Box>
          {state.stagedNeeds.length > 0 && (
            <Chip
              label={`${state.stagedNeeds.length} staged`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.72rem",
                height: 24,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.dark,
              }}
            />
          )}
          <IconButton size="small" aria-label="Close" onClick={state.handleClose} sx={{ ml: 0.5 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider />

        {/* ── Body ── */}
        <DialogContent
          sx={{
            flex: 1,
            p: 2.5,
            bgcolor: "background.default",
            overflow: "hidden",
            display: "flex",
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 2.5,
              flexDirection: isPhone ? "column" : "row",
              flex: 1,
              minHeight: 0,
              animation: `fadeInUp 0.35s ${easing.elegant} both`,
              ...keyframes.fadeInUp,
            }}
          >
            <LeftPanel
              accountList={state.accountList}
              filteredOpportunities={state.filteredOpportunities}
              selectedAccount={state.selectedAccount}
              setSelectedAccount={state.setSelectedAccount}
              selectedOpportunity={state.selectedOpportunity}
              setSelectedOpportunity={state.setSelectedOpportunity}
              form={state.form}
              updateForm={state.updateForm}
              setStartDate={state.setStartDate}
              setEndDate={state.setEndDate}
              quickStartDates={state.quickStartDates}
              quickEndDates={state.quickEndDates}
              formErrors={state.formErrors}
              dateError={state.dateError}
              formDatesValid={state.formDatesValid}
              canAdd={state.canAdd}
              sortedEmployeeOptions={state.sortedEmployeeOptions}
              editingNeedId={state.editingNeedId}
              editingExistingNeedId={state.editingExistingNeedId}
              isEditing={state.isEditing}
              addNeed={state.addNeed}
              resetForm={state.resetForm}
            />

            <RightPanel
              pastAssignments={staffing.past}
              currentAssignments={staffing.current}
              upcomingAssignments={staffing.upcoming}
              existingNeeds={staffing.existingNeeds}
              stagedNeeds={state.stagedNeeds}
              form={state.form}
              canAdd={state.canAdd}
              editingNeedId={state.editingNeedId}
              editingExistingNeedId={state.editingExistingNeedId}
              lastAddedId={state.lastAddedId}
              onEditNeed={state.editNeed}
              onRemoveNeed={state.removeNeed}
              onEditExistingNeed={state.editExistingNeed}
              onDeleteExistingNeed={state.deleteExistingNeed}
            />
          </Box>
        </DialogContent>

        {/* ── Footer ── */}
        <Divider />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 1.5,
            px: 3,
            py: 1.75,
            flexShrink: 0,
          }}
        >
          <Button onClick={state.handleClose} size="small" sx={{ fontWeight: 600, px: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            size="medium"
            onClick={state.handleSave}
            startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
            disabled={!state.canSave}
            sx={{ fontWeight: 700, px: 3, borderRadius: 2 }}
          >
            Create{state.stagedNeeds.length > 0 ? ` (${state.stagedNeeds.length})` : ""}
          </Button>
        </Box>
      </Dialog>
    );
  }
);

CreateStaffingNeedModal.displayName = "CreateStaffingNeedModal";
export default CreateStaffingNeedModal;
