/**
 * OpportunityTableHeader Component
 * Displays table headers with sortable columns
 * Performance optimized with React.memo
 */

import React, { memo } from "react";
import {
  TableHead,
  TableRow,
  TableCell,
  TableSortLabel,
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
  useTheme,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import FilterListIcon from "@mui/icons-material/FilterList";
import { getRevenueSortModeLabel } from "../utils/opportunityUtils";

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
  }) => {
    const theme = useTheme();

    return (
      <TableHead>
        <TableRow>
          {/* Expand/Collapse Column */}
          <TableCell padding="checkbox" sx={{ width: 48 }} />

          {/* Opportunity ID */}
          <TableCell padding="none" sx={{ width: 120 }}>
            <TableSortLabel
              active={orderBy === "Opportunity ID"}
              direction={orderBy === "Opportunity ID" ? order : "asc"}
              onClick={() => onSortRequest("Opportunity ID")}
            >
              ID
            </TableSortLabel>
          </TableCell>

          {/* Account */}
          <TableCell sx={{ width: "20%" }}>
            <TableSortLabel
              active={orderBy === "Account"}
              direction={orderBy === "Account" ? order : "asc"}
              onClick={() => onSortRequest("Account")}
            >
              Account
            </TableSortLabel>
          </TableCell>

          {/* Date */}
          <TableCell sx={{ width: 120 }}>
            <TableSortLabel
              active={orderBy === "Creation Date"}
              direction={orderBy === "Creation Date" ? order : "asc"}
              onClick={() => onSortRequest("Creation Date")}
            >
              Date
            </TableSortLabel>
          </TableCell>

          {/* Revenue with sort mode selector */}
          <TableCell align="right" sx={{ width: 180 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <TableSortLabel
                active={orderBy === (showNetRevenue ? "Net Revenue" : "Gross Revenue")}
                direction={orderBy === (showNetRevenue ? "Net Revenue" : "Gross Revenue") ? order : "asc"}
                onClick={() => onSortRequest(showNetRevenue ? "Net Revenue" : "Gross Revenue")}
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
                    secondary="Revenue total de l'opportunité"
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
                      secondary="Revenue alloué à I&O"
                      secondaryTypographyProps={{ fontSize: "0.75rem" }}
                    />
                  </MenuItem>
                )}
                {isFiltered && (
                  <MenuItem
                    onClick={() => onRevenueSortModeChange("filtered")}
                    selected={revenueSortMode === "filtered"}
                  >
                    <ListItemIcon>
                      <FilterListIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Filtre ${showNetRevenue ? "Net" : "Gross"}`}
                      secondary="Revenue selon le filtre service line"
                      secondaryTypographyProps={{ fontSize: "0.75rem" }}
                    />
                  </MenuItem>
                )}
              </Menu>
            </Box>
          </TableCell>

          {/* Opportunity Name */}
          <TableCell sx={{ width: "25%" }}>
            <TableSortLabel
              active={orderBy === "Opportunity"}
              direction={orderBy === "Opportunity" ? order : "asc"}
              onClick={() => onSortRequest("Opportunity")}
            >
              Opportunity
            </TableSortLabel>
          </TableCell>

          {/* Status */}
          <TableCell sx={{ width: 120 }}>
            <TableSortLabel
              active={orderBy === "Status"}
              direction={orderBy === "Status" ? order : "asc"}
              onClick={() => onSortRequest("Status")}
            >
              Status
            </TableSortLabel>
          </TableCell>

          {/* Technology */}
          <TableCell align="center" sx={{ width: 120 }}>
            Technology
          </TableCell>
        </TableRow>
      </TableHead>
    );
  }
);

OpportunityTableHeader.displayName = "OpportunityTableHeader";

export default OpportunityTableHeader;
