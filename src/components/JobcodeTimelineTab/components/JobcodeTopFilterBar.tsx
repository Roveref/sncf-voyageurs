/**
 * JobcodeTopFilterBar — top filter bar for the JobcodeTimelineTab.
 *
 * Four controls in a row:
 *   1. Free text search (matches asset name, site, project)
 *   2. Site picker (autocomplete)
 *   3. Project picker (autocomplete, cascades on site+person)
 *   4. Référent picker (autocomplete)
 *
 * Visual style: borderless filled inputs on `action.hover` background —
 * consistent with the rest of the dashboard (OpportunityToolbar, etc.).
 */
import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import type { SxProps, Theme } from "@mui/material/styles";
import type { Jobcode } from "../hooks/useJobcodeData";
import type { UseJobcodeFilterStateResult } from "../hooks/useJobcodeFilterState";

interface JobcodeTopFilterBarProps {
  filterState: UseJobcodeFilterStateResult;
  accountOptions: string[];
  peopleOptions: string[];
  jobcodeOptions: Jobcode[];
  selectedJobcode: Jobcode | null;
  onSelectJobcode: (jobcode: Jobcode | null) => void;
}

const formatRevenue = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
};

/** Shared style — borderless filled field matching the dashboard pattern. */
const fieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "action.hover",
    borderRadius: 2,
    fontSize: "0.85rem",
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&:hover .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "none" },
  },
  "& .MuiInputLabel-root": {
    fontSize: "0.85rem",
    color: "text.secondary",
  },
};

const JobcodeTopFilterBar = memo(
  ({
    filterState,
    accountOptions,
    peopleOptions,
    jobcodeOptions,
    selectedJobcode,
    onSelectJobcode,
  }: JobcodeTopFilterBarProps) => {
    const { filters, setSearchText, setAccountFilter, setPersonFilter, setGroupByJobcode, clearAll } = filterState;

    const hasAnyFilter = useMemo(
      () => !!(filters.searchText || filters.accountFilter || filters.jobcodeFilter || filters.personFilter),
      [filters]
    );

    return (
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Rechercher (actif, site, projet)…"
          value={filters.searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ ...fieldSx, flex: "1 1 220px", minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ opacity: 0.6 }} />
              </InputAdornment>
            ),
            endAdornment: filters.searchText ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchText("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* Site */}
        <Autocomplete<string, false, false, false>
          size="small"
          options={accountOptions}
          value={filters.accountFilter}
          onChange={(_, v) => setAccountFilter(v)}
          sx={{ ...fieldSx, flex: "1 1 200px", minWidth: 180 }}
          renderInput={(params) => <TextField {...params} label="Site" placeholder="Tous les sites" />}
        />

        {/* Projet */}
        <Autocomplete<Jobcode, false, false, false>
          size="small"
          options={jobcodeOptions}
          value={selectedJobcode}
          onChange={(_, v) => onSelectJobcode(v)}
          getOptionLabel={(opt) => opt.jobcode}
          isOptionEqualToValue={(a, b) => a.jobcode === b.jobcode}
          renderOption={(props, opt) => (
            <Box component="li" {...props}>
              <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <Box sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{opt.jobcode}</Box>
                <Box sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.3 }}>
                  {opt.account} · {opt.opportunityCount} actif{opt.opportunityCount > 1 ? "s" : ""} ·{" "}
                  {formatRevenue(opt.totalRevenue)}
                </Box>
              </Box>
            </Box>
          )}
          sx={{ ...fieldSx, flex: "2 1 280px", minWidth: 260 }}
          renderInput={(params) => <TextField {...params} label="Projet" placeholder="Sélectionner un projet" />}
        />

        {/* Référent */}
        <Autocomplete<string, false, false, false>
          size="small"
          options={peopleOptions}
          value={filters.personFilter}
          onChange={(_, v) => setPersonFilter(v)}
          sx={{ ...fieldSx, flex: "1 1 200px", minWidth: 180 }}
          renderInput={(params) => <TextField {...params} label="Référent" placeholder="Tout référent" />}
        />

        {/* Grouping toggle */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.groupByJobcode}
              onChange={(e) => setGroupByJobcode(e.target.checked)}
            />
          }
          label="Grouper par projet"
          sx={{
            ml: 0.5,
            mr: 0,
            "& .MuiFormControlLabel-label": { fontSize: 12, fontWeight: 500 },
          }}
        />

        {/* Clear all */}
        {hasAnyFilter && (
          <Tooltip title="Effacer tous les filtres" arrow>
            <IconButton size="small" onClick={clearAll} sx={{ alignSelf: "center" }}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }
);
JobcodeTopFilterBar.displayName = "JobcodeTopFilterBar";

export { JobcodeTopFilterBar };
