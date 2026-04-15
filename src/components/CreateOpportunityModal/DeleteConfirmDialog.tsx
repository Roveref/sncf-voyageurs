/**
 * DeleteConfirmDialog — Generic confirmation dialog for destructive actions
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { alpha, useTheme } from "@mui/material/styles";

interface DeleteConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Dialog heading. Defaults to "Delete Opportunity" */
  title?: string;
  /** Body message. Defaults to the original single-opportunity warning */
  message?: string;
  /** Label for the confirm button. Defaults to "Delete" */
  confirmLabel?: string;
  /** MUI color for the confirm button. Defaults to "error" */
  confirmColor?: "error" | "warning" | "primary" | "success" | "info" | "secondary";
}

const DeleteConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  title = "Delete Opportunity",
  message = "Are you sure you want to delete this opportunity? This action cannot be undone.",
  confirmLabel = "Delete",
  confirmColor = "error",
}: DeleteConfirmDialogProps) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      TransitionComponent={DialogTransition}
      maxWidth="xs"
      PaperProps={{
        sx: { borderRadius: "12px" },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.error.main, 0.1),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mr: 2,
            }}
          >
            <DeleteIcon color="error" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3 }}>
          <Button onClick={onCancel} variant="outlined">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="contained" color={confirmColor}>
            {confirmLabel}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

DeleteConfirmDialog.displayName = "DeleteConfirmDialog";
export default memo(DeleteConfirmDialog);
