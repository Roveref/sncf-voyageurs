/**
 * RecruitmentTab — KPIs recrutement depuis les données candidates ATS.
 * 5e onglet du dashboard BearingPoint.
 */

import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Fade from "@mui/material/Fade";
import { useRecruitmentData } from "../../queries/useRecruitmentData";
import { DetachableCard } from "../shared";
import ScrollReveal from "../common/ScrollReveal";
import DateRangeFilter from "../shared/DateRangeFilter";
import { PIPELINE_PRESETS, resolvePipelinePreset } from "../shared/dateRangePresets";
import { useDateFilter } from "../../hooks/useDateFilter";
import {
  computeFunnel,
  computeServiceLineCounts,
  computeGradeDistribution,
  computeConversionByPosteYear,
  computeChannelCounts,
  computeDurationByStatus,
  computeRecruiterCounts,
} from "./utils/calculations";
import {
  RecruitmentInsights,
  FunnelChart,
  GradeDistributionChart,
  TimelineChart,
  ServiceLineChart,
  SourcingChart,
  ConversionRateChart,
  ProcessDurationChart,
  RecruiterChart,
  CandidateList,
} from "./components";
import type { FunnelStage } from "./components";

const POSTE_OPTIONS = ["Stagiaire", "Consultant junior", "Consultant expérimenté / Manager"] as const;

