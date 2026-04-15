import { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { GANTT_LEFT_COL_WIDTH } from "../../constants";
import { PeriodBar } from "../Timeline/PeriodBar";

const LEFT_COL = GANTT_LEFT_COL_WIDTH;

interface AddRowProps {
  tl: any;
  isActive: boolean;
  selectionRange?: { start: string; end: string };
  onDragSelect: (range: { start: string; end: string }) => void;
  onClick: () => void;
  leftColShrink: number;
  utilization?: number;
}

export const AddRow = memo(
  ({ tl, isActive, selectionRange, onDragSelect, onClick, leftColShrink, utilization }: AddRowProps) => {
    const effectiveLeft = LEFT_COL - leftColShrink;

    const handleDragSelect = useCallback(
      (dateRange: { start: string; end: string }) => {
        onDragSelect(dateRange);
      },
      [onDragSelect]
    );

    return (
      <>
        <Box sx={{ borderTop: "1px dashed", borderColor: isActive ? "#CCC1BC" : "divider", ml: "13px", mt: 1 }} />
        <Box
          onClick={onClick}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            mt: 1,
            bgcolor: isActive ? "rgba(204,193,188,0.18)" : undefined,
            transition: "background-color 0.15s",
            "&:hover": { bgcolor: isActive ? "rgba(204,193,188,0.22)" : "rgba(249,250,251,0.5)" },
            borderLeft: "3px solid transparent",
          }}
        >
          {/* Left col — Add label */}
          <Box
            sx={{
              flexShrink: 0,
              px: 1.25,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              minWidth: 0,
            }}
            style={{ width: effectiveLeft - 3 }}
          >
            <AddIcon sx={{ fontSize: 14, color: isActive ? "#CCC1BC" : "text.disabled", ml: "8px" }} />
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: isActive ? "#CCC1BC" : "text.disabled",
                fontWeight: isActive ? 600 : 400,
                fontStyle: isActive ? "normal" : "italic",
              }}
            >
              {isActive && selectionRange ? "New assignment" : "Drag on timeline to create"}
            </Typography>
          </Box>

          {/* Right col — empty PeriodBar for drag-select */}
          <Box sx={{ flex: 1, pr: 1.5, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
            <PeriodBar
              periods={
                selectionRange
                  ? [
                      {
                        startDate: selectionRange.start,
                        endDate: selectionRange.end,
                        utilization: utilization || 100,
                        status: utilization ? "C" : "P",
                      },
                    ]
                  : []
              }
              color={utilization ? "#CCC1BC" : "#B2A59F"}
              tlStart={tl.start}
              totalDays={tl.totalDays}
              numCols={tl.numCols}
              dayToCol={tl.dayToCol}
              weekendSet={tl.weekendSet}
              mondayCols={tl.mondayCols}
              jobName="New assignment"
              onDragSelect={handleDragSelect}
              persistedSelection={isActive && selectionRange ? selectionRange : undefined}
            />
          </Box>
        </Box>
      </>
    );
  }
);
AddRow.displayName = "AddRow";
