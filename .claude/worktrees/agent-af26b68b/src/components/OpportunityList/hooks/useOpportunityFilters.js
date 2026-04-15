/**
 * Custom hook for managing opportunity filters
 * Performance optimized with useMemo for filtered data
 */

import { useState, useMemo, useCallback } from "react";

/**
 * Hook to manage filtering logic for opportunities
 * Provides state and handlers for win percentage and status filters
 * @param {Array} data - Array of opportunity objects
 * @returns {Object} Filter state, handlers, and filtered data
 */
export const useOpportunityFilters = (data) => {
  const [winPercentageFilter, setWinPercentageFilter] = useState(0);
  const [winPercentageMode, setWinPercentageMode] = useState("greater");
  const [statusFilter, setStatusFilter] = useState([]);
  const [showManualOnly, setShowManualOnly] = useState(false);
  const [showWithActionsOnly, setShowWithActionsOnly] = useState(false);
  const [showWithStaffingOnly, setShowWithStaffingOnly] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Memoized filtered data - only recomputes when dependencies change
  const filteredData = useMemo(() => {
    let result = data;

    // Filter by global text search
    if (searchText.trim()) {
      const lower = searchText.trim().toLowerCase();
      result = result.filter((item) => {
        const fields = [
          item["Opportunity"],
          item["Account"],
          item["Opportunity ID"],
          item["Job Code"],
          item["Manager"],
          item["Partner"],
        ];
        return fields.some((f) => f != null && String(f).toLowerCase().includes(lower));
      });
    }

    // Filter by manual opportunities only
    if (showManualOnly) {
      result = result.filter((item) => item.isManual === true);
    }

    // Filter by opportunities with actions or comments
    if (showWithActionsOnly) {
      result = result.filter((item) => {
        const oppId = item["Opportunity ID"];
        try {
          const actions = JSON.parse(localStorage.getItem(`opportunity_actions_${oppId}`) || "[]");
          const comments = JSON.parse(localStorage.getItem(`opportunity_comments_${oppId}`) || "[]");
          return actions.length > 0 || comments.length > 0;
        } catch {
          return false;
        }
      });
    }

    // Filter by opportunities with staffing needs
    if (showWithStaffingOnly) {
      result = result.filter((item) => {
        const oppId = item["Opportunity ID"];
        try {
          const needs = JSON.parse(localStorage.getItem(`staffing_needs_${oppId}`) || "[]");
          return needs.length > 0;
        } catch {
          return false;
        }
      });
    }

    // Filter by status
    if (statusFilter.length > 0) {
      const statusNumbers = statusFilter.map((s) => parseInt(s));
      result = result.filter((item) => statusNumbers.includes(item["Status"]));
    }

    // Filter by win percentage
    if (winPercentageFilter > 0) {
      result = result.filter((item) => {
        const winPercentage = item["Win %"] || 0;

        switch (winPercentageMode) {
          case "greater":
            return winPercentage >= winPercentageFilter;
          case "less":
            return winPercentage <= winPercentageFilter;
          case "equal":
            return Math.abs(winPercentage - winPercentageFilter) < 0.1;
          default:
            return true;
        }
      });
    }

    return result;
  }, [
    data,
    statusFilter,
    winPercentageFilter,
    winPercentageMode,
    showManualOnly,
    showWithActionsOnly,
    showWithStaffingOnly,
    searchText,
  ]);

  // Handlers
  const handleWinPercentageChange = useCallback((event) => {
    const value = parseFloat(event.target.value) || 0;
    setWinPercentageFilter(value);
  }, []);

  const handleWinPercentageModeChange = useCallback((event) => {
    setWinPercentageMode(event.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((event) => {
    setStatusFilter(event.target.value);
  }, []);

  const handleToggleManualOnly = useCallback(() => {
    setShowManualOnly((prev) => !prev);
  }, []);

  const handleToggleWithActionsOnly = useCallback(() => {
    setShowWithActionsOnly((prev) => !prev);
  }, []);

  const handleToggleWithStaffingOnly = useCallback(() => {
    setShowWithStaffingOnly((prev) => !prev);
  }, []);

  const resetWinPercentageFilter = useCallback(() => {
    setWinPercentageFilter(0);
    setWinPercentageMode("greater");
  }, []);

  const resetStatusFilter = useCallback(() => {
    setStatusFilter([]);
  }, []);

  const resetManualFilter = useCallback(() => {
    setShowManualOnly(false);
  }, []);

  const resetActionsFilter = useCallback(() => {
    setShowWithActionsOnly(false);
  }, []);

  const resetStaffingFilter = useCallback(() => {
    setShowWithStaffingOnly(false);
  }, []);

  const handleSearchTextChange = useCallback((value) => {
    setSearchText(value);
  }, []);

  const resetAllFilters = useCallback(
    (resetFilterCallback) => {
      resetWinPercentageFilter();
      resetStatusFilter();
      resetManualFilter();
      resetActionsFilter();
      resetStaffingFilter();
      setSearchText("");
      if (resetFilterCallback) {
        resetFilterCallback();
      }
    },
    [resetWinPercentageFilter, resetStatusFilter, resetManualFilter, resetActionsFilter, resetStaffingFilter]
  );

  const hasActiveFilters =
    winPercentageFilter > 0 ||
    statusFilter.length > 0 ||
    showManualOnly ||
    showWithActionsOnly ||
    showWithStaffingOnly ||
    searchText.trim().length > 0;

  return {
    // State
    winPercentageFilter,
    winPercentageMode,
    statusFilter,
    showManualOnly,
    showWithActionsOnly,
    showWithStaffingOnly,
    searchText,
    filteredData,
    hasActiveFilters,

    // Handlers
    handleWinPercentageChange,
    handleWinPercentageModeChange,
    handleStatusFilterChange,
    handleToggleManualOnly,
    handleToggleWithActionsOnly,
    handleToggleWithStaffingOnly,
    handleSearchTextChange,
    resetWinPercentageFilter,
    resetStatusFilter,
    resetManualFilter,
    resetActionsFilter,
    resetStaffingFilter,
    resetAllFilters,
  };
};
