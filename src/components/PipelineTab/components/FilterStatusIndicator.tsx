import React from "react";
/**
 * FilterStatusIndicator Component
 * Displays active filter status with clear option
 * Performance-optimized with React.memo
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";

interface FilterStatusIndicatorProps {
  activeFilterType: string | null;
  onClearFilter: () => void;
}

/**
 * Component to show active filter status
 * Memoized to prevent unnecessary re-renders
 *
 * @param {string} activeFilterType - Currently active filter type
 * @param {Function} onClearFilter - Callback to clear the filter
 */
const FilterStatusIndicator = React.memo(({ activeFilterType, onClearFilter }: FilterStatusIndicatorProps) => {
  const theme = useTheme();

  if (!activeFilterType) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        backgroundColor: alpha(theme.palette.primary.main, 0.1),
        borderRadius: 2,
        p: 1,
        mb: 2,
      }}
    >
      <Typography variant="body2" color="primary.main" fontWeight={500}>
        Filtered by: {activeFilterType}
      </Typography>
      <Chip label="Clear Filter" size="small" onClick={onClearFilter} sx={{ ml: 2, height: "24px" }} />
    </Box>
  );
});

FilterStatusIndicator.displayName = "FilterStatusIndicator";

export default React.memo(FilterStatusIndicator);
