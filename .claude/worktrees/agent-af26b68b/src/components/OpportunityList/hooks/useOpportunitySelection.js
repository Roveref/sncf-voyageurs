/**
 * Custom hook for managing opportunity selection
 * Performance optimized with useMemo and useCallback
 */

import { useMemo, useCallback } from "react";

/**
 * Hook to manage selection logic for opportunities
 * Provides memoized selection set and handlers for row clicks
 * @param {Array} selectedOpportunities - Currently selected opportunities
 * @param {Function} onSelectionChange - Callback when selection changes
 * @returns {Object} Selection helpers and handlers
 */
export const useOpportunitySelection = (selectedOpportunities, onSelectionChange) => {
  // Memoized set of selected opportunity IDs for O(1) lookup
  const selectedIds = useMemo(() => {
    return new Set(selectedOpportunities.map((opp) => opp["Opportunity ID"]));
  }, [selectedOpportunities]);

  // Memoized row click handler
  const handleRowClick = useCallback(
    (row) => {
      const opportunityId = row["Opportunity ID"];
      let newSelection;

      if (selectedIds.has(opportunityId)) {
        // If already selected, remove it
        newSelection = selectedOpportunities.filter((opp) => opp["Opportunity ID"] !== opportunityId);
      } else {
        // If not selected, add it
        newSelection = [...selectedOpportunities, row];
      }

      onSelectionChange(newSelection);
    },
    [selectedIds, selectedOpportunities, onSelectionChange]
  );

  // Memoized selection check
  const isSelected = useCallback(
    (row) => {
      return selectedIds.has(row["Opportunity ID"]);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    handleRowClick,
    isSelected,
  };
};
