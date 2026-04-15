import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { alpha, darken, useTheme } from "@mui/material/styles";
import { keyframes, easing } from "../../styles/animations";
import { normalizeFilterValue, isIncluded, isExcluded, includeValue, removeValue } from "../../utils/filterHelpers";
import {
  SX_FLEX_ROW_GAP05,
  SX_FLEX_ROW_FLEX1,
  SX_WORD_WRAP,
  SX_EXPAND_BTN,
  SX_FLEX_COL_GAP05,
} from "./sidebarConstants";
import SubSegmentItem from "./SubSegmentItem";

interface SegmentCodeItemProps {
  code: string;
  filters: any;
  handleFilterChange: (filters: any) => void;
  segmentToSubSegmentMap: Record<string, string[]>;
  expandedSegmentCodes: Record<string, boolean>;
  setExpandedSegmentCodes: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  segmentModes: Map<string, string>;
  onSegmentModesChange?: (fn: (prev: Map<string, string>) => Map<string, string>) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
  /** Whether this code is inside a group (uses lighter style) or standalone (uses bolder style) */
  isGroupChild?: boolean;
  /** Animation index for stagger effect */
  animIndex?: number;
  /** Whether mount animation is active */
  mounted?: boolean;
}

const SegmentCodeItem = memo(
  ({
    code,
    filters,
    handleFilterChange,
    segmentToSubSegmentMap,
    expandedSegmentCodes,
    setExpandedSegmentCodes,
    segmentModes,
    onSegmentModesChange,
    isDraggingRef,
    isGroupChild = false,
    animIndex,
    mounted,
  }: SegmentCodeItemProps) => {
    const theme = useTheme();

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
    const allSubSegmentsSelected = codeSubSegments.length > 0 && selectedSubSegmentsCount === codeSubSegments.length;

    // Show code as selected if either directly included OR all its sub-segments are selected
    const isCodeIncluded = isCodeDirectlyIncluded || allSubSegmentsSelected;

    // Handler for clicking on the label (include/uninclude)
    const handleClickCode = useCallback(() => {
      if (isCodeExcluded) return;

      if (isCodeDirectlyIncluded) {
        const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
        const normalizedSubSegments = normalizeFilterValue(filters.subSegments);
        const newSegmentCodesIncluded = normalizedSegmentCodes.included.filter((c: string) => c !== code);
        const remainingSelectedCodes = newSegmentCodesIncluded;
        const newSubSegmentsIncluded = normalizedSubSegments.included.filter((subSeg: string) => {
          if (!codeSubSegments.includes(subSeg)) return true;
          return remainingSelectedCodes.some((otherCode: string) => {
            const otherCodeSubSegments = segmentToSubSegmentMap[otherCode] || [];
            return otherCodeSubSegments.includes(subSeg);
          });
        });

        onSegmentModesChange?.((prev) => {
          const next = new Map(prev);
          next.delete(code);
          return next;
        });

        handleFilterChange({
          ...filters,
          subSegmentCodes: {
            included: newSegmentCodesIncluded,
            excluded: normalizedSegmentCodes.excluded,
          },
          subSegments: {
            included: newSubSegmentsIncluded,
            excluded: normalizedSubSegments.excluded,
          },
        });
      } else if (allSubSegmentsSelected) {
        let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);
        codeSubSegments.forEach((subSeg) => {
          const idx = newSubSegmentsValue.included.indexOf(subSeg);
          if (idx !== -1) {
            newSubSegmentsValue.included.splice(idx, 1);
          }
        });
        handleFilterChange({ ...filters, subSegments: newSubSegmentsValue });
      } else {
        const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
        const normalizedSubSegments = normalizeFilterValue(filters.subSegments);
        const newSegmentCodesIncluded = [...new Set([...normalizedSegmentCodes.included, code])];
        const newSubSegmentsIncluded = [...new Set([...normalizedSubSegments.included, ...codeSubSegments])];
        handleFilterChange({
          ...filters,
          subSegmentCodes: {
            included: newSegmentCodesIncluded,
            excluded: normalizedSegmentCodes.excluded,
          },
          subSegments: {
            included: newSubSegmentsIncluded,
            excluded: normalizedSubSegments.excluded,
          },
        });
      }
    }, [
      code,
      isCodeExcluded,
      isCodeDirectlyIncluded,
      allSubSegmentsSelected,
      filters,
      codeSubSegments,
      segmentToSubSegmentMap,
      handleFilterChange,
      onSegmentModesChange,
    ]);

    const codeMode = isCodeIncluded ? segmentModes.get(code) || "opp" : null;
    const isTeamMode = codeMode === "team";
    const isBothMode = codeMode === "both";

    // Left click: Off->Opp, Opp->Off, Team->Both, Both->Opp
    const handleLeftClick = useCallback(() => {
      if (isCodeExcluded) return;
      if (!isCodeIncluded) {
        handleClickCode();
      } else if (isTeamMode) {
        onSegmentModesChange?.((prev) => {
          const next = new Map(prev);
          next.set(code, "both");
          return next;
        });
      } else if (isBothMode) {
        onSegmentModesChange?.((prev) => {
          const next = new Map(prev);
          next.delete(code);
          return next;
        });
      } else {
        handleClickCode();
      }
    }, [code, isCodeExcluded, isCodeIncluded, isTeamMode, isBothMode, handleClickCode, onSegmentModesChange]);

    // Right click: Off->Team, Team->Off, Opp->Both, Both->Team
    const handleRightClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        if (isCodeExcluded) return;
        if (!isCodeIncluded) {
          handleClickCode();
          onSegmentModesChange?.((prev) => {
            const next = new Map(prev);
            next.set(code, "team");
            return next;
          });
        } else if (isTeamMode) {
          onSegmentModesChange?.((prev) => {
            const next = new Map(prev);
            next.delete(code);
            return next;
          });
          handleClickCode();
        } else if (isBothMode) {
          onSegmentModesChange?.((prev) => {
            const next = new Map(prev);
            next.set(code, "team");
            return next;
          });
        } else {
          onSegmentModesChange?.((prev) => {
            const next = new Map(prev);
            next.set(code, "both");
            return next;
          });
        }
      },
      [code, isCodeExcluded, isCodeIncluded, isTeamMode, isBothMode, handleClickCode, onSegmentModesChange]
    );

    // Visual states
    const codeBg = isCodeExcluded
      ? alpha("#999", 0.2)
      : isBothMode
        ? "#E63946"
        : isTeamMode
          ? "transparent"
          : isCodeIncluded
            ? "#E63946"
            : theme.palette.grey[200];
    const codeColor = isCodeExcluded
      ? "#999"
      : isTeamMode
        ? "#E63946"
        : isCodeIncluded
          ? "white"
          : theme.palette.text.primary;
    const codeBorder = isBothMode || isTeamMode ? "2px solid #E63946" : "2px solid transparent";
    const codeBoxShadow = isBothMode ? "inset 0 0 0 2px white" : "none";

    // Sub-segment click handler
    const handleSubSegmentClick = useCallback(
      (subSegment: string, isSubIncluded: boolean, isSubExcluded: boolean) => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSubExcluded) return;

        if (isSubIncluded) {
          let updatedFilters = { ...filters };
          const newSubSegmentsValue = removeValue(filters.subSegments, subSegment);
          updatedFilters.subSegments = newSubSegmentsValue;

          if (isCodeDirectlyIncluded) {
            const newSegmentCodeValue = removeValue(filters.subSegmentCodes, code);
            updatedFilters.subSegmentCodes = newSegmentCodeValue;
          }

          handleFilterChange(updatedFilters);
        } else {
          const newValue = includeValue(filters.subSegments, subSegment);
          handleFilterChange({ ...filters, subSegments: newValue });
        }
      },
      [code, filters, isCodeDirectlyIncluded, handleFilterChange]
    );

    const codeItemSx = isGroupChild
      ? {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 2,
          px: 2,
          py: 0.75,
          fontSize: "0.85rem",
          cursor: isCodeExcluded ? "not-allowed" : "grab",
          backgroundColor: codeBg,
          color: codeColor,
          fontWeight: isCodeIncluded ? 600 : 500,
          opacity: isCodeExcluded ? 0.5 : 1,
          border: codeBorder,
          boxShadow: codeBoxShadow,
          "&:hover": {
            backgroundColor: isCodeExcluded
              ? alpha("#999", 0.2)
              : isTeamMode
                ? alpha("#E63946", 0.08)
                : isCodeIncluded
                  ? darken("#E63946", 0.1)
                  : theme.palette.grey[300],
          },
          "&:active": { cursor: "grabbing" },
        }
      : {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 2,
          px: 2,
          py: 1,
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: isCodeExcluded ? "not-allowed" : "grab",
          backgroundColor: codeBg,
          color: codeColor,
          opacity: isCodeExcluded ? 0.5 : 1,
          border: codeBorder,
          boxShadow: codeBoxShadow,
          "&:hover": {
            backgroundColor: isCodeExcluded
              ? alpha("#999", 0.2)
              : isTeamMode
                ? alpha("#E63946", 0.08)
                : isCodeIncluded
                  ? darken("#E63946", 0.1)
                  : alpha("#E63946", 0.15),
          },
          "&:active": {
            cursor: isCodeExcluded ? "not-allowed" : "grabbing",
          },
        };

    const wrapperSx =
      !isGroupChild && animIndex != null && mounted != null
        ? {
            ...keyframes.fadeInUp,
            animation: mounted ? `fadeInUp 0.5s ${easing.elegant} ${animIndex * 100}ms both` : "none",
          }
        : undefined;

    return (
      <Box sx={wrapperSx}>
        <Box
          draggable={!isCodeExcluded}
          onDragStart={(e) => {
            isDraggingRef.current = true;
            e.dataTransfer.setData("segmentCode", code);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setTimeout(() => {
              isDraggingRef.current = false;
            }, 50);
          }}
          onClick={() => {
            if (!isDraggingRef.current) handleLeftClick();
          }}
          onMouseDown={handleRightClick}
          onContextMenu={(e) => e.preventDefault()}
          sx={codeItemSx}
        >
          <Box sx={SX_FLEX_ROW_FLEX1}>
            <Box sx={SX_WORD_WRAP}>{code}</Box>
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
          <Box sx={SX_FLEX_ROW_GAP05}>
            {hasSubSegments && (
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSegmentCodes((prev) => ({ ...prev, [code]: !prev[code] }));
                }}
                sx={SX_EXPAND_BTN}
              >
                {isCodeExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </Box>
            )}
          </Box>
        </Box>
        {/* Sub-segments dropdown */}
        {hasSubSegments && (
          <Collapse in={isCodeExpanded} timeout="auto" unmountOnExit>
            <Box
              sx={{
                ...SX_FLEX_COL_GAP05,
                ...keyframes.fadeIn,
                animation: isCodeExpanded ? `fadeIn 0.3s ${easing.standard}` : "none",
              }}
            >
              {codeSubSegments.map((subSegment) => {
                const isSubSegmentDirectlyIncluded = isIncluded(filters.subSegments, subSegment);
                const isSubSegmentDirectlyExcluded = isExcluded(filters.subSegments, subSegment);
                const isSubIncluded = isSubSegmentDirectlyIncluded;
                const isSubExcluded = isSubSegmentDirectlyExcluded || isCodeExcluded;

                return (
                  <SubSegmentItem
                    key={subSegment}
                    subSegment={subSegment}
                    isSubIncluded={isSubIncluded}
                    isSubExcluded={isSubExcluded}
                    isTeamMode={isTeamMode}
                    isBothMode={isBothMode}
                    onClickSub={handleSubSegmentClick(subSegment, isSubIncluded, isSubExcluded)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("subSegment", subSegment);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    compact={!isGroupChild}
                  />
                );
              })}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  }
);

SegmentCodeItem.displayName = "SegmentCodeItem";

export default SegmentCodeItem;
