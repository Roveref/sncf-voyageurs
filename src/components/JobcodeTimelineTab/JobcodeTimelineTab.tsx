/**
 * JobcodeTimelineTab — main orchestration layer.
 *
 * Renders:
 *   1. Top filter bar (search, account, jobcode, person, grouping toggle)
 *   2. Selected jobcode header (only when exactly one jobcode is selected)
 *   3. Real Gantt timeline — shown whenever at least one filter is active
 *      OR a jobcode is selected. Flat or grouped depending on the toggle.
 *   4. BCS simulator (only for a single selected jobcode)
 */
import { useEffect, useMemo, memo } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useCrmData } from "../../queries/useCrmData";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Fade from "@mui/material/Fade";

import { useJobcodeData, useTimelineData } from "./hooks";
import { useJobcodeFilterState } from "./hooks/useJobcodeFilterState";
import { useAllPeople } from "./hooks/useAllPeople";
import { usePersonJobcodeIndex } from "./hooks/usePersonJobcodeIndex";
import { useJobcodeOpportunities } from "./hooks/useJobcodeOpportunities";
import { SkeletonDashboard } from "../common/SkeletonLoaders";

import { JobcodeHeader } from "./components";
import { JobcodeTopFilterBar } from "./components/JobcodeTopFilterBar";
import { JobcodeGantt } from "./components/JobcodeGantt";
import LifecyclePhaseFlow from "./components/LifecyclePhaseFlow";
import InvestmentRequestQueue from "./components/InvestmentRequestQueue";

interface JobcodeTimelineTabProps {
  data: Record<string, unknown>[] | null;
  loading: boolean;
  onSelection?: unknown;
  selectedOpportunities?: unknown;
}

const JobcodeTimelineTab = ({ data, loading }: JobcodeTimelineTabProps) => {
  const showNetRevenue = useAppStore((s) => s.showNetRevenue);
  const { opportunityData } = useCrmData();

  const { jobcodes, selectedJobcode, handleJobcodeSelection } = useJobcodeData(data, loading, showNetRevenue);
  const { opportunityStreams, resetExpandedCards } = useTimelineData(selectedJobcode);

  const filterState = useJobcodeFilterState();
  const allPeople = useAllPeople();
  const personIndex = usePersonJobcodeIndex();

  const accountOptions = useMemo(() => {
    const set = new Set<string>();
    for (const opp of opportunityData) {
      const acc = (opp as { account?: string }).account;
      if (typeof acc === "string" && acc.trim()) set.add(acc.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [opportunityData]);

  const availableJobcodeOptions = useMemo(
    () => filterState.jobcodeOptions(jobcodes, personIndex),
    [filterState, jobcodes, personIndex]
  );

  const { flatOpportunities, groupedOpportunities, totalOpportunities } = useJobcodeOpportunities(
    jobcodes,
    filterState,
    personIndex
  );

  useEffect(() => {
    resetExpandedCards();
  }, [selectedJobcode, resetExpandedCards]);

  // Cascade: clear jobcode selection when it's no longer in the filtered options
  useEffect(() => {
    if (!selectedJobcode) return;
    const stillVisible = availableJobcodeOptions.some((j) => j.jobcode === selectedJobcode.jobcode);
    if (!stillVisible) handleJobcodeSelection(null);
  }, [selectedJobcode, availableJobcodeOptions, handleJobcodeSelection]);

  const showContent = filterState.hasActiveFilter && totalOpportunities > 0;
  const showHeader = selectedJobcode != null;

  const emptyTitle = !filterState.hasActiveFilter ? "Sélectionnez un site ou un projet" : "Aucun résultat";
  const emptyBody = !filterState.hasActiveFilter
    ? "Utilisez les filtres ci-dessus pour visualiser le cycle de vie des actifs et les projets d'investissement."
    : "Aucun actif ne correspond aux filtres sélectionnés.";

  if (loading) return <SkeletonDashboard />;

  return (
    <Fade in={!loading} timeout={500}>
      <Grid container spacing={3}>
        {/* 4 phases PSGA — carte synthétique du cycle de vie des actifs filtrés */}
        <Grid size={12}>
          <LifecyclePhaseFlow filterSite={filterState.filters.accountFilter} />
        </Grid>

        {/* File d'attente des demandes d'investissement (phase Émergence) */}
        <Grid size={12}>
          <InvestmentRequestQueue />
        </Grid>

        {/* Gantt — always rendered, contains the filter bar inside Paper #1 */}
        <Grid size={12}>
          <JobcodeGantt
            filterBarSlot={
              <JobcodeTopFilterBar
                filterState={filterState}
                accountOptions={accountOptions}
                peopleOptions={allPeople}
                jobcodeOptions={availableJobcodeOptions}
                selectedJobcode={selectedJobcode}
                onSelectJobcode={handleJobcodeSelection}
              />
            }
            groups={filterState.filters.groupByJobcode ? groupedOpportunities : undefined}
            flatOpportunities={filterState.filters.groupByJobcode ? undefined : flatOpportunities}
            allVisibleOpportunities={flatOpportunities}
            showContent={showContent}
            emptyTitle={emptyTitle}
            emptyBody={emptyBody}
          />
        </Grid>

        {/* Header — only when a specific jobcode is selected */}
        {showHeader && (
          <Grid size={12}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
              <JobcodeHeader selectedJobcode={selectedJobcode} opportunityStreams={opportunityStreams} />
            </Paper>
          </Grid>
        )}
      </Grid>
    </Fade>
  );
};

export default memo(JobcodeTimelineTab);
