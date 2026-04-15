/**
 * Shared type definitions for the StaffingTab module.
 */
import { getToday } from "../../utils/formatters";

// ─── Core entity types ──────────────────────────────────────────────────────

export interface ConsolidatedAssignment {
  jobName: string;
  jobNo: string;
  periods: Array<{
    startDate: string | Date;
    endDate: string | Date;
    utilization: number;
    hoursPerDay: number;
    status: string;
    category: string;
  }>;
  totalUtilization: number;
  totalHours: number;
  status: string;
  hasProvisional: boolean;
  isNew: boolean;
  isModified: boolean;
  category: string;
  _isNewCreation?: boolean;
  _isProposed?: boolean;
  _isUserAssignment?: boolean;
}

export interface Assignment {
  _uid?: string;
  empId: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  hoursPerDay: number;
  workingDays: number;
  totalHours: number;
  status: string;
  category: string;
  firstName?: string;
  lastName?: string;
  needId?: string;
  [key: string]: any;
}

export interface Employee {
  empId: string;
  name: string;
  grade: string;
  subTeam: string;
  serviceLine?: string;
  directManager?: string;
  assignments: Assignment[];
  trueUtilizationRate: number;
  trueOccupationRate?: number;
  availableCapacityHours: number;
  netAvailableHours?: number;
  projectCount: number;
  chargeableHours: number;
  chargeableOnlyRate?: number;
  generalOpptyHours?: number;
  totalUtilization?: number;
  trainingHours?: number;
  absenceHours?: number;
  otherHours?: number;
  totalHours?: number;
  projects?: Set<string>;
  totalWorkingDaysInPeriod?: number;
  totalHolidayDaysInPeriod?: number;
  totalAbsenceHoursInPeriod?: number;
  totalChargeableHoursInPeriod?: number;
  totalChargeableOnlyHoursInPeriod?: number;
  totalTrainingHoursInPeriod?: number;
  totalNetHours?: number;
  tuTransitionLossHours?: number;
  tuTransitionLossPoints?: number;
  fragScore?: number;
  skills?: Skill[];
  avgSkillLevel?: number;

  // ── Computed display metrics (set by useDailyGrid / data pipeline) ──────
  _displayTU?: number;
  _displayTO?: number;
  _displayNetH?: number;
  _displayChH?: number;
  _displayTrH?: number;
  _displayAbsH?: number;
  /** Number of active working days in the timeline */
  _displayActiveN?: number;
  /** Number of days the employee is present (arrival/departure aware, ETP-weighted) */
  _presenceActiveN?: number;

  // ── Pre-computed data (set by buildEmployeeStructures) ─────────────────
  /** Consolidated assignments (output of consolidateAssignments) */
  _consolidated?: ConsolidatedAssignment[];
  /** Normalized periods with timestamps (output of normalizePeriods) */
  _periods?: Array<{
    start: number;
    end: number;
    category: string;
    util: number;
    name?: string;
    jobNo?: string;
    isNew?: boolean;
  }>;
  /** Lowercase search index for fast text filtering */
  _searchIndex?: string;
  /** Pre-computed hours info (cached computeDailyMetrics result) */
  _hoursInfo?: EmployeeGridMetrics;

  // ── Grade split fields (set by splitByGradeTransitions) ────────────────
  _isGradeSplit?: boolean;
  _realEmpId?: string;
  /** 0-based index within the split sequence */
  _gradeIndex?: number;
  /** Total number of grade splits for this employee */
  _gradeSplitCount?: number;
  _gradeTransition?: { from: string; to: string; since: string } | null;
  _gradeHistory?: GradeTransition[];

  // ── Employee lifecycle (set by data pipeline from metadata) ────────────
  _arrivalDate?: string;
  _departureDate?: string;
  _etpAdjustments?: EtpAdjustment[];

  // ── SAP metrics (set by useDailyGrid) ─────────────────────────────────
  _sapOnly?: boolean;
  /** SAP coverage percentage (0-100) */
  _sapPct?: number;
  /** Total SAP day count in the timeline */
  _sapDayCount?: number;
  /** Active (non-weekend/holiday) SAP day count */
  _sapActiveDayCount?: number;
  /** Hours where SAP exceeds MDS forecast */
  _sapOverH?: number;
  /** Hours where SAP is missing vs MDS forecast */
  _sapMissingH?: number;
  /** Whether SAP data has anomalies */
  _hasSapAnomaly?: boolean;

  // ── Variance metrics (set by useDailyGrid) ────────────────────────────
  /** SAP - MDS chargeable hours delta */
  _varianceHours?: number | null;
  /** SAP - MDS TU delta in percentage points */
  _varianceRate?: number | null;

