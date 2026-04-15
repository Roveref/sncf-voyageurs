import { useMemo } from "react";
import { useRecruitmentData } from "../../../queries/useRecruitmentData";
import useScenarioStore from "../../../stores/useScenarioStore";
import { applyAssignmentOverrides, mergeEmployeeOverrides } from "../utils/scenarioUtils";
import { detectGradesFromSap, detectInternToAnalyst, detectPresenceDates } from "../utils/sapGradeDetection";
import { extractProjects } from "../utils/projectUtils";
import { getUniqueProjects } from "../utils/filterUtils";
import { generateAlerts } from "../utils/alertsUtils";
import { buildManagerList } from "../utils/managerUtils";
import { useDataPipeline } from "./useDataPipeline";
import { useAssignmentFiltering } from "./useAssignmentFiltering";
import { useDailyGrid } from "./useDailyGrid";
import { useEmployeeFiltering } from "./useEmployeeFiltering";
import { useSapProcessing } from "./useSapProcessing";
import { usePipelineJobcodes } from "./usePipelineJobcodes";
import type {
  EmployeeMetadata,
  IncludeExcludeFilter,
  SapLookup,
  SapUploadResult,
  SkillsData,
  StaffingFilters,
  StaffingRecord,
} from "../types";
import type { BaselineSegment, EditorState } from "../components/Edit/bulkEditTypes";
import type { ManualEmployee } from "../../../stores/useUserDataStore";

// ── Input interface ────────────────────────────────────────────────────────────

