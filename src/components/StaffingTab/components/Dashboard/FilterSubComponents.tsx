import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Slider from "@mui/material/Slider";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ClearIcon from "@mui/icons-material/Clear";
import { UTILIZATION_FILTERS, UTILIZATION_FILTER_LABELS } from "../../utils/filterUtils";
import { easing } from "../../../../styles/animations";

// ─── Cascade filter criteria definitions ─────────────────────────────────────
export const CASCADE_CRITERIA = [
  { key: "grade", label: "Grade", type: "select" },
  { key: "subTeam", label: "Team", type: "select" },
  { key: "project", label: "Project", type: "select" },
  { key: "category", label: "Category", type: "select" },
  { key: "tuRange", label: "TU %", type: "range", min: 0, max: 200 },
  { key: "dispoRange", label: "Avail %", type: "range", min: 0, max: 100 },
  { key: "fragRange", label: "Fragmentation", type: "range", min: 0, max: 100 },
  { key: "projectCount", label: "# Projects", type: "range", min: 0, max: 20 },
  { key: "sapCompletion", label: "SAP completion %", type: "range", min: 0, max: 100 },
];

// ─── DualRangeSlider Props ──────────────────────────────────────────────────
interface DualRangeSliderProps {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  valueMin?: number;
  valueMax?: number;
  onChange: (lo: number, hi: number) => void;
}

// ─── Dual-handle range slider (Pipeline-aligned) ────────────────────────────
export const DualRangeSlider = memo(
  ({ label, min = 0, max = 100, step = 5, valueMin, valueMax, onChange }: DualRangeSliderProps) => {
    const theme = useTheme();
    const lo = valueMin ?? min;
    const hi = valueMax ?? max;
    const isDefault = lo <= min && hi >= max;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: 48,
          px: 1.5,
          border: 1,
          borderRadius: 1,
          borderColor: isDefault ? "grey.300" : "grey.400",
          bgcolor: isDefault ? "transparent" : theme.palette.grey[100],
          transition: `border-color 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}`,
        }}
      >
        <Typography sx={{ color: "grey.500", whiteSpace: "nowrap", fontWeight: 500, fontSize: "0.875rem" }}>
          {label}
        </Typography>
        <Box sx={{ width: 120, mx: 1 }}>
          <Slider
            value={[lo, hi]}
            onChange={(_, newValue) => onChange((newValue as number[])[0], (newValue as number[])[1])}
            min={min}
            max={max}
            step={step}
            size="small"
            disableSwap
            sx={{
              "& .MuiSlider-thumb": { width: 14, height: 14 },
              "& .MuiSlider-track": { height: 4 },
              "& .MuiSlider-rail": { height: 4 },
            }}
          />
        </Box>
        <Typography
          sx={{ color: "grey.400", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}
        >
          {lo}–{hi}%
        </Typography>
      </Box>
    );
  }
);
DualRangeSlider.displayName = "DualRangeSlider";

// ─── CascadeFilterRow Props ─────────────────────────────────────────────────
interface CascadeFilterValue {
  criterion: string;
  value: string | { min?: number; max?: number };
}

interface CascadeFilterRowProps {
  filter: CascadeFilterValue;
  index: number;
  usedCriteria: string[];
  options: Record<string, { value: string; label: string }[]>;
  onChange: (index: number, filter: CascadeFilterValue) => void;
  onRemove: (index: number) => void;
}

