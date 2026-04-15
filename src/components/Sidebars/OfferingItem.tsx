import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import { alpha, darken } from "@mui/material/styles";
import { isIncluded, isExcluded, removeValue, includeValue, excludeValue } from "../../utils/filterHelpers";
import type { Filters } from "../../utils/filterHelpers";
import type { Theme } from "@mui/material/styles";

interface OfferingItemProps {
  offeringCompositeKey: string;
  line: string;
  theme: Theme;
  filters: Filters;
  isLineDirectlyIncluded: boolean;
  isLineExcluded: boolean;
  isLineTeamMode: boolean;
  isLineBothMode: boolean;
  lineOfferings: string[];
  handleFilterChange: (filters: Filters) => void;
  setFilters: (updater: (prev: Filters) => Filters) => void;
}

const OfferingItem = memo(
  ({
    offeringCompositeKey,
    line,
    theme,
    filters,
    isLineDirectlyIncluded,
    isLineExcluded,
    isLineTeamMode,
    isLineBothMode,
    lineOfferings,
    handleFilterChange,
    setFilters,
  }: OfferingItemProps) => {
    // Extract offering name from composite key "ServiceLine::Offering"
    const [, offeringName] = offeringCompositeKey.split("::");

    // Check three filter states (no cascade for inclusion display)
    const isOfferingDirectlyIncluded = isIncluded(filters.serviceOfferings, offeringCompositeKey);
    const isOfferingDirectlyExcluded = isExcluded(filters.serviceOfferings, offeringCompositeKey);

    // Only show as selected if directly included (not via parent cascade)
    const isOfferingIncluded = isOfferingDirectlyIncluded;
    // Cascade exclusion only (for graying out)
    const isOfferingExcluded = isOfferingDirectlyExcluded || isLineExcluded;

    // Handler for clicking on the label (include/uninclude)
    const handleClickOffering = useCallback(() => {
      // Don't allow clicking if offering is excluded
      if (isOfferingExcluded) return;

      if (isOfferingIncluded) {
        // Remove offering from included
        const updatedFilters = { ...filters };
        const newOfferingsValue = removeValue(filters.serviceOfferings, offeringCompositeKey);
        updatedFilters.serviceOfferings = newOfferingsValue;

        // Also remove parent service line if it's explicitly selected
        if (isLineDirectlyIncluded) {
          const newServiceLineValue = removeValue(filters.serviceLine1, line);
          updatedFilters.serviceLine1 = newServiceLineValue;
        }

        handleFilterChange(updatedFilters);
      } else {
        // Add offering to included
        const newValue = includeValue(filters.serviceOfferings, offeringCompositeKey);
        handleFilterChange({
          ...filters,
          serviceOfferings: newValue,
        });
      }
    }, [
      isOfferingExcluded,
      isOfferingIncluded,
      filters,
      offeringCompositeKey,
      isLineDirectlyIncluded,
      line,
      handleFilterChange,
    ]);

    // Handler for - button (exclude/unexclude)
    const handleExcludeOffering = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOfferingDirectlyExcluded) {
          const newValue = removeValue(filters.serviceOfferings, offeringCompositeKey);
          setFilters((prev: Filters) => ({
            ...prev,
            serviceOfferings: newValue,
          }));
        } else {
          const newValue = excludeValue(filters.serviceOfferings, offeringCompositeKey);
          setFilters((prev: Filters) => ({
            ...prev,
            serviceOfferings: newValue,
          }));
        }
      },
      [isOfferingDirectlyExcluded, filters.serviceOfferings, offeringCompositeKey, setFilters]
    );

    return (
      <Box
        draggable={!isOfferingExcluded}
        onDragStart={(e) => {
          e.dataTransfer.setData("serviceOffering", offeringCompositeKey);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={handleClickOffering}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 1.5,
          px: 1.5,
          py: 0.5,
          fontSize: "0.75rem",
          cursor: isOfferingExcluded ? "not-allowed" : "grab",
          backgroundColor: isOfferingExcluded
            ? alpha("#999", 0.2)
            : isLineBothMode && isOfferingIncluded
              ? "#FF6B73"
              : isLineTeamMode && isOfferingIncluded
                ? "transparent"
                : isOfferingIncluded
                  ? "#FF6B73"
                  : theme.palette.grey[200],
          color: isOfferingExcluded
            ? "#999"
            : isLineTeamMode && isOfferingIncluded
              ? "#E63946"
              : isOfferingIncluded
                ? "white"
                : theme.palette.text.primary,
          border:
            !isOfferingExcluded && isOfferingIncluded && (isLineTeamMode || isLineBothMode)
              ? "2px solid #E63946"
              : "2px solid transparent",
          boxShadow: !isOfferingExcluded && isOfferingIncluded && isLineBothMode ? "inset 0 0 0 2px white" : "none",
          fontWeight: isOfferingIncluded ? 600 : 500,
          opacity: isOfferingExcluded ? 0.5 : 1,
          "&:hover": {
            backgroundColor: isOfferingExcluded
              ? alpha("#999", 0.2)
              : isLineTeamMode && isOfferingIncluded
                ? alpha("#E63946", 0.08)
                : isOfferingIncluded
                  ? darken("#FF6B73", 0.1)
                  : theme.palette.grey[300],
          },
          "&:active": {
            cursor: "grabbing",
          },
        }}
      >
        <Box
          sx={{
            flex: 1,
            wordWrap: "break-word",
            whiteSpace: "normal",
          }}
        >
          {offeringName || offeringCompositeKey}
        </Box>
      </Box>
    );
  }
);

OfferingItem.displayName = "OfferingItem";

export default OfferingItem;
