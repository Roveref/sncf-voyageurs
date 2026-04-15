import React, { useState, useEffect } from "react";
import { Box, Typography, Divider, Button, Chip, Collapse, ToggleButton, IconButton } from "@mui/material";
import { alpha, darken, lighten, useTheme } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { SEGMENT_CODE_GROUPS, getSegmentColor } from "./segmentConstants";
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
 * LeftSidebar Component
 *
 * Displays the left sidebar with segment code filters organized by groups (AMD) and individual codes.
 * Users can select/deselect entire segment groups or individual segment codes, and expand to view
 * and filter sub-segments within each code.
 *
 * Performance: This component is memoized using React.memo() to prevent unnecessary re-renders
 * when parent component state changes that don't affect the sidebar's props.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.filters - Current filter selections (PHASE 1: new structure)
 * @param {Object} props.filters.subSegmentCodes - Selected segment codes { included: [], excluded: [] }
 * @param {Object} props.filters.subSegments - Selected sub-segments { included: [], excluded: [] }
 * @param {Object} props.filterOptions - Available filter options
 * @param {Array} props.filterOptions.subSegmentCodes - Available segment codes
 * @param {Function} props.handleClearFilterType - Function to clear all filters of a specific type
 * @param {Function} props.handleToggleFilter - Function to toggle individual filter selection
 * @param {Function} props.handleFilterChange - Function to update filter state with synchronization
 * @param {Object} props.expandedSegmentGroups - State tracking which segment groups are expanded
 * @param {Function} props.setExpandedSegmentGroups - Function to update expanded segment groups
 * @param {Object} props.expandedSegmentCodes - State tracking which segment codes are expanded
 * @param {Function} props.setExpandedSegmentCodes - Function to update expanded segment codes
 * @param {Object} props.segmentToSubSegmentMap - Mapping of segment codes to their sub-segments
 * @returns {JSX.Element} The left sidebar component
 */
