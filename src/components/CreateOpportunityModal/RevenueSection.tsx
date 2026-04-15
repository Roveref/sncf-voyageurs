/**
 * RevenueSection — Gross and Net revenue inputs
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid2";
import { alpha, useTheme } from "@mui/material/styles";
import { formatNumberWithSpaces, parseNumberFromFormatted } from "./validation";

interface RevenueSectionProps {
  formData: Record<string, any>;
  errors: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onBlurField?: (fieldName: string, value: any) => void;
}

const RevenueSection = ({ formData, errors, onChange, onBlurField }: RevenueSectionProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2.5,
        bgcolor: "transparent",
      }}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }} data-mandatory>
          <TextField
            fullWidth
            type="text"
            label="Gross Revenue (€)"
            value={formatNumberWithSpaces(formData.grossRevenue)}
            onChange={(e) => onChange("grossRevenue", parseNumberFromFormatted(e.target.value))}
            onBlur={(e) => onBlurField?.("grossRevenue", parseNumberFromFormatted(e.target.value))}
            error={!!errors.grossRevenue}
            helperText={errors.grossRevenue}
            size="small"
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9 ]*",
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} data-mandatory>
          <TextField
            fullWidth
            type="text"
            label="Net Revenue (€)"
            value={formatNumberWithSpaces(formData.netRevenue)}
            onChange={(e) => onChange("netRevenue", parseNumberFromFormatted(e.target.value))}
            error={!!errors.netRevenue}
            helperText={errors.netRevenue}
            size="small"
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9 ]*",
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

RevenueSection.displayName = "RevenueSection";
export default memo(RevenueSection);
