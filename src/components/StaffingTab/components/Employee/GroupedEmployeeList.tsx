import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { EmployeeRow } from "./EmployeeRow";
import type { Employee } from "../../types";
import { AggregateHeatmapStrip } from "./AggregateHeatmapStrip";
import { HeatmapStrip } from "./HeatmapStrip";
import { getGroupColors } from "../../utils/groupingUtils";
import { fmtHD, getGradeTarget } from "../../constants/theme";
import { GANTT_LEFT_COL_WIDTH } from "../../constants";
import { easing } from "../../../../styles/animations";
import { countUniqueReal } from "../../utils/empIdUtils";
import { useTimelineGeometry, useTimelineData, useTimelineHandlers } from "../../contexts/TimelineContext";

/** Style presets for group nesting depth (0, 1, 2+) */
const GROUP_STYLES = [
  {
    chevronSize: 16,
    chevronColor: "text.secondary",
    pad: { px: 2, py: 1.25 },
    font: { fontWeight: 600, fontSize: "0.875rem" },
    stat: { fontSize: "0.75rem", color: "text.secondary" },
    ml: { ml: 1 },
    subMl: { ml: 2 },
  },
  {
    chevronSize: 14,
    chevronColor: "#9ca3af",
    pad: { px: 1.5, py: 1 },
    font: { fontWeight: 500, fontSize: "0.75rem" },
    stat: { fontSize: "0.75rem", color: "text.secondary" },
    ml: { ml: 1 },
    subMl: { ml: 2 },
  },
  {
    chevronSize: 12,
    chevronColor: "#9ca3af",
    pad: { px: 1.25, py: 0.75 },
    font: { fontWeight: 500, fontSize: "11px" },
    stat: { fontSize: "11px", color: "text.disabled" },
    ml: { ml: 1 },
    subMl: { ml: 1.5 },
  },
];

/** Left border colors for DM hierarchy depth levels */
const DEPTH_BORDER_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

/** Indent geometry per DM hierarchy nesting level */
const DM_ML = 12; // margin-left
const DM_BORDER = 1; // border-left width
const DM_PL = 11; // padding-left
const DM_INDENT_PX = DM_ML + DM_BORDER + DM_PL; // total shift per level = 24px

// ─── Recursive renderer ──────────────────────────────────────────────────────

/**
 * Recursive renderer for grouped employee lists.
 * Timeline-wide props come from TimelineContext; only group-control props are passed as direct props.
 */
