import React from "react";
import type { Employee, StaffingFilters, WaterfallStep } from "../types";
import { useStaffingEmployeeHandlers } from "./useStaffingProfileHandlers";
import { useStaffingFilterHandlers } from "./useStaffingFilterHandlers";
import { useStaffingDragHandlers } from "./useStaffingDragHandlers";

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

interface UseStaffingHandlersParams {
  setFilters: React.Dispatch<React.SetStateAction<StaffingFilters>>;
  setManagerFilter: (val: string) => void;
  setEmployeeLevel: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  setShowAlertsPanel: (val: boolean) => void;
  setShowUtilization: React.Dispatch<React.SetStateAction<boolean>>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedEmployee: (val: Employee | null) => void;
  setShowPlanningModal: (val: boolean) => void;
  setShowCalendarModal: (val: boolean) => void;
  setProfileModalEmployee: (val: Employee | null) => void;
  setProfileModalOpen: (val: boolean) => void;
  setWaterfallModalData: (val: WaterfallModalData | null) => void;
  setWaterfallHover: React.Dispatch<React.SetStateAction<WaterfallHoverData | null>>;
  setGranularity: (val: string) => void;
  setGanttDragOver: (val: boolean) => void;
  resetTimeline: () => void;
  buildWaterfallData: (employees: Employee[]) => WaterfallStep[];
  groupingLevels: string[];
  setGroupingLevels: React.Dispatch<React.SetStateAction<string[]>>;
  filters: StaffingFilters;
  managerFilter: string;
  enrichedGanttData: Employee[];
  filteredEmployees: Employee[];
  uniqueProjects: string[];
}

/**
 * Thin wrapper that delegates to 3 focused sub-hooks and merges their results.
 * Kept for backward compatibility — all callers can continue importing this hook.
 */
export function useStaffingHandlers({
  setFilters,
  setManagerFilter,
  setEmployeeLevel,
  setShowAlertsPanel,
  setShowUtilization,
  setCollapsedGroups,
  setSelectedEmployee,
  setShowPlanningModal,
  setShowCalendarModal,
  setProfileModalEmployee,
  setProfileModalOpen,
  setWaterfallModalData,
  setWaterfallHover,
  setGranularity,
  setGanttDragOver,
  resetTimeline,
  buildWaterfallData,
  groupingLevels,
  setGroupingLevels,
  filters,
  managerFilter,
  enrichedGanttData,
  filteredEmployees,
  uniqueProjects,
}: UseStaffingHandlersParams) {
  const employeeHandlers = useStaffingEmployeeHandlers({
    setFilters,
    setShowAlertsPanel,
    setShowUtilization,
    setCollapsedGroups,
    setSelectedEmployee,
    setShowPlanningModal,
    setShowCalendarModal,
    setProfileModalEmployee,
    setProfileModalOpen,
    setWaterfallModalData,
    setGranularity,
    setEmployeeLevel,
    resetTimeline,
  });

  const filterHandlers = useStaffingFilterHandlers({
    setFilters,
    setManagerFilter,
    setCollapsedGroups,
    setGroupingLevels,
    groupingLevels,
    filters,
    managerFilter,
    enrichedGanttData,
    filteredEmployees,
    uniqueProjects,
  });

  const dragHandlers = useStaffingDragHandlers({
    setGanttDragOver,
    setWaterfallHover,
    buildWaterfallData,
    groupingLevels,
    handleGroupingChange: filterHandlers.handleGroupingChange,
  });

  return {
    ...employeeHandlers,
    ...filterHandlers,
    ...dragHandlers,
  };
}
