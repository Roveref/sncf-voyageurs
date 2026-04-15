/**
 * OpportunityDetailsColumn — Left column: Account, Project Type, CM1%, Dates, Tech Partner
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid2";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import { alpha, useTheme } from "@mui/material/styles";
import { brand } from "../../config/brandConfig";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { createFilterOptions } from "@mui/material/Autocomplete";

const crmFilterOptions = createFilterOptions<string>({
  limit: 50,
  matchFrom: "any" as const,
});

interface OpportunityDetailsColumnProps {
  formData: Record<string, any>;
  errors: Record<string, any>;
  onChange: (field: string, value: any) => void;
  allAccountsList: string[];
  opportunityAccountsList: string[];
  manualAccountSet: Set<string>;
  projectTypesList: any[];
  techPartnersList: any[];
  isBooked: boolean;
  onOpenCreateAccount: () => void;
  onBlurField?: (fieldName: string, value: any) => void;
}

const OpportunityDetailsColumn = ({
  formData,
  errors,
  onChange,
  allAccountsList,
  opportunityAccountsList,
  manualAccountSet,
  projectTypesList,
  techPartnersList,
  isBooked,
  onOpenCreateAccount,
  onBlurField,
}: OpportunityDetailsColumnProps) => {
  const theme = useTheme();

  return (
    <Grid
      size={{ xs: 12, md: 4 }}
      sx={{
        p: 2.5,
        bgcolor: "background.default",
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
        Opportunity Details
      </Typography>

      {/* Account */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }} data-mandatory>
        <Autocomplete<string>
          fullWidth
          options={allAccountsList}
          filterOptions={(options, state) => {
            if (!state.inputValue) {
              return (opportunityAccountsList as string[]).slice(0, 50);
            }
            return crmFilterOptions(options, state) as string[];
          }}
          value={formData.account}
          onChange={(_event, newValue) => onChange("account", newValue || "")}
          renderOption={(props, option) => (
            <li {...props} key={option}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                <span style={{ flex: 1 }}>{option}</span>
                {manualAccountSet.has(option) && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      backgroundColor: "#E3F2FD",
                      color: "#1565C0",
                      px: 0.8,
                      py: 0.2,
                      borderRadius: 1,
                    }}
                  >
                    New
                  </Box>
                )}
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Account"
              error={!!errors.account}
              helperText={errors.account}
              size="small"
              margin="dense"
              placeholder="Type to search all CRM accounts..."
              onBlur={() => onBlurField?.("account", formData.account)}
            />
          )}
        />
        <IconButton
          onClick={onOpenCreateAccount}
          title="Create new account"
          sx={{
            mt: "12px",
            borderRadius: 1.5,
            color: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
            },
          }}
          size="small"
        >
          <AddBusinessIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Project Type */}
      <Autocomplete
        fullWidth
        freeSolo
        options={projectTypesList}
        value={formData.engagementType}
        onChange={(_event, newValue) => onChange("engagementType", newValue || "")}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Project Type"
            size="small"
            margin="dense"
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { border: "none" },
                bgcolor: "action.hover",
                borderRadius: 1,
              },
            }}
          />
        )}
      />

      {/* CM1% */}
      <TextField
        fullWidth
        type="number"
        label="CM1 (%)"
        value={formData.cm1Pct}
        onChange={(e) => onChange("cm1Pct", e.target.value)}
        size="small"
        margin="dense"
        sx={{
          "& .MuiOutlinedInput-root": {
            "& fieldset": { border: "none" },
            bgcolor: "action.hover",
            borderRadius: 1,
          },
        }}
      />

      {/* Booking Dates */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
        Booking Dates
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          value={formData.bookingDate ? new Date(formData.bookingDate) : null}
          onChange={(date) => onChange("bookingDate", date ? date.toISOString().split("T")[0] : "")}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
              margin: "dense",
              label: "Estimated Booking Date",
              onBlur: () => onBlurField?.("bookingDate", formData.bookingDate),
              sx: {
                "& .MuiInputBase-root": {
                  minHeight: 48,
                  alignItems: "center",
                },
                "& .MuiInputBase-input": {
                  color: "text.primary",
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "text.secondary",
                  opacity: 1,
                },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { border: "none" },
                  bgcolor: "action.hover",
                  borderRadius: 1,
                },
              },
              variant: "outlined",
            },
            field: {
              clearable: true,
              onClear: () => onChange("bookingDate", ""),
            },
            actionBar: {
              actions: ["clear"],
            },
          }}
          format="dd/MM/yyyy"
        />
        {isBooked && (
          <DatePicker
            value={formData.estimatedBookingDate ? new Date(formData.estimatedBookingDate) : null}
            onChange={(date) => onChange("estimatedBookingDate", date ? date.toISOString().split("T")[0] : "")}
            slotProps={{
              textField: {
                size: "small",
                fullWidth: true,
                margin: "dense",
                label: "Actual Booking Date",
                error: !!errors.estimatedBookingDate,
                helperText: errors.estimatedBookingDate,
                onBlur: () => onBlurField?.("estimatedBookingDate", formData.estimatedBookingDate),
                sx: {
                  "& .MuiInputBase-root": {
                    minHeight: 48,
                    alignItems: "center",
                  },
                  "& .MuiInputBase-input": {
                    color: "text.primary",
                  },
                  "& .MuiInputBase-input::placeholder": {
                    color: "text.secondary",
                    opacity: 1,
                  },
                },
                variant: "outlined",
              },
              field: {
                clearable: true,
                onClear: () => onChange("estimatedBookingDate", ""),
              },
              actionBar: {
                actions: ["clear"],
              },
            }}
            format="dd/MM/yyyy"
          />
        )}
      </LocalizationProvider>

      {/* Technology Partners */}
      <Autocomplete
        fullWidth
        freeSolo
        options={techPartnersList}
        value={formData.techPartner1}
        onChange={(_event, newValue) => onChange("techPartner1", newValue || "")}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Technology Partner"
            size="small"
            margin="dense"
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { border: "none" },
                bgcolor: "action.hover",
                borderRadius: 1,
              },
            }}
          />
        )}
      />
    </Grid>
  );
};

OpportunityDetailsColumn.displayName = "OpportunityDetailsColumn";
export default memo(OpportunityDetailsColumn);
