/**
 * Formatting utilities for JobcodeTimelineTab
 * Pure functions for date and currency formatting
 */

import { STATUS_COLORS } from "../../../utils/constants";
export { formatCurrency } from "../../../utils/formatters";

/**
 * Format date to readable locale string
 */
export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Get status chip color based on status code
 */
type MuiChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
export const getStatusChipColor = (status: number): MuiChipColor => {
  return (STATUS_COLORS[status] || "default") as MuiChipColor;
};

/**
 * Get timeline dot color based on event type and status
 */
export const getTimelineDotColor = (type: string, status?: number): MuiChipColor => {
  switch (type) {
    case "creation":
      return "info";
    case "status":
      return (STATUS_COLORS[status as number] || "default") as MuiChipColor;
    case "win":
      return "success";
    case "loss":
      return "error";
    default:
      return "default";
  }
};

/**
 * Assign a consistent color to each opportunity stream
 */
const STREAM_COLORS = ["primary", "secondary", "info", "warning", "success", "error"] as const;
export const getStreamColor = (index: number): (typeof STREAM_COLORS)[number] => {
  return STREAM_COLORS[index % STREAM_COLORS.length];
};
