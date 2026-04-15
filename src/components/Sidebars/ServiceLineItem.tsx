import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { alpha, darken } from "@mui/material/styles";
import {
  normalizeFilterValue,
  isIncluded,
  isExcluded,
  removeValue,
  includeValue,
  excludeValue,
} from "../../utils/filterHelpers";
import type { Filters, FilterValue } from "../../utils/filterHelpers";
import type { Theme } from "@mui/material/styles";
import OfferingItem from "./OfferingItem";

interface ServiceLineItemProps {
  line: string;
  theme: Theme;
  filters: Filters;
  expandedServiceLines: Record<string, boolean>;
  serviceToOfferingMap: Record<string, string[]>;
  handleFilterChange: (filters: Filters) => void;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  setExpandedServiceLines: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  serviceLineModes: Map<string, string>;
  onServiceLineModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  excludedServiceLines: string[];
  isDraggingRef: React.MutableRefObject<boolean>;
}

const ServiceLineItem = memo(
  ({
    line,
    theme,
    filters,
    expandedServiceLines,
    serviceToOfferingMap,
    handleFilterChange,
    setFilters,
    setExpandedServiceLines,
    serviceLineModes,
    onServiceLineModesChange,
    excludedServiceLines,
    isDraggingRef,
  }: ServiceLineItemProps) => {
    // Check filter states
    const isLineDirectlyIncluded = isIncluded(filters.serviceLine1, line);
    const isLineExcluded = isExcluded(filters.serviceLine1, line);
    const lineOfferings = serviceToOfferingMap[line] || [];
    const hasOfferings = lineOfferings.length > 0;
    const isLineExpanded = expandedServiceLines[line] || false;

    // Count how many service offerings for this line are selected
    const selectedOfferingsIncluded = normalizeFilterValue(filters.serviceOfferings).included;
    const selectedOfferingsCount = lineOfferings.filter((offering: string) =>
      selectedOfferingsIncluded.includes(offering)
    ).length;
    const allOfferingsSelected = lineOfferings.length > 0 && selectedOfferingsCount === lineOfferings.length;

    // Show line as selected if either directly included OR all its offerings are selected
    const isLineIncluded = isLineDirectlyIncluded || allOfferingsSelected;

    // Mode detection for this line
    const lineMode = serviceLineModes.get(line);
    const isLineTeamMode = lineMode === "team";
    const isLineBothMode = lineMode === "both";

    // Toggle include/uninclude helper (adds or removes from included + offerings)
    const toggleLineInclude = useCallback(() => {
      if (isLineDirectlyIncluded) {
        const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
        const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);
        const newServiceLineIncluded = normalizedServiceLine.included.filter((l: string) => l !== line);
        const remainingSelectedLines = newServiceLineIncluded;
        const newOfferingsIncluded = normalizedOfferings.included.filter((offering: string) => {
          if (!lineOfferings.includes(offering)) return true;
          return remainingSelectedLines.some((otherLine: string) => {
            const otherLineOfferings = serviceToOfferingMap[otherLine] || [];
            return otherLineOfferings.includes(offering);
          });
        });
        handleFilterChange({
          ...filters,
          serviceLine1: {
            included: newServiceLineIncluded,
            excluded: normalizedServiceLine.excluded,
          },
          serviceOfferings: {
            included: newOfferingsIncluded,
            excluded: normalizedOfferings.excluded,
          },
        });
      } else if (allOfferingsSelected) {
        const newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);
        lineOfferings.forEach((offering: string) => {
          const idx = newOfferingsValue.included.indexOf(offering);
          if (idx !== -1) newOfferingsValue.included.splice(idx, 1);
        });
        handleFilterChange({
          ...filters,
          serviceOfferings: newOfferingsValue,
        });
      } else {
        const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
        const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);
        const newServiceLineIncluded = [...new Set([...normalizedServiceLine.included, line])];
        const newOfferingsIncluded = [...new Set([...normalizedOfferings.included, ...lineOfferings])];
        handleFilterChange({
          ...filters,
          serviceLine1: {
            included: newServiceLineIncluded,
            excluded: normalizedServiceLine.excluded,
          },
          serviceOfferings: {
            included: newOfferingsIncluded,
            excluded: normalizedOfferings.excluded,
          },
        });
      }
    }, [
      isLineDirectlyIncluded,
      allOfferingsSelected,
      filters,
      line,
      lineOfferings,
      serviceToOfferingMap,
      handleFilterChange,
    ]);

    // 4-state left-click handler
    const handleClickLine = useCallback(() => {
      if (isLineExcluded) return;
      if (!isLineIncluded) {
        // Off -> Opp
        toggleLineInclude();
      } else if (isLineTeamMode) {
        // Team -> Both
        onServiceLineModesChange?.((prev: Map<string, string>) => {
          const next = new Map(prev);
          next.set(line, "both");
          return next;
        });
      } else if (isLineBothMode) {
        // Both -> Opp
        onServiceLineModesChange?.((prev: Map<string, string>) => {
          const next = new Map(prev);
          next.delete(line);
          return next;
        });
      } else {
        // Opp -> Off
        toggleLineInclude();
        onServiceLineModesChange?.((prev: Map<string, string>) => {
          const next = new Map(prev);
          next.delete(line);
          return next;
        });
      }
    }, [
      isLineExcluded,
      isLineIncluded,
      isLineTeamMode,
      isLineBothMode,
      toggleLineInclude,
      onServiceLineModesChange,
      line,
    ]);

    // 4-state right-click handler
    const handleLineRightClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        if (isLineExcluded) return;
        if (!isLineIncluded) {
          // Off -> Team
          toggleLineInclude();
          onServiceLineModesChange?.((prev: Map<string, string>) => {
            const next = new Map(prev);
            next.set(line, "team");
            return next;
          });
        } else if (isLineTeamMode) {
          // Team -> Off
          onServiceLineModesChange?.((prev: Map<string, string>) => {
            const next = new Map(prev);
            next.delete(line);
            return next;
          });
          toggleLineInclude();
        } else if (isLineBothMode) {
          // Both -> Team
          onServiceLineModesChange?.((prev: Map<string, string>) => {
            const next = new Map(prev);
            next.set(line, "team");
            return next;
          });
        } else {
          // Opp -> Both
          onServiceLineModesChange?.((prev: Map<string, string>) => {
            const next = new Map(prev);
            next.set(line, "both");
            return next;
          });
        }
      },
      [
        isLineExcluded,
        isLineIncluded,
        isLineTeamMode,
        isLineBothMode,
        toggleLineInclude,
        onServiceLineModesChange,
        line,
      ]
    );

    // Handler for - button (exclude/unexclude)
    const handleExcludeLine = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLineExcluded) {
          const newValue = removeValue(filters.serviceLine1, line);
          setFilters((prev: Filters) => ({
            ...prev,
            serviceLine1: newValue,
          }));
        } else {
          const newValue = excludeValue(filters.serviceLine1, line);
          setFilters((prev: Filters) => ({
            ...prev,
            serviceLine1: newValue,
          }));
        }
      },
      [isLineExcluded, filters.serviceLine1, line, setFilters]
    );

    return (
      <Box key={line}>
        <Box
          draggable={!isLineExcluded}
          onDragStart={(e) => {
            isDraggingRef.current = true;
            e.dataTransfer.setData("serviceLine", line);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setTimeout(() => {
              isDraggingRef.current = false;
            }, 50);
          }}
          onClick={() => {
            if (!isDraggingRef.current) handleClickLine();
          }}
          onMouseDown={handleLineRightClick}
          onContextMenu={(e) => e.preventDefault()}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 2,
            px: 2,
            py: 0.75,
            fontSize: "0.85rem",
            cursor: isLineExcluded ? "not-allowed" : "grab",
            backgroundColor: isLineExcluded
              ? alpha("#999", 0.2)
              : isLineBothMode
                ? "#E63946"
                : isLineTeamMode
                  ? "transparent"
                  : isLineIncluded
                    ? "#E63946"
                    : theme.palette.grey[200],
            color: isLineExcluded
              ? "#999"
              : isLineTeamMode
                ? "#E63946"
                : isLineIncluded
                  ? "white"
                  : theme.palette.text.primary,
            border:
              !isLineExcluded && (isLineTeamMode || isLineBothMode) ? "2px solid #E63946" : "2px solid transparent",
            boxShadow: !isLineExcluded && isLineBothMode ? "inset 0 0 0 2px white" : "none",
            fontWeight: isLineIncluded ? 600 : 500,
            opacity: isLineExcluded ? 0.5 : 1,
            "&:hover": {
              backgroundColor: isLineExcluded
                ? alpha("#999", 0.2)
                : isLineTeamMode
                  ? alpha("#E63946", 0.08)
                  : isLineIncluded
                    ? darken("#E63946", 0.1)
                    : theme.palette.grey[300],
            },
            "&:active": {
              cursor: "grabbing",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flex: 1,
            }}
          >
            <Box
              sx={{
                wordWrap: "break-word",
                whiteSpace: "normal",
                flex: 1,
              }}
            >
              {line}
            </Box>
            {selectedOfferingsCount > 0 && !allOfferingsSelected && (
              <Chip
                label={selectedOfferingsCount}
                size="small"
                sx={{
                  height: 18,
                  minWidth: 18,
                  fontSize: "0.7rem",
                  backgroundColor: isLineIncluded ? "white" : "#E63946",
                  color: isLineIncluded ? "#E63946" : "white",
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            {/* Expand button for service offerings */}
            {hasOfferings && (
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedServiceLines((prev: Record<string, boolean>) => ({
                    ...prev,
                    [line]: !prev[line],
                  }));
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 0.25,
                  borderRadius: 1,
                  cursor: "pointer",
                  ml: 0.5,
                  flexShrink: 0,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.text.primary, 0.1),
                  },
                }}
              >
                {isLineExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </Box>
            )}
          </Box>
        </Box>
        {/* Service Offerings dropdown - using lighter shades of service line color */}
        {hasOfferings && (
          <Collapse in={isLineExpanded} timeout="auto">
            <Box
              sx={{
                pl: 2,
                pt: 0.5,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              {lineOfferings
                .sort((a, b) => a.localeCompare(b))
                .map((offeringCompositeKey) => (
                  <OfferingItem
                    key={offeringCompositeKey}
                    offeringCompositeKey={offeringCompositeKey}
                    line={line}
                    theme={theme}
                    filters={filters}
                    isLineDirectlyIncluded={isLineDirectlyIncluded}
                    isLineExcluded={isLineExcluded}
                    isLineTeamMode={isLineTeamMode}
                    isLineBothMode={isLineBothMode}
                    lineOfferings={lineOfferings}
                    handleFilterChange={handleFilterChange}
                    setFilters={setFilters}
                  />
                ))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  }
);

ServiceLineItem.displayName = "ServiceLineItem";

export default ServiceLineItem;
