import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { SEGMENT_CODE_GROUPS } from "./segmentConstants";
import { keyframes, easing } from "../../styles/animations";
import { normalizeFilterValue } from "../../utils/filterHelpers";
import { useFilterStore } from "../../stores/useFilterStore";
import { useCrmData } from "../../queries/useCrmData";
import { useUIStore } from "../../stores/useUIStore";
import SegmentsHeader from "./SegmentsHeader";
import AmdGroupSection from "./AmdGroupSection";
import SegmentCodeItem from "./SegmentCodeItem";
import GradesSection from "./GradesSection";
import CategoriesSection from "./CategoriesSection";

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

const LeftSidebar = ({ activeTab }: { activeTab: number }) => {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const _handleFilterChange = useFilterStore((s) => s.handleFilterChange);
  const _handleToggleFilter = useFilterStore((s) => s.handleToggleFilter);
  const handleClearFilterType = useFilterStore((s) => s.handleClearFilterType);
  const segmentModes = useFilterStore((s) => s.segmentModes);
  const onSegmentModesChange = useFilterStore((s) => s.setSegmentModes) as any;
  const { filterOptions, segmentToSubSegmentMap, serviceToOfferingMap } = useCrmData();

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
  const expandedSegmentGroups = useUIStore((s) => s.expandedSegmentGroups);
  const setExpandedSegmentGroups = useUIStore((s) => s.setExpandedSegmentGroups);
  const expandedSegmentCodes = useUIStore((s) => s.expandedSegmentCodes);
  const setExpandedSegmentCodes = useUIStore((s) => s.setExpandedSegmentCodes);
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expandedStaffingGroups, setExpandedStaffingGroups] = useState({
    grades: true,
    teams: true,
    categories: false,
  });
  const [expandedCatGroups, setExpandedCatGroups] = useState<Record<string, boolean>>({});
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get excluded items (for checking if items are excluded, even though exclusion zone is in RightSidebar)
  const excludedSegmentCodes = useMemo(
    () => normalizeFilterValue(filters.subSegmentCodes).excluded || [],
    [filters.subSegmentCodes]
  );

  // Handler to expand one level (AMD group -> segment codes -> sub-segments)
  const handleExpandLevel = useCallback(() => {
    const allSegmentCodes = filterOptions.subSegmentCodes || [];

    // Check if AMD group is collapsed
    const amdGroupCollapsed = !expandedSegmentGroups.AMD;

    if (amdGroupCollapsed) {
      // Level 0 -> Level 1: Open AMD group
      setExpandedSegmentGroups({ AMD: true });
    } else {
      // Level 1 -> Level 2: Open all segment codes
      const newExpandedSegmentCodes: Record<string, boolean> = {};
      allSegmentCodes.forEach((code) => {
        newExpandedSegmentCodes[code] = true;
      });
      setExpandedSegmentCodes(newExpandedSegmentCodes);
    }
  }, [filterOptions.subSegmentCodes, expandedSegmentGroups.AMD, setExpandedSegmentGroups, setExpandedSegmentCodes]);

  // Handler to collapse one level (sub-segments -> segment codes -> AMD group)
  const handleCollapseLevel = useCallback(() => {
    // Check if any segment codes are expanded
    const anyCodeExpanded = Object.values(expandedSegmentCodes).some((expanded) => expanded);

    if (anyCodeExpanded) {
      // Level 2 -> Level 1: Close all segment codes
      setExpandedSegmentCodes({});
    } else {
      // Level 1 -> Level 0: Close AMD group
      setExpandedSegmentGroups({});
    }
  }, [expandedSegmentCodes, setExpandedSegmentCodes, setExpandedSegmentGroups]);

  // Staffing filter computations (used when activeTab === 2)
  const excludedMacroGrades = useMemo(
    () => normalizeFilterValue(filters.macroGrades).excluded || [],
    [filters.macroGrades]
  );
  const includedMacroGrades = useMemo(
    () => normalizeFilterValue(filters.macroGrades).included || [],
    [filters.macroGrades]
  );
  const excludedMacroCategories = useMemo(
    () => normalizeFilterValue(filters.macroCategories).excluded || [],
    [filters.macroCategories]
  );
  const includedMacroCategories = useMemo(
    () => normalizeFilterValue(filters.macroCategories).included || [],
    [filters.macroCategories]
  );

  // Individual segment codes (not in AMD group)
  const individualCodes = useMemo(
    () =>
      (filterOptions.subSegmentCodes || []).filter(
        (code) => !SEGMENT_CODE_GROUPS.AMD.include.some((inc) => code.toUpperCase() === inc.toUpperCase())
      ),
    [filterOptions.subSegmentCodes]
  );

  const hasSegmentCodes = (filterOptions.subSegmentCodes || []).length > 0;

  return (
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
      {hasSegmentCodes && (
        <SegmentsHeader
          filters={filters}
          handleFilterChange={handleFilterChange}
          handleExpandLevel={handleExpandLevel}
          handleCollapseLevel={handleCollapseLevel}
        />
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
        {/* Segment Code Groups - AMD group and individual codes (only with opportunity data) */}
        {hasSegmentCodes && (
          <Box
            onContextMenu={(e) => e.preventDefault()}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}
          >
            {/* AMD Group */}
            <AmdGroupSection
              filters={filters}
              filterOptions={filterOptions}
              handleFilterChange={handleFilterChange}
              expandedSegmentGroups={expandedSegmentGroups}
              setExpandedSegmentGroups={setExpandedSegmentGroups}
              expandedSegmentCodes={expandedSegmentCodes}
              setExpandedSegmentCodes={setExpandedSegmentCodes}
              segmentToSubSegmentMap={segmentToSubSegmentMap}
              segmentModes={segmentModes}
              onSegmentModesChange={onSegmentModesChange}
              excludedSegmentCodes={excludedSegmentCodes}
              isDraggingRef={isDraggingRef}
              mounted={mounted}
            />

            {/* Individual Segment Codes (not in AMD group) */}
            {individualCodes.map((code, codeIndex) => (
              <SegmentCodeItem
                key={code}
                code={code}
                filters={filters}
                handleFilterChange={handleFilterChange}
                segmentToSubSegmentMap={segmentToSubSegmentMap}
                expandedSegmentCodes={expandedSegmentCodes}
                setExpandedSegmentCodes={setExpandedSegmentCodes}
                segmentModes={segmentModes}
                onSegmentModesChange={onSegmentModesChange}
                isDraggingRef={isDraggingRef}
                isGroupChild={false}
                animIndex={codeIndex + 1}
                mounted={mounted}
              />
            ))}
          </Box>
        )}

        {/* Staffing filters (only when Staffing tab is active) */}
        {activeTab === 2 && (
          <>
            <GradesSection
              filters={filters}
              setFilters={setFilters}
              includedMacroGrades={includedMacroGrades}
              excludedMacroGrades={excludedMacroGrades}
              expandedStaffingGroups={expandedStaffingGroups}
              setExpandedStaffingGroups={setExpandedStaffingGroups}
            />
            <CategoriesSection
              filters={filters}
              setFilters={setFilters}
              includedMacroCategories={includedMacroCategories}
              excludedMacroCategories={excludedMacroCategories}
              expandedCatGroups={expandedCatGroups}
              setExpandedCatGroups={setExpandedCatGroups}
            />
          </>
        )}
      </Box>
    </Box>
  );
};

// Set display name for the memoized component for better debugging
LeftSidebar.displayName = "LeftSidebar";

// Export memoized version to prevent unnecessary re-renders
export default React.memo(LeftSidebar);
