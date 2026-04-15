import React, { memo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { alpha, darken } from "@mui/material/styles";
import { getIncludedValues, normalizeFilterValue } from "../../utils/filterHelpers";
import type { Filters } from "../../utils/filterHelpers";
import type { Theme } from "@mui/material/styles";
import ServiceLineItem from "./ServiceLineItem";

interface ServiceLineGroupConfig {
  name: string;
  color: string;
  include?: string[];
  exclude?: string[];
}

interface UnitGroupListProps {
  theme: Theme;
  filters: Filters;
  filterOptions: Record<string, string[]>;
  expandedGroups: Record<string, boolean>;
  expandedServiceLines: Record<string, boolean>;
  serviceToOfferingMap: Record<string, string[]>;
  SERVICE_LINE_GROUPS: Record<string, ServiceLineGroupConfig>;
  handleFilterChange: (filters: Filters) => void;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  setExpandedGroups: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setExpandedServiceLines: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  serviceLineModes: Map<string, string>;
  onServiceLineModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  excludedServiceLines: string[];
  isDraggingRef: React.MutableRefObject<boolean>;
}

const UnitGroupList = memo(
  ({
    theme,
    filters,
    filterOptions,
    expandedGroups,
    expandedServiceLines,
    serviceToOfferingMap,
    SERVICE_LINE_GROUPS,
    handleFilterChange,
    setFilters,
    setExpandedGroups,
    setExpandedServiceLines,
    serviceLineModes,
    onServiceLineModesChange,
    excludedServiceLines,
    isDraggingRef,
  }: UnitGroupListProps) => {
    if ((filterOptions.serviceLine1 || []).length === 0) return null;

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
        {Object.entries(SERVICE_LINE_GROUPS).map(([groupKey, groupConfig]) => {
          // Get the service lines that belong to this group (case-insensitive matching)
          const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line: string) => {
            const lineLower = line.toLowerCase();
            if (groupConfig.include) {
              return groupConfig.include.some((inc: string) => lineLower.includes(inc.toLowerCase()));
            } else if (groupConfig.exclude) {
              return !groupConfig.exclude.some((exc: string) => lineLower.includes(exc.toLowerCase()));
            }
            return false;
          });

          // Hide group entirely when no matching service lines exist in data
          if (groupServiceLines.length === 0) return null;

          // Count how many service lines in this group are selected
          const selectedServiceLines = getIncludedValues(filters.serviceLine1);
          const selectedCount = groupServiceLines.filter((line: string) => selectedServiceLines.includes(line)).length;

          const isExpanded = expandedGroups[groupKey];
          const allSelected = groupServiceLines.length > 0 && selectedCount === groupServiceLines.length;

          // Check if all service lines in this group are excluded
          const allExcludedInGroup =
            groupServiceLines.length > 0 &&
            groupServiceLines.every((line: string) => excludedServiceLines.includes(line));

          // Active (non-excluded) service lines in this group
          const activeLinesInGroup = groupServiceLines.filter((l: string) => !excludedServiceLines.includes(l));
          const selectedActiveLines = activeLinesInGroup.filter((l: string) => selectedServiceLines.includes(l));

          // Mode detection for group button visual
          const modesInGroup = new Set(selectedActiveLines.map((l: string) => serviceLineModes.get(l) || "opp"));
          const isGroupHeterogeneous = selectedActiveLines.length > 0 && modesInGroup.size > 1;
          const allGroupTeamMode =
            selectedActiveLines.length > 0 && modesInGroup.size === 1 && modesInGroup.has("team");
          const allGroupBothMode =
            selectedActiveLines.length > 0 && modesInGroup.size === 1 && modesInGroup.has("both");

          // Helper to set mode on all active lines in group
          const setGroupModes = (mode: string | null) => {
            onServiceLineModesChange?.((prev: Map<string, string>) => {
              const next = new Map(prev);
              activeLinesInGroup.forEach((l: string) => {
                if (mode) next.set(l, mode);
                else next.delete(l);
              });
              return next;
            });
          };

          // 4-state left-click handler for group
          const handleGroupClick = () => {
            if (allExcludedInGroup) return;
            const normalized = normalizeFilterValue(filters.serviceLine1);
            const currentIncluded = normalized.included;
            const allActiveSelected =
              activeLinesInGroup.length > 0 &&
              activeLinesInGroup.every((l: string) => selectedServiceLines.includes(l));

            if (!allActiveSelected) {
              const newIncluded = [...new Set([...currentIncluded, ...activeLinesInGroup])];
              handleFilterChange({
                ...filters,
                serviceLine1: {
                  included: newIncluded,
                  excluded: normalized.excluded,
                },
              });
              setGroupModes(null);
            } else if (allGroupTeamMode) {
              setGroupModes("both");
            } else if (allGroupBothMode) {
              setGroupModes(null);
            } else {
              const newIncluded = currentIncluded.filter((l: string) => !activeLinesInGroup.includes(l));
              handleFilterChange({
                ...filters,
                serviceLine1: {
                  included: newIncluded,
                  excluded: normalized.excluded,
                },
              });
              setGroupModes(null);
            }
          };

          // 4-state right-click handler for group
          const handleGroupRightClick = (e: React.MouseEvent) => {
            if (e.button !== 2) return;
            e.preventDefault();
            e.stopPropagation();
            if (allExcludedInGroup) return;
            const normalized = normalizeFilterValue(filters.serviceLine1);
            const currentIncluded = normalized.included;
            const allActiveSelected =
              activeLinesInGroup.length > 0 &&
              activeLinesInGroup.every((l: string) => selectedServiceLines.includes(l));

            if (!allActiveSelected) {
              const newIncluded = [...new Set([...currentIncluded, ...activeLinesInGroup])];
              handleFilterChange({
                ...filters,
                serviceLine1: {
                  included: newIncluded,
                  excluded: normalized.excluded,
                },
              });
              setGroupModes("team");
            } else if (allGroupTeamMode) {
              const newIncluded = currentIncluded.filter((l: string) => !activeLinesInGroup.includes(l));
              handleFilterChange({
                ...filters,
                serviceLine1: {
                  included: newIncluded,
                  excluded: normalized.excluded,
                },
              });
              setGroupModes(null);
            } else if (allGroupBothMode) {
              setGroupModes("team");
            } else {
              setGroupModes("both");
            }
          };

          // Handler to expand/collapse (only for arrow click)
          const handleExpandClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedGroups((prev: Record<string, boolean>) => ({
              ...prev,
              [groupKey]: !prev[groupKey],
            }));
          };

          return (
            <Box key={groupKey}>
              {/* Group Header - Click to select all (arrow to expand) */}
              <Box
                draggable
                onDragStart={(e) => {
                  isDraggingRef.current = true;
                  e.dataTransfer.setData("serviceLineGroup", JSON.stringify(groupServiceLines));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 50);
                }}
                onClick={() => {
                  if (!isDraggingRef.current) handleGroupClick();
                }}
                onMouseDown={handleGroupRightClick}
                onContextMenu={(e) => e.preventDefault()}
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
                    : isGroupHeterogeneous
                      ? `repeating-linear-gradient(45deg, ${groupConfig.color}, ${groupConfig.color} 2px, ${alpha(groupConfig.color, 0.15)} 2px, ${alpha(groupConfig.color, 0.15)} 4px)`
                      : allGroupBothMode
                        ? groupConfig.color
                        : allGroupTeamMode
                          ? "transparent"
                          : allSelected
                            ? groupConfig.color
                            : theme.palette.grey[200],
                  color: allExcludedInGroup
                    ? "#999"
                    : allGroupTeamMode
                      ? groupConfig.color
                      : allSelected
                        ? "white"
                        : theme.palette.text.primary,
                  border:
                    !allExcludedInGroup && (allGroupTeamMode || allGroupBothMode)
                      ? `2px solid ${groupConfig.color}`
                      : "2px solid transparent",
                  boxShadow: !allExcludedInGroup && allGroupBothMode ? "inset 0 0 0 2px white" : "none",
                  opacity: allExcludedInGroup ? 0.5 : 1,
                  cursor: allExcludedInGroup ? "not-allowed" : "grab",
                  "&:hover": {
                    backgroundColor: allExcludedInGroup
                      ? alpha("#999", 0.2)
                      : allGroupTeamMode
                        ? alpha(groupConfig.color, 0.08)
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
                <Box
                  sx={{
                    pl: 2,
                    pt: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {groupServiceLines
                    .sort((a, b) => a.localeCompare(b))
                    .map((line) => (
                      <ServiceLineItem
                        key={line}
                        line={line}
                        theme={theme}
                        filters={filters}
                        expandedServiceLines={expandedServiceLines}
                        serviceToOfferingMap={serviceToOfferingMap}
                        handleFilterChange={handleFilterChange}
                        setFilters={setFilters}
                        setExpandedServiceLines={setExpandedServiceLines}
                        serviceLineModes={serviceLineModes}
                        onServiceLineModesChange={onServiceLineModesChange}
                        excludedServiceLines={excludedServiceLines}
                        isDraggingRef={isDraggingRef}
                      />
                    ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    );
  }
);

UnitGroupList.displayName = "UnitGroupList";

export default UnitGroupList;
