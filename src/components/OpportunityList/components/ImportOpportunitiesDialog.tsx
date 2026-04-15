/**
 * ImportOpportunitiesDialog Component
 * Displays import results for manual opportunities with comparison view
 * Extracted from OpportunityToolbar for better separation of concerns
 */

import React, { memo } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import DialogTransition from "../../common/DialogTransition";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";

const ImportOpportunitiesDialog = memo(({ open, onClose, importResult }: any) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {importResult?.success ? (
            <>
              <CheckCircleIcon sx={{ fontSize: 28, color: "success.main" }} />
              <Typography variant="h6" fontWeight={600}>
                Import Results
              </Typography>
            </>
          ) : (
            <>
              <ErrorIcon sx={{ fontSize: 28, color: "error.main" }} />
              <Typography variant="h6" fontWeight={600}>
                Import Failed
              </Typography>
            </>
          )}
        </Box>
        {importResult?.success && importResult?.details && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Chip
              icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
              label={`${importResult.details.opportunities.created.length} Created`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<UpdateIcon sx={{ fontSize: 16 }} />}
              label={`${importResult.details.opportunities.updated.length} Updated`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<BlockIcon sx={{ fontSize: 16 }} />}
              label={`${importResult.details.opportunities.skipped.length} Skipped`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 2 }}>
        {importResult?.success && importResult?.details ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* All opportunities with comparison view */}
            {[
              ...importResult.details.opportunities.created,
              ...importResult.details.opportunities.updated,
              ...importResult.details.opportunities.skipped,
            ].map((item, idx) => {
              const isCreated = item.decision === "created";
              const isUpdated = item.decision === "updated";

              const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
              const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

              // Determine which fields changed (for highlighting)
              const statusChanged = item.existing && item.existing.statusCode !== item.imported.statusCode;
              const accountChanged = item.existing && item.existing.account !== item.imported.account;
              const revenueChanged = item.existing && item.existing.revenue !== item.imported.revenue;
              const managerChanged = item.existing && item.existing.manager !== item.imported.manager;

              return (
                <Box
                  key={idx}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                  }}
                >
                  {/* Header with opportunity ID, name and decision */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Chip
                        label={item.opportunityId}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.7rem", height: 20 }}
                      />
                      <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
                        {item.opportunityName}
                      </Typography>
                    </Box>
                    <Chip
                      icon={<DecisionIcon sx={{ fontSize: 14 }} />}
                      label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                      size="small"
                      color={decisionColor}
                      sx={{ fontWeight: 600, height: 24 }}
                    />
                  </Box>

                  {/* Comparison: Left (Existing) vs Right (Imported) */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      alignItems: "stretch",
                    }}
                  >
                    {/* Left side: Existing data */}
                    <Box
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: item.existing
                          ? alpha(theme.palette.grey[500], 0.08)
                          : alpha(theme.palette.grey[300], 0.1),
                        border: `1px solid ${alpha(theme.palette.grey[400], 0.2)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        color="text.secondary"
                        sx={{
                          display: "block",
                          mb: 1,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Existing
                      </Typography>
                      {item.existing ? (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              bgcolor: statusChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            <strong>Status:</strong> {item.existing.status}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              bgcolor: accountChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            <strong>Account:</strong> {item.existing.account}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              bgcolor: revenueChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            <strong>Revenue:</strong> {item.existing.revenue}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              bgcolor: managerChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            <strong>Manager:</strong> {item.existing.manager}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
                          No existing data
                        </Typography>
                      )}
                    </Box>

                    {/* Arrow */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        px: 0.5,
                      }}
                    >
                      <ArrowForwardIcon
                        sx={{
                          fontSize: 24,
                          color: `${decisionColor}.main`,
                        }}
                      />
                    </Box>

                    {/* Right side: Imported data */}
                    <Box
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        color={`${decisionColor}.main`}
                        sx={{
                          display: "block",
                          mb: 1,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Imported
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            bgcolor: statusChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                            px: 0.5,
                            borderRadius: 0.5,
                            fontWeight: statusChanged ? 600 : 400,
                          }}
                        >
                          <strong>Status:</strong> {item.imported.status}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            bgcolor: accountChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                            px: 0.5,
                            borderRadius: 0.5,
                            fontWeight: accountChanged ? 600 : 400,
                          }}
                        >
                          <strong>Account:</strong> {item.imported.account}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            bgcolor: revenueChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                            px: 0.5,
                            borderRadius: 0.5,
                            fontWeight: revenueChanged ? 600 : 400,
                          }}
                        >
                          <strong>Revenue:</strong> {item.imported.revenue}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            bgcolor: managerChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                            px: 0.5,
                            borderRadius: 0.5,
                            fontWeight: managerChanged ? 600 : 400,
                          }}
                        >
                          <strong>Manager:</strong> {item.imported.manager}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Reason */}
                  <Box
                    sx={{
                      mt: 1.5,
                      pt: 1,
                      borderTop: `1px dashed ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                    }}
                  >
                    <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500}>
                      {isCreated ? "\u2713" : isUpdated ? "\u21BB" : "\u2298"} {item.reason}
                    </Typography>
                  </Box>
                </Box>
              );
            })}

            {/* Empty state */}
            {importResult.details.opportunities.created.length === 0 &&
              importResult.details.opportunities.updated.length === 0 &&
              importResult.details.opportunities.skipped.length === 0 && (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No opportunities were found in the import file.
                  </Typography>
                </Box>
              )}
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body1" color="error.main">
              {importResult?.error || "An unknown error occurred during import."}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          color={importResult?.success ? "primary" : "error"}
          sx={{ px: 4 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ImportOpportunitiesDialog.displayName = "ImportOpportunitiesDialog";

export default ImportOpportunitiesDialog;
