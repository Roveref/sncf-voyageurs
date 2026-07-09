/**
 * NeedsBoardV2 — Staffing needs panel wrapped in PiPWrapper.
 *
 * Uses the shared PiPWrapper for drag/resize/snap, focuses on the staffing content:
 * - KPI summary
 * - Demand chart + gap strip
 * - Matrix/list toggle
 * - Inline need creator
 */

import { memo, useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ViewListIcon from "@mui/icons-material/ViewList";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { brand } from "../../../../config/brandConfig";
import { PiPWrapper } from "../../../shared";
import { useDemandData } from "../../hooks/useDemandData";
import DemandChart from "./DemandChart";
import GapStrip from "./GapStrip";
import NeedsList from "./NeedsList";
import NeedsMatrix from "./NeedsMatrix";
import NeedsTimeline from "./NeedsTimeline";
import InlineNeedCreator from "./InlineNeedCreator";
import type { Employee } from "../../types";

interface NeedsBoardV2Props {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  isHoliday: (dateStr: string) => boolean;
  pipelineJobcodes: Map<string, any> | null;
  opportunityData: any[];
  scenarioId?: string | null;
  onOpenCreateModal?: () => void;
  onOpenEditor?: (prefill: {
    empId: string;
    jobNo?: string;
    jobName?: string;
    startDate?: string;
    endDate?: string;
    utilization?: number;
    needId?: string;
  }) => void;
}

const HORIZON_OPTIONS = [
  { value: 6, label: "6m" },
  { value: 9, label: "9m" },
  { value: 12, label: "12m" },
];

const NeedsBoardV2 = memo(
  ({
    open,
    onClose,
    employees,
    isHoliday,
    pipelineJobcodes,
    opportunityData,
    scenarioId,
    onOpenCreateModal,
    onOpenEditor,
  }: NeedsBoardV2Props) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const borderDivider = isDark ? alpha("#fff", 0.06) : alpha("#000", 0.06);

    // ── Local state ──
    const [horizon, setHorizon] = useState(9);
    const [showPipeline, setShowPipeline] = useState(false);
    const [viewMode, setViewMode] = useState<"timeline" | "matrix" | "list">("timeline");
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
    const [candidateNeedId, setCandidateNeedId] = useState<string | null>(null);
    const [creatorOpen, setCreatorOpen] = useState(false);
    const [creatorPrefill, setCreatorPrefill] = useState<{
      grade?: string;
      startDate?: string;
      endDate?: string;
    } | null>(null);

    // ── Demand data ──
    const { rows, buckets, allNeeds, summary } = useDemandData({ employees, isHoliday, horizon, opportunityData });

    // ── Chart interaction ──
    const handleBarClick = useCallback(
      (monthKey: string, grade: string) => {
        if (selectedMonth === monthKey && selectedGrade === grade) {
          setSelectedMonth(null);
          setSelectedGrade(null);
        } else {
          setSelectedMonth(monthKey);
          setSelectedGrade(grade);
        }
      },
      [selectedMonth, selectedGrade]
    );

    const handleMonthClick = useCallback((monthKey: string) => {
      setSelectedMonth((prev) => (prev === monthKey ? null : monthKey));
      setSelectedGrade(null);
    }, []);

    const handleClearFilter = useCallback(() => {
      setSelectedMonth(null);
      setSelectedGrade(null);
    }, []);

    const periodFilter = useMemo(() => {
      if (!selectedMonth) return null;
      const bucket = buckets.find((b) => b.key === selectedMonth);
      return bucket ? { start: bucket.startDate, end: bucket.endDate } : null;
    }, [selectedMonth, buckets]);

    // ── Inline creator ──
    const handleOpenCreator = useCallback((prefill?: { grade?: string; startDate?: string; endDate?: string }) => {
      setCreatorPrefill(prefill || null);
      setCreatorOpen(true);
    }, []);

    const handleCreatorClose = useCallback(() => {
      setCreatorOpen(false);
      setCreatorPrefill(null);
    }, []);

    const handleGapClick = useCallback(
      (monthKey: string) => {
        const bucket = buckets.find((b) => b.key === monthKey);
        if (!bucket) return;
        const row = rows.find((r) => r.monthKey === monthKey);
        if (row && row.gapTotal > 0) {
          const endDate = new Date(bucket.endDate + "T00:00:00");
          endDate.setDate(endDate.getDate() - 1);
          handleOpenCreator({
            grade: selectedGrade || undefined,
            startDate: bucket.startDate,
            endDate: endDate.toISOString().slice(0, 10),
          });
        } else {
          handleMonthClick(monthKey);
        }
      },
      [buckets, rows, selectedGrade, handleOpenCreator, handleMonthClick]
    );

    const toolbarContent = useMemo(
      () => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <ToggleButtonGroup
            value={horizon}
            exclusive
            onChange={(_, v) => v && setHorizon(v)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                px: 1,
                py: 0.5,
                fontSize: "0.78rem",
                fontWeight: 600,
                textTransform: "none",
              },
            }}
          >
            {HORIZON_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Chip
            label="Parc d'actifs"
            size="small"
            clickable
            onClick={() => setShowPipeline(!showPipeline)}
            icon={<TrendingUpIcon sx={{ fontSize: "14px !important" }} />}
            sx={{
              height: 32,
              fontSize: "0.78rem",
              fontWeight: 600,
              bgcolor: showPipeline ? alpha(theme.palette.info.main, 0.1) : "transparent",
              color: showPipeline ? theme.palette.info.main : "text.disabled",
              border: `1px solid ${showPipeline ? alpha(theme.palette.info.main, 0.25) : borderDivider}`,
            }}
          />

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            sx={{ "& .MuiToggleButton-root": { px: 0.5, py: 0.5 } }}
          >
            <ToggleButton value="timeline">
              <Tooltip title="Timeline">
                <ViewTimelineIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="matrix">
              <Tooltip title="Matrice">
                <GridViewIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list">
              <Tooltip title="Liste">
                <ViewListIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => handleOpenCreator()}
            sx={{
              textTransform: "none",
              fontSize: "0.78rem",
              fontWeight: 600,
              py: 0.5,
              px: 1.5,
              minWidth: 0,
              borderRadius: 1.5,
              boxShadow: "none",
              "&:hover": { boxShadow: "none" },
            }}
          >
            Need
          </Button>
        </Box>
      ),
      [horizon, showPipeline, viewMode, theme, borderDivider, handleOpenCreator]
    );

    return (
      <PiPWrapper
        open={open}
        onClose={onClose}
        storageKey="pip_needsboard"
        title="Staffing Needs"
        defaultWidth={720}
        defaultHeight={680}
        minWidth={520}
        minHeight={400}
        headless
      >
        <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Title + toolbar — same pattern as PipelineInsights */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 2, minHeight: 36, gap: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ flexShrink: 0 }}>
              Staffing Needs
            </Typography>
            <Box sx={{ flex: 1 }}>{toolbarContent}</Box>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" }, flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {/* ── Chart ── */}
          <Box sx={{ flexShrink: 0 }}>
            <DemandChart
              rows={rows}
              mode={"etp"}
              showPipeline={showPipeline}
              onBarClick={handleBarClick}
              selectedMonth={selectedMonth}
              selectedGrade={selectedGrade}
              hideLegend
            />
          </Box>
          <Divider sx={{ borderColor: borderDivider }} />

          {/* ── Needs view (timeline / matrix / list) ── */}
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {viewMode === "timeline" ? (
              <Box sx={{ flex: 1, overflow: "auto" }}>
                <NeedsTimeline
                  gradeFilter={selectedGrade}
                  opportunityData={opportunityData}
                  scenarioId={scenarioId}
                  buckets={buckets}
                  employees={employees}
                  onEditNeed={(need) =>
                    handleOpenCreator({
                      grade: need.grade,
                      startDate: need.startDate,
                      endDate: need.endDate,
                    })
                  }
                />
              </Box>
            ) : viewMode === "matrix" ? (
              <NeedsMatrix
                scenarioId={scenarioId}
                pipelineJobcodes={pipelineJobcodes}
                opportunityData={opportunityData}
                onOpenEditor={onOpenEditor}
                employees={employees}
                gradeFilter={selectedGrade}
                onClearFilter={handleClearFilter}
              />
            ) : (
              <NeedsList
                gradeFilter={selectedGrade}
                periodFilter={periodFilter}
                scenarioId={scenarioId}
                pipelineJobcodes={pipelineJobcodes}
                opportunityData={opportunityData}
                onOpenEditor={onOpenEditor}
                onClearFilter={handleClearFilter}
                onCandidateOpen={setCandidateNeedId}
                candidateNeedId={candidateNeedId}
                employees={employees}
              />
            )}
          </Box>

          {/* ── Inline creator ── */}
          {creatorOpen && (
            <InlineNeedCreator
              onClose={handleCreatorClose}
              opportunityData={opportunityData}
              prefill={creatorPrefill}
              buckets={buckets}
              rows={rows}
              isHoliday={isHoliday}
            />
          )}
        </Box>
      </PiPWrapper>
    );
  }
);
NeedsBoardV2.displayName = "NeedsBoardV2";

export default NeedsBoardV2;
