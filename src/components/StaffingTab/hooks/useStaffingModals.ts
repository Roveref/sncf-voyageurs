import { useState } from "react";
import type { Employee, WaterfallStep } from "../types";

/** Waterfall modal data shape */
interface WaterfallModalData {
  title: string;
  steps: WaterfallStep[];
  grossH: number;
  tu: number;
}

/** Waterfall hover tooltip data shape */
interface WaterfallHoverData {
  x: number;
  y: number;
  title: string;
  steps: WaterfallStep[];
  grossH: number;
  tu: number;
}

/** Period detail modal data */
interface PeriodDetailModalData {
  startDate: Date;
  endDate: Date;
  [key: string]: unknown;
}

/** Opportunity modal row */
interface OpportunityModalRow {
  [key: string]: unknown;
}

export function useStaffingModals() {
  const [showDebug, setShowDebug] = useState(false);
  const [showUtilization, setShowUtilization] = useState(true);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [opportunityModalRow, setOpportunityModalRow] = useState<OpportunityModalRow | null>(null);
  const [waterfallModalData, setWaterfallModalData] = useState<WaterfallModalData | null>(null);
  const [waterfallHover, setWaterfallHover] = useState<WaterfallHoverData | null>(null);
  const [periodDetailModal, setPeriodDetailModal] = useState<PeriodDetailModalData | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalEmployee, setProfileModalEmployee] = useState<Employee | null>(null);
  const [scenarioCreateOpen, setScenarioCreateOpen] = useState(false);
  const [scenarioCompareOpen, setScenarioCompareOpen] = useState(false);
  const [ganttDragOver, setGanttDragOver] = useState(false);

  return {
    showDebug,
    setShowDebug,
    showUtilization,
    setShowUtilization,
    showAlertsPanel,
    setShowAlertsPanel,
    showPlanningModal,
    setShowPlanningModal,
    showCalendarModal,
    setShowCalendarModal,
    selectedEmployee,
    setSelectedEmployee,
    opportunityModalRow,
    setOpportunityModalRow,
    waterfallModalData,
    setWaterfallModalData,
    waterfallHover,
    setWaterfallHover,
    periodDetailModal,
    setPeriodDetailModal,
    profileModalOpen,
    setProfileModalOpen,
    profileModalEmployee,
    setProfileModalEmployee,
    scenarioCreateOpen,
    setScenarioCreateOpen,
    scenarioCompareOpen,
    setScenarioCompareOpen,
    ganttDragOver,
    setGanttDragOver,
  };
}
