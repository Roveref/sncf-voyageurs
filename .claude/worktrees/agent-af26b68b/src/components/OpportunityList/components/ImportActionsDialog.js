/**
 * ImportActionsDialog Component
 * Displays import results for actions & comments with comparison view
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";

const ImportActionsDialog = memo(({ open, onClose, importResult }) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
                Import Results - Actions & Comments
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
        {importResult?.success && importResult?.actions && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Chip
              icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
              label={`${(importResult.actions?.created?.length || 0) + (importResult.comments?.created?.length || 0)} Created`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<UpdateIcon sx={{ fontSize: 16 }} />}
              label={`${(importResult.actions?.updated?.length || 0) + (importResult.comments?.updated?.length || 0)} Updated`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<BlockIcon sx={{ fontSize: 16 }} />}
              label={`${(importResult.actions?.skipped?.length || 0) + (importResult.comments?.skipped?.length || 0)} Skipped`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 2, maxHeight: "60vh" }}>
        {importResult?.success && importResult?.actions ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Actions Section */}
            {(importResult.actions.created.length > 0 ||
              importResult.actions.updated.length > 0 ||
              importResult.actions.skipped.length > 0) && (
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    mb: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 20 }} /> Actions
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {[
                    ...importResult.actions.created,
                    ...importResult.actions.updated,
                    ...importResult.actions.skipped,
                  ].map((item, idx) => {
                    const isCreated = item.decision === "created";
                    const isUpdated = item.decision === "updated";
                    const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                    const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                    return (
                      <Box
                        key={`action-${idx}`}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                          border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                        }}
                      >
                        {/* Header */}
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

                        {/* Comparison */}
                        <Box
                          sx={{
                            display: "flex",
                            gap: 2,
                            alignItems: "stretch",
                          }}
                        >
                          {/* Left: Existing */}
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
                                    bgcolor: item.changes?.includes("description")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Description:</strong> {item.existing.description}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    bgcolor: item.changes?.includes("owner")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Owner:</strong> {item.existing.owner}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    bgcolor: item.changes?.includes("status")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
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
                                    bgcolor: item.changes?.includes("priority")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Priority:</strong> {item.existing.priority}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    bgcolor: item.changes?.includes("dueDate")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Due:</strong> {item.existing.dueDate}
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

                          {/* Right: Imported */}
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
                                  bgcolor: item.changes?.includes("description")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("description") ? 600 : 400,
                                }}
                              >
                                <strong>Description:</strong> {item.imported.description}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: item.changes?.includes("owner")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("owner") ? 600 : 400,
                                }}
                              >
                                <strong>Owner:</strong> {item.imported.owner}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: item.changes?.includes("status")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("status") ? 600 : 400,
                                }}
                              >
                                <strong>Status:</strong> {item.imported.status}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: item.changes?.includes("priority")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("priority") ? 600 : 400,
                                }}
                              >
                                <strong>Priority:</strong> {item.imported.priority}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: item.changes?.includes("dueDate")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("dueDate") ? 600 : 400,
                                }}
                              >
                                <strong>Due:</strong> {item.imported.dueDate}
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
                </Box>
              </Box>
            )}

            {/* Comments Section */}
            {(importResult.comments.created.length > 0 ||
              importResult.comments.updated.length > 0 ||
              importResult.comments.skipped.length > 0) && (
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    mb: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 20 }} /> Comments
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {[
                    ...importResult.comments.created,
                    ...importResult.comments.updated,
                    ...importResult.comments.skipped,
                  ].map((item, idx) => {
                    const isCreated = item.decision === "created";
                    const isUpdated = item.decision === "updated";
                    const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                    const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                    return (
                      <Box
                        key={`comment-${idx}`}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                          border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                        }}
                      >
                        {/* Header */}
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

                        {/* Comparison */}
                        <Box
                          sx={{
                            display: "flex",
                            gap: 2,
                            alignItems: "stretch",
                          }}
                        >
                          {/* Left: Existing */}
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
                                    bgcolor: item.changes?.includes("text")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Text:</strong> {item.existing.text}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    bgcolor: item.changes?.includes("author")
                                      ? alpha(theme.palette.warning.main, 0.2)
                                      : "transparent",
                                    px: 0.5,
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <strong>Author:</strong> {item.existing.author}
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

                          {/* Right: Imported */}
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
                                  bgcolor: item.changes?.includes("text")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("text") ? 600 : 400,
                                }}
                              >
                                <strong>Text:</strong> {item.imported.text}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: item.changes?.includes("author")
                                    ? alpha(theme.palette[decisionColor].main, 0.2)
                                    : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  fontWeight: item.changes?.includes("author") ? 600 : 400,
                                }}
                              >
                                <strong>Author:</strong> {item.imported.author}
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
                </Box>
              </Box>
            )}

            {/* Empty state */}
            {importResult.actions.created.length === 0 &&
              importResult.actions.updated.length === 0 &&
              importResult.actions.skipped.length === 0 &&
              importResult.comments.created.length === 0 &&
              importResult.comments.updated.length === 0 &&
              importResult.comments.skipped.length === 0 && (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No actions or comments were found in the import file.
                  </Typography>
                </Box>
              )}
          </Box>
        ) : importResult?.error ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body1" color="error.main">
              {importResult.error}
            </Typography>
          </Box>
        ) : null}
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

ImportActionsDialog.displayName = "ImportActionsDialog";

export default ImportActionsDialog;
