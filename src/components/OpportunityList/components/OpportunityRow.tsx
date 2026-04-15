/**
 * OpportunityRow Component
 * Displays a single opportunity row with expandable details
 * Performance optimized with React.memo to prevent unnecessary re-renders
 */

import React, { memo, useCallback, useEffect, useRef, useMemo, useState } from "react";
import { formatCurrency } from "../../../utils/formatters";
import { AccountLogo } from "../../common/AccountLogo";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { alpha, useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CommentIcon from "@mui/icons-material/Comment";
import CreateIcon from "@mui/icons-material/Create";
import EditNoteIcon from "@mui/icons-material/EditNote";
import SyncIcon from "@mui/icons-material/Sync";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Badge from "@mui/material/Badge";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { STATUS_COLORS, STATUS_TEXT } from "../../../utils/constants";
import { getTechnologyPartnerTags } from "../utils/opportunityUtils";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useCrmData } from "../../../queries/useCrmData";
import { useUIStore } from "../../../stores/useUIStore";
import OpportunityExpandedDetails from "./OpportunityExpandedDetails";
import { keyframes, timing, easing, staggerChildren } from "../../../styles/animations";
import { GRID_TEMPLATE, GRID_TEMPLATE_WIN } from "../gridLayout";
import { brand } from "../../../config/brandConfig";

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
    showWinPercent = false,
    isLiveUpdated = false,
    collapseAllSignal = 0,
  }: any) => {
    const [open, setOpen] = useState(false);
    const [editingField, setEditingField] = useState<"revenue" | "winPct" | null>(null);
    const [editValue, setEditValue] = useState("");
    const theme = useTheme();
    const rowRef = useRef<HTMLDivElement>(null);

    // Reactive status options from CRM query cache
    const { statusOptions } = useCrmData();

    // Inline status change state
    const setStatusOverride = useUserDataStore((s) => s.setStatusOverride);
    const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [statusComment, setStatusComment] = useState("");
    const [bookingDate, setBookingDate] = useState(new Date());

    const handleStatusChipClick = (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation(); // Don't trigger row expand
      setStatusMenuAnchor(e.currentTarget);
    };

    const handleStatusMenuClose = () => {
      setStatusMenuAnchor(null);
    };

    const handleStatusSelect = (newStatus: any) => {
      handleStatusMenuClose();
      if (newStatus === row.status) return;
      // For Booked/Lost, ask for date + optional comment
      if (newStatus === 14 || newStatus === 15) {
        setPendingStatus(newStatus);
        setStatusComment("");
        setBookingDate(new Date());
        setStatusDialogOpen(true);
      } else {
        // Apply immediately
        const originalStatus = row._originalStatus ?? row.status;
        if (row.isManual) {
          useUserDataStore.getState().updateManualOpportunityStatus(row.opportunityId, newStatus);
          if (onManualOpportunityUpdated) onManualOpportunityUpdated(row.opportunityId);
        } else {
          setStatusOverride(row.opportunityId, originalStatus, newStatus, "");
        }
      }
    };

    const handleConfirmStatusDialog = () => {
      if (pendingStatus == null) return;
      const originalStatus = row._originalStatus ?? row.status;
      const formattedDate = bookingDate ? bookingDate.toISOString().split("T")[0] : null;

      if (row.isManual) {
        useUserDataStore.getState().updateManualOpportunityStatus(row.opportunityId, pendingStatus, formattedDate);
        if (onManualOpportunityUpdated) onManualOpportunityUpdated(row.opportunityId);
      } else {
        setStatusOverride(row.opportunityId, originalStatus, pendingStatus, statusComment, formattedDate);
      }
      setStatusDialogOpen(false);
      setPendingStatus(null);
    };

    // Check if this opportunity has staffing needs defined (from store)
    const staffingNeedsForOpp = useUserDataStore((s) => s.staffingNeeds[row.opportunityId]);
    const staffingNeedsCount = useMemo(() => {
      if (!staffingNeedsForOpp || !Array.isArray(staffingNeedsForOpp)) return 0;
      return staffingNeedsForOpp.reduce((sum, n) => sum + (n.quantity || 1), 0);
    }, [staffingNeedsForOpp]);

    const setStaffingNeedOpportunity = useUIStore((s) => s.setStaffingNeedOpportunity);
    const setCreateStaffingNeedModalOpen = useUIStore((s) => s.setCreateStaffingNeedModalOpen);

    const handleOpenStaffingNeed = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setStaffingNeedOpportunity(row);
        setCreateStaffingNeedModalOpen(true);
      },
      [row, setStaffingNeedOpportunity, setCreateStaffingNeedModalOpen]
    );

    const handleSaveEdit = useCallback(() => {
      if (!editingField || !row.isManual) return;
      const val = parseFloat(editValue);
      if (isNaN(val)) {
        setEditingField(null);
        return;
      }
      if (editingField === "revenue") {
        useUserDataStore.getState().updateManualOpportunity(row.opportunityId, { grossRevenue: val });
      } else if (editingField === "winPct") {
        useUserDataStore
          .getState()
          .updateManualOpportunity(row.opportunityId, { winPct: Math.min(100, Math.max(0, val)) });
      }
      if (onManualOpportunityUpdated) onManualOpportunityUpdated(row.opportunityId);
      setEditingField(null);
    }, [editingField, editValue, row.opportunityId, row.isManual, onManualOpportunityUpdated]);

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

    // Collapse when collapseAll signal fires
    const collapseRef = useRef(collapseAllSignal);
    useEffect(() => {
      if (collapseAllSignal !== collapseRef.current) {
        collapseRef.current = collapseAllSignal;
        setOpen(false);
      }
    }, [collapseAllSignal]);

    // Calculate I&O revenue
    const calculatedRevenue = calculateRevenueWithSegmentLogic(row, showNetRevenue);

    // Get technology partner tags for this opportunity
    const technologyPartners = getTechnologyPartnerTags(row);

    // Determine whether to show allocated revenue based on revenueSortMode
    // Show allocated values whenever filters are applied (Allocated Gross Revenue exists)
    const shouldShowAllocated = revenueSortMode === "filtered" && row.allocatedGrossRevenue !== undefined;
    const shouldShowIO = revenueSortMode === "io";

    // Calculate I&O percentage
    const baseRevenue = showNetRevenue ? row.netRevenue || 0 : row.grossRevenue || 0;
    const ioPercentage = baseRevenue > 0 ? (calculatedRevenue / baseRevenue) * 100 : 0;

    // Get status color based on Pipeline by Status categories
    const getStatusColor = (status: number) => {
      switch (status) {
        case 1: // Lead Identified — primary (rouge BP)
          return {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.dark,
          };
        case 4: // Go Approved — warning (ambre)
          return {
            bgcolor: alpha(theme.palette.warning.main, 0.12),
            color: theme.palette.warning.dark,
          };
        case 6: // Proposal Submitted — info (warm grey)
          return {
            bgcolor: alpha(theme.palette.info.main, 0.12),
            color: theme.palette.info.dark,
          };
        case 11: // Client Won — success (vert)
        case 13: // AEL
          return {
            bgcolor: alpha(theme.palette.success.main, 0.12),
            color: theme.palette.success.dark,
          };
        case 14: // Booked — success dark (vert foncé)
          return {
            bgcolor: alpha(theme.palette.success.dark, 0.15),
            color: theme.palette.success.dark,
          };
        case 15: // Lost — error (bordeaux)
          return {
            bgcolor: alpha(theme.palette.error.main, 0.1),
            color: theme.palette.error.dark,
          };
        default:
          return {
            bgcolor: alpha(theme.palette.grey[500], 0.15),
            color: theme.palette.grey[700],
            borderColor: alpha(theme.palette.grey[500], 0.3),
          };
      }
    };

    const statusColor = getStatusColor(row.status);

    return (
      <>
        {/* Card row */}
        <Box
          ref={rowRef}
          onClick={() => onRowClick(row)}
          sx={{
            display: "grid",
            gridTemplateColumns: showWinPercent ? GRID_TEMPLATE_WIN : GRID_TEMPLATE,
            columnGap: "24px",
            alignItems: "center",
            px: 2.5,
            py: 1.5,
            cursor: "pointer",
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: isSelected ? alpha(statusColor.color, 0.08) : "#f8f9fa",
            boxShadow: isLiveUpdated
              ? "inset 3px 0 0 #10b981, 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
              : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            animation: isLiveUpdated
              ? `pulseGreen 2s ease-out, fadeInUp ${timing.normal} ${easing.elegant} ${Math.min(index, 20) * 50}ms both`
              : `fadeInUp ${timing.normal} ${easing.elegant} ${Math.min(index, 20) * 50}ms both`,
            "@keyframes pulseGreen": {
              "0%": { backgroundColor: "transparent" },
              "20%": { backgroundColor: "rgba(16,185,129,0.1)" },
              "40%": { backgroundColor: "transparent" },
              "60%": { backgroundColor: "rgba(16,185,129,0.06)" },
              "80%": { backgroundColor: "transparent" },
              "100%": { backgroundColor: "transparent" },
            },
            ...keyframes.fadeInUp,
            transition: `background-color ${timing.fast} ${easing.elegant}, box-shadow ${timing.fast} ${easing.elegant}`,
            "&:hover": {
              bgcolor: isSelected ? alpha(statusColor.color, 0.12) : "#eceef0",
            },
          }}
        >
          {/* Expand/Collapse Button */}
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
                  backgroundColor: brand.primary,
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
              <Tooltip title={`Status changed: ${statusText[row._originalStatus]} → ${statusText[row.status]}`}>
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
            {/* Live CRM Update Badge */}
            {isLiveUpdated && (
              <Tooltip title="Updated live from CRM">
                <SyncIcon
                  sx={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    fontSize: 14,
                    color: "#10b981",
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: "50%",
                    padding: "2px",
                    boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.2)}`,
                  }}
                />
              </Tooltip>
            )}
          </Box>

          {/* Opportunity ID */}
          <Box sx={{ overflow: "hidden" }}>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.opportunityId}
            </Typography>
          </Box>

          {/* Account */}
          <Box sx={{ overflow: "hidden", display: "flex", alignItems: "center", gap: 0.75 }}>
            <AccountLogo accountName={row.account || ""} size={18} />
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.account}
            </Typography>
          </Box>

          {/* Date */}
          <Box sx={{ overflow: "hidden" }}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.creationDate
                ? new Date(row.creationDate).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "-"}
            </Typography>
          </Box>

          {/* Revenue */}
          <Box sx={{ textAlign: "right", overflow: "hidden" }}>
            {row.isManual && editingField === "revenue" ? (
              <TextField
                type="number"
                size="small"
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") setEditingField(null);
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{ width: 120 }}
                inputProps={{ style: { textAlign: "right", fontSize: "0.875rem", padding: "4px 8px" } }}
              />
            ) : (
              <Typography
                variant="body2"
                fontWeight={500}
                onClick={
                  row.isManual
                    ? (e) => {
                        e.stopPropagation();
                        setEditingField("revenue");
                        setEditValue(String(row.grossRevenue || 0));
                      }
                    : undefined
                }
                sx={row.isManual ? { cursor: "pointer", "&:hover": { textDecoration: "underline dotted" } } : undefined}
              >
                {formatCurrency(
                  shouldShowIO
                    ? calculatedRevenue
                    : shouldShowAllocated
                      ? showNetRevenue
                        ? row.allocatedNetRevenue
                        : row.allocatedGrossRevenue
                      : showNetRevenue
                        ? row.netRevenue
                        : row.grossRevenue
                )}
              </Typography>
            )}
            {/* Always show allocation info when filtered, regardless of display mode */}
            {row.isAllocated && !shouldShowIO && (
              <Typography variant="caption" color="text.secondary" display="block">
                {row.allocatedServiceLine}: {row.allocationPercentage}%
              </Typography>
            )}
            {showIO && (
              <Typography variant="caption" color="text.secondary" display="block">
                I&O: {ioPercentage.toFixed(0)}%
              </Typography>
            )}
          </Box>

          {/* Opportunity Name */}
          <Box sx={{ overflow: "hidden" }}>
            <Typography
              variant="body2"
              fontWeight={isSelected ? 600 : 400}
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.opportunity}
            </Typography>
          </Box>

          {/* Win % - only in Pipeline */}
          {showWinPercent && (
            <Box sx={{ textAlign: "right", overflow: "hidden" }}>
              {row.isManual && editingField === "winPct" ? (
                <TextField
                  type="number"
                  size="small"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit();
                    if (e.key === "Escape") setEditingField(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ width: 80 }}
                  inputProps={{
                    style: { textAlign: "right", fontSize: "0.8125rem", padding: "4px 8px" },
                    min: 0,
                    max: 100,
                  }}
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.8125rem",
                    ...(row.isManual ? { cursor: "pointer", "&:hover": { textDecoration: "underline dotted" } } : {}),
                  }}
                  onClick={
                    row.isManual
                      ? (e) => {
                          e.stopPropagation();
                          setEditingField("winPct");
                          setEditValue(String(row.winPct != null ? row.winPct : 0));
                        }
                      : undefined
                  }
                >
                  {row.winPct != null && !isNaN(row.winPct) ? `${Math.round(row.winPct)}%` : "- %"}
                </Typography>
              )}
            </Box>
          )}

          {/* Status - clickable for inline change */}
          <Box sx={{ overflow: "hidden" }}>
            <Tooltip title="Click to change status" arrow>
              <Chip
                label={statusText[row.status] || `Status ${row.status}`}
                size="small"
                variant="filled"
                onClick={handleStatusChipClick}
                sx={{
                  fontWeight: 500,
                  backgroundColor: statusColor.bgcolor,
                  color: statusColor.color,
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                  "&:hover": {
                    transform: "scale(1.05)",
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
              {statusOptions.map((opt) => (
                <MenuItem
                  key={opt.status}
                  selected={opt.status === row.status}
                  onClick={() => handleStatusSelect(opt.status)}
                  sx={{ fontSize: "0.85rem", py: 1 }}
                >
                  <ListItemText>{opt.label}</ListItemText>
                  {opt.status === row.status && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      current
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Menu>
            {/* Add comment indicator for lost opportunities (from CRM or status override) */}
            {row.status === 15 &&
              (() => {
                const overrideComment = useUserDataStore.getState().statusOverrides[row.opportunityId]?.comment;
                const lostComment = row.lostComment || overrideComment;
                return lostComment ? (
                  <Tooltip title={`Lost: ${lostComment}`}>
                    <CommentIcon fontSize="small" color="error" sx={{ ml: 0.5, verticalAlign: "middle" }} />
                  </Tooltip>
                ) : null;
              })()}
          </Box>

          {/* Technology */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            {/* Display technology partner tags only if they exist */}
            {technologyPartners.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "center" }}>
                {technologyPartners.map((partner) => (
                  <Chip
                    key={partner}
                    label={partner}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.info.main, 0.15),
                      color: theme.palette.info.main,
                      "& .MuiChip-label": {
                        px: 1,
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Staffing Need Button */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tooltip
              title={
                staffingNeedsCount > 0
                  ? `${staffingNeedsCount} need${staffingNeedsCount > 1 ? "s" : ""} — click to add`
                  : "Add a staffing need"
              }
              arrow
            >
              <IconButton
                size="small"
                aria-label={
                  staffingNeedsCount > 0
                    ? `${staffingNeedsCount} staffing need${staffingNeedsCount > 1 ? "s" : ""} — add more`
                    : "Add staffing need"
                }
                onClick={handleOpenStaffingNeed}
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: staffingNeedsCount > 0 ? alpha(theme.palette.warning.main, 0.1) : "transparent",
                  color: staffingNeedsCount > 0 ? theme.palette.warning.main : theme.palette.text.disabled,
                  transition: `all 0.2s ${easing.elegant}`,
                  "&:hover": {
                    bgcolor:
                      staffingNeedsCount > 0
                        ? alpha(theme.palette.warning.main, 0.18)
                        : alpha(theme.palette.text.primary, 0.06),
                    color: staffingNeedsCount > 0 ? theme.palette.warning.dark : theme.palette.text.secondary,
                  },
                }}
              >
                <Badge
                  badgeContent={staffingNeedsCount || undefined}
                  color="warning"
                  max={99}
                  sx={{
                    "& .MuiBadge-badge": {
                      fontSize: "0.6rem",
                      height: 14,
                      minWidth: 14,
                      padding: "0 3px",
                      top: -2,
                      right: -2,
                    },
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 16 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Collapsed details - Enhanced with fade-in animation */}
        <Collapse
          in={open}
          timeout={{
            enter: 300,
            exit: 200,
          }}
          unmountOnExit
          sx={{
            transition: `height ${timing.normal} ${easing.elegant} !important`,
          }}
        >
          <Box
            sx={{
              animation: open ? `fadeIn ${timing.normal} ${easing.elegant} both` : "none",
              ...keyframes.fadeIn,
              px: 2,
              pb: 1,
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

        {/* Status change confirmation dialog (for Booked/Lost) */}
        <Dialog
          open={statusDialogOpen}
          onClose={() => setStatusDialogOpen(false)}
          TransitionComponent={DialogTransition}
          onClick={(e) => e.stopPropagation()}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label={statusText[row.status]}
                size="small"
                sx={{ backgroundColor: statusColor.bgcolor, color: statusColor.color, fontWeight: 600 }}
              />
              <ArrowForwardIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Chip
                label={statusOptions.find((o) => o.status === pendingStatus)?.label || ""}
                size="small"
                color={pendingStatus === 14 ? "success" : "error"}
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </DialogTitle>
          <DialogContent>
            <DatePicker
              label={pendingStatus === 14 ? "Booking date" : "Loss date"}
              value={bookingDate}
              onChange={(value) => {
                if (value) setBookingDate(value);
              }}
              slotProps={{
                textField: { fullWidth: true, size: "small", sx: { mb: 2 } },
              }}
            />
            <TextField
              label="Comment (optional)"
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              inputProps={{ "aria-label": "Status change comment" }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)} size="small">
              Cancel
            </Button>
            <Button onClick={handleConfirmStatusDialog} variant="contained" size="small">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

OpportunityRow.displayName = "OpportunityRow";

export default OpportunityRow;
