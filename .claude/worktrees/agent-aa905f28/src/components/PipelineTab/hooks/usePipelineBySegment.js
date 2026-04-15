/**
 * Hook for calculating pipeline data grouped by segment
 * Extracted from usePipelineCalculations for modularity
 *
 * Contains:
 * - stackedSegmentData: Stacked bar chart data by Sub Segment Code
 * - getSubSegmentsBySegment: Drill-down callback for sub-segments within a segment
 */

import { useMemo, useCallback } from "react";
import { STATUS_CATEGORIES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../utils/revenueCalculations";

/**
 * Calculate allocated vs non-allocated revenue portions based on service line allocation
 * Shared helper for segment and sub-segment calculations
 *
 * @param {Object} opp - Opportunity object
 * @param {number} baseRevenue - Base revenue amount
 * @returns {{ allocatedPortion: number, nonAllocatedPortion: number }}
 */
const calculateAllocationPortions = (opp, baseRevenue) => {
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

  return { allocatedPortion, nonAllocatedPortion };
};

/**
 * Create a default stacked group entry for segment chart data
 *
 * @param {string} name - Segment name
 * @param {Object} [extra] - Additional fields to merge
 * @returns {Object} Default stacked group entry
 */
const createSegmentGroup = (name, extra = {}) => ({
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
 * @param {number} baseRevenue - Base revenue
 * @param {number} allocatedPortion - Allocated portion
 * @param {number} nonAllocatedPortion - Non-allocated portion
 * @param {number} calculatedRevenue - Calculated revenue
 */
const addToStatusBucket = (group, status, baseRevenue, allocatedPortion, nonAllocatedPortion, calculatedRevenue) => {
  if (STATUS_CATEGORIES.early.includes(status)) {
    group.early += baseRevenue;
    group.earlyAllocated += allocatedPortion;
    group.earlyNonAllocated += nonAllocatedPortion;
    group.calculatedEarly += calculatedRevenue;
    group.earlyCount++;
  } else if (STATUS_CATEGORIES.mid.includes(status)) {
    group.mid += baseRevenue;
    group.midAllocated += allocatedPortion;
    group.midNonAllocated += nonAllocatedPortion;
    group.calculatedMid += calculatedRevenue;
    group.midCount++;
  } else if (STATUS_CATEGORIES.late.includes(status)) {
    group.late += baseRevenue;
    group.lateAllocated += allocatedPortion;
    group.lateNonAllocated += nonAllocatedPortion;
    group.calculatedLate += calculatedRevenue;
    group.lateCount++;
  }
};

/**
 * Hook for pipeline data grouped by segment with drill-down
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {{ stackedSegmentData: Array, getSubSegmentsBySegment: Function }}
 */
export const usePipelineBySegment = (filteredOpportunities, showNetRevenue) => {
  /**
   * Calculate pipeline data grouped by segment (Sub Segment Code)
   * Similar to service line grouping with stacked bar visualization
   * FIX: Track allocated vs non-allocated portions for color distinction
   */
  const stackedSegmentData = useMemo(() => {
    const startTime = performance.now();
    const segmentGroups = new Map();

    filteredOpportunities.forEach((opp) => {
      const segment = opp["Sub Segment Code"] || "Uncategorized";

      if (!segmentGroups.has(segment)) {
        segmentGroups.set(segment, createSegmentGroup(segment));
      }

      const group = segmentGroups.get(segment);
      const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

      const { allocatedPortion, nonAllocatedPortion } = calculateAllocationPortions(opp, baseRevenue);

      addToStatusBucket(group, opp.Status, baseRevenue, allocatedPortion, nonAllocatedPortion, calculatedRevenue);
      group.total += baseRevenue;
      group.calculatedTotal += calculatedRevenue;
      group.count++;
    });

    const result = Array.from(segmentGroups.values());
    result.sort((a, b) => b.total - a.total);

    console.log(`[PERF] stackedSegmentData: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Calculate sub-segments for a specific segment (for drill-down)
   * FIX: Track allocated vs non-allocated portions for color distinction
   * @param {string} segmentCode - The segment code to drill into
   */
  const getSubSegmentsBySegment = useCallback(
    (segmentCode) => {
      if (!segmentCode) return [];

      const startTime = performance.now();
      const subSegmentGroups = new Map();

      filteredOpportunities.forEach((opp) => {
        if (opp["Sub Segment Code"] !== segmentCode) return;

        const subSegment = opp["Sub Segment"] || "Uncategorized";

        if (!subSegmentGroups.has(subSegment)) {
          subSegmentGroups.set(subSegment, createSegmentGroup(subSegment, { isSubSegment: true }));
        }

        const group = subSegmentGroups.get(subSegment);
        const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        const { allocatedPortion, nonAllocatedPortion } = calculateAllocationPortions(opp, baseRevenue);

        addToStatusBucket(group, opp.Status, baseRevenue, allocatedPortion, nonAllocatedPortion, calculatedRevenue);
        group.total += baseRevenue;
        group.calculatedTotal += calculatedRevenue;
        group.count++;
      });

      const result = Array.from(subSegmentGroups.values());
      result.sort((a, b) => b.total - a.total);

      console.log(`[PERF] getSubSegmentsBySegment: ${(performance.now() - startTime).toFixed(2)}ms`);
      return result;
    },
    [filteredOpportunities, showNetRevenue]
  );

  return {
    stackedSegmentData,
    getSubSegmentsBySegment,
  };
};