interface GroupLevelProps {
  groups: any[];
  depth: number;
  parentKey: string;
  groupingLevels: string[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onGroupDragOut?: (data: any) => void;
  teamTuStats: any;
  onWaterfallEnter?: (e: React.MouseEvent, title: string, employees: any[], tu: number) => void;
  onWaterfallMove?: (e: React.MouseEvent) => void;
  onWaterfallLeave?: () => void;
  dailyGrid: Map<string, any>;
  employeeLevel: Map<string, number>;
  teamNetHours?: number;
  onToggleEmployee: (empId: string, level?: number) => void;
  onScopedExpand?: (key: string) => void;
  onScopedCollapse?: (key: string) => void;
  hideTeamTU?: boolean;
  draggable?: boolean;
}

const GroupLevel = memo(
  ({
    groups,
    depth,
    parentKey,
    groupingLevels,
    collapsedGroups,
    onToggleGroup,
    onGroupDragOut,
    teamTuStats,
    // Waterfall tooltip handlers
    onWaterfallEnter,
    onWaterfallMove,
    onWaterfallLeave,
    dailyGrid,
    // Employee row props (per-group/per-employee)
    employeeLevel,
    teamNetHours,
    onToggleEmployee,
    onScopedExpand,
    onScopedCollapse,
    hideTeamTU,
    draggable = false,
  }: GroupLevelProps) => {
    // Timeline-wide props from granular contexts (better re-render perf)
    const {
      timelineStart,
      timelineEnd,
      calendar,
      granularity,
      weekendMarkers,
      holidayMarkers,
      labels,
      monthLabels,
      dayWidth,
    } = useTimelineGeometry();
    const {
      heatmapMode,
      chargeableCombined,
      enabledHolidayDates,
      showUtilization,
      sapLookup,
      useSapActuals,
      pipelineJobcodes,
      jobcodeOppsList,
      ioJobcodes,
      showIO,
    } = useTimelineData();
    const {
      onHeatmapDateRangeSelect,
      onNavigateToTab,
      onNavigateToOpportunity,
      onNameClick,
      onDropNeed,
      onDragEnd,
      onViewPlanning,
      onViewCalendar,
    } = useTimelineHandlers();

    // For DM hierarchy subgroups, stay at the same groupingLevels depth
    const isDmHierarchy = groups.length > 0 && groups[0]._dmHierarchy;
    const criterion = isDmHierarchy ? "dm" : groupingLevels[depth];
    const s = GROUP_STYLES[isDmHierarchy ? 0 : Math.min(depth, 2)];

    // Working days in the timeline period (for FTE computation)
    const totalWorkDays = useMemo(() => {
      if (!timelineStart || !timelineEnd) return 0;
      let wd = 0;
      const c = new Date(timelineStart);
      c.setHours(0, 0, 0, 0);
      const e = new Date(timelineEnd);
      e.setHours(0, 0, 0, 0);
      while (c < e) {
        const dw = c.getDay();
        if (dw !== 0 && dw !== 6) wd++;
        c.setDate(c.getDate() + 1);
      }
      return wd;
    }, [timelineStart, timelineEnd]);

    return groups.map((group) => {
      const groupKey = parentKey ? `${parentKey}::${group.name}` : group.name;
      const isCollapsed = collapsedGroups.has(groupKey);
      const colors = getGroupColors(group.name, criterion, group);
      const headerLeftCol = GANTT_LEFT_COL_WIDTH - depth * DM_INDENT_PX;

      // Render flat groups (orphans) as individual EmployeeRows without group header
      if (group._renderFlat) {
        return group.employees.map((employee: any) => (
          <EmployeeRow
            key={employee.empId}
            employee={employee}
            dailyCells={dailyGrid?.get(employee.empId)?.cells}
            viewLevel={employeeLevel.get(employee.empId) || 0}
            onToggle={onToggleEmployee}
            draggable={draggable}
            teamNetHours={teamNetHours}
            leftColShrink={depth * DM_INDENT_PX}
          />
        ));
      }

      return (
        <Box
          key={group.name}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            contentVisibility: "auto",
            containIntrinsicBlockSize: "auto 60px",
          }}
        >
          {/* Group header with inline heatmap */}
          {(() => {
            const hasMgrHeatmap = group._dmHierarchy && group._managerEmp && dailyGrid?.get(group._managerEmp.empId);
            const cardSx = {
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              bgcolor: colors.bg,
            };
            // TU label helper for Team/Indiv
            const tuLabel = (_prefix: string, modeVal: { tu?: number; to?: number; chH?: number; netH?: number }) => {
              if (heatmapMode === "hours") return `${(modeVal.chH || 0).toFixed(0)}/${(modeVal.netH || 0).toFixed(0)}h`;
              const mLabel = heatmapMode === "availability" ? "Di" : heatmapMode === "to" ? "TO" : "TU";
              const mVal =
                heatmapMode === "availability"
                  ? Math.max(0, 100 - (modeVal.to || 0))
                  : heatmapMode === "to"
                    ? modeVal.to || 0
                    : modeVal.tu || 0;
              return `${mLabel} ${mVal.toFixed(1)}%`;
            };
            const tuLabelSx = {
              flexShrink: 0,
              fontSize: "0.75rem",
              fontWeight: 600,
              lineHeight: 1,
              color: "text.primary",
              whiteSpace: "nowrap",
              width: 90,
              textAlign: "right",
              pr: 0.5,
            };
            const prefixSx = { fontSize: "0.6rem", fontWeight: 500, color: "text.disabled", mr: 0.3 };

            const leftColContent = (
              <Box
                draggable
                role="group"
                aria-label={group.name}
                aria-expanded={!isCollapsed}
                onDragStart={(e) => {
                  e.dataTransfer.setData("groupCriterion", criterion);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={(e) => {
                  const ganttEl = document.querySelector("[data-timeline-container]");
                  if (ganttEl) {
                    const rect = ganttEl.getBoundingClientRect();
                    const { clientX, clientY } = e;
                    const isOutside =
                      clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
                    if (isOutside && onGroupDragOut) onGroupDragOut(criterion);
                  }
                }}
                sx={{
                  flexShrink: 0,
                  width: hasMgrHeatmap ? headerLeftCol - 90 : headerLeftCol,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  ...s.pad,
                  ...(!hasMgrHeatmap && { pr: 1.25 }),
                  cursor: "grab",
                  userSelect: "none",
                  "&:hover": { opacity: 0.9 },
                  "&:active": { cursor: "grabbing" },
                  transition: `opacity 0.3s ${easing.elegant}`,
                  overflow: "hidden",
                }}
                onClick={() => onToggleGroup(groupKey)}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {isCollapsed ? (
                    <ChevronRightIcon sx={{ fontSize: s.chevronSize, color: s.chevronColor }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: s.chevronSize, color: s.chevronColor }} />
                  )}
                  <Typography
                    component="span"
                    sx={{
                      ...s.font,
                      color: "text.primary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.name}
                  </Typography>
                  <Typography component="span" sx={{ ...s.stat, flexShrink: 0 }}>
                    (
                    {(() => {
                      const count = countUniqueReal(group.employees);
                      if (totalWorkDays <= 0) return `${count}`;
                      const fte = group.employees.reduce(
                        (sum: number, emp: Record<string, any>) =>
                          sum + Math.min(1, (emp._presenceActiveN || emp._displayActiveN || 0) / totalWorkDays),
                        0
                      );
                      const realFte = fte;
                      const fteFmt = fte.toFixed(1);
                      const realSuffix = realFte < fte - 0.05 ? ` · ${realFte.toFixed(1)} actual` : "";
                      return fteFmt === String(count) || fteFmt === `${count}.0`
                        ? `${count}${realSuffix}`
                        : `${fteFmt} FTE / ${count}${realSuffix}`;
                    })()}
                    )
                  </Typography>
                  {!isCollapsed && (group.subGroups || group.employees.length > 0) && (
                    <Box sx={{ display: "flex", ml: 0.5, flexShrink: 0 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onScopedCollapse?.(groupKey);
                        }}
                        sx={{ p: 0 }}
                      >
                        <ChevronRightIcon sx={{ fontSize: 12, color: "text.disabled", transform: "rotate(-90deg)" }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onScopedExpand?.(groupKey);
                        }}
                        sx={{ p: 0 }}
                      >
                        <ExpandMoreIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                      </IconButton>
                    </Box>
                  )}
                  {!hasMgrHeatmap &&
                    (() => {
                      const grpSapDays = group.employees.reduce(
                        (s: number, e: Record<string, any>) => s + (e._sapDayCount || 0),
                        0
                      );
                      const grpSapWork = group.employees.reduce(
                        (s: number, e: Record<string, any>) => s + (e._sapActiveDayCount || 0),
                        0
                      );
                      const grpSapPct = grpSapWork > 0 ? Math.round((grpSapDays / grpSapWork) * 100) : 0;
                      const sapClr = grpSapPct >= 100 ? "#047857" : grpSapPct > 0 ? "#b45309" : "#ef4444";
                      const sapBgc =
                        grpSapPct >= 100
                          ? "rgba(4,120,55,0.1)"
                          : grpSapPct > 0
                            ? "rgba(180,83,9,0.12)"
                            : "rgba(239,68,68,0.1)";
                      const sapIcon = grpSapPct >= 100 ? "\u2713" : grpSapPct > 0 ? "\u25D0" : "\u25CB";
                      return (
                        <>
                          <Box sx={{ flex: 1 }} />
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                            {teamTuStats.totalNet > 0 && (
                              <Typography
                                component="span"
                                sx={{
                                  px: 0.5,
                                  py: 0.125,
                                  borderRadius: "9999px",
                                  bgcolor: "#f0f9ff",
                                  color: "#0369a1",
                                  fontWeight: 600,
                                  fontSize: "0.7rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {(((group.totalChH || 0) / teamTuStats.totalNet) * 100).toFixed(1)}pts
                              </Typography>
                            )}
                            {grpSapWork > 0 && (
                              <Typography
                                component="span"
                                sx={{
                                  px: 0.5,
                                  py: 0.125,
                                  borderRadius: "9999px",
                                  bgcolor: sapBgc,
                                  color: sapClr,
                                  fontWeight: 600,
                                  fontSize: "0.65rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {sapIcon} {grpSapDays}/{grpSapWork}
                              </Typography>
                            )}
                            <Typography
                              component="span"
                              sx={{
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                lineHeight: 1,
                                color: "text.primary",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tuLabel("", {
                                tu: group.weightedTU || 0,
                                to: group.weightedTO || 0,
                                chH: group.totalChH || 0,
                                netH: group.totalNetH || 0,
                              })}
                            </Typography>
                          </Box>
                        </>
                      );
                    })()}
                </Box>
              </Box>
            );

            // Team employees: all descendants excluding the manager
            const teamEmployees = hasMgrHeatmap
              ? group.employees.filter((e: Employee) => e.empId !== group._managerEmp.empId)
              : group.employees;
            // Team TU stats (subordinates only)
            const teamNetH = teamEmployees.reduce(
              (s: number, e: Record<string, any>) => s + (e._displayNetH || e.totalNetHours || 0),
              0
            );
            const teamChH = teamEmployees.reduce((s: number, e: Record<string, any>) => s + (e._displayChH || 0), 0);
            const teamTrH = teamEmployees.reduce((s: number, e: Record<string, any>) => s + (e._displayTrH || 0), 0);
            const teamTU = teamNetH > 0 ? (teamChH / teamNetH) * 100 : 0;
            const teamTO = teamNetH > 0 ? ((teamChH + teamTrH) / teamNetH) * 100 : 0;

            return hasMgrHeatmap ? (
              <Box sx={{ ...cardSx, display: "flex", alignItems: "center" }}>
                {leftColContent}
                {/* Right: TU labels + stacked heatmaps */}
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  {/* Indiv. row */}
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography component="span" sx={tuLabelSx}>
                      <Typography component="span" sx={prefixSx}>
                        Indiv.
                      </Typography>
                      {tuLabel("Indiv.", {
                        tu: group._managerEmp._displayTU ?? 0,
                        to: group._managerEmp._displayTO ?? 0,
                        chH: group._managerEmp._displayChH || 0,
                        netH: group._managerEmp._displayNetH || 0,
                      })}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0, py: "7px", pr: 1.5 }}>
                      <HeatmapStrip
                        assignments={group._managerEmp._consolidated || group._managerEmp.assignments}
                        dailyCells={dailyGrid.get(group._managerEmp.empId)?.cells}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        calendar={calendar}
                        grade={group._managerEmp.grade}
                        granularity={granularity}
                        mode={heatmapMode}
                        chargeableCombined={chargeableCombined}
                        enabledHolidayDates={enabledHolidayDates}
                        onDateRangeSelect={(start: Date, end: Date) =>
                          onHeatmapDateRangeSelect(start, end, group._managerEmp)
                        }
                        sapDayData={
                          (sapLookup &&
                            (sapLookup[group._managerEmp.empId] || sapLookup[group._managerEmp._realEmpId])) ||
                          null
                        }
                        arrivalDate={group._managerEmp._arrivalDate}
                        departureDate={group._managerEmp._departureDate}
                        gradeTransitions={group._managerEmp._gradeHistory || null}
                        mergedGradeRow={group._managerEmp._gradeHistory?.length > 1 && !group._managerEmp._isGradeSplit}
                      />
                    </Box>
                  </Box>
                  {/* Team row */}
                  {!hideTeamTU && (
                    <Box sx={{ display: "flex", alignItems: "center", borderTop: "1px solid", borderColor: "divider" }}>
                      <Typography component="span" sx={tuLabelSx}>
                        <Typography component="span" sx={prefixSx}>
                          Team
                        </Typography>
                        {tuLabel("Team", { tu: teamTU, to: teamTO, chH: teamChH, netH: teamNetH })}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <AggregateHeatmapStrip
                          employees={teamEmployees}
                          timelineStart={timelineStart}
                          timelineEnd={timelineEnd}
                          calendar={calendar}
                          dailyGrid={dailyGrid}
                          granularity={granularity}
                          mode={heatmapMode}
                          chargeableCombined={chargeableCombined}
                          theoreticalTU={(() => {
                            let totalNet = 0,
                              targetCh = 0;
                            teamEmployees.forEach((e: Employee) => {
                              const net = e._displayNetH || 0;
                              totalNet += net;
                              targetCh += (getGradeTarget(e.grade) / 100) * net;
                            });
                            return totalNet > 0 ? (targetCh / totalNet) * 100 : 75;
                          })()}
                          enabledHolidayDates={enabledHolidayDates}
                          onDateRangeSelect={(start: Date | string, end: Date | string) =>
                            onHeatmapDateRangeSelect(start, end, teamEmployees)
                          }
                          sapLookup={sapLookup}
                          embedded
                          hideLeftCol
                          useSapActuals={useSapActuals}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ ...cardSx, display: "flex", alignItems: "center" }}>
                {leftColContent}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <AggregateHeatmapStrip
                    employees={group.employees}
                    timelineStart={timelineStart}
                    timelineEnd={timelineEnd}
                    calendar={calendar}
                    dailyGrid={dailyGrid}
                    granularity={granularity}
                    mode={heatmapMode}
                    chargeableCombined={chargeableCombined}
                    theoreticalTU={(() => {
                      let totalNet = 0,
                        targetCh = 0;
                      group.employees.forEach((e: Employee) => {
                        const net = e._displayNetH || 0;
                        totalNet += net;
                        targetCh += (getGradeTarget(e.grade) / 100) * net;
                      });
                      return totalNet > 0 ? (targetCh / totalNet) * 100 : 75;
                    })()}
                    enabledHolidayDates={enabledHolidayDates}
                    onDateRangeSelect={(start: Date | string, end: Date | string) =>
                      onHeatmapDateRangeSelect(start, end, group.employees)
                    }
                    sapLookup={sapLookup}
                    embedded
                    hideLeftCol
                    useSapActuals={useSapActuals}
                  />
                </Box>
              </Box>
            );
          })()}
          {!isCollapsed &&
            (() => {
              const indentSx = {
                ml: `${DM_ML}px`,
                pl: `${DM_PL}px`,
                borderLeft: `${DM_BORDER}px solid`,
                borderColor: colors.text,
              };
              // Cumulative shrink for left column so timeline stays aligned with header
              const cumulShrink = (depth + 1) * DM_INDENT_PX;
              return group.subGroups ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, ...indentSx }}>
                  {/* For DM hierarchy without grade sub-levels: render leaf employees above subGroups */}
                  {group._dmHierarchy &&
                    group._leafEmployees &&
                    group.subGroups?.[0]?._dmHierarchy &&
                    group._leafEmployees
                      .filter((e: Employee) => !group._managerEmp || e.empId !== group._managerEmp.empId)
                      .map((employee: any) => (
                        <EmployeeRow
                          key={employee.empId}
                          employee={employee}
                          dailyCells={dailyGrid?.get(employee.empId)?.cells}
                          viewLevel={employeeLevel.get(employee.empId) || 0}
                          onToggle={onToggleEmployee}
                          draggable={draggable}
                          teamNetHours={teamNetHours}
                          leftColShrink={cumulShrink}
                        />
                      ))}
                  <GroupLevel
                    groups={group.subGroups}
                    depth={depth + 1}
                    parentKey={groupKey}
                    groupingLevels={groupingLevels}
                    collapsedGroups={collapsedGroups}
                    onToggleGroup={onToggleGroup}
                    onGroupDragOut={onGroupDragOut}
                    teamTuStats={teamTuStats}
                    onWaterfallEnter={onWaterfallEnter}
                    onWaterfallMove={onWaterfallMove}
                    onWaterfallLeave={onWaterfallLeave}
                    dailyGrid={dailyGrid}
                    employeeLevel={employeeLevel}
                    teamNetHours={teamNetHours}
                    onToggleEmployee={onToggleEmployee}
                    onScopedExpand={onScopedExpand}
                    onScopedCollapse={onScopedCollapse}
                    hideTeamTU={hideTeamTU}
                  />
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, ...indentSx }}>
                  {(group._dmHierarchy && group._leafEmployees
                    ? group._leafEmployees.filter(
                        (e: Employee) => !group._managerEmp || e.empId !== group._managerEmp.empId
                      )
                    : (() => {
                        if (!group._dmSubGroups) return group.employees;
                        const dmMgrIds = new Set(
                          group._dmSubGroups.map((sg: Record<string, any>) => sg._managerEmp?.empId).filter(Boolean)
                        );
                        return group.employees.filter((e: Employee) => !dmMgrIds.has(e.empId));
                      })()
                  ).map((employee: any) => (
                    <EmployeeRow
                      key={employee.empId}
                      employee={employee}
                      dailyCells={dailyGrid?.get(employee.empId)?.cells}
                      viewLevel={employeeLevel.get(employee.empId) || 0}
                      onToggle={onToggleEmployee}
                      draggable={draggable}
                      teamNetHours={teamNetHours}
                      leftColShrink={cumulShrink}
                    />
                  ))}
                  {/* DM sub-groups embedded inside a grade group */}
                  {group._dmSubGroups && (
                    <GroupLevel
                      groups={group._dmSubGroups}
                      depth={depth + 1}
                      parentKey={groupKey}
                      groupingLevels={groupingLevels}
                      collapsedGroups={collapsedGroups}
                      onToggleGroup={onToggleGroup}
                      onGroupDragOut={onGroupDragOut}
                      teamTuStats={teamTuStats}
                      onWaterfallEnter={onWaterfallEnter}
                      onWaterfallMove={onWaterfallMove}
                      onWaterfallLeave={onWaterfallLeave}
                      dailyGrid={dailyGrid}
                      employeeLevel={employeeLevel}
                      teamNetHours={teamNetHours}
                      onToggleEmployee={onToggleEmployee}
                      onScopedExpand={onScopedExpand}
                      onScopedCollapse={onScopedCollapse}
                    />
                  )}
                </Box>
              );
            })()}
        </Box>
      );
    });
  }
);

GroupLevel.displayName = "GroupLevel";

// ─── GroupedEmployeeList ─────────────────────────────────────────────────────

/**
 * Top-level component for rendering grouped employees.
 * Delegates to the recursive GroupLevel renderer.
 */
interface GroupedEmployeeListProps extends Omit<GroupLevelProps, "depth" | "parentKey"> {}

const GroupedEmployeeList = memo((props: GroupedEmployeeListProps) => {
  return <GroupLevel {...props} depth={0} parentKey="" />;
});

GroupedEmployeeList.displayName = "GroupedEmployeeList";

export default GroupedEmployeeList;