  // ── I&O metrics (set by data pipeline) ────────────────────────────────
  /** I&O TU percentage */
  _ioTU?: number | null;
  /** I&O chargeable hours */
  _ioChHours?: number | null;

  // ── Fragmentation & potential (set by useDailyGrid) ───────────────────
  _fragScore?: number;
  _transitionLoss?: number;
  _potentialGainPct?: number;
  _potentialGainH?: number;

  // ── Bulk edit flag (set during assignment creation) ────────────────────
  _isNewCreation?: boolean;

  // ── Recruitment tracking (set by useDataPipeline) ─────────────────────
  _isRecruit?: boolean;

  // ── SAP project data (set by useDataPipeline from SAP lookups) ────────
  _sapProjects?: SapProject[];
}

export interface Skill {
  skillShort: string;
  skillFull: string;
  category: string;
  level: number;
}

// ─── Employee metadata (editable metadata) ──────────────────────────────────

export interface GradeTransition {
  grade: string;
  since: string; // ISO date YYYY-MM-DD
  until?: string; // ISO date YYYY-MM-DD — last SAP day with this grade
}

export interface EtpAdjustment {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
  ratio: number; // 0.0–1.0 (e.g. 0.5 = mi-temps)
}

export interface EmployeeMetadata {
  name?: string;
  /** @deprecated Use `segment` instead. Kept for backward compatibility with older saved data. */
  team?: string;
  segment?: string;
  serviceLine?: string;
  dm?: string;
  role?: string;
  arrivalDate?: string; // ISO date
  departureDate?: string; // ISO date
  manualArrival?: boolean; // true = user explicitly set this date
  manualDeparture?: boolean; // true = user explicitly set this date
  gradeHistory: GradeTransition[];
  etpAdjustments?: EtpAdjustment[];
  /** Source of this metadata entry (e.g. 'recruitment') */
  source?: string;
  /** Recruitment candidate rejected by user */
  rejected?: boolean;
  /** Recruitment hints shown as placeholders in the employee modal */
  _recruitmentHints?: { segment?: string; serviceLine?: string; arrivalDate?: string; grade?: string };
}

/**
 * Get the ETP ratio for an employee on a given date.
 * Returns 1.0 if no adjustments or no matching range.
 */
export const getEtpRatio = (adjustments: EtpAdjustment[] | undefined, dateStr: string): number => {
  if (!adjustments?.length) return 1.0;
  for (const adj of adjustments) {
    if (dateStr >= adj.startDate && dateStr <= adj.endDate) return adj.ratio;
  }
  return 1.0;
};

/**
 * Resolve the effective grade from a grade history at a given date.
 * Transitions are sorted by `since` (ascending); the effective grade is the
 * last transition whose `since` date is ≤ the reference date.
 * Falls back to the first entry if no `since` dates are filled in.
 */
export const getEffectiveGrade = (history: GradeTransition[], refDate: string = getToday()): string | null => {
  if (!history || history.length === 0) return null;

  // Sort by date ascending (empty dates treated as very early)
  const sorted = [...history].sort((a, b) => (a.since || "0000-00-00").localeCompare(b.since || "0000-00-00"));

  // Walk backwards to find the last transition that is active at refDate
  let effective: string | null = sorted[0].grade; // default: earliest entry
  for (const t of sorted) {
    if (!t.since || t.since <= refDate) {
      effective = t.grade;
    }
  }

  return effective;
};

// ─── Hours/utilization types ────────────────────────────────────────────────

export interface HoursSummary {
  absH: number;
  holH: number;
  chH: number;
  goH: number;
  trH: number;
  resH: number;
  ncH: number;
  otH: number;
  netH: number;
  diH: number;
  tu: number;
  to: number;
  totalBase: number;
}

export interface CatBreakdownItem {
  category: string;
  util?: number;
  avg?: number;
  jobName?: string;
  jobNo?: string;
}

// ─── Heatmap cell types ─────────────────────────────────────────────────────

export interface HeatmapCell {
  label: string;
  tuRate: number;
  isWeekend?: boolean;
  isSap?: boolean;
  span?: number;
  workDays?: number;
  sapDayCount?: number;
  varianceRate?: number;
  varianceHours?: number;
  sapTuRate?: number;
  sapChHours?: number;
  forecastChHours?: number;
  forecastTuRateBucket?: number;
  catBreakdown?: CatBreakdownItem[];
  sapCatBreakdown?: CatBreakdownItem[];
  forecastCatBreakdown?: CatBreakdownItem[];
  segments?: CatBreakdownItem[];
  forecastSegments?: CatBreakdownItem[];
  avgSapEmpCount?: number;
  theoTU?: number;
}

