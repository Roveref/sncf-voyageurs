import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useAppStore } from "../../../../stores/useAppStore";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import IconButton from "@mui/material/IconButton";
import { UtilizationChart } from "../Timeline";
import { safeJsonParse } from "../../../../utils/safeJson";
import { consolidateAssignments } from "../../utils/dataProcessing";
import { MS_PER_DAY, getHoursPerDay, CHARGEABLE_CATS } from "../../constants";
import { brand } from "../../../../config/brandConfig";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { easing } from "../../../../styles/animations";
import { HeatmapStrip } from "./HeatmapStrip";
import { buildLiveDailyCells } from "../../utils/liveCellBuilder";
import { useEmployeeRowBulkState } from "../../hooks/useEmployeeRowBulkState";
import { useEmployeeMetrics } from "../../hooks/useEmployeeMetrics";
import { useLabelResolution } from "../../hooks/useLabelResolution";
import { BulkEditPanel } from "../Edit/BulkEditPanel";
import {
  useTimelineGeometry,
  useTimelineData,
  useTimelineHandlers,
  useTimelineSignals,
} from "../../contexts/TimelineContext";
import { EmployeeRowSapSection } from "./EmployeeRowSapSection";
import { EmployeeRowHeader } from "./EmployeeRowHeader";

// Shared style constants (extracted to reduce file size)
import {
  LEFT_COL,
  SX_FLEX_CENTER,
  SX_LEFT_COL_PAD,
  SX_SECTION_LABEL,
  SX_SECTION_HEADER_LEFT,
  SX_FLEX_1_PR,
  SX_HEATMAP_PY,
} from "./employeeRowStyles";

interface EmployeeRowProps {
  employee: any;
  dailyCells: any[];
  viewLevel?: number;
  onToggle: (empId: string, level?: number) => void;
  teamNetHours?: number;
  leftColShrink?: number;
  onBulkLiveCells?: (empId: string, cells: any[] | null, metrics?: any, liveAssignments?: any[] | null) => void;
  draggable?: boolean;
  bulkEditPrefill?: {
    empId: string;
    jobNo?: string;
    jobName?: string;
    startDate?: string;
    endDate?: string;
    utilization?: number;
    needId?: string;
  } | null;
  onClearBulkEditPrefill?: (v: null) => void;
}

