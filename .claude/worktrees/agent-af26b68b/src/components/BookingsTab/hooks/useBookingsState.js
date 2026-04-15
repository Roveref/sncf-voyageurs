import { useState } from "react";

/**
 * Hook for managing all BookingsTab state
 *
 * Consolidates all state declarations into a single hook for:
 * - UI state (tabs, toggles, visibility)
 * - Date range selection
 * - Filtered opportunities
 * - Chart configuration
 *
 * PERFORMANCE: Returns a clean API with state and setters
 */
export const useBookingsState = () => {
  // Date range state - default to January 1st of current year to today
  const [dateRange, setDateRange] = useState([
    new Date(new Date().getFullYear(), 0, 1), // January 1st of current year
    new Date(), // Today
  ]);

  // Filtered opportunities state
  const [filteredOpportunities, setFilteredOpportunities] = useState([]);

  // Analysis tab state (0 = Wins, 1 = Losses)
  const [analysisTab, setAnalysisTab] = useState(0);

  // Top N accounts to display
  const [topNAccounts, setTopNAccounts] = useState(10);

  // Selected years for chart display
  const [selectedYears, setSelectedYears] = useState([]);

  // Status 11 toggle
  const [includeStatus11, setIncludeStatus11] = useState(false);

  // Source breakdown toggle (CRM Original / Manual / CRM Modified)
  const [showSourceBreakdown, setShowSourceBreakdown] = useState(false);

  // Curve visibility toggles
  const [curveVisibility, setCurveVisibility] = useState({
    total: false,
    io: false,
    filtered: false,
  });

  // Chart key for forcing re-renders
  const [chartKey, setChartKey] = useState(0);

  return {
    // Date range
    dateRange,
    setDateRange,

    // Filtered opportunities
    filteredOpportunities,
    setFilteredOpportunities,

    // Analysis tab
    analysisTab,
    setAnalysisTab,

    // Top N accounts
    topNAccounts,
    setTopNAccounts,

    // Selected years
    selectedYears,
    setSelectedYears,

    // Status 11
    includeStatus11,
    setIncludeStatus11,

    // Source breakdown
    showSourceBreakdown,
    setShowSourceBreakdown,

    // Curve visibility
    curveVisibility,
    setCurveVisibility,

    // Chart key
    chartKey,
    setChartKey,
  };
};
