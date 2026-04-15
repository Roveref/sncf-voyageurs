/**
 * JobcodeTopFilterBar — top filter bar for the JobcodeTimelineTab.
 *
 * Four controls in a row:
 *   1. Free text search (matches opportunity name, account, jobcode)
 *   2. Account picker (autocomplete)
 *   3. Jobcode picker (autocomplete, cascades on account+person)
 *   4. Person picker (autocomplete — sources: manager/partner/em/ep,
 *      staffing assignees, revenue team, MDS consultants)
 *
 * The bar is purely presentational: it reads the filter state passed
 * in from the parent and calls setters on user interaction. The
 * parent owns the filter state via useJobcodeFilterState.
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
import type { Jobcode } from "../hooks/useJobcodeData";
import type { UseJobcodeFilterStateResult } from "../hooks/useJobcodeFilterState";

interface JobcodeTopFilterBarProps {
  filterState: UseJobcodeFilterStateResult;
  /** Sorted list of all account names. */
  accountOptions: string[];
  /** All people (sorted, unique) — output of useAllPeople. */
  peopleOptions: string[];
  /** Jobcodes that match the current account/person/text filters (NOT the jobcode filter). */
  jobcodeOptions: Jobcode[];
  /** Currently selected jobcode object — used to render the jobcode value. */
  selectedJobcode: Jobcode | null;
  /** Called when the user picks (or clears) a jobcode in the autocomplete. */
  onSelectJobcode: (jobcode: Jobcode | null) => void;
}

const formatRevenue = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
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
          placeholder="Rechercher (opportunité, compte, jobcode)…"
          value={filters.searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ flex: "1 1 220px", minWidth: 200 }}
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

        {/* Account */}
        <Autocomplete<string, false, false, false>
          size="small"
          options={accountOptions}
          value={filters.accountFilter}
          onChange={(_, v) => setAccountFilter(v)}
          sx={{ flex: "1 1 200px", minWidth: 180 }}
          renderInput={(params) => <TextField {...params} label="Compte" placeholder="Tous les comptes" />}
        />

        {/* Jobcode (cascades on account + person) */}
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
                  {opt.account} · {opt.opportunityCount} opp · {formatRevenue(opt.totalRevenue)}
                </Box>
              </Box>
            </Box>
          )}
          sx={{ flex: "2 1 280px", minWidth: 260 }}
          renderInput={(params) => <TextField {...params} label="Jobcode" placeholder="Sélectionner un jobcode" />}
        />

        {/* Person */}
        <Autocomplete<string, false, false, false>
          size="small"
          options={peopleOptions}
          value={filters.personFilter}
          onChange={(_, v) => setPersonFilter(v)}
          sx={{ flex: "1 1 200px", minWidth: 180 }}
          renderInput={(params) => <TextField {...params} label="Personne" placeholder="Toute personne" />}
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
          label="Grouper par jobcode"
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
