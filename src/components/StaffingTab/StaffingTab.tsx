import React, { useMemo, useCallback, useEffect, useRef, lazy, Suspense, useDeferredValue } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

// Hooks
import {
  useTimeline,
  useHolidays,
  useAssignmentEditor,
  useTimelineInteractions,
  useTeamStats,
  useFrozenBatch,
  useStaffingFilters,
  useStaffingModals,
  useExpansionLogic,
  useStaffingEffects,
  usePeriodDetail,
  useStaffingHandlers,
  useEmployeeGrouping,
  useStaffingPipeline,
  useBulkEditPatching,
  useStaffingHydration,
  useStaffingScenarioPip,
  useStaffingAssignDialog,
  useStaffingTimelineContexts,
  useStaffingModalCallbacks,
  useStaffingDragState,
  useStaffingToolbarOffset,
  useStaffingTUTracking,
  useStaffingPostSave,
  useStaffingTurnoverCounts,
} from "./hooks";

// Components
import TUOverview from "./components/Dashboard/TUOverview";
import ErrorBoundary from "../common/ErrorBoundary";
import useScenarioStore from "../../stores/useScenarioStore";
import { readAllStaffingNeeds, assignmentKey } from "./utils/scenarioUtils";
import { getRealEmpId } from "./utils/empIdUtils";
import { ScenarioBanner } from "./components/Scenario";
const ScenarioWorkbench = lazy(() => import("./components/Scenario").then((m) => ({ default: m.ScenarioWorkbench })));
import { TopToolbar } from "./components/Layout/TopToolbar";
import { StaffingModals } from "./components/Layout/StaffingModals";
import { GanttSection } from "./components/Layout/GanttSection";

// Lazy-loaded components
const DebugDataView = lazy(() => import("./components/Debug/DebugDataView"));

// Store
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useComputedStore } from "../../stores/useComputedStore";
import { useAppStore } from "../../stores/useAppStore";
import { useMergedEmployeeData } from "../../hooks/useMergedEmployeeData";
import { useUIStore } from "../../stores/useUIStore";

// Utils
import { recordRenderStep } from "./utils/perf";
import "./utils/ganttBenchmarks"; // expose __ganttPerf() in the dev console
import useResponsive from "../../hooks/useResponsive";
import MobileEmployeeList from "./components/Mobile/MobileEmployeeList";
import type { IncludeExcludeFilter, StaffingRecord, SkillsData } from "./types";
import { animations } from "../../styles/animations";

