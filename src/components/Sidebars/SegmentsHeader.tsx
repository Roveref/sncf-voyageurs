import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { getIncludedValues } from "../../utils/filterHelpers";
import { SX_FLEX_GAP025 } from "./sidebarConstants";

interface SegmentsHeaderProps {
  filters: any;
  handleFilterChange: (filters: any) => void;
  handleExpandLevel: () => void;
  handleCollapseLevel: () => void;
}

const SegmentsHeader = memo(
  ({ filters, handleFilterChange, handleExpandLevel, handleCollapseLevel }: SegmentsHeaderProps) => {
    const theme = useTheme();

    return (
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
            <Typography variant="h6" fontWeight={600} color={theme.palette.primary.dark}>
              Segments
            </Typography>

            {/* Expand/Collapse level buttons */}
            <Box sx={SX_FLEX_GAP025}>
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
                aria-label="Collapse one level"
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
                aria-label="Expand one level"
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {(getIncludedValues(filters.subSegmentCodes).length > 0 ||
            getIncludedValues(filters.subSegments).length > 0) && (
            <IconButton
              size="small"
              aria-label="Clear segment filters"
              onClick={() => {
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
        <Divider sx={{ mb: 1.5, borderColor: theme.palette.primary.light }} />
      </>
    );
  }
);

SegmentsHeader.displayName = "SegmentsHeader";

export default SegmentsHeader;