export interface UseStaffingPipelineParams {
  /** Raw staffing records from file upload / hydration */
  data: StaffingRecord[];
  /** Snapshot of base data before edits — used by "Exc. Changes" mode */
  baseData: StaffingRecord[];
  /** Editor states from useUserDataStore (empId → {current, baseline, actionLog}) */
  editorStates: Record<string, EditorState | null>;
  /** Modifications toggle: 'off' | 'all' | 'changes' */
  modificationsEnabled: string;
  /** Raw SAP lookup */
  rawSapLookup: SapLookup | null;
  /** Full SAP upload result (lookup + minDate/maxDate) */
  sapData: SapUploadResult | null;
  /** Holiday dates from useHolidays */
  enabledHolidayDates: Set<string>;
  /** Employee metadata (merged: server + user overrides) */
  employeeMetadata: Record<string, EmployeeMetadata>;
  /** Manual employees from useUserDataStore */
  manualEmployeesFromStore: ManualEmployee[];
  /** Skills data from useSkillsUpload */
  skillsData: SkillsData | null;
  /** Timeline start date */
  timelineStart: Date;
  /** Timeline end date */
  timelineEnd: Date;
  /** CRM shared data for pipeline jobcodes */
  sharedData: Record<string, unknown>[];
  /** Segment filter (from App props) */
  segmentFilter: IncludeExcludeFilter;
  /** Segment filter modes */
  segmentModes: Map<string, string>;
  /** Service-line filter (from App props) */
  serviceLineFilter: IncludeExcludeFilter;
  /** Service-line filter modes */
  serviceLineModes: Map<string, string>;
  /** UI filters from useStaffingFilters */
  filters: StaffingFilters;
  /** Macro grade filter from App props */
  macroGradeFilter: IncludeExcludeFilter;
  /** Macro category filter from App props */
  macroCategoryFilter: IncludeExcludeFilter;
  /** Manager name filter */
  managerFilter: string;
  /** Grouping levels for employee grouping */
  groupingLevels: string[];
  /** Heatmap display mode */
  heatmapMode: string;
  /** Chargeable combined toggle */
  chargeableCombined: boolean;
  /** Data source debug mode */
  dataSourceDebug: string;
  /** Ref tracking drag-in-progress */
  isDraggingRef: React.MutableRefObject<boolean>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full staffing data pipeline: scenario overrides, employee structures,
 * SAP enrichment, daily grid, filtering, grouping, alerts, and derived pipeline metadata.
 * This is the main composition hook consumed by StaffingTab.tsx.
 */
export function useStaffingPipeline({
  data,
  baseData,
  editorStates,
  modificationsEnabled,
  rawSapLookup,
  sapData,
  enabledHolidayDates,
  employeeMetadata,
  manualEmployeesFromStore,
  skillsData,
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
}: UseStaffingPipelineParams) {
  // ── Step 1: Merge editor states with base data ────────────────────────────
  const effectiveData = useMemo(() => {
    // "off" = Exc. Changes → return base data only (no edits applied)
    if (modificationsEnabled === "off") return baseData.length > 0 ? baseData : data;

    const editedEmpIds = Object.keys(editorStates).filter((empId) => (editorStates[empId]?.current?.length ?? 0) > 0);
    if (editedEmpIds.length === 0) return data;

    // "all" and "changes" both apply edits — "changes" filtering happens downstream
    let next = [...data];
    for (const empId of editedEmpIds) {
      const state = editorStates[empId];
      if (!state?.current || !Array.isArray(state.current)) continue;

      // Build a set of baseline UIDs to detect which segments are new/modified
      const baselineUids = new Set((state.baseline || []).map((b) => b._uid));
      // Build a map of baseline segments by UID for comparison
      const baselineByUid = new Map((state.baseline || []).map((b) => [b._uid, b]));

      const existingRecord = next.find((r) => r.empId === empId);
      next = next.filter((r) => r.empId !== empId);
      for (const seg of state.current) {
        // Determine if this segment was modified vs unchanged from baseline
        const baseSeg = seg._uid ? baselineByUid.get(seg._uid) : null;
        const isNew = !baseSeg; // Not in baseline → new assignment
        const isChanged =
          baseSeg &&
          (baseSeg.startDate !== seg.startDate ||
            baseSeg.endDate !== seg.endDate ||
            baseSeg.utilization !== seg.utilization ||
            baseSeg.category !== seg.category ||
            baseSeg.jobNo !== seg.jobNo);
        const segHpd = (seg as BaselineSegment & { hoursPerDay?: number }).hoursPerDay;

        next.push({
          ...(existingRecord
            ? {
                firstName: existingRecord.firstName,
                lastName: existingRecord.lastName,
                grade: existingRecord.grade,
                subTeam: existingRecord.subTeam,
                serviceLine: existingRecord.serviceLine,
              }
            : {}),
          empId: seg.empId || empId,
          jobNo: seg.jobNo,
          jobName: seg.jobName,
          startDate: seg.startDate,
          endDate: seg.endDate,
          startDateParsed: seg.startDate,
          endDateParsed: seg.endDate,
          utilization: seg.utilization,
          category: seg.category,
          status: seg.status || "",
          hoursPerDay: segHpd || (seg.utilization / 100) * 8,
          isModified: isNew || !!isChanged,
          isNew,
        });
      }
    }
    return next;
  }, [data, editorStates, modificationsEnabled, baseData]);

  // ── Step 2: "Changes Only" mode — identify edited employees ───────────────
  const editedEmpIds = useMemo(() => {
    if (modificationsEnabled !== "changes") return null;
    const ids = new Set(Object.keys(editorStates).filter((empId) => (editorStates[empId]?.actionLog?.length ?? 0) > 0));
    return ids.size > 0 ? ids : null;
  }, [editorStates, modificationsEnabled]);

  // In "Changes Only" mode, further filter effectiveData to only include
  // the modified assignments (isModified=true) for edited employees
  const changesOnlyData = useMemo(() => {
    if (!editedEmpIds) return effectiveData;
    return effectiveData.filter((r) => editedEmpIds.has(r.empId) && r.isModified);
  }, [effectiveData, editedEmpIds]);

  // ── Step 3: Scenario overlay ──────────────────────────────────────────────
  // Stable selectors — avoid inline .find() that creates new references on every store update
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const scenarios = useScenarioStore((s) => s.scenarios);
  const activeScenario = useMemo(() => {
    if (!activeScenarioId) return null;
    return scenarios.find((s) => s.id === activeScenarioId) || null;
  }, [activeScenarioId, scenarios]);
  const activeAssignmentOverrides = useMemo(() => {
    if (!activeScenarioId) return null;
    const sc = scenarios.find((x) => x.id === activeScenarioId);
    return sc?.assignmentOverrides ?? null;
  }, [activeScenarioId, scenarios]);
  const activeEmployeeOverrides = useMemo(() => {
    if (!activeScenarioId) return null;
    const sc = scenarios.find((x) => x.id === activeScenarioId);
    return sc?.employeeOverrides ?? null;
  }, [activeScenarioId, scenarios]);
  const resolveAssignmentOverrides = useScenarioStore((s) => s.resolveAssignmentOverrides);
  const resolveEmployeeOverrides = useScenarioStore((s) => s.resolveEmployeeOverrides);

  const pipelineInput = modificationsEnabled === "changes" ? changesOnlyData : effectiveData;

  const scenarioData = useMemo(() => {
    // In "Exc. Changes" mode, ignore scenario overrides (revert all)
    if (!activeScenario || modificationsEnabled === "off") return pipelineInput;
    const resolved = resolveAssignmentOverrides(activeScenario.id);
    return applyAssignmentOverrides(pipelineInput, resolved);
  }, [pipelineInput, activeScenario, scenarios, resolveAssignmentOverrides]);

  const scenarioMetadata = useMemo(() => {
    if (!activeScenario || modificationsEnabled === "off") return employeeMetadata;
    const resolved = resolveEmployeeOverrides(activeScenario.id);
    return mergeEmployeeOverrides(employeeMetadata, resolved);
  }, [employeeMetadata, activeScenario, scenarios, resolveEmployeeOverrides]);

  // ── Step 4: Pipeline jobcodes (CRM → jobcode mapping, I&O detection) ─────
  const { pipelineJobcodes, jobcodeOppsList, ioJobcodes, ioLeadJobcodes, effectiveIoJobcodes, showIO } =
    usePipelineJobcodes(sharedData);

  // ── Step 5: SAP processing (segment/SL filtering) ─────
  const { sapLookup, filteredSapLookup } = useSapProcessing(
    rawSapLookup,
    segmentFilter,
    segmentModes,
    serviceLineFilter,
    serviceLineModes,
    pipelineJobcodes
  );

  // ── Step 6: SAP enrichment (grades + presence dates) ──────────────────────
  const sapEnrichment = useMemo(() => {
    if (!sapLookup || !sapData) return null;
    const gradeResults = detectGradesFromSap(sapLookup);
    const internToAnalyst = Object.keys(gradeResults).length > 0 ? detectInternToAnalyst(sapLookup, gradeResults) : {};
    const presenceDates =
      sapData.minDate && sapData.maxDate ? detectPresenceDates(sapLookup, sapData.minDate, sapData.maxDate) : {};
    return { gradeResults, internToAnalyst, presenceDates };
  }, [sapLookup, sapData]);

  // ── Step 7: Merge SAP-detected presence dates into metadata ───────────────
  // Only explicitly manual dates (manualArrival/manualDeparture) take priority over SAP
  const effectiveMetadata = useMemo(() => {
    const sapDates = sapEnrichment?.presenceDates;
    if (!sapDates || Object.keys(sapDates).length === 0) return scenarioMetadata;
    const merged: Record<string, EmployeeMetadata> = { ...scenarioMetadata };
    for (const empId of Object.keys(sapDates)) {
      const sap = sapDates[empId];
      const existing = merged[empId];
      if (existing) {
        const isManualArr = !!existing.manualArrival;
        const isManualDep = !!existing.manualDeparture;
        merged[empId] = {
          ...existing,
          arrivalDate: isManualArr ? existing.arrivalDate : sap.arrivalDate || existing.arrivalDate,
          departureDate: isManualDep ? existing.departureDate : sap.departureDate || existing.departureDate,
          manualArrival: isManualArr,
          manualDeparture: isManualDep,
        };
      } else {
        merged[empId] = {
          gradeHistory: [],
          arrivalDate: sap.arrivalDate,
          departureDate: sap.departureDate,
          manualArrival: false,
          manualDeparture: false,
        };
      }
    }
    return merged;
  }, [scenarioMetadata, sapEnrichment]);

  // ── Step 7b: Inject hired recruitment metadata into effectiveMetadata ──────
  const { candidates: allCandidates } = useRecruitmentData();
  const hiredCandidates = useMemo(() => allCandidates.filter((c) => c.status === "hired"), [allCandidates]);

  const effectiveMetadataWithRecruit = useMemo(() => {
    if (hiredCandidates.length === 0) return effectiveMetadata;
    const GRADE_MAP: Record<string, string> = { Intern: "Intern", Analyst: "Analyst", "Consultant+": "Consultant" };
    const merged = { ...effectiveMetadata };
    for (const c of hiredCandidates) {
      if (c.matchedEmpId) continue;
      const empId = `recruit_${c.id}`;
      if (merged[empId]?.rejected) continue; // rejected by user
      if (merged[empId]?.segment) continue; // user already confirmed metadata — don't overwrite
      const grade = c.gradeBucket || GRADE_MAP[c.grade] || "Analyst";
      const dates = [c.recruiter1Date, c.recruiter2Date, c.recruiter3Date, c.hrInterviewDate]
        .filter((d) => d && d.length >= 10)
        .map((d) => d.slice(0, 10))
        .sort();
      const arrivalDate = dates.length > 0 ? dates[dates.length - 1] : c.lastActivity?.slice(0, 10) || "";
      const cWithApps = c as typeof c & { applications?: Array<{ segment?: string; offering?: string }> };
      const firstSeg = cWithApps.applications?.find((a) => a.segment)?.segment;
      const firstOff = cWithApps.applications?.find((a) => a.offering)?.offering;
      // Only set grade + arrivalDate for pipeline display. Don't set segment/serviceLine
      // so the employee modal shows empty fields with recruitment hints as placeholders.
      merged[empId] = {
        gradeHistory: [{ grade, since: arrivalDate }],
        arrivalDate,
        source: "recruitment",
        // Hints shown as placeholders in the employee modal — not saved until user confirms
        _recruitmentHints: {
          segment: firstSeg || "",
          serviceLine: firstOff || "",
          arrivalDate,
          grade,
        },
      };
    }
    return merged;
  }, [effectiveMetadata, hiredCandidates]);

  // ── Step 8: Core data pipeline (raw → employeeStructures → enriched) ──────
  const { employeeStructures, allEnrichedEmployees, enrichedGanttData } = useDataPipeline(
    scenarioData,
    enabledHolidayDates,
    sapLookup,
    sapEnrichment,
    scenarioMetadata,
    manualEmployeesFromStore,
    hiredCandidates,
    skillsData,
    effectiveMetadataWithRecruit,
    timelineStart,
    timelineEnd
  );

  // Batch all enrichedGanttData derivatives into a single useMemo (avoids 4 separate recomputations)
  const { projects, alerts, uniqueProjects, managerList } = useMemo(
    () => ({
      projects: extractProjects(enrichedGanttData),
      alerts: generateAlerts(enrichedGanttData),
      uniqueProjects: getUniqueProjects(enrichedGanttData),
      managerList: buildManagerList(enrichedGanttData),
    }),
    [enrichedGanttData]
  );

  // ── Step 9: "Changes Only" post-pipeline filter ───────────────────────────
  const changesFilteredGanttData = useMemo(() => {
    if (!editedEmpIds) return enrichedGanttData;
    return enrichedGanttData.filter((emp) => editedEmpIds.has(emp.empId) || editedEmpIds.has(emp._realEmpId ?? ""));
  }, [enrichedGanttData, editedEmpIds]);

  const changesFilteredAllEmployees = useMemo(() => {
    if (!editedEmpIds) return allEnrichedEmployees;
    return allEnrichedEmployees.filter((emp) => editedEmpIds.has(emp.empId) || editedEmpIds.has(emp._realEmpId ?? ""));
  }, [allEnrichedEmployees, editedEmpIds]);

  // ── Step 10: Assignment-level filtering (Opp-mode segments, SL, I&O) ─────
  const { assignmentFilteredData, allEmployeesForTrendBase } = useAssignmentFiltering(
    changesFilteredGanttData,
    changesFilteredAllEmployees,
    segmentFilter,
    segmentModes,
    serviceLineFilter,
    serviceLineModes,
    pipelineJobcodes,
    showIO,
    ioJobcodes,
    ioLeadJobcodes,
    chargeableCombined
  );

  // ── Step 11: Daily grid + employee rate enrichment ────────────────────────
  const {
    timelineCalendar,
    workingDaysCount,
    sapMonthDateStrs,
    sapMonthWorkDays,
    dailyGrid,
    deferredDailyGrid,
    deferredCalendar,
    employeesWithRates,
    useSapActuals,
  } = useDailyGrid(
    assignmentFilteredData,
    timelineStart,
    timelineEnd,
    enabledHolidayDates,
    filteredSapLookup,
    chargeableCombined,
    dataSourceDebug,
    ioJobcodes,
    isDraggingRef
  );

  // ── Step 12: Employee filtering, grade merge, display pipeline ────────────
  const {
    filteredEmployees,
    allEmployeesForTrend,
    stableEmpCount,
    displayedEmployees,
    effectiveDailyGrid,
    teamNetHours,
    uniqueProjectCount,
  } = useEmployeeFiltering({
    employeesWithRates,
    allEmployeesForTrendBase,
    filters,
    macroGradeFilter,
    macroCategoryFilter,
    segmentFilter,
    segmentModes,
    serviceLineFilter,
    serviceLineModes,
    managerFilter,
    managerList,
    pipelineJobcodes,
    showIO,
    groupingLevels,
    heatmapMode,
    chargeableCombined,
    dailyGrid,
    timelineStart,
    timelineEnd,
    dataSourceDebug,
  });

  // ── Build grouped result objects ──────────────────────────────────────────

  const scenario = {
    active: activeScenario,
    assignmentOverrides: activeAssignmentOverrides,
    employeeOverrides: activeEmployeeOverrides,
    all: scenarios,
  };

  const sap = { lookup: sapLookup, filteredLookup: filteredSapLookup, enrichment: sapEnrichment };

  const pipeline = {
    jobcodes: pipelineJobcodes,
    oppsList: jobcodeOppsList,
    ioJobcodes,
    ioLeadJobcodes,
    effectiveIoJobcodes,
    showIO,
  };

  const employees = {
    structures: employeeStructures,
    allEnriched: allEnrichedEmployees,
    enrichedGantt: enrichedGanttData,
  };

  const grid = {
    calendar: timelineCalendar,
    workingDaysCount,
    sapMonthDateStrs,
    sapMonthWorkDays,
    daily: dailyGrid,
    deferredDaily: deferredDailyGrid,
    deferredCalendar,
    employeesWithRates,
    useSapActuals,
  };

  const filtered = {
    employees: filteredEmployees,
    allForTrend: allEmployeesForTrend,
    stableCount: stableEmpCount,
    displayed: displayedEmployees,
    effectiveGrid: effectiveDailyGrid,
    teamNetHours,
    uniqueProjectCount,
  };

  // ── Return all pipeline outputs ───────────────────────────────────────────
  return {
    effectiveData,
    editedEmpIds,
    effectiveMetadata: effectiveMetadataWithRecruit,
    projects,
    alerts,
    uniqueProjects,
    managerList,
    scenario,
    sap,
    pipeline,
    employees,
    grid,
    filtered,
  };
}
