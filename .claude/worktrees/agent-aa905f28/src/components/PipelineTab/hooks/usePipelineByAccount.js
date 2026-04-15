/**
 * Hook for calculating pipeline data grouped by account
 * Extracted from usePipelineCalculations for modularity
 */

import { useMemo } from "react";
import { STATUS_CATEGORIES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../utils/revenueCalculations";

/**
 * Calculate pipeline data grouped by account
 * Groups by account and status category
 * FIX: Track allocated vs non-allocated portions for color distinction
 * Memoized for optimal performance
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Array} Top 9 accounts sorted by total revenue
 */
export const usePipelineByAccount = (filteredOpportunities, showNetRevenue) => {
  return useMemo(() => {
    // Group by account first
    const accountGroups = {};

    filteredOpportunities.forEach((opp) => {
      const account = opp["Account"] || "Uncategorized";
      if (!accountGroups[account]) {
        accountGroups[account] = {
          name: account,
          early: 0,
          earlyAllocated: 0,
          earlyNonAllocated: 0,
          mid: 0,
          midAllocated: 0,
          midNonAllocated: 0,
          late: 0,
          lateAllocated: 0,
          lateNonAllocated: 0,
          total: 0,
          calculatedEarly: 0,
          calculatedMid: 0,
          calculatedLate: 0,
          calculatedTotal: 0,
          count: 0,
        };
      }

      // Calculate the revenue using the original and calculated methods
      const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

      // If filtered with allocation, calculate allocated and non-allocated portions
      let allocatedPortion = baseRevenue;
      let nonAllocatedPortion = 0;

      if (opp["Allocated Service Line"] && opp["Is Allocated"]) {
        // Split allocated service line names
        const allocatedServiceLines = opp["Allocated Service Line"]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== "" && name !== "-");

        // Split combined service line names from the opportunity
        const rawServiceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        // Calculate portions
        allocatedPortion = 0;
        nonAllocatedPortion = 0;

        if (serviceLines.length === 0) {
          allocatedPortion = baseRevenue;
        } else if (totalPercentage === 0) {
          const equalShare = 1 / serviceLines.length;
          const matchingLines = serviceLines.filter((sl) => allocatedServiceLines.includes(sl.line));
          allocatedPortion = baseRevenue * equalShare * matchingLines.length;
          nonAllocatedPortion = baseRevenue * equalShare * (serviceLines.length - matchingLines.length);
        } else {
          serviceLines.forEach((sl) => {
            const allocation = parseFloat(sl.percentage) / 100;
            if (allocatedServiceLines.includes(sl.line)) {
              allocatedPortion += baseRevenue * allocation;
            } else {
              nonAllocatedPortion += baseRevenue * allocation;
            }
          });
        }
      }

      // Add to the right status category
      if (STATUS_CATEGORIES.early.includes(opp.Status)) {
        accountGroups[account].early += baseRevenue;
        accountGroups[account].earlyAllocated += allocatedPortion;
        accountGroups[account].earlyNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedEarly += calculatedRevenue;
      } else if (STATUS_CATEGORIES.mid.includes(opp.Status)) {
        accountGroups[account].mid += baseRevenue;
        accountGroups[account].midAllocated += allocatedPortion;
        accountGroups[account].midNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedMid += calculatedRevenue;
      } else if (STATUS_CATEGORIES.late.includes(opp.Status)) {
        accountGroups[account].late += baseRevenue;
        accountGroups[account].lateAllocated += allocatedPortion;
        accountGroups[account].lateNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedLate += calculatedRevenue;
      }

      // Add to total
      accountGroups[account].total += baseRevenue;
      accountGroups[account].calculatedTotal += calculatedRevenue;
      accountGroups[account].count += 1;
    });

    // Convert to array, sort by total, and limit to top 9
    return Object.values(accountGroups)
      .sort((a, b) => b.total - a.total)
      .slice(0, 9);
  }, [filteredOpportunities, showNetRevenue]);
};
