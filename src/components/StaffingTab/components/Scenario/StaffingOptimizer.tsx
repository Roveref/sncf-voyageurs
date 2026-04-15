/**
 * StaffingOptimizer — Scoring matrix + proposals panel.
 *
 * Full-screen dialog showing a matrix of employees (rows) × needs (columns)
 * with color-coded fit scores. Multiple proposals ranked by TU gain.
 */

import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import DeleteConfirmDialog from "../../../CreateOpportunityModal/DeleteConfirmDialog";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Fade from "@mui/material/Fade";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  expandNeedsToSlots,
  getCellColor,
  STRATEGY_META,
  type CellScore,
  type Proposal,
  type StrategyId,
} from "../../utils/autoAssign";
import type { SerializedEmployee, SerializedProposal } from "../../workers/scoringWorker";
import { readAllStaffingNeeds } from "../../utils/scenarioUtils";
import { getGradeColor, GRADE_ABBR, compareGrades, getGradeAbbr } from "../../constants";
import { getGradeTarget } from "../../constants/theme";

// ── Props ─────────────────────────────────────────────────────────────────────

interface StaffingOptimizerProps {
  open: boolean;
  onClose: () => void;
  onApplyProposal: (proposal: Proposal) => void;
  enrichedGanttData: any[];
  pipelineJobcodes: Map<string, any> | null;
  enabledHolidayDates: Set<string> | null;
  currentTeamTU: number;
  currentTeamNetH: number;
  currentTeamChH: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string): string => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  } catch {
    return d;
  }
};

const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

// ── Component ─────────────────────────────────────────────────────────────────