export default function RecruitmentTab() {
  const { candidates, aggregates, hasRecruitmentData } = useRecruitmentData();

  // ── Date filter (shared hook — same as Pipeline/Bookings) ──
  const { dateRange, handleDateChange, handleResetDateFilter, dateFilteredData } = useDateFilter(
    candidates as Record<string, any>[],
    "creationDate"
  );

  // ── Chip filters ──
  const [selectedPostes, setSelectedPostes] = useState<Set<string>>(new Set());
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  const [selectedOfferings, setSelectedOfferings] = useState<Set<string>>(new Set());
  const [funnelStage, setFunnelStage] = useState<FunnelStage>("all");

  const togglePoste = (p: string) => {
    setSelectedPostes((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleSegment = (s: string) => {
    setSelectedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleOffering = (o: string) => {
    setSelectedOfferings((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  };

  const handleFunnelClick = useCallback((stage: FunnelStage) => {
    setFunnelStage(stage);
  }, []);

  const handleResetAll = useCallback(() => {
    handleResetDateFilter();
    setSelectedPostes(new Set());
    setSelectedSegments(new Set());
    setSelectedOfferings(new Set());
    setFunnelStage("all");
  }, [handleResetDateFilter]);

  // ── Filtered candidates (date via useDateFilter + chip filters) ──
  const datePosteFiltered = useMemo(() => {
    let result = dateFilteredData as typeof candidates;
    if (selectedPostes.size > 0) result = result.filter((c) => selectedPostes.has(c.poste));
    if (selectedSegments.size > 0)
      result = result.filter((c) => c.applications?.some((a) => a.segment && selectedSegments.has(a.segment)));
    if (selectedOfferings.size > 0)
      result = result.filter((c) => c.applications?.some((a) => a.offering && selectedOfferings.has(a.offering)));
    return result;
  }, [dateFilteredData, selectedPostes, selectedSegments, selectedOfferings]);

  // ── Funnel filter on top ──
  const filtered = useMemo(() => {
    if (funnelStage === "all") return datePosteFiltered;
    if (funnelStage === "evaluated") return datePosteFiltered.filter((c) => c.note != null || c.evaluatedBy);
    if (funnelStage === "interviewed") return datePosteFiltered.filter((c) => c.hrInterview);
    if (funnelStage === "hired") return datePosteFiltered.filter((c) => c.status === "hired");
    return datePosteFiltered;
  }, [datePosteFiltered, funnelStage]);

  // ── Computed KPIs (use datePosteFiltered for funnel itself, filtered for everything else) ──
  const funnel = useMemo(() => computeFunnel(datePosteFiltered), [datePosteFiltered]);
  const serviceLines = useMemo(() => computeServiceLineCounts(filtered), [filtered]);
  const gradeDistribution = useMemo(() => computeGradeDistribution(filtered), [filtered]);
  const conversionByPosteYear = useMemo(() => computeConversionByPosteYear(filtered), [filtered]);
  const channels = useMemo(() => computeChannelCounts(filtered), [filtered]);
  const durationByStatus = useMemo(() => computeDurationByStatus(filtered), [filtered]);
  const recruiterCounts = useMemo(() => computeRecruiterCounts(filtered), [filtered]);

  const activeCandidates = useMemo(() => filtered.filter((c) => c.status === "active"), [filtered]);

  const avgActiveDays = useMemo(() => {
    const now = Date.now();
    const days = activeCandidates
      .map((c) => {
        if (!c.creationDate) return 0;
        return Math.round((now - new Date(c.creationDate).getTime()) / 86400000);
      })
      .filter((d) => d > 0);
    return days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
  }, [activeCandidates]);

  const multiCandidateCount = useMemo(() => filtered.filter((c) => c.jobPostings.includes(",")).length, [filtered]);

  const hasChipFilters =
    selectedPostes.size > 0 || selectedSegments.size > 0 || selectedOfferings.size > 0 || funnelStage !== "all";

  // ── Empty state ──
  if (!hasRecruitmentData || candidates.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No recruitment data available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Import a candidates.csv file in the data/ folder
        </Typography>
      </Box>
    );
  }

  return (
    <Fade in timeout={600} style={{ overflow: "visible" }}>
      <Box sx={{ width: "100%", overflow: "visible" }}>
        {/* ── Date Range Filter (same component as Pipeline/Bookings) ── */}
        <Box sx={{ mb: 3 }}>
          <DateRangeFilter
            dateRange={dateRange}
            onDateChange={handleDateChange}
            onResetFilter={handleResetAll}
            presetGroups={PIPELINE_PRESETS}
            resolvePreset={resolvePipelinePreset}
            resetOnToggleOff
            afterPresets={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 1 }}>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {filtered.length} / {candidates.length}
                </Typography>
              </Box>
            }
          />
        </Box>

        {/* ── Chip Filters (Poste, Segment, Offering) ── */}
        <Box
          sx={{
            display: "flex",
            gap: 0.75,
            mb: 3,
            flexWrap: "wrap",
            alignItems: "center",
            bgcolor: "background.paper",
            borderRadius: 3,
            p: 1.5,
            px: 2,
          }}
        >
          {POSTE_OPTIONS.map((p) => (
            <Chip
              key={p}
              label={p}
              variant={selectedPostes.has(p) ? "filled" : "outlined"}
              color={selectedPostes.has(p) ? "primary" : "default"}
              onClick={() => togglePoste(p)}
              size="small"
            />
          ))}
          {aggregates?.segmentCounts && aggregates.segmentCounts.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              {aggregates.segmentCounts.map(({ segment }) => (
                <Chip
                  key={segment}
                  label={segment}
                  variant={selectedSegments.has(segment) ? "filled" : "outlined"}
                  color={selectedSegments.has(segment) ? "secondary" : "default"}
                  onClick={() => toggleSegment(segment)}
                  size="small"
                />
              ))}
            </>
          )}
          {aggregates?.offeringCounts && aggregates.offeringCounts.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              {aggregates.offeringCounts.slice(0, 10).map(({ offering }) => (
                <Chip
                  key={offering}
                  label={offering}
                  variant={selectedOfferings.has(offering) ? "filled" : "outlined"}
                  color={selectedOfferings.has(offering) ? "info" : "default"}
                  onClick={() => toggleOffering(offering)}
                  size="small"
                />
              ))}
            </>
          )}
          {hasChipFilters && (
            <Chip
              label="Reset"
              size="small"
              onDelete={() => {
                setSelectedPostes(new Set());
                setSelectedSegments(new Set());
                setSelectedOfferings(new Set());
                setFunnelStage("all");
              }}
            />
          )}
        </Box>

        {/* ── KPI Cards ── */}
        <RecruitmentInsights
          funnel={funnel}
          activeCount={activeCandidates.length}
          avgActiveDays={avgActiveDays}
          multiCandidateCount={multiCandidateCount}
        />

        {/* ── Funnel (full width) ── */}
        <DetachableCard storageKey="recruit_funnel" title="Recruitment Funnel" group="Recruitment">
          <FunnelChart funnel={funnel} activeStage={funnelStage} onStageClick={handleFunnelClick} />
        </DetachableCard>

        {/* ── Timeline year overlay (full width) ── */}
        <DetachableCard storageKey="recruit_timeline" title="Recruitment Timeline" group="Recruitment">
          <TimelineChart candidates={filtered} />
        </DetachableCard>

        {/* ── Grade + Service Lines + Sourcing ── */}
        <ScrollReveal>
          <Grid container spacing={3} sx={{ mt: 3, overflow: "visible" }}>
            <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
              <DetachableCard storageKey="recruit_grade_dist" title="Grade Distribution" group="Recruitment">
                <GradeDistributionChart data={gradeDistribution} />
              </DetachableCard>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
              <DetachableCard storageKey="recruit_service_line" title="Service Lines" group="Recruitment">
                <ServiceLineChart data={serviceLines} />
              </DetachableCard>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ overflow: "visible" }}>
              <DetachableCard storageKey="recruit_sourcing" title="Sourcing Channels" group="Recruitment">
                <SourcingChart data={channels} />
              </DetachableCard>
            </Grid>
          </Grid>
        </ScrollReveal>

        {/* ── Conversion + Duration ── */}
        <ScrollReveal>
          <Grid container spacing={3} sx={{ mt: 3, overflow: "visible" }}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ overflow: "visible" }}>
              <DetachableCard storageKey="recruit_conversion" title="Conversion Rates" group="Recruitment">
                <ConversionRateChart data={conversionByPosteYear} />
              </DetachableCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ overflow: "visible" }}>
              <DetachableCard storageKey="recruit_duration" title="Process Duration" group="Recruitment">
                <ProcessDurationChart data={durationByStatus} />
              </DetachableCard>
            </Grid>
          </Grid>
        </ScrollReveal>

        {/* ── Recruiters (conditional) ── */}
        {recruiterCounts.length >= 2 && (
          <ScrollReveal>
            <Grid size={12} sx={{ mt: 3, overflow: "visible" }}>
              <DetachableCard storageKey="recruit_recruiter" title="Recruiter Activity" group="Recruitment">
                <RecruiterChart data={recruiterCounts} />
              </DetachableCard>
            </Grid>
          </ScrollReveal>
        )}

        {/* ── CandidateList (full width) ── */}
        <Grid size={12} sx={{ mt: 3, overflow: "visible" }}>
          <DetachableCard
            group="Recruitment"
            storageKey="recruit-candidate-list"
            title="Candidates"
            defaultWidth={1100}
            defaultHeight={700}
          >
            <CandidateList data={filtered} title="Candidats" />
          </DetachableCard>
        </Grid>
      </Box>
    </Fade>
  );
}
