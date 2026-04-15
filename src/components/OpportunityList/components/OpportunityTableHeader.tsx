/**
 * OpportunityTableHeader Component
 * Displays table headers with sortable columns
 * Performance optimized with React.memo
 */

import React, { memo } from "react";
import TableSortLabel from "@mui/material/TableSortLabel";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import FilterListIcon from "@mui/icons-material/FilterList";
import { getRevenueSortModeLabel } from "../utils/opportunityUtils";
import { GRID_TEMPLATE, GRID_TEMPLATE_WIN } from "../gridLayout";

/**
 * Memoized table header component
 * Provides sortable column headers with revenue sort mode menu
 */
const OpportunityTableHeader = memo(
  ({
    order,
    orderBy,
    showNetRevenue,
    showIO,
    revenueSortMode,
    revenueMenuAnchor,
    onSortRequest,
    onRevenueMenuClick,
    onRevenueMenuClose,
    onRevenueSortModeChange,
    isFiltered = false,
    showWinPercent = false,
  }: any) => {
    const theme = useTheme();

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: showWinPercent ? GRID_TEMPLATE_WIN : GRID_TEMPLATE,
          columnGap: "24px",
          alignItems: "center",
          px: 2.5,
          py: 0.5,
          mb: 1,
          color: "#374151",
          fontSize: "0.75rem",
          fontWeight: 400,
        }}
      >
        {/* Expand/Collapse Column */}
        <Box />

        {/* Opportunity ID */}
        <Box>
          <TableSortLabel
            active={orderBy === "opportunityId"}
            direction={orderBy === "opportunityId" ? order : "asc"}
            onClick={() => onSortRequest("opportunityId")}
          >
            ID
          </TableSortLabel>
        </Box>

        {/* Account */}
        <Box>
          <TableSortLabel
            active={orderBy === "account"}
            direction={orderBy === "account" ? order : "asc"}
            onClick={() => onSortRequest("account")}
          >
            Account
          </TableSortLabel>
        </Box>

        {/* Date */}
        <Box>
          <TableSortLabel
            active={orderBy === "creationDate"}
            direction={orderBy === "creationDate" ? order : "asc"}
            onClick={() => onSortRequest("creationDate")}
          >
            Date
          </TableSortLabel>
        </Box>

        {/* Revenue with sort mode selector */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <TableSortLabel
            active={orderBy === (showNetRevenue ? "netRevenue" : "grossRevenue")}
            direction={orderBy === (showNetRevenue ? "netRevenue" : "grossRevenue") ? order : "asc"}
            onClick={() => onSortRequest(showNetRevenue ? "netRevenue" : "grossRevenue")}
            sx={{
              "& .MuiTableSortLabel-icon": {
                opacity: 1,
              },
            }}
          >
            {/* Empty label - only keep the sort arrow */}
          </TableSortLabel>

          {/* Sort mode selector button */}
          <Button
            size="small"
            onClick={onRevenueMenuClick}
            endIcon={<ArrowDropDownIcon />}
            sx={{
              ml: 0.5,
              minWidth: "auto",
              fontSize: "0.75rem",
              textTransform: "none",
              color: "text.secondary",
              fontWeight: 600,
              whiteSpace: "nowrap",
              "&:hover": {
                color: "primary.main",
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            {getRevenueSortModeLabel(revenueSortMode, showNetRevenue)}
          </Button>

          {/* Revenue sort mode menu */}
          <Menu
            anchorEl={revenueMenuAnchor}
            open={Boolean(revenueMenuAnchor)}
            onClose={onRevenueMenuClose}
            PaperProps={{
              sx: {
                minWidth: 220,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`,
              },
            }}
          >
            <MenuItem onClick={() => onRevenueSortModeChange("total")} selected={revenueSortMode === "total"}>
              <ListItemIcon>
                <AccountBalanceIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`Total ${showNetRevenue ? "Net" : "Gross"}`}
                secondary="Total opportunity revenue"
                secondaryTypographyProps={{ fontSize: "0.75rem" }}
              />
            </MenuItem>
            {showIO && (
              <MenuItem onClick={() => onRevenueSortModeChange("io")} selected={revenueSortMode === "io"}>
                <ListItemIcon>
                  <BusinessCenterIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`I&O ${showNetRevenue ? "Net" : "Gross"}`}
                  secondary="Revenue allocated to I&O"
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </MenuItem>
            )}
            {isFiltered && (
              <MenuItem onClick={() => onRevenueSortModeChange("filtered")} selected={revenueSortMode === "filtered"}>
                <ListItemIcon>
                  <FilterListIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`Filtered ${showNetRevenue ? "Net" : "Gross"}`}
                  secondary="Revenue per service line filter"
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </MenuItem>
            )}
          </Menu>
        </Box>

        {/* Opportunity Name */}
        <Box>
          <TableSortLabel
            active={orderBy === "opportunity"}
            direction={orderBy === "opportunity" ? order : "asc"}
            onClick={() => onSortRequest("opportunity")}
          >
            Opportunity
          </TableSortLabel>
        </Box>

        {/* Win % - only in Pipeline */}
        {showWinPercent && (
          <Box sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <TableSortLabel
              active={orderBy === "winPct"}
              direction={orderBy === "winPct" ? order : "asc"}
              onClick={() => onSortRequest("winPct")}
            >
              Win %
            </TableSortLabel>
          </Box>
        )}

        {/* Status */}
        <Box>
          <TableSortLabel
            active={orderBy === "status"}
            direction={orderBy === "status" ? order : "asc"}
            onClick={() => onSortRequest("status")}
          >
            Status
          </TableSortLabel>
        </Box>

        {/* Technology */}
        <Box sx={{ textAlign: "center" }}>Technology</Box>

        {/* Staffing (empty header) */}
        <Box />
      </Box>
    );
  }
);

OpportunityTableHeader.displayName = "OpportunityTableHeader";

export default OpportunityTableHeader;
