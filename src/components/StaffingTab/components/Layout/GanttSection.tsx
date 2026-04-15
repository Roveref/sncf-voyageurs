import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import GroupIcon from "@mui/icons-material/Group";
import AddIcon from "@mui/icons-material/Add";
import { DetachableCard } from "../../../../components/shared";
import { PiPWrapper } from "../../../shared";
import {
  TimelineGeometryProvider,
  TimelineDataProvider,
  TimelineHandlersProvider,
  TimelineSignalsProvider,
} from "../../contexts/TimelineContext";
import type {
  TimelineGeometryContextType,
  TimelineDataContextType,
  TimelineHandlersContextType,
} from "../../contexts/TimelineContext";
import { EmployeeRow, AggregateHeatmapStrip } from "../Employee";

import GroupedEmployeeList from "../Employee/GroupedEmployeeList";
import { TodayLine, MonthHeaderBar, TimelineCrosshair } from "../Timeline/TimelineHeader";
import { FilterHeader } from "./FilterHeader";
import { StickyTimelineHeader } from "./StickyTimelineHeader";
import { recordRenderStep } from "../../utils/perf";
import { GANTT_LEFT_COL_WIDTH, GANTT_RIGHT_PADDING, MAX_EMPLOYEES_DISPLAY } from "../../constants";
import { setCrosshairRange } from "../../hooks/useCrosshairSync";
import { countUniqueReal } from "../../utils/empIdUtils";
import { keyframes, easing } from "../../../../styles/animations";
import type { Employee, DailyCell, EmployeeGridMetrics } from "../../types";

// Gap between employee rows (px)
const ROW_GAP = 12;

interface GanttSectionProps {
  // FilterHeader props
  displayedEmployeeCount: number;
  totalEmployeeCount: number;
  hasActiveFilters: boolean;
  filters: any;
  updateFilter: any;
  projectOpts: { value: string; label: string }[];
  groupingLevels: string[];
  onGroupingChange: any;
  collapsedGroups: any;
  setCollapsedGroups: any;
  groupedEmployees: any;
  managerFilter: any;
  setManagerFilter: any;
  managerList: any;
  showAdvanced: boolean;
  setShowAdvanced: any;
  cascadeOptions: any;
  handleCascadeChange: any;
  handleCascadeRemove: any;
  addCascadeFilter: any;
  filterSummary: any;
  removeActiveFilter: any;
  clearAllFilters: any;
  holidays: any;
  enabledHolidays: any;
  toggleHoliday: any;
  enableAllHolidays: any;
  disableAllHolidays: any;
  addCustomHoliday: any;
  removeCustomHoliday: any;
  heatmapMode: string;
  hasSapData: boolean;
  setScenarioCreateOpen: (v: boolean) => void;
  setScenarioCompareOpen: (v: boolean) => void;
  pipOpen: boolean;
  togglePipForActiveScenario: () => void;
  needsBoardOpen: boolean;
  toggleNeedsBoard: () => void;
  setFilters: any;
  deferredTimelineStart: any;
  deferredTimelineEnd: any;
  setCustomDateRangeDirect: any;
  resetTimeline: any;
  workingDaysCount: number;
  // Timeline sentinel
  timelineSentinelRef: React.RefObject<HTMLDivElement | null>;
  // Crosshair / timeline
  timelineStart: any;
  timelineEnd: any;
  displayedEmployees: Employee[];
  // Sticky header
  timelineHeaderTop: number;
  handleMonthBarMouseDown: any;
  handleProgressiveExpand: any;
  handleProgressiveCollapse: any;
  handleSortOrderToggle: any;
  handleDmGroupingToggle: any;
  handleDispoRangeChange: any;
  zoomToMonth: any;
  hideTeamTU: boolean;
  setHideTeamTU: any;
  sapLookup: any;
  segmentFilter: any;
  serviceLineFilter: any;
  modificationsEnabled: string;
  bulkEditOpenSet: Set<string>;
  handleBulkCancelAll: any;
  gradeTransitionCounts: any;
  arrivalCounts: any;
  departureCounts: any;
  // AggregateHeatmapStrip
  aggregateEmployees: any;
  timelineCalendar: any;
  aggregateGrid: any;
  granularity: string;
  chargeableCombined: boolean;
  teamTuStats: any;
  enabledHolidayDates: Set<string>;
  handlePeriodClick: any;
  filteredSapLookup: any;
  showIO: any;
  useSapActuals: boolean;
  stableEmpCount: number;
  handleAggVarianceComputed: (v: number) => void;
  // Employee list
  ganttRefCallback: any;
  handleGanttDragOver: any;
  handleGanttDragLeave: any;
  handleGanttDrop: any;
  ganttDragOver: boolean;
  effectiveDailyGrid: Map<string, { cells: DailyCell[] }>;
  employeeLevel: Map<string, number>;
  handleToggleEmployee: any;
  activeScenario: any;
  teamNetHours: number;
  handleBulkLiveCells: (
    empId: string,
    cells: DailyCell[] | null,
    metrics?: EmployeeGridMetrics,
    liveAssignments?: any[] | null
  ) => void;
  bulkEditPrefill: any;
  setBulkEditPrefill: any;
  filteredEmployees: Employee[];
  // Grouped list props
  groupRenderProps: any;
  // Timeline context values
  timelineGeometryValue: TimelineGeometryContextType;
  timelineDataValue: TimelineDataContextType;
  timelineSignalsValue: { bulkCancelAllSignal: number; justSavedEmpId: string | null };
  timelineHandlersValue: TimelineHandlersContextType;
  // Assign PiP
  assignDialogEmployee: Employee | null;
  assignDialogPrefill: any;
  handleAssignDialogClose: () => void;
  setAssignDialogPrefill: any;
  // Profile modal
  setProfileModalEmployee: any;
  setProfileModalOpen: any;
}

