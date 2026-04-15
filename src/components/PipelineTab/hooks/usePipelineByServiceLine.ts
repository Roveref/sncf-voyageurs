/**
 * Hook for calculating pipeline data grouped by service line
 * Extracted from usePipelineCalculations for modularity
 *
 * Contains:
 * - pipelineByServiceLine: Revenue by service line with allocation distribution
 * - stackedServiceLineData: Stacked bar chart data by status category
 * - getOfferingsByServiceLine: Drill-down callback for offerings within a service line
 */

import { useMemo, useCallback } from "react";
import { STATUS_CATEGORIES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic, getRevenueValue } from "../utils/revenueCalculations";

/**
 * Parse and expand service line data from an opportunity
 * Shared helper for service line distribution logic
 *
 * @param {Object} opp - Opportunity object
 * @returns {{ serviceLines: Array<{line: string, percentage: number}>, totalPercentage: number }}
 */
const parseServiceLines = (opp: Record<string, any>) => {
  const rawServiceLines = [
    { line: opp.serviceLine1, percentage: opp.serviceOffering1Pct || 0 },
    { line: opp.serviceLine2, percentage: opp.serviceOffering2Pct || 0 },
    { line: opp.serviceLine3, percentage: opp.serviceOffering3Pct || 0 },
  ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

  // Expand combined names into separate entries
  const serviceLines: any[] = [];
  rawServiceLines.forEach((sl) => {
    const parts = sl.line
      .split(",")
      .map((p: string) => p.trim())
      .filter((p: string) => p !== "");
    if (parts.length > 1) {
      const splitPercentage = parseFloat(sl.percentage) / parts.length;
      parts.forEach((part: string) => {
        serviceLines.push({ line: part, percentage: splitPercentage });
      });
    } else {
      serviceLines.push(sl);
    }
  });

  const totalPercentage = serviceLines.reduce((sum: number, sl) => sum + parseFloat(sl.percentage), 0);

  return { serviceLines, totalPercentage };
};

/**
 * Create a default stacked group entry for service line chart data
 *
 * @param {string} name - Service line name
 * @param {Object} [extra] - Additional fields to merge
 * @returns {Object} Default stacked group entry
 */
const createStackedGroup = (name: string, extra: Record<string, any> = {}) => ({
  name,
  early: 0,
  earlyAllocated: 0,
  earlyNonAllocated: 0,
  earlyCount: 0,
  mid: 0,
  midAllocated: 0,
  midNonAllocated: 0,
  midCount: 0,
  late: 0,
  lateAllocated: 0,
  lateNonAllocated: 0,
  lateCount: 0,
  total: 0,
  calculatedEarly: 0,
  calculatedMid: 0,
  calculatedLate: 0,
  calculatedTotal: 0,
  count: 0,
  ...extra,
});

/**
 * Add revenue to the appropriate status category bucket within a group
 *
 * @param {Object} group - The group to update
 * @param {number} status - Opportunity status number
 * @param {Object} values - Revenue values to add
 */
const addToStatusBucket = (
  group: any,
  status: number,
  {
    base,
    allocated,
    nonAllocated,
    calculated,
    countIncrement,
  }: { base: number; allocated: number; nonAllocated: number; calculated: number; countIncrement: number }
) => {
  if (STATUS_CATEGORIES.early.includes(status)) {
    group.early += base;
    group.earlyAllocated += allocated;
    group.earlyNonAllocated += nonAllocated;
    group.calculatedEarly += calculated;
    group.earlyCount += countIncrement;
  } else if (STATUS_CATEGORIES.mid.includes(status)) {
    group.mid += base;
    group.midAllocated += allocated;
    group.midNonAllocated += nonAllocated;
    group.calculatedMid += calculated;
    group.midCount += countIncrement;
  } else if (STATUS_CATEGORIES.late.includes(status)) {
    group.late += base;
    group.lateAllocated += allocated;
    group.lateNonAllocated += nonAllocated;
    group.calculatedLate += calculated;
    group.lateCount += countIncrement;
  }
};

/**
 * Hook for pipeline data grouped by service line, stacked chart data, and drill-down
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {{ pipelineByServiceLine: Array, stackedServiceLineData: Array, getOfferingsByServiceLine: Function }}
 */
export const usePipelineByServiceLine = (filteredOpportunities: Record<string, any>[], showNetRevenue: boolean) => {
  /**
   * Calculate pipeline data grouped by service line
   * OPTIMIZED: Single pass with Map instead of groupBy + map + reduce
   * FIX: Distribute revenue across ALL service lines (1, 2, 3) with their allocations
   */
  const pipelineByServiceLine = useMemo(() => {
    const serviceLineMap = new Map();

    // Single pass through data
    filteredOpportunities.forEach((item) => {
      // If filtered data with allocation, use allocated values
      if (item.allocatedServiceLine && item.isAllocated) {
        const serviceLine = item.allocatedServiceLine;

        if (!serviceLineMap.has(serviceLine)) {
          serviceLineMap.set(serviceLine, {
            name: serviceLine,
            originalValue: 0,
            calculatedValue: 0,
            count: 0,
          });
        }

        const data = serviceLineMap.get(serviceLine);
        data.originalValue += getRevenueValue(item, showNetRevenue);
        data.calculatedValue += calculateRevenueWithSegmentLogic(item, showNetRevenue);
        data.count++;
      } else {
        // Distribute across all service lines with their percentages
        const baseRevenue = showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(item, showNetRevenue);

        const { serviceLines, totalPercentage } = parseServiceLines(item);

        if (serviceLines.length === 0) {
          // No service lines, categorize as Uncategorized
          if (!serviceLineMap.has("Uncategorized")) {
            serviceLineMap.set("Uncategorized", {
              name: "Uncategorized",
              originalValue: 0,
              calculatedValue: 0,
              count: 0,
            });
          }
          const data = serviceLineMap.get("Uncategorized");
          data.originalValue += baseRevenue;
          data.calculatedValue += calculatedRevenue;
          data.count++;
        } else if (totalPercentage === 0) {
          // Service lines exist but no percentages, distribute equally
          const equalShare = 1 / serviceLines.length;
          serviceLines.forEach((sl) => {
            if (!serviceLineMap.has(sl.line)) {
              serviceLineMap.set(sl.line, {
                name: sl.line,
                originalValue: 0,
                calculatedValue: 0,
                count: 0,
              });
            }
            const data = serviceLineMap.get(sl.line);
            data.originalValue += baseRevenue * equalShare;
            data.calculatedValue += calculatedRevenue * equalShare;
            data.count += equalShare;
          });
        } else {
          // Distribute according to percentages
          serviceLines.forEach((sl) => {
            if (!serviceLineMap.has(sl.line)) {
              serviceLineMap.set(sl.line, {
                name: sl.line,
                originalValue: 0,
                calculatedValue: 0,
                count: 0,
              });
            }
            const allocation = parseFloat(sl.percentage) / 100;
            const data = serviceLineMap.get(sl.line);
            data.originalValue += baseRevenue * allocation;
            data.calculatedValue += calculatedRevenue * allocation;
            data.count += allocation;
          });
        }
      }
    });

    // Convert to array
    let result = Array.from(serviceLineMap.values());

    // FIX: Consolidate entries with duplicate or combined service line names
    // e.g., merge "People & Strategy" and "People & Strategy, People & Strategy" into one
    const consolidated = new Map();
    result.forEach((item) => {
      // Extract base service line name (first part before comma, or whole name if no comma)
      let baseName = item.name;

      // Check if this is a combined name with duplicates (e.g., "X, X" or "X, X, Y")
      const parts = item.name.split(", ").map((p: string) => p.trim());
      const uniqueParts = [...new Set(parts)];

      // If all parts are the same (e.g., "People & Strategy, People & Strategy"),
      // use just the single name
      if (uniqueParts.length === 1) {
        baseName = uniqueParts[0];
      }

      // Consolidate under the base name
      if (consolidated.has(baseName)) {
        const existing = consolidated.get(baseName);
        existing.originalValue += item.originalValue;
        existing.calculatedValue += item.calculatedValue;
        existing.count += item.count;
      } else {
        consolidated.set(baseName, {
          ...item,
          name: baseName, // Use the cleaned up name
        });
      }
    });
    result = Array.from(consolidated.values());

    // Sort by originalValue
    result.sort((a: any, b: any) => b.originalValue - a.originalValue);

    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Prepare stacked service line data for chart
   * OPTIMIZED: Added profiling to track performance
   * FIX: Distribute revenue across ALL service lines (1, 2, 3) with their allocations
   * FIX: Track allocated vs non-allocated portions for color distinction
   */
  const stackedServiceLineData = useMemo(() => {
    const serviceLineGroups = new Map();

    filteredOpportunities.forEach((opp) => {
      // If filtered data with allocation, calculate allocated and non-allocated portions
      if (opp.allocatedServiceLine && opp.isAllocated) {
        // Split allocated service line if it contains multiple names (e.g., "Finance & Regulatory, Technology")
        const allocatedServiceLines = opp.allocatedServiceLine
          .split(",")
          .map((name: string) => name.trim())
          .filter((name: string) => name !== "" && name !== "-");

        const baseRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        const { serviceLines, totalPercentage } = parseServiceLines(opp);

        // Process each allocated service line separately
        allocatedServiceLines.forEach((allocatedServiceLine: string) => {
          if (!serviceLineGroups.has(allocatedServiceLine)) {
            serviceLineGroups.set(allocatedServiceLine, createStackedGroup(allocatedServiceLine));
          }

          const group = serviceLineGroups.get(allocatedServiceLine);

          // Divide revenue equally among all allocated service lines
          const sharePerAllocated = 1 / allocatedServiceLines.length;
          const sharedBaseRevenue = baseRevenue * sharePerAllocated;
          const sharedCalculatedRevenue = calculatedRevenue * sharePerAllocated;

          let allocatedPortion = 0;
          let nonAllocatedPortion = 0;

          if (serviceLines.length === 0) {
            // No service lines, all goes to allocated
            allocatedPortion = sharedBaseRevenue;
          } else if (totalPercentage === 0) {
            // Equal distribution
            const equalShare = 1 / serviceLines.length;
            const matchingLines = serviceLines.filter((sl) => sl.line === allocatedServiceLine);
            allocatedPortion = sharedBaseRevenue * equalShare * matchingLines.length;
            nonAllocatedPortion = sharedBaseRevenue * equalShare * (serviceLines.length - matchingLines.length);
          } else {
            // Distribute according to percentages
            serviceLines.forEach((sl) => {
              const allocation = parseFloat(sl.percentage) / 100;
              if (sl.line === allocatedServiceLine) {
                allocatedPortion += sharedBaseRevenue * allocation;
              } else {
                nonAllocatedPortion += sharedBaseRevenue * allocation;
              }
            });
          }

          addToStatusBucket(group, opp.status, {
            base: sharedBaseRevenue,
            allocated: allocatedPortion,
            nonAllocated: nonAllocatedPortion,
            calculated: sharedCalculatedRevenue,
            countIncrement: 1,
          });

          group.total += sharedBaseRevenue;
          group.calculatedTotal += sharedCalculatedRevenue;
          group.count++;
        });
      } else {
        // Distribute across all service lines with their percentages
        // When no filter is active, show full values (allocated = total, non-allocated = 0)
        const baseRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        const { serviceLines, totalPercentage } = parseServiceLines(opp);

        if (serviceLines.length === 0) {
          // No service lines, categorize as Uncategorized
          const serviceLine = "Uncategorized";
          if (!serviceLineGroups.has(serviceLine)) {
            serviceLineGroups.set(serviceLine, createStackedGroup(serviceLine));
          }

          const group = serviceLineGroups.get(serviceLine);
          addToStatusBucket(group, opp.status, {
            base: baseRevenue,
            allocated: baseRevenue,
            nonAllocated: 0,
            calculated: calculatedRevenue,
            countIncrement: 1,
          });
          group.total += baseRevenue;
          group.calculatedTotal += calculatedRevenue;
          group.count++;
        } else if (totalPercentage === 0) {
          // Service lines exist but no percentages, distribute equally
          const equalShare = 1 / serviceLines.length;
          serviceLines.forEach((sl) => {
            if (!serviceLineGroups.has(sl.line)) {
              serviceLineGroups.set(sl.line, createStackedGroup(sl.line));
            }

            const group = serviceLineGroups.get(sl.line);
            const allocatedRevenue = baseRevenue * equalShare;
            addToStatusBucket(group, opp.status, {
              base: allocatedRevenue,
              allocated: allocatedRevenue,
              nonAllocated: 0,
              calculated: calculatedRevenue * equalShare,
              countIncrement: 1,
            });
            group.total += allocatedRevenue;
            group.calculatedTotal += calculatedRevenue * equalShare;
            group.count++;
          });
        } else {
          // Distribute according to percentages
          serviceLines.forEach((sl) => {
            if (!serviceLineGroups.has(sl.line)) {
              serviceLineGroups.set(sl.line, createStackedGroup(sl.line));
            }

            const allocation = parseFloat(sl.percentage) / 100;
            const allocatedRevenue = baseRevenue * allocation;
            const group = serviceLineGroups.get(sl.line);
            addToStatusBucket(group, opp.status, {
              base: allocatedRevenue,
              allocated: allocatedRevenue,
              nonAllocated: 0,
              calculated: calculatedRevenue * allocation,
              countIncrement: 1,
            });
            group.total += allocatedRevenue;
            group.calculatedTotal += calculatedRevenue * allocation;
            group.count++;
          });
        }
      }
    });

    // Convert to array and sort by total
    const result = Array.from(serviceLineGroups.values());
    result.sort((a: any, b: any) => b.total - a.total);

    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Calculate pipeline data grouped by offerings for a specific service line
   * Used for drill-down functionality
   * FIX: Track allocated vs non-allocated portions for color distinction
   * Allocated = portion of the service line, Non-allocated = portion of OTHER service lines
   */
  const getOfferingsByServiceLine = useCallback(
    (serviceLine: string) => {
      if (!serviceLine) return [];

      const offeringGroups = new Map();

      filteredOpportunities.forEach((opp) => {
        // Find offerings that belong to the selected service line
        const offeringData: any[] = [];

        if (opp.serviceLine1 === serviceLine && opp.serviceOffering1) {
          offeringData.push({
            offering: opp.serviceOffering1,
            percentage: opp.serviceOffering1Pct || 0,
          });
        }
        if (opp.serviceLine2 === serviceLine && opp.serviceOffering2) {
          offeringData.push({
            offering: opp.serviceOffering2,
            percentage: opp.serviceOffering2Pct || 0,
          });
        }
        if (opp.serviceLine3 === serviceLine && opp.serviceOffering3) {
          offeringData.push({
            offering: opp.serviceOffering3,
            percentage: opp.serviceOffering3Pct || 0,
          });
        }

        // Skip if no offerings found for this service line
        if (offeringData.length === 0) return;

        const baseRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        // Calculate total percentage for THIS service line (all offerings combined)
        const totalServiceLinePercentage = offeringData.reduce(
          (sum: number, { percentage }) => sum + parseFloat(percentage),
          0
        );
        // Calculate total percentage for OTHER service lines
        const otherServiceLinesPercentage = 100 - totalServiceLinePercentage;

        // Divide by number of offerings to avoid counting the same opportunity multiple times
        const numOfferings = offeringData.length;
        const sharePerOffering = 1 / numOfferings;
        const sharedBaseRevenue = baseRevenue * sharePerOffering;
        const sharedCalculatedRevenue = calculatedRevenue * sharePerOffering;

        offeringData.forEach(({ offering, percentage }) => {
          if (!offeringGroups.has(offering)) {
            offeringGroups.set(offering, createStackedGroup(offering, { isOffering: true }));
          }

          const group = offeringGroups.get(offering);

          // Calculate allocated and non-allocated portions
          // Allocated = portion from THIS service line (Technology 60%)
          // Non-allocated = portion from OTHER service lines (Finance 40%)
          const allocatedRevenue = sharedBaseRevenue * (totalServiceLinePercentage / 100);
          const nonAllocatedRevenue = sharedBaseRevenue * (otherServiceLinesPercentage / 100);
          const allocatedCalculated = sharedCalculatedRevenue * (totalServiceLinePercentage / 100);

          addToStatusBucket(group, opp.status, {
            base: sharedBaseRevenue,
            allocated: allocatedRevenue,
            nonAllocated: nonAllocatedRevenue,
            calculated: allocatedCalculated,
            countIncrement: 1,
          });

          group.total += sharedBaseRevenue;
          group.calculatedTotal += allocatedCalculated;
          group.count++;
        });
      });

      const result = Array.from(offeringGroups.values());
      result.sort((a: any, b: any) => b.total - a.total);

      return result;
    },
    [filteredOpportunities, showNetRevenue]
  );

  return {
    pipelineByServiceLine,
    stackedServiceLineData,
    getOfferingsByServiceLine,
  };
};
