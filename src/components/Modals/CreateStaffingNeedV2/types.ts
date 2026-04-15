/**
 * Types for the CreateStaffingNeedV2 modal.
 */

export interface NeedFormState {
  grade: string;
  startDate: string;
  endDate: string;
  utilization: number;
  probability: number;
  quantity: number;
  skills: string[];
  preferredPerson: string;
  description: string;
}

export const emptyFormState = (): NeedFormState => ({
  grade: "",
  startDate: "",
  endDate: "",
  utilization: 100,
  probability: 100,
  quantity: 1,
  skills: [],
  preferredPerson: "",
  description: "",
});

/** A staged need that has been added but not yet persisted */
export interface StagedNeed {
  id: string;
  grade: string;
  startDate: string;
  endDate: string;
  utilization: number;
  probability: number;
  quantity: number;
  skills: string[];
  preferredPerson: string;
  description: string;
}

/** Simplified assignment for timeline display */
export interface TimelineAssignment {
  empId: string;
  empName: string;
  grade: string;
  jobNo: string;
  jobName: string;
  startDate: string;
  endDate: string;
  utilization: number;
  category: string;
}

export type TimelineSection = "past" | "current" | "upcoming" | "needs";

/** Timeline bar data (unified for assignments and needs) */
export interface TimelineBar {
  id: string;
  section: TimelineSection;
  grade: string;
  label: string;
  sublabel?: string;
  startDate: string;
  endDate: string;
  utilization: number;
  isPreview?: boolean;
  isExistingNeed?: boolean;
  quantity?: number;
}

/** Gantt range for timeline display */
export interface GanttRange {
  minDate: string;
  maxDate: string;
  totalDays: number;
}

/** Month column for timeline axis */
export interface MonthColumn {
  label: string;
  widthPct: number;
  isCurrent?: boolean;
}

/** Impact metrics for demand/supply/gap */
export interface ImpactMetrics {
  currentDemand: number;
  currentSupply: number;
  currentGap: number;
  afterGap: number;
  deltaGap: number;
  periodLabel: string;
}

/** Props for the modal — same public API as the old component */
export interface CreateStaffingNeedModalProps {
  open: boolean;
  onClose: () => void;
  opportunityData?: Record<string, any>[];
  initialOpportunity?: Record<string, any> | null;
}