const GanttSection = memo(
  ({
    displayedEmployeeCount,
    totalEmployeeCount,
    hasActiveFilters,
    filters,
    updateFilter,
    projectOpts,
    groupingLevels,
    onGroupingChange,
    collapsedGroups,
    setCollapsedGroups,
    groupedEmployees,
    managerFilter,
    setManagerFilter,
    managerList,
    showAdvanced,
    setShowAdvanced,
    cascadeOptions,
    handleCascadeChange,
    handleCascadeRemove,
    addCascadeFilter,
    filterSummary,
    removeActiveFilter,
    clearAllFilters,
    holidays,
    enabledHolidays,
    toggleHoliday,
    enableAllHolidays,
    disableAllHolidays,
    addCustomHoliday,
    removeCustomHoliday,
    heatmapMode,
    hasSapData,
    setScenarioCreateOpen,
    setScenarioCompareOpen,
    pipOpen,
    togglePipForActiveScenario,
    needsBoardOpen,
    toggleNeedsBoard,
    setFilters,
    deferredTimelineStart,
    deferredTimelineEnd,
    setCustomDateRangeDirect,
    resetTimeline,
    workingDaysCount,
    timelineSentinelRef,
    timelineStart,
    timelineEnd,
    displayedEmployees,
    timelineHeaderTop,
    handleMonthBarMouseDown,
    handleProgressiveExpand,
    handleProgressiveCollapse,
    handleSortOrderToggle,
    handleDmGroupingToggle,
    handleDispoRangeChange,
    zoomToMonth,
    hideTeamTU,
    setHideTeamTU,
    sapLookup,
    segmentFilter,
    serviceLineFilter,
    modificationsEnabled,
    bulkEditOpenSet,
    handleBulkCancelAll,
    gradeTransitionCounts,
    arrivalCounts,
    departureCounts,
    aggregateEmployees,
    timelineCalendar,
    aggregateGrid,
    granularity,
    chargeableCombined,
    teamTuStats,
    enabledHolidayDates,
    handlePeriodClick,
    filteredSapLookup,
    showIO,
    useSapActuals,
    stableEmpCount,
    handleAggVarianceComputed,
    ganttRefCallback,
    handleGanttDragOver,
    handleGanttDragLeave,
    handleGanttDrop,
    ganttDragOver,
    effectiveDailyGrid,
    employeeLevel,
    handleToggleEmployee,
    activeScenario,
    teamNetHours,
    handleBulkLiveCells,
    bulkEditPrefill,
    setBulkEditPrefill,
    filteredEmployees,
    groupRenderProps,
    timelineGeometryValue,
    timelineDataValue,
    timelineSignalsValue,
    timelineHandlersValue,
    assignDialogEmployee,
    assignDialogPrefill,
    handleAssignDialogClose,
    setAssignDialogPrefill,
    setProfileModalEmployee,
    setProfileModalOpen,
  }: GanttSectionProps) => {
    return (
      <DetachableCard
        group="Staffing"
        storageKey="pip-staffing-gantt"
        title="Staffing Timeline"
        defaultWidth={1200}
        defaultHeight={800}
      >
        <Box sx={{ ...keyframes.fadeInUp, animation: `fadeInUp 0.6s ${easing.elegant} 600ms both` }}>
          {/* Paper 1: FilterHeader */}
          <Paper
            variant="outlined"
            sx={{
              borderRadius: "24px 24px 0 0",
              p: 3,
              bgcolor: "background.paper",
              overflow: "hidden",
              borderBottom: "none",
            }}
          >
            <React.Profiler id="FilterHeader" onRender={recordRenderStep}>
              <FilterHeader
                employeeCount={displayedEmployeeCount}
                totalCount={totalEmployeeCount}
                hasActiveFilters={hasActiveFilters}
                filters={filters}
                updateFilter={updateFilter}
                projectOpts={projectOpts}
                groupingLevels={groupingLevels}
                onGroupingChange={onGroupingChange}
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
                onToggleHoliday={toggleHoliday}
                onEnableAllHolidays={enableAllHolidays}
                onDisableAllHolidays={disableAllHolidays}
                onAddCustomHoliday={addCustomHoliday}
                onRemoveCustomHoliday={removeCustomHoliday}
                heatmapMode={heatmapMode}
                hasSapData={hasSapData}
                onScenarioCreateClick={() => setScenarioCreateOpen(true)}
                onScenarioCompareClick={() => setScenarioCompareOpen(true)}
                pipOpen={pipOpen}
                onTogglePip={togglePipForActiveScenario}
                needsBoardOpen={needsBoardOpen}
                onToggleNeedsBoard={toggleNeedsBoard}
                onFilterChange={setFilters}
                timelineStart={deferredTimelineStart}
                timelineEnd={deferredTimelineEnd}
                setCustomDateRangeDirect={setCustomDateRangeDirect}
                resetTimeline={resetTimeline}
                workingDaysCount={workingDaysCount}
              />
            </React.Profiler>
          </Paper>

          {/* Sentinel for detecting when timeline header merges with TopToolbar */}
          <div ref={timelineSentinelRef} style={{ height: 0, visibility: "hidden" }} />
          {/* Crosshair wrapper: spans MonthHeaderBar + AggregateHeatmapStrip + Employee rows */}
          <Box
            sx={{ position: "relative" }}
            onMouseMove={(e: React.MouseEvent) => {
              // Only handle gaps between rows -- cells handle their own crosshair
              if ((e.target as HTMLElement).closest("[data-idx]")) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pad = 16;
              const tlLeft = rect.left + pad + GANTT_LEFT_COL_WIDTH;
              const tlWidth = rect.width - pad * 2 - GANTT_LEFT_COL_WIDTH - GANTT_RIGHT_PADDING;
              const frac = (e.clientX - tlLeft) / tlWidth;
              if (frac < 0 || frac > 1) {
                setCrosshairRange(null);
                return;
              }
              const sMs = new Date(timelineStart).setHours(0, 0, 0, 0);
              const eMs = new Date(timelineEnd).setHours(0, 0, 0, 0);
              const dateMs = sMs + frac * (eMs - sMs);
              setCrosshairRange({ startMs: dateMs, endMs: dateMs + 86400000, source: "timeline" });
            }}
            onMouseLeave={() => setCrosshairRange(null)}
          >
            {displayedEmployees.length > 0 && (
              <TimelineCrosshair timelineStart={timelineStart} timelineEnd={timelineEnd} inset={16} />
            )}
            {/* Sticky Timeline Header */}
            <StickyTimelineHeader stickyTop={timelineHeaderTop} visible={displayedEmployees.length > 0}>
              <React.Profiler id="MonthHeaderBar" onRender={recordRenderStep}>
                <MonthHeaderBar
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  onMouseDown={handleMonthBarMouseDown}
                  onProgressiveExpand={handleProgressiveExpand}
                  onProgressiveCollapse={handleProgressiveCollapse}
                  sortOrder={filters.sortOrder || "desc"}
                  onSortOrderToggle={handleSortOrderToggle}
                  sortBy={filters.sortBy || "utilization"}
                  onSortByChange={(key: string) => setFilters((f: any) => ({ ...f, sortBy: key }))}
                  dmGroupingActive={groupingLevels.includes("dm")}
                  onDmGroupingToggle={handleDmGroupingToggle}
                  dispoRange={[filters.dispoMin ?? 0, filters.dispoMax ?? 100]}
                  onDispoRangeChange={handleDispoRangeChange}
                  gradeTransitionOnly={filters.gradeTransitionOnly || false}
                  onGradeTransitionToggle={() =>
                    setFilters((f: any) => ({ ...f, gradeTransitionOnly: !f.gradeTransitionOnly }))
                  }
                  mergeGradeRows={filters.mergeGradeRows || false}
                  onMergeGradeRowsToggle={() => setFilters((f: any) => ({ ...f, mergeGradeRows: !f.mergeGradeRows }))}
                  hideTeamTU={hideTeamTU}
                  onHideTeamTUToggle={
                    groupingLevels.includes("dm") ? () => setHideTeamTU((v: boolean) => !v) : undefined
                  }
                  sapAnomalyOnly={filters.sapAnomalyOnly || false}
                  onSapAnomalyToggle={
                    sapLookup ? () => setFilters((f: any) => ({ ...f, sapAnomalyOnly: !f.sapAnomalyOnly })) : undefined
                  }
                  showAllEmployees={filters.showAllEmployees || false}
                  onShowAllEmployeesToggle={
                    segmentFilter.included.length > 0 || serviceLineFilter.included.length > 0
                      ? () => setFilters((f: any) => ({ ...f, showAllEmployees: !f.showAllEmployees }))
                      : undefined
                  }
                  bulkEditCount={modificationsEnabled === "all" ? bulkEditOpenSet.size : 0}
                  onBulkCancelAll={handleBulkCancelAll}
                  gradeTransitionCounts={gradeTransitionCounts}
                  arrivalCounts={arrivalCounts}
                  departureCounts={departureCounts}
                  churnFilter={filters.churnFilter || ""}
                  onBadgeClick={(type: string, monthKey: string) => {
                    const key = `${type}::${monthKey}`;
                    setFilters((f: any) => ({ ...f, churnFilter: f.churnFilter === key ? "" : key }));
                  }}
                  onMonthDoubleClick={zoomToMonth}
                  showBadges={filters.showBadges !== false}
                  onShowBadgesToggle={() =>
                    setFilters((f: any) => ({ ...f, showBadges: f.showBadges === false ? true : false }))
                  }
                  showDetails={filters.showDetails !== false}
                  onShowDetailsToggle={() =>
                    setFilters((f: any) => ({ ...f, showDetails: f.showDetails === false ? true : false }))
                  }
                />
              </React.Profiler>
              <React.Profiler id="AggregateHeatmapStrip" onRender={recordRenderStep}>
                <AggregateHeatmapStrip
                  employees={aggregateEmployees}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  calendar={timelineCalendar}
                  dailyGrid={aggregateGrid}
                  granularity={granularity}
                  mode={heatmapMode}
                  chargeableCombined={chargeableCombined}
                  theoreticalTU={teamTuStats.theoreticalTU}
                  enabledHolidayDates={enabledHolidayDates}
                  onDateRangeSelect={handlePeriodClick}
                  sapLookup={filteredSapLookup ?? sapLookup}
                  embedded
                  showIO={showIO}
                  ioTU={teamTuStats.ioTU}
                  useSapActuals={useSapActuals}
                  stableEmpCount={stableEmpCount}
                  onVarianceComputed={handleAggVarianceComputed}
                />
              </React.Profiler>
            </StickyTimelineHeader>

            {/* Paper 2: Employee content */}
            <Paper
              ref={ganttRefCallback}
              data-timeline-container
              variant="outlined"
              onDragOver={handleGanttDragOver}
              onDragLeave={handleGanttDragLeave}
              onDrop={handleGanttDrop}
              sx={{
                borderRadius: "0 0 24px 24px",
                p: 3,
                pt: 1,
                bgcolor: "background.paper",
                position: "relative",
                overflow: "hidden",
                "& *": { scrollbarWidth: "none", msOverflowStyle: "none" },
                "& *::-webkit-scrollbar": { display: "none" },
                ...(ganttDragOver && {
                  outline: "2px dashed",
                  outlineColor: "primary.main",
                  outlineOffset: -2,
                }),
                transition: "outline 0.2s, background-color 0.2s",
              }}
            >
              {ganttDragOver && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(255,255,255,0.6)",
                    borderRadius: 3,
                    pointerEvents: "none",
                  }}
                >
                  <Typography variant="h6" sx={{ color: "primary.main", fontWeight: 600 }}>
                    Drop to group
                  </Typography>
                </Box>
              )}

              <Box
                data-timeline-content
                data-onboarding="heatmap"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {displayedEmployees.length > 0 && <TodayLine timelineStart={timelineStart} timelineEnd={timelineEnd} />}
                {displayedEmployees.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 4, color: "grey.500" }}>
                    <GroupIcon sx={{ fontSize: 48, color: "grey.300", mb: 1.5, mx: "auto", display: "block" }} />
                    <Typography>No employees match the filters</Typography>
                  </Box>
                ) : (
                  <TimelineGeometryProvider value={timelineGeometryValue}>
                    <TimelineDataProvider value={timelineDataValue}>
                      <TimelineSignalsProvider value={timelineSignalsValue}>
                        <TimelineHandlersProvider value={timelineHandlersValue}>
                          {groupedEmployees ? (
                            <React.Profiler id="GroupedEmployeeList" onRender={recordRenderStep}>
                              <GroupedEmployeeList groups={groupedEmployees} {...groupRenderProps!} />
                            </React.Profiler>
                          ) : (
                            <React.Profiler
                              id={`EmployeeList(${displayedEmployees.length})`}
                              onRender={recordRenderStep}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: `${ROW_GAP}px`,
                                }}
                              >
                                {displayedEmployees.map((employee, idx) => (
                                  <EmployeeRow
                                    key={employee._isGradeSplit ? `${employee.empId}_${idx}` : employee.empId}
                                    employee={employee}
                                    dailyCells={effectiveDailyGrid.get(employee.empId)?.cells || []}
                                    viewLevel={employeeLevel.get(employee.empId) || 0}
                                    onToggle={handleToggleEmployee}
                                    draggable={!!activeScenario || needsBoardOpen}
                                    teamNetHours={teamNetHours}
                                    onBulkLiveCells={handleBulkLiveCells}
                                    bulkEditPrefill={
                                      bulkEditPrefill?.empId === (employee._realEmpId || employee.empId)
                                        ? bulkEditPrefill
                                        : undefined
                                    }
                                    onClearBulkEditPrefill={setBulkEditPrefill}
                                  />
                                ))}
                              </Box>
                            </React.Profiler>
                          )}
                          {/* Assign PiP: EmployeeRow in floating panel for staffing need assignment */}
                          <PiPWrapper
                            open={!!assignDialogEmployee && !!assignDialogPrefill}
                            onClose={handleAssignDialogClose}
                            storageKey="pip-assign-editor"
                            title={`Assign — ${assignDialogEmployee?.name || ""}`}
                            defaultWidth={1200}
                            defaultHeight={300}
                          >
                            {assignDialogEmployee && (
                              <EmployeeRow
                                employee={assignDialogEmployee}
                                dailyCells={effectiveDailyGrid.get(assignDialogEmployee.empId)?.cells || []}
                                viewLevel={2}
                                onToggle={() => {}}
                                teamNetHours={teamNetHours}
                                onBulkLiveCells={() => {}}
                                bulkEditPrefill={assignDialogPrefill}
                                onClearBulkEditPrefill={() =>
                                  setAssignDialogPrefill((prev: any) =>
                                    prev ? { ...prev, needId: prev.needId } : null
                                  )
                                }
                              />
                            )}
                          </PiPWrapper>
                        </TimelineHandlersProvider>
                      </TimelineSignalsProvider>
                    </TimelineDataProvider>
                  </TimelineGeometryProvider>
                )}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  onClick={() => {
                    setProfileModalEmployee(null);
                    setProfileModalOpen(true);
                  }}
                  sx={{ textTransform: "none", fontSize: "0.8125rem", color: "text.secondary" }}
                >
                  Add an employee
                </Button>
              </Box>

              {(() => {
                const uniqueFiltered = countUniqueReal(filteredEmployees);
                return uniqueFiltered > MAX_EMPLOYEES_DISPLAY ? (
                  <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "grey.500" }}>
                    Showing {MAX_EMPLOYEES_DISPLAY} of {uniqueFiltered} employees
                  </Typography>
                ) : null;
              })()}
            </Paper>
          </Box>
          {/* /crosshair wrapper */}
        </Box>
        {/* /gantt section */}
      </DetachableCard>
    );
  }
);

GanttSection.displayName = "GanttSection";

export { GanttSection };