// ─── Daily Grid types (single source of truth for all daily computations) ──

export interface DailyCellSegment {
  name: string;
  jobNo: string | null;
  category: string;
  util: number;
}

export interface DailyCell {
  dateStr: string;
  isWE: boolean;
  isHoliday: boolean;
  // Raw utilization breakdown
  absU: number;
  chU: number;
  goU: number;
  trU: number;
  otU: number;
  rawGoU: number;
  // Capped values (priority: abs > ch > go > tr > ot)
  cappedAbsU: number;
  cappedChU: number;
  cappedGoU: number;
  cappedTrU: number;
  cappedTotal: number;
  // Derived rates
  tuRate: number;
  toRate: number;
  netU: number;
  // Segments for tooltip decomposition
  segments: DailyCellSegment[];
  absScale: number;
  chScale: number;
  goScale: number;
  trScale: number;
  // SAP overlay
  isSap: boolean;
  forecastSegments: DailyCellSegment[] | null;
  forecastTuRate: number | null;
  forecastChU: number | null;
  forecastAbsRate: number | null;
  hasStaffing: boolean;
  isForcedAbsence?: boolean;
  // Overcapacity-aware chargeable (new-creation priority)
  effectiveChU?: number;
  // Fragmentation data (for metrics derivation)
  dayWorkUtils: number[] | null;
  // UI-layer flag for arrival/departure inactive marking
  isInactive?: boolean;
}

export interface EmployeeGridMetrics {
  tu: number;
  to: number;
  workDays: number;
  totalH: number;
  absenceH: number;
  holidayH: number;
  netH: number;
  chargeableH: number;
  generalOpptyH: number;
  trainingH: number;
  otherH: number;
  dispoH: number;
  fragScore: number;
  tuTransitionLossHours: number;
  tuTransitionLossPoints: number;
  shortfallDetails: Array<{ dayIdx: number; rate: number; neighborMax: number; shortfall: number }>;
  varianceRate: number | null;
  varianceHours: number | null;
  sapPct: number;
  // Forecast-only metrics (MDS data only, excludes SAP actual values)
  forecastTotalH: number;
  forecastAbsenceH: number;
  forecastNetH: number;
  forecastChargeableH: number;
  forecastGeneralOpptyH: number;
  forecastTrainingH: number;
  forecastOtherH: number;
  forecastTU: number;
}

export interface EmployeeDailyData {
  empId: string;
  cells: DailyCell[];
  metrics: EmployeeGridMetrics;
}

export interface CalendarDay {
  date: Date;
  dow: number;
  isWE: boolean;
  dateStr: string;
  ts: number;
  month: number;
  isHoliday: boolean;
}

// ─── Manager types ──────────────────────────────────────────────────────────

export interface Manager {
  empId: string;
  name: string;
  grade: string;
  subTeam: string;
  reportIds: Set<string>;
}

// ─── File detection types ───────────────────────────────────────────────────

export type FileType = "opportunity" | "staffing" | "sap" | "skills";

export interface FileDetectionResult {
  type: FileType;
  confidence: number;
  scores: Partial<Record<FileType, number>>;
}

// ─── Filter types ───────────────────────────────────────────────────────────

/** Include/exclude filter used by segment, service-line, macro-grade, macro-category */
export type { FilterValue as IncludeExcludeFilter } from "../../utils/filterHelpers";

export interface SearchTag {
  text: string;
  type: string;
  minLevel?: number;
}

export interface StaffingFilters {
  search: string;
  utilization: string;
  project: string;
  categories: string[];
  minAvailability: number;
  grades: string;
  subTeams: string;
  serviceLine: string;
  sortBy: string;
  sortOrder: string;
  autoSort: boolean;
  cascadeFilters: CascadeFilter[];
  skillSearch: string;
  skillMinLevel: number;
  hideTu100: boolean;
  hideTuAboveTarget: boolean;
  gradeTransitionOnly: boolean;
  mergeGradeRows: boolean;
  sapAnomalyOnly: boolean;
  showAllEmployees: boolean;
  sapFilter: string;
  churnFilter: string;
  dispoMin: number;
  dispoMax: number;
  searchTags: SearchTag[];
  searchScope: string;
  showBadges: boolean;
  showDetails: boolean;
}

export interface CascadeFilter {
  criterion: string;
  value: { min?: number; max?: number } | string;
}

