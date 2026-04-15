/**
 * ResultDialog — Simple modal notification for save/refresh results.
 */

import React, { memo } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";

interface ResultDialogProps {
  result: { title: string; message: string; severity: string } | null;
  onClose: () => void;
}

const ResultDialog = memo(({ result, onClose }: ResultDialogProps) => {
  return (
    <Dialog
      open={!!result}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      {result && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {result.severity === "success" ? (
              <CheckIcon sx={{ color: "success.main" }} />
            ) : (
              <WarningIcon sx={{ color: "error.main" }} />
            )}
            <Typography variant="h6" fontWeight={600}>
              {result.title}
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography>{result.message}</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={onClose}>
              OK
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
});

ResultDialog.displayName = "ResultDialog";

export default ResultDialog;
