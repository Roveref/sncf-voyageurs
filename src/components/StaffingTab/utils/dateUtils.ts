import { logger } from "./logger";
import { PUBLIC_HOLIDAY_DATES, MS_PER_DAY } from "../constants";

/**
 * Get month-day string from a date (MM-DD format)
 * @param {Date|string} date - Date object or string
 * @returns {string}
 */
export const getMonthDay = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Check if a date is a French public holiday (dynamic, year-aware)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
export const isPublicHoliday = (dateStr: string): boolean => {
  return PUBLIC_HOLIDAY_DATES.has(dateStr);
};

/**
 * Check if a date is in the list of enabled holidays
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {Array|Set} enabledHolidayDates - Holiday dates in YYYY-MM-DD format
 * @returns {boolean}
 */
export const isHolidayEnabled = (dateStr: string, enabledHolidayDates: string[] | Set<string>): boolean => {
  if (enabledHolidayDates instanceof Set) return enabledHolidayDates.has(dateStr);
  return enabledHolidayDates.includes(dateStr);
};

/**
 * Check if a date is a weekend
 * @param {Date|string} date - Date object or string
 * @returns {boolean}
 */
export const isWeekend = (date: Date | string): boolean => {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDay();
  return day === 0 || day === 6;
};

/**
 * Check if a date is a working day
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {Array} enabledHolidayDates - Array of enabled holiday dates (MM-DD format), optional
 * @returns {boolean}
 */
export const isWorkingDay = (dateStr: string, enabledHolidayDates: string[] | Set<string> | null = null): boolean => {
  if (isWeekend(dateStr)) return false;
  if (enabledHolidayDates) {
    return !isHolidayEnabled(dateStr, enabledHolidayDates);
  }
  return !isPublicHoliday(dateStr);
};

/**
 * Count working days between two dates
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @param {Array} enabledHolidayDates - Array of enabled holiday dates (MM-DD format)
 * @returns {number} - Number of working days
 */
export const countWorkingDays = (
  startDateStr: string,
  endDateStr: string,
  enabledHolidayDates: string[] = [],
  _cache: Map<string, number> | null = null
): number => {
  // Use cache when provided (avoids recalculating identical date ranges)
  const cacheKey = _cache ? `${startDateStr}|${endDateStr}` : null;
  if (_cache && cacheKey && _cache.has(cacheKey)) return _cache.get(cacheKey)!;

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.warn("Invalid dates in countWorkingDays:", { startDateStr, endDateStr });
    return 0;
  }

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatLocalDate(current);
    if (isWorkingDay(dateStr, enabledHolidayDates)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  if (_cache && cacheKey) _cache.set(cacheKey, count);
  return count;
};

/**
 * Count working days between two Date objects, excluding weekends and holidays.
 * Replaces the duplicated while-loop pattern in scenarioUtils/dataProcessing.
 * Range is [start, end) — start inclusive, end exclusive.
 */
export const countWorkingDaysInRange = (
  start: Date,
  end: Date,
  isHoliday: (dateStr: string) => boolean = () => false
): number => {
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const dtStr = formatLocalDate(cur);
      if (!isHoliday(dtStr)) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Parse various date formats to YYYY-MM-DD
 * @param {string} dateStr - Date string in various formats
 * @returns {string|null} - Normalized date string or null
 */
export const parseDate = (dateStr: string): string | null => {
  if (!dateStr) return null;

  // DD/MM/YY or DD/MM/YYYY format (European with slash)
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  // DD.MM.YYYY format (European with dot)
  if (dateStr.includes(".")) {
    const parts = dateStr.split(".");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  return dateStr;
};

/**
 * Get position percentage for a date within a timeline range
 * @param {Date|string} date - Date to position
 * @param {Date} timelineStart - Start of timeline
 * @param {Date} timelineEnd - End of timeline
 * @returns {number} - Position percentage (0-100)
 */
export const getPositionFromDate = (date: Date | string, timelineStart: Date, timelineEnd: Date): number => {
  const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / MS_PER_DAY;
  const daysSinceStart = (new Date(date).getTime() - timelineStart.getTime()) / MS_PER_DAY;
  return Math.max(0, Math.min(100, (daysSinceStart / totalDays) * 100));
};

/**
 * Get total days between two dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number}
 */
export const getTotalDays = (start: Date, end: Date): number => {
  return (end.getTime() - start.getTime()) / MS_PER_DAY;
};

/**
 * Get day width percentage for a timeline
 * @param {Date} timelineStart - Start of timeline
 * @param {Date} timelineEnd - End of timeline
 * @returns {number}
 */
export const getDayWidth = (timelineStart: Date, timelineEnd: Date): number => {
  const totalDays = getTotalDays(timelineEnd, timelineStart);
  return 100 / totalDays;
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export const formatDate = (date: Date | string, options: Record<string, unknown> = {}): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", options);
};

/**
 * Get ISO date string (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string}
 */
export const toISODateString = (date: Date): string | null => {
  // Defensive check for invalid dates
  if (!date || isNaN(date.getTime())) {
    logger.warn("toISODateString called with invalid date:", date);
    return null;
  }
  return formatLocalDate(date);
};

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Days to add
 * @returns {Date}
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Add months to a date
 * @param {Date} date - Base date
 * @param {number} months - Months to add
 * @returns {Date}
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Normalize any date value (string in various formats, or Date object) to "YYYY-MM-DD".
 * Returns the normalized string, or '' if the input is falsy/invalid.
 * @param {Date|string} date
 * @returns {string}
 */
export const toDateString = (date: Date | string): string => {
  if (!date) return "";
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? "" : formatLocalDate(date);
  }
  return parseDate(String(date)) || "";
};

/**
 * Format a Date to YYYY-MM-DD using local-time components (avoids UTC shift).
 * @param {Date} date
 * @returns {string}
 */
export const formatLocalDate = (date: Date | string): string => {
  if (!(date instanceof Date)) return String(date);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Calculate the number of days between two dates (rounded).
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export const daysBetween = (start: Date | number, end: Date | number): number =>
  Math.round((+end - +start) / 86_400_000);
