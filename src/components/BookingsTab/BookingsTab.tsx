import React, { useState, useEffect, useMemo, useCallback, Dispatch, SetStateAction } from "react";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useLoadingStore } from "../../stores/useLoadingStore";
import DeleteConfirmDialog from "../CreateOpportunityModal/DeleteConfirmDialog";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Fade from "@mui/material/Fade";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { apiFetch } from "../../services/api";

import { animations, keyframes as animationKeyframes } from "../../styles/animations";

import TopAccountsSection from "./components/TopAccountsSection";
import VrCalendar from "./components/VrCalendar";
import OpportunityList from "../OpportunityList";
import ScrollReveal from "../common/ScrollReveal";
import { DetachableCard } from "../shared";

import DateRangeFilter from "../shared/DateRangeFilter";
import { BOOKINGS_PRESETS, resolveBookingsPreset, matchBookingsPreset } from "../shared/dateRangePresets";
import {
  BookingsInsights,
  BookingsSegmentCharts,
  BookingsServiceLineCharts,
  BookingsTimelineCharts,
} from "./components";
import { useBookingsState, useBookingsData, useDateAnalysis } from "./hooks";
import { useDateFilter } from "../../hooks/useDateFilter";
import { SkeletonDashboard } from "../common/SkeletonLoaders";
import { chartPalette, brand } from "../../config/brandConfig";

type Opp = Record<string, any>;

interface CurveVisibility {
  total: boolean;
  io: boolean;
  filtered: boolean;
  [key: string]: boolean;
}

interface YearColorEntry {
  bar: string;
  line: string;
  opacity: number;
}

interface BookingsTabProps {
  data: Opp[];
  loading: boolean;
  onSelection: (opps: Opp[]) => void;
  selectedOpportunities: Opp[];
  showNetRevenue?: boolean;
  showIO?: boolean;
  showLost?: boolean;
  filters?: Record<string, any>;
  originalData?: Opp[];
  isCompleteUnitSelected?: boolean;
  setEditOpportunity: (opp: Opp | null) => void;
  onOpportunityCreated?: (opp: Opp) => void;
  onOpportunityDeleted?: (id: string) => void;
  onOpportunityUpdated?: (opp: Opp) => void;
  navigateToOpportunityId?: string | null;
  sinceYear?: number | null;
}

