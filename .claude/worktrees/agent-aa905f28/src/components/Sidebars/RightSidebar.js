import React, { useState, useEffect } from "react";
import { Box, Typography, Divider, Button, Chip, Collapse, ToggleButton, IconButton } from "@mui/material";
import { alpha, darken, lighten } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { keyframes, easing, timing, staggerChildren } from "../../styles/animations";
import {
  getIncludedValues,
  normalizeFilterValue,
  isIncluded,
  isExcluded,
  includeValue,
  excludeValue,
  removeValue,
} from "../../utils/filterHelpers";

/**
 * RightSidebar Component
 *
 * Displays the Unit filter panel with expandable service line groups and service offerings.
 * Shows hierarchical filtering structure: Unit Groups > Service Lines > Service Offerings
 *
 * Performance optimizations:
 * - Memoized with React.memo() to prevent unnecessary re-renders
 * - Only re-renders when filter state or data dependencies change
 * - Uses efficient click handlers with stopPropagation for nested elements
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.theme - MUI theme object for consistent styling
 * @param {Object} props.filters - Current filter state containing serviceLine1 and serviceOfferings arrays
 * @param {Object} props.filterOptions - Available filter options (serviceLine1 array)
 * @param {Object} props.expandedGroups - State tracking which unit groups are expanded
 * @param {Object} props.expandedServiceLines - State tracking which service lines are expanded
 * @param {Object} props.serviceToOfferingMap - Mapping of service lines to their offerings
 * @param {Object} props.SERVICE_LINE_GROUPS - Configuration object for unit group definitions
 * @param {Function} props.handleClearFilterType - Callback to clear all filters of a specific type
 * @param {Function} props.handleToggleFilter - Callback to toggle individual filter values
 * @param {Function} props.handleFilterChange - Callback to change filters with synchronization
 * @param {Function} props.setFilters - State setter for filters (used only for exclusion zone)
 * @param {Function} props.setExpandedGroups - State setter for expanded groups
 * @param {Function} props.setExpandedServiceLines - State setter for expanded service lines
 */