const StaffingOptimizer = memo(
  ({
    open,
    onClose,
    onApplyProposal,
    enrichedGanttData,
    pipelineJobcodes,
    enabledHolidayDates,
    currentTeamTU,
    currentTeamNetH,
    currentTeamChH,
  }: StaffingOptimizerProps) => {
    const theme = useTheme();
    const [activeProposalIdx, setActiveProposalIdx] = useState(0);
    const [hoveredCell, setHoveredCell] = useState<{ si: number; ei: number } | null>(null);
    const [manualOverrides, setManualOverrides] = useState<Map<number, number>>(new Map());
    const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

    // ── Async worker state ──────────────────────────────────────────────────────
    const [matrix, setMatrix] = useState<CellScore[][]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [computing, setComputing] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // ── Build data ──────────────────────────────────────────────────────────────
    const needs = useMemo(() => readAllStaffingNeeds(), []);
    const slots = useMemo(() => expandNeedsToSlots(needs, pipelineJobcodes), [needs, pipelineJobcodes]);

    // Filter employees: only those with some availability
    const employees = useMemo(() => {
      return [...enrichedGanttData]
        .filter((e) => (e.availableCapacityHours || 0) > 0 || (e.trueUtilizationRate || 0) < 100)
        .sort((a, b) => (b.availableCapacityHours || 0) - (a.availableCapacityHours || 0));
    }, [enrichedGanttData]);

    // ── Off-thread computation ──────────────────────────────────────────────────
    useEffect(() => {
      // Fast-exit: nothing to compute
      if (slots.length === 0 || employees.length === 0) {
        setMatrix([]);
        setProposals([]);
        setComputing(false);
        return;
      }

      // Terminate any in-flight worker before starting a new one
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      setComputing(true);
      setMatrix([]);
      setProposals([]);

      const worker = new Worker(new URL("../../workers/scoringWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === "result") {
          const { matrix: m, proposals: rawProposals } = e.data as {
            type: "result";
            matrix: CellScore[][];
            proposals: SerializedProposal[];
          };
          // Deserialise selectionMap: plain object → Map<number, number>
          const hydratedProposals: Proposal[] = rawProposals.map((p) => ({
            ...p,
            selectionMap: new Map(Object.entries(p.selectionMap).map(([k, v]) => [Number(k), v])),
          }));
          setMatrix(m);
          setProposals(hydratedProposals);
        } else {
          console.warn("[StaffingOptimizer] worker error:", e.data.message);
        }
        setComputing(false);
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = (err) => {
        console.warn("[StaffingOptimizer] worker threw:", err.message);
        setComputing(false);
        worker.terminate();
        workerRef.current = null;
      };

      const serializedEmployees: SerializedEmployee[] = employees.map((emp) => ({
        empId: emp.empId,
        name: emp.name,
        grade: emp.grade,
        availableCapacityHours: emp.availableCapacityHours,
        netAvailableHours: emp.netAvailableHours,
        _displayNetH: emp._displayNetH,
        trueUtilizationRate: emp.trueUtilizationRate,
        skills: emp.skills,
        serviceLine: emp.serviceLine,
        assignments: emp.assignments?.map((a: any) => ({
          startDate: a.startDate,
          endDate: a.endDate,
          utilization: a.utilization,
          category: a.category,
          jobName: a.jobName,
        })),
      }));

      worker.postMessage({
        type: "score",
        employees: serializedEmployees,
        slots,
        holidays: enabledHolidayDates ? Array.from(enabledHolidayDates) : [],
        teamStats: { currentTeamTU, currentTeamNetH, currentTeamChH },
      });

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, slots, enabledHolidayDates, currentTeamTU, currentTeamNetH, currentTeamChH]);

    const activeProposal = proposals[activeProposalIdx] || null;

    // Selection map: merge proposal selections with manual overrides
    const selectionMap = useMemo(() => {
      if (!activeProposal) return new Map<number, number>();
      const map = new Map(activeProposal.selectionMap);
      manualOverrides.forEach((ei, si) => {
        // Remove old emp selection for this slot
        map.set(si, ei);
      });
      return map;
    }, [activeProposal, manualOverrides]);

    // ── Handlers ────────────────────────────────────────────────────────────────
    const handleCellClick = useCallback(
      (si: number, ei: number) => {
        setManualOverrides((prev) => {
          const next = new Map(prev);
          // Toggle: if already selected, deselect
          if (selectionMap.get(si) === ei) {
            next.delete(si);
            // We need to check if the proposal had this — if so, set to -1 to deselect
            if (activeProposal?.selectionMap.has(si) && activeProposal.selectionMap.get(si) === ei) {
              next.set(si, -1); // sentinel for "deselected"
            }
          } else {
            next.set(si, ei);
          }
          return next;
        });
      },
      [selectionMap, activeProposal]
    );

    const handleProposalChange = useCallback((idx: number) => {
      setActiveProposalIdx(idx);
      setManualOverrides(new Map()); // reset manual overrides on proposal switch
    }, []);

    const handleApply = useCallback(() => {
      if (!activeProposal) return;
      setApplyConfirmOpen(true);
    }, [activeProposal]);

    const executeApply = useCallback(() => {
      if (!activeProposal) return;
      // Build modified proposal with manual overrides
      const modifiedProposal = { ...activeProposal, selectionMap };
      onApplyProposal(modifiedProposal);
    }, [activeProposal, selectionMap, onApplyProposal]);

    // Count assignments that will actually be created (sentinel -1 = deselected)
    const pendingAssignmentCount = useMemo(
      () => Array.from(selectionMap.values()).filter((ei) => ei !== -1).length,
      [selectionMap]
    );

    if (!open) return null;

    // ── Empty state ─────────────────────────────────────────────────────────────
    if (slots.length === 0 || employees.length === 0) {
      return (
        <Dialog open onClose={onClose} TransitionComponent={DialogTransition} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutoFixHighIcon sx={{ color: "#7c3aed" }} />
            Staffing Optimizer
          </DialogTitle>
          <DialogContent>
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                {slots.length === 0
                  ? "No staffing needs defined. Create needs in the assignment board."
                  : "No employees available for assignment."}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    return (
      <>
        <DeleteConfirmDialog
          open={applyConfirmOpen}
          onCancel={() => setApplyConfirmOpen(false)}
          onConfirm={() => {
            setApplyConfirmOpen(false);
            executeApply();
          }}
          title={`Apply "${activeProposal?.name}"?`}
          message={`${pendingAssignmentCount} assignment${pendingAssignmentCount !== 1 ? "s" : ""} will be created.`}
          confirmLabel="Apply"
          confirmColor="primary"
        />
        <Dialog
          open
          onClose={onClose}
          TransitionComponent={DialogTransition}
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              width: "95vw",
              maxWidth: 1400,
              height: "90vh",
              maxHeight: "90vh",
              borderRadius: 3,
            },
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────────────── */}
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pb: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <AutoFixHighIcon sx={{ color: "#7c3aed", fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem" }}>
                Staffing Optimizer
              </Typography>
              {activeProposal && (
                <Chip
                  size="small"
                  label={`${activeProposal.stats.filledSlots}/${activeProposal.stats.totalSlots} covered`}
                  sx={{ fontSize: "0.7rem", fontWeight: 600, bgcolor: alpha("#059669", 0.1), color: "#059669" }}
                />
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {activeProposal && activeProposal.stats.projectedTUDelta !== 0 && (
                <Chip
                  size="small"
                  icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                  label={`${activeProposal.stats.projectedTUDelta > 0 ? "+" : ""}${activeProposal.stats.projectedTUDelta.toFixed(1)}pts TU`}
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    bgcolor: activeProposal.stats.projectedTUDelta > 0 ? alpha("#059669", 0.1) : alpha("#dc2626", 0.1),
                    color: activeProposal.stats.projectedTUDelta > 0 ? "#059669" : "#dc2626",
                  }}
                />
              )}
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* ── Proposal selector ──────────────────────────────────────────── */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "#fafafa",
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
                Proposal:
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {proposals.map((prop, idx) => {
                  const meta = STRATEGY_META[prop.strategy];
                  const isActive = idx === activeProposalIdx;
                  return (
                    <Chip
                      key={prop.id}
                      size="small"
                      label={`${MEDAL[idx] || ""} ${prop.name} — ${prop.stats.projectedTUDelta > 0 ? "+" : ""}${prop.stats.projectedTUDelta.toFixed(1)}pts | ${prop.stats.filledSlots}/${prop.stats.totalSlots}`}
                      onClick={() => handleProposalChange(idx)}
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: isActive ? 700 : 500,
                        bgcolor: isActive ? alpha(meta.color, 0.15) : "transparent",
                        color: isActive ? meta.color : "text.secondary",
                        border: "1px solid",
                        borderColor: isActive ? alpha(meta.color, 0.4) : "divider",
                        cursor: "pointer",
                        "&:hover": { bgcolor: alpha(meta.color, 0.08) },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* ── Matrix ─────────────────────────────────────────────────────── */}
            <Box sx={{ flex: 1, overflow: "auto", position: "relative" }}>
              {/* Loading overlay while the worker computes */}
              {computing && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(2px)",
                    gap: 1.5,
                  }}
                >
                  <CircularProgress size={32} sx={{ color: "#7c3aed" }} />
                  <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", fontWeight: 500 }}>
                    Computing scoring matrix…
                  </Typography>
                </Box>
              )}
              <Box
                component="table"
                sx={{
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  width: "max-content",
                  minWidth: "100%",
                  "& th, & td": {
                    border: "1px solid",
                    borderColor: alpha("#000", 0.06),
                    p: 0,
                  },
                }}
              >
                {/* Column headers (needs/slots) */}
                <Box component="thead">
                  <Box component="tr">
                    {/* Top-left corner */}
                    <Box
                      component="th"
                      sx={{
                        position: "sticky",
                        left: 0,
                        top: 0,
                        zIndex: 3,
                        bgcolor: "#fafafa",
                        minWidth: 160,
                        p: 1,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", fontWeight: 600 }}>
                        {employees.length} employees × {slots.length} needs
                      </Typography>
                    </Box>
                    {slots.map((slot, si) => {
                      const gc = getGradeColor(slot.grade);
                      return (
                        <Box
                          key={`col-${si}`}
                          component="th"
                          sx={{
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            bgcolor: alpha(gc.bg, 0.6),
                            p: 0.75,
                            minWidth: 110,
                            maxWidth: 130,
                            verticalAlign: "top",
                          }}
                        >
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, alignItems: "center" }}>
                            <Avatar
                              sx={{
                                width: 22,
                                height: 22,
                                fontSize: "0.5rem",
                                fontWeight: 800,
                                bgcolor: gc.border,
                                color: "#fff",
                                borderRadius: 1,
                              }}
                            >
                              {slot.gradeAbbr}
                            </Avatar>
                            <Typography
                              sx={{
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                color: gc.text,
                                textAlign: "center",
                                lineHeight: 1.2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                maxWidth: 120,
                              }}
                            >
                              {slot.oppLabel}
                            </Typography>
                            <Typography sx={{ fontSize: "0.55rem", color: "text.disabled" }}>
                              {fmtDate(slot.startDate)} — {fmtDate(slot.endDate)}
                            </Typography>
                            {slot.probability < 1 && (
                              <Typography sx={{ fontSize: "0.5rem", color: "#b45309", fontWeight: 600 }}>
                                P:{Math.round(slot.probability * 100)}%
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                {/* Row headers (employees) + cells */}
                <Box component="tbody">
                  {employees.map((emp, ei) => {
                    const empGc = getGradeColor(emp.grade);
                    const target = getGradeTarget(emp.grade);
                    const tu = emp.trueUtilizationRate || 0;
                    const tuColor = tu >= target ? "#dc2626" : tu >= target * 0.8 ? "#b45309" : "#059669";

                    return (
                      <Box component="tr" key={emp.empId}>
                        {/* Employee header (sticky left) */}
                        <Box
                          component="td"
                          sx={{
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            bgcolor: "#fff",
                            p: 0.75,
                            borderRight: "2px solid",
                            borderRightColor: alpha(empGc.border, 0.4),
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 140 }}>
                            <Avatar
                              sx={{
                                width: 24,
                                height: 24,
                                fontSize: "0.5rem",
                                fontWeight: 800,
                                bgcolor: empGc.bg,
                                color: empGc.text,
                                borderRadius: "50%",
                              }}
                            >
                              {getGradeAbbr(emp.grade)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: 110,
                                }}
                              >
                                {emp.name}
                              </Typography>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Typography sx={{ fontSize: "0.55rem", color: tuColor, fontWeight: 600 }}>
                                  TU:{tu.toFixed(0)}%
                                </Typography>
                                <Typography sx={{ fontSize: "0.55rem", color: "text.disabled" }}>
                                  D:{Math.round(emp.availableCapacityHours || 0)}h
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>

                        {/* Score cells */}
                        {slots.map((slot, si) => {
                          const cell = matrix[si]?.[ei];
                          if (!cell) return <Box component="td" key={`${si}-${ei}`} />;

                          const isSelected = selectionMap.get(si) === ei;
                          const colors = getCellColor(cell.total);
                          const isHovered = hoveredCell?.si === si && hoveredCell?.ei === ei;

                          return (
                            <Tooltip
                              key={`${si}-${ei}`}
                              placement="top"
                              arrow
                              title={
                                <Box sx={{ p: 0.5 }}>
                                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, mb: 0.5 }}>
                                    Score: {cell.total}/100
                                  </Typography>
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                    <ScoreBar label="Grade" value={cell.gradeFit} max={30} />
                                    <ScoreBar label="Dates" value={cell.dateOverlap} max={25} />
                                    <ScoreBar label="Avail." value={cell.availability} max={25} />
                                    <ScoreBar label="Skills" value={cell.skillsMatch} max={15} />
                                    <ScoreBar label="Prob." value={cell.probBonus} max={5} />
                                  </Box>
                                  <Typography sx={{ fontSize: "0.55rem", color: "grey.400", mt: 0.5 }}>
                                    {cell.overlapDays}d overlap · {Math.round(cell.freeHoursInOverlap)}h free
                                  </Typography>
                                </Box>
                              }
                            >
                              <Box
                                component="td"
                                onClick={() => handleCellClick(si, ei)}
                                onMouseEnter={() => setHoveredCell({ si, ei })}
                                onMouseLeave={() => setHoveredCell(null)}
                                sx={{
                                  cursor: "pointer",
                                  bgcolor: isSelected
                                    ? alpha(colors.bg, 1)
                                    : isHovered
                                      ? alpha(colors.bg, 0.7)
                                      : alpha(colors.bg, 0.4),
                                  textAlign: "center",
                                  p: 0.5,
                                  minWidth: 70,
                                  position: "relative",
                                  transition: "background-color 0.15s ease, outline-color 0.15s ease",
                                  outline: isSelected ? `2px solid ${colors.text}` : "none",
                                  outlineOffset: -2,
                                  "&:hover": { bgcolor: alpha(colors.bg, 0.8) },
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: "0.78rem",
                                    fontWeight: isSelected ? 800 : 600,
                                    color: cell.total < 10 ? "#d1d5db" : colors.text,
                                  }}
                                >
                                  {cell.total}
                                </Typography>
                                {isSelected && (
                                  <CheckCircleIcon
                                    sx={{
                                      position: "absolute",
                                      top: 2,
                                      right: 2,
                                      fontSize: 12,
                                      color: colors.text,
                                    }}
                                  />
                                )}
                              </Box>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </DialogContent>

          {/* ── Footer ─────────────────────────────────────────────────────────── */}
          <DialogActions
            sx={{
              px: 2,
              py: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                Click a cell to manually modify the assignment
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" onClick={onClose} sx={{ fontSize: "0.75rem" }}>
                Close
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleApply}
                startIcon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
                disabled={computing || !activeProposal || activeProposal.stats.filledSlots === 0}
                sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "none" }}
              >
                Apply "{activeProposal?.name}"
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

StaffingOptimizer.displayName = "StaffingOptimizer";

// ── Score bar sub-component ───────────────────────────────────────────────────

const ScoreBar = memo(({ label, value, max }: { label: string; value: number; max: number }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#b45309" : "#dc2626";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.58rem", color: "grey.300", width: 32, textAlign: "right" }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 4, bgcolor: "grey.700", borderRadius: 2, overflow: "hidden", minWidth: 40 }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: 2, transition: "width 0.2s" }} />
      </Box>
      <Typography sx={{ fontSize: "0.55rem", color: "grey.400", width: 24, textAlign: "right" }}>
        {Math.round(value)}/{max}
      </Typography>
    </Box>
  );
});

ScoreBar.displayName = "ScoreBar";

export default StaffingOptimizer;
