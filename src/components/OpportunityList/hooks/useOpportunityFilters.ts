/**
 * Custom hook for managing opportunity filters
 * Performance optimized with useMemo for filtered data
 */

import { useState, useMemo, useCallback } from "react";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { safeJsonParse } from "../../../utils/safeJson";

/**
 * Hook to manage filtering logic for opportunities
 * Provides state and handlers for win percentage and status filters
 * @param {Array} data - Array of opportunity objects
 * @returns {Object} Filter state, handlers, and filtered data
 */
export const useOpportunityFilters = (data: Record<string, any>[]): Record<string, any> => {
  const [winPercentageFilter, setWinPercentageFilter] = useState<number>(0);
  const [winPercentageMode, setWinPercentageMode] = useState<string>("greater");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showManualOnly, setShowManualOnly] = useState<boolean>(false);
  const [showWithActionsOnly, setShowWithActionsOnly] = useState<boolean>(false);
  const [showWithStaffingOnly, setShowWithStaffingOnly] = useState<boolean>(false);
  const [showWithCurrentStaffingOnly, setShowWithCurrentStaffingOnly] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>("");

  // Memoized filtered data - only recomputes when dependencies change
  const filteredData = useMemo<Record<string, any>[]>(() => {
    let result = data;

    // Filter by global text search
    if (searchText.trim()) {
      const lower = searchText.trim().toLowerCase();
      result = result.filter((item: Record<string, any>) => {
        const fields = [item.opportunity, item.account, item.opportunityId, item.jobCode, item.manager, item.partner];
        return fields.some((f) => f != null && String(f).toLowerCase().includes(lower));
      });
    }

    // Filter by manual opportunities only
    if (showManualOnly) {
      result = result.filter((item: Record<string, any>) => item.isManual === true);
    }

    // Filter by opportunities with actions
    if (showWithActionsOnly) {
      const { opportunityActions } = useUserDataStore.getState();
      result = result.filter((item: Record<string, any>) => {
        const opportunityId = item.opportunityId;
        return opportunityActions[opportunityId]?.length > 0;
      });
    }

    // Filter by opportunities with staffing needs
    if (showWithStaffingOnly) {
      const { staffingNeeds: storeNeeds } = useUserDataStore.getState();
      result = result.filter((item: Record<string, any>) => {
        const opportunityId = item.opportunityId;
        return storeNeeds[opportunityId]?.length > 0;
      });
    }

    // Filter by opportunities with current staffing (employees assigned via staffing data)
    if (showWithCurrentStaffingOnly) {
      const index: Record<string, any> = safeJsonParse(localStorage.getItem("staffing_employee_index") || "{}", {});
      const staffedJobCodes = new Set(Object.keys(index));
      result = result.filter((item: Record<string, any>) => {
        const jc = item.jobCode;
        return jc && staffedJobCodes.has(String(jc).trim());
      });
    }

    // Filter by status
    if (statusFilter.length > 0) {
      const statusNumbers = statusFilter.map((s: string) => parseInt(s));
      result = result.filter((item: Record<string, any>) => statusNumbers.includes(item.status));
    }

    // Filter by win percentage
    if (winPercentageFilter > 0) {
      result = result.filter((item: Record<string, any>) => {
        const winPercentage = item.winPct || 0;

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
    showWithCurrentStaffingOnly,
    searchText,
  ]);

  // Handlers
  const handleWinPercentageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseFloat(event.target.value) || 0;
    setWinPercentageFilter(value);
  }, []);

  const handleWinPercentageModeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
    setWinPercentageMode(event.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((event: { target: { value: string[] } }): void => {
    setStatusFilter(event.target.value);
  }, []);

  const handleToggleManualOnly = useCallback((): void => {
    setShowManualOnly((prev: boolean) => !prev);
  }, []);

  const handleToggleWithActionsOnly = useCallback((): void => {
    setShowWithActionsOnly((prev: boolean) => !prev);
  }, []);

  const handleToggleWithStaffingOnly = useCallback((): void => {
    setShowWithStaffingOnly((prev: boolean) => !prev);
  }, []);

  const handleToggleWithCurrentStaffingOnly = useCallback((): void => {
    setShowWithCurrentStaffingOnly((prev: boolean) => !prev);
  }, []);

  const resetWinPercentageFilter = useCallback((): void => {
    setWinPercentageFilter(0);
    setWinPercentageMode("greater");
  }, []);

  const resetStatusFilter = useCallback((): void => {
    setStatusFilter([]);
  }, []);

  const resetManualFilter = useCallback((): void => {
    setShowManualOnly(false);
  }, []);

  const resetActionsFilter = useCallback((): void => {
    setShowWithActionsOnly(false);
  }, []);

  const resetStaffingFilter = useCallback((): void => {
    setShowWithStaffingOnly(false);
  }, []);

  const resetCurrentStaffingFilter = useCallback((): void => {
    setShowWithCurrentStaffingOnly(false);
  }, []);

  const handleSearchTextChange = useCallback((value: string): void => {
    setSearchText(value);
  }, []);

  const resetAllFilters = useCallback(
    (resetFilterCallback?: () => void): void => {
      resetWinPercentageFilter();
      resetStatusFilter();
      resetManualFilter();
      resetActionsFilter();
      resetStaffingFilter();
      resetCurrentStaffingFilter();
      setSearchText("");
      if (resetFilterCallback) {
        resetFilterCallback();
      }
    },
    [
      resetWinPercentageFilter,
      resetStatusFilter,
      resetManualFilter,
      resetActionsFilter,
      resetStaffingFilter,
      resetCurrentStaffingFilter,
    ]
  );

  const hasActiveFilters: boolean =
    winPercentageFilter > 0 ||
    statusFilter.length > 0 ||
    showManualOnly ||
    showWithActionsOnly ||
    showWithStaffingOnly ||
    showWithCurrentStaffingOnly ||
    searchText.trim().length > 0;

  return {
    // State
    winPercentageFilter,
    winPercentageMode,
    statusFilter,
    showManualOnly,
    showWithActionsOnly,
    showWithStaffingOnly,
    showWithCurrentStaffingOnly,
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
    handleToggleWithCurrentStaffingOnly,
    handleSearchTextChange,
    resetWinPercentageFilter,
    resetStatusFilter,
    resetManualFilter,
    resetActionsFilter,
    resetStaffingFilter,
    resetCurrentStaffingFilter,
    resetAllFilters,
  };
};
