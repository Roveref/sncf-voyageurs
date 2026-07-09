/**
 * OpportunityBanner — Title banner with opportunity name, win%, ID, status selector, and close button
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { alpha, useTheme } from "@mui/material/styles";
import { brand } from "../../config/brandConfig";
import { STATUS_OPTIONS } from "./validation";

interface OpportunityBannerProps {
  formData: Record<string, any>;
  errors: Record<string, any>;
  statusColor: { bgcolor: string; color: string; borderColor: string; headerBg: string };
  onChange: (field: string, value: any) => void;
  onClose: () => void;
  onBlurField?: (fieldName: string, value: any) => void;
}

const OpportunityBanner = ({
  formData,
  errors,
  statusColor,
  onChange,
  onClose,
  onBlurField,
}: OpportunityBannerProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2.5,
        bgcolor: "transparent",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, mr: 2 }}>
          {/* Opportunity Name Input */}
          <TextField
            fullWidth
            placeholder="Nom de l'actif"
            value={formData.opportunity}
            onChange={(e) => onChange("opportunity", e.target.value)}
            onBlur={(e) => onBlurField?.("opportunity", e.target.value)}
            error={!!errors.opportunity}
            helperText={errors.opportunity}
            variant="standard"
            sx={{
              mb: 1,
              "& .MuiInputBase-input": {
                fontSize: "1.25rem",
                fontWeight: 700,
                color: brand.secondary,
              },
            }}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Disponibilité % Input */}
            <TextField
              type="number"
              placeholder="Disponibilité %"
              value={formData.winPct}
              onChange={(e) => onChange("winPct", e.target.value)}
              size="small"
              inputProps={{ min: 0, max: 150 }}
              sx={{
                width: 80,
                "& .MuiInputBase-input": { fontSize: "0.75rem", textAlign: "center" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { border: "none" },
                  bgcolor: "action.hover",
                  borderRadius: 1,
                },
              }}
            />
            <Typography variant="body2" color="text.secondary">
              ID: {formData.opportunityId}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton onClick={onClose} size="small" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
          {/* Status Selector */}
          <TextField
            select
            value={formData.status}
            onChange={(e) => onChange("status", e.target.value)}
            error={!!errors.status}
            size="small"
            sx={{
              minWidth: 150,
              "& .MuiOutlinedInput-root": {
                fontWeight: 600,
                backgroundColor: statusColor.bgcolor,
                color: statusColor.color,
                borderRadius: "8px",
              },
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
    </Box>
  );
};

OpportunityBanner.displayName = "OpportunityBanner";
export default memo(OpportunityBanner);
