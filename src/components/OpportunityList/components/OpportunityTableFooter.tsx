/**
 * OpportunityTableFooter Component
 * Displays totals at the bottom of the table
 * Performance optimized with React.memo
 */

import React, { memo } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import { GRID_TEMPLATE, GRID_TEMPLATE_WIN } from "../gridLayout";

/**
 * Memoized table footer component
 * Shows total revenue and opportunity count
 */
const OpportunityTableFooter = memo(
  ({
    filteredDataLength,
    totalRevenue,
    totalIORevenue,
    totalRevenueBase,
    filteredRevenue,
    showIO,
    currencyFormatter,
    revenueSortMode = "total",
    isFiltered = false,
    showWinPercent = false,
  }: any) => {
    const theme = useTheme();

    // Calculate percentages
    const ioPercentage = totalRevenueBase > 0 ? (totalIORevenue / totalRevenueBase) * 100 : 0;
    const allocatedPercentage = totalRevenueBase > 0 ? (filteredRevenue / totalRevenueBase) * 100 : 0;

    // Only show Allocated and I&O details in Total Gross mode
    const isTotalMode = revenueSortMode === "total";

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: showWinPercent ? GRID_TEMPLATE_WIN : GRID_TEMPLATE,
          columnGap: "24px",
          alignItems: "center",
          px: 2.5,
          py: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          borderRadius: 3,
          fontWeight: 600,
        }}
      >
        {/* Expand/Collapse Column */}
        <Box />

        {/* Total Label (ID column) */}
        <Box>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            TOTAL
          </Typography>
        </Box>

        {/* Asset Count */}
        <Box>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            {filteredDataLength} actif{filteredDataLength > 1 ? "s" : ""}
          </Typography>
        </Box>

        {/* Empty Date Column */}
        <Box />

        {/* Revenue total — right-aligned to match row values */}
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ whiteSpace: "nowrap" }}>
            {currencyFormatter.format(totalRevenue)}
          </Typography>
        </Box>

        {/* Valeur d'achat total — placeholder */}
        <Box />

        {/* Valeur résiduelle total — placeholder */}
        <Box />

        {/* Allocated / I&O details in opportunity name column */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline" }}>
          {isTotalMode && isFiltered && allocatedPercentage < 100 && allocatedPercentage > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              →&nbsp;&nbsp;{currencyFormatter.format(filteredRevenue)}
            </Typography>
          )}
          {isTotalMode && showIO && (
            <Typography variant="body2" color="primary.main" sx={{ whiteSpace: "nowrap" }}>
              (I&O: {currencyFormatter.format(totalIORevenue)})
            </Typography>
          )}
        </Box>

        {/* Empty Win % Column */}
        {showWinPercent && <Box />}

        {/* Empty Status Column */}
        <Box />

        {/* Empty Technology Column */}
        <Box />

        {/* Empty Staffing Column */}
        <Box />
      </Box>
    );
  }
);

OpportunityTableFooter.displayName = "OpportunityTableFooter";

export default OpportunityTableFooter;
