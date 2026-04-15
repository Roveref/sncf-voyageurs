/**
 * PipelineTab Component - Main orchestration layer
 * Refactored for better performance and maintainability
 *
 * Performance optimizations:
 * - All data transformations use useMemo
 * - Event handlers use useCallback
 * - Child components use React.memo
 * - Heavy computations extracted into custom hooks
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Grid, Box, CircularProgress, Fade } from "@mui/material";
import OpportunityList from "../OpportunityList";
import PipelineInsights from "./components/PipelineInsights";

// Custom hooks for data management and calculations
import { useDateFilter, usePipelineData, usePipelineCalculations } from "./hooks";

// UI Components
import {
  DateRangeFilter,
  FilterStatusIndicator,
  PipelineOverviewCard,
  OpportunitySizeCard,
  PipelineStageCard,
  StatusChart,
  AccountChart,
} from "./components";

/**
 * Main PipelineTab component
 * Orchestrates all pipeline data visualization and filtering
 *
 * @param {Array} data - Raw opportunities data
 * @param {boolean} loading - Loading state
 * @param {Function} onSelection - Selection change callback
 * @param {Array} selectedOpportunities - Currently selected opportunities
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {boolean} showIO - Whether to show I&O values
 * @param {boolean} isCompleteUnitSelected - Whether complete unit is selected
 */
