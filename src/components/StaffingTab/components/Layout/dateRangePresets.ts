/**
 * Date range preset configurations and computation logic.
 * Extracted from StaffingDateRangeFilter for line count reduction.
 */
import { TIMEFRAME_OPTIONS } from "../../constants";

// Preset configurations for short-term (future/past aware)
export const PRESETS = {
  future: [
    { id: "YTD+", label: "YTD", ytdFuture: true },
    { id: "3M", label: "3M", months: 3 },
    { id: "9M", label: "9M", months: 9 },
  ],
  past: [
    { id: "LY", label: "LY", lastYear: true },
    { id: "6M", label: "6M", months: 6 },
    { id: "YTD", label: "YTD", ytd: true },
  ],
} as const;

// Granularity options -- first button cycles J -> S -> 2S
export const GRAN_CYCLE = ["day", "week", "2week"];
export const GRAN_CYCLE_LABELS: Record<string, string> = { day: "J", week: "S", "2week": "2S" };
export const GRANULARITY_OPTS = [
  { value: "halfmonth", label: "C1/C2" },
  { value: "month", label: "M" },
];

// Map timeframe values to preset IDs (kept for detecting active preset on initial load)
export const TIMEFRAME_TO_PRESET: Record<string, string> = {
  [TIMEFRAME_OPTIONS.MONTH]: "3M",
  [TIMEFRAME_OPTIONS.QUARTER]: "9M",
};

/**
 * Compute a short-preset date range based on direction.
 * direction: 'future' -> range starts at today going forward
 * direction: 'past'   -> range ends at today going backward
 */
export const computeShortPresetRange = (preset: any, direction: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // LY = full last year (Jan 1 -> Jan 1 next, exclusive)
  if (preset.lastYear) {
    const year = today.getFullYear() - 1;
    return { startDate: new Date(year, 0, 1), endDate: new Date(year + 1, 0, 1) };
  }

  // YTD = Jan 1 of current year -> 1st of current month (exclusive, i.e. end of previous month)
  if (preset.ytd) {
    return {
      startDate: new Date(today.getFullYear(), 0, 1),
      endDate: new Date(today.getFullYear(), today.getMonth(), 1),
    };
  }

  // YTD+ (future) = Jan 1 of current year -> 1st of M+2 (exclusive, i.e. end of M+1)
  if (preset.ytdFuture) {
    return {
      startDate: new Date(today.getFullYear(), 0, 1),
      endDate: new Date(today.getFullYear(), today.getMonth() + 2, 1),
    };
  }

  if (direction === "past") {
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);
    const startDate = new Date(today);
    if (preset.days) {
      startDate.setDate(today.getDate() - preset.days);
    } else if (preset.months) {
      startDate.setMonth(today.getMonth() - preset.months);
      startDate.setDate(1);
    }
    return { startDate, endDate };
  }

  const startDate = new Date(today);
  if (preset.months) {
    startDate.setDate(1);
  }
  const endDate = new Date(startDate);
  if (preset.days) {
    endDate.setDate(startDate.getDate() + preset.days);
  } else if (preset.months) {
    endDate.setMonth(startDate.getMonth() + preset.months);
    endDate.setDate(1);
  }
  return { startDate, endDate };
};
