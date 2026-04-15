/**
 * Hook for calculating pipeline data grouped by status
 * Extracted from usePipelineCalculations for modularity
 */

import { useMemo } from "react";
import { ALL_STATUSES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../utils/revenueCalculations";

/**
 * Calculate pipeline data grouped by status
 * OPTIMIZED: Single pass instead of 15 filter() + 30 reduce()
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Array} Pipeline data grouped by status
 */
export const usePipelineByStatus = (filteredOpportunities, showNetRevenue) => {
  return useMemo(() => {
    const startTime = performance.now();

    // Initialize results for all statuses
    const statusMap = new Map();
    ALL_STATUSES.forEach((statusInfo) => {
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
      const statusData = statusMap.get(item["Status"]);
      if (statusData) {
        // Always use the base revenue (total amount before allocation)
        const revenue = showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
        const allocatedRevenue = item["Is Allocated"]
          ? showNetRevenue
            ? item["Allocated Net Revenue"] || 0
            : item["Allocated Gross Revenue"] || 0
          : revenue;

        statusData.originalValue += revenue;
        statusData.allocatedValue += allocatedRevenue;
        statusData.calculatedValue += calculateRevenueWithSegmentLogic(item, showNetRevenue);
        statusData.count++;
      }
    });

    const result = Array.from(statusMap.values());
    console.log(`[PERF] pipelineByStatus: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);
};
