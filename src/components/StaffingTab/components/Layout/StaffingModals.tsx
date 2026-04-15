import React, { memo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import CloseIcon from "@mui/icons-material/Close";

import { AlertsPanel } from "../Dashboard";
import WaterfallModal from "../Dashboard/WaterfallModal";
import PeriodDetailModal from "../Dashboard/PeriodDetailModal";
import { EmployeePlanningModal, EmployeeCalendarModal } from "../Employee";
import { EmployeeModal } from "../Employee/EmployeeProfileModal";
import { ScenarioCreateDialog, ScenarioCompareView, StaffingNeedsPiP } from "../Scenario";
import StaffingOptimizer from "../Scenario/StaffingOptimizer";
import OpportunityExpandedDetails from "../../../OpportunityList/components/OpportunityExpandedDetails";
import type { Proposal } from "../../utils/autoAssign";
import type { Employee } from "../../types";

export interface StaffingModalsProps {
  // AlertsPanel
  alerts: any[];
  showAlertsPanel: boolean;
  onCloseAlerts: () => void;
  onNavigateToEmployee: (empId: string) => void;

  // Planning / Calendar modals
  showPlanningModal: boolean;
  onClosePlanning: () => void;
  showCalendarModal: boolean;
  onCloseCalendar: () => void;
  selectedEmployee: Employee | null;

  // Waterfall
  waterfallModalData: any;
  onCloseWaterfall: () => void;

  // Employee Profile
  profileModalOpen: boolean;
  onCloseProfile: () => void;
  profileModalEmployee: Employee | null;
  onSaveEmployee: (...args: any[]) => void;
  onDeleteEmployee: (empId: string) => void;
  isManualEmployee: boolean;
  onShowWaterfall: (data: any) => void;
  existingMetadata: any;
  sapGradeHistory: any;
  employeeNames: string[];
  internToAnalystMapping: any;
  allSapGradeResults: any;

  // Period Detail
  periodDetailModal: any;
  onClosePeriodDetail: () => void;

  // Scenario Create
  scenarioCreateOpen: boolean;
  onCloseScenarioCreate: () => void;

  // Scenario Compare
  scenarioCompareOpen: boolean;
  onCloseScenarioCompare: () => void;
  data: Record<string, any>[];
  effectiveMetadata: Record<string, any>;
  enabledHolidayDates: Set<string>;
  realTU: number;
  realChH: number;
  realNetH: number;
  filteredEmployeeCount: number;

  // PiP panels
  openPipScenarioIds: string[];
  allScenarios: any[];
  activeScenarioId: string | undefined;
  onClosePip: (id: string) => void;
  onOpenBulkEditWithPrefill: ((prefill?: any) => void) | undefined;
  onReassign: ((sourceKey: string, target: any) => void) | undefined;
  pipelineJobcodes: any;
  ioJobcodes: any;
  enrichedGanttData: any[];
  onOpenScenario: (id: string) => void;
  realTURef: number;
  scenarioTU: number;
  onOpenOptimizer: (() => void) | undefined;

  // Staffing Optimizer
  optimizerOpen: boolean;
  onCloseOptimizer: () => void;
  onApplyProposal: (proposal: Proposal) => void;
  currentTeamTU: number;
  currentTeamNetH: number;
  currentTeamChH: number;

  // Opportunity modal
  opportunityModalRow: any;
  onCloseOpportunityModal: () => void;
}

export const StaffingModals = memo(
  ({
    // AlertsPanel
    alerts,
    showAlertsPanel,
    onCloseAlerts,
    onNavigateToEmployee,

    // Planning / Calendar
    showPlanningModal,
    onClosePlanning,
    showCalendarModal,
    onCloseCalendar,
    selectedEmployee,

    // Waterfall
    waterfallModalData,
    onCloseWaterfall,

    // Employee Profile
    profileModalOpen,
    onCloseProfile,
    profileModalEmployee,
    onSaveEmployee,
    onDeleteEmployee,
    isManualEmployee,
    onShowWaterfall,
    existingMetadata,
    sapGradeHistory,
    employeeNames,
    internToAnalystMapping,
    allSapGradeResults,

    // Period Detail
    periodDetailModal,
    onClosePeriodDetail,

    // Scenario Create
    scenarioCreateOpen,
    onCloseScenarioCreate,

    // Scenario Compare
    scenarioCompareOpen,
    onCloseScenarioCompare,
    data,
    effectiveMetadata,
    enabledHolidayDates,
    realTU,
    realChH,
    realNetH,
    filteredEmployeeCount,

    // PiP
    openPipScenarioIds,
    allScenarios,
    activeScenarioId,
    onClosePip,
    onOpenBulkEditWithPrefill,
    onReassign,
    pipelineJobcodes,
    ioJobcodes,
    enrichedGanttData,
    onOpenScenario,
    realTURef,
    scenarioTU,
    onOpenOptimizer,

    // Optimizer
    optimizerOpen,
    onCloseOptimizer,
    onApplyProposal,
    currentTeamTU,
    currentTeamNetH,
    currentTeamChH,

    // Opportunity modal
    opportunityModalRow,
    onCloseOpportunityModal,
  }: StaffingModalsProps) => {
    return (
      <>
        <AlertsPanel
          alerts={alerts}
          isOpen={showAlertsPanel}
          onClose={onCloseAlerts}
          onNavigateToEmployee={onNavigateToEmployee}
        />

        <EmployeePlanningModal isOpen={showPlanningModal} onClose={onClosePlanning} employee={selectedEmployee} />

        <EmployeeCalendarModal isOpen={showCalendarModal} onClose={onCloseCalendar} employee={selectedEmployee} />

        <WaterfallModal data={waterfallModalData} onClose={onCloseWaterfall} />

        <EmployeeModal
          open={profileModalOpen}
          onClose={onCloseProfile}
          employee={profileModalEmployee}
          onSave={onSaveEmployee}
          onDelete={onDeleteEmployee}
          isManual={isManualEmployee}
          onShowWaterfall={onShowWaterfall}
          existingMetadata={existingMetadata}
          sapGradeHistory={sapGradeHistory}
          employeeNames={employeeNames}
          internToAnalystMapping={internToAnalystMapping}
          allSapGradeResults={allSapGradeResults}
        />

        <PeriodDetailModal data={periodDetailModal} onClose={onClosePeriodDetail} />

        <ScenarioCreateDialog open={scenarioCreateOpen} onClose={onCloseScenarioCreate} />

        <ScenarioCompareView
          open={scenarioCompareOpen}
          onClose={onCloseScenarioCompare}
          data={data}
          employeeMetadata={effectiveMetadata}
          enabledHolidayDates={enabledHolidayDates}
          realTU={realTU}
          realChH={realChH}
          realNetH={realNetH}
          employeeCount={filteredEmployeeCount}
        />

        {/* PiP staffing needs panels -- one per open scenario */}
        {openPipScenarioIds.map((scId, idx) => {
          const sc = allScenarios.find((s: { id: string }) => s.id === scId);
          if (!sc) return null;
          const scOverrides = sc.assignmentOverrides || {};
          const isActive = scId === activeScenarioId;
          return (
            <StaffingNeedsPiP
              key={scId}
              open
              scenarioId={scId}
              scenarioName={sc.name}
              instanceIndex={idx}
              onClose={() => onClosePip(scId)}
              onOpenAssignmentModal={isActive ? onOpenBulkEditWithPrefill : undefined}
              onReassign={isActive ? onReassign : undefined}
              isScenarioActive={isActive}
              pipelineJobcodes={pipelineJobcodes}
              ioJobcodes={ioJobcodes}
              assignmentOverrides={scOverrides}
              enrichedGanttData={enrichedGanttData}
              allScenarios={allScenarios}
              onOpenScenario={onOpenScenario}
              realTU={realTURef}
              scenarioTU={isActive ? scenarioTU : null}
              onOpenOptimizer={isActive ? onOpenOptimizer : undefined}
            />
          );
        })}

        {/* Staffing Optimizer */}
        <StaffingOptimizer
          open={optimizerOpen}
          onClose={onCloseOptimizer}
          onApplyProposal={onApplyProposal}
          enrichedGanttData={enrichedGanttData}
          pipelineJobcodes={pipelineJobcodes}
          enabledHolidayDates={enabledHolidayDates}
          currentTeamTU={currentTeamTU}
          currentTeamNetH={currentTeamNetH}
          currentTeamChH={currentTeamChH}
        />

        {/* Opportunity detail modal -- opens when clicking a Pipeline badge */}
        <Dialog
          open={!!opportunityModalRow}
          onClose={onCloseOpportunityModal}
          TransitionComponent={DialogTransition}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, maxHeight: "90vh" } }}
        >
          {opportunityModalRow && (
            <>
              <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1, pb: 0 }}>
                <IconButton size="small" onClick={onCloseOpportunityModal}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <OpportunityExpandedDetails row={opportunityModalRow} showNetRevenue={false} showIO={false} />
            </>
          )}
        </Dialog>
      </>
    );
  }
);
StaffingModals.displayName = "StaffingModals";
