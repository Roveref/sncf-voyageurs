/**
 * OpportunityTableFooter Component
 * Displays totals at the bottom of the table
 * Performance optimized with React.memo
 */

import React, { memo } from "react";
import { TableFooter, TableRow, TableCell, Typography, Box, alpha, useTheme } from "@mui/material";

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
  }) => {
    const theme = useTheme();

    // Calculate percentages
    const ioPercentage = totalRevenueBase > 0 ? (totalIORevenue / totalRevenueBase) * 100 : 0;
    const allocatedPercentage = totalRevenueBase > 0 ? (filteredRevenue / totalRevenueBase) * 100 : 0;

    // Only show Allocated and I&O details in Total Gross mode
    const isTotalMode = revenueSortMode === "total";

    return (
      <TableFooter>
        <TableRow
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            "& td": {
              borderBottom: "none",
              fontWeight: 600,
            },
          }}
        >
          {/* Expand/Collapse Column */}
          <TableCell padding="checkbox" />

          {/* Total Label (ID column) */}
          <TableCell padding="none">
            <Typography variant="body2" fontWeight={700} color="primary.main">
              TOTAL
            </Typography>
          </TableCell>

          {/* Opportunity Count (Account column) */}
          <TableCell>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              {filteredDataLength} opportunit{filteredDataLength > 1 ? "ies" : "y"}
            </Typography>
          </TableCell>

          {/* Empty Date Column */}
          <TableCell />

          {/* Total Revenue */}
          <TableCell align="right">
            <Box>
              {/* Main revenue display */}
              <Typography variant="body2" fontWeight={700} color="primary.main">
                {currencyFormatter.format(totalRevenue)}
              </Typography>

              {/* Only show Allocated and I&O details in Total Gross mode */}
              {isTotalMode && (
                <>
                  {/* Show Allocated amount and percentage if there's a difference */}
                  {isFiltered && allocatedPercentage < 100 && allocatedPercentage > 0 && (
                    <Typography variant="caption" color="secondary.main" display="block">
                      Allocated: {currencyFormatter.format(filteredRevenue)} ({allocatedPercentage.toFixed(0)}%)
                    </Typography>
                  )}
                  {/* Show I&O amount and percentage if enabled */}
                  {showIO && (
                    <Typography variant="caption" color="primary.main" display="block">
                      I&O: {currencyFormatter.format(totalIORevenue)} ({ioPercentage.toFixed(0)}%)
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </TableCell>

          {/* Empty Opportunity Column */}
          <TableCell />

          {/* Empty Status Column */}
          <TableCell />

          {/* Empty Technology Column */}
          <TableCell />
        </TableRow>
      </TableFooter>
    );
  }
);

OpportunityTableFooter.displayName = "OpportunityTableFooter";

export default OpportunityTableFooter;