/** SAP upload result from backend */
export interface SapUploadResult {
  records?: SapRecord[];
  lookup?: SapLookup;
  minDate?: string;
  maxDate?: string;
  totalRecords?: number;
  totalEmployees?: number;
  totalDays?: number;
  employeeIds?: string[];
}

/** Raw staffing record from file upload / hydration */
export interface StaffingRecord {
  empId: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  subTeam?: string;
  serviceLine?: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  startDateParsed?: string;
  endDateParsed?: string;
  utilization: number;
  category: string;
  status?: string;
  hoursPerDay?: number;
  isModified?: boolean;
  isNew?: boolean;
  [key: string]: unknown;
}

// ─── Scenario types ────────────────────────────────────────────────────────

export interface AssignmentOverride {
  type: "create" | "edit" | "delete";
  data: Partial<Assignment> & { empId: string; jobNo: string; startDate: string };
}

export interface EmployeeOverride {
  metadata?: Partial<EmployeeMetadata>;
  isVirtual?: boolean;
  isRemoved?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  baseScenarioId: string | null;
  assignmentOverrides: Record<string, AssignmentOverride>;
  employeeOverrides: Record<string, EmployeeOverride>;
}

// ─── SAP data types ─────────────────────────────────────────────────────────

export interface SapRecord {
  category: string;
  hours: number;
  sapKey?: string;
  [key: string]: any;
}

/** SAP day data: per-day SAP breakdown */
export interface SapDayData {
  records: SapRecord[];
  categories?: Record<string, number>;
}

/** SAP lookup: empId → dateStr → { records, categories? } */
export type SapLookup = Record<string, Record<string, SapDayData>>;

/** SAP project info attached to Employee._sapProjects */
export interface SapProject {
  name: string;
  code: string;
  minDate: string;
  maxDate: string;
}

/** Result of grade detection from SAP Activity Type data */
export interface SapGradeResult {
  grade: string;
  gradeHistory: GradeTransition[];
}

/** Complete SAP enrichment from the detection pipeline */
export interface SapEnrichment {
  gradeResults: Record<string, SapGradeResult>;
  internToAnalyst: Record<string, string>;
  presenceDates: Record<string, { arrivalDate?: string; departureDate?: string }>;
}

/** Skills for a single employee */
export interface EmployeeSkills {
  skills?: Skill[];
  skillsByCategory?: unknown;
  topSkills?: unknown;
  skillCount?: number;
  avgLevel?: number;
  certifications?: unknown;
}

/** Skills data structure from backend hydration */
export interface SkillsData {
  skills: Map<string, EmployeeSkills>;
}

/** Single opportunity/jobcode in the CRM pipeline */
export interface PipelineJobcode {
  opportunityName: string;
  opportunityId: string;
  status: string;
  account: string;
  revenue: number;
  em: string;
  winPct: number | null;
  segment: string;
  serviceLine: string;
  serviceLine2: string;
  serviceLine3: string;
  techPartner1: string;
  techPartner2: string;
  techPartner3: string;
  creationDate: string;
}

// ─── Staffing needs types ───────────────────────────────────────────────────

export interface StaffingNeedItem {
  id: string;
  opportunityId: string;
  jobNo?: string;
  jobName?: string;
  grade?: string;
  startDate?: string;
  endDate?: string;
  utilization?: number;
  status?: string;
  category?: string;
  skills?: string[];
  notes?: string;
  [key: string]: any;
}

// ─── Bulk edit types ────────────────────────────────────────────────────────

export interface BulkEditOperation {
  type: string;
  empId: string;
  data?: Partial<Assignment>;
  [key: string]: any;
}

// ─── Enriched employee convenience alias ────────────────────────────────────

/**
 * Convenience alias for Employee with all computed fields populated.
 * Use this when working with employees after they have been through the
 * full data pipeline (buildEmployeeStructures → enrichment → useDailyGrid).
 */
export type EnrichedEmployee = Required<
  Pick<
    Employee,
    | "empId"
    | "name"
    | "grade"
    | "subTeam"
    | "assignments"
    | "trueUtilizationRate"
    | "availableCapacityHours"
    | "projectCount"
    | "chargeableHours"
  >
> &
  Omit<
    Employee,
    | "empId"
    | "name"
    | "grade"
    | "subTeam"
    | "assignments"
    | "trueUtilizationRate"
    | "availableCapacityHours"
    | "projectCount"
    | "chargeableHours"
  >;

// ─── Waterfall chart types ──────────────────────────────────────────────────

export interface WaterfallStep {
  label: string;
  value: number;
  offset: number;
  type: "result" | "sub";
  color: string;
  tc?: string;
}
