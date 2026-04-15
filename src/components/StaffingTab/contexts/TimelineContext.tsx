import { createContext, useContext } from "react";
import type { CalendarDay } from "../types";

// ── Geometry Context (layout/zoom changes) ──────────────────────────────────
export interface TimelineGeometryContextType {
  timelineStart: Date;
  timelineEnd: Date;
  calendar: CalendarDay[];
  granularity: "day" | "week" | "2week" | "halfmonth" | "month";
  dayWidth: number;
  weekendMarkers: Array<{ left: number; width: number }>;
  holidayMarkers: Array<{ left: number; width: number; label: string }>;
  labels: Array<{ left: number; label: string; dateStr: string }>;
  monthLabels: Array<{ left: number; width: number; label: string }>;
}

// ── Data Context (data/mode changes) ────────────────────────────────────────
export interface TimelineDataContextType {
  heatmapMode: string;
  chargeableCombined: boolean;
  enabledHolidayDates: Set<string>;
  showUtilization: boolean;
  sapLookup: Record<string, any> | null;
  useSapActuals: boolean;
  pipelineJobcodes: Map<string, any> | null;
  jobcodeOppsList: Map<string, any[]> | null;
  ioJobcodes: Set<string> | null;
  showIO: string;
  showDetails: boolean;
}

// ── Signals Context (ephemeral, high-churn signals isolated to avoid mass re-renders) ──
export interface TimelineSignalsContextType {
  bulkCancelAllSignal?: number;
  justSavedEmpId?: string | null;
}

// ── Handlers Context (stable callbacks) ─────────────────────────────────────
export interface TimelineHandlersContextType {
  onDeleteAssignment: (assignment: any) => void;
  onRevertAssignment: (assignment: any) => void;
  onHeatmapDateRangeSelect: (start: string | Date, end: string | Date, target?: any) => void;
  onNavigateToTab: (tab: string) => void;
  onNavigateToOpportunity: (jobNo: string) => void;
  onNameClick: (employee: any) => void;
  onToggleCategory: (
    empId: string,
    jobNo: string,
    startDate: string,
    jobName: string,
    newCategory: string,
    dates?: string[]
  ) => void;
  onDropNeed: (empId: string, needData: any) => void;
  onDragEnd: (result: any) => void;
  onBulkSaveAssignment: (empId: string, operations: any[]) => void;
  onViewPlanning: (employee: any) => void;
  onViewCalendar: (employee: any) => void;
  onBulkEditChange?: (empId: string, open: boolean) => void;
  clearJustSaved?: () => void;
}

// Combined type moved below after all individual types are defined

const GeometryContext = createContext<TimelineGeometryContextType | null>(null);
const DataContext = createContext<TimelineDataContextType | null>(null);
const HandlersContext = createContext<TimelineHandlersContextType | null>(null);
const SignalsContext = createContext<TimelineSignalsContextType | null>(null);

export const TimelineGeometryProvider = GeometryContext.Provider;
export const TimelineDataProvider = DataContext.Provider;
export const TimelineHandlersProvider = HandlersContext.Provider;
export const TimelineSignalsProvider = SignalsContext.Provider;

// Keep backward-compatible provider export
export const TimelineProvider = GeometryContext.Provider;

export function useTimelineGeometry(): TimelineGeometryContextType {
  const ctx = useContext(GeometryContext);
  if (!ctx) throw new Error("useTimelineGeometry must be used within a TimelineGeometryProvider");
  return ctx;
}

export function useTimelineData(): TimelineDataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useTimelineData must be used within a TimelineDataProvider");
  return ctx;
}

export function useTimelineHandlers(): TimelineHandlersContextType {
  const ctx = useContext(HandlersContext);
  if (!ctx) throw new Error("useTimelineHandlers must be used within a TimelineHandlersProvider");
  return ctx;
}

export function useTimelineSignals(): TimelineSignalsContextType {
  const ctx = useContext(SignalsContext);
  if (!ctx) throw new Error("useTimelineSignals must be used within a TimelineSignalsProvider");
  return ctx;
}

// Backward-compatible combined hook — returns all 4 contexts merged
export type TimelineContextType = TimelineGeometryContextType &
  TimelineDataContextType &
  TimelineHandlersContextType &
  TimelineSignalsContextType;

export function useTimelineContext(): TimelineContextType {
  const geo = useContext(GeometryContext);
  const data = useContext(DataContext);
  const handlers = useContext(HandlersContext);
  const signals = useContext(SignalsContext);
  if (!geo || !data || !handlers || !signals)
    throw new Error("useTimelineContext must be used within Timeline providers");
  return { ...geo, ...data, ...handlers, ...signals };
}

export default GeometryContext;
