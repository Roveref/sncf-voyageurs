/**
 * Formatting utilities for JobcodeTimelineTab
 * Pure functions for date and currency formatting
 */

import { STATUS_COLORS } from "../../../utils/constants";

/**
 * Format date to readable locale string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format currency values to EUR format
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Get status chip color based on status code
 * @param {number} status - Status code
 * @returns {string} MUI color name
 */
export const getStatusChipColor = (status) => {
  return STATUS_COLORS[status] || "default";
};

/**
 * Get timeline dot color based on event type and status
 * @param {string} type - Event type (creation, status, win, loss)
 * @param {number} status - Status code for status events
 * @returns {string} MUI color name
 */
export const getTimelineDotColor = (type, status) => {
  switch (type) {
    case "creation":
      return "info";
    case "status":
      return STATUS_COLORS[status] || "default";
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
 * @param {number} index - Stream index
 * @returns {string} MUI palette color key
 */
const STREAM_COLORS = ["primary", "secondary", "info", "warning", "success", "error"];
export const getStreamColor = (index) => {
  return STREAM_COLORS[index % STREAM_COLORS.length];
};
