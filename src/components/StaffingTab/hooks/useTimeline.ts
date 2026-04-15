import { useState, useMemo, useCallback, useRef } from "react";
import { TIMEFRAME_OPTIONS, MS_PER_DAY } from "../constants";
import {
  getTimelineRange,
  getTimelineLabels,
  getMonthLabels,
  getWeekendMarkers,
  getHolidayMarkers,
} from "../utils/timelineUtils";
import { isPublicHoliday, formatLocalDate } from "../utils/dateUtils";
import { recordPerfStep } from "../utils/perf";

interface CustomDateRange {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

/**
 * Custom hook for timeline management
 * @returns {object} - Timeline state, computed values, and handlers
 */
export const useTimeline = () => {
  const [timeframe, setTimeframe] = useState<string>(TIMEFRAME_OPTIONS.QUARTER);
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({
    enabled: false,
    startDate: "",
    endDate: "",
  });
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Base timeline range (before zoom)
  const { startDate: rawStart, endDate: rawEnd } = useMemo(() => {
    const t0 = performance.now();
    const result = getTimelineRange(timeframe, customDateRange);
    recordPerfStep(
      "getTimelineRange",
      performance.now() - t0,
      `${result.startDate.toISOString().slice(0, 10)} → ${result.endDate.toISOString().slice(0, 10)}`
    );
    return result;
  }, [timeframe, customDateRange]);

  // Zoomed timeline: keep start fixed, extend/contract end
  const timelineStart = rawStart;
  const timelineEnd = useMemo(() => {
    if (zoomLevel === 1) return rawEnd;
    const range = rawEnd.getTime() - rawStart.getTime();
    return new Date(rawStart.getTime() + range / zoomLevel);
  }, [rawStart, rawEnd, zoomLevel]);

  // Memoized timeline labels
  const labels = useMemo(() => {
    const t0 = performance.now();
    const result = getTimelineLabels(timeframe, timelineStart, timelineEnd);
    recordPerfStep("getTimelineLabels", performance.now() - t0, `${result.length} labels`);
    return result;
  }, [timeframe, timelineStart, timelineEnd]);

  // Memoized month labels
  const monthLabels = useMemo(() => {
    const t0 = performance.now();
    const result = getMonthLabels(timelineStart, timelineEnd, timeframe);
    recordPerfStep("getMonthLabels", performance.now() - t0, `${result.length} months`);
    return result;
  }, [timelineStart, timelineEnd, timeframe]);

  // Memoized weekend markers
  const weekendMarkers = useMemo(() => {
    const t0 = performance.now();
    const result = getWeekendMarkers(timelineStart, timelineEnd);
    recordPerfStep("getWeekendMarkers", performance.now() - t0, `${result.length} weekends`);
    return result;
  }, [timelineStart, timelineEnd]);

  // Memoized holiday markers
  const holidayMarkers = useMemo(() => {
    const t0 = performance.now();
    const result = getHolidayMarkers(timelineStart, timelineEnd, isPublicHoliday);
    recordPerfStep("getHolidayMarkers", performance.now() - t0, `${result.length} holidays`);
    return result;
  }, [timelineStart, timelineEnd]);

  // Day width calculation
  const dayWidth = useMemo(() => {
    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / MS_PER_DAY;
    recordPerfStep("dayWidth", 0, `${Math.round(totalDays)} days visible`);
    return 100 / totalDays;
  }, [timelineStart, timelineEnd]);

  // Handler for timeframe change
  const handleTimeframeChange = useCallback((value: string): void => {
    if (value === TIMEFRAME_OPTIONS.CUSTOM) {
      setCustomDateRange((prev) => ({ ...prev, enabled: true }));
    } else {
      setCustomDateRange({ enabled: false, startDate: "", endDate: "" });
      setTimeframe(value);
    }
    setZoomLevel(1);
  }, []);

  // Handler for custom date change
  const handleCustomDateChange = useCallback((field: string, value: string): void => {
    setCustomDateRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Format a Date to YYYY-MM-DD using local-time components
  const fmtLocal = (d: Date): string => {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Snap a date to the nearest half-month boundary (1st or 16th)
  const snapToHalfMonth = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDate();
    const distTo1 = day - 1;
    const distTo16 = Math.abs(day - 16);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const distToNext1 = daysInMonth - day + 1;
    if (distTo1 <= distTo16 && distTo1 <= distToNext1) {
      d.setDate(1);
    } else if (distTo16 <= distToNext1) {
      d.setDate(16);
    } else {
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Set custom date range atomically (used by heatmap drag-select & zoom).
  // Uses functional updaters with ref-equality bail-out so that duplicate
  // calls (e.g. rAF + mouseup with the same dates) don't trigger extra renders.
  const setCustomDateRangeDirect = useCallback((startDateStr: string, endDateStr: string): void => {
    setCustomDateRange((prev) =>
      prev.enabled && prev.startDate === startDateStr && prev.endDate === endDateStr
        ? prev
        : { enabled: true, startDate: startDateStr, endDate: endDateStr }
    );
    setZoomLevel((prev) => (prev === 1 ? prev : 1));
  }, []);

  // Refs for stable zoom handlers (avoid recreating callbacks on every timeline change)
  const timelineStartRef = useRef(timelineStart);
  timelineStartRef.current = timelineStart;
  const timelineEndRef = useRef(timelineEnd);
  timelineEndRef.current = timelineEnd;

  // Zoom handlers — halve / double the visible range, snapping to half-month boundaries
  const handleZoomIn = useCallback((): void => {
    const start = new Date(timelineStartRef.current);
    const end = new Date(timelineEndRef.current);
    const range = end.getTime() - start.getTime();
    const newEnd = snapToHalfMonth(new Date(start.getTime() + range / 2));
    // Don't zoom narrower than one half-month (~14 days)
    if (newEnd.getTime() - start.getTime() < 14 * MS_PER_DAY) return;
    setCustomDateRangeDirect(fmtLocal(start), fmtLocal(newEnd));
  }, [setCustomDateRangeDirect]);

  const handleZoomOut = useCallback((): void => {
    const start = new Date(timelineStartRef.current);
    const end = new Date(timelineEndRef.current);
    const range = end.getTime() - start.getTime();
    const newEnd = snapToHalfMonth(new Date(start.getTime() + range * 2));
    setCustomDateRangeDirect(fmtLocal(start), fmtLocal(newEnd));
  }, [setCustomDateRangeDirect]);

  // Shift timeline by deltaDays (used by month bar drag-to-pan)
  const shiftTimeline = useCallback(
    (deltaDays: number): void => {
      const fmt = formatLocalDate;
      const ms = deltaDays * MS_PER_DAY;
      const newStart = new Date(rawStart.getTime() + ms);
      const newEnd = new Date(rawEnd.getTime() + ms);
      setCustomDateRange({ enabled: true, startDate: fmt(newStart), endDate: fmt(newEnd) });
    },
    [rawStart, rawEnd]
  );

  // Pre-zoom range for month double-click toggle
  const preZoomRangeRef = useRef<{ startDate: string; endDate: string } | null>(null);

  const zoomToMonth = useCallback(
    (monthStartStr: string, monthEndStr: string): void => {
      if (preZoomRangeRef.current) {
        // Already zoomed → restore previous range
        setCustomDateRangeDirect(preZoomRangeRef.current.startDate, preZoomRangeRef.current.endDate);
        preZoomRangeRef.current = null;
      } else {
        // Save current range and zoom to month
        preZoomRangeRef.current = {
          startDate: fmtLocal(timelineStartRef.current),
          endDate: fmtLocal(timelineEndRef.current),
        };
        setCustomDateRangeDirect(monthStartStr, monthEndStr);
      }
    },
    [setCustomDateRangeDirect]
  );

  // Reset timeline
  const resetTimeline = useCallback((): void => {
    setTimeframe(TIMEFRAME_OPTIONS.QUARTER);
    setCustomDateRange({ enabled: false, startDate: "", endDate: "" });
    setZoomLevel(1);
    preZoomRangeRef.current = null;
  }, []);

  return {
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
    handleCustomDateChange,
    handleZoomIn,
    handleZoomOut,
    setCustomDateRangeDirect,
    shiftTimeline,
    resetTimeline,
    zoomToMonth,
  };
};
