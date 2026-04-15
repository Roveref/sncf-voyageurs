/**
 * OpportunityStatusTimeline — Status step indicator + change dialog
 * Extracted from OpportunityExpandedDetails for line count reduction.
 */
import React, { memo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { STATUS_TEXT } from "../../../utils/constants";
import { formatDateFR } from "../../../utils/formatters";

const statusText = STATUS_TEXT;
const formatDateSafely = formatDateFR;

interface StatusTimelineProps {
  currentStatus: number;
  originalStatus: number;
  isManualOpportunity: boolean;
  statusColor: { headerBg: string };
  row: any;
  onStatusChange: (newStatus: number, comment: string, bookingDate: Date) => void;
}

const OpportunityStatusTimeline = memo(
  ({ currentStatus, originalStatus, isManualOpportunity, statusColor, row, onStatusChange }: StatusTimelineProps) => {
    const theme = useTheme();

    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState<number | null>(null);
    const [statusComment, setStatusComment] = useState("");
    const [bookingDate, setBookingDate] = useState(new Date());

    const displayStatus = currentStatus;
    const isLost = displayStatus === 15;
    const isBooked = displayStatus === 14;

    const statusSteps = [
      { status: 1, label: "Lead", fullLabel: "Lead Identified" },
      { status: 4, label: "Go", fullLabel: "Go Approved" },
      { status: 6, label: "Proposal", fullLabel: "Proposal Submitted" },
      { status: 11, label: "Won", fullLabel: "Client Won" },
      { status: 14, label: "Booked", fullLabel: "Booked" },
    ];

    const currentStepIndex = statusSteps.findIndex((s) => s.status === displayStatus);
    const effectiveIndex = displayStatus === 13 ? 3 : currentStepIndex;

    const handleStatusClick = (status: number) => {
      if (status !== currentStatus) {
        setSelectedNewStatus(status);
        setStatusComment("");
        setBookingDate(new Date());
        setStatusDialogOpen(true);
      }
    };

    const handleConfirmStatusChange = () => {
      if (selectedNewStatus !== null) {
        onStatusChange(selectedNewStatus, statusComment, bookingDate);
        setStatusDialogOpen(false);
        setSelectedNewStatus(null);
        setStatusComment("");
      }
    };

    return (
      <>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {statusSteps.map((step, index) => {
              const isPast = index < effectiveIndex;
              const isCurrent = index === effectiveIndex;
              const isFirst = index === 0;
              const isLast = index === statusSteps.length - 1;

              const getStepColor = () => {
                if (isLost) return theme.palette.grey[400];
                if (isPast) return theme.palette.success.main;
                if (isCurrent) return statusColor.headerBg;
                return theme.palette.grey[300];
              };

              const stepColor = getStepColor();

              return (
                <React.Fragment key={step.status}>
                  {index > 0 && (
                    <Box
                      sx={{
                        width: 40,
                        height: 2,
                        bgcolor: isPast || isCurrent ? stepColor : theme.palette.grey[300],
                        transition: "background-color 0.3s ease",
                        mt: "20px",
                      }}
                    />
                  )}

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
                      <Typography
                        className="status-label"
                        variant="caption"
                        sx={{
                          mb: 0.5,
                          fontSize: "0.65rem",
                          fontWeight: isCurrent ? 600 : 400,
                          color: isPast || isCurrent ? stepColor : "text.disabled",
                          whiteSpace: "nowrap",
                          transition: "font-weight 0.2s ease, color 0.2s ease",
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
                          bgcolor: isPast || isCurrent ? stepColor : alpha(stepColor, 0.3),
                          transition:
                            "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, width 0.2s ease, height 0.2s ease",
                          boxShadow: isCurrent ? `0 0 8px ${alpha(stepColor, 0.5)}` : "none",
                        }}
                      />

                      {isFirst && (
                        <Typography
                          variant="caption"
                          sx={{
                            mt: 0.5,
                            fontSize: "0.55rem",
                            color: "text.secondary",
                          }}
                        >
                          {formatDateSafely(row.creationDate)}
                        </Typography>
                      )}

                      {isCurrent && !isFirst && !isBooked && row.lastStatusChangeDate && (
                        <Typography
                          variant="caption"
                          sx={{
                            mt: 0.5,
                            fontSize: "0.55rem",
                            color: stepColor,
                          }}
                        >
                          {formatDateSafely(row.lastStatusChangeDate)}
                        </Typography>
                      )}

                      {isLast && isBooked && (
                        <Typography
                          variant="caption"
                          sx={{
                            mt: 0.5,
                            fontSize: "0.55rem",
                            color: theme.palette.success.main,
                          }}
                        >
                          {formatDateSafely(row.bookingDate)}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                </React.Fragment>
              );
            })}

            {/* Lost indicator */}
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
                    bgcolor: isLost ? theme.palette.error.main : alpha(theme.palette.error.main, 0.3),
                    boxShadow: isLost ? `0 0 8px ${alpha(theme.palette.error.main, 0.5)}` : "none",
                    transition:
                      "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, width 0.2s ease, height 0.2s ease",
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
                    {formatDateSafely(row.bookingDate)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          </Box>
        </Box>

        {/* Status Change Confirmation Dialog */}
        <Dialog
          open={statusDialogOpen}
          onClose={() => setStatusDialogOpen(false)}
          TransitionComponent={DialogTransition}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 },
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.08),
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
              You are about to change the status of this opportunity from <strong>{statusText[originalStatus]}</strong>{" "}
              to <strong>{statusText[selectedNewStatus as any]}</strong>.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This change is local and can be undone at any time.
            </Typography>

            {(selectedNewStatus === 14 || selectedNewStatus === 15) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {selectedNewStatus === 14 ? "Booking Date" : "Lost Date"} (default: today)
                </Typography>
                <DatePicker
                  label={selectedNewStatus === 14 ? "Booking Date" : "Lost Date"}
                  value={bookingDate}
                  onChange={(newDate) => setBookingDate(newDate || new Date())}
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
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={handleConfirmStatusChange}>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

OpportunityStatusTimeline.displayName = "OpportunityStatusTimeline";

export { OpportunityStatusTimeline };
