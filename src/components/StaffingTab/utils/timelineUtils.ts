import { logger } from "./logger";
import { TIMEFRAME_OPTIONS, MS_PER_DAY } from "../constants";
import { getPositionFromDate, formatLocalDate } from "./dateUtils";

/**
 * Calculate timeline range based on timeframe or custom dates
 * @param {string} timeframe - Timeframe option (week, month, quarter)
 * @param {object} customRange - Custom date range { enabled, startDate, endDate }
 * @returns {object} - { startDate: Date, endDate: Date }
 */
export const getTimelineRange = (
  timeframe: string,
  customRange: Record<string, any>
): { startDate: Date; endDate: Date } => {
  if (customRange?.enabled && customRange.startDate && customRange.endDate) {
    return {
      startDate: new Date(customRange.startDate),
      endDate: new Date(customRange.endDate),
    };
  }

  const today = new Date();
  const startDate = new Date(today);
  const endDate = new Date(today);

  switch (timeframe) {
    case TIMEFRAME_OPTIONS.WEEK:
      startDate.setDate(today.getDate() - 7);
      endDate.setDate(today.getDate() + 21);
      break;
    case TIMEFRAME_OPTIONS.MONTH:
      startDate.setDate(1);
      endDate.setMonth(today.getMonth() + 3);
      endDate.setDate(1);
      break;
    case TIMEFRAME_OPTIONS.QUARTER:
      startDate.setDate(1);
      endDate.setMonth(today.getMonth() + 9);
      endDate.setDate(1);
      break;
    default:
      startDate.setDate(1);
      endDate.setMonth(today.getMonth() + 9);
      endDate.setDate(1);
  }

  return { startDate, endDate };
};

/**
 * Generate timeline labels for the current timeframe
 * @param {string} timeframe - Timeframe option
 * @param {Date} startDate - Timeline start
 * @param {Date} endDate - Timeline end
 * @returns {Array} - Array of label objects with date and position
 */
export const getTimelineLabels = (
  timeframe: string,
  startDate: Date,
  endDate: Date
): { date: Date; position: number }[] => {
  const labels: { date: Date; position: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.warn("Invalid dates in getTimelineLabels:", { startDate, endDate });
    return labels;
  }

  const current = new Date(start);

  while (current <= end) {
    labels.push({
      date: new Date(current),
      position: getPositionFromDate(current, start, end),
    });

    switch (timeframe) {
      case TIMEFRAME_OPTIONS.WEEK:
        current.setDate(current.getDate() + 1);
        break;
      case TIMEFRAME_OPTIONS.MONTH:
        current.setDate(current.getDate() + 7);
        break;
      case TIMEFRAME_OPTIONS.QUARTER:
      default:
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return labels;
};

/**
 * Generate month labels for timeline header
 * @param {Date} startDate - Timeline start
 * @param {Date} endDate - Timeline end
 * @param {string} timeframe - Current timeframe
 * @returns {Array} - Array of month label objects
 */
export const getMonthLabels = (
  startDate: Date,
  endDate: Date,
  timeframe: string
): { key: number; label: string; startPos: number; width: number }[] => {
  const labels: { key: number; label: string; startPos: number; width: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.warn("Invalid dates in getMonthLabels:", { startDate, endDate });
    return labels;
  }

  const currentMonth = new Date(start);
  currentMonth.setDate(1);

  while (currentMonth <= end) {
    const monthStart = new Date(currentMonth);
    let startPos = getPositionFromDate(monthStart, start, end);

    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const endPos = nextMonth > end ? 100 : getPositionFromDate(nextMonth, start, end);
    const width = endPos - startPos;

    if (width > 2) {
      labels.push({
        key: currentMonth.getTime(),
        label: currentMonth.toLocaleDateString("fr-FR", {
          month: "short",
          year: timeframe === TIMEFRAME_OPTIONS.QUARTER ? "2-digit" : undefined,
        }),
        startPos,
        width,
      });
    }

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return labels;
};

/**
 * Generate weekend markers for a timeline
 * @param {Date} startDate - Timeline start
 * @param {Date} endDate - Timeline end
 * @returns {Array} - Array of weekend marker objects
 */
export const getWeekendMarkers = (
  startDate: Date,
  endDate: Date
): { key: number; position: number; width: number }[] => {
  const markers: { key: number; position: number; width: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.warn("Invalid dates in getWeekendMarkers:", { startDate, endDate });
    return markers;
  }

  const currentDate = new Date(start);
  // Add 1 to include the last day in the count
  const totalDays = (end.getTime() - start.getTime()) / MS_PER_DAY + 1;
  const dayWidth = 100 / totalDays;

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const daysSinceStart = (currentDate.getTime() - start.getTime()) / MS_PER_DAY;
      const position = (daysSinceStart / totalDays) * 100;
      markers.push({
        key: currentDate.getTime(),
        position,
        width: dayWidth,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return markers;
};

/**
 * Generate holiday markers for a timeline
 * @param {Date} startDate - Timeline start
 * @param {Date} endDate - Timeline end
 * @param {function} isHolidayFn - Function to check if date is holiday
 * @returns {Array} - Array of holiday marker objects
 */
export const getHolidayMarkers = (
  startDate: Date,
  endDate: Date,
  isHolidayFn: (dateStr: string) => boolean
): { key: number; date: string; position: number; width: number }[] => {
  const markers: { key: number; date: string; position: number; width: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.warn("Invalid dates in getHolidayMarkers:", { startDate, endDate });
    return markers;
  }

  const currentDate = new Date(start);
  // Add 1 to include the last day in the count
  const totalDays = (end.getTime() - start.getTime()) / MS_PER_DAY + 1;
  const dayWidth = 100 / totalDays;

  while (currentDate <= end) {
    const dateStr = formatLocalDate(currentDate);
    if (isHolidayFn(dateStr)) {
      const daysSinceStart = (currentDate.getTime() - start.getTime()) / MS_PER_DAY;
      const position = (daysSinceStart / totalDays) * 100;
      markers.push({
        key: currentDate.getTime(),
        date: dateStr,
        position,
        width: dayWidth,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return markers;
};

/**
 * Calculate bar position and width for an assignment period
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Date} timelineStart - Timeline start
 * @param {Date} timelineEnd - Timeline end
 * @returns {object} - { left, width }
 */
export const calculateBarPosition = (
  periodStart: string,
  periodEnd: string,
  timelineStart: Date | string,
  timelineEnd: Date | string
): { left: number; width: number } => {
  // Validate all dates
  const tlStart = new Date(timelineStart);
  const tlEnd = new Date(timelineEnd);
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  if (isNaN(tlStart.getTime()) || isNaN(tlEnd.getTime()) || isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
    logger.warn("Invalid dates in calculateBarPosition:", { periodStart, periodEnd, timelineStart, timelineEnd });
    return { left: 0, width: 0 };
  }

  const totalDays = (tlEnd.getTime() - tlStart.getTime()) / MS_PER_DAY;
  const dayWidth = 100 / totalDays;

  const startPos = getPositionFromDate(periodStart, tlStart, tlEnd);

  // Extend end date by one day to include full last day
  const endDate = new Date(pEnd);
  endDate.setDate(endDate.getDate() + 1);
  const endPos = getPositionFromDate(formatLocalDate(endDate), tlStart, tlEnd);

  const width = Math.max(dayWidth * 0.8, endPos - startPos);

  return {
    left: startPos,
    width,
  };
};
