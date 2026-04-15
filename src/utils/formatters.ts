/**
 * Shared formatting utilities used across the dashboard application
 * Centralizes currency, date, and other formatting functions
 */

// ─── Cached today's date string ──────────────────────────────────────────────
// Refreshed daily via TTL check on day-of-month. Avoids creating new Date
// objects and running toISOString() on every call across 30+ files.
let _todayStr: string | null = null;
let _todayDay = -1;
export const getToday = (): string => {
  const now = new Date();
  const day = now.getDate();
  if (!_todayStr || _todayDay !== day) {
    _todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    _todayDay = day;
  }
  return _todayStr;
};

/**
 * Replace narrow no-break space (\u202F) and no-break space (\u00A0) with regular spaces.
 * Intl.NumberFormat("fr-FR") uses \u202F as grouping separator which is invisible in some fonts.
 */
const fixSpaces = (s: string): string => s.replace(/[\u202F\u00A0]/g, " ");

interface CurrencyOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Formats a number as French Euro currency with visible space separators
 */
export const formatCurrency = (value: number | null | undefined, options: CurrencyOptions = {}): string => {
  const { minimumFractionDigits = 0, maximumFractionDigits = 0 } = options;

  return fixSpaces(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value || 0)
  );
};

/**
 * Formats a number as compact French Euro currency (e.g. 1,2 M €) with visible spaces
 */
export const formatCompactCurrency = (value: number | null | undefined): string => {
  return fixSpaces(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value || 0)
  );
};

/**
 * Formats a date in French format (DD/MM/YYYY)
 */
export const formatDateFR = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue || dateValue === "-" || dateValue === "") {
    return "-";
  }

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleDateString("fr-FR");
  } catch {
    return "-";
  }
};

/**
 * Formats a date with full options (day, month, year)
 */
export const formatDateWithOptions = (
  dateValue: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  if (!dateValue) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = {
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
  } catch {
    return "";
  }
};

/**
 * Gets month name in French from a date
 */
export const getMonthNameFR = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return "";

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
  } catch {
    return "";
  }
};

/**
 * Formats a percentage value
 */
export const formatPercentage = (value: number | null | undefined, decimals: number = 1): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "0%";
  }
  return `${value.toFixed(decimals)}%`;
};

type MuiColor = "default" | "error" | "warning" | "info" | "success";

/**
 * Gets Win% color based on percentage value
 */
export const getWinPercentageColor = (winPercentage: number | null | undefined): MuiColor => {
  if (!winPercentage || winPercentage === 0) return "default";
  if (winPercentage < 25) return "error";
  if (winPercentage < 50) return "warning";
  if (winPercentage < 75) return "info";
  return "success";
};
