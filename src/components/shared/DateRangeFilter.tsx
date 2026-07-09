import React, { memo, useCallback, useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { easing } from "../../styles/animations";

// ─── Shared preset button style helper ─────────────────────────────────────────

/**
 * Returns an sx object for a preset-style toggle button.
 * Reusable across DateRangeFilter, StaffingDateRangeFilter, FilterRow, etc.
 */
export const getPresetButtonSx = (
  isActive: boolean,
  opts?: {
    activeBg?: string;
    activeHoverBg?: string;
    inactiveBg?: string;
    inactiveHoverBg?: string;
    activeColor?: string;
    inactiveColor?: string;
  }
) => ({
  fontWeight: 500,
  fontSize: "0.875rem",
  borderRadius: 1,
  textTransform: "none" as const,
  backgroundColor: isActive ? (opts?.activeBg ?? "#bdbdbd") : (opts?.inactiveBg ?? "#f5f5f5"),
  color: isActive ? (opts?.activeColor ?? "#fff") : (opts?.inactiveColor ?? undefined),
  transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}, transform 0.2s ${easing.bounce}`,
  "&:hover": {
    backgroundColor: isActive ? (opts?.activeHoverBg ?? "#9e9e9e") : (opts?.inactiveHoverBg ?? "#e0e0e0"),
    transform: "scale(1.02)",
  },
  "&:active": {
    transform: "scale(0.98)",
  },
});

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface PresetItem {
  id: string;
  label: string;
  /** For "recent" presets: number of days to go back from today. */
  days?: number;
  /** For "fiscal" presets: period type used to compute start date. */
  type?: string;
}

export interface PresetGroup {
  items: PresetItem[];
}

export interface DateRangeFilterProps {
  /** Current date range: [startDate, endDate]. Both may be null. */
  dateRange: [Date | null, Date | null];
  /**
   * Called when either date changes.
   * @param index 0 = start, 1 = end
   * @param date  the new date value (or null when cleared)
   */
  onDateChange: (index: number, date: Date | null) => void;
  /**
   * Called when the active preset is toggled off.
   * For Pipeline: resets the filter. For Bookings: returns to yearly view.
   */
  onResetFilter: () => void;
  /** Preset groups rendered as button sections separated by dividers. */
  presetGroups: PresetGroup[];
  /**
   * Resolve a preset click to a date range.
   * Return `{ startDate, endDate }` or `null` if the preset is unknown.
   */
  resolvePreset: (presetId: string) => { startDate: Date; endDate: Date } | null;
  /**
   * Check whether a given date range matches a preset.
   * Return `true` if it matches.
   */
  matchPreset?: (preset: PresetItem, normalizedStart: Date, normalizedEnd: Date, normalizedToday: Date) => boolean;
  /**
   * Custom container sx overrides.
   */
  containerSx?: Record<string, unknown>;
  /**
   * Active/inactive button color overrides.
   * Defaults use grey[400]/grey[100] (pipeline style).
   */
  activeButtonBg?: string;
  activeButtonHoverBg?: string;
  inactiveButtonBg?: string;
  inactiveButtonHoverBg?: string;
  /**
   * Optional: extra content rendered before the preset groups (after the date pickers).
   */
  beforePresets?: ReactNode;
  /**
   * Optional: extra content rendered after the preset groups.
   */
  afterPresets?: ReactNode;
  /**
   * If true, the preset toggle-off calls onResetFilter.
   * If false (default for bookings), it applies a "yearly view" instead.
   */
  resetOnToggleOff?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const normalizeDate = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const DateRangeFilter = memo(
  ({
    dateRange,
    onDateChange,
    onResetFilter,
    presetGroups,
    resolvePreset,
    matchPreset,
    containerSx,
    activeButtonBg,
    activeButtonHoverBg,
    inactiveButtonBg,
    inactiveButtonHoverBg,
    beforePresets,
    afterPresets,
    resetOnToggleOff = true,
  }: DateRangeFilterProps) => {
    const theme = useTheme();
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const skipAutoDetectRef = useRef(false);

    const activeBg = activeButtonBg ?? theme.palette.grey[400];
    const activeHoverBg = activeButtonHoverBg ?? theme.palette.grey[500];
    const inactiveBg = inactiveButtonBg ?? theme.palette.grey[100];
    const inactiveHoverBg = inactiveButtonHoverBg ?? theme.palette.grey[200];

    // Flatten all presets for detection
    const allPresets = useMemo(() => presetGroups.flatMap((g) => g.items), [presetGroups]);

    // ── Detect active preset from current dateRange ──

    const detectActivePreset = useCallback(() => {
      if (skipAutoDetectRef.current) {
        skipAutoDetectRef.current = false;
        return;
      }
      if (!dateRange[0] || !dateRange[1]) {
        setActivePreset(null);
        return;
      }

      const today = new Date();
      const normalizedStart = normalizeDate(dateRange[0]);
      const normalizedEnd = normalizeDate(dateRange[1]);
      const normalizedToday = normalizeDate(today);

      // If a custom matchPreset is provided, delegate to it
      if (matchPreset) {
        // Keep current preset if it still matches
        if (activePreset && activePreset !== "custom") {
          const current = allPresets.find((p) => p.id === activePreset);
          if (current && matchPreset(current, normalizedStart, normalizedEnd, normalizedToday)) {
            return;
          }
        }
        for (const preset of allPresets) {
          if (matchPreset(preset, normalizedStart, normalizedEnd, normalizedToday)) {
            setActivePreset(preset.id);
            return;
          }
        }
        setActivePreset("custom");
        return;
      }

      // Default detection: end date must be today for non-lastYear presets
      // Check lastYear first (end != today)
      const lastYearPreset = allPresets.find((p) => p.type === "lastYear");
      if (lastYearPreset) {
        const lastYearStart = normalizeDate(new Date(today.getFullYear() - 1, 0, 1));
        const lastYearEnd = normalizeDate(new Date(today.getFullYear() - 1, 11, 31));
        if (
          normalizedStart.getTime() === lastYearStart.getTime() &&
          normalizedEnd.getTime() === lastYearEnd.getTime()
        ) {
          setActivePreset(lastYearPreset.id);
          return;
        }
      }

      if (normalizedEnd.getTime() !== normalizedToday.getTime()) {
        setActivePreset("custom");
        return;
      }

      const defaultMatch = (preset: PresetItem): boolean => {
        let expectedStart: Date | undefined;
        if (preset.days !== undefined) {
          expectedStart = new Date(today);
          expectedStart.setDate(today.getDate() - preset.days);
        } else if (preset.type === "week") {
          const dow = today.getDay();
          const diff = dow === 0 ? 6 : dow - 1;
          expectedStart = new Date(today);
          expectedStart.setDate(today.getDate() - diff);
        } else if (preset.type === "month") {
          expectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
        } else if (preset.type === "year") {
          expectedStart = new Date(today.getFullYear(), 0, 1);
        }
        if (!expectedStart) return false;
        return normalizedStart.getTime() === normalizeDate(expectedStart).getTime();
      };

      // Keep current preset if still valid
      if (activePreset && activePreset !== "custom") {
        const current = allPresets.find((p) => p.id === activePreset);
        if (current && defaultMatch(current)) return;
      }

      for (const preset of allPresets) {
        if (defaultMatch(preset)) {
          setActivePreset(preset.id);
          return;
        }
      }
      setActivePreset("custom");
    }, [dateRange, activePreset, allPresets, matchPreset]);

    useEffect(() => {
      detectActivePreset();
    }, [detectActivePreset]);

    // ── Date change handlers ──

    const handleStartDateChange = useCallback(
      (date: Date | null) => {
        onDateChange(0, date);
        setActivePreset("custom");
      },
      [onDateChange]
    );

    const handleEndDateChange = useCallback(
      (date: Date | null) => {
        onDateChange(1, date);
        setActivePreset("custom");
      },
      [onDateChange]
    );

    // ── Yearly view fallback (bookings-style toggle-off) ──

    const applyYearlyView = useCallback(() => {
      skipAutoDetectRef.current = true;
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      onDateChange(0, startOfYear);
      onDateChange(1, today);
      setActivePreset(null);
    }, [onDateChange]);

    // ── Preset click ──

    const handlePresetClick = useCallback(
      (presetId: string) => {
        // Toggle off
        if (activePreset === presetId) {
          if (resetOnToggleOff) {
            onResetFilter();
            setActivePreset(null);
          } else {
            applyYearlyView();
          }
          return;
        }

        const resolved = resolvePreset(presetId);
        if (resolved) {
          onDateChange(0, resolved.startDate);
          onDateChange(1, resolved.endDate);
          setActivePreset(presetId);
        }
      },
      [activePreset, onDateChange, onResetFilter, resolvePreset, resetOnToggleOff, applyYearlyView]
    );

    // ── Shared button sx ──

    const buttonSx = useCallback(
      (isActive: boolean) => ({
        flex: 1,
        py: 0.75,
        fontWeight: 500,
        fontSize: "0.875rem",
        borderRadius: 1,
        backgroundColor: isActive ? activeBg : inactiveBg,
        color: isActive ? "#fff" : "text.secondary",
        transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}, transform 0.2s ${easing.bounce}`,
        "&:hover": {
          backgroundColor: isActive ? activeHoverBg : inactiveHoverBg,
          transform: "scale(1.02)",
        },
        "&:active": {
          transform: "scale(0.98)",
        },
      }),
      [activeBg, activeHoverBg, inactiveBg, inactiveHoverBg, theme]
    );

    // ── DatePicker slot props (shared between start and end) ──

    const datePickerTextFieldSx = {
      flex: 1,
      "& .MuiInput-underline:before": { display: "none" },
      "& .MuiInput-underline:after": { display: "none" },
      "& .MuiInputBase-root": {
        height: 40,
        alignItems: "center",
        bgcolor: "action.hover",
        borderRadius: 1,
        px: 1.5,
        fontSize: "0.875rem",
      },
      "& .MuiInputBase-input": {
        color: "text.primary",
        py: 0,
        fontSize: "0.875rem",
      },
    };

    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "background.paper",
            borderRadius: 3,
            p: 2,
            ...containerSx,
          }}
        >
          {/* Calendar Icon */}
          <Box sx={{ pt: 1 }}>
            <CalendarTodayIcon color="primary" />
          </Box>

          {/* Section 1: Manual Date Selection */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
            <DatePicker
              value={dateRange[0]}
              onChange={handleStartDateChange}
              slotProps={{
                textField: {
                  size: "small",
                  sx: datePickerTextFieldSx,
                  variant: "standard",
                },
                openPickerButton: { sx: { p: 0.25, mr: -0.5 } },
                openPickerIcon: { sx: { fontSize: 16, opacity: 0.4 } },
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
              au
            </Box>

            <DatePicker
              value={dateRange[1]}
              onChange={handleEndDateChange}
              slotProps={{
                textField: {
                  size: "small",
                  sx: datePickerTextFieldSx,
                  variant: "standard",
                },
                openPickerButton: { sx: { p: 0.25, mr: -0.5 } },
                openPickerIcon: { sx: { fontSize: 16, opacity: 0.4 } },
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

          {beforePresets}

          {/* Preset groups separated by dividers */}
          {presetGroups.map((group, groupIdx) => (
            <React.Fragment key={groupIdx}>
              <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />
              <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
                {group.items.map((preset) => (
                  <Button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    size="small"
                    sx={buttonSx(activePreset === preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Box>
            </React.Fragment>
          ))}

          {afterPresets}
        </Box>
      </LocalizationProvider>
    );
  }
);

DateRangeFilter.displayName = "DateRangeFilter";

export default DateRangeFilter;
