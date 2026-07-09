/**
 * OpportunityTableHeader Component
 * Displays table headers with sortable columns
 * Performance optimized with React.memo
 */

import React, { memo } from "react";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
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
            Site
          </TableSortLabel>
        </Box>

        {/* Prochaine VR */}
        <Box>
          <TableSortLabel
            active={orderBy === "estimatedBookingDate"}
            direction={orderBy === "estimatedBookingDate" ? order : "asc"}
            onClick={() => onSortRequest("estimatedBookingDate")}
          >
            Prochaine VR
          </TableSortLabel>
        </Box>

        {/* Coût maintenance */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
            Coût maint.
          </Typography>

          {/* Sort mode menu hidden for GAIF — single column "Coût maint." */}
        </Box>

        {/* Valeur d'achat */}
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
            Val. achat
          </Typography>
        </Box>

        {/* Valeur résiduelle */}
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
            Val. résid.
          </Typography>
        </Box>

        {/* Opportunity Name */}
        <Box>
          <TableSortLabel
            active={orderBy === "opportunity"}
            direction={orderBy === "opportunity" ? order : "asc"}
            onClick={() => onSortRequest("opportunity")}
          >
            Actif
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
              Dispo %
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
            Statut
          </TableSortLabel>
        </Box>

        {/* Criticité */}
        <Box sx={{ textAlign: "center" }}>Criticité</Box>

        {/* Staffing (empty header) */}
        <Box />
      </Box>
    );
  }
);

OpportunityTableHeader.displayName = "OpportunityTableHeader";

export default OpportunityTableHeader;