// ─── Single cascade filter row ────────────────────────────────────────────────
export const CascadeFilterRow = memo(
  ({ filter, index, usedCriteria, options, onChange, onRemove }: CascadeFilterRowProps) => {
    const availableCriteria = CASCADE_CRITERIA.filter(
      (c) => c.key === filter.criterion || !usedCriteria.includes(c.key)
    );
    const criterionDef = CASCADE_CRITERIA.find((c) => c.key === filter.criterion);

    const handleCriterionChange = (e: SelectChangeEvent<string>) => {
      onChange(index, { criterion: e.target.value, value: "" });
    };

    const handleValueChange = (val: string | { min?: number; max?: number }) => {
      onChange(index, { ...filter, value: val });
    };

    const handleRangeChange = (field: string, val: string) => {
      const current = typeof filter.value === "object" && filter.value ? filter.value : {};
      handleValueChange({ ...current, [field]: parseFloat(val) || 0 });
    };

    const renderValueSelector = () => {
      if (!filter.criterion) return null;
      if (!criterionDef) return null;

      if (criterionDef.type === "range") {
        const rangeVal = typeof filter.value === "object" && filter.value ? filter.value : {};
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TextField
              type="number"
              size="small"
              inputProps={{ min: criterionDef.min, max: criterionDef.max, step: 5 }}
              value={rangeVal.min ?? ""}
              onChange={(e) => handleRangeChange("min", e.target.value)}
              placeholder={String(criterionDef.min)}
              sx={{
                width: 64,
                "& .MuiInputBase-input": { py: 0.75, px: 1, fontSize: "0.875rem", textAlign: "center" },
              }}
            />
            <Typography sx={{ color: "grey.400", fontSize: "0.875rem" }}>\u2013</Typography>
            <TextField
              type="number"
              size="small"
              inputProps={{ min: criterionDef.min, max: criterionDef.max, step: 5 }}
              value={rangeVal.max ?? ""}
              onChange={(e) => handleRangeChange("max", e.target.value)}
              placeholder={String(criterionDef.max)}
              sx={{
                width: 64,
                "& .MuiInputBase-input": { py: 0.75, px: 1, fontSize: "0.875rem", textAlign: "center" },
              }}
            />
          </Box>
        );
      }

      const opts = options[filter.criterion] || [];
      return (
        <Select
          value={filter.value || ""}
          onChange={(e) => handleValueChange(e.target.value as string)}
          size="small"
          displayEmpty
          sx={{ minHeight: 40, fontSize: "0.875rem" }}
        >
          <MenuItem value="" sx={{ fontSize: "0.875rem" }}>
            -- Select --
          </MenuItem>
          {opts.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.875rem" }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      );
    };

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Select
          value={filter.criterion || ""}
          onChange={handleCriterionChange}
          size="small"
          displayEmpty
          sx={{ minHeight: 40, fontSize: "0.875rem", bgcolor: "grey.50", fontWeight: 500 }}
        >
          <MenuItem value="" sx={{ fontSize: "0.875rem" }}>
            Criterion\u2026
          </MenuItem>
          {availableCriteria.map((c) => (
            <MenuItem key={c.key} value={c.key} sx={{ fontSize: "0.875rem" }}>
              {c.label}
            </MenuItem>
          ))}
        </Select>
        {renderValueSelector()}
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          sx={{ color: "grey.400", "&:hover": { color: "error.main" } }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    );
  }
);
CascadeFilterRow.displayName = "CascadeFilterRow";

// ─── ActiveChips Props ──────────────────────────────────────────────────────
interface SearchTag {
  type: string;
  text: string;
  minLevel?: number;
}

interface ActiveChipsFilters {
  search?: string;
  searchScope?: string;
  searchTags?: SearchTag[];
  utilization?: string;
  project?: string;
  categories?: string[];
  dispoMin?: number;
  dispoMax?: number;
  grades?: string | string[];
  subTeams?: string | string[];
  skillSearch?: string;
  skillMinLevel?: number;
  hideTu100?: boolean;
  hideTuAboveTarget?: boolean;
  gradeTransitionOnly?: boolean;
  churnFilter?: string;
  sapFilter?: string;
  cascadeFilters?: CascadeFilterValue[];
}

interface ActiveChipsProps {
  filters: ActiveChipsFilters;
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

// ─── Active filter chips (Pipeline-aligned) ──────────────────────────────────
export const ActiveChips = memo(({ filters, onRemove, onClearAll }: ActiveChipsProps) => {
  const chips: { key: string; label: string }[] = [];
  if (filters.search) {
    const scopeLabels: Record<string, string> = { person: "person", project: "project", skill: "skill" };
    const prefix =
      filters.searchScope && scopeLabels[filters.searchScope] ? `${scopeLabels[filters.searchScope]}: ` : "";
    chips.push({ key: "search", label: `${prefix}"${filters.search}"` });
  }
  if (filters.searchTags && filters.searchTags.length > 0) {
    filters.searchTags.forEach((tag, i: number) => {
      const lvlSuffix = tag.type === "skill" && tag.minLevel ? ` \u2265${tag.minLevel}` : "";
      chips.push({ key: `tag_${i}`, label: `${tag.type}: "${tag.text}"${lvlSuffix}` });
    });
  }
  if (filters.utilization && filters.utilization !== UTILIZATION_FILTERS.ALL) {
    chips.push({ key: "utilization", label: UTILIZATION_FILTER_LABELS[filters.utilization] });
  }
  if (filters.project && filters.project !== "all") chips.push({ key: "project", label: filters.project });
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    chips.push({ key: "categories", label: `Categories: ${filters.categories.length}` });
  }
  if ((filters.dispoMin && filters.dispoMin > 0) || (filters.dispoMax && filters.dispoMax < 100)) {
    chips.push({ key: "dispo", label: `Avail: ${filters.dispoMin || 0}\u2013${filters.dispoMax || 100}%` });
  }
  if (filters.grades && filters.grades !== "all" && Array.isArray(filters.grades)) {
    chips.push({ key: "grades", label: `Grades: ${filters.grades.length}` });
  }
  if (filters.subTeams && filters.subTeams !== "all" && Array.isArray(filters.subTeams)) {
    chips.push({ key: "subTeams", label: `Teams: ${filters.subTeams.length}` });
  }
  if (filters.skillSearch && filters.skillSearch.trim()) {
    const lvl = filters.skillMinLevel || 0;
    chips.push({ key: "skill", label: `Skill: "${filters.skillSearch}" lvl.${lvl}+` });
  }
  if (filters.hideTu100) chips.push({ key: "hideTu100", label: "Hide TU=100%" });
  if (filters.hideTuAboveTarget) chips.push({ key: "hideTuAboveTarget", label: "Hide TU\u2265Target" });
  if (filters.gradeTransitionOnly) chips.push({ key: "gradeTransitionOnly", label: "Grade \u0394" });
  if (filters.churnFilter) {
    const [cType, cMonth] = filters.churnFilter.split("::");
    const cLabel = cType === "arr" ? "Arrivals" : cType === "dep" ? "Departures" : "Grade \u0394";
    chips.push({ key: "churnFilter", label: `${cLabel} ${cMonth}` });
  }

  if (filters.sapFilter && filters.sapFilter !== "all") {
    const sapLabels: Record<string, string> = {
      complete: "SAP complete",
      partial: "SAP partial",
      empty: "SAP empty",
      incomplete: "SAP incomplete",
    };
    chips.push({ key: "sapFilter", label: sapLabels[filters.sapFilter] || filters.sapFilter });
  }
  if (filters.cascadeFilters && filters.cascadeFilters.length > 0) {
    filters.cascadeFilters.forEach((cf, i: number) => {
      if (cf.criterion) {
        const def = CASCADE_CRITERIA.find((c) => c.key === cf.criterion);
        const label = def ? def.label : cf.criterion;
        const valStr =
          typeof cf.value === "object"
            ? `${(cf.value as { min?: number; max?: number }).min || 0}\u2013${(cf.value as { min?: number; max?: number }).max || "\u221e"}`
            : cf.value || "";
        chips.push({ key: `cascade_${i}`, label: `${label}: ${valStr}` });
      }
    });
  }
  if (!chips.length) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} size="small" onDelete={() => onRemove(c.key)} />
      ))}
      <Button
        onClick={onClearAll}
        variant="text"
        color="primary"
        size="small"
        startIcon={<ClearIcon />}
        sx={{
          ml: 0.5,
          textTransform: "none",
          transition: `transform 0.2s ${easing.bounce}`,
          "&:hover": {
            transform: "scale(1.05)",
            "& .MuiButton-startIcon": {
              transform: "scale(1.1) rotate(5deg)",
              transition: `transform 0.2s ${easing.bounce}`,
            },
          },
          "&:active": { transform: "scale(0.98)" },
        }}
      >
        Clear all
      </Button>
    </Box>
  );
});
ActiveChips.displayName = "ActiveChips";
