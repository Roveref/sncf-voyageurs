import React, { memo, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { alpha, darken, useTheme } from "@mui/material/styles";
import { SEGMENT_CODE_GROUPS } from "./segmentConstants";
import { keyframes, easing } from "../../styles/animations";
import { getIncludedValues, normalizeFilterValue } from "../../utils/filterHelpers";
import { SX_FLEX_ROW } from "./sidebarConstants";
import SegmentCodeItem from "./SegmentCodeItem";

interface AmdGroupSectionProps {
  filters: any;
  filterOptions: any;
  handleFilterChange: (filters: any) => void;
  expandedSegmentGroups: Record<string, boolean>;
  setExpandedSegmentGroups: (fn: any) => void;
  expandedSegmentCodes: Record<string, boolean>;
  setExpandedSegmentCodes: (fn: any) => void;
  segmentToSubSegmentMap: Record<string, string[]>;
  segmentModes: Map<string, string>;
  onSegmentModesChange?: (fn: (prev: Map<string, string>) => Map<string, string>) => void;
  excludedSegmentCodes: string[];
  isDraggingRef: React.MutableRefObject<boolean>;
  mounted: boolean;
}

const AmdGroupSection = memo(
  ({
    filters,
    filterOptions,
    handleFilterChange,
    expandedSegmentGroups,
    setExpandedSegmentGroups,
    expandedSegmentCodes,
    setExpandedSegmentCodes,
    segmentToSubSegmentMap,
    segmentModes,
    onSegmentModesChange,
    excludedSegmentCodes,
    isDraggingRef,
    mounted,
  }: AmdGroupSectionProps) => {
    const theme = useTheme();
    const groupConfig = SEGMENT_CODE_GROUPS.AMD;

    const groupCodes = useMemo(
      () =>
        (filterOptions.subSegmentCodes || []).filter((code: string) =>
          groupConfig.include.some((inc: string) => code.toUpperCase() === inc.toUpperCase())
        ),
      [filterOptions.subSegmentCodes, groupConfig.include]
    );

    const selectedCodes = getIncludedValues(filters.subSegmentCodes);
    const selectedCount = groupCodes.filter((code: string) => selectedCodes.includes(code)).length;

    const isExpanded = expandedSegmentGroups.AMD;

    // Check if all codes in this group are excluded
    const allExcludedInGroup =
      groupCodes.length > 0 && groupCodes.every((code: string) => excludedSegmentCodes.includes(code));

    // Active codes = not excluded
    const activeCodes = useMemo(
      () => groupCodes.filter((c: string) => !excludedSegmentCodes.includes(c)),
      [groupCodes, excludedSegmentCodes]
    );
    const allSelected = activeCodes.length > 0 && activeCodes.every((c: string) => selectedCodes.includes(c));

    // 4-state logic for AMD group
    const selectedActiveCodes = useMemo(
      () => activeCodes.filter((c: string) => selectedCodes.includes(c)),
      [activeCodes, selectedCodes]
    );
    const allTeamMode =
      selectedActiveCodes.length > 0 && selectedActiveCodes.every((c: string) => segmentModes.get(c) === "team");
    const allBothMode =
      selectedActiveCodes.length > 0 && selectedActiveCodes.every((c: string) => segmentModes.get(c) === "both");

    const setGroupModes = useCallback(
      (mode: "team" | "both" | null) => {
        onSegmentModesChange?.((prev) => {
          const next = new Map(prev);
          activeCodes.forEach((c: string) => {
            if (mode) next.set(c, mode);
            else next.delete(c);
          });
          return next;
        });
      },
      [activeCodes, onSegmentModesChange]
    );

    const selectAllGroupCodes = useCallback(() => {
      const normalized = normalizeFilterValue(filters.subSegmentCodes);
      const newIncluded = [...new Set([...normalized.included, ...activeCodes])];
      handleFilterChange({
        ...filters,
        subSegmentCodes: { included: newIncluded, excluded: normalized.excluded },
      });
    }, [activeCodes, filters, handleFilterChange]);

    const deselectAllGroupCodes = useCallback(() => {
      const normalized = normalizeFilterValue(filters.subSegmentCodes);
      const newIncluded = normalized.included.filter((code: string) => !activeCodes.includes(code));
      handleFilterChange({
        ...filters,
        subSegmentCodes: { included: newIncluded, excluded: normalized.excluded },
      });
    }, [activeCodes, filters, handleFilterChange]);

    const handleGroupClick = useCallback(() => {
      if (allExcludedInGroup) return;
      if (!allSelected) {
        selectAllGroupCodes();
        setGroupModes(null);
      } else if (allTeamMode) setGroupModes("both");
      else if (allBothMode) setGroupModes(null);
      else {
        deselectAllGroupCodes();
        setGroupModes(null);
      }
    }, [
      allExcludedInGroup,
      allSelected,
      allTeamMode,
      allBothMode,
      selectAllGroupCodes,
      deselectAllGroupCodes,
      setGroupModes,
    ]);

    const handleGroupRightClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        if (allExcludedInGroup) return;
        if (!allSelected) {
          selectAllGroupCodes();
          setGroupModes("team");
        } else if (allTeamMode) {
          deselectAllGroupCodes();
          setGroupModes(null);
        } else if (allBothMode) setGroupModes("team");
        else setGroupModes("both");
      },
      [
        allExcludedInGroup,
        allSelected,
        allTeamMode,
        allBothMode,
        selectAllGroupCodes,
        deselectAllGroupCodes,
        setGroupModes,
      ]
    );

    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedSegmentGroups((prev: any) => ({ ...prev, AMD: !prev.AMD }));
      },
      [setExpandedSegmentGroups]
    );

    // Hide group entirely when no matching codes exist in data
    if (groupCodes.length === 0) return null;

    // Detect heterogeneous modes among active codes
    const modesInGroup = new Set(selectedActiveCodes.map((c: string) => segmentModes.get(c) || "opp"));
    const isHeterogeneous = selectedActiveCodes.length > 0 && modesInGroup.size > 1;

    // Visual: homogeneous -> solid color, heterogeneous -> gradient
    let grpBg: string, grpColor: string, grpBorder: string, grpBoxShadow: string;
    if (allExcludedInGroup) {
      grpBg = alpha("#999", 0.2);
      grpColor = "#999";
      grpBorder = "2px solid transparent";
      grpBoxShadow = "none";
    } else if (isHeterogeneous) {
      grpBg = `repeating-linear-gradient(45deg, ${groupConfig.color}, ${groupConfig.color} 2px, ${alpha(groupConfig.color, 0.15)} 2px, ${alpha(groupConfig.color, 0.15)} 4px)`;
      grpColor = "white";
      grpBorder = `2px solid ${groupConfig.color}`;
      grpBoxShadow = "none";
    } else if (allBothMode) {
      grpBg = groupConfig.color;
      grpColor = "white";
      grpBorder = `2px solid ${groupConfig.color}`;
      grpBoxShadow = "inset 0 0 0 2px white";
    } else if (allTeamMode) {
      grpBg = "transparent";
      grpColor = groupConfig.color;
      grpBorder = `2px solid ${groupConfig.color}`;
      grpBoxShadow = "none";
    } else if (allSelected) {
      grpBg = groupConfig.color;
      grpColor = "white";
      grpBorder = "2px solid transparent";
      grpBoxShadow = "none";
    } else {
      grpBg = theme.palette.grey[200];
      grpColor = theme.palette.text.primary;
      grpBorder = "2px solid transparent";
      grpBoxShadow = "none";
    }

    return (
      <Box
        key="AMD"
        sx={{
          ...keyframes.fadeInUp,
          animation: mounted ? `fadeInUp 0.5s ${easing.elegant} 0ms both` : "none",
        }}
      >
        {/* AMD Group Header */}
        <Box
          draggable
          onDragStart={(e) => {
            isDraggingRef.current = true;
            e.dataTransfer.setData("segmentCodeGroup", JSON.stringify(groupCodes));
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
            ...(isHeterogeneous && !allExcludedInGroup ? { background: grpBg } : { backgroundColor: grpBg }),
            color: grpColor,
            opacity: allExcludedInGroup ? 0.5 : 1,
            cursor: allExcludedInGroup ? "not-allowed" : "grab",
            border: grpBorder,
            boxShadow: grpBoxShadow,
            "&:hover": {
              ...(isHeterogeneous && !allExcludedInGroup
                ? { opacity: 0.85 }
                : {
                    backgroundColor: allExcludedInGroup
                      ? alpha("#999", 0.2)
                      : allTeamMode
                        ? alpha(groupConfig.color, 0.08)
                        : allSelected
                          ? darken(groupConfig.color, 0.1)
                          : alpha(groupConfig.color, 0.15),
                  }),
            },
            "&:active": {
              cursor: allExcludedInGroup ? "not-allowed" : "grabbing",
            },
          }}
        >
          <Box sx={SX_FLEX_ROW}>
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
              ...keyframes.fadeIn,
              animation: isExpanded ? `fadeIn 0.3s ${easing.standard}` : "none",
            }}
          >
            {groupCodes.map((code: string) => (
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
                isGroupChild
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    );
  }
);

AmdGroupSection.displayName = "AmdGroupSection";

export default AmdGroupSection;
