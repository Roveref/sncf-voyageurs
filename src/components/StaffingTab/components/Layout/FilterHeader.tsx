import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import HeatmapLegend from "../Employee/HeatmapLegend";

const pad2 = (v: number) => String(v).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export interface FilterHeaderProps {
  employeeCount: number;
  timelineStart: Date | null;
  timelineEnd: Date | null;
  setCustomDateRangeDirect: (start: string, end: string) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  totalCount: number;
  onScenarioCreateClick: () => void;
  onScenarioCompareClick: () => void;
  pipOpen: boolean;
  onTogglePip: () => void;
  needsBoardOpen?: boolean;
  onToggleNeedsBoard?: () => void;
  workingDaysCount: number;
  heatmapMode?: string;
  hasSapData?: boolean;
  // Additional forwarded props (filters, holidays, etc.) — not destructured here
  [key: string]: unknown;
}

export const FilterHeader = memo(
  ({
    employeeCount,
    timelineStart,
    timelineEnd,
    setCustomDateRangeDirect,
    hasActiveFilters,
    clearAllFilters,
    totalCount,
    onScenarioCreateClick,
    onScenarioCompareClick,
    pipOpen,
    onTogglePip,
    needsBoardOpen,
    onToggleNeedsBoard,
    workingDaysCount,
    heatmapMode,
    hasSapData,
  }: FilterHeaderProps) => {
    // timelineEnd is exclusive internally (1 day past the last visible day).
    // Show inclusive end date in the picker, and convert back to exclusive when setting.
    const inclusiveEnd = useMemo(() => {
      if (!(timelineEnd instanceof Date)) return null;
      const d = new Date(timelineEnd);
      d.setDate(d.getDate() - 1);
      return d;
    }, [timelineEnd]);
    // Convert user-picked inclusive end -> exclusive for setCustomDateRangeDirect
    const toExclEnd = (v: Date) => {
      const d = new Date(v);
      d.setDate(d.getDate() + 1);
      return toDateStr(d);
    };
    return (
      <Box
        sx={{ pb: 3, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ flexShrink: 0 }}>
          Timeline
        </Typography>
        {hasActiveFilters && (
          <Chip
            label="Clear filters"
            size="small"
            onDelete={clearAllFilters}
            onClick={clearAllFilters}
            sx={{ fontWeight: 600, fontSize: "0.7rem", height: 24 }}
            color="error"
            variant="outlined"
          />
        )}

        {/* Needs Board toggle */}
        {onToggleNeedsBoard && (
          <Tooltip title={needsBoardOpen ? "Close Needs Board" : "Open Needs Board"}>
            <IconButton
              size="small"
              onClick={onToggleNeedsBoard}
              sx={{
                bgcolor: needsBoardOpen ? "primary.main" : "action.hover",
                color: needsBoardOpen ? "#fff" : "text.secondary",
                "&:hover": { bgcolor: needsBoardOpen ? "primary.dark" : "action.selected" },
                borderRadius: 1,
                px: 1,
                height: 28,
              }}
            >
              <AssignmentIcon sx={{ fontSize: 16, mr: 0.5 }} />
              <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
                Needs
              </Typography>
            </IconButton>
          </Tooltip>
        )}

        {/* Spacer to push legend + date pickers to the right */}
        <Box sx={{ flex: 1 }} />

        <HeatmapLegend mode={heatmapMode || "tu"} hasSapData={hasSapData || false} />

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            value={timelineStart instanceof Date ? timelineStart : null}
            onChange={(v) => {
              if (v && timelineEnd) setCustomDateRangeDirect(toDateStr(v), toDateStr(timelineEnd));
            }}
            slotProps={{
              textField: {
                size: "small",
                variant: "standard",
                sx: {
                  width: 140,
                  "& .MuiInput-underline:before": { display: "none" },
                  "& .MuiInput-underline:after": { display: "none" },
                  "& .MuiInputBase-root": {
                    height: 32,
                    fontSize: "0.8125rem",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    px: 1,
                  },
                  "& .MuiInputBase-input": { py: 0 },
                },
              },
              openPickerButton: { sx: { p: 0.25, mr: -0.5 } },
              openPickerIcon: { sx: { fontSize: 16, opacity: 0.4 } },
            }}
            format="dd/MM/yyyy"
          />
          <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem", flexShrink: 0 }}>&ndash;</Typography>
          {workingDaysCount != null &&
            timelineStart &&
            timelineEnd &&
            (() => {
              let weekdays = 0;
              const s = new Date(timelineStart);
              s.setHours(0, 0, 0, 0);
              const e = new Date(timelineEnd);
              e.setHours(0, 0, 0, 0);
              for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
                const dow = d.getDay();
                if (dow !== 0 && dow !== 6) weekdays++;
              }
              return (
                <Tooltip title="Weekdays (excl. weekends) / business days (excl. weekends & holidays)">
                  <Typography
                    sx={{ fontSize: "0.75rem", color: "text.disabled", fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    {weekdays}d · {workingDaysCount}bd
                  </Typography>
                </Tooltip>
              );
            })()}
          <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem", flexShrink: 0 }}>&ndash;</Typography>
          <DatePicker
            value={inclusiveEnd}
            onChange={(v) => {
              if (v && timelineStart) setCustomDateRangeDirect(toDateStr(timelineStart), toExclEnd(v));
            }}
            slotProps={{
              textField: {
                size: "small",
                variant: "standard",
                sx: {
                  width: 140,
                  "& .MuiInput-underline:before": { display: "none" },
                  "& .MuiInput-underline:after": { display: "none" },
                  "& .MuiInputBase-root": {
                    height: 32,
                    fontSize: "0.8125rem",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    px: 1,
                  },
                  "& .MuiInputBase-input": { py: 0 },
                },
              },
              openPickerButton: { sx: { p: 0.25, mr: -0.5 } },
              openPickerIcon: { sx: { fontSize: 16, opacity: 0.4 } },
            }}
            format="dd/MM/yyyy"
          />
        </LocalizationProvider>
      </Box>
    );
  }
);
FilterHeader.displayName = "FilterHeader";
