import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Button,
  Divider,
  useTheme,
  alpha,
  Fade,
  Stack,
  InputAdornment,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterListIcon from "@mui/icons-material/FilterList";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { keyframes as animationKeyframes, easing, staggerChildren } from "../../styles/animations";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import OpportunityList from "../OpportunityList";
import TopAccountsSection from "./components/TopAccountsSection";
import DateRangeFilter from "./components/DateRangeFilter";
import SimpleBarChart from "./components/SimpleBarChart";
import { PeriodFilter, CustomTooltip, MonthlyDetailsTable, SOURCE_COLORS } from "./components";
import { useBookingsState, useBookingsData, useDateAnalysis, formatDateRange } from "./hooks";
import { useDateFilter } from "./hooks/useDateFilter";
import { calculateRevenueWithSegmentLogic } from "../../utils/dataUtils";

const BookingsTab = ({
  data,
  loading,
  onSelection,
  selectedOpportunities,
  showNetRevenue = false,
  showIO = true,
  showLost = false,
  filters = {},
  originalData = [],
  isCompleteUnitSelected = false,
  setEditOpportunity,
  onOpportunityCreated,
  onOpportunityDeleted,
  onOpportunityUpdated,
  navigateToOpportunityId = null,
}) => {
  const theme = useTheme();

  // PHASE 2: Use modularized hooks for state management
  const bookingsState = useBookingsState();
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
  } = bookingsState;

  // PHASE 2: Use modularized hook for data processing
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

  // Use date filter hook for DateRangeFilter component
  const {
    dateRange: filterDateRange,
    handleDateChange: handleFilterDateChange,
    handleResetDateFilter,
    dateFilteredData,
  } = useDateFilter(data);

  // Drill-down state for segment chart
  const [drillDownSegment, setDrillDownSegment] = useState(null);
  // Drill-down state for service line chart
  const [drillDownServiceLine, setDrillDownServiceLine] = useState(null);
  // Toggle between Segment and Account view
  const [showAccountMode, setShowAccountMode] = useState(false);

  // Helper to calculate I&O (Operations) revenue
  const calculateIORevenue = (opp) => {
    const specialSegmentCodes = ["AUTO", "CLR", "IEM", "LSC"];
    if (specialSegmentCodes.includes(opp["Sub Segment Code"])) {
      return opp["Gross Revenue"] || 0;
    }
    const serviceLines = [
      { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || opp["Allocation 1"] || 0 },
      { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || opp["Allocation 2"] || 0 },
      { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || opp["Allocation 3"] || 0 },
    ];
    const baseRevenue = opp["Gross Revenue"] || 0;
    const operationsAllocation = serviceLines.reduce((total, service) => {
      if (service.line === "Operations") {
        return total + baseRevenue * (service.percentage / 100);
      }
      return total;
    }, 0);
    return operationsAllocation;
  };

  // Calculate filtered segment data based on date filter and drill-down state
  const filteredBookingsBySegment = useMemo(() => {
    let filteredBooked = dateFilteredData.filter((item) => item["Status"] === 14);
    if (!filteredBooked || filteredBooked.length === 0) return [];

    // If drilling down, filter by the selected segment
    if (drillDownSegment) {
      filteredBooked = filteredBooked.filter((opp) => opp["Sub Segment Code"] === drillDownSegment);
    }

    const bySegment = [];
    const segmentsMap = {};
    // Use Sub Segment when drilling down, otherwise Sub Segment Code
    const groupKey = drillDownSegment ? "Sub Segment" : "Sub Segment Code";

    filteredBooked.forEach((opp) => {
      const segment = opp[groupKey];
      if (!segment) return;

      const grossRevenue = opp["Gross Revenue"] || 0;
      const isAllocated = opp["Is Allocated"] && opp["Allocated Gross Revenue"];
      const allocatedRevenue = isAllocated ? opp["Allocated Gross Revenue"] : grossRevenue;
      const calculatedRevenue = calculateIORevenue(opp);

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          allocatedValue: 0,
          calculatedValue: 0,
          count: 0,
          isSubSegment: !!drillDownSegment,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += grossRevenue;
      segmentsMap[segment].allocatedValue += allocatedRevenue;
      segmentsMap[segment].calculatedValue += calculatedRevenue;
      segmentsMap[segment].count += 1;
    });

    bySegment.sort((a, b) => b.value - a.value);
    return bySegment;
  }, [dateFilteredData, drillDownSegment]);

  const filteredLossesBySegment = useMemo(() => {
    let filteredLost = dateFilteredData.filter((item) => item["Status"] === 15);
    if (!filteredLost || filteredLost.length === 0) return [];

    // If drilling down, filter by the selected segment
    if (drillDownSegment) {
      filteredLost = filteredLost.filter((opp) => opp["Sub Segment Code"] === drillDownSegment);
    }

    const bySegment = [];
    const segmentsMap = {};
    const groupKey = drillDownSegment ? "Sub Segment" : "Sub Segment Code";

    filteredLost.forEach((opp) => {
      const segment = opp[groupKey];
      if (!segment) return;

      const grossRevenue = opp["Gross Revenue"] || 0;
      const isAllocated = opp["Is Allocated"] && opp["Allocated Gross Revenue"];
      const allocatedRevenue = isAllocated ? opp["Allocated Gross Revenue"] : grossRevenue;
      const calculatedRevenue = calculateIORevenue(opp);

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          allocatedValue: 0,
          calculatedValue: 0,
          count: 0,
          isSubSegment: !!drillDownSegment,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += grossRevenue;
      segmentsMap[segment].allocatedValue += allocatedRevenue;
      segmentsMap[segment].calculatedValue += calculatedRevenue;
      segmentsMap[segment].count += 1;
    });

    bySegment.sort((a, b) => b.value - a.value);
    return bySegment;
  }, [dateFilteredData, drillDownSegment]);

  // Calculate filtered service line data based on date filter and drill-down state
  // Uses same logic as Pipeline: when allocation is active, group by Allocated Service Line
  const filteredBookingsByServiceLine = useMemo(() => {
    let filteredBooked = dateFilteredData.filter((item) => item["Status"] === 14);
    if (!filteredBooked || filteredBooked.length === 0) return [];

    // If drilling down, filter by the selected service line (using Allocated Service Line if allocated)
    if (drillDownServiceLine) {
      filteredBooked = filteredBooked.filter((opp) => {
        // If allocated, check Allocated Service Line
        if (opp["Is Allocated"] && opp["Allocated Service Line"]) {
          const allocatedLines = opp["Allocated Service Line"]
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && name !== "-");
          return allocatedLines.includes(drillDownServiceLine);
        }
        // Otherwise check Service Line 1
        return opp["Service Line 1"] === drillDownServiceLine;
      });
    }

    const byServiceLine = [];
    const serviceLinesMap = {};

    filteredBooked.forEach((opp) => {
      const grossRevenue = opp["Gross Revenue"] || 0;
      const isAllocated = opp["Is Allocated"] && opp["Allocated Gross Revenue"];
      const allocatedRevenue = isAllocated ? opp["Allocated Gross Revenue"] : grossRevenue;
      const calculatedRevenue = calculateIORevenue(opp);

      // When drilling down, group by Service Offering 1
      if (drillDownServiceLine) {
        const serviceLine = opp["Service Offering 1"];
        if (!serviceLine) return;

        if (!serviceLinesMap[serviceLine]) {
          serviceLinesMap[serviceLine] = {
            name: serviceLine,
            value: 0,
            allocatedValue: 0,
            calculatedValue: 0,
            count: 0,
            isOffering: true,
          };
          byServiceLine.push(serviceLinesMap[serviceLine]);
        }

        serviceLinesMap[serviceLine].value += grossRevenue;
        serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
        serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
        serviceLinesMap[serviceLine].count += 1;
      } else {
        // When not drilling down, use Allocated Service Line if allocated, otherwise Service Line 1
        if (opp["Is Allocated"] && opp["Allocated Service Line"]) {
          // Split allocated service line if it contains multiple names
          const allocatedServiceLines = opp["Allocated Service Line"]
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && name !== "-");

          // Divide revenue equally among allocated service lines
          const sharePerAllocated = 1 / allocatedServiceLines.length;

          allocatedServiceLines.forEach((serviceLine) => {
            if (!serviceLinesMap[serviceLine]) {
              serviceLinesMap[serviceLine] = {
                name: serviceLine,
                value: 0,
                allocatedValue: 0,
                calculatedValue: 0,
                count: 0,
                isOffering: false,
              };
              byServiceLine.push(serviceLinesMap[serviceLine]);
            }

            serviceLinesMap[serviceLine].value += grossRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].count += sharePerAllocated;
          });
        } else {
          // Use Service Line 1 for non-allocated opportunities
          const serviceLine = opp["Service Line 1"];
          if (!serviceLine) return;

          if (!serviceLinesMap[serviceLine]) {
            serviceLinesMap[serviceLine] = {
              name: serviceLine,
              value: 0,
              allocatedValue: 0,
              calculatedValue: 0,
              count: 0,
              isOffering: false,
            };
            byServiceLine.push(serviceLinesMap[serviceLine]);
          }

          serviceLinesMap[serviceLine].value += grossRevenue;
          serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
          serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
          serviceLinesMap[serviceLine].count += 1;
        }
      }
    });

    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [dateFilteredData, drillDownServiceLine]);

  // Calculate filtered losses by service line (same allocation logic as bookings)
  const filteredLossesByServiceLine = useMemo(() => {
    let filteredLost = dateFilteredData.filter((item) => item["Status"] === 15);
    if (!filteredLost || filteredLost.length === 0) return [];

    // If drilling down, filter by the selected service line (using Allocated Service Line if allocated)
    if (drillDownServiceLine) {
      filteredLost = filteredLost.filter((opp) => {
        // If allocated, check Allocated Service Line
        if (opp["Is Allocated"] && opp["Allocated Service Line"]) {
          const allocatedLines = opp["Allocated Service Line"]
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && name !== "-");
          return allocatedLines.includes(drillDownServiceLine);
        }
        // Otherwise check Service Line 1
        return opp["Service Line 1"] === drillDownServiceLine;
      });
    }

    const byServiceLine = [];
    const serviceLinesMap = {};

    filteredLost.forEach((opp) => {
      const grossRevenue = opp["Gross Revenue"] || 0;
      const isAllocated = opp["Is Allocated"] && opp["Allocated Gross Revenue"];
      const allocatedRevenue = isAllocated ? opp["Allocated Gross Revenue"] : grossRevenue;
      const calculatedRevenue = calculateIORevenue(opp);

      // When drilling down, group by Service Offering 1
      if (drillDownServiceLine) {
        const serviceLine = opp["Service Offering 1"];
        if (!serviceLine) return;

        if (!serviceLinesMap[serviceLine]) {
          serviceLinesMap[serviceLine] = {
            name: serviceLine,
            value: 0,
            allocatedValue: 0,
            calculatedValue: 0,
            count: 0,
            isOffering: true,
          };
          byServiceLine.push(serviceLinesMap[serviceLine]);
        }

        serviceLinesMap[serviceLine].value += grossRevenue;
        serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
        serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
        serviceLinesMap[serviceLine].count += 1;
      } else {
        // When not drilling down, use Allocated Service Line if allocated, otherwise Service Line 1
        if (opp["Is Allocated"] && opp["Allocated Service Line"]) {
          // Split allocated service line if it contains multiple names
          const allocatedServiceLines = opp["Allocated Service Line"]
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && name !== "-");

          // Divide revenue equally among allocated service lines
          const sharePerAllocated = 1 / allocatedServiceLines.length;

          allocatedServiceLines.forEach((serviceLine) => {
            if (!serviceLinesMap[serviceLine]) {
              serviceLinesMap[serviceLine] = {
                name: serviceLine,
                value: 0,
                allocatedValue: 0,
                calculatedValue: 0,
                count: 0,
                isOffering: false,
              };
              byServiceLine.push(serviceLinesMap[serviceLine]);
            }

            serviceLinesMap[serviceLine].value += grossRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue * sharePerAllocated;
            serviceLinesMap[serviceLine].count += sharePerAllocated;
          });
        } else {
          // Use Service Line 1 for non-allocated opportunities
          const serviceLine = opp["Service Line 1"];
          if (!serviceLine) return;

          if (!serviceLinesMap[serviceLine]) {
            serviceLinesMap[serviceLine] = {
              name: serviceLine,
              value: 0,
              allocatedValue: 0,
              calculatedValue: 0,
              count: 0,
              isOffering: false,
            };
            byServiceLine.push(serviceLinesMap[serviceLine]);
          }

          serviceLinesMap[serviceLine].value += grossRevenue;
          serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
          serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
          serviceLinesMap[serviceLine].count += 1;
        }
      }
    });

    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [dateFilteredData, drillDownServiceLine]);

  // Calculate filtered bookings by Account (for Account mode toggle)
  const filteredBookingsByAccount = useMemo(() => {
    const filteredBooked = dateFilteredData.filter((item) => item["Status"] === 14);
    if (!filteredBooked || filteredBooked.length === 0) return [];

    const byAccount = [];
    const accountsMap = {};

    filteredBooked.forEach((opp) => {
      const account = opp["Account"];
      if (!account) return;

      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;

      if (!accountsMap[account]) {
        accountsMap[account] = { name: account, value: 0, count: 0 };
        byAccount.push(accountsMap[account]);
      }

      accountsMap[account].value += revenue;
      accountsMap[account].count += 1;
    });

    byAccount.sort((a, b) => b.value - a.value);
    return byAccount;
  }, [dateFilteredData, showNetRevenue]);

  const filteredLossesByAccount = useMemo(() => {
    const filteredLost = dateFilteredData.filter((item) => item["Status"] === 15);
    if (!filteredLost || filteredLost.length === 0) return [];

    const byAccount = [];
    const accountsMap = {};

    filteredLost.forEach((opp) => {
      const account = opp["Account"];
      if (!account) return;

      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;

      if (!accountsMap[account]) {
        accountsMap[account] = { name: account, value: 0, count: 0 };
        byAccount.push(accountsMap[account]);
      }

      accountsMap[account].value += revenue;
      accountsMap[account].count += 1;
    });

    byAccount.sort((a, b) => b.value - a.value);
    return byAccount;
  }, [dateFilteredData, showNetRevenue]);

  // Segment chart click handler for drill-down
  const handleSegmentChartClick = useCallback(
    (chartEvent) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;

      // If already in drill-down mode, don't go deeper
      if (drillDownSegment) return;

      // Drill down to sub-segments
      setDrillDownSegment(clickedItem.name);
    },
    [drillDownSegment]
  );

  // Service line chart click handler for drill-down
  const handleServiceLineChartClick = useCallback(
    (chartEvent) => {
      if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

      const clickedItem = chartEvent.activePayload[0].payload;

      // If already in drill-down mode, don't go deeper
      if (drillDownServiceLine) return;

      // Drill down to service offerings
      setDrillDownServiceLine(clickedItem.name);
    },
    [drillDownServiceLine]
  );

  // Back button handlers
  const handleBackFromSegmentDrillDown = useCallback(() => {
    setDrillDownSegment(null);
  }, []);

  const handleBackFromServiceLineDrillDown = useCallback(() => {
    setDrillDownServiceLine(null);
  }, []);

  // Toggle Account/Segment mode
  const handleToggleAccountMode = useCallback(() => {
    setShowAccountMode((prev) => !prev);
    setDrillDownSegment(null); // Reset drill-down when switching modes
  }, []);

  // Calculate Booking Insights based on dateFilteredData
  const insightsData = useMemo(() => {
    const bookings = dateFilteredData.filter((item) => item["Status"] === 14);
    const losses = dateFilteredData.filter((item) => item["Status"] === 15);

    const bookingsTotalRevenue = bookings.reduce((sum, opp) => {
      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      return sum + revenue;
    }, 0);

    const lossesTotalRevenue = losses.reduce((sum, opp) => {
      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      return sum + revenue;
    }, 0);

    // Allocated revenue: use Allocated Gross Revenue if allocated, otherwise use Gross Revenue
    const bookingsAllocatedRevenue = bookings.reduce((sum, opp) => {
      const revenue =
        opp["Is Allocated"] && opp["Allocated Gross Revenue"]
          ? opp["Allocated Gross Revenue"]
          : opp["Gross Revenue"] || 0;
      return sum + revenue;
    }, 0);

    const lossesAllocatedRevenue = losses.reduce((sum, opp) => {
      const revenue =
        opp["Is Allocated"] && opp["Allocated Gross Revenue"]
          ? opp["Allocated Gross Revenue"]
          : opp["Gross Revenue"] || 0;
      return sum + revenue;
    }, 0);

    // I&O (Operations) calculated revenue
    const bookingsCalculatedRevenue = bookings.reduce((sum, opp) => {
      return sum + calculateIORevenue(opp);
    }, 0);

    const lossesCalculatedRevenue = losses.reduce((sum, opp) => {
      return sum + calculateIORevenue(opp);
    }, 0);

    const avgBookingSize = bookings.length > 0 ? bookingsTotalRevenue / bookings.length : 0;
    const avgLossSize = losses.length > 0 ? lossesTotalRevenue / losses.length : 0;
    const avgBookingAllocated = bookings.length > 0 ? bookingsAllocatedRevenue / bookings.length : 0;
    const avgLossAllocated = losses.length > 0 ? lossesAllocatedRevenue / losses.length : 0;

    const hasAlloc = bookings.some((opp) => opp["Is Allocated"]) || losses.some((opp) => opp["Is Allocated"]);

    // Calculate Win Rate for "New Contract"
    const newContractBookings = bookings.filter((opp) => opp["Project Type"] === "New Contract");
    const newContractLosses = losses.filter((opp) => opp["Project Type"] === "New Contract");
    const newContractTotal = newContractBookings.length + newContractLosses.length;
    const winRateNewContract = newContractTotal > 0 ? (newContractBookings.length / newContractTotal) * 100 : 0;

    // Calculate Win Rate for "Extension / Sell-on"
    const extensionBookings = bookings.filter((opp) => opp["Project Type"] === "Extension / Sell-on");
    const extensionLosses = losses.filter((opp) => opp["Project Type"] === "Extension / Sell-on");
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
  }, [dateFilteredData, showNetRevenue]);

  // PHASE 2: Use modularized hook for date analysis
  const dateAnalysis = useDateAnalysis(data, dateRange, showNetRevenue);
  const {
    filteredBookings,
    filteredLosses,
    filteredBookingsTotalRevenue,
    filteredLossesTotalRevenue,
    filteredBookingsAllocatedRevenue,
    filteredLossesAllocatedRevenue,
    averageBookingSizeTotal,
    averageBookingSizeAllocated,
    averageLossSizeTotal,
    averageLossSizeAllocated,
    hasAllocation,
  } = dateAnalysis;

  // Dynamic color generator based on number of years in dataset
  // Generates red shades: lightest for oldest year, darkest for most recent
  const generateYearColors = useCallback((yearsArray) => {
    if (!yearsArray || yearsArray.length === 0) return {};

    // Same palette as "Bookings by Service Line" (SimpleBarChart)
    const palette = ["#FF3D47", "#806659", "#98847A", "#5C4A3F", "#D6CCC5", "#B2A59F", "#CCC1BC", "#E6DEDA"];

    const sortedYears = [...yearsArray].sort((a, b) => b - a);
    const colors = {};

    sortedYears.forEach((year, index) => {
      const hex = palette[index % palette.length];
      // Derive a darker shade for the line
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
    setIncludeStatus11((prev) => !prev);
    setChartKey((prev) => prev + 1);
  }, [setIncludeStatus11, setChartKey]);

  const handleCurveToggle = useCallback(
    (curveType) => {
      setCurveVisibility((prev) => ({
        ...prev,
        [curveType]: !prev[curveType],
      }));
      setChartKey((prev) => prev + 1);
    },
    [setCurveVisibility, setChartKey]
  );

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

      // Trigger refresh via callback
      if (onOpportunityDeleted) {
        idsToDelete.forEach((id) => onOpportunityDeleted(id));
      }
    },
    [selectedOpportunities, onSelection, onOpportunityDeleted]
  );

  const handleChartClick = useCallback(
    (data) => {
      if (data && data.activePayload) {
        const monthData = data.activePayload[0]?.payload;
        if (monthData) {
          const opportunities = [];
          years.forEach((year) => {
            const yearOpps = monthData[`${year}Opps`] || [];
            opportunities.push(...yearOpps);
          });
          setFilteredOpportunities(opportunities);
        }
      }
    },
    [years, setFilteredOpportunities]
  );

  const handleResetFilters = useCallback(() => {
    setDateRange([new Date(new Date().getFullYear(), 0, 1), new Date()]);
    setTopNAccounts(10);
  }, [setDateRange, setTopNAccounts]);

  const handleTopNChange = useCallback(
    (event) => {
      setTopNAccounts(parseInt(event.target.value, 10));
    },
    [setTopNAccounts]
  );

  // Update date analysis when date range changes
  const updateDateAnalysis = useCallback(() => {
    if (!showLost) {
      setFilteredOpportunities(filteredBookings);
    } else {
      setFilteredOpportunities(filteredLosses);
    }
  }, [showLost, filteredBookings, filteredLosses, setFilteredOpportunities]);

  // Initialize selectedYears to current year and previous year when years data is available
  useEffect(() => {
    if (years.length > 0) {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;
      // Default to current year and previous year
      const defaultYears = years.filter((y) => y === currentYear || y === previousYear);
      setSelectedYears((prev) =>
        prev.length === 0
          ? defaultYears.length > 0
            ? defaultYears
            : [years[years.length - 1]]
          : prev.filter((y) => years.includes(y))
      );
    }
  }, [years, setSelectedYears]);

  // Update filtered opportunities when date range or showLost changes
  useEffect(() => {
    updateDateAnalysis();
  }, [dateRange, showLost, updateDateAnalysis]);

  // Memoized chart data filtered by selected years (uses losses data when showLost)
  const filteredChartData = useMemo(() => {
    const dataSource = showLost ? cumulativeLossData : cumulativeData;
    if (selectedYears.length === 0) return dataSource;
    return dataSource;
  }, [cumulativeData, cumulativeLossData, selectedYears, showLost]);

  // Memoized year selector with only available years (uses loss years when showLost)
  // Sorted chronologically (oldest first)
  const yearOptions = useMemo(() => {
    const yearsSource = showLost ? lossYears : years;
    const sortedYears = [...yearsSource].sort((a, b) => a - b);
    return sortedYears.map((year) => ({
      value: year,
      label: year.toString(),
      color: COLOR_BY_YEAR[year]?.bar || "#CC2931",
    }));
  }, [years, lossYears, showLost, COLOR_BY_YEAR]);

  // Calculate total bookings with Status 11
  const totalBookingsWithStatus11 = useMemo(() => {
    if (!includeStatus11 || !cumulativeData || cumulativeData.length === 0) {
      return totalBookings;
    }
    const lastMonth = cumulativeData[cumulativeData.length - 1];
    let total = 0;
    years.forEach((year) => {
      total += lastMonth[`${year}_combined_cumulative`] || 0;
    });
    return total;
  }, [includeStatus11, cumulativeData, totalBookings, years]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Fade in timeout={600} style={{ overflow: "visible" }}>
      <Box sx={{ width: "100%", overflow: "visible" }}>
        {/* Date Range Filter at the top */}
        <Box sx={{ mb: 3 }}>
          <DateRangeFilter
            dateRange={filterDateRange}
            onDateChange={handleFilterDateChange}
            onResetFilter={handleResetDateFilter}
          />
        </Box>

        {/* Booking Insights Section */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            mb: 3,
            overflow: "visible",
            transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
            "&:hover": {
              transform: "translateY(-4px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            },
            ...animationKeyframes.fadeInUp,
            animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms both",
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
            <Typography variant="h6" gutterBottom fontWeight={600}>
              {showLost ? "Lost Insights" : "Booking Insights"}
            </Typography>

            <Chip
              label={formatDateRange(dateRange)}
              size="small"
              variant="outlined"
              color={showLost ? "error" : "success"}
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3} sx={{ px: 2, py: 1, "& .MuiGrid-item": { overflow: "visible" } }}>
            {/* Total Bookings / Total Lost */}
            <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(showLost ? theme.palette.error.main : theme.palette.success.main, 0.08),
                  height: "100%",
                  transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                  "&:hover": {
                    bgcolor: alpha(showLost ? theme.palette.error.main : theme.palette.success.main, 0.12),
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  },
                  ...animationKeyframes.fadeInUp,
                  animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 100ms both",
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {showLost ? "Total Lost" : "Total Bookings"}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    position: "relative",
                    minHeight: 70,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        color={showLost ? "error.main" : "success.main"}
                        sx={{
                          ...animationKeyframes.countUp,
                          animation: "countUp 0.5s cubic-bezier(0.23, 1, 0.32, 1) 200ms both",
                        }}
                      >
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(showLost ? insightsData.lossesTotalRevenue : insightsData.bookingsTotalRevenue)}
                      </Typography>
                      {/* Show allocation arrow when there's a difference (independent of showIO) */}
                      {insightsData.hasAllocation &&
                        (showLost ? insightsData.lossesAllocatedRevenue : insightsData.bookingsAllocatedRevenue) !==
                          (showLost ? insightsData.lossesTotalRevenue : insightsData.bookingsTotalRevenue) && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              →
                            </Typography>
                            <Typography variant="h5" fontWeight={600} color="secondary.main">
                              {new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(
                                showLost ? insightsData.lossesAllocatedRevenue : insightsData.bookingsAllocatedRevenue
                              )}
                            </Typography>
                          </>
                        )}
                    </Box>
                    {/* Show I&O when showIO is enabled */}
                    {showIO &&
                      (showLost ? insightsData.lossesCalculatedRevenue : insightsData.bookingsCalculatedRevenue) >
                        0 && (
                        <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                          (I&O:{" "}
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(
                            showLost ? insightsData.lossesCalculatedRevenue : insightsData.bookingsCalculatedRevenue
                          )}
                          )
                        </Typography>
                      )}
                  </Box>
                  <Typography variant="h5" color="text.secondary" sx={{ ml: 2 }}>
                    {showLost ? insightsData.losses.length : insightsData.bookings.length}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Average Booking Size / Average Lost Size */}
            <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.08),
                  height: "100%",
                  transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.info.main, 0.12),
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  },
                  ...animationKeyframes.fadeInUp,
                  animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both",
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {showLost ? "Avg. Lost Size" : "Avg. Booking Size"}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 70,
                    justifyContent: "center",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      color="info.main"
                      sx={{
                        ...animationKeyframes.countUp,
                        animation: "countUp 0.5s cubic-bezier(0.23, 1, 0.32, 1) 300ms both",
                      }}
                    >
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(showLost ? insightsData.avgLossSize : insightsData.avgBookingSize)}
                    </Typography>
                    {/* Show allocation arrow when there's a difference (independent of showIO) */}
                    {insightsData.hasAllocation &&
                      (showLost ? insightsData.avgLossAllocated : insightsData.avgBookingAllocated) !==
                        (showLost ? insightsData.avgLossSize : insightsData.avgBookingSize) && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            →
                          </Typography>
                          <Typography variant="h5" fontWeight={600} color="secondary.main">
                            {new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }).format(showLost ? insightsData.avgLossAllocated : insightsData.avgBookingAllocated)}
                          </Typography>
                        </>
                      )}
                  </Box>
                  {/* Show I&O when showIO is enabled */}
                  {showIO && (showLost ? insightsData.avgLossCalculated : insightsData.avgBookingCalculated) > 0 && (
                    <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                      (I&O:{" "}
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(showLost ? insightsData.avgLossCalculated : insightsData.avgBookingCalculated)}
                      )
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Win Rates */}
            <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  height: "100%",
                  transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.warning.main, 0.12),
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  },
                  ...animationKeyframes.fadeInUp,
                  animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    Win Rate
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    minHeight: 70,
                  }}
                >
                  {/* New Contract Win Rate */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        New Contract
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {insightsData.winRateNewContract.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({insightsData.newContractWins}/{insightsData.newContractTotal})
                      </Typography>
                    </Box>
                  </Box>

                  {/* Extension / Sell-on Win Rate */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Extension / Sell-on
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {insightsData.winRateExtension.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({insightsData.extensionWins}/{insightsData.extensionTotal})
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Cumulative Chart Section - Full Width */}
        <Grid container spacing={3} sx={{ overflow: "visible" }}>
          <Grid item xs={12} sx={{ overflow: "visible" }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                },
                ...animationKeyframes.fadeInUp,
                animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 400ms both",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                    flexWrap: "wrap",
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      {showLost ? "Cumulative Lost" : "Cumulative Bookings"}
                    </Typography>

                    {/* Year selector chips in header - sorted chronologically */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {yearOptions.map((option) => {
                        const isSelected = selectedYears.includes(option.value);
                        return (
                          <Chip
                            key={option.value}
                            label={option.label}
                            size="small"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedYears(selectedYears.filter((y) => y !== option.value));
                              } else {
                                setSelectedYears([...selectedYears, option.value]);
                              }
                            }}
                            sx={{
                              bgcolor: isSelected ? option.color : alpha(option.color, 0.08),
                              color: isSelected ? "white" : "text.secondary",
                              border: "none",
                              fontWeight: isSelected ? 600 : 400,
                              transition: "all 0.2s ease-in-out",
                              "&:hover": {
                                bgcolor: isSelected ? option.color : alpha(option.color, 0.15),
                                transform: "scale(1.05)",
                              },
                              "&::before": !isSelected
                                ? {
                                    content: '""',
                                    position: "absolute",
                                    left: 8,
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: option.color,
                                  }
                                : {},
                              pl: !isSelected ? 2.5 : 1.5,
                              position: "relative",
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>

                  {/* Combined Toggles: Status 11 + Manual Edits - Only shown for Bookings view */}
                  {!showLost && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.grey[500], 0.06),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }}
                    >
                      {/* Status 11 Toggle */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1.5,
                          bgcolor: includeStatus11 ? alpha(SOURCE_COLORS.status11, 0.15) : "transparent",
                          transition: "all 0.2s ease-in-out",
                          cursor: "pointer",
                          "&:hover": {
                            bgcolor: alpha(SOURCE_COLORS.status11, 0.1),
                          },
                        }}
                        onClick={handleStatus11Toggle}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: SOURCE_COLORS.status11,
                            opacity: includeStatus11 ? 1 : 0.4,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: includeStatus11 ? 600 : 400,
                            color: includeStatus11 ? SOURCE_COLORS.status11 : "text.secondary",
                            transition: "all 0.2s ease-in-out",
                            userSelect: "none",
                          }}
                        >
                          Status 11
                        </Typography>
                        <Switch
                          size="small"
                          checked={includeStatus11}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatus11Toggle();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            width: 32,
                            height: 18,
                            padding: 0,
                            ml: 0.5,
                            "& .MuiSwitch-switchBase": {
                              padding: "2px",
                              "&.Mui-checked": {
                                color: SOURCE_COLORS.status11,
                                "& + .MuiSwitch-track": {
                                  bgcolor: alpha(SOURCE_COLORS.status11, 0.5),
                                },
                              },
                            },
                            "& .MuiSwitch-thumb": {
                              width: 14,
                              height: 14,
                            },
                            "& .MuiSwitch-track": {
                              borderRadius: 9,
                            },
                          }}
                        />
                      </Box>

                      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                      {/* Manual Edits Toggle */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1.5,
                          bgcolor: showSourceBreakdown ? alpha(theme.palette.secondary.main, 0.15) : "transparent",
                          transition: "all 0.2s ease-in-out",
                          cursor: "pointer",
                          "&:hover": {
                            bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          },
                        }}
                        onClick={() => {
                          setShowSourceBreakdown(!showSourceBreakdown);
                          setChartKey((prev) => prev + 1);
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: theme.palette.secondary.main,
                            opacity: showSourceBreakdown ? 1 : 0.4,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: showSourceBreakdown ? 600 : 400,
                            color: showSourceBreakdown ? "secondary.main" : "text.secondary",
                            transition: "all 0.2s ease-in-out",
                            userSelect: "none",
                          }}
                        >
                          Breakdown
                        </Typography>
                        <Switch
                          size="small"
                          checked={showSourceBreakdown}
                          onChange={() => {
                            setShowSourceBreakdown(!showSourceBreakdown);
                            setChartKey((prev) => prev + 1);
                          }}
                          color="secondary"
                          sx={{
                            width: 32,
                            height: 18,
                            padding: 0,
                            ml: 0.5,
                            "& .MuiSwitch-switchBase": {
                              padding: "2px",
                            },
                            "& .MuiSwitch-thumb": {
                              width: 14,
                              height: 14,
                            },
                            "& .MuiSwitch-track": {
                              borderRadius: 9,
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ mb: 4 }} />

                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart
                    key={chartKey}
                    data={filteredChartData}
                    onClick={handleChartClick}
                    style={{ cursor: "pointer" }}
                    animationDuration={600}
                    animationEasing="ease-in-out"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="monthName"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    {/* Left Y-axis for monthly bookings */}
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(value) => `${Math.round(value / 1000000)} M€`}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    {/* Right Y-axis for cumulative bookings */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${Math.round(value / 1000000)} M€`}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          cumulativeData={showLost ? cumulativeLossData : cumulativeData}
                          showNetRevenue={showNetRevenue}
                          curveVisibility={curveVisibility}
                          includeStatus11={showLost ? false : includeStatus11}
                          showIOGlobal={showIO}
                          showSourceBreakdown={showSourceBreakdown}
                          yearColors={COLOR_BY_YEAR}
                        />
                      }
                    />

                    {/* Render bars - stacked by source when breakdown is active */}
                    {showSourceBreakdown && !showLost
                      ? // Stacked bars by source for each year
                        [...selectedYears]
                          .sort((a, b) => a - b)
                          .map((year) => (
                            <React.Fragment key={`bars-${year}`}>
                              <Bar
                                yAxisId="left"
                                dataKey={`${year}_src_crmOriginal`}
                                stackId={`stack-${year}`}
                                fill={COLOR_BY_YEAR[year]?.bar || "#CC2931"}
                                opacity={COLOR_BY_YEAR[year]?.opacity || 0.85}
                                name={`${year} CRM Original`}
                                animationBegin={0}
                                animationDuration={600}
                                isAnimationActive={true}
                                cursor="pointer"
                              />
                              {/* Status 11 bar - shown separately in deep red when toggle is active */}
                              {includeStatus11 && (
                                <Bar
                                  yAxisId="left"
                                  dataKey={`${year}_status11`}
                                  stackId={`stack-${year}`}
                                  fill={SOURCE_COLORS.status11}
                                  opacity={0.9}
                                  name={`${year} Status 11`}
                                  animationBegin={0}
                                  animationDuration={600}
                                  isAnimationActive={true}
                                  cursor="pointer"
                                />
                              )}
                              <Bar
                                yAxisId="left"
                                dataKey={`${year}_src_manual`}
                                stackId={`stack-${year}`}
                                fill={SOURCE_COLORS.manual}
                                opacity={0.85}
                                name={`${year} Manual Opps`}
                                animationBegin={0}
                                animationDuration={600}
                                isAnimationActive={true}
                                cursor="pointer"
                              />
                              <Bar
                                yAxisId="left"
                                dataKey={`${year}_src_crmModified`}
                                stackId={`stack-${year}`}
                                fill={SOURCE_COLORS.crmModified}
                                opacity={0.85}
                                name={`${year} CRM Modified`}
                                animationBegin={0}
                                animationDuration={600}
                                isAnimationActive={true}
                                cursor="pointer"
                              />
                            </React.Fragment>
                          ))
                      : // Normal single bar per year
                        [...selectedYears]
                          .sort((a, b) => a - b)
                          .map((year) => (
                            <Bar
                              key={`bar-${year}`}
                              yAxisId="left"
                              dataKey={!showLost && includeStatus11 ? `${year}_combined_total` : `${year}`}
                              fill={COLOR_BY_YEAR[year]?.bar || "#CC2931"}
                              opacity={COLOR_BY_YEAR[year]?.opacity || 0.7}
                              name={`${year} ${showLost ? "Lost" : "Bookings"}`}
                              animationBegin={0}
                              animationDuration={600}
                              isAnimationActive={true}
                              cursor="pointer"
                            />
                          ))}

                    {/* Render cumulative lines - CRM Original + Total when breakdown is active */}
                    {showSourceBreakdown && !showLost
                      ? // Two lines per year: CRM Original (solid) + Total (dashed)
                        [...selectedYears]
                          .sort((a, b) => a - b)
                          .map((year) => (
                            <React.Fragment key={`lines-${year}`}>
                              {/* CRM Original cumulative line (original data only, without Status 11) */}
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey={`${year}_src_crmOriginal_cumulative`}
                                stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                name={`${year} CRM Original`}
                                animationBegin={0}
                                animationDuration={600}
                                isAnimationActive={true}
                              />
                              {/* Total cumulative line (all sources combined) */}
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey={includeStatus11 ? `${year}_combined_cumulative` : `${year}_cumulative`}
                                stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ r: 2, strokeDasharray: "0" }}
                                name={`${year} Total`}
                                animationBegin={0}
                                animationDuration={600}
                                isAnimationActive={true}
                              />
                            </React.Fragment>
                          ))
                      : // Normal single cumulative line per year
                        [...selectedYears]
                          .sort((a, b) => a - b)
                          .map((year) => (
                            <Line
                              key={`line-${year}`}
                              yAxisId="right"
                              type="monotone"
                              dataKey={
                                !showLost && includeStatus11 ? `${year}_combined_cumulative` : `${year}_cumulative`
                              }
                              stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name={`${year} Cumulative`}
                              animationBegin={0}
                              animationDuration={600}
                              isAnimationActive={true}
                            />
                          ))}
                  </ComposedChart>
                </ResponsiveContainer>

                {/* PHASE 2: Use extracted MonthlyDetailsTable component */}
                <Box sx={{ mt: 1 }}>
                  <MonthlyDetailsTable
                    cumulativeData={showLost ? cumulativeLossData : cumulativeData}
                    years={showLost ? lossYears : years}
                    selectedYears={selectedYears}
                    yearColors={COLOR_BY_YEAR}
                    hasFiltersApplied={false}
                    showNetRevenue={showNetRevenue}
                    showIO={showIO}
                    theme={theme}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Bar Charts Section - Segment/Account and Service Line */}
        <Grid container spacing={3} sx={{ mt: 0, overflow: "visible" }}>
          {/* By Segment or Account */}
          <Grid item xs={12} lg={6} sx={{ overflow: "visible", minHeight: 450 }}>
            <SimpleBarChart
              data={
                showAccountMode
                  ? showLost
                    ? filteredLossesByAccount
                    : filteredBookingsByAccount
                  : showLost
                    ? filteredLossesBySegment
                    : filteredBookingsBySegment
              }
              title={
                showAccountMode
                  ? showLost
                    ? "Lost by Account"
                    : "Bookings by Account"
                  : drillDownSegment
                    ? `Sub-Segments - ${drillDownSegment}`
                    : showLost
                      ? "Lost by Segment"
                      : "Bookings by Segment"
              }
              showIO={showIO}
              onChartClick={showAccountMode ? undefined : handleSegmentChartClick}
              onBackClick={handleBackFromSegmentDrillDown}
              isDrillDown={!!drillDownSegment && !showAccountMode}
              showToggle={!drillDownSegment}
              onToggleMode={handleToggleAccountMode}
              toggleTooltip={showAccountMode ? "Afficher par Segment" : "Afficher par Account"}
            />
          </Grid>

          {/* By Service Line */}
          <Grid item xs={12} lg={6} sx={{ overflow: "visible", minHeight: 450 }}>
            <SimpleBarChart
              data={showLost ? filteredLossesByServiceLine : filteredBookingsByServiceLine}
              title={
                drillDownServiceLine
                  ? `Service Offerings - ${drillDownServiceLine}`
                  : showLost
                    ? "Lost by Service Line"
                    : "Bookings by Service Line"
              }
              showIO={showIO}
              onChartClick={handleServiceLineChartClick}
              onBackClick={handleBackFromServiceLineDrillDown}
              isDrillDown={!!drillDownServiceLine}
            />
          </Grid>
        </Grid>

        {/* Wins/Losses Analysis Section */}
        <Grid item xs={12} sx={{ mt: 3, overflow: "visible" }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
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
                  {showLost ? "Lost" : "Bookings"} of Top
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={topNAccounts}
                  onChange={(e) => setTopNAccounts(Math.max(1, parseInt(e.target.value) || 10))}
                  inputProps={{ min: 1, max: 100, style: { textAlign: "center" } }}
                  sx={{ width: 60 }}
                />
                <Typography variant="h6" fontWeight={600}>
                  Accounts
                </Typography>
              </Box>

              <Button size="small" variant="outlined" startIcon={<RestartAltIcon />} onClick={handleResetFilters}>
                Reset
              </Button>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mt: 3 }}>
              {!showLost && (
                <TopAccountsSection
                  data={insightsData.bookings}
                  topN={topNAccounts}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                />
              )}

              {showLost && (
                <TopAccountsSection
                  data={insightsData.losses}
                  topN={topNAccounts}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                />
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Opportunity List */}
        <Grid item xs={12} sx={{ mt: 3, overflow: "visible" }}>
          <OpportunityList
            data={showLost ? insightsData.losses : insightsData.bookings}
            title={showLost ? "Lost Opportunities" : "Booked Opportunities"}
            selectedOpportunities={selectedOpportunities}
            onSelectionChange={onSelection}
            showNetRevenue={showNetRevenue}
            showIO={showIO}
            isFiltered={insightsData.hasAllocation}
            setEditOpportunity={setEditOpportunity}
            onDeleteOpportunities={handleDeleteOpportunities}
            onOpportunityCreated={onOpportunityCreated}
            navigateToOpportunityId={navigateToOpportunityId}
            onManualOpportunityUpdated={onOpportunityUpdated}
            hideWinFilter
            hideStatusFilter
          />
        </Grid>
      </Box>
    </Fade>
  );
};

// PHASE 2: Wrap with React.memo for performance optimization
export default React.memo(BookingsTab);
