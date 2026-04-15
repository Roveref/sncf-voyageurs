import { useState } from "react";

interface CurveVisibility {
  total: boolean;
  io: boolean;
  filtered: boolean;
}

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
export const useBookingsState = (_sinceYear?: number | null): Record<string, any> => {
  // Date range state - default to January 1st of current year to today
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(new Date().getFullYear(), 0, 1), // January 1st of current year
    new Date(), // Today
  ]);

  // Filtered opportunities state
  const [filteredOpportunities, setFilteredOpportunities] = useState<Record<string, any>[]>([]);

  // Analysis tab state (0 = Wins, 1 = Losses)
  const [analysisTab, setAnalysisTab] = useState<number>(0);

  // Top N accounts to display
  const [topNAccounts, setTopNAccounts] = useState<number>(10);

  // Selected years for chart display
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  // Status 11 toggle
  const [includeStatus11, setIncludeStatus11] = useState<boolean>(false);

  // Source breakdown toggle (CRM Original / Manual / CRM Modified)
  const [showSourceBreakdown, setShowSourceBreakdown] = useState<boolean>(false);

  // Curve visibility toggles
  const [curveVisibility, setCurveVisibility] = useState<CurveVisibility>({
    total: false,
    io: false,
    filtered: false,
  });

  // Chart key for forcing re-renders
  const [chartKey, setChartKey] = useState<number>(0);

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
