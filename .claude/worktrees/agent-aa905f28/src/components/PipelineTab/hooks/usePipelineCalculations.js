/**
 * Custom hook for pipeline calculations
 * Orchestrator that delegates to focused hooks for modularity
 *
 * Each focused hook is self-contained with its own useMemo/useCallback:
 * - usePipelineByStatus: Revenue by status with count
 * - usePipelineByServiceLine: Service line data, stacked chart, and offerings drill-down
 * - usePipelineBySegment: Segment stacked chart and sub-segment drill-down
 * - usePipelineByAccount: Top accounts by revenue
 */

import { usePipelineByStatus } from "./usePipelineByStatus";
import { usePipelineByServiceLine } from "./usePipelineByServiceLine";
import { usePipelineBySegment } from "./usePipelineBySegment";
import { usePipelineByAccount } from "./usePipelineByAccount";

/**
 * Hook for calculating pipeline metrics and data groupings
 * All calculations are memoized for optimal performance
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {boolean} isAllocated - Whether allocation is active
 * @returns {Object} Calculated pipeline data
 */
export const usePipelineCalculations = (filteredOpportunities, showNetRevenue, isAllocated) => {
  const pipelineByStatus = usePipelineByStatus(filteredOpportunities, showNetRevenue);
  const { pipelineByServiceLine, stackedServiceLineData, getOfferingsByServiceLine } = usePipelineByServiceLine(
    filteredOpportunities,
    showNetRevenue
  );
  const { stackedSegmentData, getSubSegmentsBySegment } = usePipelineBySegment(filteredOpportunities, showNetRevenue);
  const pipelineByAccount = usePipelineByAccount(filteredOpportunities, showNetRevenue);

  return {
    pipelineByStatus,
    pipelineByServiceLine,
    stackedServiceLineData,
    pipelineByAccount,
    getOfferingsByServiceLine,
    stackedSegmentData,
    getSubSegmentsBySegment,
  };
};
