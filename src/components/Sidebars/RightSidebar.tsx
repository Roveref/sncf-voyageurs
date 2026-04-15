import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { alpha, useTheme } from "@mui/material/styles";
import { keyframes, easing } from "../../styles/animations";
import { getIncludedValues, normalizeFilterValue } from "../../utils/filterHelpers";
import { useFilterStore, useActiveFilterCount } from "../../stores/useFilterStore";
import { useCrmData } from "../../queries/useCrmData";
import { useUIStore } from "../../stores/useUIStore";
import { SEGMENT_CODE_GROUPS } from "./segmentConstants";
import { SERVICE_LINE_GROUPS } from "./serviceLineConstants";
import UnitGroupList from "./UnitGroupList";
import ExclusionZone from "./ExclusionZone";
import FilterSummaryDialog from "./FilterSummaryDialog";

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
 */
const RightSidebar = () => {
  const theme = useTheme();
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const _handleFilterChange = useFilterStore((s) => s.handleFilterChange);
  const _handleToggleFilter = useFilterStore((s) => s.handleToggleFilter);
  const handleClearFilterType = useFilterStore((s) => s.handleClearFilterType);
  const onClearAllFilters = useFilterStore((s) => s.handleClearAllFilters);
  const segmentModes = useFilterStore((s) => s.segmentModes);
  const onSegmentModesChange = useFilterStore((s) => s.setSegmentModes);
  const serviceLineModes = useFilterStore((s) => s.serviceLineModes);
  const onServiceLineModesChange = useFilterStore((s) => s.setServiceLineModes);
  const activeFilterCount = useActiveFilterCount();
  const { filterOptions, serviceToOfferingMap, segmentToSubSegmentMap } = useCrmData();
  const expandedGroups = useUIStore((s) => s.expandedGroups);
  const setExpandedGroups = useUIStore((s) => s.setExpandedGroups);
  const expandedServiceLines = useUIStore((s) => s.expandedServiceLines);
  const setExpandedServiceLines = useUIStore((s) => s.setExpandedServiceLines);
  const [mounted, setMounted] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const isDraggingRef = useRef(false);

  // Bind maps so child components receive the correct signature (Record<string, unknown>) => void
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>) =>
      _handleFilterChange(newFilters, segmentToSubSegmentMap, serviceToOfferingMap),
    [_handleFilterChange, segmentToSubSegmentMap, serviceToOfferingMap]
  );
  const handleToggleFilter = useCallback(
    (type: string, value: string) => _handleToggleFilter(type, value, segmentToSubSegmentMap, serviceToOfferingMap),
    [_handleToggleFilter, segmentToSubSegmentMap, serviceToOfferingMap]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handler to expand one level (groups -> service lines -> offerings)
  const handleExpandLevel = useCallback(() => {
    const groupKeys = Object.keys(SERVICE_LINE_GROUPS);
    const allServiceLines = filterOptions.serviceLine1 || [];

    // Check if all groups are collapsed
    const allGroupsCollapsed = groupKeys.every((key) => !expandedGroups[key]);

    if (allGroupsCollapsed) {
      // Level 0 -> Level 1: Open all groups
      const newExpandedGroups: Record<string, boolean> = {};
      groupKeys.forEach((key) => {
        newExpandedGroups[key] = true;
      });
      setExpandedGroups(newExpandedGroups);
    } else {
      // Level 1 -> Level 2: Open all service lines
      const newExpandedServiceLines: Record<string, boolean> = {};
      allServiceLines.forEach((line) => {
        newExpandedServiceLines[line] = true;
      });
      setExpandedServiceLines(newExpandedServiceLines);
    }
  }, [SERVICE_LINE_GROUPS, filterOptions, expandedGroups, setExpandedGroups, setExpandedServiceLines]);

  // Handler to collapse one level (offerings -> service lines -> groups)
  const handleCollapseLevel = useCallback(() => {
    const groupKeys = Object.keys(SERVICE_LINE_GROUPS);
    const allServiceLines = filterOptions.serviceLine1 || [];

    // Check if any service lines are expanded
    const anyServiceLineExpanded = Object.values(expandedServiceLines).some((expanded) => expanded);

    if (anyServiceLineExpanded) {
      // Level 2 -> Level 1: Close all service lines
      setExpandedServiceLines({});
    } else {
      // Level 1 -> Level 0: Close all groups
      setExpandedGroups({});
    }
  }, [expandedServiceLines, setExpandedServiceLines, setExpandedGroups]);

  // Get excluded items for the exclusion zone
  const {
    excludedServiceLines,
    excludedServiceOfferings,
    excludedAccounts,
    excludedTechnologyPartners,
    excludedPeople,
    excludedSegmentCodesAll,
    excludedSubSegments,
    excludedMacroGrades,
    excludedMacroCategories,
    excludedGroups,
    individualExcludedLines,
    excludedSegmentGroups,
    individualExcludedSegmentCodes,
  } = useMemo(() => {
    const excludedServiceLines = normalizeFilterValue(filters.serviceLine1).excluded || [];
    const excludedServiceOfferingsAll = normalizeFilterValue(filters.serviceOfferings).excluded || [];
    const excludedAccounts = normalizeFilterValue(filters.accounts).excluded || [];
    const excludedTechnologyPartners = normalizeFilterValue(filters.technologyPartners).excluded || [];
    const excludedPeople = normalizeFilterValue(filters.people).excluded || [];
    const excludedSegmentCodesAll = normalizeFilterValue(filters.subSegmentCodes).excluded || [];
    const excludedSubSegmentsAll = normalizeFilterValue(filters.subSegments).excluded || [];
    const excludedMacroGrades = normalizeFilterValue(filters.macroGrades).excluded || [];
    const excludedMacroCategories = normalizeFilterValue(filters.macroCategories).excluded || [];

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

    // Calculate which segment code groups are fully excluded (e.g. AMD = LSC + IEM + AUTO)
    const excludedSegmentGroups: { key: string; name: string; codes: string[] }[] = [];
    const individualExcludedSegmentCodes: string[] = [];

    Object.entries(SEGMENT_CODE_GROUPS).forEach(([groupKey, groupConfig]) => {
      const groupCodes: string[] = (groupConfig as { include?: string[] }).include || [];
      const matchingExcluded = groupCodes.filter((code: string) =>
        excludedSegmentCodesAll.some((exc: string) => exc.toUpperCase() === code.toUpperCase())
      );
      if (matchingExcluded.length > 0 && matchingExcluded.length === groupCodes.length) {
        // All codes in group are excluded -- show as group
        const actualExcluded = excludedSegmentCodesAll.filter((exc: string) =>
          groupCodes.some((gc: string) => gc.toUpperCase() === exc.toUpperCase())
        );
        excludedSegmentGroups.push({
          key: groupKey,
          name: (groupConfig as { name: string }).name,
          codes: actualExcluded,
        });
      }
    });

    const segmentGroupExcludedCodes = excludedSegmentGroups.flatMap((g) => g.codes);
    excludedSegmentCodesAll.forEach((code) => {
      if (!segmentGroupExcludedCodes.includes(code)) {
        individualExcludedSegmentCodes.push(code);
      }
    });

    // Calculate which service line groups are fully excluded
    const excludedGroups: { key: string; name: string; lines: string[] }[] = [];
    const individualExcludedLines: string[] = [];

    Object.entries(SERVICE_LINE_GROUPS as Record<string, any>).forEach(([groupKey, groupConfig]) => {
      const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line) => {
        const lineLower = line.toLowerCase();
        if (groupConfig.include) {
          return groupConfig.include.some((inc: string) => lineLower.includes(inc.toLowerCase()));
        } else if (groupConfig.exclude) {
          return !groupConfig.exclude.some((exc: string) => lineLower.includes(exc.toLowerCase()));
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

    return {
      excludedServiceLines,
      excludedServiceOfferings,
      excludedAccounts,
      excludedTechnologyPartners,
      excludedPeople,
      excludedSegmentCodesAll,
      excludedSubSegments,
      excludedMacroGrades,
      excludedMacroCategories,
      excludedGroups,
      individualExcludedLines,
      excludedSegmentGroups,
      individualExcludedSegmentCodes,
    };
  }, [filters, filterOptions, SERVICE_LINE_GROUPS, segmentToSubSegmentMap, SEGMENT_CODE_GROUPS]);

  return (
    <>
      <Box
        sx={{
          p: 3,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          // Fade in synced with card fadeInUp (same duration + easing, no delay)
          animation: "fadeIn 0.6s cubic-bezier(0.23, 1, 0.32, 1) both",
          ...keyframes.fadeIn,
        }}
      >
        {/* Unit Header */}
        {(filterOptions.serviceLine1 || []).length > 0 && (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
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
            <Divider sx={{ mb: 1.5, borderColor: theme.palette.secondary.light }} />
          </>
        )}

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
          {/* Unit Groups - Expandable (only with opportunity data) */}
          <UnitGroupList
            theme={theme}
            filters={filters}
            filterOptions={filterOptions as any}
            expandedGroups={expandedGroups}
            expandedServiceLines={expandedServiceLines}
            serviceToOfferingMap={serviceToOfferingMap}
            SERVICE_LINE_GROUPS={SERVICE_LINE_GROUPS}
            handleFilterChange={handleFilterChange as any}
            setFilters={setFilters}
            setExpandedGroups={setExpandedGroups}
            setExpandedServiceLines={setExpandedServiceLines}
            serviceLineModes={serviceLineModes as any}
            onServiceLineModesChange={onServiceLineModesChange as any}
            excludedServiceLines={excludedServiceLines}
            isDraggingRef={isDraggingRef}
          />
        </Box>

        {/* Exclusion Zone - Fixed at bottom with blur effect */}
        <ExclusionZone
          theme={theme}
          filters={filters}
          setFilters={setFilters}
          serviceToOfferingMap={serviceToOfferingMap}
          segmentToSubSegmentMap={segmentToSubSegmentMap}
          serviceLineModes={serviceLineModes as any}
          onServiceLineModesChange={onServiceLineModesChange as any}
          segmentModes={segmentModes as any}
          onSegmentModesChange={onSegmentModesChange as any}
          activeFilterCount={activeFilterCount}
          onFilterModalOpen={() => setFilterModalOpen(true)}
          excludedServiceLines={excludedServiceLines}
          excludedServiceOfferings={excludedServiceOfferings}
          excludedAccounts={excludedAccounts}
          excludedTechnologyPartners={excludedTechnologyPartners}
          excludedPeople={excludedPeople}
          excludedSegmentCodesAll={excludedSegmentCodesAll}
          excludedSubSegments={excludedSubSegments}
          excludedMacroGrades={excludedMacroGrades}
          excludedMacroCategories={excludedMacroCategories}
          excludedGroups={excludedGroups}
          individualExcludedLines={individualExcludedLines}
          excludedSegmentGroups={excludedSegmentGroups}
          individualExcludedSegmentCodes={individualExcludedSegmentCodes}
        />
      </Box>

      {/* Filter summary modal */}
      <FilterSummaryDialog
        theme={theme}
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        setFilters={setFilters}
        segmentModes={segmentModes as any}
        onSegmentModesChange={onSegmentModesChange as any}
        serviceLineModes={serviceLineModes as any}
        onServiceLineModesChange={onServiceLineModesChange as any}
        onClearAllFilters={onClearAllFilters}
        segmentToSubSegmentMap={segmentToSubSegmentMap}
        serviceToOfferingMap={serviceToOfferingMap}
      />
    </>
  );
};

// Performance optimization: Memoize component to prevent unnecessary re-renders
// Only re-renders when props actually change
RightSidebar.displayName = "RightSidebar";

export default React.memo(RightSidebar);
