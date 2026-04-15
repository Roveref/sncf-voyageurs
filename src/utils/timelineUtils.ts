/**
 * Shared Gantt timeline utilities.
 *
 * Re-exports the pure functions that currently live under StaffingTab
 * so multiple tabs can import from a single stable path.
 *
 * Exposes: calculateBarPosition, getTimelineRange, getTimelineLabels,
 * getMonthLabels, getWeekendMarkers, getHolidayMarkers.
 */
export * from "../components/StaffingTab/utils/timelineUtils";