// Main Employee Row
export const EmployeeRow = memo(
  ({
    employee,
    dailyCells,
    viewLevel = 0,
    onToggle,
    teamNetHours = 0,
    leftColShrink = 0,
    onBulkLiveCells,
    draggable = false,
    bulkEditPrefill,
    onClearBulkEditPrefill,
  }: EmployeeRowProps) => {
    // Timeline-wide props from granular contexts (better re-render perf)
    const { timelineStart, timelineEnd, calendar, granularity } = useTimelineGeometry();
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
      showDetails,
    } = useTimelineData();
    const { bulkCancelAllSignal, justSavedEmpId } = useTimelineSignals();
    const {
      onDeleteAssignment,
      onRevertAssignment,
      onBulkSaveAssignment,
      onHeatmapDateRangeSelect: onDateRangeSelect,
      onNavigateToTab,
      onNavigateToOpportunity,
      onNameClick,
      onDropNeed,
      onToggleCategory,
      onBulkEditChange,
      clearJustSaved,
    } = useTimelineHandlers();

    // ── Post-save scroll & highlight ──
    const cardRef = useRef<HTMLDivElement>(null);
    const [highlight, setHighlight] = useState(false);
    const justSaved = (employee._realEmpId || employee.empId) === justSavedEmpId;
    useEffect(() => {
      if (!justSaved) return;
      // Delay slightly to let the list re-sort and render at new position
      const t = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlight(true);
      }, 100);
      const t2 = setTimeout(() => {
        setHighlight(false);
        clearJustSaved?.();
      }, 2800);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }, [justSaved, clearJustSaved]);

    // ── Bulk edit state (extracted to useEmployeeRowBulkState) ──
    const {
      bulkEditMode,
      bulkStartWithAdd,
      setBulkStartWithAdd,
      bulkHasChanges,
      setBulkHasChanges,
      globalBarOpen,
      setGlobalBarOpen,
      savedEditorStateRef,
      handleEditorStateChange,
      bulkLiveAssignments,
      handleBulkLiveChange,
      bulkResetKey,
      bulkClearModeSignal,
      handleBulkCancel,
      handleBulkSave,
      handleEditActive,
      highlightInfo,
      handleSelectedJobNoChange,
    } = useEmployeeRowBulkState({
      employee,
      viewLevel,
      bulkCancelAllSignal,
      onBulkEditChange,
      onBulkSaveAssignment,
      onBulkLiveCells,
    });
    const empId = employee._realEmpId || employee.empId;

    // ── Category toggle context menu ──
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; job: any; selectedDates?: string[] } | null>(null);
    const handleCtxMenu = useCallback((e: React.MouseEvent | MouseEvent, job: any, selectedDates?: string[]) => {
      if ("stopPropagation" in e) e.stopPropagation();

      setCtxMenu({ x: e.clientX, y: e.clientY, job, selectedDates });
    }, []);
    const handleCtxClose = useCallback(() => setCtxMenu(null), []);

    // Close context menu on scroll (it uses absolute position, would float away)
    useEffect(() => {
      if (!ctxMenu) return;
      const close = () => setCtxMenu(null);
      const container = cardRef.current?.closest("[data-timeline-container]");
      container?.addEventListener("scroll", close, { passive: true });
      window.addEventListener("scroll", close, { passive: true });
      return () => {
        container?.removeEventListener("scroll", close);
        window.removeEventListener("scroll", close);
      };
    }, [ctxMenu]);

    // ── Drag affordance: hover state + first-drag hint ──
    const [isHovered, setIsHovered] = useState(false);
    const [showDragHint, setShowDragHint] = useState(false);

    const handleDragStartWithHint = useCallback(
      (e: React.DragEvent) => {
        e.dataTransfer.setData("application/scenario-employee", employee.empId);
        e.dataTransfer.effectAllowed = "copy";
        if (!localStorage.getItem("hasSeenDragHint")) {
          setShowDragHint(true);
          localStorage.setItem("hasSeenDragHint", "1");
          setTimeout(() => setShowDragHint(false), 3000);
        }
      },
      [employee.empId]
    );

    // ── Need drop target (reverse drag: need → employee) ──
    const [isNeedDrop, setIsNeedDrop] = useState(false);
    const handleNeedDragOver = useCallback((e: React.DragEvent) => {
      if (Array.from(e.dataTransfer.types).includes("application/scenario-need")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsNeedDrop(true);
      }
    }, []);
    const handleNeedDragLeave = useCallback((e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsNeedDrop(false);
    }, []);
    const handleNeedDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsNeedDrop(false);
        const raw = e.dataTransfer.getData("application/scenario-need");
        if (raw && onDropNeed) {
          const parsed = safeJsonParse(raw, null);
          if (parsed) onDropNeed(employee.empId, parsed);
        }
      },
      [employee.empId, onDropNeed]
    );

    // Stable callbacks
    const handleMouseEnter = useCallback(() => setIsHovered(true), []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);
    const handleToggle = useCallback(() => onToggle(employee.empId), [onToggle, employee.empId]);
    const handleNameClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onNameClick) onNameClick(employee);
      },
      [onNameClick, employee]
    );
    const handleDateRangeSelect = useCallback(
      (startDate: Date | string, endDate: Date | string) => {
        if (onDateRangeSelect) onDateRangeSelect(startDate, endDate, employee);
      },
      [onDateRangeSelect, employee]
    );
    const handleTuClick = useCallback(() => {
      if (onDateRangeSelect) onDateRangeSelect(timelineStart, timelineEnd, employee);
    }, [onDateRangeSelect, timelineStart, timelineEnd, employee]);
    // Label resolution (resolveOppForJob, getJobLabel, getJobLabelParts) — extracted to useLabelResolution
    const { resolveOppForJob } = useLabelResolution({
      assignments: employee.assignments,
      timelineStart,
      timelineEnd,
      enabledHolidayDates,
      pipelineJobcodes,
      jobcodeOppsList,
    });

    // Data – reuse cached consolidation from computeTimelineMetrics when available.
    // _consolidated is a fast-path only (NOT in deps – new ref each render cycle would break memo).
    const consolidatedAssignments = useMemo(
      () => employee._consolidated || consolidateAssignments(employee.assignments),
      [employee.assignments]
    );

    const modificationsMode = useAppStore((s) => s.modificationsEnabled);
    const isChangesOnly = modificationsMode === "changes";
    const isExcChanges = modificationsMode === "off";
    const suppressEdits = isChangesOnly || isExcChanges;

    // In bulk edit mode, use live assignments for the UtilizationChart
    // In "Changes Only" mode, use the pipeline assignments (only modified ones)
    const chartAssignments = useMemo(() => {
      if (suppressEdits) return consolidatedAssignments;
      return bulkEditMode && bulkLiveAssignments
        ? consolidateAssignments(bulkLiveAssignments)
        : consolidatedAssignments;
    }, [bulkEditMode, bulkLiveAssignments, consolidatedAssignments, suppressEdits]);

    const sapDayData = useMemo(
      () => (sapLookup && (sapLookup[employee.empId] || sapLookup[employee._realEmpId])) || null,
      [sapLookup, employee.empId, employee._realEmpId]
    );

    // Timeline geometry — computed once per timeline range, reused across expand/collapse
    const tl = useMemo(() => {
      const start = new Date(timelineStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(timelineEnd);
      end.setHours(0, 0, 0, 0);
      const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
      const weekendSet = new Set<number>();
      const dayToCol: number[] = [];
      const cols: any[] = [];
      const mondayCols: number[] = [];
      let d = 0;
      while (d < totalDays) {
        const date = new Date(start);
        date.setDate(date.getDate() + d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) {
          const weCols = cols.length;
          while (d < totalDays) {
            const dt = new Date(start);
            dt.setDate(dt.getDate() + d);
            if (dt.getDay() !== 0 && dt.getDay() !== 6) break;
            weekendSet.add(d);
            dayToCol.push(weCols);
            d++;
          }
          cols.push({ type: "weekend" });
        } else {
          if (dow === 1) mondayCols.push(cols.length);
          dayToCol.push(cols.length);
          cols.push({ type: "work", dayIdx: d });
          d++;
        }
      }
      return { totalDays, numCols: cols.length, dayToCol, weekendSet, mondayCols, start };
    }, [timelineStart, timelineEnd]);

    const handleBarClick = useCallback(
      (_job: any) => {
        // Expand to bulk edit mode when clicking an assignment bar
        if (viewLevel < 2) onToggle(employee.empId);
      },
      [viewLevel, onToggle, employee.empId]
    );

    // All metric derivations — extracted to useEmployeeMetrics
    const {
      hoursInfo,
      mdsHoursInfo,
      gradeTransition,
      currentEtp,
      potentialTeamPts,
      teamContribPts,
      sapCompletion,
      metricText,
      tuTooltip,
    } = useEmployeeMetrics({
      employee,
      consolidatedAssignments,
      chartAssignments,
      timelineStart,
      timelineEnd,
      enabledHolidayDates,
      chargeableCombined,
      heatmapMode,
      teamNetHours,
      bulkEditMode,
      bulkLiveAssignments,
      suppressEdits,
      showIO,
    });

    // Build simplified dailyCells from live assignments for HeatmapStrip buckets in bulk edit mode
    const liveDailyCells = useMemo(() => {
      if (!bulkEditMode || !bulkLiveAssignments) return null;
      return buildLiveDailyCells({ calendar, chartAssignments, chargeableCombined });
    }, [bulkEditMode, bulkLiveAssignments, calendar, chartAssignments, chargeableCombined]);

    const effectiveDailyCells = bulkEditMode && liveDailyCells && !suppressEdits ? liveDailyCells : dailyCells;

    // Notify parent of live cells for AggregateHeatmapStrip
    useEffect(() => {
      if (!onBulkLiveCells) return;
      if (bulkEditMode && liveDailyCells && !suppressEdits) {
        onBulkLiveCells(employee.empId, liveDailyCells, hoursInfo, bulkLiveAssignments);
      } else {
        onBulkLiveCells(employee.empId, null); // clear override
      }
    }, [bulkEditMode, liveDailyCells, onBulkLiveCells, employee.empId, hoursInfo, bulkLiveAssignments]);

    // Shared header props — passed to EmployeeRowHeader for both collapsed & expanded
    const headerProps = {
      employee,
      showDetails,
      showUtilization,
      showIO,
      currentEtp,
      gradeTransition,
      teamContribPts,
      teamNetHours,
      chargeableH: hoursInfo.chargeableH,
      potentialTeamPts,
      sapCompletion,
      tuTooltip,
      metricText,
      onToggle: handleToggle,
      onNameClick: typeof onNameClick === "function" ? handleNameClick : undefined,
      onTuClick: handleTuClick,
      hasNameClickHandler: typeof onNameClick === "function",
      isRecruit: !!employee._isRecruit,
      ioTU: employee._ioTU,
    };

    // Highlight animation keyframes
    const highlightSx = {};

    // LEVEL 0: compact heatmap strip
    if (viewLevel === 0) {
      return (
        <Tooltip title="Drag to assign to a staffing need" open={showDragHint} placement="right" arrow>
          <Box
            ref={cardRef}
            draggable={draggable}
            {...(draggable
              ? {
                  onDragStart: handleDragStartWithHint,
                  onDragOver: handleNeedDragOver,
                  onDragLeave: handleNeedDragLeave,
                  onDrop: handleNeedDrop,
                }
              : {})}
            onMouseEnter={draggable ? handleMouseEnter : undefined}
            onMouseLeave={draggable ? handleMouseLeave : undefined}
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              bgcolor: isNeedDrop ? alpha("#3b82f6", 0.06) : "background.paper",
              boxShadow: isNeedDrop
                ? `0 0 0 2px ${alpha("#3b82f6", 0.3)}, 0 1px 3px rgba(0,0,0,0.06)`
                : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              display: "flex",
              alignItems: "center",
              animation: `fadeInUp 0.3s ${easing.elegant} both`,
              "@keyframes fadeInUp": {
                from: { opacity: 0, transform: "translateY(8px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
              transition: `background-color 0.3s ${easing.elegant}, box-shadow 0.3s ${easing.elegant}`,
              cursor: draggable ? "grab" : undefined,
              "&:hover": {
                bgcolor: isNeedDrop ? alpha("#3b82f6", 0.06) : "action.hover",
              },
              contentVisibility: "auto",
              containIntrinsicBlockSize: "auto 52px",
              ...highlightSx,
            }}
          >
            {draggable && (
              <DragIndicatorIcon
                sx={{
                  fontSize: 16,
                  ml: 0.5,
                  color: "text.disabled",
                  flexShrink: 0,
                  opacity: isHovered ? 0.4 : 0,
                  transition: "opacity 0.2s ease",
                  cursor: "grab",
                }}
              />
            )}
            <Box sx={SX_LEFT_COL_PAD} style={{ width: LEFT_COL - leftColShrink - (draggable ? 20 : 0) }}>
              <EmployeeRowHeader {...headerProps} collapsed />
            </Box>

            <Box sx={{ ...SX_FLEX_1_PR, py: 0.25 }}>
              <HeatmapStrip
                assignments={consolidatedAssignments}
                dailyCells={effectiveDailyCells}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                calendar={calendar}
                grade={employee.grade}
                granularity={granularity}
                mode={heatmapMode}
                chargeableCombined={chargeableCombined}
                teamNetHours={teamNetHours}
                enabledHolidayDates={enabledHolidayDates}
                onDateRangeSelect={handleDateRangeSelect}
                sapDayData={sapDayData}
                arrivalDate={employee._arrivalDate}
                departureDate={employee._departureDate}
                gradeTransitions={employee._gradeHistory || null}
                mergedGradeRow={employee._gradeHistory?.length > 1 && !employee._isGradeSplit}
              />
            </Box>
          </Box>
        </Tooltip>
      );
    }

    // LEVEL 1 + 2: stacked heatmap (+ detail at level 2)
    return (
      <Box
        ref={cardRef}
        sx={{
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: isNeedDrop ? alpha("#3b82f6", 0.06) : "background.default",
          boxShadow: isNeedDrop
            ? `0 0 0 2px ${alpha("#3b82f6", 0.3)}, 0 1px 3px rgba(0,0,0,0.06)`
            : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          animation: `fadeInUp 0.3s ${easing.elegant} both`,
          "@keyframes fadeInUp": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          transition: `background-color 0.3s ${easing.elegant}, box-shadow 0.3s ${easing.elegant}`,
          "&:hover": {
            bgcolor: isNeedDrop ? alpha("#3b82f6", 0.06) : "background.default",
          },
          ...highlightSx,
        }}
      >
        <Box
          draggable={draggable}
          {...(draggable
            ? {
                onDragStart: handleDragStartWithHint,
                onDragOver: handleNeedDragOver,
                onDragLeave: handleNeedDragLeave,
                onDrop: handleNeedDrop,
              }
            : {})}
          onMouseEnter={draggable ? handleMouseEnter : undefined}
          onMouseLeave={draggable ? handleMouseLeave : undefined}
          sx={{ ...SX_FLEX_CENTER, transition: "background-color 0.15s", cursor: draggable ? "grab" : undefined }}
        >
          {draggable && (
            <DragIndicatorIcon
              sx={{
                fontSize: 16,
                ml: 0.5,
                color: "text.disabled",
                flexShrink: 0,
                opacity: isHovered ? 0.4 : 0,
                transition: "opacity 0.2s ease",
                cursor: "grab",
              }}
            />
          )}
          <Box sx={SX_LEFT_COL_PAD} style={{ width: LEFT_COL - leftColShrink - (draggable ? 20 : 0) }}>
            <EmployeeRowHeader {...headerProps} collapsed={false} />
          </Box>

          <Box sx={{ ...SX_FLEX_1_PR, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <Box sx={SX_HEATMAP_PY}>
              <HeatmapStrip
                assignments={consolidatedAssignments}
                dailyCells={effectiveDailyCells}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                calendar={calendar}
                grade={employee.grade}
                granularity={granularity}
                mode={heatmapMode}
                chargeableCombined={chargeableCombined}
                teamNetHours={teamNetHours}
                enabledHolidayDates={enabledHolidayDates}
                onDateRangeSelect={handleDateRangeSelect}
                sapDayData={sapDayData}
                arrivalDate={employee._arrivalDate}
                departureDate={employee._departureDate}
              />
            </Box>
          </Box>
        </Box>

        {viewLevel >= 2 && tl && (
          <Box sx={{ borderTop: "0.5px solid", borderColor: "divider", pb: 0.75, bgcolor: "#F3EFED" }}>
            {!useSapActuals && (
              <Box>
                <Box sx={SX_FLEX_CENTER}>
                  <Box sx={SX_SECTION_HEADER_LEFT} style={{ width: LEFT_COL - leftColShrink }}>
                    <Typography sx={SX_SECTION_LABEL}>
                      {(() => {
                        const empHPD = getHoursPerDay(employee.grade);
                        if (bulkEditMode && bulkLiveAssignments) {
                          const baseTU = mdsHoursInfo.tu;
                          const liveTU = hoursInfo.tu;
                          const baseChDays = Math.round(((mdsHoursInfo.chargeableH ?? 0) / empHPD) * 10) / 10;
                          const liveChDays = Math.round(((hoursInfo.chargeableH ?? 0) / empHPD) * 10) / 10;
                          const tuChanged = Math.abs(liveTU - baseTU) >= 0.05;
                          const chChanged = Math.abs(liveChDays - baseChDays) >= 0.05;
                          if (tuChanged) {
                            return (
                              <>
                                Editing &middot; TU {baseTU.toFixed(1)}% &rarr; {liveTU.toFixed(1)}% &middot; Ch{" "}
                                {baseChDays.toFixed(1)}d &rarr; {liveChDays.toFixed(1)}d
                              </>
                            );
                          }
                          if (chChanged) {
                            return (
                              <>
                                Editing &middot; Ch {baseChDays.toFixed(1)}d &rarr; {liveChDays.toFixed(1)}d
                              </>
                            );
                          }
                          // No meaningful change — show normal label
                        }
                        const chH = hoursInfo.chargeableH ?? 0;
                        const displayChDays = Math.round((chH / empHPD) * 10) / 10;
                        return <>MDS &amp; Forecast</>;
                      })()}
                    </Typography>
                    {bulkHasChanges && !globalBarOpen && !suppressEdits && (
                      <Tooltip title="Edit actions" placement="top">
                        <IconButton
                          size="small"
                          aria-label="Open edit actions panel"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGlobalBarOpen(true);
                          }}
                          sx={{
                            p: 0.25,
                            color: brand.secondaryLight,
                            "&:hover": { bgcolor: alpha(brand.secondaryLight, 0.08) },
                          }}
                        >
                          <RestartAltIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={SX_FLEX_1_PR}>
                    <UtilizationChart
                      assignments={chartAssignments}
                      empId={employee.empId}
                      timelineStart={timelineStart}
                      timelineEnd={timelineEnd}
                      onEdit={undefined}
                      showLegend={false}
                      showMonths={false}
                      enabledHolidayDates={enabledHolidayDates}
                      grade={employee.grade}
                      highlightJobNo={highlightInfo?.jobNo || null}
                      baseAssignments={highlightInfo?.jobNo ? consolidatedAssignments : null}
                    />
                  </Box>
                </Box>
                {/* Column headers for h / d */}
                <Box sx={{ display: "flex", pb: 0.25, borderLeft: "3px solid transparent" }}>
                  <Box
                    sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 1, px: 1.5 }}
                    style={{ width: LEFT_COL - leftColShrink - 3 }}
                  >
                    <Box sx={{ flex: 1 }} />
                    <Typography
                      component="span"
                      sx={{ fontSize: "0.75rem", color: "text.disabled", flexShrink: 0, width: 60, textAlign: "right" }}
                    />
                    <Typography
                      component="span"
                      sx={{ fontSize: "0.75rem", color: "text.disabled", flexShrink: 0, width: 40, textAlign: "right" }}
                    >
                      h
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ fontSize: "0.75rem", color: "text.disabled", flexShrink: 0, width: 32, textAlign: "right" }}
                    >
                      d
                    </Typography>
                    <Box component="span" sx={{ flexShrink: 0, width: 64 }} />
                  </Box>
                </Box>
                {/* Bulk edit — always active when expanded */}
                {tl && (
                  <BulkEditPanel
                    key={`${bulkResetKey}-${modificationsMode}`}
                    readOnly={suppressEdits}
                    employee={employee}
                    changesOnly={isChangesOnly}
                    tl={tl}
                    timelineStart={timelineStart}
                    timelineEnd={timelineEnd}
                    pipelineJobcodes={pipelineJobcodes}
                    enabledHolidayDates={enabledHolidayDates}
                    leftColShrink={leftColShrink}
                    onSaveAll={handleBulkSave}
                    onCancel={handleBulkCancel}
                    onLiveAssignmentsChange={handleBulkLiveChange}
                    onSelectedJobNoChange={handleSelectedJobNoChange}
                    onEditActive={handleEditActive}
                    startWithAdd={bulkStartWithAdd}
                    prefill={bulkEditPrefill}
                    onClearPrefill={onClearBulkEditPrefill}
                    onHasChanges={setBulkHasChanges}
                    globalBarOpen={globalBarOpen}
                    onGlobalBarClose={() => setGlobalBarOpen(false)}
                    clearModeSignal={bulkClearModeSignal}
                    savedEditorState={isExcChanges ? null : savedEditorStateRef.current}
                    onEditorStateChange={handleEditorStateChange}
                  />
                )}
              </Box>
            )}

            {/* SAP data section — extracted to EmployeeRowSapSection */}
            {sapDayData && (
              <EmployeeRowSapSection
                sapDayData={sapDayData}
                employee={employee}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                leftColShrink={leftColShrink}
                tl={tl}
                enabledHolidayDates={enabledHolidayDates}
                showIO={showIO}
                pipelineJobcodes={pipelineJobcodes}
                ioJobcodes={ioJobcodes}
                resolveOppForJob={resolveOppForJob}
                onNavigateToOpportunity={onNavigateToOpportunity}
                onContextMenu={handleCtxMenu}
              />
            )}
          </Box>
        )}

        {/* Category toggle context menu */}
        <Menu
          open={!!ctxMenu}
          onClose={handleCtxClose}
          anchorReference="anchorPosition"
          anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
        >
          {ctxMenu &&
            (() => {
              const isCh = CHARGEABLE_CATS.has(ctxMenu.job.category);
              const newCat = isCh ? "other" : "chargeable";
              const label = isCh ? "Switch to Non-Billable" : "Switch to Billable";
              const selectedDates = ctxMenu.selectedDates;
              const dateInfo =
                selectedDates && selectedDates.length > 0
                  ? ` (${selectedDates.length} day${selectedDates.length > 1 ? "s" : ""})`
                  : "";
              return (
                <MenuItem
                  onClick={() => {
                    onToggleCategory(
                      employee.empId,
                      ctxMenu.job.jobNo,
                      ctxMenu.job.periods?.[0]?.startDate || "",
                      ctxMenu.job.jobName,
                      newCat,
                      selectedDates && selectedDates.length > 0 ? selectedDates : undefined
                    );
                    handleCtxClose();
                  }}
                >
                  {label}
                  {dateInfo}
                </MenuItem>
              );
            })()}
        </Menu>
      </Box>
    );
  }
);

EmployeeRow.displayName = "EmployeeRow";
