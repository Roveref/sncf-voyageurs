import React, { memo } from "react";
import Box from "@mui/material/Box";
import { alpha, darken, useTheme } from "@mui/material/styles";
import { SX_WORD_WRAP, SX_FLEX1 } from "./sidebarConstants";

interface SubSegmentItemProps {
  subSegment: string;
  isSubIncluded: boolean;
  isSubExcluded: boolean;
  isTeamMode: boolean;
  isBothMode: boolean;
  onClickSub: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  /** Whether to render the full word-wrap label or a compact flex label */
  compact?: boolean;
}

const SubSegmentItem = memo(
  ({
    subSegment,
    isSubIncluded,
    isSubExcluded,
    isTeamMode,
    isBothMode,
    onClickSub,
    onDragStart,
    compact = false,
  }: SubSegmentItemProps) => {
    const theme = useTheme();

    return (
      <Box
        key={subSegment}
        draggable={!isSubExcluded}
        onDragStart={
          onDragStart ||
          ((e) => {
            e.dataTransfer.setData("subSegment", subSegment);
            e.dataTransfer.effectAllowed = "move";
          })
        }
        onClick={onClickSub}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 1.5,
          px: 1.5,
          py: 0.5,
          fontSize: "0.75rem",
          cursor: isSubExcluded ? "not-allowed" : "grab",
          backgroundColor: isSubExcluded
            ? alpha("#999", 0.2)
            : isBothMode && isSubIncluded
              ? "#FF6B73"
              : isTeamMode && isSubIncluded
                ? "transparent"
                : isSubIncluded
                  ? "#FF6B73"
                  : theme.palette.grey[200],
          color: isSubExcluded
            ? "#999"
            : isTeamMode && isSubIncluded
              ? "#E63946"
              : isSubIncluded
                ? "white"
                : theme.palette.text.primary,
          border:
            !isSubExcluded && isSubIncluded && (isTeamMode || isBothMode)
              ? "2px solid #E63946"
              : "2px solid transparent",
          boxShadow: !isSubExcluded && isSubIncluded && isBothMode ? "inset 0 0 0 2px white" : "none",
          fontWeight: isSubIncluded ? 600 : 500,
          opacity: isSubExcluded ? 0.5 : 1,
          "&:hover": {
            backgroundColor: isSubExcluded
              ? alpha("#999", 0.2)
              : isTeamMode && isSubIncluded
                ? alpha("#E63946", 0.08)
                : isSubIncluded
                  ? darken("#FF6B73", 0.1)
                  : theme.palette.grey[300],
          },
          "&:active": {
            cursor: "grabbing",
          },
        }}
      >
        {compact ? <Box sx={SX_FLEX1}>{subSegment}</Box> : <Box sx={SX_WORD_WRAP}>{subSegment}</Box>}
      </Box>
    );
  }
);

SubSegmentItem.displayName = "SubSegmentItem";

export default SubSegmentItem;
