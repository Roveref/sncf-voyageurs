/**
 * ServiceOfferingsColumn — Center column: 3 service lines with offerings and allocations
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid2";
import { alpha, useTheme } from "@mui/material/styles";
import { brand } from "../../config/brandConfig";

interface ServiceOfferingsColumnProps {
  formData: Record<string, any>;
  errors: Record<string, any>;
  onChange: (field: string, value: any) => void;
  serviceLinesList: string[];
  getOfferingsForServiceLine: (serviceLine: string) => string[];
}

const dashedFieldSx = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { border: "none" },
    bgcolor: "action.hover",
    borderRadius: 1,
  },
};

const ServiceOfferingsColumn = ({
  formData,
  errors,
  onChange,
  serviceLinesList,
  getOfferingsForServiceLine,
}: ServiceOfferingsColumnProps) => {
  const theme = useTheme();

  const renderServiceLineGroup = (
    index: number,
    label: string,
    slKey: string,
    soKey: string,
    allocKey: string,
    isSecondary: boolean
  ) => (
    <>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: isSecondary ? 2 : 0, mb: 0.5 }}>
        {label}
      </Typography>
      <Autocomplete
        fullWidth
        freeSolo
        options={serviceLinesList}
        value={formData[slKey]}
        onChange={(_event, newValue) => {
          onChange(slKey, newValue || "");
          onChange(soKey, "");
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Service Line"
            error={index === 1 ? !!errors.serviceLine1 : false}
            helperText={index === 1 ? errors.serviceLine1 : undefined}
            size="small"
            margin="dense"
            sx={isSecondary ? dashedFieldSx : undefined}
          />
        )}
      />
      <Grid container spacing={1}>
        <Grid size={9}>
          <Autocomplete
            fullWidth
            freeSolo
            options={getOfferingsForServiceLine(formData[slKey])}
            value={formData[soKey]}
            onChange={(_event, newValue) => onChange(soKey, newValue || "")}
            disabled={!formData[slKey]}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Service Offering"
                size="small"
                margin="dense"
                sx={isSecondary ? dashedFieldSx : undefined}
              />
            )}
          />
        </Grid>
        <Grid size={3}>
          <TextField
            fullWidth
            type="number"
            placeholder="%"
            value={formData[allocKey]}
            onChange={(e) => onChange(allocKey, e.target.value)}
            size="small"
            inputProps={{ min: 0, max: 100 }}
            margin="dense"
            sx={isSecondary ? dashedFieldSx : undefined}
          />
        </Grid>
      </Grid>
    </>
  );

  return (
    <Grid
      size={{ xs: 12, md: 4 }}
      sx={{
        p: 2.5,
        bgcolor: "background.paper",
      }}
    >
      <Typography
        variant="subtitle2"
        color={brand.secondary}
        fontWeight={700}
        sx={{ mb: 2, display: "flex", alignItems: "center" }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: brand.secondary,
            mr: 1,
          }}
        />
        Service Offerings
      </Typography>

      <Box data-mandatory>
        {renderServiceLineGroup(1, "Primary Service", "serviceLine1", "serviceOffering1", "allocation1", false)}
      </Box>
      {renderServiceLineGroup(2, "Secondary Service", "serviceLine2", "serviceOffering2", "allocation2", true)}
      {renderServiceLineGroup(3, "Tertiary Service", "serviceLine3", "serviceOffering3", "allocation3", true)}
    </Grid>
  );
};

ServiceOfferingsColumn.displayName = "ServiceOfferingsColumn";
export default memo(ServiceOfferingsColumn);
