/**
 * StableControls + FilterRow — extracted from StaffingDateRangeFilter.
 * These sub-components are stable across timeline pans (memo bail-out on pan).
 */
import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useTheme } from "@mui/material/styles";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { easing } from "../../../../styles/animations";
import { getPresetButtonSx } from "../../../shared/DateRangeFilter";
import { GRAN_CYCLE, GRAN_CYCLE_LABELS, GRANULARITY_OPTS } from "./dateRangePresets";
import { UTILIZATION_FILTERS, UTILIZATION_FILTER_LABELS } from "../../utils/filterUtils";

// ─── Sub-component B: stable controls (granularity, heatmap, zoom, reset) ────────────
const StableControls = memo(
  ({
    granularity,
    onGranularityChange,
    heatmapMode,
    onHeatmapModeChange,
    chargeableCombined,
    onChargeableCombinedChange,
    dataSourceDebug,
    onDataSourceDebugChange,
    hasSapData,
    onReset,
    filters,
    onFilterChange,
  }: any) => {
    const theme = useTheme();

    const granButtonSx = (isActive: boolean) => ({
      ...getPresetButtonSx(isActive, {
        activeBg: theme.palette.grey[400],
        activeHoverBg: theme.palette.grey[500],
        inactiveBg: theme.palette.grey[100],
        inactiveHoverBg: theme.palette.grey[200],
        activeColor: theme.palette.getContrastText(theme.palette.grey[400]),
        inactiveColor: theme.palette.text.secondary,
      }),
      minWidth: 56,
      py: 0.75,
    });

    return (
      <>
        {/* Section 3: Granularity */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Button
            size="small"
            onClick={() => {
              const idx = GRAN_CYCLE.indexOf(granularity);
              const next = GRAN_CYCLE[(idx + 1) % GRAN_CYCLE.length];
              onGranularityChange(next);
            }}
            sx={granButtonSx(GRAN_CYCLE.includes(granularity))}
          >
            {GRAN_CYCLE_LABELS[granularity] || "J"}
          </Button>
          {GRANULARITY_OPTS.map((opt) => (
            <Button
              key={opt.value}
              onClick={() => onGranularityChange(opt.value)}
              size="small"
              sx={granButtonSx(granularity === opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: "divider" }} />

        {/* Section 4: Heatmap mode */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Button
            size="small"
            title={
              heatmapMode === "utilization"
                ? "Utilization — click for Turn-Over"
                : heatmapMode === "to"
                  ? "Turn-Over — click for Utilization"
                  : "Click for Utilization"
            }
            onClick={() => onHeatmapModeChange(heatmapMode === "utilization" ? "to" : "utilization")}
            sx={granButtonSx(heatmapMode === "utilization" || heatmapMode === "to")}
          >
            {heatmapMode === "to" ? "TO" : "TU"}
          </Button>
          <Button
            size="small"
            onClick={() => onHeatmapModeChange("availability")}
            sx={granButtonSx(heatmapMode === "availability")}
          >
            Avail
          </Button>
          {hasSapData && dataSourceDebug === "all" ? (
            <Button
              size="small"
              title={
                heatmapMode === "variance_hours" ? "Variance in hours — click for %" : "Variance in % — click for hours"
              }
              onClick={() =>
                onHeatmapModeChange(heatmapMode === "variance_hours" ? "variance_hours_pct" : "variance_hours")
              }
              sx={{
                ...granButtonSx(heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct"),
                minWidth: 64,
              }}
            >
              {heatmapMode === "variance_hours_pct" ? "\u0394h%" : "\u0394h"}
            </Button>
          ) : (
            hasSapData && (
              <Button
                size="small"
                title="Billable / net hours per bucket"
                onClick={() => onHeatmapModeChange("hours")}
                sx={granButtonSx(heatmapMode === "hours")}
              >
                h
              </Button>
            )
          )}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: "divider" }} />

        {/* Chargeable mode + data source */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Button
            size="small"
            title={
              chargeableCombined
                ? "Combined: Billable + General Oppty — click to separate"
                : "Separated: Billable only — click to combine"
            }
            onClick={() => onChargeableCombinedChange(!chargeableCombined)}
            sx={granButtonSx(true)}
          >
            {chargeableCombined ? "Ch+GO" : "Ch|GO"}
          </Button>

          {/* Debug: data source filter */}
          {hasSapData && (
            <Button
              size="small"
              title="Debug: cycle data source (All → SAP only → MDS only)"
              onClick={() => {
                const cycle = ["all", "sap", "mds"];
                const idx = cycle.indexOf(dataSourceDebug || "all");
                onDataSourceDebugChange(cycle[(idx + 1) % cycle.length]);
              }}
              sx={{
                ...granButtonSx(dataSourceDebug !== "all"),
                ...(dataSourceDebug === "sap"
                  ? { bgcolor: "#fbbf24", color: "#000", "&:hover": { bgcolor: "#f59e0b" } }
                  : {}),
                ...(dataSourceDebug === "mds"
                  ? { bgcolor: "#60a5fa", color: "#000", "&:hover": { bgcolor: "#3b82f6" } }
                  : {}),
              }}
            >
              {dataSourceDebug === "all" ? "All" : dataSourceDebug === "sap" ? "SAP" : "MDS"}
            </Button>
          )}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: "divider" }} />

        {/* Grade transition filter */}
        {filters && onFilterChange && (
          <Button
            onClick={() => onFilterChange((prev: any) => ({ ...prev, gradeTransitionOnly: !prev.gradeTransitionOnly }))}
            size="small"
            sx={granButtonSx(filters.gradeTransitionOnly)}
            title="Show only employees with a grade transition"
          >
            Grade {"\u0394"}
          </Button>
        )}

        <IconButton
          onClick={onReset}
          title="Default view (9 months, C1/C2)"
          aria-label="Reset to default view"
          size="small"
          sx={{ borderRadius: 1, color: "grey.500", "&:hover": { bgcolor: "grey.100", color: "grey.700" } }}
        >
          <RestartAltIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </>
    );
  }
);

StableControls.displayName = "StableControls";

// ─── Sub-component C: stable filter row (Row 2) ────────────────────────────────────────────────
const FilterRow = memo(({ filters, onFilterChange, hasSapData, dataSourceDebug }: any) => {
  const theme = useTheme();

  const presetButtonSx = (isActive: boolean) => ({
    ...getPresetButtonSx(isActive, {
      activeBg: theme.palette.grey[400],
      activeHoverBg: theme.palette.grey[500],
      inactiveBg: theme.palette.grey[100],
      inactiveHoverBg: theme.palette.grey[200],
      activeColor: theme.palette.getContrastText(theme.palette.grey[400]),
      inactiveColor: theme.palette.text.secondary,
    }),
    minWidth: 36,
    px: 1,
    py: 0.5,
    fontWeight: 600,
    fontSize: "0.75rem",
  });

  if (!filters || !onFilterChange) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.paper",
        borderRadius: 2,
        px: 1.5,
        py: 0.75,
        mt: 0.5,
        flexWrap: "wrap",
      }}
    >
      {/* Utilization select */}
      <Select
        value={filters.utilization || UTILIZATION_FILTERS.ALL}
        onChange={(e) => onFilterChange((prev: any) => ({ ...prev, utilization: e.target.value }))}
        size="small"
        sx={{ height: 32, fontSize: "0.75rem", minWidth: 80, fontWeight: 500 }}
      >
        {Object.entries(UTILIZATION_FILTER_LABELS).map(([value, label]) => (
          <MenuItem key={value} value={value} sx={{ fontSize: "0.75rem" }}>
            {label}
          </MenuItem>
        ))}
      </Select>

      <Divider orientation="vertical" flexItem sx={{ borderColor: "divider" }} />

      {/* TU=100% toggle */}
      <Button
        onClick={() => onFilterChange((prev: any) => ({ ...prev, hideTu100: !prev.hideTu100 }))}
        size="small"
        sx={presetButtonSx(filters.hideTu100)}
        title="Hide employees with TU = 100%"
      >
        TU=100%
        {filters.hideTu100 && <CloseIcon sx={{ fontSize: 12, ml: 0.25 }} />}
      </Button>

      {/* ≥Cible toggle */}
      <Button
        onClick={() => onFilterChange((prev: any) => ({ ...prev, hideTuAboveTarget: !prev.hideTuAboveTarget }))}
        size="small"
        sx={presetButtonSx(filters.hideTuAboveTarget)}
        title="Hide employees with TU >= their grade target"
      >
        {"\u2265"}Target
        {filters.hideTuAboveTarget && <CloseIcon sx={{ fontSize: 12, ml: 0.25 }} />}
      </Button>

      {/* Grade transition filter */}
      <Button
        onClick={() => onFilterChange((prev: any) => ({ ...prev, gradeTransitionOnly: !prev.gradeTransitionOnly }))}
        size="small"
        sx={presetButtonSx(filters.gradeTransitionOnly)}
        title="Show only employees with a grade transition"
      >
        Grade {"\u0394"}
        {filters.gradeTransitionOnly && <CloseIcon sx={{ fontSize: 12, ml: 0.25 }} />}
      </Button>

      {/* SAP filter */}
      {hasSapData && (
        <Select
          value={filters.sapFilter || "all"}
          onChange={(e) => onFilterChange((prev: any) => ({ ...prev, sapFilter: e.target.value }))}
          size="small"
          sx={{
            height: 32,
            fontSize: "0.75rem",
            fontWeight: 500,
            backgroundColor:
              filters.sapFilter && filters.sapFilter !== "all" ? theme.palette.grey[400] : theme.palette.grey[100],
            color:
              filters.sapFilter && filters.sapFilter !== "all"
                ? theme.palette.getContrastText(theme.palette.grey[400])
                : "text.secondary",
            transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}`,
          }}
        >
          <MenuItem value="all" sx={{ fontSize: "0.75rem" }}>
            SAP: all
          </MenuItem>
          <MenuItem value="complete" sx={{ fontSize: "0.75rem" }}>
            SAP complete
          </MenuItem>
          <MenuItem value="partial" sx={{ fontSize: "0.75rem" }}>
            SAP partial
          </MenuItem>
          <MenuItem value="empty" sx={{ fontSize: "0.75rem" }}>
            SAP empty
          </MenuItem>
          <MenuItem value="incomplete" sx={{ fontSize: "0.75rem" }}>
            SAP incomplete
          </MenuItem>
        </Select>
      )}

      <Divider orientation="vertical" flexItem sx={{ borderColor: "divider" }} />

      {/* Sort controls */}
      <IconButton
        onClick={() => onFilterChange((prev: any) => ({ ...prev, autoSort: !prev.autoSort }))}
        size="small"
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          backgroundColor: filters.autoSort !== false ? theme.palette.grey[400] : theme.palette.grey[100],
          color: filters.autoSort !== false ? theme.palette.getContrastText(theme.palette.grey[400]) : "text.secondary",
          transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}`,
          "&:hover": {
            backgroundColor: filters.autoSort !== false ? theme.palette.grey[500] : theme.palette.grey[200],
          },
        }}
        title={filters.autoSort !== false ? "Auto-sort enabled" : "Auto-sort disabled"}
        aria-label={filters.autoSort !== false ? "Disable auto-sort" : "Enable auto-sort"}
      >
        <SwapVertIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          ...(filters.autoSort === false && { opacity: 0.4, pointerEvents: "none" }),
        }}
      >
        <Select
          value={filters.sortBy || "utilization"}
          onChange={(e) => onFilterChange((prev: any) => ({ ...prev, sortBy: e.target.value }))}
          size="small"
          sx={{ height: 32, fontSize: "0.75rem", minWidth: 90 }}
        >
          <MenuItem value="utilization" sx={{ fontSize: "0.75rem" }}>
            Utilization
          </MenuItem>
          <MenuItem value="name" sx={{ fontSize: "0.75rem" }}>
            Name
          </MenuItem>
          <MenuItem value="availability" sx={{ fontSize: "0.75rem" }}>
            Availability
          </MenuItem>
          <MenuItem value="projects" sx={{ fontSize: "0.75rem" }}>
            Projects
          </MenuItem>
          <MenuItem value="fragmentation" sx={{ fontSize: "0.75rem" }}>
            Fragmentation
          </MenuItem>
          <MenuItem value="skillLevel" sx={{ fontSize: "0.75rem" }}>
            Skill Level
          </MenuItem>
          {hasSapData && (
            <MenuItem value="hours" sx={{ fontSize: "0.75rem" }}>
              Hours (Ch/Net)
            </MenuItem>
          )}
          {hasSapData && dataSourceDebug === "all" && (
            <MenuItem value="variance_hours" sx={{ fontSize: "0.75rem" }}>
              {"\u0394"}h (hours)
            </MenuItem>
          )}
          {hasSapData && dataSourceDebug === "all" && (
            <MenuItem value="variance_hours_pct" sx={{ fontSize: "0.75rem" }}>
              {"\u0394"}h% (TU pts)
            </MenuItem>
          )}
        </Select>
        <IconButton
          onClick={() =>
            onFilterChange((prev: any) => ({ ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }))
          }
          size="small"
          aria-label={filters.sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            backgroundColor: theme.palette.grey[100],
            transition: `background-color 0.2s ${easing.bounce}`,
            "&:hover": { backgroundColor: theme.palette.grey[200] },
          }}
        >
          {filters.sortOrder === "asc" ? (
            <ArrowUpwardIcon sx={{ fontSize: 14 }} />
          ) : (
            <ArrowDownwardIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
      </Box>
    </Box>
  );
});

FilterRow.displayName = "FilterRow";

export { StableControls, FilterRow };
