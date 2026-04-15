/**
 * Custom hook for calculating opportunity totals
 * Performance optimized with useMemo
 */

import { useMemo } from "react";
import { formatCurrency } from "../../../utils/formatters";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";

interface TotalsResult {
  totalRevenue: number;
  totalIORevenue: number;
  totalRevenueBase: number;
  filteredRevenue: number;
}

/**
 * Hook to calculate total revenue values for opportunities
 * Provides memoized totals that only recalculate when data changes
 * @param {Array} data - Array of opportunity objects
 * @param {boolean} showNetRevenue - Whether to use Net Revenue vs Gross Revenue
 * @param {string} revenueSortMode - Revenue display mode: 'total', 'io', or 'filtered'
 * @returns {Object} Total revenue values and currency formatter
 */
export const useOpportunityTotals = (
  data: Record<string, any>[],
  showNetRevenue: boolean,
  revenueSortMode: string = "total"
): { totals: TotalsResult; currencyFormatter: { format: (value: number | null | undefined) => string } } => {
  // Memoized totals - only recalculates when data, showNetRevenue, or revenueSortMode changes
  const totals = useMemo<TotalsResult>(() => {
    const revenueField = showNetRevenue ? "netRevenue" : "grossRevenue";
    const allocatedRevenueField = showNetRevenue ? "allocatedNetRevenue" : "allocatedGrossRevenue";

    // Always calculate base total revenue (for percentage calculations)
    const totalRevenueBase = data.reduce((sum: number, item: Record<string, any>) => {
      return sum + (item[revenueField] || 0);
    }, 0);

    const totalRevenue = data.reduce((sum: number, item: Record<string, any>) => {
      let revenue = 0;

      // Calculate revenue based on mode (same logic as getRevenueForSorting)
      switch (revenueSortMode) {
        case "total":
          revenue = item[revenueField] || 0;
          break;
        case "io":
          revenue = calculateRevenueWithSegmentLogic(item, showNetRevenue);
          break;
        case "filtered":
          // If the item has been allocated (filtered), use allocated revenue, otherwise use total
          revenue = item.isAllocated ? item[allocatedRevenueField] || 0 : item[revenueField] || 0;
          break;
        default:
          revenue = item[revenueField] || 0;
      }

      return sum + revenue;
    }, 0);

    const totalIORevenue = data.reduce((sum: number, item: Record<string, any>) => {
      return sum + calculateRevenueWithSegmentLogic(item, showNetRevenue);
    }, 0);

    // Calculate filtered (allocated) revenue - sum of allocated revenues when allocated, otherwise total
    const filteredRevenue = data.reduce((sum: number, item: Record<string, any>) => {
      const revenue = item.isAllocated ? item[allocatedRevenueField] || 0 : item[revenueField] || 0;
      return sum + revenue;
    }, 0);

    return { totalRevenue, totalIORevenue, totalRevenueBase, filteredRevenue };
  }, [data, showNetRevenue, revenueSortMode]);

  // Currency formatter using centralized utility
  const currencyFormatter = { format: formatCurrency };

  return {
    totals,
    currencyFormatter,
  };
};
