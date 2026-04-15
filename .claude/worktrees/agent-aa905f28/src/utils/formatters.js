/**
 * Shared formatting utilities used across the dashboard application
 * Centralizes currency, date, and other formatting functions
 */

/**
 * Formats a number as French Euro currency
 * @param {number} value - The numeric value to format
 * @param {Object} options - Optional formatting options
 * @param {number} options.minimumFractionDigits - Minimum decimal places (default: 0)
 * @param {number} options.maximumFractionDigits - Maximum decimal places (default: 0)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
  const { minimumFractionDigits = 0, maximumFractionDigits = 0 } = options;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value || 0);
};

/**
 * Formats a date in French format (DD/MM/YYYY)
 * @param {Date|string} dateValue - The date to format
 * @returns {string} Formatted date string or "-" if invalid
 */
export const formatDateFR = (dateValue) => {
  if (!dateValue || dateValue === "-" || dateValue === "") {
    return "-";
  }

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleDateString("fr-FR");
  } catch (error) {
    return "-";
  }
};

/**
 * Formats a date with full options (day, month, year)
 * @param {Date|string} dateValue - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string or empty string if invalid
 */
export const formatDateWithOptions = (dateValue, options = {}) => {
  if (!dateValue) return "";

  const defaultOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("fr-FR", { ...defaultOptions, ...options });
  } catch (error) {
    return "";
  }
};

/**
 * Gets month name in French from a date
 * @param {Date|string} dateValue - The date
 * @returns {string} Month name in French
 */
export const getMonthNameFR = (dateValue) => {
  if (!dateValue) return "";

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
  } catch (error) {
    return "";
  }
};

/**
 * Formats a percentage value
 * @param {number} value - The percentage value
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "0%";
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Gets Win% color based on percentage value
 * @param {number} winPercentage - The win percentage
 * @returns {string} MUI color name
 */
export const getWinPercentageColor = (winPercentage) => {
  if (!winPercentage || winPercentage === 0) return "default";
  if (winPercentage < 25) return "error";
  if (winPercentage < 50) return "warning";
  if (winPercentage < 75) return "info";
  return "success";
};
