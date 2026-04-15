/**
 * Custom hook for date range filtering
 * Performance-optimized date filtering with memoization
 */

import { useState, useMemo, useCallback } from "react";

/**
 * Hook for managing date range filters
 *
 * @param {Array} data - Array of opportunities
 * @returns {Object} Date filter state and handlers
 */
export const useDateFilter = (data) => {
  // Date range filter state (default: both dates empty)
  const [dateRange, setDateRange] = useState([
    null, // Empty start date by default
    null, // Empty end date by default
  ]);

  /**
   * Normalize dates to compare only day/month/year (ignore time)
   */
  const normalizeStartDate = useCallback((date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const normalizeEndDate = useCallback((date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  /**
   * Filter data by creation date
   * Memoized to avoid recalculation on every render
   */
  const getDateFilteredData = useCallback(
    (inputData) => {
      // If no dates are set, return all data
      if (!dateRange[0] && !dateRange[1]) return inputData;

      return inputData.filter((opp) => {
        const creationDate = new Date(opp["Creation Date"]);

        // If only end date is set, filter up to end of that day
        if (!dateRange[0] && dateRange[1]) {
          const endDate = normalizeEndDate(dateRange[1]);
          return creationDate <= endDate;
        }
        // If only start date is set, filter from start of that day
        if (dateRange[0] && !dateRange[1]) {
          const startDate = normalizeStartDate(dateRange[0]);
          return creationDate >= startDate;
        }
        // If both dates are set, filter between them (inclusive of full days)
        const startDate = normalizeStartDate(dateRange[0]);
        const endDate = normalizeEndDate(dateRange[1]);
        return creationDate >= startDate && creationDate <= endDate;
      });
    },
    [dateRange, normalizeStartDate, normalizeEndDate]
  );

  /**
   * Handle date change
   * Performance-optimized with useCallback
   */
  const handleDateChange = useCallback((index, date) => {
    setDateRange((prev) => {
      const newDateRange = [...prev];
      newDateRange[index] = date;
      return newDateRange;
    });
  }, []);

  /**
   * Reset date filter to empty dates
   */
  const handleResetDateFilter = useCallback(() => {
    setDateRange([null, null]);
  }, []);

  /**
   * Get filtered data
   * Memoized directly on dateRange to ensure updates when dates change
   */
  const dateFilteredData = useMemo(() => {
    // If no dates are set, return all data
    if (!dateRange[0] && !dateRange[1]) return data;

    return data.filter((opp) => {
      const creationDate = new Date(opp["Creation Date"]);

      // If only end date is set, filter up to end of that day
      if (!dateRange[0] && dateRange[1]) {
        const endDate = normalizeEndDate(dateRange[1]);
        return creationDate <= endDate;
      }
      // If only start date is set, filter from start of that day
      if (dateRange[0] && !dateRange[1]) {
        const startDate = normalizeStartDate(dateRange[0]);
        return creationDate >= startDate;
      }
      // If both dates are set, filter between them (inclusive of full days)
      const startDate = normalizeStartDate(dateRange[0]);
      const endDate = normalizeEndDate(dateRange[1]);
      return creationDate >= startDate && creationDate <= endDate;
    });
  }, [data, dateRange, normalizeStartDate, normalizeEndDate]);

  return {
    dateRange,
    setDateRange,
    handleDateChange,
    handleResetDateFilter,
    getDateFilteredData,
    dateFilteredData,
  };
};
