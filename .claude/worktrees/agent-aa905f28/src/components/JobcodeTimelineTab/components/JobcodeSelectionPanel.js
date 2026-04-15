/**
 * JobcodeSelectionPanel Component
 * Displays jobcode search and selection interface
 *
 * Performance optimizations:
 * - React.memo to prevent unnecessary re-renders
 * - Memoized filter function in Autocomplete
 */

import React from "react";
import { Paper, Typography, Box, TextField, Autocomplete, Chip, useTheme, alpha } from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import SearchIcon from "@mui/icons-material/Search";
import { formatCurrency } from "../utils";

/**
 * JobcodeSelectionPanel component
 * @param {Array} jobcodes - Array of jobcode objects
 * @param {Object|null} selectedJobcode - Currently selected jobcode
 * @param {Function} onJobcodeSelect - Callback when jobcode is selected
 */
const JobcodeSelectionPanel = React.memo(({ jobcodes, selectedJobcode, onJobcodeSelect }) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
      }}
    >
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Jobcode Timeline View
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select a jobcode to view the complete project timeline. Connected opportunities are shown as separate streams.
      </Typography>

      <Box sx={{ mb: selectedJobcode ? 3 : 0 }}>
        <Autocomplete
          id="jobcode-search"
          options={jobcodes}
          getOptionLabel={(option) => {
            return `${String(option.jobcode)} - ${option.account}`;
          }}
          onChange={(event, newValue) => {
            if (newValue) onJobcodeSelect(newValue);
          }}
          value={selectedJobcode}
          isOptionEqualToValue={(option, value) => {
            if (!option || !value) return false;
            return String(option.jobcode) === String(value.jobcode);
          }}
          filterOptions={(options, state) => {
            const inputValue = state.inputValue.toLowerCase().trim();

            if (!inputValue) {
              return options;
            }

            return options.filter((option) => {
              const jobcodeStr = String(option.jobcode).toLowerCase();
              const accountStr = String(option.account).toLowerCase();

              return (
                jobcodeStr.includes(inputValue) ||
                accountStr.includes(inputValue) ||
                option.opportunities.some(
                  (opp) =>
                    (opp["Opportunity"] && opp["Opportunity"].toLowerCase().includes(inputValue)) ||
                    (opp["Service Line 1"] && opp["Service Line 1"].toLowerCase().includes(inputValue))
                )
              );
            });
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Jobcode or Account"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <SearchIcon color="action" sx={{ mr: 1 }} />
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
              placeholder="Type to search..."
              fullWidth
              variant="outlined"
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Typography variant="body1" fontWeight={600}>
                    {option.jobcode}
                  </Typography>
                  <Chip size="small" label={formatCurrency(option.totalRevenue)} color="primary" />
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {option.account}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.opportunityCount} opportunities
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        />
      </Box>

      {!selectedJobcode && (
        <Box
          sx={{
            mt: 4,
            p: 4,
            textAlign: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderRadius: 3,
            borderStyle: "dashed",
            borderWidth: 1,
            borderColor: alpha(theme.palette.primary.main, 0.2),
          }}
        >
          <TimelineIcon
            sx={{
              fontSize: 60,
              color: alpha(theme.palette.primary.main, 0.3),
              mb: 2,
            }}
          />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Jobcode Selected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search and select a jobcode above to view its complete project timeline
          </Typography>
        </Box>
      )}
    </Paper>
  );
});

JobcodeSelectionPanel.displayName = "JobcodeSelectionPanel";

export default JobcodeSelectionPanel;
