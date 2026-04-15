/**
 * Hook for calculating pipeline data grouped by status
 * Extracted from usePipelineCalculations for modularity
 */

import { useMemo } from "react";
import { getAllStatuses } from "../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../utils/revenueCalculations";

/**
 * Calculate pipeline data grouped by status
 * OPTIMIZED: Single pass instead of 15 filter() + 30 reduce()
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Array} Pipeline data grouped by status
 */
export const usePipelineByStatus = (filteredOpportunities: Record<string, any>[], showNetRevenue: boolean) => {
  return useMemo(() => {
    // Initialize results for all statuses
    const statusMap = new Map();
    getAllStatuses().forEach((statusInfo) => {
      statusMap.set(statusInfo.statusNumber, {
        status: statusInfo.status,
        originalValue: 0,
        allocatedValue: 0,
        calculatedValue: 0,
        count: 0,
        statusNumber: statusInfo.statusNumber,
      });
    });

    // Single pass through all data
    filteredOpportunities.forEach((item) => {
      const statusData = statusMap.get(item.status);
      if (statusData) {
        // Always use the base revenue (total amount before allocation)
        const revenue = showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0;
        const allocatedRevenue = item.isAllocated
          ? showNetRevenue
            ? item.allocatedNetRevenue || 0
            : item.allocatedGrossRevenue || 0
          : revenue;

        statusData.originalValue += revenue;
        statusData.allocatedValue += allocatedRevenue;
        statusData.calculatedValue += calculateRevenueWithSegmentLogic(item, showNetRevenue);
        statusData.count++;
      }
    });

    const result = Array.from(statusMap.values());
    return result;
  }, [filteredOpportunities, showNetRevenue]);
};