// ─── Main Staffing Tab component ──────────────────────────────────────────────
const StaffingTab = ({
  sharedData,
  loading: parentLoading,
  onNavigateToTab,
  onNavigateToOpportunity,
  darkMode,
  macroGradeFilter,
  macroCategoryFilter,
  segmentFilter,
  serviceLineFilter,
  segmentModes = new Map(),
  serviceLineModes = new Map(),
}: {
  sharedData: Record<string, any>[];
  loading: boolean;
  onNavigateToTab: (tab: any) => void;
  onNavigateToOpportunity: (jobCode: string) => void;
  darkMode: boolean;
  macroGradeFilter: IncludeExcludeFilter;
  macroCategoryFilter: IncludeExcludeFilter;
  segmentFilter: IncludeExcludeFilter;
  serviceLineFilter: IncludeExcludeFilter;
  segmentModes?: Map<string, string>;
  serviceLineModes?: Map<string, string>;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { isPhone } = useResponsive();

  // ── Local data state (populated by backend hydration) ────────────────────────
  const [data, setData] = React.useState<StaffingRecord[]>([]);
  const [sapData, setSapData] = React.useState<Record<string, any> | null>(null);
  const [skillsData, setSkillsData] = React.useState<Record<string, any> | null>(null);

  const {
    timeframe,
    customDateRange,
    timelineStart,
    timelineEnd,
    labels,
    monthLabels,
    weekendMarkers,
    holidayMarkers,
    dayWidth,
    zoomLevel,
    handleTimeframeChange,
    setCustomDateRangeDirect,
    resetTimeline,
    zoomToMonth,
  } = useTimeline();

  const {
    holidays,
    enabledHolidays,
    enabledHolidayDates,
    toggleHoliday,
    enableAllHolidays,
    disableAllHolidays,
    addCustomHoliday,
    removeCustomHoliday,
  } = useHolidays();

  // ── Hydration from backend ───────────────────────────────────────────────────
  const { baseDataRef } = useStaffingHydration({ data, sapData, skillsData, setData, setSapData, setSkillsData });

  // ── Editor states + modifications toggle ────────────────────────────────────
  const editorStates = useUserDataStore((s) => s.editorStates);
  const modificationsEnabled = useAppStore((s) => s.modificationsEnabled);
  const rawSapLookup = useMemo(() => sapData?.lookup || null, [sapData]);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const {
    filters,
    setFilters,
    granularity,
    setGranularity,
    heatmapMode,
    setHeatmapMode,
    chargeableCombined,
    setChargeableCombined,
    dataSourceDebug,
    setDataSourceDebug,
    managerFilter,
    setManagerFilter,
    hideTeamTU,
    setHideTeamTU,
    showAdvanced,
    setShowAdvanced,
  } = useStaffingFilters();

  const {
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
  } = useStaffingModals();

  // ── Cross-tab navigation filter injection ────────────────────────────────────
  const pendingStaffingFilter = useUIStore((s) => s.pendingStaffingFilter);
  useEffect(() => {
    if (pendingStaffingFilter) {
      setFilters((f) => ({ ...f, searchTags: [...(f.searchTags || []), pendingStaffingFilter] }));
      useUIStore.getState().setPendingStaffingFilter(null);
    }
  }, [pendingStaffingFilter, setFilters]);

  // ── AI-driven staffing view changes ─────────────────────────────────────────
  const lastAiAction = useUIStore((s) => s.lastAiAction);
  useEffect(() => {
    if (!lastAiAction || lastAiAction.action !== "change_staffing_view") return;
    const d = lastAiAction.data as Record<string, any> | undefined;
    if (d?.heatmapMode) setHeatmapMode(d.heatmapMode);
    if (d?.groupBy) setGroupingLevels([d.groupBy]);
    useUIStore.getState().setLastAiAction(null);
  }, [lastAiAction, setHeatmapMode]);

  const { mergedMetadata: employeeMetadata, manualEmployees: manualEmployeesFromStore } = useMergedEmployeeData();

  // ── Drag state + grouping levels ─────────────────────────────────────────────
  const { groupingLevels, setGroupingLevels, isDraggingRef, handleDragComplete } = useStaffingDragState();

  // ── Data pipeline ────────────────────────────────────────────────────────────
  const {
    effectiveMetadata,
    alerts,
    uniqueProjects,
    managerList,
    scenario: { active: activeScenario, assignmentOverrides: activeAssignmentOverrides },
    sap: { lookup: sapLookup, filteredLookup: filteredSapLookup, enrichment: sapEnrichment },
    pipeline: { jobcodes: pipelineJobcodes, oppsList: jobcodeOppsList, ioJobcodes, effectiveIoJobcodes, showIO },
    employees: { structures: employeeStructures, enrichedGantt: enrichedGanttData },
    grid: {
      calendar: timelineCalendar,
      workingDaysCount,
      daily: dailyGrid,
      deferredDaily: deferredDailyGrid,
      employeesWithRates,
      useSapActuals,
    },
    filtered: {
      employees: filteredEmployees,
      allForTrend: allEmployeesForTrend,
      stableCount: stableEmpCount,
      displayed: displayedEmployees,
      effectiveGrid: effectiveDailyGrid,
      teamNetHours,
      uniqueProjectCount,
    },
  } = useStaffingPipeline({
    data,
    baseData: baseDataRef.current,
    editorStates,
    modificationsEnabled,
    rawSapLookup,
    sapData,
    enabledHolidayDates,
    employeeMetadata,
    manualEmployeesFromStore,
    skillsData: skillsData as SkillsData | null,
    timelineStart,
    timelineEnd,
    sharedData,
    segmentFilter,
    segmentModes,
    serviceLineFilter,
    serviceLineModes,
    filters,
    macroGradeFilter,
    macroCategoryFilter,
    managerFilter,
    groupingLevels,
    heatmapMode,
    chargeableCombined,
    dataSourceDebug,
    isDraggingRef,
  });

  // ── Publish dailyGrid to global store (for NeedsBoardV2 supply calc) ────────
  useEffect(() => {
    if (!dailyGrid || !timelineCalendar) return;
    const calIndex = new Map<string, number>();
    timelineCalendar.forEach((day, i) => {
      if (day.dateStr) calIndex.set(day.dateStr, i);
    });
    useComputedStore.getState().setDailyGrid(dailyGrid, timelineCalendar, calIndex);
  }, [dailyGrid, timelineCalendar]);

  // Scenario store selectors used by event handlers (not in pipeline)
  const upsertAssignmentOverrideDirect = useScenarioStore((s) => s.upsertAssignmentOverride);
  const removeAssignmentOverrideDirect = useScenarioStore((s) => s.removeAssignmentOverride);

  // ── Scenario PiP + Optimizer ─────────────────────────────────────────────────
  const {
    openPipScenarioIds,
    allScenarios,
    pipOpen,
    togglePipForActiveScenario,
    openPipForScenario,
    closePip,
    needsBoardOpen,
    toggleNeedsBoard,
    optimizerOpen,
    handleOpenOptimizer,
    handleCloseOptimizer,
    handleApplyProposal,
  } = useStaffingScenarioPip({ activeScenario, editorStates, enrichedGanttData });

  // ── Staffing needs for TU Trend ──────────────────────────────────────────────
  const storeNeedsMap = useUserDataStore((s) => s.staffingNeeds);
  const globalFilteredOppIds = useAppStore((s) => s.filteredOppIds);
  const staffingNeeds = useMemo(() => {
    const needs = readAllStaffingNeeds();
    const filtered =
      globalFilteredOppIds.size > 0 ? needs.filter((n) => globalFilteredOppIds.has(n.opportunityId)) : needs;
    return filtered.length > 0 ? filtered : null;
  }, [storeNeedsMap, globalFilteredOppIds]);

  // ── Open opportunity detail modal ────────────────────────────────────────────
  const handleOpenOpportunityModal = useCallback(
    (jobNo: string) => {
      if (!sharedData || sharedData.length === 0) return;
      const key = String(jobNo).trim();
      const opp = sharedData.find((o: Record<string, any>) => {
        const jc = o.Jobcode || o.JobCode || o.jobCode || o.ProjectCode;
        if (jc && String(jc).trim() === key) return true;
        return o.opportunityId && String(o.opportunityId).trim() === key;
      });
      if (opp) setOpportunityModalRow(opp);
    },
    [sharedData]
  );

  // ── Deferred values for non-urgent components ────────────────────────────────
  const {
    timelineStart: deferredTimelineStart,
    timelineEnd: deferredTimelineEnd,
    customDateRange: deferredCustomDateRange,
    filteredEmployees: deferredFilteredEmployees,
    projectCount: deferredProjectCount,
    enabledHolidayDates: deferredEnabledHolidayDates,
  } = useFrozenBatch(
    {
      timelineStart,
      timelineEnd,
      customDateRange,
      zoomLevel,
      filteredEmployees,
      projectCount: uniqueProjectCount,
      enabledHolidayDates,
      sapLookup,
      displayedEmployees,
    },
    isDraggingRef
  );

  // ── Turnover counts for MonthHeaderBar badges ────────────────────────────────
  const { gradeTransitionCounts, arrivalCounts, departureCounts } = useStaffingTurnoverCounts({
    displayedEmployees,
    timelineStart,
  });

  // ── Assignment editor ────────────────────────────────────────────────────────
  const {
    handleDeleteAssignment,
    handleRevertAssignment,
    handleToggleCategory,
    handleDragEnd,
    handleBulkSaveAssignment,
  } = useAssignmentEditor(setData, data, enrichedGanttData);

  // ── Reassign: move an assigned person from one scenario slot to another ──────
  const handleReassign = useCallback(
    (
      sourceOverrideKey: string,
      target: { empId: string; jobNo: string; startDate: string; endDate: string; needId: string }
    ) => {
      const sourceOverride = activeAssignmentOverrides?.[sourceOverrideKey];
      if (!sourceOverride) return;
      const srcData = sourceOverride.data || {};
      removeAssignmentOverrideDirect(sourceOverrideKey);
      const newKey = assignmentKey(target.empId, target.jobNo, target.startDate);
      upsertAssignmentOverrideDirect(newKey, {
        type: "create",
        data: {
          empId: target.empId,
          jobNo: target.jobNo,
          startDate: target.startDate,
          endDate: target.endDate,
          utilization: srcData.utilization || 100,
          firstName: srcData.firstName || "",
          lastName: srcData.lastName || "",
          needId: target.needId,
        },
      });
    },
    [activeAssignmentOverrides, removeAssignmentOverrideDirect, upsertAssignmentOverrideDirect]
  );

  // ── Timeline interactions + toolbar offset ───────────────────────────────────
  const { handleMonthBarMouseDown, ganttRefCallback } = useTimelineInteractions(
    timelineStart,
    timelineEnd,
    setCustomDateRangeDirect,
    filteredEmployees,
    isDraggingRef,
    handleDragComplete
  );

  const { toolbarWrapperRef, timelineSentinelRef, timelineHeaderTop } = useStaffingToolbarOffset();

  // ── Bulk edit coordination ───────────────────────────────────────────────────
  const {
    bulkEditOpenSet,
    bulkCancelAllSignal,
    handleBulkEditChange,
    handleBulkCancelAll,
    handleBulkLiveCells,
    aggregateGrid,
    aggregateEmployees,
    effectiveFilteredEmployees,
    patchedAllEmployeesForTrend,
  } = useBulkEditPatching({
    effectiveDailyGrid,
    displayedEmployees,
    deferredFilteredEmployees,
    allEmployeesForTrend,
    timelineStart,
    timelineEnd,
  });
  const effectiveAllEmployeesForTrend = useDeferredValue(patchedAllEmployeesForTrend);

  // ── Team stats ───────────────────────────────────────────────────────────────
  const { teamTuStats, gradeItems, buildWaterfallData } = useTeamStats(
    effectiveFilteredEmployees,
    heatmapMode,
    deferredDailyGrid,
    effectiveIoJobcodes,
    timelineStart,
    timelineEnd,
    effectiveMetadata
  );
  const { teamTuStats: deferredTeamTuStats, gradeItems: deferredGradeItems } = useFrozenBatch(
    { teamTuStats, gradeItems },
    isDraggingRef
  );

  // ── Real TU tracking for scenario delta banner ───────────────────────────────
  const { realTURef, aggVarianceRef, handleAggVarianceComputed } = useStaffingTUTracking({
    activeScenario,
    currentTU: teamTuStats.currentTU || 0,
  });

  // ── Grouping + Expansion logic ───────────────────────────────────────────────
  const groupedEmployees = useEmployeeGrouping(displayedEmployees, groupingLevels);
  const {
    employeeLevel,
    setEmployeeLevel,
    collapsedGroups,
    setCollapsedGroups,
    handleProgressiveExpand,
    handleProgressiveCollapse,
    handleScopedExpand,
    handleScopedCollapse,
  } = useExpansionLogic(displayedEmployees, groupedEmployees);

  // ── Assign dialog + bulk-edit prefill ────────────────────────────────────────
  const {
    bulkEditPrefill,
    setBulkEditPrefill,
    assignDialogPrefill,
    setAssignDialogPrefill,
    assignDialogEmployee,
    handleOpenBulkEditWithPrefill,
    handleAssignDialogClose,
    handleDropNeedOnEmployee,
  } = useStaffingAssignDialog({ employeeStructures, setEmployeeLevel });

  // ── Period detail handler ─────────────────────────────────────────────────────
  const { handlePeriodClick } = usePeriodDetail({
    displayedEmployees,
    effectiveDailyGrid,
    timelineCalendar,
    chargeableCombined,
    dataSourceDebug,
    useSapActuals,
    jobcodeOppsList,
    setPeriodDetailModal,
  });

  // ── All handlers ──────────────────────────────────────────────────────────────
  const {
    handleEmployeeNameClick,
    handleShowWaterfall,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleResetView,
    handleSearchChange,
    handleAutoSortToggle,
    handleToggleEmployee,
    handleToggleUtilization,
    handleToggleGroup,
    handleNavigateToEmployee,
    handleViewPlanning,
    handleViewCalendar,
    handleUtilizationBucketClick,
    handleGradeTierClick,
    activeUtilizationBucket,
    activeGradeTier,
    handleWaterfallEnter,
    handleWaterfallMove,
    handleWaterfallLeave,
    updateFilter,
    cascadeOptions,
    handleCascadeChange,
    handleCascadeRemove,
    addCascadeFilter,
    handleGroupingChange,
    handleSortOrderToggle,
    handleDmGroupingToggle,
    handleDispoRangeChange,
    handleGanttDragOver,
    handleGanttDragLeave,
    handleGanttDrop,
    handleGroupDragOut,
    filterSummary,
    removeActiveFilter,
    clearAllFilters,
    hasActiveFilters,
  } = useStaffingHandlers({
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
  });

  // ── Side effects: store sync, localStorage, event listeners ─────────────────
  useStaffingEffects(enrichedGanttData, heatmapMode, dataSourceDebug, setHeatmapMode, setShowDebug);

  // ── Post-save scroll & highlight ─────────────────────────────────────────────
  const { justSavedEmpId, clearJustSaved, wrappedBulkSave } = useStaffingPostSave({
    modificationsEnabled,
    employeeLevel,
    handleBulkSaveAssignment,
  });

  // ── Modal close callbacks + derived values + employee counts ──────────
  const {
    handleCloseAlerts,
    handleClosePlanning,
    handleCloseCalendar,
    handleCloseWaterfall,
    handleCloseProfile,
    handleClosePeriodDetail,
    handleCloseScenarioCreate,
    handleCloseScenarioCompare,
    handleCloseOpportunityModal,
    isManualEmployee,
    profileExistingMetadata,
    profileSapGradeHistory,
    profileEmployeeNames,
    countUniqueInTimeline,
  } = useStaffingModalCallbacks({
    setShowAlertsPanel,
    setShowPlanningModal,
    setShowCalendarModal,
    setSelectedEmployee,
    setWaterfallModalData,
    setProfileModalOpen,
    setProfileModalEmployee,
    setPeriodDetailModal,
    setScenarioCreateOpen,
    setScenarioCompareOpen,
    setOpportunityModalRow,
    profileModalEmployee,
    effectiveMetadata,
    sapEnrichment,
    employeeStructures,
    timelineStart,
    timelineEnd,
  });

  const displayedEmployeeCount = useMemo(
    () => countUniqueInTimeline(displayedEmployees),
    [countUniqueInTimeline, displayedEmployees]
  );
  const totalEmployeeCount = useMemo(
    () => countUniqueInTimeline(employeesWithRates),
    [countUniqueInTimeline, employeesWithRates]
  );
  const filteredEmployeeCount = useMemo(
    () => countUniqueInTimeline(filteredEmployees),
    [countUniqueInTimeline, filteredEmployees]
  );

  // ── Project options ───────────────────────────────────────────────────────────
  const projectOpts = useMemo(() => uniqueProjects.map((p) => ({ value: p, label: p })), [uniqueProjects]);

  // ── Timeline context values ───────────────────────────────────────────────────
  // IMPORTANT: must be declared BEFORE any conditional early returns (Rules of Hooks)
  const { timelineGeometryValue, timelineDataValue, timelineSignalsValue, timelineHandlersValue } =
    useStaffingTimelineContexts({
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
      filtersShowDetails: filters.showDetails !== false,
      bulkCancelAllSignal,
      justSavedEmpId,
      onDeleteAssignment: handleDeleteAssignment,
      onRevertAssignment: handleRevertAssignment,
      onHeatmapDateRangeSelect: handlePeriodClick,
      onNavigateToTab,
      onNavigateToOpportunity: handleOpenOpportunityModal,
      onNameClick: handleEmployeeNameClick,
      onToggleCategory: handleToggleCategory,
      onDropNeed: handleDropNeedOnEmployee,
      onDragEnd: handleDragEnd,
      onBulkSaveAssignment: wrappedBulkSave,
      onViewPlanning: handleViewPlanning,
      onViewCalendar: handleViewCalendar,
      onBulkEditChange: handleBulkEditChange,
      clearJustSaved,
    });

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 64, color: "text.disabled" }} />
        <Typography variant="h6" color="text.secondary">
          No staffing data
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Staffing data is loaded automatically from the backend during hydration.
        </Typography>
      </Box>
    );
  }

  const groupRenderProps = groupedEmployees
    ? {
        groupingLevels,
        collapsedGroups,
        onToggleGroup: handleToggleGroup,
        onGroupDragOut: handleGroupDragOut,
        teamTuStats,
        onWaterfallEnter: handleWaterfallEnter,
        onWaterfallMove: handleWaterfallMove,
        onWaterfallLeave: handleWaterfallLeave,
        dailyGrid: effectiveDailyGrid,
        employeeLevel,
        teamNetHours,
        onToggleEmployee: handleToggleEmployee,
        onScopedExpand: handleScopedExpand,
        onScopedCollapse: handleScopedCollapse,
        hideTeamTU,
        draggable: !!activeScenario || needsBoardOpen,
      }
    : null;

  // ── Mobile render ──────────────────────────────────────────────────────────────
  if (isPhone) {
    return (
      <Box sx={{ height: "100%" }}>
        <MobileEmployeeList
          employees={filteredEmployees}
          dailyGrid={dailyGrid}
          timelineStart={timelineStart}
          timelineEnd={timelineEnd}
          enabledHolidayDates={enabledHolidayDates}
          heatmapMode={heatmapMode}
          searchValue={filters.search || ""}
          onSearchChange={handleSearchChange}
          onPeriodClick={
            handlePeriodClick ? (empId, startDate, endDate) => handlePeriodClick(empId, startDate, endDate) : undefined
          }
        />
      </Box>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────────
  return (
    <Box>
      <ErrorBoundary>
        {!showDebug && (
          <>
            <React.Profiler id="TopToolbar" onRender={recordRenderStep}>
              <TopToolbar
                toolbarRef={toolbarWrapperRef}
                timelineSentinelRef={timelineSentinelRef}
                timelineHeaderTop={timelineHeaderTop}
                timeframe={timeframe}
                customDateRange={deferredCustomDateRange}
                onTimeframeChange={handleTimeframeChange}
                timelineStart={deferredTimelineStart}
                timelineEnd={deferredTimelineEnd}
                setCustomDateRangeDirect={setCustomDateRangeDirect}
                resetTimeline={resetTimeline}
                granularity={granularity}
                onGranularityChange={setGranularity}
                heatmapMode={heatmapMode}
                onHeatmapModeChange={setHeatmapMode}
                chargeableCombined={chargeableCombined}
                onChargeableCombinedChange={setChargeableCombined}
                dataSourceDebug={dataSourceDebug}
                onDataSourceDebugChange={setDataSourceDebug}
                searchValue={filters.search}
                onSearchChange={handleSearchChange}
                searchScope={filters.searchScope || ""}
                onSearchScopeChange={(scope) => setFilters((f) => ({ ...f, searchScope: scope }))}
                searchEmployees={employeesWithRates}
                searchTags={filters.searchTags || []}
                onSearchTagsChange={(tags) => setFilters((f) => ({ ...f, searchTags: tags }))}
                onReset={handleResetView}
                hasSapData={!!sapData}
                autoSort={filters.autoSort !== false}
                onAutoSortToggle={handleAutoSortToggle}
                pipelineJobcodes={pipelineJobcodes}
              />
            </React.Profiler>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <React.Profiler id="TUOverview" onRender={recordRenderStep}>
                <TUOverview
                  teamTuStats={deferredTeamTuStats}
                  filteredEmployees={effectiveFilteredEmployees}
                  gradeItems={deferredGradeItems}
                  sapData={sapData}
                  onWaterfallEnter={handleWaterfallEnter}
                  onWaterfallMove={handleWaterfallMove}
                  onWaterfallLeave={handleWaterfallLeave}
                  onUtilizationBucketClick={handleUtilizationBucketClick}
                  activeUtilizationBucket={activeUtilizationBucket}
                  onGradeTierClick={handleGradeTierClick}
                  activeGradeTier={activeGradeTier}
                  timelineStart={deferredTimelineStart}
                  timelineEnd={deferredTimelineEnd}
                  chargeableCombined={chargeableCombined}
                  enabledHolidayDates={deferredEnabledHolidayDates}
                  sapLookup={dataSourceDebug === "mds" ? null : sapLookup}
                  fullSapLookup={sapLookup}
                  projectCount={deferredProjectCount}
                  granularity={granularity}
                  heatmapMode={heatmapMode}
                  employeeMetadata={effectiveMetadata}
                  allEmployees={effectiveAllEmployeesForTrend}
                  ioJobcodes={effectiveIoJobcodes}
                  pipelineJobcodes={pipelineJobcodes}
                  staffingNeeds={staffingNeeds}
                  showIO={showIO}
                  useSapActuals={useSapActuals}
                  onDateRangeChange={setCustomDateRangeDirect}
                  dailyGrid={aggregateGrid}
                  aggVarianceHours={aggVarianceRef.current}
                />
              </React.Profiler>

              {activeScenario && (
                <ScenarioBanner
                  deltaTU={(teamTuStats.currentTU || 0) - realTURef.current}
                  realTU={realTURef.current}
                  scenarioTU={teamTuStats.currentTU || 0}
                />
              )}

              {activeScenario && (
                <Suspense fallback={null}>
                  <ScenarioWorkbench
                    employees={employeeStructures}
                    pipelineJobcodes={pipelineJobcodes}
                    onOpenAssignmentModal={handleOpenBulkEditWithPrefill}
                  />
                </Suspense>
              )}

              <GanttSection
                displayedEmployeeCount={displayedEmployeeCount}
                totalEmployeeCount={totalEmployeeCount}
                hasActiveFilters={hasActiveFilters}
                filters={filters}
                updateFilter={updateFilter}
                projectOpts={projectOpts}
                groupingLevels={groupingLevels}
                onGroupingChange={handleGroupingChange}
                collapsedGroups={collapsedGroups}
                setCollapsedGroups={setCollapsedGroups}
                groupedEmployees={groupedEmployees}
                managerFilter={managerFilter}
                setManagerFilter={setManagerFilter}
                managerList={managerList}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                cascadeOptions={cascadeOptions}
                handleCascadeChange={handleCascadeChange}
                handleCascadeRemove={handleCascadeRemove}
                addCascadeFilter={addCascadeFilter}
                filterSummary={filterSummary}
                removeActiveFilter={removeActiveFilter}
                clearAllFilters={clearAllFilters}
                holidays={holidays}
                enabledHolidays={enabledHolidays}
                toggleHoliday={toggleHoliday}
                enableAllHolidays={enableAllHolidays}
                disableAllHolidays={disableAllHolidays}
                addCustomHoliday={addCustomHoliday}
                removeCustomHoliday={removeCustomHoliday}
                heatmapMode={heatmapMode}
                hasSapData={!!sapData}
                setScenarioCreateOpen={setScenarioCreateOpen}
                setScenarioCompareOpen={setScenarioCompareOpen}
                pipOpen={pipOpen}
                togglePipForActiveScenario={togglePipForActiveScenario}
                needsBoardOpen={needsBoardOpen}
                toggleNeedsBoard={toggleNeedsBoard}
                setFilters={setFilters}
                deferredTimelineStart={deferredTimelineStart}
                deferredTimelineEnd={deferredTimelineEnd}
                setCustomDateRangeDirect={setCustomDateRangeDirect}
                resetTimeline={resetTimeline}
                workingDaysCount={workingDaysCount}
                timelineSentinelRef={timelineSentinelRef}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                displayedEmployees={displayedEmployees}
                timelineHeaderTop={timelineHeaderTop}
                handleMonthBarMouseDown={handleMonthBarMouseDown}
                handleProgressiveExpand={handleProgressiveExpand}
                handleProgressiveCollapse={handleProgressiveCollapse}
                handleSortOrderToggle={handleSortOrderToggle}
                handleDmGroupingToggle={handleDmGroupingToggle}
                handleDispoRangeChange={handleDispoRangeChange}
                zoomToMonth={zoomToMonth}
                hideTeamTU={hideTeamTU}
                setHideTeamTU={setHideTeamTU}
                sapLookup={sapLookup}
                segmentFilter={segmentFilter}
                serviceLineFilter={serviceLineFilter}
                modificationsEnabled={modificationsEnabled}
                bulkEditOpenSet={bulkEditOpenSet}
                handleBulkCancelAll={handleBulkCancelAll}
                gradeTransitionCounts={gradeTransitionCounts}
                arrivalCounts={arrivalCounts}
                departureCounts={departureCounts}
                aggregateEmployees={aggregateEmployees}
                timelineCalendar={timelineCalendar}
                aggregateGrid={aggregateGrid}
                granularity={granularity}
                chargeableCombined={chargeableCombined}
                teamTuStats={teamTuStats}
                enabledHolidayDates={enabledHolidayDates}
                handlePeriodClick={handlePeriodClick}
                filteredSapLookup={filteredSapLookup}
                showIO={showIO}
                useSapActuals={useSapActuals}
                stableEmpCount={stableEmpCount}
                handleAggVarianceComputed={handleAggVarianceComputed}
                ganttRefCallback={ganttRefCallback}
                handleGanttDragOver={handleGanttDragOver}
                handleGanttDragLeave={handleGanttDragLeave}
                handleGanttDrop={handleGanttDrop}
                ganttDragOver={ganttDragOver}
                effectiveDailyGrid={effectiveDailyGrid}
                employeeLevel={employeeLevel}
                handleToggleEmployee={handleToggleEmployee}
                activeScenario={activeScenario}
                teamNetHours={teamNetHours}
                handleBulkLiveCells={handleBulkLiveCells}
                bulkEditPrefill={bulkEditPrefill}
                setBulkEditPrefill={setBulkEditPrefill}
                filteredEmployees={filteredEmployees}
                groupRenderProps={groupRenderProps}
                timelineGeometryValue={timelineGeometryValue}
                timelineDataValue={timelineDataValue}
                timelineSignalsValue={timelineSignalsValue}
                timelineHandlersValue={timelineHandlersValue}
                assignDialogEmployee={assignDialogEmployee}
                assignDialogPrefill={assignDialogPrefill}
                handleAssignDialogClose={handleAssignDialogClose}
                setAssignDialogPrefill={setAssignDialogPrefill}
                setProfileModalEmployee={setProfileModalEmployee}
                setProfileModalOpen={setProfileModalOpen}
              />
            </Box>
          </>
        )}

        {showDebug && (
          <Suspense
            fallback={
              <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, bgcolor: "background.paper", overflow: "hidden" }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box sx={{ height: 24, borderRadius: 1, width: "40%", ...animations.shimmerLoading }} />
                  <Box sx={{ height: 120, borderRadius: 2, ...animations.shimmerLoading }} />
                  <Box sx={{ height: 16, borderRadius: 1, width: "60%", ...animations.shimmerLoading }} />
                </Box>
              </Paper>
            }
          >
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, bgcolor: "background.paper", mb: 2 }}>
              <DebugDataView rawData={data} sapData={sapData} />
            </Paper>
          </Suspense>
        )}
      </ErrorBoundary>

      <StaffingModals
        alerts={alerts}
        showAlertsPanel={showAlertsPanel}
        onCloseAlerts={handleCloseAlerts}
        onNavigateToEmployee={handleNavigateToEmployee}
        showPlanningModal={showPlanningModal}
        onClosePlanning={handleClosePlanning}
        showCalendarModal={showCalendarModal}
        onCloseCalendar={handleCloseCalendar}
        selectedEmployee={selectedEmployee}
        waterfallModalData={waterfallModalData}
        onCloseWaterfall={handleCloseWaterfall}
        profileModalOpen={profileModalOpen}
        onCloseProfile={handleCloseProfile}
        profileModalEmployee={profileModalEmployee}
        onSaveEmployee={handleSaveEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        isManualEmployee={isManualEmployee}
        onShowWaterfall={handleShowWaterfall}
        existingMetadata={profileExistingMetadata}
        sapGradeHistory={profileSapGradeHistory}
        employeeNames={profileEmployeeNames}
        internToAnalystMapping={sapEnrichment?.internToAnalyst}
        allSapGradeResults={sapEnrichment?.gradeResults}
        periodDetailModal={periodDetailModal}
        onClosePeriodDetail={handleClosePeriodDetail}
        scenarioCreateOpen={scenarioCreateOpen}
        onCloseScenarioCreate={handleCloseScenarioCreate}
        scenarioCompareOpen={scenarioCompareOpen}
        onCloseScenarioCompare={handleCloseScenarioCompare}
        data={data}
        effectiveMetadata={effectiveMetadata}
        enabledHolidayDates={enabledHolidayDates}
        realTU={realTURef.current || teamTuStats.currentTU || 0}
        realChH={(teamTuStats.totalChOnly || 0) + (teamTuStats.totalGO || 0)}
        realNetH={teamTuStats.totalNet || 0}
        filteredEmployeeCount={filteredEmployeeCount}
        openPipScenarioIds={openPipScenarioIds}
        allScenarios={allScenarios}
        activeScenarioId={activeScenario?.id}
        onClosePip={closePip}
        onOpenBulkEditWithPrefill={activeScenario ? handleOpenBulkEditWithPrefill : undefined}
        onReassign={activeScenario ? handleReassign : undefined}
        pipelineJobcodes={pipelineJobcodes}
        ioJobcodes={ioJobcodes}
        enrichedGanttData={enrichedGanttData}
        onOpenScenario={openPipForScenario}
        realTURef={realTURef.current || 0}
        scenarioTU={teamTuStats.currentTU || 0}
        onOpenOptimizer={activeScenario ? handleOpenOptimizer : undefined}
        optimizerOpen={optimizerOpen}
        onCloseOptimizer={handleCloseOptimizer}
        onApplyProposal={handleApplyProposal}
        currentTeamTU={teamTuStats.currentTU || 0}
        currentTeamNetH={teamTuStats.totalNet || 0}
        currentTeamChH={(teamTuStats.totalChOnly || 0) + (teamTuStats.totalGO || 0)}
        opportunityModalRow={opportunityModalRow}
        onCloseOpportunityModal={handleCloseOpportunityModal}
      />

      {/* NeedsBoardV2 PiP moved to App.tsx (global, cross-tab) */}
    </Box>
  );
};

export default StaffingTab;
