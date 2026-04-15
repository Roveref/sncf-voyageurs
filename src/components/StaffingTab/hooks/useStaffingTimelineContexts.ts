import { useMemo } from "react";
import type {
  TimelineGeometryContextType,
  TimelineDataContextType,
  TimelineHandlersContextType,
} from "../contexts/TimelineContext";

interface UseStaffingTimelineContextsArgs {
  // Geometry
  timelineStart: Date;
  timelineEnd: Date;
  timelineCalendar: any[];
  granularity: string;
  dayWidth: number;
  weekendMarkers: any[];
  holidayMarkers: any[];
  labels: any[];
  monthLabels: any[];
  // Data
  heatmapMode: string;
  chargeableCombined: boolean;
  enabledHolidayDates: Set<string>;
  showUtilization: boolean;
  dataSourceDebug: string;
  filteredSapLookup: any;
  sapLookup: any;
  useSapActuals: boolean;
  pipelineJobcodes: any;
  jobcodeOppsList: any;
  ioJobcodes: any;
  showIO: string;
  filtersShowDetails: boolean;
  // Signals
  bulkCancelAllSignal: number;
  justSavedEmpId: string | null;
  // Handlers
  onDeleteAssignment: (a: any) => void;
  onRevertAssignment: (a: any) => void;
  onHeatmapDateRangeSelect: (start: any, end: any, target?: any) => void;
  onNavigateToTab: (tab: any) => void;
  onNavigateToOpportunity: (jobNo: string) => void;
  onNameClick: (emp: any) => void;
  onToggleCategory: (...args: any[]) => void;
  onDropNeed: (empId: string, needData: any) => void;
  onDragEnd: (result: any) => void;
  onBulkSaveAssignment: (empId: string, ops: any[]) => void;
  onViewPlanning: (emp: any) => void;
  onViewCalendar: (emp: any) => void;
  onBulkEditChange?: (empId: string, open: boolean) => void;
  clearJustSaved?: () => void;
}

/**
 * Builds the four memoized Timeline context value objects used by
 * TimelineGeometryProvider, TimelineDataProvider, TimelineSignalsProvider
 * and TimelineHandlersProvider inside GanttSection.
 */
export function useStaffingTimelineContexts({
  timelineStart,
  timelineEnd,
  timelineCalendar,
  granularity,
  dayWidth,
  weekendMarkers,
  holidayMarkers,
  labels,
  monthLabels,
  heatmapMode,
  chargeableCombined,
  enabledHolidayDates,
  showUtilization,
  dataSourceDebug,
  filteredSapLookup,
  sapLookup,
  useSapActuals,
  pipelineJobcodes,
  jobcodeOppsList,
  ioJobcodes,
  showIO,
  filtersShowDetails,
  bulkCancelAllSignal,
  justSavedEmpId,
  onDeleteAssignment,
  onRevertAssignment,
  onHeatmapDateRangeSelect,
  onNavigateToTab,
  onNavigateToOpportunity,
  onNameClick,
  onToggleCategory,
  onDropNeed,
  onDragEnd,
  onBulkSaveAssignment,
  onViewPlanning,
  onViewCalendar,
  onBulkEditChange,
  clearJustSaved,
}: UseStaffingTimelineContextsArgs) {
  const timelineGeometryValue = useMemo(
    (): TimelineGeometryContextType => ({
      timelineStart,
      timelineEnd,
      calendar: timelineCalendar,
      granularity: granularity as TimelineGeometryContextType["granularity"],
      dayWidth,
      weekendMarkers,
      holidayMarkers,
      labels,
      monthLabels,
    }),
    [
      timelineStart,
      timelineEnd,
      timelineCalendar,
      granularity,
      dayWidth,
      weekendMarkers,
      holidayMarkers,
      labels,
      monthLabels,
    ]
  );

  const timelineDataValue = useMemo(
    (): TimelineDataContextType => ({
      heatmapMode,
      chargeableCombined,
      enabledHolidayDates,
      showUtilization,
      sapLookup: dataSourceDebug === "mds" ? null : (filteredSapLookup ?? sapLookup),
      useSapActuals,
      pipelineJobcodes,
      jobcodeOppsList,
      ioJobcodes,
      showIO,
      showDetails: filtersShowDetails !== false,
    }),
    [
      heatmapMode,
      chargeableCombined,
      enabledHolidayDates,
      showUtilization,
      filteredSapLookup,
      sapLookup,
      useSapActuals,
      pipelineJobcodes,
      jobcodeOppsList,
      ioJobcodes,
      showIO,
      filtersShowDetails,
    ]
  );

  const timelineSignalsValue = useMemo(
    () => ({ bulkCancelAllSignal, justSavedEmpId }),
    [bulkCancelAllSignal, justSavedEmpId]
  );

  const timelineHandlersValue = useMemo(
    (): TimelineHandlersContextType => ({
      onDeleteAssignment,
      onRevertAssignment,
      onHeatmapDateRangeSelect,
      onNavigateToTab,
      onNavigateToOpportunity,
      onNameClick,
      onToggleCategory,
      onDropNeed,
      onDragEnd,
      onBulkSaveAssignment,
      onViewPlanning,
      onViewCalendar,
      onBulkEditChange,
      clearJustSaved,
    }),
    [
      onDeleteAssignment,
      onRevertAssignment,
      onHeatmapDateRangeSelect,
      onNavigateToTab,
      onNavigateToOpportunity,
      onNameClick,
      onDropNeed,
      onToggleCategory,
      onDragEnd,
      onBulkSaveAssignment,
      onViewPlanning,
      onViewCalendar,
      onBulkEditChange,
      clearJustSaved,
    ]
  );

  return {
    timelineGeometryValue,
    timelineDataValue,
    timelineSignalsValue,
    timelineHandlersValue,
  };
}
