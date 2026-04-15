/**
 * Custom hook for managing opportunity sorting
 * Performance optimized with useMemo for sorted data
 */

import { useState, useMemo, useCallback } from "react";
import { getRevenueForSorting } from "../utils/opportunityUtils";

/**
 * Hook to manage sorting logic for opportunities
 * Provides state and handlers for column sorting with special revenue sort modes
 * @param {Array} data - Array of opportunity objects to sort
 * @param {boolean} showNetRevenue - Whether to use Net Revenue vs Gross Revenue
 * @returns {Object} Sort state, handlers, and sorted data
 */
export const useOpportunitySorting = (data, showNetRevenue) => {
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(showNetRevenue ? "Net Revenue" : "Gross Revenue");
  const [revenueSortMode, setRevenueSortMode] = useState("total");
  const [revenueMenuAnchor, setRevenueMenuAnchor] = useState(null);

  // Memoized sorted data - only recomputes when dependencies change
  const sortedData = useMemo(() => {
    return data.slice().sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // Special handling for revenue columns
      if (orderBy === "Gross Revenue" || orderBy === "Net Revenue") {
        aValue = getRevenueForSorting(a, showNetRevenue, revenueSortMode);
        bValue = getRevenueForSorting(b, showNetRevenue, revenueSortMode);
      }
      // Special handling for Status column
      else if (orderBy === "Status") {
        aValue = typeof aValue === "number" ? aValue : parseInt(aValue, 10) || 0;
        bValue = typeof bValue === "number" ? bValue : parseInt(bValue, 10) || 0;
      }
      // String comparison for text columns
      else if (typeof aValue === "string" && typeof bValue === "string") {
        return order === "asc"
          ? aValue.toLowerCase().localeCompare(bValue.toLowerCase())
          : bValue.toLowerCase().localeCompare(aValue.toLowerCase());
      }

      return order === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [data, orderBy, order, showNetRevenue, revenueSortMode]);

  // Handlers
  const handleSortRequest = useCallback(
    (property) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [orderBy, order]
  );

  const handleRevenueMenuClick = useCallback((event) => {
    event.stopPropagation();
    setRevenueMenuAnchor(event.currentTarget);
  }, []);

  const handleRevenueMenuClose = useCallback(() => {
    setRevenueMenuAnchor(null);
  }, []);

  const handleRevenueSortModeChange = useCallback(
    (mode) => {
      setRevenueSortMode(mode);
      handleRevenueMenuClose();
      // No need to re-trigger sort - useMemo will automatically update when revenueSortMode changes
    },
    [handleRevenueMenuClose]
  );

  return {
    // State
    order,
    orderBy,
    revenueSortMode,
    revenueMenuAnchor,
    sortedData,

    // Handlers
    handleSortRequest,
    handleRevenueMenuClick,
    handleRevenueMenuClose,
    handleRevenueSortModeChange,
  };
};
