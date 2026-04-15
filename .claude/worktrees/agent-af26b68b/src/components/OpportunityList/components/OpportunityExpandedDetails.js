/**
 * OpportunityExpandedDetails Component
 * Displays detailed information when a row is expanded
 * Performance optimized with React.memo
 */

import React, { memo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  alpha,
  useTheme,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  IconButton,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CommentIcon from "@mui/icons-material/Comment";
import EditIcon from "@mui/icons-material/Edit";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import OpportunityActions from "./OpportunityActions";
import { STATUS_COLORS, STATUS_TEXT } from "../../../utils/constants";
import { formatDateFR } from "../../../utils/formatters";
import { getTechnologyPartnerTags } from "../utils/opportunityUtils";
import { calculateRevenueWithSegmentLogic } from "../../PipelineTab/utils/revenueCalculations";
import { useStatusOverride, STATUS_OPTIONS } from "../../../contexts/StatusOverrideContext";

const formatDateSafely = formatDateFR;
const statusColors = STATUS_COLORS;
const statusText = STATUS_TEXT;

/**
 * Memoized component for opportunity expanded details
 * Shows comprehensive information about an opportunity
 */
const OpportunityExpandedDetails = memo(
  ({ row, showNetRevenue, showIO = true, setEditOpportunity, onManualOpportunityUpdated, initialActionsTab }) => {
    const theme = useTheme();
    const technologyPartners = getTechnologyPartnerTags(row);

    // Check if this is a manual opportunity
    const isManualOpportunity = row.isManual === true;

    // Status override context
    const { getEffectiveStatus, hasOverride, getOverride, setStatusOverride, removeStatusOverride } =
      useStatusOverride();

    // State for status change dialog
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState(null);
    const [statusComment, setStatusComment] = useState("");
    const [bookingDate, setBookingDate] = useState(new Date());

    // Get the opportunity ID and original status
    const opportunityId = row["Opportunity ID"];
    const originalStatus = row["_originalStatus"] || row["Status"];
    const currentStatus = row["Status"]; // This may already be overridden by App.js
    // Only show override indicator for non-manual opportunities
    const isOverridden = !isManualOpportunity && hasOverride(opportunityId);
    const override = !isManualOpportunity ? getOverride(opportunityId) : null;

    // Calculate I&O amount
    const ioAmount = calculateRevenueWithSegmentLogic(row, showNetRevenue);
    const totalAmount = showNetRevenue ? row["Net Revenue"] || 0 : row["Gross Revenue"] || 0;
    const ioPercentage = totalAmount > 0 ? (ioAmount / totalAmount) * 100 : 0;

    // Handle status click
    const handleStatusClick = (status) => {
      if (status !== currentStatus) {
        setSelectedNewStatus(status);
        setStatusComment("");
        setBookingDate(new Date()); // Reset to today
        setStatusDialogOpen(true);
      }
    };

    // Update manual opportunity directly in localStorage
    const updateManualOpportunity = (newStatus, bookingLostDate) => {
      try {
        const stored = localStorage.getItem("manual_opportunities");
        if (stored) {
          const opportunities = JSON.parse(stored);
          const updatedOpportunities = opportunities.map((opp) => {
            if (opp["Opportunity ID"] === opportunityId) {
              const updated = { ...opp, Status: newStatus };
              // Preserve original creation status for display purposes
              if (opp._creationStatus == null) {
                updated._creationStatus = opp.Status;
              }
              // Add booking/lost date if applicable
              if ((newStatus === 14 || newStatus === 15) && bookingLostDate) {
                updated["Booking/Lost Date"] = bookingLostDate;
              }
              // Clear booking date when going from booked/lost to a lower status
              if (newStatus !== 14 && newStatus !== 15 && (opp.Status === 14 || opp.Status === 15)) {
                delete updated["Booking/Lost Date"];
              }
              return updated;
            }
            return opp;
          });
          localStorage.setItem("manual_opportunities", JSON.stringify(updatedOpportunities));

          // Notify parent that manual opportunity was updated
          if (onManualOpportunityUpdated) {
            onManualOpportunityUpdated(opportunityId);
          }
        }
      } catch (error) {
        console.error("Error updating manual opportunity:", error);
      }
    };

    // Confirm status change
    const handleConfirmStatusChange = () => {
      if (selectedNewStatus !== null) {
        // Format booking/lost date as YYYY-MM-DD if status is Booked or Lost
        const formattedDate =
          (selectedNewStatus === 14 || selectedNewStatus === 15) && bookingDate
            ? bookingDate.toISOString().split("T")[0]
            : null;

        if (isManualOpportunity) {
          // For manual opportunities, update directly in localStorage
          updateManualOpportunity(selectedNewStatus, formattedDate);
        } else {
          // For imported opportunities, create a status override
          setStatusOverride(opportunityId, originalStatus, selectedNewStatus, statusComment, formattedDate);
        }

        setStatusDialogOpen(false);
        setSelectedNewStatus(null);
        setStatusComment("");
      }
    };

    // Revert status override
    const handleRevertStatus = () => {
      removeStatusOverride(opportunityId);
    };

    // Get status color based on Pipeline by Status categories
    const getStatusColor = (status) => {
      switch (status) {
        case 1: // Lead Identified
        case 4: // Go Approved
          return {
            bgcolor: alpha(theme.palette.primary.light, 0.15),
            color: theme.palette.primary.light,
            borderColor: alpha(theme.palette.primary.light, 0.3),
            headerBg: theme.palette.primary.light,
          };
        case 6: // Proposal Submitted
          return {
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            color: theme.palette.primary.main,
            borderColor: alpha(theme.palette.primary.main, 0.3),
            headerBg: theme.palette.primary.main,
          };
        case 11: // Client Won
        case 13: // AEL
          return {
            bgcolor: alpha(theme.palette.primary.dark, 0.15),
            color: theme.palette.primary.dark,
            borderColor: alpha(theme.palette.primary.dark, 0.3),
            headerBg: theme.palette.primary.dark,
          };
        case 14: // Booked
          return {
            bgcolor: alpha(theme.palette.success.main, 0.15),
            color: theme.palette.success.main,
            borderColor: alpha(theme.palette.success.main, 0.3),
            headerBg: theme.palette.success.main,
          };
        case 15: // Lost
          return {
            bgcolor: alpha(theme.palette.error.main, 0.15),
            color: theme.palette.error.main,
            borderColor: alpha(theme.palette.error.main, 0.3),
            headerBg: theme.palette.error.main,
          };
        default:
          return {
            bgcolor: alpha(theme.palette.grey[500], 0.15),
            color: theme.palette.grey[700],
            borderColor: alpha(theme.palette.grey[500], 0.3),
            headerBg: theme.palette.grey[500],
          };
      }
    };

    const statusColor = getStatusColor(row["Status"]);

    return (
      <Box sx={{ m: 2 }}>
        <Card
          variant="outlined"
          sx={{
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.background.paper, 0.7),
            border: `1px solid ${alpha(statusColor.headerBg, 0.1)}`,
            overflow: "hidden",
            boxShadow: `0 4px 20px ${alpha(statusColor.headerBg, 0.08)}`,
            transition: "all 0.2s ease",
            "&:hover": {
              boxShadow: `0 6px 24px ${alpha(statusColor.headerBg, 0.12)}`,
            },
          }}
        >
          {/* Opportunity Title Banner */}
          <Box
            sx={{
              p: 2.5,
              bgcolor: alpha(statusColor.headerBg, 0.06),
              borderBottom: `1px solid ${alpha(statusColor.headerBg, 0.1)}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundImage: `linear-gradient(to right, ${alpha(
                statusColor.headerBg,
                0.1
              )}, ${alpha(statusColor.headerBg, 0.04)})`,
            }}
          >
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                {row["CRM Link"] ? (
                  <Typography
                    variant="h6"
                    color="primary.main"
                    fontWeight={700}
                    component="a"
                    href={row["CRM Link"]}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        textDecoration: "underline",
                        color: theme.palette.primary.dark,
                        transform: "translateX(2px)",
                      },
                      "&:active": {
                        transform: "translateX(1px)",
                      },
                      display: "flex",
                      alignItems: "center",
                      mr: 2,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row["Opportunity"]}
                    <Box
                      component="span"
                      sx={{
                        ml: 1,
                        fontSize: "0.8rem",
                        opacity: 0.7,
                        transition: "opacity 0.2s ease",
                        "&:hover": {
                          opacity: 1,
                        },
                      }}
                    >
                      🔗
                    </Box>
                  </Typography>
                ) : (
                  <Typography variant="h6" color="primary.main" fontWeight={700} sx={{ mr: 2 }}>
                    {row["Opportunity"]}
                  </Typography>
                )}

                {/* Win Percentage Chip */}
                {row["Win %"] && (
                  <Chip
                    label={`${row["Win %"]}%`}
                    color={row["Win %"] >= 75 ? "success" : row["Win %"] >= 50 ? "warning" : "error"}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      mr: 1,
                      boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.12)}`,
                    }}
                  />
                )}

                {/* Job Code Chip */}
                {row["Job Code"] && (
                  <Chip
                    label={row["Job Code"]}
                    variant="outlined"
                    size="small"
                    sx={{
                      fontWeight: 500,
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      color: theme.palette.primary.main,
                    }}
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary">
                ID: {row["Opportunity ID"]} • Created: {formatDateSafely(row["Creation Date"])}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Edit button for manual opportunities */}
              {row.isManual && setEditOpportunity && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setEditOpportunity(row)}
                  sx={{
                    borderColor: theme.palette.info.main,
                    color: theme.palette.info.main,
                    "&:hover": {
                      borderColor: theme.palette.info.dark,
                      backgroundColor: alpha(theme.palette.info.main, 0.08),
                    },
                  }}
                >
                  Edit
                </Button>
              )}

              {/* Override indicator and revert button */}
              {isOverridden && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
                  <Tooltip
                    title={`Status modified: ${statusText[override?.originalStatus]} → ${statusText[override?.newStatus]}`}
                  >
                    <Chip
                      icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                      label="Modified"
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </Tooltip>
                  <Tooltip title="Undo modification">
                    <IconButton
                      size="small"
                      onClick={handleRevertStatus}
                      sx={{
                        color: theme.palette.warning.main,
                        "&:hover": {
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                        },
                      }}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* Status Timeline */}
              {(() => {
                const displayStatus = currentStatus;
                const isLost = displayStatus === 15;
                const isBooked = displayStatus === 14;

                // Define the status steps in order
                const statusSteps = [
                  { status: 1, label: "Lead", fullLabel: "Lead Identified" },
                  { status: 4, label: "Go", fullLabel: "Go Approved" },
                  { status: 6, label: "Proposal", fullLabel: "Proposal Submitted" },
                  { status: 11, label: "Won", fullLabel: "Client Won" },
                  { status: 14, label: "Booked", fullLabel: "Booked" },
                ];

                // Find current step index
                const currentStepIndex = statusSteps.findIndex((s) => s.status === displayStatus);
                // Handle AEL (13) as equivalent to Won (11)
                const effectiveIndex = displayStatus === 13 ? 3 : currentStepIndex;

                return (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                      {statusSteps.map((step, index) => {
                        const isPast = index < effectiveIndex;
                        const isCurrent = index === effectiveIndex;
                        const isFirst = index === 0;
                        const isLast = index === statusSteps.length - 1;

                        // Get color for this step
                        const getStepColor = () => {
                          if (isLost) return theme.palette.grey[400];
                          if (isPast) return theme.palette.success.main;
                          if (isCurrent) return statusColor.headerBg;
                          return theme.palette.grey[300];
                        };

                        const stepColor = getStepColor();

                        return (
                          <React.Fragment key={step.status}>
                            {/* Connector line before circle (except first) */}
                            {index > 0 && (
                              <Box
                                sx={{
                                  width: 40,
                                  height: 2,
                                  bgcolor: isPast || isCurrent ? stepColor : theme.palette.grey[300],
                                  transition: "all 0.3s ease",
                                  mt: "20px",
                                }}
                              />
                            )}

                            {/* Status circle with label - CLICKABLE */}
                            <Tooltip title={`Change to "${step.fullLabel}"`} arrow>
                              <Box
                                onClick={() => handleStatusClick(step.status)}
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  minWidth: 50,
                                  cursor: "pointer",
                                  "&:hover": {
                                    "& .status-circle": {
                                      transform: "scale(1.3)",
                                      boxShadow: `0 0 12px ${alpha(stepColor, 0.6)}`,
                                    },
                                    "& .status-label": {
                                      fontWeight: 600,
                                    },
                                  },
                                }}
                              >
                                {/* Step label - above the circle */}
                                <Typography
                                  className="status-label"
                                  variant="caption"
                                  sx={{
                                    mb: 0.5,
                                    fontSize: "0.65rem",
                                    fontWeight: isCurrent ? 600 : 400,
                                    color: isPast || isCurrent ? stepColor : "text.disabled",
                                    whiteSpace: "nowrap",
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  {step.label}
                                </Typography>

                                <Box
                                  className="status-circle"
                                  sx={{
                                    width: isCurrent ? 14 : 10,
                                    height: isCurrent ? 14 : 10,
                                    borderRadius: "50%",
                                    bgcolor: isPast || isCurrent ? stepColor : "transparent",
                                    border: `2px solid ${stepColor}`,
                                    transition: "all 0.2s ease",
                                    boxShadow: isCurrent ? `0 0 8px ${alpha(stepColor, 0.5)}` : "none",
                                  }}
                                />

                                {/* Creation date under first step */}
                                {isFirst && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      mt: 0.5,
                                      fontSize: "0.55rem",
                                      color: "text.secondary",
                                    }}
                                  >
                                    {formatDateSafely(row["Creation Date"])}
                                  </Typography>
                                )}

                                {/* Last Status Change Date under current step (except first and booked) */}
                                {isCurrent && !isFirst && !isBooked && row["Last Status Change Date"] && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      mt: 0.5,
                                      fontSize: "0.55rem",
                                      color: stepColor,
                                    }}
                                  >
                                    {formatDateSafely(row["Last Status Change Date"])}
                                  </Typography>
                                )}

                                {/* Booking date under last step when booked */}
                                {isLast && isBooked && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      mt: 0.5,
                                      fontSize: "0.55rem",
                                      color: theme.palette.success.main,
                                    }}
                                  >
                                    {formatDateSafely(row["Booking/Lost Date"])}
                                  </Typography>
                                )}
                              </Box>
                            </Tooltip>
                          </React.Fragment>
                        );
                      })}

                      {/* Lost indicator - CLICKABLE */}
                      <Tooltip title={isLost ? "Current status" : 'Change to "Lost"'} arrow>
                        <Box
                          onClick={() => !isLost && handleStatusClick(15)}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            ml: 1,
                            cursor: isLost ? "default" : "pointer",
                            opacity: isLost ? 1 : 0.5,
                            "&:hover": !isLost
                              ? {
                                  opacity: 1,
                                  "& .lost-circle": {
                                    transform: "scale(1.3)",
                                    boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.6)}`,
                                  },
                                }
                              : {},
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              mb: 0.5,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              color: theme.palette.error.main,
                            }}
                          >
                            Lost
                          </Typography>
                          <Box
                            className="lost-circle"
                            sx={{
                              width: isLost ? 14 : 10,
                              height: isLost ? 14 : 10,
                              borderRadius: "50%",
                              bgcolor: isLost ? theme.palette.error.main : "transparent",
                              border: `2px solid ${theme.palette.error.main}`,
                              boxShadow: isLost ? `0 0 8px ${alpha(theme.palette.error.main, 0.5)}` : "none",
                              transition: "all 0.2s ease",
                            }}
                          />
                          {isLost && (
                            <Typography
                              variant="caption"
                              sx={{
                                mt: 0.5,
                                fontSize: "0.55rem",
                                color: theme.palette.error.main,
                              }}
                            >
                              {formatDateSafely(row["Booking/Lost Date"])}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })()}
            </Box>

            {/* Status Change Confirmation Dialog */}
            <Dialog
              open={statusDialogOpen}
              onClose={() => setStatusDialogOpen(false)}
              maxWidth="xs"
              fullWidth
              PaperProps={{
                sx: { borderRadius: 2 },
              }}
            >
              <DialogTitle
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <WarningAmberIcon color="warning" />
                  <Typography variant="h6" fontWeight={600}>
                    Change Status
                  </Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ pt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  You are about to change the status of this opportunity from{" "}
                  <strong>{statusText[originalStatus]}</strong> to <strong>{statusText[selectedNewStatus]}</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  This change is local and can be undone at any time.
                </Typography>

                {/* Date picker for Booked or Lost status */}
                {(selectedNewStatus === 14 || selectedNewStatus === 15) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {selectedNewStatus === 14 ? "Booking Date" : "Lost Date"} (default: today)
                    </Typography>
                    <DatePicker
                      label={selectedNewStatus === 14 ? "Booking Date" : "Lost Date"}
                      value={bookingDate}
                      onChange={(newDate) => setBookingDate(newDate)}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                        },
                      }}
                    />
                  </Box>
                )}

                <TextField
                  label="Comment (optional)"
                  placeholder="Reason for change..."
                  multiline
                  rows={2}
                  fullWidth
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  size="small"
                />
              </DialogContent>
              <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
                <Button variant="contained" color="warning" onClick={handleConfirmStatusChange}>
                  Confirm
                </Button>
              </DialogActions>
            </Dialog>
          </Box>

          {/* Lost Comment Section - Only for lost opportunities */}
          {row["Status"] === 15 && row["Lost Comment"] && (
            <Box
              sx={{
                p: 2.5,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
              }}
            >
              <Box
                sx={{
                  backgroundColor: "rgb(254, 242, 242)",
                  borderRadius: "8px",
                  border: "1px solid rgb(254, 226, 226)",
                  maxWidth: "95%",
                  mx: "auto",
                  p: 2,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                  <CommentIcon color="error" sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={600} color="error.main">
                    Lost Comment
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    borderRadius: 1,
                    borderLeft: `3px solid ${theme.palette.error.main}`,
                    fontStyle: "italic",
                  }}
                >
                  "{row["Lost Comment"]}"
                </Typography>
              </Box>
            </Box>
          )}

          {/* Total Opportunity Amount - Improved Allocation Display */}
          <Box
            sx={{
              p: 2.5,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: row["Is Allocated"] ? 1.5 : 0,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} color="primary.main">
                Total Opportunity {showNetRevenue ? "Net Amount" : "Gross Amount"}
              </Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(showNetRevenue ? row["Net Revenue"] || 0 : row["Gross Revenue"] || 0)}
              </Typography>
            </Box>

            {/* Allocation Information - Only shown when allocated */}
            {row["Is Allocated"] && (
              <Box
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.secondary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: `0 2px 8px ${alpha(theme.palette.secondary.main, 0.1)}`,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={500}
                    color="secondary.main"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "secondary.main",
                        mr: 1,
                      }}
                    />
                    Allocated to {row["Allocated Service Line"]}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="secondary.dark">
                    {row["Allocation Percentage"]}% of total value
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="secondary.main">
                    {row["Allocated Service Line"]} Amount
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="secondary.main">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(showNetRevenue ? row["Allocated Net Revenue"] || 0 : row["Allocated Gross Revenue"] || 0)}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* I&O Information - Only shown when showIO is true and ioAmount > 0 */}
            {showIO && ioAmount > 0 && (
              <Box
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={500}
                    color="primary.main"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        mr: 1,
                      }}
                    />
                    Allocated to I&O
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="primary.dark">
                    {Math.round(ioPercentage)}% of total value
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="primary.main">
                    I&O Amount
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(ioAmount)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          <CardContent sx={{ p: 0 }}>
            <Grid container>
              {/* Opportunity Details - Left Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  borderRight: {
                    xs: "none",
                    md: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  },
                  borderBottom: {
                    xs: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                    md: "none",
                  },
                  backgroundColor: alpha(theme.palette.background.default, 0.3),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="primary.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      mr: 1,
                    }}
                  />
                  Opportunity Details
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Account
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
                      {row["Account"]}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Project Type
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
                      {row["Project Type"] || "-"}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Contribution Margin
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["CM1%"] ? `${row["CM1%"]}%` : "-"}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Booking Dates
                    </Typography>
                    <Box sx={{ mb: 2, mt: 0.5, pl: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
                          Estimated:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatDateSafely(row["Estimated Booking Date"])}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
                          Actual:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatDateSafely(row["Booking/Lost Date"])}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      Segment
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
                      {row["Sub Segment Code"] || "-"}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Sub Segment
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["Sub Segment"] || "-"}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Technology Partners Section */}
                {technologyPartners.length > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                      Technology Partners
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                      {technologyPartners.map((partner, index) => (
                        <Chip
                          key={index}
                          label={partner}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: "0.7rem",
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
                  </>
                )}
              </Grid>

              {/* Service Offerings - Center Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  borderRight: {
                    xs: "none",
                    md: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  },
                  borderBottom: {
                    xs: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                    md: "none",
                  },
                  background: alpha(theme.palette.background.paper, 0.6),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="secondary.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "secondary.main",
                      mr: 1,
                    }}
                  />
                  Service Offerings
                </Typography>

                {/* Service Line 1 */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Primary Service
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {row["Service Line 1"]}
                  </Typography>

                  {/* Show offering/allocation info if either exists */}
                  {(row["Service Offering 1"] ||
                    (row["Allocation 1"] && row["Allocation 1"] > 0) ||
                    (row["Service Offering 1 %"] && row["Service Offering 1 %"] > 0)) && (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                        mt: 0.5,
                        p: 0.75,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                          {row["Service Offering 1"] || "—"}
                        </Typography>
                        {((row["Allocation 1"] && row["Allocation 1"] > 0) ||
                          (row["Service Offering 1 %"] && row["Service Offering 1 %"] > 0)) && (
                          <Chip
                            label={`${row["Allocation 1"] || row["Service Offering 1 %"]}%`}
                            size="small"
                            sx={{
                              ml: 1,
                              height: 20,
                              fontSize: "0.7rem",
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(
                          ((showNetRevenue ? row["Net Revenue"] : row["Gross Revenue"]) || 0) *
                            ((row["Allocation 1"] || row["Service Offering 1 %"] || 0) / 100)
                        )}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Service Line 2 */}
                {row["Service Line 2"] && row["Service Line 2"] !== "-" && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Secondary Service
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["Service Line 2"]}
                    </Typography>

                    {/* Show offering/allocation info if either exists */}
                    {(row["Service Offering 2"] ||
                      (row["Allocation 2"] && row["Allocation 2"] > 0) ||
                      (row["Service Offering 2 %"] && row["Service Offering 2 %"] > 0)) && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1,
                          mt: 0.5,
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.secondary.main, 0.05),
                          border: `1px solid ${alpha(theme.palette.secondary.main, 0.08)}`,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                            {row["Service Offering 2"] || "—"}
                          </Typography>
                          {((row["Allocation 2"] && row["Allocation 2"] > 0) ||
                            (row["Service Offering 2 %"] && row["Service Offering 2 %"] > 0)) && (
                            <Chip
                              label={`${row["Allocation 2"] || row["Service Offering 2 %"]}%`}
                              size="small"
                              sx={{
                                ml: 1,
                                height: 20,
                                fontSize: "0.7rem",
                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                color: theme.palette.secondary.main,
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="secondary.main">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(
                            ((showNetRevenue ? row["Net Revenue"] : row["Gross Revenue"]) || 0) *
                              ((row["Allocation 2"] || row["Service Offering 2 %"] || 0) / 100)
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Service Line 3 */}
                {row["Service Line 3"] && row["Service Line 3"] !== "-" && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Tertiary Service
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["Service Line 3"]}
                    </Typography>

                    {/* Show offering/allocation info if either exists */}
                    {(row["Service Offering 3"] ||
                      (row["Allocation 3"] && row["Allocation 3"] > 0) ||
                      (row["Service Offering 3 %"] && row["Service Offering 3 %"] > 0)) && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mt: 0.5,
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.info.main, 0.05),
                          border: `1px solid ${alpha(theme.palette.info.main, 0.08)}`,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                            {row["Service Offering 3"] || "—"}
                          </Typography>
                          {((row["Allocation 3"] && row["Allocation 3"] > 0) ||
                            (row["Service Offering 3 %"] && row["Service Offering 3 %"] > 0)) && (
                            <Chip
                              label={`${row["Allocation 3"] || row["Service Offering 3 %"]}%`}
                              size="small"
                              sx={{
                                ml: 1,
                                height: 20,
                                fontSize: "0.7rem",
                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                color: theme.palette.info.main,
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="info.main">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(
                            ((showNetRevenue ? row["Net Revenue"] : row["Gross Revenue"]) || 0) *
                              ((row["Allocation 3"] || row["Service Offering 3 %"] || 0) / 100)
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Grid>

              {/* Team Information - Right Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  p: 2.5,
                  backgroundColor: alpha(theme.palette.background.default, 0.3),
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="info.main"
                  fontWeight={700}
                  sx={{ mb: 2, display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "info.main",
                      mr: 1,
                    }}
                  />
                  Team Information
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Engagement Manager
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
                      {row["EM"] || "Not assigned"}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Manager
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["Manager"] || "Not assigned"}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Engagement Partner
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
                      {row["EP"] || "Not assigned"}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Partner
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {row["Partner"] || "Not assigned"}
                    </Typography>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>

            {/* Add the OpportunityActions component here with the opportunity details */}
            <OpportunityActions
              opportunityId={row["Opportunity ID"]}
              opportunityName={row["Opportunity"]}
              opportunityDetails={{
                EM: row["EM"],
                EP: row["EP"],
                Account: row["Account"],
                Status: statusText[row["Status"]] || `Status ${row["Status"]}`,
                Revenue: row["Gross Revenue"],
                ServiceLine: row["Service Line 1"],
              }}
              initialTab={initialActionsTab}
            />
          </CardContent>
        </Card>
      </Box>
    );
  }
);

OpportunityExpandedDetails.displayName = "OpportunityExpandedDetails";

export default OpportunityExpandedDetails;