const LeftSidebar = ({
  filters,
  filterOptions,
  handleClearFilterType,
  handleToggleFilter,
  handleFilterChange,
  setFilters,
  expandedSegmentGroups,
  setExpandedSegmentGroups,
  expandedSegmentCodes,
  setExpandedSegmentCodes,
  segmentToSubSegmentMap,
}) => {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  // Sidebar entrance animation on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get excluded items (for checking if items are excluded, even though exclusion zone is in RightSidebar)
  const excludedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes).excluded || [];
  const excludedSubSegments = normalizeFilterValue(filters.subSegments).excluded || [];

  // Handler to expand one level (AMD group → segment codes → sub-segments)
  const handleExpandLevel = () => {
    const allSegmentCodes = filterOptions.subSegmentCodes || [];

    // Check if AMD group is collapsed
    const amdGroupCollapsed = !expandedSegmentGroups.AMD;

    if (amdGroupCollapsed) {
      // Level 0 → Level 1: Open AMD group
      setExpandedSegmentGroups({ AMD: true });
    } else {
      // Level 1 → Level 2: Open all segment codes
      const newExpandedSegmentCodes = {};
      allSegmentCodes.forEach((code) => {
        newExpandedSegmentCodes[code] = true;
      });
      setExpandedSegmentCodes(newExpandedSegmentCodes);
    }
  };

  // Handler to collapse one level (sub-segments → segment codes → AMD group)
  const handleCollapseLevel = () => {
    // Check if any segment codes are expanded
    const anyCodeExpanded = Object.values(expandedSegmentCodes).some((expanded) => expanded);

    if (anyCodeExpanded) {
      // Level 2 → Level 1: Close all segment codes
      setExpandedSegmentCodes({});
    } else {
      // Level 1 → Level 0: Close AMD group
      setExpandedSegmentGroups({});
    }
  };

  return (
    <Box
      sx={{
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // Sidebar entrance from left
        ...keyframes.fadeInLeft,
        animation: mounted ? `fadeInLeft 0.5s ${easing.elegant} forwards` : "none",
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
          <Typography variant="h6" fontWeight={600} color={theme.palette.primary.dark}>
            Segments
          </Typography>

          {/* Expand/Collapse level buttons */}
          <Box sx={{ display: "flex", gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={handleCollapseLevel}
              sx={{
                color: theme.palette.primary.main,
                p: 0.5,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
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
                color: theme.palette.primary.main,
                p: 0.5,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
              title="Expand one level"
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {(getIncludedValues(filters.subSegmentCodes).length > 0 ||
          getIncludedValues(filters.subSegments).length > 0) && (
          <IconButton
            size="small"
            onClick={() => {
              // Clear both segment codes and sub-segments in one call to avoid sync issues
              handleFilterChange({
                ...filters,
                subSegmentCodes: { included: [], excluded: [] },
                subSegments: { included: [], excluded: [] },
              });
            }}
            sx={{
              color: theme.palette.primary.main,
              p: 0.5,
            }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ mb: 3, borderColor: theme.palette.primary.light }} />

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
        {/* Segment Code Groups - AMD group and individual codes */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
          {/* AMD Group */}
          {(() => {
            const groupConfig = SEGMENT_CODE_GROUPS.AMD;
            const groupCodes = (filterOptions.subSegmentCodes || []).filter((code) =>
              groupConfig.include.some((inc) => code.toUpperCase() === inc.toUpperCase())
            );

            const selectedCodes = getIncludedValues(filters.subSegmentCodes);
            const selectedCount = groupCodes.filter((code) => selectedCodes.includes(code)).length;

            const isExpanded = expandedSegmentGroups.AMD;
            const allSelected = groupCodes.length > 0 && selectedCount === groupCodes.length;
            const groupIndex = 0; // For stagger animation

            // Check if all codes in this group are excluded
            const allExcludedInGroup =
              groupCodes.length > 0 && groupCodes.every((code) => excludedSegmentCodes.includes(code));

            const handleGroupClick = () => {
              // Don't allow clicking if all codes are excluded
              if (allExcludedInGroup) return;

              const normalized = normalizeFilterValue(filters.subSegmentCodes);
              const currentIncluded = normalized.included;

              if (allSelected) {
                // Remove all group codes from included (keep excluded as is)
                const newIncluded = currentIncluded.filter((code) => !groupCodes.includes(code));
                handleFilterChange({
                  ...filters,
                  subSegmentCodes: { included: newIncluded, excluded: normalized.excluded },
                });
              } else {
                // Add all group codes to included (keep excluded as is)
                const newIncluded = [...new Set([...currentIncluded, ...groupCodes])];
                handleFilterChange({
                  ...filters,
                  subSegmentCodes: { included: newIncluded, excluded: normalized.excluded },
                });
              }
            };

            const handleExpandClick = (e) => {
              e.stopPropagation();
              setExpandedSegmentGroups((prev) => ({ ...prev, AMD: !prev.AMD }));
            };

            return (
              <Box
                key="AMD"
                sx={{
                  // Stagger effect for filter groups
                  ...keyframes.fadeInUp,
                  animation: mounted ? `fadeInUp 0.5s ${easing.elegant} ${groupIndex * 100}ms both` : "none",
                }}
              >
                {/* AMD Group Header */}
                <Box
                  draggable
                  onDragStart={(e) => {
                    // When dragging a group, we'll exclude all codes in this group
                    e.dataTransfer.setData("segmentCodeGroup", JSON.stringify(groupCodes));
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
                          // Chip animations - scale + fade
                          ...keyframes.scaleIn,
                          animation: "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
                      // Icon rotation (180deg) on expand
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      "&:hover": {
                        backgroundColor: allSelected ? alpha("#fff", 0.2) : alpha(groupConfig.color, 0.15),
                      },
                    }}
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </Box>
                </Box>

                {/* Expandable Segment Codes */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      pl: 2,
                      pt: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                      // Content fade-in animation
                      ...keyframes.fadeIn,
                      animation: isExpanded ? `fadeIn 0.3s ${easing.standard}` : "none",
                    }}
                  >
                    {groupCodes.map((code, codeIndex) => {
                      // Check filter states
                      const isCodeDirectlyIncluded = isIncluded(filters.subSegmentCodes, code);
                      const isCodeExcluded = isExcluded(filters.subSegmentCodes, code);
                      const codeSubSegments = segmentToSubSegmentMap[code] || [];
                      const hasSubSegments = codeSubSegments.length > 0;
                      const isCodeExpanded = expandedSegmentCodes[code] || false;

                      // Count how many sub-segments for this code are selected
                      const selectedSubSegmentsIncluded = normalizeFilterValue(filters.subSegments).included;
                      const selectedSubSegmentsCount = codeSubSegments.filter((subSeg) =>
                        selectedSubSegmentsIncluded.includes(subSeg)
                      ).length;
                      const allSubSegmentsSelected =
                        codeSubSegments.length > 0 && selectedSubSegmentsCount === codeSubSegments.length;

                      // Show code as selected if either directly included OR all its sub-segments are selected
                      const isCodeIncluded = isCodeDirectlyIncluded || allSubSegmentsSelected;

                      // Handler for clicking on the label (include/uninclude)
                      const handleClickCode = () => {
                        // Don't allow clicking if code is excluded
                        if (isCodeExcluded) return;

                        // Use isCodeDirectlyIncluded to determine if we should add or remove
                        if (isCodeDirectlyIncluded) {
                          // Code is directly included, remove it and all its sub-segments
                          const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
                          const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

                          // Remove the segment code
                          const newSegmentCodesIncluded = normalizedSegmentCodes.included.filter((c) => c !== code);

                          // Remove all sub-segments from this code (unless they belong to another selected code)
                          const remainingSelectedCodes = newSegmentCodesIncluded;
                          const newSubSegmentsIncluded = normalizedSubSegments.included.filter((subSeg) => {
                            // Keep the sub-segment if it doesn't belong to this code, or if it belongs to another selected code
                            if (!codeSubSegments.includes(subSeg)) return true;

                            // Check if this sub-segment belongs to any other selected segment code
                            return remainingSelectedCodes.some((otherCode) => {
                              const otherCodeSubSegments = segmentToSubSegmentMap[otherCode] || [];
                              return otherCodeSubSegments.includes(subSeg);
                            });
                          });

                          handleFilterChange({
                            ...filters,
                            subSegmentCodes: {
                              included: newSegmentCodesIncluded,
                              excluded: normalizedSegmentCodes.excluded,
                            },
                            subSegments: { included: newSubSegmentsIncluded, excluded: normalizedSubSegments.excluded },
                          });
                        } else if (allSubSegmentsSelected) {
                          // Code appears selected because all sub-segments are selected
                          // but code itself is not directly included
                          // Clicking should remove all sub-segments
                          let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);
                          codeSubSegments.forEach((subSeg) => {
                            const idx = newSubSegmentsValue.included.indexOf(subSeg);
                            if (idx !== -1) {
                              newSubSegmentsValue.included.splice(idx, 1);
                            }
                          });
                          handleFilterChange({ ...filters, subSegments: newSubSegmentsValue });
                        } else {
                          // Code is not selected, add it and all its sub-segments
                          const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
                          const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

                          // Add the segment code
                          const newSegmentCodesIncluded = [...new Set([...normalizedSegmentCodes.included, code])];

                          // Add all sub-segments from this code
                          const newSubSegmentsIncluded = [
                            ...new Set([...normalizedSubSegments.included, ...codeSubSegments]),
                          ];

                          handleFilterChange({
                            ...filters,
                            subSegmentCodes: {
                              included: newSegmentCodesIncluded,
                              excluded: normalizedSegmentCodes.excluded,
                            },
                            subSegments: { included: newSubSegmentsIncluded, excluded: normalizedSubSegments.excluded },
                          });
                        }
                      };

                      return (
                        <Box key={code}>
                          <Box
                            draggable={!isCodeExcluded}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("segmentCode", code);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={handleClickCode}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              borderRadius: 2,
                              px: 2,
                              py: 0.75,
                              fontSize: "0.85rem",
                              cursor: isCodeExcluded ? "not-allowed" : "grab",
                              backgroundColor: isCodeIncluded
                                ? "#E63946"
                                : isCodeExcluded
                                  ? alpha("#999", 0.2)
                                  : theme.palette.grey[200],
                              color: isCodeIncluded ? "white" : isCodeExcluded ? "#999" : theme.palette.text.primary,
                              fontWeight: isCodeIncluded ? 600 : 500,
                              opacity: isCodeExcluded ? 0.5 : 1,
                              "&:hover": {
                                backgroundColor: isCodeExcluded
                                  ? alpha("#999", 0.2)
                                  : isCodeIncluded
                                    ? darken("#E63946", 0.1)
                                    : theme.palette.grey[300],
                              },
                              "&:active": {
                                cursor: "grabbing",
                              },
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                              <Box sx={{ wordWrap: "break-word", whiteSpace: "normal", flex: 1 }}>{code}</Box>
                              {selectedSubSegmentsCount > 0 && !allSubSegmentsSelected && (
                                <Chip
                                  label={selectedSubSegmentsCount}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    minWidth: 18,
                                    fontSize: "0.7rem",
                                    backgroundColor: isCodeIncluded ? "white" : "#E63946",
                                    color: isCodeIncluded ? "#E63946" : "white",
                                    "& .MuiChip-label": { px: 0.5 },
                                  }}
                                />
                              )}
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              {/* Expand button for sub-segments */}
                              {hasSubSegments && (
                                <Box
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSegmentCodes((prev) => ({ ...prev, [code]: !prev[code] }));
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
                                      backgroundColor: "rgba(0, 0, 0, 0.1)",
                                    },
                                  }}
                                >
                                  {isCodeExpanded ? (
                                    <ExpandLessIcon fontSize="small" />
                                  ) : (
                                    <ExpandMoreIcon fontSize="small" />
                                  )}
                                </Box>
                              )}
                            </Box>
                          </Box>
                          {/* Sub-segments dropdown - using lighter shades of segment color */}
                          {hasSubSegments && (
                            <Collapse in={isCodeExpanded} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  pl: 2,
                                  pt: 0.5,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 0.25,
                                  // Content fade-in animation
                                  ...keyframes.fadeIn,
                                  animation: isCodeExpanded ? `fadeIn 0.3s ${easing.standard}` : "none",
                                }}
                              >
                                {codeSubSegments.map((subSegment, subIndex) => {
                                  // Check filter states (no cascade for inclusion display)
                                  const isSubSegmentDirectlyIncluded = isIncluded(filters.subSegments, subSegment);
                                  const isSubSegmentDirectlyExcluded = isExcluded(filters.subSegments, subSegment);

                                  // Only show as selected if directly included (not via parent cascade)
                                  const isSubIncluded = isSubSegmentDirectlyIncluded;
                                  // Cascade exclusion only (for graying out)
                                  const isSubExcluded = isSubSegmentDirectlyExcluded || isCodeExcluded;

                                  // Handler for clicking on the label (include/uninclude)
                                  const handleClickSub = (e) => {
                                    e.stopPropagation();
                                    // Don't allow clicking if sub-segment is excluded
                                    if (isSubExcluded) return;

                                    if (isSubIncluded) {
                                      // Remove sub-segment from included
                                      let updatedFilters = { ...filters };
                                      const newSubSegmentsValue = removeValue(filters.subSegments, subSegment);
                                      updatedFilters.subSegments = newSubSegmentsValue;

                                      // Also remove parent segment code if it's explicitly selected
                                      if (isCodeDirectlyIncluded) {
                                        const newSegmentCodeValue = removeValue(filters.subSegmentCodes, code);
                                        updatedFilters.subSegmentCodes = newSegmentCodeValue;
                                      }

                                      handleFilterChange(updatedFilters);
                                    } else {
                                      // Add sub-segment to included
                                      const newValue = includeValue(filters.subSegments, subSegment);
                                      handleFilterChange({ ...filters, subSegments: newValue });
                                    }
                                  };

                                  return (
                                    <Box
                                      key={subSegment}
                                      draggable={!isSubExcluded}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData("subSegment", subSegment);
                                        e.dataTransfer.effectAllowed = "move";
                                      }}
                                      onClick={handleClickSub}
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        borderRadius: 1.5,
                                        px: 1.5,
                                        py: 0.5,
                                        fontSize: "0.75rem",
                                        cursor: isSubExcluded ? "not-allowed" : "grab",
                                        backgroundColor: isSubIncluded
                                          ? "#FF6B73"
                                          : isSubExcluded
                                            ? alpha("#999", 0.2)
                                            : theme.palette.grey[100],
                                        color: isSubIncluded
                                          ? "white"
                                          : isSubExcluded
                                            ? "#999"
                                            : theme.palette.text.primary,
                                        fontWeight: isSubIncluded ? 600 : 500,
                                        opacity: isSubExcluded ? 0.5 : 1,
                                        "&:hover": {
                                          backgroundColor: isSubExcluded
                                            ? alpha("#999", 0.2)
                                            : isSubIncluded
                                              ? darken("#FF6B73", 0.1)
                                              : theme.palette.grey[200],
                                        },
                                        "&:active": {
                                          cursor: "grabbing",
                                        },
                                      }}
                                    >
                                      <Box sx={{ flex: 1, wordWrap: "break-word", whiteSpace: "normal" }}>
                                        {subSegment}
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
          })()}

          {/* Individual Segment Codes (not in AMD) */}
          {(filterOptions.subSegmentCodes || [])
            .filter((code) => !SEGMENT_CODE_GROUPS.AMD.include.some((inc) => code.toUpperCase() === inc.toUpperCase()))
            .map((code, codeIndex) => {
              // Check filter states
              const isCodeDirectlyIncluded = isIncluded(filters.subSegmentCodes, code);
              const isCodeExcluded = isExcluded(filters.subSegmentCodes, code);
              const codeSubSegments = segmentToSubSegmentMap[code] || [];
              const hasSubSegments = codeSubSegments.length > 0;
              const isCodeExpanded = expandedSegmentCodes[code] || false;
              // Stagger animation - starts after AMD group (index 1+)
              const itemIndex = codeIndex + 1;

              // Count how many sub-segments for this code are selected
              const selectedSubSegmentsIncluded = normalizeFilterValue(filters.subSegments).included;
              const selectedSubSegmentsCount = codeSubSegments.filter((subSeg) =>
                selectedSubSegmentsIncluded.includes(subSeg)
              ).length;
              const allSubSegmentsSelected =
                codeSubSegments.length > 0 && selectedSubSegmentsCount === codeSubSegments.length;

              // Show code as selected if either directly included OR all its sub-segments are selected
              const isCodeIncluded = isCodeDirectlyIncluded || allSubSegmentsSelected;

              // Handler for clicking on the label (include/uninclude)
              const handleClickIndivCode = () => {
                // Don't allow clicking if code is excluded
                if (isCodeExcluded) return;

                // Use isCodeDirectlyIncluded to determine if we should add or remove
                if (isCodeDirectlyIncluded) {
                  // Code is directly included, remove it and all its sub-segments
                  const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
                  const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

                  // Remove the segment code
                  const newSegmentCodesIncluded = normalizedSegmentCodes.included.filter((c) => c !== code);

                  // Remove all sub-segments from this code (unless they belong to another selected code)
                  const remainingSelectedCodes = newSegmentCodesIncluded;
                  const newSubSegmentsIncluded = normalizedSubSegments.included.filter((subSeg) => {
                    // Keep the sub-segment if it doesn't belong to this code, or if it belongs to another selected code
                    if (!codeSubSegments.includes(subSeg)) return true;

                    // Check if this sub-segment belongs to any other selected segment code
                    return remainingSelectedCodes.some((otherCode) => {
                      const otherCodeSubSegments = segmentToSubSegmentMap[otherCode] || [];
                      return otherCodeSubSegments.includes(subSeg);
                    });
                  });

                  handleFilterChange({
                    ...filters,
                    subSegmentCodes: { included: newSegmentCodesIncluded, excluded: normalizedSegmentCodes.excluded },
                    subSegments: { included: newSubSegmentsIncluded, excluded: normalizedSubSegments.excluded },
                  });
                } else if (allSubSegmentsSelected) {
                  // Code appears selected because all sub-segments are selected
                  // but code itself is not directly included
                  // Clicking should remove all sub-segments
                  let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);
                  codeSubSegments.forEach((subSeg) => {
                    const idx = newSubSegmentsValue.included.indexOf(subSeg);
                    if (idx !== -1) {
                      newSubSegmentsValue.included.splice(idx, 1);
                    }
                  });
                  handleFilterChange({ ...filters, subSegments: newSubSegmentsValue });
                } else {
                  // Code is not selected, add it and all its sub-segments
                  const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
                  const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

                  // Add the segment code
                  const newSegmentCodesIncluded = [...new Set([...normalizedSegmentCodes.included, code])];

                  // Add all sub-segments from this code
                  const newSubSegmentsIncluded = [...new Set([...normalizedSubSegments.included, ...codeSubSegments])];

                  handleFilterChange({
                    ...filters,
                    subSegmentCodes: { included: newSegmentCodesIncluded, excluded: normalizedSegmentCodes.excluded },
                    subSegments: { included: newSubSegmentsIncluded, excluded: normalizedSubSegments.excluded },
                  });
                }
              };

              return (
                <Box
                  key={code}
                  sx={{
                    // Stagger effect for filter groups
                    ...keyframes.fadeInUp,
                    animation: mounted ? `fadeInUp 0.5s ${easing.elegant} ${itemIndex * 100}ms both` : "none",
                  }}
                >
                  <Box
                    draggable={!isCodeExcluded}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("segmentCode", code);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={handleClickIndivCode}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: 2,
                      px: 2,
                      py: 1,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: isCodeExcluded ? "not-allowed" : "grab",
                      backgroundColor: isCodeIncluded
                        ? "#E63946"
                        : isCodeExcluded
                          ? alpha("#999", 0.2)
                          : theme.palette.grey[200],
                      color: isCodeIncluded ? "white" : isCodeExcluded ? "#999" : theme.palette.text.primary,
                      opacity: isCodeExcluded ? 0.5 : 1,
                      "&:hover": {
                        backgroundColor: isCodeExcluded
                          ? alpha("#999", 0.2)
                          : isCodeIncluded
                            ? darken("#E63946", 0.1)
                            : alpha("#E63946", 0.15),
                      },
                      "&:active": {
                        cursor: isCodeExcluded ? "not-allowed" : "grabbing",
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                      <Box sx={{ wordWrap: "break-word", whiteSpace: "normal", flex: 1 }}>{code}</Box>
                      {selectedSubSegmentsCount > 0 && !allSubSegmentsSelected && (
                        <Chip
                          label={selectedSubSegmentsCount}
                          size="small"
                          sx={{
                            height: 18,
                            minWidth: 18,
                            fontSize: "0.7rem",
                            backgroundColor: isCodeIncluded ? "white" : "#E63946",
                            color: isCodeIncluded ? "#E63946" : "white",
                            "& .MuiChip-label": { px: 0.5 },
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {/* Expand button for sub-segments */}
                      {hasSubSegments && (
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSegmentCodes((prev) => ({ ...prev, [code]: !prev[code] }));
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
                              backgroundColor: "rgba(0, 0, 0, 0.1)",
                            },
                          }}
                        >
                          {isCodeExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  {/* Sub-segments dropdown - using lighter shades of segment color */}
                  {hasSubSegments && (
                    <Collapse in={isCodeExpanded} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          pl: 2,
                          pt: 0.5,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.25,
                          // Content fade-in animation
                          ...keyframes.fadeIn,
                          animation: isCodeExpanded ? `fadeIn 0.3s ${easing.standard}` : "none",
                        }}
                      >
                        {codeSubSegments.map((subSegment, subIndex) => {
                          // Check filter states (no cascade for inclusion display)
                          const isSubSegmentDirectlyIncluded = isIncluded(filters.subSegments, subSegment);
                          const isSubSegmentDirectlyExcluded = isExcluded(filters.subSegments, subSegment);

                          // Only show as selected if directly included (not via parent cascade)
                          const isSubIncluded = isSubSegmentDirectlyIncluded;
                          // Cascade exclusion only (for graying out)
                          const isSubExcluded = isSubSegmentDirectlyExcluded || isCodeExcluded;

                          // Handler for clicking on the label (include/uninclude)
                          const handleClickIndivSub = (e) => {
                            e.stopPropagation();
                            // Don't allow clicking if sub-segment is excluded
                            if (isSubExcluded) return;

                            if (isSubIncluded) {
                              // Remove sub-segment from included
                              let updatedFilters = { ...filters };
                              const newSubSegmentsValue = removeValue(filters.subSegments, subSegment);
                              updatedFilters.subSegments = newSubSegmentsValue;

                              // Also remove parent segment code if it's explicitly selected
                              if (isCodeDirectlyIncluded) {
                                const newSegmentCodeValue = removeValue(filters.subSegmentCodes, code);
                                updatedFilters.subSegmentCodes = newSegmentCodeValue;
                              }

                              handleFilterChange(updatedFilters);
                            } else {
                              // Add sub-segment to included
                              const newValue = includeValue(filters.subSegments, subSegment);
                              handleFilterChange({ ...filters, subSegments: newValue });
                            }
                          };

                          return (
                            <Box
                              key={subSegment}
                              draggable={!isSubExcluded}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("subSegment", subSegment);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={handleClickIndivSub}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                borderRadius: 1.5,
                                px: 1.5,
                                py: 0.5,
                                fontSize: "0.75rem",
                                cursor: isSubExcluded ? "not-allowed" : "grab",
                                backgroundColor: isSubIncluded
                                  ? "#FF6B73"
                                  : isSubExcluded
                                    ? alpha("#999", 0.2)
                                    : theme.palette.grey[100],
                                color: isSubIncluded ? "white" : isSubExcluded ? "#999" : theme.palette.text.primary,
                                fontWeight: isSubIncluded ? 600 : 500,
                                opacity: isSubExcluded ? 0.5 : 1,
                                "&:hover": {
                                  backgroundColor: isSubExcluded
                                    ? alpha("#999", 0.2)
                                    : isSubIncluded
                                      ? darken("#FF6B73", 0.1)
                                      : theme.palette.grey[200],
                                },
                                "&:active": {
                                  cursor: "grabbing",
                                },
                              }}
                            >
                              <Box sx={{ flex: 1 }}>{subSegment}</Box>
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
      </Box>
    </Box>
  );
};

// Set display name for the memoized component for better debugging
LeftSidebar.displayName = "LeftSidebar";

// Export memoized version to prevent unnecessary re-renders
export default React.memo(LeftSidebar);
