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

import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useLoadingStore } from "../../stores/useLoadingStore";
import { useUndoStore } from "../../stores/useUndoStore";
import Grid from "@mui/material/Grid2";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import OpportunityList from "../OpportunityList";
import PipelineInsights from "./components/PipelineInsights";
import { DetachableCard } from "../shared";
import { SkeletonDashboard } from "../common/SkeletonLoaders";
import ScrollReveal from "../common/ScrollReveal";

import DeleteConfirmDialog from "../CreateOpportunityModal/DeleteConfirmDialog";

// Custom hooks for data management and calculations
import { useDateFilter } from "../../hooks/useDateFilter";
import { usePipelineData, usePipelineCalculations } from "./hooks";
import {
  usePipelineByBU,
  usePipelineBySiteInBU,
  BU_CODE_FROM_LABEL,
  BU_LABEL,
  resolveBU,
} from "./hooks/usePipelineByBU";
import { useCrmData } from "../../queries/useCrmData";

// UI Components
import DateRangeFilter from "../shared/DateRangeFilter";
import { PIPELINE_PRESETS, resolvePipelinePreset } from "../shared/dateRangePresets";
import {
  FilterStatusIndicator,
  PipelineOverviewCard,
  OpportunitySizeCard,
  PipelineStageCard,
  StatusChart,
  AccountChart,
  CumulativePipelineChart,
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
  opportunityData = [] as any[],
  sidebarFilteredData = [] as any[],
  navigateToOpportunityId = null as string | null,
  sinceYear = null as number | null,
}: any) => {
  // Date filtering hook
  const { dateRange, handleDateChange, handleResetDateFilter, getDateFilteredData, dateFilteredData } = useDateFilter(
    data,
    "creationDate"
  );

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
  const [segmentFilteredData, setSegmentFilteredData] = useState<any[]>([]);
  const [filteredAccount, setFilteredAccount] = useState(null);
  const [accountFilteredData, setAccountFilteredData] = useState<any[]>([]);

  // Get offerings data if in drill-down mode (memoized for performance)
  const offeringsData = useMemo(() => {
    return drillDownServiceLine ? getOfferingsByServiceLine(drillDownServiceLine) : [];
  }, [drillDownServiceLine, getOfferingsByServiceLine]);

  const serviceLineChartData = useMemo(() => {
    return drillDownServiceLine ? offeringsData : stackedServiceLineData;
  }, [drillDownServiceLine, offeringsData, stackedServiceLineData]);

  // « Parc par entité » chart — groupé par Business Unit (Transilien / TER / Intercités)
  // avec drill-down local : clic sur une BU → filtre la liste + affiche les sites de la BU.
  const { crmAccounts } = useCrmData();
  const [drillDownBU, setDrillDownBU] = useState<string | null>(null);
  const [buFilteredData, setBuFilteredData] = useState<any[]>([]);
  const buChartData = usePipelineByBU(filteredOpportunities, crmAccounts, showNetRevenue);
  const sitesInBuData = usePipelineBySiteInBU(filteredOpportunities, crmAccounts, showNetRevenue, drillDownBU);
  const entiteChartData = drillDownBU ? sitesInBuData : buChartData;

  const handleBuChartClick = useCallback(
    (chartEvent: any) => {
      const clickedItem = chartEvent?.activePayload?.[0]?.payload;
      const label = clickedItem?.name;
      if (!label) return;

      if (!drillDownBU) {
        // Niveau 0 → 1 : click sur une BU → filtre la liste + drill down chart
        const code = BU_CODE_FROM_LABEL[label];
        if (!code) return;
        const accountByName = new Map<string, string>();
        const accountById = new Map<string, string>();
        crmAccounts.forEach((a) => {
          if (a.parentAccount && a.account) accountByName.set(a.account, a.parentAccount);
          if (a.parentAccount && a.accountId) accountById.set(a.accountId, a.parentAccount);
        });
        const filtered = filteredOpportunities.filter((opp) => resolveBU(opp, accountByName, accountById) === code);
        if (filtered.length === 0) return;
        setBuFilteredData([...filteredOpportunities]);
        setFilteredOpportunities(filtered);
        setDrillDownBU(code);
        setActiveFilterType(BU_LABEL[code]);
      } else {
        // Niveau 1 : click sur un site → filtre par site
        const accountName = label;
        setAccountFilteredData([...filteredOpportunities]);
        const filtered = filteredOpportunities.filter((opp) => opp.account === accountName);
        if (filtered.length > 0) {
          setFilteredAccount(accountName);
          setFilteredOpportunities(filtered);
          setActiveFilterType(accountName);
        }
      }
    },
    [drillDownBU, filteredOpportunities, crmAccounts, setFilteredOpportunities, setActiveFilterType]
  );

  const handleBackFromBu = useCallback(() => {
    // Si un filtre site est actif sous la BU, le lever d'abord
    if (filteredAccount) {
      setFilteredAccount(null);
      setFilteredOpportunities([...accountFilteredData]);
      setAccountFilteredData([]);
      setActiveFilterType(BU_LABEL[drillDownBU!] ?? null);
      return;
    }
    // Sinon on sort du drill-down BU
    setDrillDownBU(null);
    if (buFilteredData.length > 0) {
      setFilteredOpportunities([...buFilteredData]);
      setBuFilteredData([]);
    }
    setActiveFilterType(null);
  }, [
    drillDownBU,
    filteredAccount,
    accountFilteredData,
    buFilteredData,
    setFilteredOpportunities,
    setActiveFilterType,
  ]);

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
    (chartEvent: any) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;

      if (clickedItem.isSubSegment) {
        // Click on a sub-segment: Filter by that specific sub-segment (level 2)
        setSegmentFilteredData([...filteredOpportunities]);

        const filtered = filteredOpportunities.filter(
          (opp) => opp.subSegmentCode === drillDownSegment && opp.subSegment === clickedItem.name
        );

        setDrillDownSubSegment(clickedItem.name);
        setFilteredOpportunities(filtered);
      } else if (!drillDownSegment) {
        // Click on a segment: Filter and drill down to sub-segments (level 1)
        const filtered = filteredOpportunities.filter((opp) => opp.subSegmentCode === clickedItem.name);

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

  // Clear all segment drill-down (jump from any level back to root)
  const handleClearSegmentDrillDown = useCallback(() => {
    setDrillDownSegment(null);
    setDrillDownSubSegment(null);
    setSegmentFilteredData([]);
    setFilteredOpportunities(data);
  }, [data, setFilteredOpportunities]);

  // Handle account chart click - only filters opportunities without affecting service line drill-down
  const handleAccountChartClick = useCallback(
    (chartEvent: any) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;
      const accountName = clickedItem.name;

      if (!accountName) return;

      // Save current state before filtering
      setAccountFilteredData([...filteredOpportunities]);

      // Filter opportunities by account name
      const filtered = filteredOpportunities.filter((opp) => opp.account === accountName);

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

  // Pending delete — opportunities waiting for confirmation
  const [confirmDeleteOpportunities, setConfirmDeleteOpportunities] = useState<any[] | null>(null);

  // Handle deleting multiple manual opportunities — shows confirmation first
  const handleDeleteOpportunities = useCallback((opportunitiesToDelete: any[]) => {
    if (!opportunitiesToDelete || opportunitiesToDelete.length === 0) return;
    setConfirmDeleteOpportunities(opportunitiesToDelete);
  }, []);

  const executeDeleteOpportunities = useCallback(
    (opportunitiesToDelete: any[]) => {
      const idsToDelete = opportunitiesToDelete.map((opp: any) => opp.opportunityId);

      // Save state for undo before deleting
      const deleted = [...opportunitiesToDelete];
      useUndoStore
        .getState()
        .push(`Delete ${deleted.length} ${deleted.length === 1 ? "opportunity" : "opportunities"}`, () => {
          deleted.forEach((opp) => useUserDataStore.getState().addManualOpportunity(opp));
        });

      // Remove from store (with cascade delete)
      idsToDelete.forEach((id) => useUserDataStore.getState().deleteManualOpportunity(id));
      useLoadingStore.getState().notify(`${idsToDelete.length} manual opportunity(s) deleted`, "success");

      // Deselect deleted opportunities
      const newSelection = selectedOpportunities.filter((opp: any) => !idsToDelete.includes(opp.opportunityId));
      onSelection(newSelection);

      // Call parent callback for each deleted opportunity to trigger data refresh
      if (onOpportunityDeleted) {
        idsToDelete.forEach((id: string) => onOpportunityDeleted(id));
      }
    },
    [selectedOpportunities, onSelection, onOpportunityDeleted]
  );

  // Cumulative pipeline chart: click a bar to show stock at that month
  const [pipelineStockFilter, setPipelineStockFilter] = useState<string | null>(null);

  // Auto-apply date filter when dateFilteredData changes
  useEffect(() => {
    setFilteredOpportunities(dateFilteredData);
    setActiveFilterType(null);
    setPipelineStockFilter(null);
  }, [dateFilteredData, setFilteredOpportunities, setActiveFilterType]);

  // Loading state
  if (loading) {
    return <SkeletonDashboard />;
  }

  // Reset date filter and clear all filters
  const handleResetAndClearFilters = () => {
    handleResetDateFilter();
    // No need to manually set filtered data - useEffect will handle it
    setActiveFilterType(null);
  };

  // Handle Pareto filter (Top 20% opportunities) — toggle: click again to clear
  const handleParetoFilter = (top20Opportunities: any[]) => {
    if (activeFilterType === "pareto") {
      // Already in Pareto mode — toggle off
      clearFilters();
      return;
    }
    setFilteredOpportunities(top20Opportunities);
    setActiveFilterType("pareto");
  };

  const handlePipelineBarClick = useCallback(
    (month: number, year: number, stockOpps: any[]) => {
      const key = `${month}:${year}`;
      if (pipelineStockFilter === key) {
        // Toggle off — restore date-filtered data
        setPipelineStockFilter(null);
        setFilteredOpportunities(dateFilteredData);
        setActiveFilterType(null);
      } else {
        setPipelineStockFilter(key);
        setFilteredOpportunities(stockOpps);
        setActiveFilterType("pipelineStock");
      }
    },
    [pipelineStockFilter, dateFilteredData, setFilteredOpportunities, setActiveFilterType]
  );

  return (
    <Box sx={{ position: "relative", minHeight: "100vh" }}>
      <DeleteConfirmDialog
        open={!!confirmDeleteOpportunities}
        onCancel={() => setConfirmDeleteOpportunities(null)}
        onConfirm={() => {
          if (confirmDeleteOpportunities) executeDeleteOpportunities(confirmDeleteOpportunities);
          setConfirmDeleteOpportunities(null);
        }}
        title={`Delete ${confirmDeleteOpportunities?.length ?? 0} ${confirmDeleteOpportunities?.length === 1 ? "opportunity" : "opportunities"}?`}
        message="This cannot be undone."
      />
      <Fade in={!loading} timeout={500} style={{ overflow: "visible" }}>
        <Grid container spacing={3} sx={{ overflow: "visible" }}>
          {/* Date Range Filter */}
          <Grid size={12}>
            <DateRangeFilter
              dateRange={dateRange}
              onDateChange={handleDateChange}
              onResetFilter={handleResetAndClearFilters}
              presetGroups={PIPELINE_PRESETS}
              resolvePreset={resolvePipelinePreset}
              resetOnToggleOff
              inactiveButtonBg="#eeeeee"
              inactiveButtonHoverBg="#e0e0e0"
            />
          </Grid>

          {/* Pipeline Insights */}
          <Grid size={12} sx={{ overflow: "visible" }}>
            <DetachableCard
              group="Parc d'actifs"
              storageKey="pip-pipeline-insights"
              title="Indicateurs du parc"
              defaultWidth={900}
              defaultHeight={400}
            >
              <PipelineInsights
                data={filteredOpportunities}
                onFilterChange={handlePipelineInsightFilter}
                activeFilterType={activeFilterType}
                showNetRevenue={showNetRevenue}
                showIO={showIO}
                isAllocated={isAllocated}
              />
            </DetachableCard>
          </Grid>

          {/* Cumulative Pipeline Chart */}
          <Grid size={12} sx={{ overflow: "visible" }}>
            <DetachableCard
              group="Parc d'actifs"
              storageKey="pip-cumulative"
              title="Évolution cumulative"
              defaultWidth={900}
              defaultHeight={500}
            >
              <CumulativePipelineChart
                allOpportunityData={sidebarFilteredData}
                loading={loading}
                showNetRevenue={showNetRevenue}
                showIO={showIO}
                onBarClick={handlePipelineBarClick}
                activeMonth={pipelineStockFilter}
                sinceYear={sinceYear}
              />
            </DetachableCard>
          </Grid>

          {/* Summary Cards Row */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
            <DetachableCard
              group="Parc d'actifs"
              storageKey="pip-overview-card"
              title="Vue d'ensemble du parc"
              defaultWidth={500}
              defaultHeight={400}
            >
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
            </DetachableCard>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
            <DetachableCard
              group="Parc d'actifs"
              storageKey="pip-size-card"
              title="Volume du parc"
              defaultWidth={500}
              defaultHeight={400}
            >
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
            </DetachableCard>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
            <DetachableCard
              group="Parc d'actifs"
              storageKey="pip-stage-card"
              title="Parc par phase"
              defaultWidth={500}
              defaultHeight={400}
            >
              <PipelineStageCard
                pipelineByStatus={pipelineByStatus}
                isAllocated={isAllocated}
                allocatedRevenue={allocatedRevenue}
                totalRevenue={totalRevenue}
                showIO={showIO}
                filteredOpportunities={filteredOpportunities}
              />
            </DetachableCard>
          </Grid>

          {/* Charts Row */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ overflow: "visible", minHeight: 450 }}>
            <ScrollReveal>
              <DetachableCard
                group="Parc d'actifs"
                storageKey="pip-account-chart"
                title="Sites"
                defaultWidth={650}
                defaultHeight={500}
              >
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
                  onClearAllDrillDown={showSegmentMode ? handleClearSegmentDrillDown : undefined}
                />
              </DetachableCard>
            </ScrollReveal>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }} sx={{ overflow: "visible", minHeight: 450 }}>
            <ScrollReveal delay={100}>
              <DetachableCard
                group="Parc d'actifs"
                storageKey="pip-status-chart"
                title="Sites"
                defaultWidth={650}
                defaultHeight={500}
              >
                <StatusChart
                  data={entiteChartData}
                  onChartClick={handleBuChartClick}
                  showIO={showIO}
                  drillDownServiceLine={drillDownBU ? BU_LABEL[drillDownBU] : null}
                  drillDownOffering={null}
                  onBackClick={handleBackFromBu}
                  onClearAllDrillDown={handleBackFromBu}
                />
              </DetachableCard>
            </ScrollReveal>
          </Grid>

          {/* Opportunity List */}
          <Grid size={12} sx={{ overflow: "visible" }}>
            <ScrollReveal>
              <DetachableCard
                group="Parc d'actifs"
                storageKey="pip-pipeline-opp-list"
                title="Actifs du parc"
                defaultWidth={1100}
                defaultHeight={700}
              >
                <OpportunityList
                  data={filteredOpportunities}
                  title="Actifs du parc"
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
                  excludeStatuses={pipelineStockFilter ? [] : [14, 15]}
                  showWinPercent
                />
              </DetachableCard>
            </ScrollReveal>
          </Grid>
        </Grid>
      </Fade>
    </Box>
  );
};

export default memo(PipelineTab);