const RightSidebar = ({
  theme,
  filters,
  filterOptions,
  expandedGroups,
  expandedServiceLines,
  serviceToOfferingMap,
  segmentToSubSegmentMap,
  SERVICE_LINE_GROUPS,
  handleClearFilterType,
  handleToggleFilter,
  handleFilterChange,
  setFilters,
  setExpandedGroups,
  setExpandedServiceLines,
}) => {
  const [mounted, setMounted] = useState(false);
  const [dragOverExcludeZone, setDragOverExcludeZone] = useState(false);

  // Sidebar entrance animation on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handler to expand one level (groups → service lines → offerings)
  const handleExpandLevel = () => {
    const groupKeys = Object.keys(SERVICE_LINE_GROUPS);
    const allServiceLines = filterOptions.serviceLine1 || [];

    // Check if all groups are collapsed
    const allGroupsCollapsed = groupKeys.every((key) => !expandedGroups[key]);

    if (allGroupsCollapsed) {
      // Level 0 → Level 1: Open all groups
      const newExpandedGroups = {};
      groupKeys.forEach((key) => {
        newExpandedGroups[key] = true;
      });
      setExpandedGroups(newExpandedGroups);
    } else {
      // Level 1 → Level 2: Open all service lines
      const newExpandedServiceLines = {};
      allServiceLines.forEach((line) => {
        newExpandedServiceLines[line] = true;
      });
      setExpandedServiceLines(newExpandedServiceLines);
    }
  };

  // Handler to collapse one level (offerings → service lines → groups)
  const handleCollapseLevel = () => {
    const groupKeys = Object.keys(SERVICE_LINE_GROUPS);
    const allServiceLines = filterOptions.serviceLine1 || [];

    // Check if any service lines are expanded
    const anyServiceLineExpanded = Object.values(expandedServiceLines).some((expanded) => expanded);

    if (anyServiceLineExpanded) {
      // Level 2 → Level 1: Close all service lines
      setExpandedServiceLines({});
    } else {
      // Level 1 → Level 0: Close all groups
      setExpandedGroups({});
    }
  };

  // Get excluded items for the exclusion zone
  const excludedServiceLines = normalizeFilterValue(filters.serviceLine1).excluded || [];
  const excludedServiceOfferingsAll = normalizeFilterValue(filters.serviceOfferings).excluded || [];
  const excludedAccounts = normalizeFilterValue(filters.accounts).excluded || [];
  const excludedTechnologyPartners = normalizeFilterValue(filters.technologyPartners).excluded || [];
  const excludedPeople = normalizeFilterValue(filters.people).excluded || [];
  const excludedSegmentCodesAll = normalizeFilterValue(filters.subSegmentCodes).excluded || [];
  const excludedSubSegmentsAll = normalizeFilterValue(filters.subSegments).excluded || [];

  // Filter out children whose parent is already excluded (to avoid redundant display)
  const excludedServiceOfferings = excludedServiceOfferingsAll.filter((offering) => {
    // Extract service line from composite key
    const [serviceLine] = offering.split("::");
    // Only show offering if its parent service line is NOT excluded
    return !excludedServiceLines.includes(serviceLine);
  });

  const excludedSubSegments = excludedSubSegmentsAll.filter((subSegment) => {
    // Find parent segment code for this sub-segment
    const parentCode = Object.keys(segmentToSubSegmentMap).find((code) =>
      segmentToSubSegmentMap[code]?.includes(subSegment)
    );
    // Only show sub-segment if its parent segment code is NOT excluded
    return !parentCode || !excludedSegmentCodesAll.includes(parentCode);
  });

  // Use the full list for segment codes (no filtering needed for top-level items)
  const excludedSegmentCodes = excludedSegmentCodesAll;

  // Calculate which groups are fully excluded
  const excludedGroups = [];
  const individualExcludedLines = [];

  Object.entries(SERVICE_LINE_GROUPS).forEach(([groupKey, groupConfig]) => {
    const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line) => {
      const lineLower = line.toLowerCase();
      if (groupConfig.include) {
        return groupConfig.include.some((inc) => lineLower.includes(inc.toLowerCase()));
      } else if (groupConfig.exclude) {
        return !groupConfig.exclude.some((exc) => lineLower.includes(exc.toLowerCase()));
      }
      return false;
    });

    // Check if ALL service lines in this group are excluded
    const allExcluded =
      groupServiceLines.length > 0 && groupServiceLines.every((line) => excludedServiceLines.includes(line));

    if (allExcluded) {
      excludedGroups.push({ key: groupKey, name: groupConfig.name, lines: groupServiceLines });
    }
  });

  // Get individual excluded lines (not part of a fully excluded group)
  const groupExcludedLines = excludedGroups.flatMap((g) => g.lines);
  excludedServiceLines.forEach((line) => {
    if (!groupExcludedLines.includes(line)) {
      individualExcludedLines.push(line);
    }
  });

  return (
    <Box
      sx={{
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // Sidebar entrance from right
        ...keyframes.fadeInRight,
        animation: mounted ? `fadeInRight 0.5s ${easing.elegant} forwards` : "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          minHeight: 40,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" fontWeight={600} color={theme.palette.secondary.dark}>
            Unit
          </Typography>

          {/* Expand/Collapse level buttons */}
          <Box sx={{ display: "flex", gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={handleCollapseLevel}
              sx={{
                color: theme.palette.secondary.main,
                p: 0.5,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                },
              }}
              title="Collapse one level"
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleExpandLevel}
              sx={{
                color: theme.palette.secondary.main,
                p: 0.5,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                },
              }}
              title="Expand one level"
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {(getIncludedValues(filters.serviceLine1).length > 0 ||
          getIncludedValues(filters.serviceOfferings).length > 0) && (
          <IconButton
            size="small"
            onClick={() => {
              // Clear both service lines and service offerings in one call to avoid sync issues
              handleFilterChange({
                ...filters,
                serviceLine1: { included: [], excluded: [] },
                serviceOfferings: { included: [], excluded: [] },
              });
            }}
            sx={{
              color: theme.palette.secondary.main,
              p: 0.5,
            }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ mb: 3, borderColor: theme.palette.secondary.light }} />

      {/* Scrollable content area */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          // Hide scrollbar
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Unit Groups - Expandable */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
          {Object.entries(SERVICE_LINE_GROUPS).map(([groupKey, groupConfig], groupIndex) => {
            // Get the service lines that belong to this group (case-insensitive matching)
            const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line) => {
              const lineLower = line.toLowerCase();
              if (groupConfig.include) {
                return groupConfig.include.some((inc) => lineLower.includes(inc.toLowerCase()));
              } else if (groupConfig.exclude) {
                return !groupConfig.exclude.some((exc) => lineLower.includes(exc.toLowerCase()));
              }
              return false;
            });

            // Count how many service lines in this group are selected
            const selectedServiceLines = getIncludedValues(filters.serviceLine1);
            const selectedCount = groupServiceLines.filter((line) => selectedServiceLines.includes(line)).length;

            const isExpanded = expandedGroups[groupKey];
            const allSelected = groupServiceLines.length > 0 && selectedCount === groupServiceLines.length;

            // Check if all service lines in this group are excluded
            const allExcludedInGroup =
              groupServiceLines.length > 0 && groupServiceLines.every((line) => excludedServiceLines.includes(line));

            // Handler to select/deselect all service lines in a group (without expanding)
            const handleGroupClick = () => {
              // Don't allow clicking if all lines are excluded
              if (allExcludedInGroup) return;

              const normalized = normalizeFilterValue(filters.serviceLine1);
              const currentIncluded = normalized.included;

              if (allSelected) {
                // Remove all group service lines from included (keep excluded as is)
                const newIncluded = currentIncluded.filter((line) => !groupServiceLines.includes(line));
                handleFilterChange({
                  ...filters,
                  serviceLine1: { included: newIncluded, excluded: normalized.excluded },
                });
              } else {
                // Add all group service lines to included (keep excluded as is)
                const newIncluded = [...new Set([...currentIncluded, ...groupServiceLines])];
                handleFilterChange({
                  ...filters,
                  serviceLine1: { included: newIncluded, excluded: normalized.excluded },
                });
              }
            };

            // Handler to expand/collapse (only for arrow click)
            const handleExpandClick = (e) => {
              e.stopPropagation(); // Prevent triggering group selection
              setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
            };

            return (
              <Box key={groupKey}>
                {/* Group Header - Click to select all (arrow to expand) */}
                <Box
                  draggable
                  onDragStart={(e) => {
                    // When dragging a group, we'll exclude all service lines in this group
                    e.dataTransfer.setData("serviceLineGroup", JSON.stringify(groupServiceLines));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={handleGroupClick}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    backgroundColor: allExcludedInGroup
                      ? alpha("#999", 0.2)
                      : allSelected
                        ? groupConfig.color
                        : theme.palette.grey[200],
                    color: allExcludedInGroup ? "#999" : allSelected ? "white" : theme.palette.text.primary,
                    opacity: allExcludedInGroup ? 0.5 : 1,
                    cursor: allExcludedInGroup ? "not-allowed" : "grab",
                    "&:hover": {
                      backgroundColor: allExcludedInGroup
                        ? alpha("#999", 0.2)
                        : allSelected
                          ? darken(groupConfig.color, 0.1)
                          : alpha(groupConfig.color, 0.15),
                    },
                    "&:active": {
                      cursor: allExcludedInGroup ? "not-allowed" : "grabbing",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {groupConfig.name}
                    {selectedCount > 0 && !allSelected && (
                      <Chip
                        label={selectedCount}
                        size="small"
                        sx={{
                          height: 18,
                          minWidth: 18,
                          fontSize: "0.7rem",
                          backgroundColor: allSelected ? "white" : groupConfig.color,
                          color: allSelected ? groupConfig.color : "white",
                          "& .MuiChip-label": { px: 0.5 },
                        }}
                      />
                    )}
                  </Box>
                  <Box
                    onClick={handleExpandClick}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 0.5,
                      borderRadius: 1,
                      "&:hover": {
                        backgroundColor: allSelected ? alpha("#fff", 0.2) : alpha(groupConfig.color, 0.15),
                      },
                    }}
                  >
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </Box>
                </Box>

                {/* Expandable Service Lines */}
                <Collapse in={isExpanded} timeout="auto">
                  <Box sx={{ pl: 2, pt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {groupServiceLines
                      .sort((a, b) => a.localeCompare(b))
                      .map((line, lineIndex) => {
                        // Check filter states
                        const isLineDirectlyIncluded = isIncluded(filters.serviceLine1, line);
                        const isLineExcluded = isExcluded(filters.serviceLine1, line);
                        const lineOfferings = serviceToOfferingMap[line] || [];
                        const hasOfferings = lineOfferings.length > 0;
                        const isLineExpanded = expandedServiceLines[line] || false;

                        // Count how many service offerings for this line are selected
                        const selectedOfferingsIncluded = normalizeFilterValue(filters.serviceOfferings).included;
                        const selectedOfferingsCount = lineOfferings.filter((offering) =>
                          selectedOfferingsIncluded.includes(offering)
                        ).length;
                        const allOfferingsSelected =
                          lineOfferings.length > 0 && selectedOfferingsCount === lineOfferings.length;

                        // Show line as selected if either directly included OR all its offerings are selected
                        const isLineIncluded = isLineDirectlyIncluded || allOfferingsSelected;

                        // Handler for clicking on the label (include/uninclude)
                        const handleClickLine = () => {
                          // Don't allow clicking if line is excluded
                          if (isLineExcluded) return;

                          // Use isLineDirectlyIncluded to determine if we should add or remove
                          // (not isLineIncluded which includes computed selection from all offerings)
                          if (isLineDirectlyIncluded) {
                            // Line is directly included, remove it and all its offerings
                            const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
                            const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);

                            // Remove the service line
                            const newServiceLineIncluded = normalizedServiceLine.included.filter((l) => l !== line);

                            // Remove all offerings from this service line (unless they belong to another selected service line)
                            const remainingSelectedLines = newServiceLineIncluded;
                            const newOfferingsIncluded = normalizedOfferings.included.filter((offering) => {
                              // Keep the offering if it doesn't belong to this line, or if it belongs to another selected line
                              if (!lineOfferings.includes(offering)) return true;

                              // Check if this offering belongs to any other selected service line
                              return remainingSelectedLines.some((otherLine) => {
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
                            // Line appears selected because all offerings are selected
                            // but line itself is not directly included
                            // Clicking should remove all offerings
                            let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);
                            lineOfferings.forEach((offering) => {
                              const idx = newOfferingsValue.included.indexOf(offering);
                              if (idx !== -1) {
                                newOfferingsValue.included.splice(idx, 1);
                              }
                            });
                            handleFilterChange({ ...filters, serviceOfferings: newOfferingsValue });
                          } else {
                            // Line is not selected, add it and all its offerings
                            const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
                            const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);

                            // Add the service line
                            const newServiceLineIncluded = [...new Set([...normalizedServiceLine.included, line])];

                            // Add all offerings from this service line
                            const newOfferingsIncluded = [
                              ...new Set([...normalizedOfferings.included, ...lineOfferings]),
                            ];

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
                        };

                        // Handler for - button (exclude/unexclude)
                        const handleExcludeLine = (e) => {
                          e.stopPropagation();
                          if (isLineExcluded) {
                            const newValue = removeValue(filters.serviceLine1, line);
                            setFilters((prev) => ({ ...prev, serviceLine1: newValue }));
                          } else {
                            const newValue = excludeValue(filters.serviceLine1, line);
                            setFilters((prev) => ({ ...prev, serviceLine1: newValue }));
                          }
                        };

                        return (
                          <Box key={line}>
                            <Box
                              draggable={!isLineExcluded}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("serviceLine", line);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={handleClickLine}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                borderRadius: 2,
                                px: 2,
                                py: 0.75,
                                fontSize: "0.85rem",
                                cursor: isLineExcluded ? "not-allowed" : "grab",
                                backgroundColor: isLineIncluded
                                  ? "#E63946"
                                  : isLineExcluded
                                    ? alpha("#999", 0.2)
                                    : theme.palette.grey[200],
                                color: isLineIncluded ? "white" : isLineExcluded ? "#999" : theme.palette.text.primary,
                                fontWeight: isLineIncluded ? 600 : 500,
                                opacity: isLineExcluded ? 0.5 : 1,
                                "&:hover": {
                                  backgroundColor: isLineExcluded
                                    ? alpha("#999", 0.2)
                                    : isLineIncluded
                                      ? darken("#E63946", 0.1)
                                      : theme.palette.grey[300],
                                },
                                "&:active": {
                                  cursor: "grabbing",
                                },
                              }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                                <Box sx={{ wordWrap: "break-word", whiteSpace: "normal", flex: 1 }}>{line}</Box>
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
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                {/* Expand button for service offerings */}
                                {hasOfferings && (
                                  <Box
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedServiceLines((prev) => ({ ...prev, [line]: !prev[line] }));
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
                                    {isLineExpanded ? (
                                      <ExpandLessIcon fontSize="small" />
                                    ) : (
                                      <ExpandMoreIcon fontSize="small" />
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Box>
                            {/* Service Offerings dropdown - using lighter shades of service line color */}
                            {hasOfferings && (
                              <Collapse in={isLineExpanded} timeout="auto">
                                <Box sx={{ pl: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
                                  {lineOfferings
                                    .sort((a, b) => a.localeCompare(b))
                                    .map((offeringCompositeKey, offeringIndex) => {
                                      // Extract offering name from composite key "ServiceLine::Offering"
                                      const [, offeringName] = offeringCompositeKey.split("::");

                                      // Check three filter states (no cascade for inclusion display)
                                      // Use composite key for all filter operations
                                      const isOfferingDirectlyIncluded = isIncluded(
                                        filters.serviceOfferings,
                                        offeringCompositeKey
                                      );
                                      const isOfferingDirectlyExcluded = isExcluded(
                                        filters.serviceOfferings,
                                        offeringCompositeKey
                                      );

                                      // Only show as selected if directly included (not via parent cascade)
                                      const isOfferingIncluded = isOfferingDirectlyIncluded;
                                      // Cascade exclusion only (for graying out)
                                      const isOfferingExcluded = isOfferingDirectlyExcluded || isLineExcluded;

                                      // Handler for clicking on the label (include/uninclude)
                                      const handleClickOffering = () => {
                                        // Don't allow clicking if offering is excluded
                                        if (isOfferingExcluded) return;

                                        if (isOfferingIncluded) {
                                          // Remove offering from included
                                          let updatedFilters = { ...filters };
                                          const newOfferingsValue = removeValue(
                                            filters.serviceOfferings,
                                            offeringCompositeKey
                                          );
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
                                          handleFilterChange({ ...filters, serviceOfferings: newValue });
                                        }
                                      };

                                      // Handler for - button (exclude/unexclude)
                                      const handleExcludeOffering = (e) => {
                                        e.stopPropagation();
                                        if (isOfferingDirectlyExcluded) {
                                          const newValue = removeValue(filters.serviceOfferings, offeringCompositeKey);
                                          setFilters((prev) => ({ ...prev, serviceOfferings: newValue }));
                                        } else {
                                          const newValue = excludeValue(filters.serviceOfferings, offeringCompositeKey);
                                          setFilters((prev) => ({ ...prev, serviceOfferings: newValue }));
                                        }
                                      };

                                      return (
                                        <Box
                                          key={offeringCompositeKey}
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
                                            backgroundColor: isOfferingIncluded
                                              ? "#FF6B73"
                                              : isOfferingExcluded
                                                ? alpha("#999", 0.2)
                                                : theme.palette.grey[100],
                                            color: isOfferingIncluded
                                              ? "white"
                                              : isOfferingExcluded
                                                ? "#999"
                                                : theme.palette.text.primary,
                                            fontWeight: isOfferingIncluded ? 600 : 500,
                                            opacity: isOfferingExcluded ? 0.5 : 1,
                                            "&:hover": {
                                              backgroundColor: isOfferingExcluded
                                                ? alpha("#999", 0.2)
                                                : isOfferingIncluded
                                                  ? darken("#FF6B73", 0.1)
                                                  : theme.palette.grey[200],
                                            },
                                            "&:active": {
                                              cursor: "grabbing",
                                            },
                                          }}
                                        >
                                          <Box sx={{ flex: 1, wordWrap: "break-word", whiteSpace: "normal" }}>
                                            {offeringName || offeringCompositeKey}
                                          </Box>
                                        </Box>
                                      );
                                    })}
                                </Box>
                              </Collapse>
                            )}
                          </Box>
                        );
                      })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Exclusion Zone - Fixed at bottom with blur effect */}
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverExcludeZone(true);
        }}
        onDragLeave={() => {
          setDragOverExcludeZone(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverExcludeZone(false);

          // Check if it's a service line group
          const serviceLineGroup = e.dataTransfer.getData("serviceLineGroup");
          if (serviceLineGroup) {
            try {
              const groupLines = JSON.parse(serviceLineGroup);
              // Exclude all service lines in the group AND their offerings
              let newServiceLineValue = normalizeFilterValue(filters.serviceLine1);
              let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

              groupLines.forEach((line) => {
                // Exclude the service line (removes from included, adds to excluded)
                newServiceLineValue = excludeValue(newServiceLineValue, line);

                // Also exclude all offerings for this service line
                const offerings = serviceToOfferingMap[line] || [];
                offerings.forEach((offering) => {
                  newOfferingsValue = excludeValue(newOfferingsValue, offering);
                });
              });

              setFilters((prev) => ({
                ...prev,
                serviceLine1: newServiceLineValue,
                serviceOfferings: newOfferingsValue,
              }));
            } catch (err) {
              console.error("Error parsing service line group:", err);
            }
          }

          // Check if it's a single service line
          const serviceLine = e.dataTransfer.getData("serviceLine");
          if (serviceLine) {
            // Exclude the service line AND all its offerings
            const newServiceLineValue = excludeValue(filters.serviceLine1, serviceLine);
            let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

            // Exclude all offerings for this service line
            const offerings = serviceToOfferingMap[serviceLine] || [];
            offerings.forEach((offering) => {
              newOfferingsValue = excludeValue(newOfferingsValue, offering);
            });

            setFilters((prev) => ({
              ...prev,
              serviceLine1: newServiceLineValue,
              serviceOfferings: newOfferingsValue,
            }));
          }

          // Check if it's a service offering
          const serviceOffering = e.dataTransfer.getData("serviceOffering");
          if (serviceOffering) {
            const newValue = excludeValue(filters.serviceOfferings, serviceOffering);
            setFilters((prev) => ({ ...prev, serviceOfferings: newValue }));
          }

          // Check if it's an account
          const account = e.dataTransfer.getData("account");
          if (account) {
            const newValue = excludeValue(filters.accounts, account);
            setFilters((prev) => ({ ...prev, accounts: newValue }));
          }

          // Check if it's a technology partner
          const technologyPartner = e.dataTransfer.getData("technologyPartner");
          if (technologyPartner) {
            const newValue = excludeValue(filters.technologyPartners, technologyPartner);
            setFilters((prev) => ({ ...prev, technologyPartners: newValue }));
          }

          // Check if it's a person
          const person = e.dataTransfer.getData("person");
          if (person) {
            const newValue = excludeValue(filters.people, person);
            setFilters((prev) => ({ ...prev, people: newValue }));
          }

          // Check if it's a segment code group (from LeftSidebar)
          const segmentCodeGroup = e.dataTransfer.getData("segmentCodeGroup");
          if (segmentCodeGroup) {
            try {
              const groupCodes = JSON.parse(segmentCodeGroup);
              // Exclude all segment codes in the group AND their sub-segments
              let newSegmentCodesValue = normalizeFilterValue(filters.subSegmentCodes);
              let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);

              groupCodes.forEach((code) => {
                // Exclude the segment code (removes from included, adds to excluded)
                newSegmentCodesValue = excludeValue(newSegmentCodesValue, code);

                // Also exclude all sub-segments for this segment code
                const subSegments = segmentToSubSegmentMap[code] || [];
                subSegments.forEach((subSegment) => {
                  newSubSegmentsValue = excludeValue(newSubSegmentsValue, subSegment);
                });
              });

              setFilters((prev) => ({
                ...prev,
                subSegmentCodes: newSegmentCodesValue,
                subSegments: newSubSegmentsValue,
              }));
            } catch (err) {
              console.error("Error parsing segment code group:", err);
            }
          }

          // Check if it's a single segment code (from LeftSidebar)
          const segmentCode = e.dataTransfer.getData("segmentCode");
          if (segmentCode) {
            // Exclude the segment code AND all its sub-segments
            const newSegmentCodesValue = excludeValue(filters.subSegmentCodes, segmentCode);
            let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);

            // Exclude all sub-segments for this segment code
            const subSegments = segmentToSubSegmentMap[segmentCode] || [];
            subSegments.forEach((subSegment) => {
              newSubSegmentsValue = excludeValue(newSubSegmentsValue, subSegment);
            });

            setFilters((prev) => ({
              ...prev,
              subSegmentCodes: newSegmentCodesValue,
              subSegments: newSubSegmentsValue,
            }));
          }

          // Check if it's a sub-segment (from LeftSidebar)
          const subSegment = e.dataTransfer.getData("subSegment");
          if (subSegment) {
            const newValue = excludeValue(filters.subSegments, subSegment);
            setFilters((prev) => ({ ...prev, subSegments: newValue }));
          }
        }}
        sx={{
          flexShrink: 0,
          mt: 3,
          p: 2,
          minHeight: 120,
          maxHeight: "35vh",
          overflowY: "auto",
          borderRadius: 2,
          border: `2px dashed ${dragOverExcludeZone ? "#FF3D47" : "#555"}`,
          backgroundColor: dragOverExcludeZone ? alpha("#FF3D47", 0.12) : alpha("#330000", 0.06),
          backdropFilter: "blur(8px)",
          transition: "all 0.25s ease-in-out",
          boxShadow: dragOverExcludeZone ? `inset 0 0 12px ${alpha("#FF3D47", 0.2)}` : "none",
          transform: dragOverExcludeZone ? "scale(1.02)" : "scale(1)",
          // Hide scrollbar
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
            Zone d'exclusion
          </Typography>
          {/* Clear all exclusions button */}
          {(excludedGroups.length > 0 ||
            individualExcludedLines.length > 0 ||
            excludedServiceOfferings.length > 0 ||
            excludedAccounts.length > 0 ||
            excludedTechnologyPartners.length > 0 ||
            excludedPeople.length > 0 ||
            excludedSegmentCodes.length > 0 ||
            excludedSubSegments.length > 0) && (
            <IconButton
              size="small"
              onClick={() => {
                // Clear all exclusions
                const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
                const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);
                const normalizedAccounts = normalizeFilterValue(filters.accounts);
                const normalizedTechPartners = normalizeFilterValue(filters.technologyPartners);
                const normalizedPeople = normalizeFilterValue(filters.people);
                const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
                const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

                setFilters((prev) => ({
                  ...prev,
                  serviceLine1: { included: normalizedServiceLine.included, excluded: [] },
                  serviceOfferings: { included: normalizedOfferings.included, excluded: [] },
                  accounts: { included: normalizedAccounts.included, excluded: [] },
                  technologyPartners: { included: normalizedTechPartners.included, excluded: [] },
                  people: { included: normalizedPeople.included, excluded: [] },
                  subSegmentCodes: { included: normalizedSegmentCodes.included, excluded: [] },
                  subSegments: { included: normalizedSubSegments.included, excluded: [] },
                }));
              }}
              sx={{
                color: theme.palette.text.disabled,
                "&:hover": {
                  color: "#FF3D47",
                  backgroundColor: alpha("#FF3D47", 0.1),
                },
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Display excluded items organized by type */}
        {excludedGroups.length === 0 &&
        individualExcludedLines.length === 0 &&
        excludedServiceOfferings.length === 0 &&
        excludedAccounts.length === 0 &&
        excludedTechnologyPartners.length === 0 &&
        excludedPeople.length === 0 &&
        excludedSegmentCodes.length === 0 &&
        excludedSubSegments.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 1, position: "relative", minHeight: 20 }}>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.disabled,
                fontStyle: "italic",
                display: "block",
                position: "absolute",
                inset: 0,
                opacity: dragOverExcludeZone ? 0 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              Glissez un élément ici pour l'exclure
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.disabled,
                fontStyle: "italic",
                display: "block",
                position: "absolute",
                inset: 0,
                opacity: dragOverExcludeZone ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            >
              ↓ Déposer ici pour exclure
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* Excluded Unit Groups */}
            {excludedGroups.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Units
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedGroups.map((group) => (
                    <Chip
                      key={`group-${group.key}`}
                      label={group.name}
                      size="small"
                      onDelete={() => {
                        // Remove all service lines in this group from exclusion AND their offerings
                        let newServiceLineValue = normalizeFilterValue(filters.serviceLine1);
                        let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

                        group.lines.forEach((line) => {
                          newServiceLineValue = removeValue(newServiceLineValue, line);

                          // Also remove all offerings for this service line
                          const offerings = serviceToOfferingMap[line] || [];
                          offerings.forEach((offering) => {
                            newOfferingsValue = removeValue(newOfferingsValue, offering);
                          });
                        });

                        setFilters((prev) => ({
                          ...prev,
                          serviceLine1: newServiceLineValue,
                          serviceOfferings: newOfferingsValue,
                        }));
                      }}
                      sx={{
                        backgroundColor: "#330000",
                        color: "white",
                        fontWeight: 600,
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Individual Excluded Service Lines (not part of a fully excluded group) */}
            {individualExcludedLines.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Service Lines
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {individualExcludedLines.map((line) => (
                    <Chip
                      key={`line-${line}`}
                      label={line}
                      size="small"
                      onDelete={() => {
                        // Remove service line AND all its offerings from exclusion
                        const newServiceLineValue = removeValue(filters.serviceLine1, line);
                        let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

                        // Remove all offerings for this service line
                        const offerings = serviceToOfferingMap[line] || [];
                        offerings.forEach((offering) => {
                          newOfferingsValue = removeValue(newOfferingsValue, offering);
                        });

                        setFilters((prev) => ({
                          ...prev,
                          serviceLine1: newServiceLineValue,
                          serviceOfferings: newOfferingsValue,
                        }));
                      }}
                      sx={{
                        backgroundColor: "#330000",
                        color: "white",
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Excluded Service Offerings */}
            {excludedServiceOfferings.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Service Offerings
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedServiceOfferings.map((offering) => {
                    // Extract offering name from composite key "ServiceLine::Offering"
                    const [, offeringName] = offering.split("::");
                    return (
                      <Chip
                        key={`offering-${offering}`}
                        label={offeringName || offering}
                        size="small"
                        onDelete={() => {
                          const newValue = removeValue(filters.serviceOfferings, offering);
                          setFilters((prev) => ({ ...prev, serviceOfferings: newValue }));
                        }}
                        sx={{
                          backgroundColor: "#440000",
                          color: "white",
                          border: "1px solid #666",
                          "& .MuiChip-deleteIcon": {
                            color: alpha("#fff", 0.7),
                            "&:hover": {
                              color: "#fff",
                            },
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Excluded Accounts */}
            {excludedAccounts.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Accounts
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedAccounts.map((account) => (
                    <Chip
                      key={`account-${account}`}
                      label={account}
                      size="small"
                      onDelete={() => {
                        const newValue = removeValue(filters.accounts, account);
                        setFilters((prev) => ({ ...prev, accounts: newValue }));
                      }}
                      sx={{
                        backgroundColor: "#CC2931", // R60 - BearingPoint Red
                        color: "white",
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Excluded Technology Partners */}
            {excludedTechnologyPartners.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Technology Partners
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedTechnologyPartners.map((partner) => (
                    <Chip
                      key={`techpartner-${partner}`}
                      label={partner}
                      size="small"
                      onDelete={() => {
                        const newValue = removeValue(filters.technologyPartners, partner);
                        setFilters((prev) => ({ ...prev, technologyPartners: newValue }));
                      }}
                      sx={{
                        backgroundColor: "#FF3D47", // R50 - BearingPoint Red (Primary)
                        color: "white",
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Excluded People */}
            {excludedPeople.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Personnes
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedPeople.map((person) => (
                    <Chip
                      key={`person-${person}`}
                      label={person}
                      size="small"
                      onDelete={() => {
                        const newValue = removeValue(filters.people, person);
                        setFilters((prev) => ({ ...prev, people: newValue }));
                      }}
                      sx={{
                        backgroundColor: "#806659", // G60 - BearingPoint Warm Grey
                        color: "white",
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Excluded Segment Codes (from LeftSidebar) */}
            {excludedSegmentCodes.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Segment
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedSegmentCodes.map((code) => (
                    <Chip
                      key={`segmentCode-${code}`}
                      label={code}
                      size="small"
                      onDelete={() => {
                        // Remove segment code AND all its sub-segments from exclusion
                        const newSegmentCodesValue = removeValue(filters.subSegmentCodes, code);
                        let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);

                        // Remove all sub-segments for this segment code
                        const subSegments = segmentToSubSegmentMap[code] || [];
                        subSegments.forEach((subSegment) => {
                          newSubSegmentsValue = removeValue(newSubSegmentsValue, subSegment);
                        });

                        setFilters((prev) => ({
                          ...prev,
                          subSegmentCodes: newSegmentCodesValue,
                          subSegments: newSubSegmentsValue,
                        }));
                      }}
                      sx={{
                        backgroundColor: "#330000",
                        color: "white",
                        fontWeight: 600,
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Excluded Sub-Segments (from LeftSidebar) */}
            {excludedSubSegments.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Sub-Segments
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {excludedSubSegments.map((subSegment) => (
                    <Chip
                      key={`subSegment-${subSegment}`}
                      label={subSegment}
                      size="small"
                      onDelete={() => {
                        const newValue = removeValue(filters.subSegments, subSegment);
                        setFilters((prev) => ({ ...prev, subSegments: newValue }));
                      }}
                      sx={{
                        backgroundColor: "#440000",
                        color: "white",
                        border: "1px solid #666",
                        "& .MuiChip-deleteIcon": {
                          color: alpha("#fff", 0.7),
                          "&:hover": {
                            color: "#fff",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Performance optimization: Memoize component to prevent unnecessary re-renders
// Only re-renders when props actually change
RightSidebar.displayName = "RightSidebar";

export default React.memo(RightSidebar);
