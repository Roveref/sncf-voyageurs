/**
 * OpportunityRow Component
 * Displays a single opportunity row with expandable details
 * Performance optimized with React.memo to prevent unnecessary re-renders
 */

import React, { useState, memo, useEffect, useRef } from "react";
import {
  TableRow,
  TableCell,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  alpha,
  useTheme,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CommentIcon from "@mui/icons-material/Comment";
import CreateIcon from "@mui/icons-material/Create";
import EditNoteIcon from "@mui/icons-material/EditNote";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { STATUS_COLORS, STATUS_TEXT } from "../../../utils/constants";
import { getTechnologyPartnerTags } from "../utils/opportunityUtils";
import { useStatusOverride, STATUS_OPTIONS } from "../../../contexts/StatusOverrideContext";
import OpportunityExpandedDetails from "./OpportunityExpandedDetails";
import { keyframes, timing, easing, staggerChildren } from "../../../styles/animations";

const statusColors = STATUS_COLORS;
const statusText = STATUS_TEXT;

/**
 * Memoized row component for opportunities
 * Prevents unnecessary re-renders when parent state changes
 */
const OpportunityRow = memo(
  ({
    row,
    index = 0,
    isSelected,
    onRowClick,
    showNetRevenue,
    showIO,
    revenueSortMode = "total",
    setEditOpportunity,
    forceExpand = false,
    onManualOpportunityUpdated,
  }) => {
    const [open, setOpen] = useState(false);
    const theme = useTheme();
    const rowRef = useRef(null);

    // Inline status change state
    const { setStatusOverride } = useStatusOverride();
    const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [statusComment, setStatusComment] = useState("");
    const [bookingDate, setBookingDate] = useState(new Date());

    const handleStatusChipClick = (e) => {
      e.stopPropagation(); // Don't trigger row expand
      setStatusMenuAnchor(e.currentTarget);
    };

    const handleStatusMenuClose = () => {
      setStatusMenuAnchor(null);
    };

    const handleStatusSelect = (newStatus) => {
      handleStatusMenuClose();
      if (newStatus === row["Status"]) return;
      // For Booked/Lost, ask for date + optional comment
      if (newStatus === 14 || newStatus === 15) {
        setPendingStatus(newStatus);
        setStatusComment("");
        setBookingDate(new Date());
        setStatusDialogOpen(true);
      } else {
        // Apply immediately
        const originalStatus = row._originalStatus ?? row["Status"];
        if (row.isManual) {
          // Update manual opportunity in localStorage
          const opps = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
          const idx = opps.findIndex((o) => o["Opportunity ID"] === row["Opportunity ID"]);
          if (idx !== -1) {
            opps[idx]["Status"] = newStatus;
            localStorage.setItem("manual_opportunities", JSON.stringify(opps));
            if (onManualOpportunityUpdated) onManualOpportunityUpdated(row["Opportunity ID"]);
          }
        } else {
          setStatusOverride(row["Opportunity ID"], originalStatus, newStatus, "");
        }
      }
    };

    const handleConfirmStatusDialog = () => {
      if (pendingStatus == null) return;
      const originalStatus = row._originalStatus ?? row["Status"];
      const formattedDate = bookingDate ? bookingDate.toISOString().split("T")[0] : null;

      if (row.isManual) {
        const opps = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
        const idx = opps.findIndex((o) => o["Opportunity ID"] === row["Opportunity ID"]);
        if (idx !== -1) {
          opps[idx]["Status"] = pendingStatus;
          if (formattedDate) opps[idx]["Booking/Lost Date"] = formattedDate;
          localStorage.setItem("manual_opportunities", JSON.stringify(opps));
          if (onManualOpportunityUpdated) onManualOpportunityUpdated(row["Opportunity ID"]);
        }
      } else {
        setStatusOverride(row["Opportunity ID"], originalStatus, pendingStatus, statusComment, formattedDate);
      }
      setStatusDialogOpen(false);
      setPendingStatus(null);
    };

    // Force expand and scroll when forceExpand is true
    useEffect(() => {
      if (forceExpand) {
        setOpen(true);
        // Scroll to this row after a short delay to ensure the row is rendered
        setTimeout(() => {
          if (rowRef.current) {
            rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }, [forceExpand]);

    // Calculate I&O revenue
    const calculatedRevenue = calculateRevenueWithSegmentLogic(row, showNetRevenue);

    // Get technology partner tags for this opportunity
    const technologyPartners = getTechnologyPartnerTags(row);

    // Determine whether to show allocated revenue based on revenueSortMode
    // Show allocated values whenever filters are applied (Allocated Gross Revenue exists)
    const shouldShowAllocated = revenueSortMode === "filtered" && row["Allocated Gross Revenue"] !== undefined;
    const shouldShowIO = revenueSortMode === "io";

    // Calculate I&O percentage
    const baseRevenue = showNetRevenue ? row["Net Revenue"] || 0 : row["Gross Revenue"] || 0;
    const ioPercentage = baseRevenue > 0 ? (calculatedRevenue / baseRevenue) * 100 : 0;

    // Get status color based on Pipeline by Status categories
    const getStatusColor = (status) => {
      switch (status) {
        case 1: // Lead Identified
        case 4: // Go Approved
          return {
            bgcolor: alpha(theme.palette.primary.light, 0.15),
            color: theme.palette.primary.light,
            borderColor: alpha(theme.palette.primary.light, 0.3),
          };
        case 6: // Proposal Submitted
          return {
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            color: theme.palette.primary.main,
            borderColor: alpha(theme.palette.primary.main, 0.3),
          };
        case 11: // Client Won
        case 13: // AEL
          return {
            bgcolor: alpha(theme.palette.primary.dark, 0.15),
            color: theme.palette.primary.dark,
            borderColor: alpha(theme.palette.primary.dark, 0.3),
          };
        case 14: // Booked
          return {
            bgcolor: alpha(theme.palette.success.main, 0.15),
            color: theme.palette.success.main,
            borderColor: alpha(theme.palette.success.main, 0.3),
          };
        case 15: // Lost
          return {
            bgcolor: alpha(theme.palette.error.main, 0.15),
            color: theme.palette.error.main,
            borderColor: alpha(theme.palette.error.main, 0.3),
          };
        default:
          return {
            bgcolor: alpha(theme.palette.grey[500], 0.15),
            color: theme.palette.grey[700],
            borderColor: alpha(theme.palette.grey[500], 0.3),
          };
      }
    };

    const statusColor = getStatusColor(row["Status"]);

    return (
      <>
        <TableRow
          ref={rowRef}
          hover
          onClick={() => onRowClick(row)}
          selected={isSelected}
          sx={{
            "&:last-child td, &:last-child th": { border: 0 },
            cursor: "pointer",
            // Entrance animation with stagger
            animation: `fadeInUp ${timing.normal} ${easing.elegant} ${index * 50}ms both`,
            ...keyframes.fadeInUp,
            // Base transition for all changes
            transition: `all ${timing.fast} ${easing.elegant}`,
            // Selection state with checkmark animation
            "&.Mui-selected": {
              backgroundColor: alpha(statusColor.color, 0.08),
              "&:hover": {
                backgroundColor: alpha(statusColor.color, 0.12),
              },
            },
            // Enhanced hover effect
            "&:hover": {
              backgroundColor: "rgba(255, 61, 71, 0.04)",
              transform: "translateX(2px)",
              boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
            },
          }}
        >
          {/* Expand/Collapse Button */}
          <TableCell padding="checkbox" sx={{ width: 48, minWidth: 48, maxWidth: 48 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <IconButton
                aria-label="expand row"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(!open);
                }}
                sx={{
                  padding: "4px",
                  transition: `background-color ${timing.normal} ${easing.elegant}`,
                  ...(isSelected && {
                    backgroundColor: "#FF3D47",
                    color: "white",
                    animation: `checkmark ${timing.normal} ${easing.bounce} both`,
                    ...keyframes.checkmark,
                    "&:hover": {
                      backgroundColor: "#E6363F",
                    },
                  }),
                }}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
              </IconButton>
              {/* Manual Opportunity Badge */}
              {row.isManual && (
                <Tooltip title="Manually created opportunity">
                  <CreateIcon
                    sx={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      fontSize: 14,
                      color: theme.palette.info.main,
                      backgroundColor: theme.palette.background.paper,
                      borderRadius: "50%",
                      padding: "2px",
                      boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.2)}`,
                    }}
                  />
                </Tooltip>
              )}
              {/* Status Override Badge */}
              {row._statusOverride && (
                <Tooltip title={`Statut modifié: ${statusText[row._originalStatus]} → ${statusText[row["Status"]]}`}>
                  <EditNoteIcon
                    sx={{
                      position: "absolute",
                      top: -2,
                      left: -2,
                      fontSize: 14,
                      color: theme.palette.warning.main,
                      backgroundColor: theme.palette.background.paper,
                      borderRadius: "50%",
                      padding: "2px",
                      boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.2)}`,
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          </TableCell>

          {/* Opportunity ID */}
          <TableCell component="th" scope="row" padding="none" sx={{ width: 120, minWidth: 120, maxWidth: 120 }}>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                ml: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row["Opportunity ID"]}
            </Typography>
          </TableCell>

          {/* Account */}
          <TableCell sx={{ width: "20%", minWidth: 150 }}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row["Account"]}
            </Typography>
          </TableCell>

          {/* Date */}
          <TableCell sx={{ width: 120, minWidth: 120, maxWidth: 120 }}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row["Creation Date"]
                ? new Date(row["Creation Date"]).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "-"}
            </Typography>
          </TableCell>

          {/* Revenue */}
          <TableCell align="right" sx={{ width: 150, minWidth: 150, maxWidth: 150 }}>
            <Typography variant="body2" fontWeight={500}>
              {typeof (shouldShowIO
                ? calculatedRevenue
                : shouldShowAllocated
                  ? showNetRevenue
                    ? row["Allocated Net Revenue"]
                    : row["Allocated Gross Revenue"]
                  : showNetRevenue
                    ? row["Net Revenue"]
                    : row["Gross Revenue"]) === "number"
                ? new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(
                    shouldShowIO
                      ? calculatedRevenue
                      : shouldShowAllocated
                        ? showNetRevenue
                          ? row["Allocated Net Revenue"]
                          : row["Allocated Gross Revenue"]
                        : showNetRevenue
                          ? row["Net Revenue"]
                          : row["Gross Revenue"]
                  )
                : shouldShowIO
                  ? calculatedRevenue
                  : shouldShowAllocated
                    ? showNetRevenue
                      ? row["Allocated Net Revenue"]
                      : row["Allocated Gross Revenue"]
                    : showNetRevenue
                      ? row["Net Revenue"]
                      : row["Gross Revenue"]}
            </Typography>
            {/* Always show allocation info when filtered, regardless of display mode */}
            {row["Is Allocated"] && !shouldShowIO && (
              <Typography variant="caption" color="text.secondary" display="block">
                {row["Allocated Service Line"]}: {row["Allocation Percentage"]}%
              </Typography>
            )}
            {showIO && (
              <Typography variant="caption" color="text.secondary" display="block">
                I&O: {ioPercentage.toFixed(0)}%
              </Typography>
            )}
          </TableCell>

          {/* Opportunity Name */}
          <TableCell sx={{ width: "25%", minWidth: 180 }}>
            <Typography
              variant="body2"
              fontWeight={isSelected ? 600 : 400}
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row["Opportunity"]}
            </Typography>
          </TableCell>

          {/* Status - clickable for inline change */}
          <TableCell sx={{ width: 120, minWidth: 120, maxWidth: 120 }}>
            <Tooltip title="Cliquer pour changer le statut" arrow>
              <Chip
                label={statusText[row["Status"]] || `Status ${row["Status"]}`}
                size="small"
                variant="filled"
                onClick={handleStatusChipClick}
                sx={{
                  fontWeight: 500,
                  backgroundColor: statusColor.bgcolor,
                  color: statusColor.color,
                  border: `1px solid ${statusColor.borderColor}`,
                  boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.1)}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: `0 2px 8px ${alpha(statusColor.color, 0.3)}`,
                  },
                }}
              />
            </Tooltip>
            {/* Status change menu */}
            <Menu
              anchorEl={statusMenuAnchor}
              open={Boolean(statusMenuAnchor)}
              onClose={handleStatusMenuClose}
              onClick={(e) => e.stopPropagation()}
              slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2 } } }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.status}
                  selected={opt.status === row["Status"]}
                  onClick={() => handleStatusSelect(opt.status)}
                  sx={{ fontSize: "0.85rem", py: 1 }}
                >
                  <ListItemText>{opt.label}</ListItemText>
                  {opt.status === row["Status"] && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      actuel
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Menu>
            {/* Add comment indicator for lost opportunities */}
            {row["Status"] === 15 && row["Lost Comment"] && (
              <Tooltip title={`Lost Comment: ${row["Lost Comment"]}`}>
                <CommentIcon fontSize="small" color="error" sx={{ ml: 0.5, verticalAlign: "middle" }} />
              </Tooltip>
            )}
          </TableCell>

          {/* Technology */}
          <TableCell align="center" sx={{ width: 80 }}>
            {/* Display technology partner tags only if they exist */}
            {technologyPartners.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {technologyPartners.map((partner, index) => (
                  <Chip
                    key={index}
                    label={partner}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.info.main, 0.15),
                      color: theme.palette.info.main,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                      "& .MuiChip-label": {
                        px: 1,
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </TableCell>
        </TableRow>

        {/* Collapsed row with details - Enhanced with fade-in animation */}
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
            <Collapse
              in={open}
              timeout={{
                enter: 300,
                exit: 200,
              }}
              unmountOnExit
              sx={{
                transition: `all ${timing.normal} ${easing.elegant} !important`,
              }}
            >
              <Box
                sx={{
                  animation: open ? `fadeIn ${timing.normal} ${easing.elegant} both` : "none",
                  ...keyframes.fadeIn,
                }}
              >
                <OpportunityExpandedDetails
                  row={row}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                  setEditOpportunity={setEditOpportunity}
                  onManualOpportunityUpdated={onManualOpportunityUpdated}
                />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>

        {/* Status change confirmation dialog (for Booked/Lost) */}
        <Dialog
          open={statusDialogOpen}
          onClose={() => setStatusDialogOpen(false)}
          onClick={(e) => e.stopPropagation()}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label={statusText[row["Status"]]}
                size="small"
                sx={{ backgroundColor: statusColor.bgcolor, color: statusColor.color, fontWeight: 600 }}
              />
              <ArrowForwardIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Chip
                label={STATUS_OPTIONS.find((o) => o.status === pendingStatus)?.label || ""}
                size="small"
                color={pendingStatus === 14 ? "success" : "error"}
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </DialogTitle>
          <DialogContent>
            <DatePicker
              label={pendingStatus === 14 ? "Date de booking" : "Date de perte"}
              value={bookingDate}
              onChange={setBookingDate}
              slotProps={{
                textField: { fullWidth: true, size: "small", sx: { mb: 2 } },
              }}
            />
            <TextField
              label="Commentaire (optionnel)"
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)} size="small">
              Annuler
            </Button>
            <Button onClick={handleConfirmStatusDialog} variant="contained" size="small">
              Confirmer
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

OpportunityRow.displayName = "OpportunityRow";

export default OpportunityRow;
