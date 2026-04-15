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
export const useOpportunitySorting = (data: Record<string, any>[], showNetRevenue: boolean): Record<string, any> => {
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [orderBy, setOrderBy] = useState<string>(showNetRevenue ? "netRevenue" : "grossRevenue");
  const [revenueSortMode, setRevenueSortMode] = useState<string>("total");
  const [revenueMenuAnchor, setRevenueMenuAnchor] = useState<HTMLElement | null>(null);

  // Memoized sorted data - only recomputes when dependencies change
  const sortedData = useMemo<Record<string, any>[]>(() => {
    return data.slice().sort((a: Record<string, any>, b: Record<string, any>) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // Special handling for revenue columns
      if (orderBy === "grossRevenue" || orderBy === "netRevenue") {
        aValue = getRevenueForSorting(a, showNetRevenue, revenueSortMode);
        bValue = getRevenueForSorting(b, showNetRevenue, revenueSortMode);
      }
      // Special handling for Status column
      else if (orderBy === "status") {
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
    (property: string): void => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [orderBy, order]
  );

  const handleRevenueMenuClick = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
    setRevenueMenuAnchor(event.currentTarget);
  }, []);

  const handleRevenueMenuClose = useCallback((): void => {
    setRevenueMenuAnchor(null);
  }, []);

  const handleRevenueSortModeChange = useCallback(
    (mode: string): void => {
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
