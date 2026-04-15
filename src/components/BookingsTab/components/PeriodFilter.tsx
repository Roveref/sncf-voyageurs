import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useTheme, alpha } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterListIcon from "@mui/icons-material/FilterList";
import { keyframes as animationKeyframes, easing } from "../../../styles/animations";

/**
 * PeriodFilter - Component to filter bookings by period
 * Optimized with React.memo to avoid unnecessary re-renders
 */
const PeriodFilter = React.memo(({ dateRange, setDateRange, updateDateAnalysis }: any) => {
  const theme = useTheme();

  // Handle date change
  const handleDateChange = (index: number, date: Date | null) => {
    const newDateRange = [...dateRange];
    newDateRange[index] = date;
    setDateRange(newDateRange);
  };

  // Reset date filter to January 1st of current year and today
  const handleResetDateFilter = () => {
    setDateRange([new Date(new Date().getFullYear(), 0, 1), new Date()]);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
        p: 2,
      }}
    >
      <CalendarTodayIcon color="primary" />

      <Typography variant="body2" fontWeight={500} sx={{ mr: 1 }}>
        Period (booking date):
      </Typography>

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Start Date"
          value={dateRange[0]}
          onChange={(date) => handleDateChange(0, date)}
          slotProps={{
            textField: {
              size: "small",
              sx: { width: 160 },
              variant: "outlined",
            },
          }}
          format="dd/MM/yyyy"
        />

        <Typography variant="body2" sx={{ mx: 1 }}>
          to
        </Typography>

        <DatePicker
          label="End Date"
          value={dateRange[1]}
          onChange={(date) => handleDateChange(1, date)}
          slotProps={{
            textField: {
              size: "small",
              sx: { width: 160 },
              variant: "outlined",
            },
          }}
          format="dd/MM/yyyy"
        />
      </LocalizationProvider>

      <Button
        variant="outlined"
        size="small"
        startIcon={<FilterListIcon />}
        onClick={updateDateAnalysis}
        sx={{ ml: 1 }}
      >
        Apply
      </Button>

      <Button variant="text" size="small" onClick={handleResetDateFilter}>
        Reset
      </Button>
    </Box>
  );
});

PeriodFilter.displayName = "PeriodFilter";

export default PeriodFilter;
