/**
 * ImportActionsDialog Component
 * Displays import results for actions with comparison view
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
import AssignmentIcon from "@mui/icons-material/Assignment";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";
import ImportItemCard from "./ImportItemCard";

const ACTION_FIELDS = [
  { key: "description", label: "Description" },
  { key: "owner", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "dueDate", label: "Due" },
];

const ImportActionsDialog = memo(({ open, onClose, importResult }: any) => {
  const theme = useTheme();

  const allActions = importResult?.actions
    ? [...importResult.actions.created, ...importResult.actions.updated, ...importResult.actions.skipped]
    : [];

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
                Import Results - Actions
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
              label={`${importResult.actions?.created?.length || 0} Created`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<UpdateIcon sx={{ fontSize: 16 }} />}
              label={`${importResult.actions?.updated?.length || 0} Updated`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<BlockIcon sx={{ fontSize: 16 }} />}
              label={`${importResult.actions?.skipped?.length || 0} Skipped`}
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
            {allActions.length > 0 && (
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
                  {allActions.map((item: any, idx: number) => (
                    <ImportItemCard
                      key={`action-${idx}`}
                      item={item}
                      keyPrefix="action"
                      idx={idx}
                      fields={ACTION_FIELDS}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {allActions.length === 0 && (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  No actions were found in the import file.
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
