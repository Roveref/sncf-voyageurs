/**
 * Custom hook for managing pipeline data and state
 * Performance-optimized central data management
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  calculateBaseTotalRevenue,
  calculateTotalRevenueWithSegmentLogic,
  calculateAllocatedRevenue,
} from "../utils/revenueCalculations";

/**
 * Hook for managing pipeline data and filtering
 * Centralizes all data-related state and logic
 *
 * @param {Array} data - Raw opportunities data
 * @param {boolean} loading - Loading state
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {Function} getDateFilteredData - Date filter function
 * @returns {Object} Pipeline data state and handlers
 */
export const usePipelineData = (
  data: any[],
  loading: boolean,
  showNetRevenue: boolean,
  getDateFilteredData: (data: any[]) => any[]
) => {
  // State management
  const [filteredOpportunities, setFilteredOpportunities] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [allocatedRevenue, setAllocatedRevenue] = useState<number>(0);
  const [calculatedTotalRevenue, setCalculatedTotalRevenue] = useState<number>(0);
  const [isAllocated, setIsAllocated] = useState<boolean>(false);
  const [activeFilterType, setActiveFilterType] = useState<string | null>(null);
  const [insightFilterApplied, setInsightFilterApplied] = useState<boolean>(false);
  const [insightFilteredData, setInsightFilteredData] = useState<any[]>([]);
  const [drillDownServiceLine, setDrillDownServiceLine] = useState<string | null>(null);
  const [drillDownOffering, setDrillDownOffering] = useState<string | null>(null);
  const [serviceLineFilteredData, setServiceLineFilteredData] = useState<any[]>([]);

  /**
   * Calculate allocation percentage
   * Memoized for performance
   */
  const allocationPercentage = useMemo(() => {
    if (totalRevenue > 0 && isAllocated) {
      return Math.abs((allocatedRevenue / totalRevenue) * 100);
    }
    return isAllocated ? 100 : 0;
  }, [totalRevenue, allocatedRevenue, isAllocated]);

  /**
   * Initialize filtered opportunities on data load
   * Performance-optimized effect with proper dependencies
   */
  useEffect(() => {
    if (!data || loading) return;

    // Apply date filter to data
    const dateFilteredData = getDateFilteredData(data);

    // Initialize filtered opportunities only on first load or when data/date changes and no filter is active
    if (filteredOpportunities.length === 0 || activeFilterType === null) {
      setFilteredOpportunities(dateFilteredData);
    }

    // Check if we're using allocated revenue
    const hasAllocatedData =
      data.length > 0 &&
      data.some(
        (item) =>
          (showNetRevenue ? item.allocatedNetRevenue : item.allocatedGrossRevenue) !== undefined ||
          (item.allocationPercentage !== undefined &&
            (showNetRevenue ? item.netRevenue : item.grossRevenue) !== undefined)
      );

    // Use allocation whenever allocated data exists, regardless of whether "Allocated Service Line" is set
    setIsAllocated(hasAllocatedData);

    // Calculate total pipeline revenue (always use base revenue for total)
    const totalRev = calculateBaseTotalRevenue(data, showNetRevenue);
    const calculatedTotalRev = calculateTotalRevenueWithSegmentLogic(data, showNetRevenue);
    const allocatedRev = calculateAllocatedRevenue(data, showNetRevenue);

    setTotalRevenue(totalRev);
    setCalculatedTotalRevenue(calculatedTotalRev);
    setAllocatedRevenue(allocatedRev);
  }, [data, loading, showNetRevenue, getDateFilteredData]);

  /**
   * Update calculations when filtered opportunities change
   * Performance-optimized with cleanup
   */
  useEffect(() => {
    // If no filtered data, reset revenues to zero
    if (!filteredOpportunities || filteredOpportunities.length === 0) {
      setTotalRevenue(0);
      setCalculatedTotalRevenue(0);
      setAllocatedRevenue(0);
      setIsAllocated(false);
      return;
    }

    const isComponentMounted = true;

    // Calculate totals with the current filtered data (always use base revenue for total)
    const currentTotalRevenue = calculateBaseTotalRevenue(filteredOpportunities, showNetRevenue);
    const currentCalculatedTotalRevenue = calculateTotalRevenueWithSegmentLogic(filteredOpportunities, showNetRevenue);
    const currentAllocatedRevenue = calculateAllocatedRevenue(filteredOpportunities, showNetRevenue);

    // FIX: Check if filtered data has allocation properties
    // This prevents "Filtered Pipeline Value" from appearing during transition
    const hasAllocatedData =
      filteredOpportunities.length > 0 &&
      filteredOpportunities.some(
        (item) =>
          (showNetRevenue ? item.allocatedNetRevenue : item.allocatedGrossRevenue) !== undefined ||
          (item.allocationPercentage !== undefined &&
            (showNetRevenue ? item.netRevenue : item.grossRevenue) !== undefined)
      );

    // Use allocation whenever allocated data exists, regardless of whether "Allocated Service Line" is set
    const isUsingAllocation = hasAllocatedData;

    // Only update if the component is still mounted
    if (isComponentMounted) {
      setTotalRevenue(currentTotalRevenue);
      setCalculatedTotalRevenue(currentCalculatedTotalRevenue);
      setAllocatedRevenue(currentAllocatedRevenue);
      setIsAllocated(isUsingAllocation);
    }

    return () => {
      // This helps prevent memory leaks and race conditions
    };
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Handle pipeline insight filter
   * Performance-optimized with useCallback
   */
  const handlePipelineInsightFilter = useCallback(
    (filteredData: any[], filterType: string) => {
      // If clicking on the same filter that's already active, remove it
      if (activeFilterType === filterType && insightFilterApplied) {
        setInsightFilterApplied(false);
        setInsightFilteredData([]);
        setFilteredOpportunities([...data]);
        setActiveFilterType(null);
      } else {
        // Apply the new filter
        if (filteredData && filteredData.length > 0) {
          // OPTIMIZED: Use spread instead of JSON.parse(JSON.stringify()) which is extremely slow
          const insightData = [...filteredData];
          setInsightFilteredData(insightData);
          setInsightFilterApplied(true);
          setActiveFilterType(filterType);
          setFilteredOpportunities(filteredData);
        }
      }
    },
    [activeFilterType, insightFilterApplied, data]
  );

  /**
   * Handle chart click for filtering and drill-down
   * Performance-optimized with useCallback
   *
   * Flow:
   * 1. Click on service line: Filter dashboard by service line AND show offerings immediately
   * 2. Click on offering: Filter by that offering
   */
  const handleChartClick = useCallback(
    (chartEvent: Record<string, any> | null, isDrillDownMode: boolean = false) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;
      let filterType = null;

      // Determine filter type
      if (clickedItem.status) {
        filterType = clickedItem.status;
      } else if (clickedItem.name) {
        filterType = clickedItem.name;
      }

      // Apply new filter
      let filtered: any[] = [];
      const sourceData = insightFilterApplied ? [...insightFilteredData] : [...data];

      if (clickedItem.status) {
        // Status filtering - clear drill-down mode
        const statusNumber = parseInt(clickedItem.status.split(" ")[0]);
        filtered = sourceData.filter((opp) => opp.status === statusNumber);
        setDrillDownServiceLine(null);

        if (activeFilterType === filterType) {
          // Toggle off status filter
          if (insightFilterApplied) {
            setActiveFilterType(null);
            setFilteredOpportunities([...insightFilteredData]);
          } else {
            setActiveFilterType(null);
            setFilteredOpportunities(data);
          }
          return;
        }
      } else if (clickedItem.name) {
        // Service line / offering filtering
        if (isDrillDownMode && clickedItem.isOffering) {
          // Click on an offering: Filter by that specific offering (level 2 drill-down)
          // Save current service line filtered data before filtering by offering
          setServiceLineFilteredData([...filteredOpportunities]);

          filtered = filteredOpportunities
            .filter(
              (opp) =>
                (opp.serviceLine1 === drillDownServiceLine && opp.serviceOffering1 === clickedItem.name) ||
                (opp.serviceLine2 === drillDownServiceLine && opp.serviceOffering2 === clickedItem.name) ||
                (opp.serviceLine3 === drillDownServiceLine && opp.serviceOffering3 === clickedItem.name)
            )
            .map((opp) => {
              // Calculate the percentage allocated to the clicked offering
              let allocatedPercentage = 0;
              if (opp.serviceLine1 === drillDownServiceLine && opp.serviceOffering1 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering1Pct || 0;
              }
              if (opp.serviceLine2 === drillDownServiceLine && opp.serviceOffering2 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering2Pct || 0;
              }
              if (opp.serviceLine3 === drillDownServiceLine && opp.serviceOffering3 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering3Pct || 0;
              }

              // Calculate allocated revenue based on the percentage (capped at 100%)
              const allocationFactor = Math.min(allocatedPercentage, 100) / 100;
              const allocatedGrossRevenue = (opp.grossRevenue || 0) * allocationFactor;
              const allocatedNetRevenue = (opp.netRevenue || 0) * allocationFactor;

              return {
                ...opp,
                allocatedServiceLine: drillDownServiceLine,
                allocatedOffering: clickedItem.name,
                isAllocated: true,
                allocatedGrossRevenue: allocatedGrossRevenue,
                allocatedNetRevenue: allocatedNetRevenue,
                allocationPercentage: allocatedPercentage,
              };
            });

          // Set offering drill-down state
          setDrillDownOffering(clickedItem.name);
        } else if (isDrillDownMode && !clickedItem.isOffering) {
          // Click on service line: Filter by service line AND enter drill-down mode immediately
          // FIX: Filter by ALL service line positions (1, 2, 3), not just Service Line 1
          filtered = sourceData
            .filter(
              (opp) =>
                opp.serviceLine1 === clickedItem.name ||
                opp.serviceLine2 === clickedItem.name ||
                opp.serviceLine3 === clickedItem.name
            )
            .map((opp) => {
              // Calculate the percentage allocated to the clicked service line
              let allocatedPercentage = 0;
              if (opp.serviceLine1 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering1Pct || 0;
              }
              if (opp.serviceLine2 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering2Pct || 0;
              }
              if (opp.serviceLine3 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering3Pct || 0;
              }

              // Calculate allocated revenue based on the percentage (capped at 100%)
              const allocationFactor = Math.min(allocatedPercentage, 100) / 100;
              const allocatedGrossRevenue = (opp.grossRevenue || 0) * allocationFactor;
              const allocatedNetRevenue = (opp.netRevenue || 0) * allocationFactor;

              // FIX: Create allocation based on actual percentage, not 100%
              return {
                ...opp,
                allocatedServiceLine: clickedItem.name,
                isAllocated: true,
                allocatedGrossRevenue: allocatedGrossRevenue,
                allocatedNetRevenue: allocatedNetRevenue,
                allocationPercentage: allocatedPercentage,
              };
            });
          // Enter drill-down mode immediately (level 1)
          setDrillDownServiceLine(clickedItem.name);
          setDrillDownOffering(null);
          setServiceLineFilteredData([]);
        } else {
          // Regular status chart click (not drill-down mode)
          filtered = sourceData
            .filter(
              (opp) =>
                opp.serviceLine1 === clickedItem.name ||
                opp.serviceLine2 === clickedItem.name ||
                opp.serviceLine3 === clickedItem.name
            )
            .map((opp) => {
              // Calculate the percentage allocated to the clicked service line
              let allocatedPercentage = 0;
              if (opp.serviceLine1 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering1Pct || 0;
              }
              if (opp.serviceLine2 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering2Pct || 0;
              }
              if (opp.serviceLine3 === clickedItem.name) {
                allocatedPercentage += opp.serviceOffering3Pct || 0;
              }

              // Calculate allocated revenue based on the percentage (capped at 100%)
              const allocationFactor = Math.min(allocatedPercentage, 100) / 100;
              const allocatedGrossRevenue = (opp.grossRevenue || 0) * allocationFactor;
              const allocatedNetRevenue = (opp.netRevenue || 0) * allocationFactor;

              return {
                ...opp,
                allocatedServiceLine: clickedItem.name,
                isAllocated: true,
                allocatedGrossRevenue: allocatedGrossRevenue,
                allocatedNetRevenue: allocatedNetRevenue,
                allocationPercentage: allocatedPercentage,
              };
            });
          setDrillDownServiceLine(null);
        }
      }

      if (filtered.length > 0) {
        setActiveFilterType(filterType);
        setFilteredOpportunities(filtered);
      }
    },
    [activeFilterType, insightFilterApplied, insightFilteredData, data, drillDownServiceLine, filteredOpportunities]
  );

  /**
   * Clear all filters
   * Performance-optimized with useCallback
   */
  const clearFilters = useCallback(() => {
    setActiveFilterType(null);
    setFilteredOpportunities(data);
    setDrillDownServiceLine(null);
    setDrillDownOffering(null);
    setServiceLineFilteredData([]);
  }, [data]);

  /**
   * Handle back button from drill-down mode
   * Two-level navigation:
   * - If in offering drill-down (level 2): Returns to service line offerings view (level 1)
   * - If in service line drill-down (level 1): Returns to service lines view (level 0)
   */
  const handleBackToDrillDown = useCallback(() => {
    if (drillDownOffering) {
      // Level 2 -> Level 1: Return to offerings view, restore service line filtered data
      setDrillDownOffering(null);
      setFilteredOpportunities([...serviceLineFilteredData]);
      setServiceLineFilteredData([]);
    } else if (drillDownServiceLine) {
      // Level 1 -> Level 0: Return to service lines view, clear all drill-down
      setDrillDownServiceLine(null);
      setActiveFilterType(null);
      if (insightFilterApplied) {
        setFilteredOpportunities([...insightFilteredData]);
      } else {
        setFilteredOpportunities(data);
      }
    }
  }, [
    data,
    insightFilterApplied,
    insightFilteredData,
    drillDownServiceLine,
    drillDownOffering,
    serviceLineFilteredData,
  ]);

  return {
    filteredOpportunities,
    setFilteredOpportunities,
    totalRevenue,
    allocatedRevenue,
    calculatedTotalRevenue,
    isAllocated,
    activeFilterType,
    setActiveFilterType,
    allocationPercentage,
    handlePipelineInsightFilter,
    handleChartClick,
    clearFilters,
    drillDownServiceLine,
    drillDownOffering,
    handleBackToDrillDown,
  };
};