const PipelineTab = ({
  data,
  loading,
  onSelection,
  selectedOpportunities,
  showNetRevenue = false,
  showIO = true,
  isCompleteUnitSelected = false,
  editOpportunity,
  setEditOpportunity,
  onOpportunityCreated,
  onOpportunityUpdated,
  onOpportunityDeleted,
  filterOptions = {},
  opportunityData = [],
  navigateToOpportunityId = null,
}) => {
  // Date filtering hook
  const { dateRange, handleDateChange, handleResetDateFilter, getDateFilteredData, dateFilteredData } =
    useDateFilter(data);

  // Pipeline data management hook
  const {
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
  } = usePipelineData(data, loading, showNetRevenue, getDateFilteredData);

  // Pipeline calculations hook - memoized data groupings
  const {
    pipelineByStatus,
    pipelineByServiceLine,
    stackedServiceLineData,
    pipelineByAccount,
    getOfferingsByServiceLine,
    stackedSegmentData,
    getSubSegmentsBySegment,
  } = usePipelineCalculations(filteredOpportunities, showNetRevenue, isAllocated);

  // Segment/Account chart state management
  const [showSegmentMode, setShowSegmentMode] = useState(true); // Default to Segment mode
  const [drillDownSegment, setDrillDownSegment] = useState(null);
  const [drillDownSubSegment, setDrillDownSubSegment] = useState(null);
  const [segmentFilteredData, setSegmentFilteredData] = useState([]);
  const [filteredAccount, setFilteredAccount] = useState(null);
  const [accountFilteredData, setAccountFilteredData] = useState([]);

  // Get offerings data if in drill-down mode (memoized for performance)
  const offeringsData = useMemo(() => {
    return drillDownServiceLine ? getOfferingsByServiceLine(drillDownServiceLine) : [];
  }, [drillDownServiceLine, getOfferingsByServiceLine]);

  const serviceLineChartData = useMemo(() => {
    return drillDownServiceLine ? offeringsData : stackedServiceLineData;
  }, [drillDownServiceLine, offeringsData, stackedServiceLineData]);

  // Get sub-segments data if in segment drill-down mode (memoized for performance)
  const subSegmentsData = useMemo(() => {
    return drillDownSegment ? getSubSegmentsBySegment(drillDownSegment) : [];
  }, [drillDownSegment, getSubSegmentsBySegment]);

  const segmentChartData = useMemo(() => {
    return drillDownSegment ? subSegmentsData : stackedSegmentData;
  }, [drillDownSegment, subSegmentsData, stackedSegmentData]);

  // Toggle between Account and Segment view
  const handleToggleSegmentMode = useCallback(() => {
    setShowSegmentMode((prev) => !prev);
    // Clear any segment drill-down when switching modes
    setDrillDownSegment(null);
    setDrillDownSubSegment(null);
    setSegmentFilteredData([]);
    // Clear any account filter when switching modes
    setFilteredAccount(null);
    setAccountFilteredData([]);
  }, []);

  // Handle segment chart click for drill-down
  const handleSegmentChartClick = useCallback(
    (chartEvent) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;

      if (clickedItem.isSubSegment) {
        // Click on a sub-segment: Filter by that specific sub-segment (level 2)
        setSegmentFilteredData([...filteredOpportunities]);

        const filtered = filteredOpportunities.filter(
          (opp) => opp["Sub Segment Code"] === drillDownSegment && opp["Sub Segment"] === clickedItem.name
        );

        setDrillDownSubSegment(clickedItem.name);
        setFilteredOpportunities(filtered);
      } else if (!drillDownSegment) {
        // Click on a segment: Filter and drill down to sub-segments (level 1)
        const filtered = filteredOpportunities.filter((opp) => opp["Sub Segment Code"] === clickedItem.name);

        setDrillDownSegment(clickedItem.name);
        setFilteredOpportunities(filtered);
      }
    },
    [drillDownSegment, filteredOpportunities, setFilteredOpportunities]
  );

  // Handle back button for segment drill-down
  const handleBackFromSegmentDrillDown = useCallback(() => {
    if (drillDownSubSegment) {
      // Level 2 -> Level 1: Return to sub-segments view
      setDrillDownSubSegment(null);
      setFilteredOpportunities([...segmentFilteredData]);
      setSegmentFilteredData([]);
    } else if (drillDownSegment) {
      // Level 1 -> Level 0: Return to segments view
      setDrillDownSegment(null);
      setFilteredOpportunities(data);
    }
  }, [drillDownSegment, drillDownSubSegment, segmentFilteredData, data, setFilteredOpportunities]);

  // Handle account chart click - only filters opportunities without affecting service line drill-down
  const handleAccountChartClick = useCallback(
    (chartEvent) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;
      const accountName = clickedItem.name;

      if (!accountName) return;

      // Save current state before filtering
      setAccountFilteredData([...filteredOpportunities]);

      // Filter opportunities by account name
      const filtered = filteredOpportunities.filter((opp) => opp["Account"] === accountName);

      if (filtered.length > 0) {
        setFilteredAccount(accountName);
        setFilteredOpportunities(filtered);
        setActiveFilterType(accountName);
      }
    },
    [filteredOpportunities, setFilteredOpportunities, setActiveFilterType]
  );

  // Handle back button from account filter
  const handleBackFromAccountFilter = useCallback(() => {
    setFilteredAccount(null);
    setFilteredOpportunities([...accountFilteredData]);
    setAccountFilteredData([]);
    setActiveFilterType(null);
  }, [accountFilteredData, setFilteredOpportunities, setActiveFilterType]);

  // Handle deleting multiple manual opportunities
  const handleDeleteOpportunities = useCallback(
    (opportunitiesToDelete) => {
      if (!opportunitiesToDelete || opportunitiesToDelete.length === 0) return;

      // Get IDs of opportunities to delete
      const idsToDelete = opportunitiesToDelete.map((opp) => opp["Opportunity ID"]);

      // Remove from localStorage
      const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
      const filtered = existingOpportunities.filter((opp) => !idsToDelete.includes(opp["Opportunity ID"]));
      localStorage.setItem("manual_opportunities", JSON.stringify(filtered));

      // Deselect deleted opportunities
      const newSelection = selectedOpportunities.filter((opp) => !idsToDelete.includes(opp["Opportunity ID"]));
      onSelection(newSelection);

      // Call parent callback for each deleted opportunity to trigger data refresh
      if (onOpportunityDeleted) {
        idsToDelete.forEach((id) => onOpportunityDeleted(id));
      }
    },
    [selectedOpportunities, onSelection, onOpportunityDeleted]
  );

  // Auto-apply date filter when dateFilteredData changes
  useEffect(() => {
    setFilteredOpportunities(dateFilteredData);
    setActiveFilterType(null);
  }, [dateFilteredData, setFilteredOpportunities, setActiveFilterType]);

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Reset date filter and clear all filters
  const handleResetAndClearFilters = () => {
    handleResetDateFilter();
    // No need to manually set filtered data - useEffect will handle it
    setActiveFilterType(null);
  };

  // Handle Pareto filter (Top 20% opportunities)
  const handleParetoFilter = (top20Opportunities) => {
    setFilteredOpportunities(top20Opportunities);
    setActiveFilterType("pareto");
  };

  return (
    <Box sx={{ position: "relative", minHeight: "100vh" }}>
      <Fade in={!loading} timeout={500} style={{ overflow: "visible" }}>
        <Grid container spacing={3} sx={{ overflow: "visible" }}>
          {/* Date Range Filter */}
          <Grid item xs={12}>
            <DateRangeFilter
              dateRange={dateRange}
              onDateChange={handleDateChange}
              onResetFilter={handleResetAndClearFilters}
            />
          </Grid>

          {/* Pipeline Insights */}
          <Grid item xs={12} sx={{ overflow: "visible" }}>
            <PipelineInsights
              data={filteredOpportunities}
              onFilterChange={handlePipelineInsightFilter}
              activeFilterType={activeFilterType}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              isAllocated={isAllocated}
            />
          </Grid>

          {/* Summary Cards Row */}
          <Grid item xs={12} md={4} sx={{ overflow: "visible" }}>
            <PipelineOverviewCard
              isAllocated={isAllocated}
              totalRevenue={totalRevenue}
              calculatedTotalRevenue={calculatedTotalRevenue}
              allocatedRevenue={allocatedRevenue}
              allocationPercentage={allocationPercentage}
              dataLength={data.length}
              filteredOpportunities={filteredOpportunities}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              isCompleteUnitSelected={isCompleteUnitSelected}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ overflow: "visible" }}>
            <OpportunitySizeCard
              filteredOpportunities={filteredOpportunities}
              totalRevenue={totalRevenue}
              allocatedRevenue={allocatedRevenue}
              showNetRevenue={showNetRevenue}
              isAllocated={isAllocated}
              isCompleteUnitSelected={isCompleteUnitSelected}
              showIO={showIO}
              onParetoFilter={handleParetoFilter}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ overflow: "visible" }}>
            <PipelineStageCard
              pipelineByStatus={pipelineByStatus}
              isAllocated={isAllocated}
              allocatedRevenue={allocatedRevenue}
              totalRevenue={totalRevenue}
              showIO={showIO}
              filteredOpportunities={filteredOpportunities}
            />
          </Grid>

          {/* Charts Row */}
          <Grid item xs={12} md={6} sx={{ overflow: "visible" }}>
            <AccountChart
              data={showSegmentMode ? segmentChartData : pipelineByAccount}
              onChartClick={showSegmentMode ? handleSegmentChartClick : handleAccountChartClick}
              showIO={showIO}
              showSegmentMode={showSegmentMode}
              onToggleMode={handleToggleSegmentMode}
              drillDownSegment={drillDownSegment}
              drillDownSubSegment={drillDownSubSegment}
              filteredAccount={filteredAccount}
              onBackClick={showSegmentMode ? handleBackFromSegmentDrillDown : handleBackFromAccountFilter}
            />
          </Grid>

          <Grid item xs={12} md={6} sx={{ overflow: "visible" }}>
            <StatusChart
              data={serviceLineChartData}
              onChartClick={handleChartClick}
              showIO={showIO}
              drillDownServiceLine={drillDownServiceLine}
              drillDownOffering={drillDownOffering}
              onBackClick={handleBackToDrillDown}
            />
          </Grid>

          {/* Opportunity List */}
          <Grid item xs={12} sx={{ overflow: "visible" }}>
            <Box>
              <OpportunityList
                data={filteredOpportunities}
                title="Pipeline Opportunities"
                selectedOpportunities={selectedOpportunities}
                onSelectionChange={onSelection}
                resetFilterCallback={
                  isAllocated || filteredOpportunities.length !== data.length
                    ? () => setFilteredOpportunities(data)
                    : null
                }
                isFiltered={isAllocated || filteredOpportunities.length !== data.length}
                showNetRevenue={showNetRevenue}
                showIO={showIO}
                setEditOpportunity={setEditOpportunity}
                onDeleteOpportunities={handleDeleteOpportunities}
                onOpportunityCreated={onOpportunityCreated}
                navigateToOpportunityId={navigateToOpportunityId}
                onManualOpportunityUpdated={onOpportunityUpdated}
                excludeStatuses={[14, 15]}
              />
            </Box>
          </Grid>
        </Grid>
      </Fade>
    </Box>
  );
};

export default PipelineTab;