const BookingsTab = ({
  data,
  loading,
  onSelection,
  selectedOpportunities,
  showNetRevenue = false,
  showIO = true,
  showLost = false,
  filters = {},
  originalData = [] as Opp[],
  isCompleteUnitSelected = false,
  setEditOpportunity,
  onOpportunityCreated,
  onOpportunityDeleted,
  onOpportunityUpdated,
  navigateToOpportunityId = null as string | null,
  sinceYear = null as number | null,
}: BookingsTabProps) => {
  // PHASE 2: Use modularized hooks for state management
  const bookingsState = useBookingsState(sinceYear);
  const {
    dateRange,
    setDateRange,
    filteredOpportunities,
    setFilteredOpportunities,
    topNAccounts,
    setTopNAccounts,
    selectedYears,
    setSelectedYears,
    includeStatus11,
    setIncludeStatus11,
    showSourceBreakdown,
    setShowSourceBreakdown,
    curveVisibility,
    setCurveVisibility,
    chartKey,
    setChartKey,
  } = bookingsState as {
    dateRange: [Date, Date];
    setDateRange: Dispatch<SetStateAction<[Date, Date]>>;
    filteredOpportunities: Opp[];
    setFilteredOpportunities: Dispatch<SetStateAction<Opp[]>>;
    topNAccounts: number;
    setTopNAccounts: Dispatch<SetStateAction<number>>;
    selectedYears: number[];
    setSelectedYears: Dispatch<SetStateAction<number[]>>;
    includeStatus11: boolean;
    setIncludeStatus11: Dispatch<SetStateAction<boolean>>;
    showSourceBreakdown: boolean;
    setShowSourceBreakdown: Dispatch<SetStateAction<boolean>>;
    curveVisibility: CurveVisibility;
    setCurveVisibility: Dispatch<SetStateAction<CurveVisibility>>;
    chartKey: number;
    setChartKey: Dispatch<SetStateAction<number>>;
  };

  // Use date filter hook for DateRangeFilter component
  const {
    dateRange: filterDateRange,
    handleDateChange: handleFilterDateChange,
    handleResetDateFilter,
    dateFilteredData,
  } = useDateFilter(data, "bookingDate", [
    new Date(new Date().getFullYear(), 0, 1),
    new Date(new Date().getFullYear(), 11, 31),
  ]);

  // Pending delete — opportunities waiting for confirmation
  const [confirmDeleteOpportunities, setConfirmDeleteOpportunities] = useState<Opp[] | null>(null);

  // Chart click filtering
  const [chartFilter, setChartFilter] = useState<{ type: string; value: string } | null>(null);
  // Counter to signal drill-down reset to child chart components
  const [drillDownResetKey, setDrillDownResetKey] = useState(0);

  // Apply chart filter to all data downstream
  const chartFilteredData = useMemo(() => {
    if (!chartFilter) return dateFilteredData;
    // Month filter uses raw data (cumulative chart is not date-filtered)
    const source = chartFilter.type === "month" ? data || [] : dateFilteredData;
    return source.filter((opp: Opp) => {
      switch (chartFilter.type) {
        case "segment":
          return opp.subSegmentCode === chartFilter.value;
        case "subSegment":
          return opp.subSegment === chartFilter.value;
        case "serviceLine":
          if (opp.isAllocated && opp.allocatedServiceLine) {
            return opp.allocatedServiceLine
              .split(",")
              .map((s: string) => s.trim())
              .includes(chartFilter.value);
          }
          return opp.serviceLine1 === chartFilter.value;
        case "offering":
          return opp.serviceOffering1 === chartFilter.value;
        case "month": {
          const d = opp.bookingDate ? new Date(opp.bookingDate) : null;
          if (!d) return false;
          const parts = chartFilter.value.split(":");
          if (parts.length === 2) {
            return d.getMonth() === Number(parts[0]) && d.getFullYear() === Number(parts[1]);
          }
          return d.getMonth() === Number(parts[0]);
        }
        default:
          return true;
      }
    });
  }, [dateFilteredData, chartFilter, data]);

  // PHASE 2: Use modularized hook for data processing (always uses raw data — cumulative chart state must be stable)
  const bookingsData = useBookingsData(data, loading, showNetRevenue, includeStatus11);
  const {
    yoyBookings,
    yoyLosses,
    totalBookings,
    bookingsByServiceLine,
    lossesByServiceLine,
    bookingsBySegment,
    lossesBySegment,
    years,
    lossYears,
    cumulativeData,
    cumulativeLossData,
  } = bookingsData;

  // Booking targets from var_config
  const [bookingTargets, setBookingTargets] = useState<{ annualGross: number; annualNet: number; ioGross: number }>({
    annualGross: 0,
    annualNet: 0,
    ioGross: 0,
  });
  useEffect(() => {
    apiFetch("/api/config")
      .then((r: Response) => r.json())
      .then((configData: Record<string, any>) => {
        const bt = configData.categories?.appSetting;
        if (bt) {
          const map: Record<string, string> = {};
          bt.forEach((e: any) => {
            map[e.key] = e.value;
          });
          setBookingTargets({
            annualGross: Number(map.annualGross) || 0,
            annualNet: Number(map.annualNet) || 0,
            ioGross: Number(map.ioGross) || 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Helper to calculate I&O (Operations) revenue
  const calculateIORevenue = useCallback(
    (opp: Opp) => {
      const baseRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      const specialSegmentCodes = ["AUTO", "CLR", "IEM", "LSC"];
      if (specialSegmentCodes.includes(opp.subSegmentCode)) {
        return baseRevenue;
      }
      const serviceLines = [
        { line: opp.serviceLine1, percentage: opp.serviceOffering1Pct || opp.allocation1 || 0 },
        { line: opp.serviceLine2, percentage: opp.serviceOffering2Pct || opp.allocation2 || 0 },
        { line: opp.serviceLine3, percentage: opp.serviceOffering3Pct || opp.allocation3 || 0 },
      ];
      const operationsAllocation = serviceLines.reduce(
        (total: number, service: { line: string; percentage: number }) => {
          if (service.line === "Operations") {
            return total + baseRevenue * (service.percentage / 100);
          }
          return total;
        },
        0
      );
      return operationsAllocation;
    },
    [showNetRevenue]
  );

  // Calculate Booking Insights based on chartFilteredData
  const insightsData = useMemo(() => {
    // Maintenance : interventions = données manuelles (user_assets), pas les actifs CRM
    const bookings = chartFilteredData.filter((item: Opp) => item.isManual === true && item.status !== 15);
    const losses = chartFilteredData.filter((item: Opp) => item.isManual === true && item.status === 15);

    const bookingsTotalRevenue = bookings.reduce((sum: number, opp: Opp) => {
      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      return sum + revenue;
    }, 0);

    const lossesTotalRevenue = losses.reduce((sum: number, opp: Opp) => {
      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      return sum + revenue;
    }, 0);

    // Allocated revenue: use Allocated revenue if allocated, otherwise use base revenue (respects showNetRevenue)
    const bookingsAllocatedRevenue = bookings.reduce((sum: number, opp: Opp) => {
      if (opp.isAllocated) {
        const allocated = showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0;
        return sum + allocated;
      }
      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      return sum + revenue;
    }, 0);

    const lossesAllocatedRevenue = losses.reduce((sum: number, opp: Opp) => {
      if (opp.isAllocated) {
        const allocated = showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0;
        return sum + allocated;
      }
      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      return sum + revenue;
    }, 0);

    // I&O (Operations) calculated revenue
    const bookingsCalculatedRevenue = bookings.reduce((sum: number, opp: Opp) => {
      return sum + calculateIORevenue(opp);
    }, 0);

    const lossesCalculatedRevenue = losses.reduce((sum: number, opp: Opp) => {
      return sum + calculateIORevenue(opp);
    }, 0);

    const avgBookingSize = bookings.length > 0 ? bookingsTotalRevenue / bookings.length : 0;
    const avgLossSize = losses.length > 0 ? lossesTotalRevenue / losses.length : 0;
    const avgBookingAllocated = bookings.length > 0 ? bookingsAllocatedRevenue / bookings.length : 0;
    const avgLossAllocated = losses.length > 0 ? lossesAllocatedRevenue / losses.length : 0;

    const hasAlloc = bookings.some((opp: Opp) => opp.isAllocated) || losses.some((opp: Opp) => opp.isAllocated);

    // Calculate Win Rate for "New Project" (new contracts)
    const isNewContract = (opp: Opp) => opp.engagementType === "New Project";
    const newContractBookings = bookings.filter(isNewContract);
    const newContractLosses = losses.filter(isNewContract);
    const newContractTotal = newContractBookings.length + newContractLosses.length;
    const winRateNewContract = newContractTotal > 0 ? (newContractBookings.length / newContractTotal) * 100 : 0;

    // Calculate Win Rate for Extensions (Extension / Sell on + Extension with separate Job Code)
    const isExtension = (opp: Opp) =>
      opp.engagementType === "Extension / Sell on" || opp.engagementType === "Extension with separate Job Code";
    const extensionBookings = bookings.filter(isExtension);
    const extensionLosses = losses.filter(isExtension);
    const extensionTotal = extensionBookings.length + extensionLosses.length;
    const winRateExtension = extensionTotal > 0 ? (extensionBookings.length / extensionTotal) * 100 : 0;

    return {
      bookings,
      losses,
      bookingsTotalRevenue,
      lossesTotalRevenue,
      bookingsAllocatedRevenue,
      lossesAllocatedRevenue,
      bookingsCalculatedRevenue,
      lossesCalculatedRevenue,
      avgBookingSize,
      avgLossSize,
      avgBookingAllocated,
      avgLossAllocated,
      avgBookingCalculated: bookings.length > 0 ? bookingsCalculatedRevenue / bookings.length : 0,
      avgLossCalculated: losses.length > 0 ? lossesCalculatedRevenue / losses.length : 0,
      hasAllocation: hasAlloc,
      winRateNewContract,
      newContractWins: newContractBookings.length,
      newContractTotal,
      winRateExtension,
      extensionWins: extensionBookings.length,
      extensionTotal,
    };
  }, [chartFilteredData, showNetRevenue, calculateIORevenue]);

  // Coût annuel maintenance — sum of serviceOffering2Pct across all assets in the parc
  const annualMaintenanceCost = useMemo(
    () => (data || []).reduce((sum: number, opp: Opp) => sum + (Number(opp.serviceOffering2Pct || 0) || 0), 0),
    [data]
  );

  // PHASE 2: Use modularized hook for date analysis
  const dateAnalysis = useDateAnalysis(data, dateRange, showNetRevenue);
  const { filteredBookings, filteredLosses } = dateAnalysis;

  // Dynamic color generator based on number of years in dataset
  const generateYearColors = useCallback((yearsArray: number[]) => {
    if (!yearsArray || yearsArray.length === 0) return {};

    const palette = [...chartPalette];
    const sortedYears = [...yearsArray].sort((a: number, b: number) => b - a);
    const colors: Record<number, YearColorEntry> = {};

    sortedYears.forEach((year: number, index: number) => {
      const hex = palette[index % palette.length];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const darken = 0.75;
      const lineColor = `rgb(${Math.round(r * darken)}, ${Math.round(g * darken)}, ${Math.round(b * darken)})`;

      colors[year] = {
        bar: hex,
        line: lineColor,
        opacity: 0.85,
      };
    });

    return colors;
  }, []);

  // Memoize color map based on current years
  const COLOR_BY_YEAR = useMemo(() => {
    const yearsSource = showLost ? lossYears : years;
    return generateYearColors(yearsSource);
  }, [years, lossYears, showLost, generateYearColors]);

  // PHASE 2: Memoized handlers with useCallback
  const handleStatus11Toggle = useCallback(() => {
    setIncludeStatus11((prev: boolean) => !prev);
    setChartKey((prev: number) => prev + 1);
  }, [setIncludeStatus11, setChartKey]);

  const handleCurveToggle = useCallback(
    (curveType: string) => {
      setCurveVisibility((prev: CurveVisibility) => ({
        ...prev,
        [curveType]: !prev[curveType],
      }));
      setChartKey((prev: number) => prev + 1);
    },
    [setCurveVisibility, setChartKey]
  );

  // Handle deleting multiple manual opportunities — shows confirmation first
  const handleDeleteOpportunities = useCallback((opportunitiesToDelete: Opp[]) => {
    if (!opportunitiesToDelete || opportunitiesToDelete.length === 0) return;
    setConfirmDeleteOpportunities(opportunitiesToDelete);
  }, []);

  const executeDeleteOpportunities = useCallback(
    (opportunitiesToDelete: Opp[]) => {
      const idsToDelete = opportunitiesToDelete.map((opp: Opp) => opp.opportunityId);

      idsToDelete.forEach((id: string) => useUserDataStore.getState().deleteManualOpportunity(id));
      useLoadingStore.getState().notify(`${idsToDelete.length} manual opportunity(s) deleted`, "success");

      const newSelection = selectedOpportunities.filter((opp: Opp) => !idsToDelete.includes(opp.opportunityId));
      onSelection(newSelection);

      if (onOpportunityDeleted) {
        idsToDelete.forEach((id: string) => onOpportunityDeleted(id));
      }
    },
    [selectedOpportunities, onSelection, onOpportunityDeleted]
  );

  const handleResetFilters = useCallback(() => {
    setDateRange([new Date(new Date().getFullYear(), 0, 1), new Date()]);
    setTopNAccounts(10);
  }, [setDateRange, setTopNAccounts]);

  // Update date analysis when date range changes
  const updateDateAnalysis = useCallback(() => {
    if (!showLost) {
      setFilteredOpportunities(filteredBookings);
    } else {
      setFilteredOpportunities(filteredLosses);
    }
  }, [showLost, filteredBookings, filteredLosses, setFilteredOpportunities]);

  // Default to the 2 most recent years, regardless of sinceYear
  useEffect(() => {
    if (years.length > 0) {
      const defaultYears = years.slice(-2);
      setSelectedYears((prev: number[]) =>
        prev.length === 0 ? defaultYears : prev.filter((y: number) => years.includes(y))
      );
    }
  }, [years, setSelectedYears]);

  // Update filtered opportunities when date range or showLost changes
  useEffect(() => {
    updateDateAnalysis();
  }, [dateRange, showLost, updateDateAnalysis]);

  // Memoized year selector with only available years (uses loss years when showLost)
  // Sorted chronologically (oldest first)
  const yearOptions = useMemo(() => {
    const yearsSource = showLost ? lossYears : years;
    const sortedYears = [...yearsSource].sort((a: number, b: number) => a - b);
    return sortedYears.map((year: number) => ({
      value: year,
      label: year.toString(),
      color: COLOR_BY_YEAR[year]?.bar || brand.primaryDark,
    }));
  }, [years, lossYears, showLost, COLOR_BY_YEAR]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <Fade in timeout={600} style={{ overflow: "visible" }}>
      <Box sx={{ width: "100%", overflow: "visible" }}>
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
        {/* Date Range Filter at the top */}
        <Box sx={{ mb: 3 }}>
          <DateRangeFilter
            dateRange={filterDateRange}
            onDateChange={handleFilterDateChange}
            onResetFilter={handleResetDateFilter}
            presetGroups={BOOKINGS_PRESETS}
            resolvePreset={resolveBookingsPreset}
            matchPreset={matchBookingsPreset}
            resetOnToggleOff={false}
            inactiveButtonBg="#eeeeee"
            inactiveButtonHoverBg="#e0e0e0"
          />
        </Box>

        {/* Calendrier VR — visites réglementaires à venir (PSGA) */}
        <Box sx={{ mb: 2 }}>
          <VrCalendar />
        </Box>

        {/* Booking Insights Section */}
        <DetachableCard
          group="Maintenance"
          storageKey="pip-bookings-insights"
          title="Indicateurs maintenance"
          defaultWidth={900}
          defaultHeight={400}
        >
          <BookingsInsights
            insightsData={insightsData}
            showLost={showLost}
            showIO={showIO}
            bookingTargets={bookingTargets}
            showNetRevenue={showNetRevenue}
            annualMaintenanceCost={annualMaintenanceCost}
          />
        </DetachableCard>

        {/* Cumulative Chart Section - Full Width */}
        <DetachableCard
          group="Maintenance"
          storageKey="pip-bookings-timeline"
          title="Maintenance cumulative"
          defaultWidth={900}
          defaultHeight={500}
        >
          <BookingsTimelineCharts
            cumulativeData={cumulativeData}
            cumulativeLossData={cumulativeLossData}
            years={years}
            lossYears={lossYears}
            selectedYears={selectedYears}
            setSelectedYears={setSelectedYears}
            includeStatus11={includeStatus11}
            showSourceBreakdown={showSourceBreakdown}
            setShowSourceBreakdown={setShowSourceBreakdown}
            curveVisibility={curveVisibility}
            chartKey={chartKey}
            setChartKey={setChartKey}
            chartFilter={chartFilter}
            setChartFilter={setChartFilter}
            showNetRevenue={showNetRevenue}
            showIO={showIO}
            showLost={showLost}
            handleStatus11Toggle={handleStatus11Toggle}
            COLOR_BY_YEAR={COLOR_BY_YEAR}
            yearOptions={yearOptions}
          />
        </DetachableCard>

        {/* Bar Charts Section - Segment/Account and Service Line */}
        <ScrollReveal>
          <Grid container spacing={3} sx={{ mt: 3, overflow: "visible" }}>
            <BookingsSegmentCharts
              chartFilteredData={chartFilteredData}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              showLost={showLost}
              calculateIORevenue={calculateIORevenue}
              chartFilter={chartFilter}
              setChartFilter={setChartFilter}
              drillDownResetKey={drillDownResetKey}
            />

            <BookingsServiceLineCharts
              chartFilteredData={chartFilteredData}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              showLost={showLost}
              calculateIORevenue={calculateIORevenue}
              chartFilter={chartFilter}
              setChartFilter={setChartFilter}
              drillDownResetKey={drillDownResetKey}
            />
          </Grid>
        </ScrollReveal>

        {/* Wins/Losses Analysis Section */}
        <ScrollReveal>
          <Grid size={12} sx={{ mt: 3, overflow: "visible" }}>
            <DetachableCard
              group="Maintenance"
              storageKey="pip-bookings-top-accounts"
              title="Top sites par coût maintenance"
              defaultWidth={900}
              defaultHeight={550}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  transition:
                    "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                  },
                  ...animationKeyframes.fadeInUp,
                  animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 600ms both",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="h6" fontWeight={600}>
                      {showLost ? "Déclassés" : "Maintenance"} of Top
                    </Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={topNAccounts}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTopNAccounts(Math.max(1, parseInt(e.target.value) || 10))
                      }
                      inputProps={{ min: 1, max: 100, style: { textAlign: "center" } }}
                      sx={{ width: 60 }}
                    />
                    <Typography variant="h6" fontWeight={600}>
                      Sites
                    </Typography>
                  </Box>

                  <IconButton
                    onClick={handleResetFilters}
                    title="Réinitialiser les filtres"
                    aria-label="Réinitialiser les filtres"
                    size="small"
                    sx={{ borderRadius: 1, color: "grey.500", "&:hover": { bgcolor: "grey.100", color: "grey.700" } }}
                  >
                    <RestartAltIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <TopAccountsSection
                  data={showLost ? insightsData.losses : insightsData.bookings}
                  topN={topNAccounts}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                />
              </Paper>
            </DetachableCard>
          </Grid>
        </ScrollReveal>

        {/* Opportunity List */}
        <Grid size={12} sx={{ mt: 3, overflow: "visible" }}>
          <DetachableCard
            group="Maintenance"
            storageKey="pip-bookings-opp-list"
            title="Actifs en maintenance"
            defaultWidth={1100}
            defaultHeight={700}
          >
            <OpportunityList
              data={(() => {
                const baseData = showLost ? insightsData.losses : insightsData.bookings;
                if (!chartFilter) return baseData;
                switch (chartFilter.type) {
                  case "segment":
                    return baseData.filter((opp: Opp) => opp.subSegmentCode === chartFilter.value);
                  case "subSegment":
                    return baseData.filter((opp: Opp) => opp.subSegment === chartFilter.value);
                  case "serviceLine":
                    return baseData.filter((opp: Opp) => {
                      if (opp.isAllocated && opp.allocatedServiceLine) {
                        return opp.allocatedServiceLine
                          .split(",")
                          .map((s: string) => s.trim())
                          .includes(chartFilter.value);
                      }
                      return opp.serviceLine1 === chartFilter.value;
                    });
                  case "offering":
                    return baseData.filter((opp: Opp) => opp.serviceOffering1 === chartFilter.value);
                  default:
                    return baseData;
                }
              })()}
              title={showLost ? "Actifs en fin de vie" : "Actifs en maintenance"}
              selectedOpportunities={selectedOpportunities}
              onSelectionChange={onSelection}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              isFiltered={insightsData.hasAllocation || !!chartFilter}
              resetFilterCallback={
                chartFilter
                  ? () => {
                      setChartFilter(null);
                      setDrillDownResetKey((k: number) => k + 1);
                    }
                  : null
              }
              setEditOpportunity={setEditOpportunity}
              onDeleteOpportunities={handleDeleteOpportunities}
              onOpportunityCreated={onOpportunityCreated}
              navigateToOpportunityId={navigateToOpportunityId}
              onManualOpportunityUpdated={onOpportunityUpdated}
              hideWinFilter
              hideStatusFilter
            />
          </DetachableCard>
        </Grid>
      </Box>
    </Fade>
  );
};

// PHASE 2: Wrap with React.memo for performance optimization
export default React.memo(BookingsTab);
