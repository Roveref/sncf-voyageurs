/**
 * StatusFilterDialog Component
 * Multi-select checkbox dialog for filtering opportunities by status
 * Extracted from OpportunityToolbar for better separation of concerns
 */

import React, { memo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import DialogTransition from "../../common/DialogTransition";
import FilterListIcon from "@mui/icons-material/FilterList";
import { easing } from "../../../styles/animations";

const StatusFilterDialog = memo(({ open, onClose, statusFilter, statusOptions, onApply }: any) => {
  const theme = useTheme();
  const [tempStatusFilter, setTempStatusFilter] = useState(statusFilter);

  // Sync internal state when the dialog opens or statusFilter changes externally
  useEffect(() => {
    if (open) {
      setTempStatusFilter(statusFilter);
    }
  }, [open, statusFilter]);

  const handleToggleStatus = (statusValue: any) => {
    const statusStr = String(statusValue);
    setTempStatusFilter((prev: string[]) => {
      if (prev.includes(statusStr)) {
        return prev.filter((s: string) => s !== statusStr);
      } else {
        return [...prev, statusStr];
      }
    });
  };

  const handleSelectAll = () => {
    setTempStatusFilter(statusOptions.map((opt: any) => String(opt.value)));
  };

  const handleClearAll = () => {
    setTempStatusFilter([]);
  };

  const handleApply = () => {
    onApply(tempStatusFilter);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
          minWidth: 320,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1.5,
          pt: 2,
          px: 2.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FilterListIcon sx={{ fontSize: 22, color: "primary.main" }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Filter by Status
          </Typography>
        </Box>
        <Chip
          label={`${tempStatusFilter.length}`}
          size="small"
          color={tempStatusFilter.length > 0 ? "primary" : "default"}
          sx={{ fontWeight: 600, height: 22, fontSize: "0.75rem" }}
        />
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 1.5, px: 2.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {statusOptions.map((status: any) => {
            const isChecked = tempStatusFilter.includes(String(status.value));
            return (
              <FormControlLabel
                key={status.value}
                control={
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleToggleStatus(status.value)}
                    size="small"
                    sx={{
                      color: `${status.color}.main`,
                      "&.Mui-checked": {
                        color: `${status.color}.main`,
                      },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isChecked ? 600 : 400,
                        fontSize: "0.875rem",
                      }}
                    >
                      {status.label}
                    </Typography>
                    <Chip
                      label={`${status.value}`}
                      size="small"
                      color={status.color}
                      sx={{
                        height: 18,
                        fontSize: "0.65rem",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                }
                sx={{
                  m: 0,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                  transition: `all 0.2s ${easing.bounce}`,
                  backgroundColor: isChecked ? alpha((theme.palette as any)[status.color].main, 0.08) : "transparent",
                  "&:hover": {
                    backgroundColor: alpha((theme.palette as any)[status.color].main, 0.12),
                  },
                }}
              />
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: 2.5,
          pb: 2,
          pt: 1.5,
          gap: 0.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Button
          onClick={handleClearAll}
          variant="outlined"
          color="error"
          size="small"
          sx={{ fontSize: "0.75rem", py: 0.5 }}
        >
          Clear
        </Button>
        <Button onClick={handleSelectAll} variant="outlined" size="small" sx={{ fontSize: "0.75rem", py: 0.5 }}>
          All
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="outlined" size="small" sx={{ fontSize: "0.75rem", py: 0.5 }}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          color="primary"
          size="small"
          sx={{ fontSize: "0.75rem", py: 0.5 }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
});

StatusFilterDialog.displayName = "StatusFilterDialog";

export default StatusFilterDialog;
