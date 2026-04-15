import React, { useCallback, useState, useEffect } from "react";
/**
 * DateRangeFilter Component
 * Modern date range filtering with 3 visual sections:
 * 1. Manual date selection (DatePickers)
 * 2. Recent shortcuts (7J, 30J, 90J)
 * 3. Fiscal periods (Week, Month, Year)
 * Performance-optimized with React.memo and useCallback
 */

import { Box, Button, Divider, useTheme, alpha } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { easing } from "../../../styles/animations";

/**
 * Date range filter component with modern 3-section design
 * Memoized to prevent unnecessary re-renders
 *
 * @param {Array} dateRange - Current date range [startDate, endDate]
 * @param {Function} onDateChange - Callback for date changes (auto-applied)
 * @param {Function} onResetFilter - Callback to reset filter
 */
const DateRangeFilter = React.memo(({ dateRange, onDateChange, onResetFilter }) => {
  const theme = useTheme();
  const [activePreset, setActivePreset] = useState(null);

  // Preset configurations
  const presets = {
    // Section 2: Recent shortcuts
    recent: [
      { id: "7J", label: "7 days", days: 7 },
      { id: "30J", label: "30 days", days: 30 },
      { id: "90J", label: "90 days", days: 90 },
    ],
    // Section 3: Fiscal periods
    fiscal: [
      { id: "WTD", label: "Week", type: "week" },
      { id: "MTD", label: "Month", type: "month" },
      { id: "YTD", label: "Year", type: "year" },
    ],
  };

  // Detect which preset is currently active based on date range
  const detectActivePreset = useCallback(() => {
    if (!dateRange[0] || !dateRange[1]) {
      setActivePreset(null);
      return;
    }

    const today = new Date();
    const start = new Date(dateRange[0]);
    const end = new Date(dateRange[1]);

    // Normalize to start of day for comparison
    const normalizeDate = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const normalizedStart = normalizeDate(start);
    const normalizedEnd = normalizeDate(end);
    const normalizedToday = normalizeDate(today);

    // Check if end date is today
    if (normalizedEnd.getTime() !== normalizedToday.getTime()) {
      setActivePreset("custom");
      return;
    }

    // Helper function to check if a preset matches the current date range
    const presetMatches = (preset) => {
      let expectedStart;

      // Check if it's a recent preset
      if (preset.days !== undefined) {
        expectedStart = new Date(today);
        expectedStart.setDate(today.getDate() - preset.days);
      }
      // Check if it's a fiscal preset
      else if (preset.type === "week") {
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        expectedStart = new Date(today);
        expectedStart.setDate(today.getDate() - diff);
      } else if (preset.type === "month") {
        expectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (preset.type === "year") {
        expectedStart = new Date(today.getFullYear(), 0, 1);
      }

      const normalizedExpectedStart = normalizeDate(expectedStart);
      return normalizedStart.getTime() === normalizedExpectedStart.getTime();
    };

    // First, check if the currently active preset still matches
    // This preserves user selection when multiple presets have the same dates (e.g., Month vs Year in January)
    if (activePreset && activePreset !== "custom") {
      // Find the currently active preset
      const currentPreset = [...presets.recent, ...presets.fiscal].find((p) => p.id === activePreset);
      if (currentPreset && presetMatches(currentPreset)) {
        // Current preset still matches, keep it
        return;
      }
    }

    // Current preset doesn't match anymore, find a new one
    // Check recent presets (7J, 30J, 90J)
    for (const preset of presets.recent) {
      if (presetMatches(preset)) {
        setActivePreset(preset.id);
        return;
      }
    }

    // Check fiscal presets in normal order (week -> month -> year)
    for (const preset of presets.fiscal) {
      if (presetMatches(preset)) {
        setActivePreset(preset.id);
        return;
      }
    }

    // No preset matched
    setActivePreset("custom");
  }, [dateRange, activePreset, presets.recent, presets.fiscal]);

  // Detect active preset when date range changes
  useEffect(() => {
    detectActivePreset();
  }, [detectActivePreset]);

  // Performance-optimized date change handlers
  const handleStartDateChange = useCallback(
    (date) => {
      onDateChange(0, date);
      setActivePreset("custom"); // Manual change = custom
    },
    [onDateChange]
  );

  const handleEndDateChange = useCallback(
    (date) => {
      onDateChange(1, date);
      setActivePreset("custom"); // Manual change = custom
    },
    [onDateChange]
  );

  // Preset click handler with toggle functionality
  const handlePresetClick = useCallback(
    (presetId) => {
      // Toggle: if clicking on active preset, reset
      if (activePreset === presetId) {
        onResetFilter();
        setActivePreset(null);
        return;
      }

      const today = new Date();
      let startDate;

      // Find preset in recent shortcuts
      const recentPreset = presets.recent.find((p) => p.id === presetId);
      if (recentPreset) {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - recentPreset.days);
        onDateChange(0, startDate);
        onDateChange(1, today);
        setActivePreset(presetId);
        return;
      }

      // Find preset in fiscal periods
      const fiscalPreset = presets.fiscal.find((p) => p.id === presetId);
      if (fiscalPreset) {
        if (fiscalPreset.type === "week") {
          const dayOfWeek = today.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(today);
          startDate.setDate(today.getDate() - diff);
        } else if (fiscalPreset.type === "month") {
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        } else if (fiscalPreset.type === "year") {
          startDate = new Date(today.getFullYear(), 0, 1);
        }
        onDateChange(0, startDate);
        onDateChange(1, today);
        setActivePreset(presetId);
      }
    },
    [onDateChange, onResetFilter, activePreset, presets.recent, presets.fiscal]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
        {/* Calendar Icon - aligned with FilterListIcon */}
        <Box sx={{ pt: 1 }}>
          <CalendarTodayIcon color="primary" />
        </Box>

        {/* Section 1: Manual Date Selection - aligned with Account filter */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          <DatePicker
            value={dateRange[0]}
            onChange={handleStartDateChange}
            slotProps={{
              textField: {
                size: "small",
                sx: {
                  flex: 1,
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
                onClear: () => handleStartDateChange(null),
              },
              actionBar: {
                actions: ["clear"],
              },
            }}
            format="dd/MM/yyyy"
          />

          <Box
            sx={{
              px: 0.5,
              color: "text.secondary",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            à
          </Box>

          <DatePicker
            value={dateRange[1]}
            onChange={handleEndDateChange}
            slotProps={{
              textField: {
                size: "small",
                sx: {
                  flex: 1,
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
                onClear: () => handleEndDateChange(null),
              },
              actionBar: {
                actions: ["clear"],
              },
            }}
            format="dd/MM/yyyy"
          />
        </Box>

        {/* Divider - aligned between Account and Technology Partners */}
        <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

        {/* Section 2: Recent Shortcuts - aligned with Technology Partners filter */}
        <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
          {presets.recent.map((preset) => (
            <Button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              size="small"
              sx={{
                flex: 1,
                py: 0.75,
                fontWeight: 500,
                fontSize: "0.875rem",
                borderRadius: 1,
                backgroundColor: activePreset === preset.id ? theme.palette.grey[400] : theme.palette.grey[100],
                color:
                  activePreset === preset.id
                    ? theme.palette.getContrastText(theme.palette.grey[400])
                    : "text.secondary",
                transition: `all 0.2s ${easing.bounce}`,
                "&:hover": {
                  backgroundColor: activePreset === preset.id ? theme.palette.grey[500] : theme.palette.grey[200],
                  transform: "scale(1.02)",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              {preset.label}
            </Button>
          ))}
        </Box>

        {/* Divider - aligned between Technology Partners and Personnes */}
        <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

        {/* Section 3: Fiscal Periods - aligned with Personnes filter */}
        <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
          {presets.fiscal.map((preset) => (
            <Button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              size="small"
              sx={{
                flex: 1,
                py: 0.75,
                fontWeight: 500,
                fontSize: "0.875rem",
                borderRadius: 1,
                backgroundColor: activePreset === preset.id ? theme.palette.grey[400] : theme.palette.grey[100],
                color:
                  activePreset === preset.id
                    ? theme.palette.getContrastText(theme.palette.grey[400])
                    : "text.secondary",
                transition: `all 0.2s ${easing.bounce}`,
                "&:hover": {
                  backgroundColor: activePreset === preset.id ? theme.palette.grey[500] : theme.palette.grey[200],
                  transform: "scale(1.02)",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              {preset.label}
            </Button>
          ))}
        </Box>
      </Box>
    </LocalizationProvider>
  );
});

DateRangeFilter.displayName = "DateRangeFilter";

export default React.memo(DateRangeFilter);
