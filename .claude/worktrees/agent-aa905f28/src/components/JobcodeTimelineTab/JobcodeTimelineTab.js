/**
 * JobcodeTimelineTab Component - Main orchestration layer
 * Refactored for better performance and maintainability
 *
 * Performance optimizations:
 * - All data transformations use useMemo (in hooks)
 * - Event handlers use useCallback (in hooks)
 * - Child components use React.memo
 * - Heavy computations extracted into custom hooks
 */

import React, { useEffect } from "react";
import { Grid, Paper, Box, CircularProgress, Fade } from "@mui/material";

// Custom hooks for data management
import { useJobcodeData, useTimelineData } from "./hooks";

// UI Components
import { JobcodeSelectionPanel, JobcodeHeader, TimelineEventList } from "./components";

/**
 * Main JobcodeTimelineTab component
 * Orchestrates all jobcode timeline visualization
 *
 * @param {Array} data - Raw opportunities data
 * @param {boolean} loading - Loading state
 * @param {Function} onSelection - Selection change callback (unused but kept for compatibility)
 * @param {Array} selectedOpportunities - Currently selected opportunities (unused but kept for compatibility)
 */
const JobcodeTimelineTab = ({ data, loading, onSelection, selectedOpportunities }) => {
  // Jobcode data management hook
  const { jobcodes, selectedJobcode, handleJobcodeSelection } = useJobcodeData(data, loading);

  // Timeline data processing hook
  const { timelineData, opportunityStreams, expandedCards, toggleExpanded, resetExpandedCards } =
    useTimelineData(selectedJobcode);

  // Reset expanded cards when jobcode changes
  useEffect(() => {
    resetExpandedCards();
  }, [selectedJobcode, resetExpandedCards]);

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Fade in={!loading} timeout={500}>
      <Grid container spacing={3}>
        {/* Jobcode Selection Panel */}
        <Grid item xs={12}>
          <JobcodeSelectionPanel
            jobcodes={jobcodes}
            selectedJobcode={selectedJobcode}
            onJobcodeSelect={handleJobcodeSelection}
          />
        </Grid>

        {/* Timeline View - Only show when a jobcode is selected */}
        {selectedJobcode && (
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
              }}
            >
              {/* Jobcode Header with opportunity legend */}
              <JobcodeHeader selectedJobcode={selectedJobcode} opportunityStreams={opportunityStreams} />

              {/* Single vertical timeline with inline expandable events */}
              <TimelineEventList
                timelineData={timelineData}
                opportunityStreams={opportunityStreams}
                expandedCards={expandedCards}
                onToggleExpanded={toggleExpanded}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
    </Fade>
  );
};

export default JobcodeTimelineTab;
