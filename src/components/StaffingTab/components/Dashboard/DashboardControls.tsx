import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { TIMEFRAME_OPTIONS, TIMEFRAME_CONFIG, MS_PER_DAY } from "../../constants";

/**
 * Timeframe selector component
 */
export const TimeframeSelector = memo(({ timeframe, customDateRange, onTimeframeChange, _onCustomDateChange }: any) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      Timeframe:
    </Typography>
    <Select
      value={customDateRange.enabled ? TIMEFRAME_OPTIONS.CUSTOM : timeframe}
      onChange={(e) => onTimeframeChange(e.target.value)}
      size="small"
      sx={{ fontSize: "0.875rem" }}
    >
      <MenuItem value={TIMEFRAME_OPTIONS.WEEK}>{TIMEFRAME_CONFIG[TIMEFRAME_OPTIONS.WEEK].label}</MenuItem>
      <MenuItem value={TIMEFRAME_OPTIONS.MONTH}>{TIMEFRAME_CONFIG[TIMEFRAME_OPTIONS.MONTH].label}</MenuItem>
      <MenuItem value={TIMEFRAME_OPTIONS.QUARTER}>{TIMEFRAME_CONFIG[TIMEFRAME_OPTIONS.QUARTER].label}</MenuItem>
      <MenuItem value={TIMEFRAME_OPTIONS.CUSTOM}>Custom Range</MenuItem>
    </Select>
  </Box>
));

TimeframeSelector.displayName = "TimeframeSelector";

/**
 * Custom date range inputs
 */
// Convert an exclusive end-date string to the inclusive (last visible day) form.
const exclusiveToInclusive = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(new Date(dateStr).getTime() - MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
// Convert a user-entered inclusive date back to exclusive for internal storage.
const inclusiveToExclusive = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(new Date(dateStr).getTime() + MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

export const CustomDateInputs = memo(({ customDateRange, onCustomDateChange }: any) => {
  if (!customDateRange.enabled) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        From:
      </Typography>
      <TextField
        type="date"
        size="small"
        value={customDateRange.startDate}
        onChange={(e) => onCustomDateChange("startDate", e.target.value)}
        sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", px: 1, py: 0.5 } }}
      />
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        To:
      </Typography>
      <TextField
        type="date"
        size="small"
        value={exclusiveToInclusive(customDateRange.endDate)}
        onChange={(e) => onCustomDateChange("endDate", inclusiveToExclusive(e.target.value))}
        sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", px: 1, py: 0.5 } }}
      />
    </Box>
  );
});

CustomDateInputs.displayName = "CustomDateInputs";

/**
 * Utilization toggle button
 */
export const UtilizationToggle = memo(({ showUtilization, onToggle }: any) => (
  <Button
    onClick={onToggle}
    variant="outlined"
    size="small"
    sx={{
      textTransform: "none",
      fontSize: "0.875rem",
      borderColor: "grey.300",
      color: "text.primary",
      "&:hover": { bgcolor: "grey.50" },
    }}
    startIcon={showUtilization ? <VisibilityIcon sx={{ fontSize: 16 }} /> : <VisibilityOffIcon sx={{ fontSize: 16 }} />}
  >
    {showUtilization ? "Hide" : "Show"} Utilization
  </Button>
));

UtilizationToggle.displayName = "UtilizationToggle";

/**
 * Expand/Collapse all button
 */
export const ExpandCollapseButton = memo(({ isAllExpanded, onToggle }: any) => (
  <Button
    onClick={onToggle}
    variant="contained"
    size="small"
    sx={{
      textTransform: "none",
      fontSize: "0.875rem",
      bgcolor: "#dbeafe",
      color: "#1d4ed8",
      boxShadow: "none",
      "&:hover": { bgcolor: "#bfdbfe", boxShadow: "none" },
    }}
  >
    {isAllExpanded ? "Collapse All" : "Expand All"}
  </Button>
));

ExpandCollapseButton.displayName = "ExpandCollapseButton";

/**
 * Combined controls bar
 */
export const ControlsBar = memo(
  ({
    timeframe,
    customDateRange,
    showUtilization,
    isAllExpanded,
    onTimeframeChange,
    onCustomDateChange,
    onUtilizationToggle,
    onExpandCollapseToggle,
  }: any) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <TimeframeSelector
        timeframe={timeframe}
        customDateRange={customDateRange}
        onTimeframeChange={onTimeframeChange}
        onCustomDateChange={onCustomDateChange}
      />
      <CustomDateInputs customDateRange={customDateRange} onCustomDateChange={onCustomDateChange} />
      <UtilizationToggle showUtilization={showUtilization} onToggle={onUtilizationToggle} />
      <ExpandCollapseButton isAllExpanded={isAllExpanded} onToggle={onExpandCollapseToggle} />
    </Box>
  )
);

ControlsBar.displayName = "ControlsBar";
