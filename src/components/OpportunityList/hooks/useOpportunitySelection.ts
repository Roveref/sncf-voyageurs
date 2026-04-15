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
export const useOpportunitySelection = (
  selectedOpportunities: Record<string, any>[],
  onSelectionChange: (selection: Record<string, any>[]) => void
): {
  selectedIds: Set<string>;
  handleRowClick: (row: Record<string, any>) => void;
  isSelected: (row: Record<string, any>) => boolean;
} => {
  // Memoized set of selected opportunity IDs for O(1) lookup
  const selectedIds = useMemo<Set<string>>(() => {
    return new Set(selectedOpportunities.map((opp: Record<string, any>) => opp.opportunityId));
  }, [selectedOpportunities]);

  // Memoized row click handler
  const handleRowClick = useCallback(
    (row: Record<string, any>): void => {
      const opportunityId = row.opportunityId;
      let newSelection: Record<string, any>[];

      if (selectedIds.has(opportunityId)) {
        // If already selected, remove it
        newSelection = selectedOpportunities.filter((opp: Record<string, any>) => opp.opportunityId !== opportunityId);
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
    (row: Record<string, any>): boolean => {
      return selectedIds.has(row.opportunityId);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    handleRowClick,
    isSelected,
  };
};
