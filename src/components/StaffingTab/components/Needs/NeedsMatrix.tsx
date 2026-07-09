/**
 * NeedsMatrix — Pivot table view of staffing needs.
 *
 * Columns = grades (P, Dir, SM, M, SC, C, A, Int)
 * Rows = opportunities, grouped by account
 * Cells = need count, color-coded by status
 *
 * Borderless design aligned with PipelineTab patterns.
 */

import { memo, useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PersonIcon from "@mui/icons-material/Person";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { GRADE_ORDER, getGradeColor, getGradeAbbr } from "../../constants";
import { getAssignmentsForNeed, getAssignmentsFromEditorStates } from "../../utils/needStatusUtils";
import CandidateDrawer from "./CandidateDrawer";
import type { CandidateResult } from "./CandidateDrawer";
import type { StaffingNeedItem, StaffingAssignment } from "../../../../types";

const resolveGrade = (n: StaffingNeedItem) => n.grade || "Unknown";

// Status → cell styling
const statusStyle = (filled: number, total: number): { bg: string; color: string } => {
  if (total === 0) return { bg: "transparent", color: "#9ca3af" };
  if (filled >= total) return { bg: "rgba(16,185,129,0.22)", color: "#065f46" };
  if (filled > 0) return { bg: "rgba(217,119,6,0.18)", color: "#78350f" };
  return { bg: "rgba(0,0,0,0.06)", color: "#374151" };
};

interface NeedsMatrixProps {
  scenarioId?: string | null;
  pipelineJobcodes?: Map<string, any> | null;
  onOpenEditor?: (prefill: any) => void;
  employees?: { empId: string; name: string; grade?: string }[];
  opportunityData?: any[];
  gradeFilter?: string | null;
  onClearFilter?: () => void;
}

type EnrichedNeed = StaffingNeedItem & { _grade: string };

interface OppGroup {
  account: string;
  opportunities: {
    opportunityId: string;
    oppName: string;
    needs: EnrichedNeed[];
    isLost: boolean;
  }[];
}

const NeedsMatrix = memo(
  ({
    scenarioId,
    pipelineJobcodes,
    onOpenEditor,
    employees,
    opportunityData,
    gradeFilter,
    onClearFilter,
  }: NeedsMatrixProps) => {
    const storeNeeds = useUserDataStore((s) => s.staffingNeeds);
    const editorStates = useUserDataStore((s) => s.editorStates);
    const empNameResolver = useCallback(
      (empId: string) => {
        const emp = employees?.find((e) => e.empId === empId);
        return emp?.name || empId;
      },
      [employees]
    );
    const assignments = useMemo(
      () => getAssignmentsFromEditorStates(editorStates, empNameResolver),
      [editorStates, empNameResolver]
    );

    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(() => new Set(["__all__"]));
    const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
    const [candidateNeedId, setCandidateNeedId] = useState<string | null>(null);

    // Build opp lookup from opportunityData (already filtered by region/segment in App)
    const oppLookup = useMemo(() => {
      if (!opportunityData?.length)
        return new Map<string, { account: string; oppName: string; status: number; jobCode: string }>();
      const map = new Map<string, { account: string; oppName: string; status: number; jobCode: string }>();
      for (const o of opportunityData) {
        const id = o.opportunityId || o.id;
        if (id)
          map.set(id, {
            account: o.account || o.account || "",
            oppName: o.opportunity || o.opportunity || id,
            status: o.status || 0,
            jobCode: o.jobCode || "",
          });
      }
      return map;
    }, [opportunityData]);

    // Flatten + resolve grades, filtered to only opps in current region/segment
    const allNeeds = useMemo(() => {
      const flat: (StaffingNeedItem & { _grade: string })[] = [];
      for (const [opportunityId, items] of Object.entries(storeNeeds)) {
        if (oppLookup.size > 0 && !oppLookup.has(opportunityId)) continue;
        for (const n of items) {
          if (n.status === "cancelled") continue;
          const grade = resolveGrade(n);
          if (gradeFilter && grade !== gradeFilter) continue;
          flat.push({ ...n, opportunityId: n.opportunityId || opportunityId, _grade: grade });
        }
      }
      return flat;
    }, [storeNeeds, oppLookup, gradeFilter]);

    // Determine which grade columns are used
    const activeGrades = useMemo(() => GRADE_ORDER.filter((g) => allNeeds.some((n) => n._grade === g)), [allNeeds]);

    // Group by account → opportunity
    const groups = useMemo<OppGroup[]>(() => {
      const accountMap = new Map<string, Map<string, { oppName: string; needs: EnrichedNeed[]; isLost: boolean }>>();

      for (const need of allNeeds) {
        const opportunityId = need.opportunityId || "";
        const pjc = pipelineJobcodes?.get(opportunityId);
        const oppFallback = oppLookup?.get(opportunityId);
        const account = pjc?.account || oppFallback?.account || "Autres";
        const oppName = pjc?.opportunityName || oppFallback?.oppName || opportunityId;

        if (!accountMap.has(account)) accountMap.set(account, new Map());
        const oppMap = accountMap.get(account)!;
        const oppStatus = oppFallback?.status || pjc?.status || 0;
        if (!oppMap.has(opportunityId)) oppMap.set(opportunityId, { oppName, needs: [], isLost: oppStatus === 15 });
        oppMap.get(opportunityId)!.needs.push(need);
      }

      return [...accountMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "fr"))
        .map(([account, oppMap]) => ({
          account,
          opportunities: [...oppMap.entries()]
            .sort(([, a], [, b]) => a.oppName.localeCompare(b.oppName, "fr"))
            .map(([opportunityId, data]) => ({ opportunityId, ...data })),
        }));
    }, [allNeeds, pipelineJobcodes, oppLookup]);

    const allExpanded = expandedAccounts.has("__all__") || groups.every(({ account }) => expandedAccounts.has(account));

    // Footer totals per grade
    const totals = useMemo(() => {
      const t: Record<string, { total: number; filled: number }> = {};
      for (const g of activeGrades) t[g] = { total: 0, filled: 0 };
      for (const need of allNeeds) {
        const g = need._grade;
        if (!t[g]) continue;
        const qty = need.quantity || 1;
        const filledCount = getAssignmentsForNeed(need.id, assignments, scenarioId).length;
        t[g].total += qty;
        t[g].filled += Math.min(filledCount, qty);
      }
      return t;
    }, [allNeeds, activeGrades, assignments, scenarioId]);

    const toggleAccount = useCallback(
      (account: string) => {
        setExpandedAccounts((prev) => {
          const next = new Set(prev);
          // If __all__ is active, switching to per-account: expand all except this one
          if (next.has("__all__")) {
            next.delete("__all__");
            for (const g of groups) {
              if (g.account !== account) next.add(g.account);
            }
          } else {
            if (next.has(account)) next.delete(account);
            else next.add(account);
          }
          return next;
        });
      },
      [groups]
    );

    const toggleAll = useCallback(() => {
      setExpandedAccounts((prev) => {
        if (prev.has("__all__") || groups.every(({ account }) => prev.has(account))) {
          return new Set(); // collapse all
        }
        return new Set(["__all__"]); // expand all
      });
    }, [groups]);

    const handleRowClick = useCallback((opportunityId: string) => {
      setSelectedOppId((prev) => (prev === opportunityId ? null : opportunityId));
    }, []);

    // D&D handlers
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent, needId: string) => {
      if (e.dataTransfer.types.includes("application/scenario-employee")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTarget(needId);
      }
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent, need: StaffingNeedItem) => {
        e.preventDefault();
        setDropTarget(null);
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (!empId) return;

        const opportunityId = need.opportunityId || "";
        const oppInfo = oppLookup?.get(opportunityId);
        const pjcInfo = pipelineJobcodes?.get(opportunityId);
        const tr = (s: string, max = 20) => (s && s.length > max ? s.slice(0, max) + "\u2026" : s);
        const account = pjcInfo?.account || oppInfo?.account || "";
        const oppName = pjcInfo?.opportunityName || oppInfo?.oppName || "";
        const jobName = account || oppName ? `${tr(account)} - ${tr(oppName)}` : "Staffing Need";
        const util = need.utilization ?? 100;

        const uid = `need_${need.id}_${Date.now()}`;
        const newSeg = {
          _uid: uid,
          empId,
          jobNo: opportunityId,
          jobName,
          startDate: need.startDate,
          endDate: need.endDate,
          utilization: util,
          status: "confirmed",
          category: "chargeable",
          needId: need.id,
          source: "staffing_need" as const,
        };

        const store = useUserDataStore.getState();
        const existing = store.editorStates[empId] || null;
        const baseline = existing?.baseline || [];
        const actionLog = existing?.actionLog || [];
        const current = existing?.current || [...baseline];

        store.setEditorState(empId, {
          baseline,
          actionLog: [
            ...actionLog,
            {
              actionId: `act_${Date.now()}`,
              groupKey: `${opportunityId}__chargeable`,
              type: "create" as const,
              sourceUids: [],
              produced: [newSeg],
            },
          ],
          redoStack: [],
          current: [...current, newSeg],
        });
      },
      [oppLookup, pipelineJobcodes]
    );

    const handleConfirm = useCallback((_id: string) => {}, []);

    const handleRemove = useCallback((assignmentId: string) => {
      const store = useUserDataStore.getState();
      for (const [empId, state] of Object.entries(store.editorStates) as [string, any][]) {
        if (!state?.current) continue;
        const seg = state.current.find((s: any) => s._uid === assignmentId);
        if (seg) {
          const newCurrent = state.current.filter((s: any) => s._uid !== assignmentId);
          const deleteAction = {
            actionId: `act_${Date.now()}`,
            groupKey: `${seg.jobNo || ""}__${seg.category || "chargeable"}`,
            type: "delete" as const,
            sourceUids: [seg._uid],
            produced: [],
          };
          store.setEditorState(empId, {
            ...state,
            current: newCurrent,
            actionLog: [...(state.actionLog || []), deleteAction],
            redoStack: [],
          });
          break;
        }
      }
    }, []);

    // Selected cell needs for candidate drawer
    const selectedNeed = useMemo(() => {
      if (!candidateNeedId) return null;
      return allNeeds.find((n) => n.id === candidateNeedId) || null;
    }, [candidateNeedId, allNeeds]);

    const handleAssign = useCallback(
      (candidate: CandidateResult) => {
        if (!selectedNeed) return;

        // Check: don't assign more candidates than slots available
        const existingCount = getAssignmentsForNeed(selectedNeed.id, assignments, scenarioId).length;
        const maxSlots = selectedNeed.quantity || 1;
        if (existingCount >= maxSlots) return; // silently ignore — need is already filled

        const empId = candidate.empId;
        const opportunityId = selectedNeed.opportunityId || "";
        const oppInfo = oppLookup?.get(opportunityId);
        const pjcInfo = pipelineJobcodes?.get(opportunityId);
        const tr = (s: string, max = 25) => (s && s.length > max ? s.slice(0, max) + "\u2026" : s);
        const account = pjcInfo?.account || oppInfo?.account || "";
        const oppName = pjcInfo?.opportunityName || oppInfo?.oppName || "";
        const jobNo = pjcInfo?.jobNo || oppInfo?.jobCode || opportunityId;
        const jobName = account || oppName ? `${tr(account)} - ${tr(oppName)}` : "";
        const util = selectedNeed.utilization ?? 100;

        // Preview mode: open the editor with prefill, don't write to editorState yet
        if (onOpenEditor) {
          onOpenEditor({
            empId,
            jobNo,
            jobName,
            startDate: selectedNeed.startDate,
            endDate: selectedNeed.endDate,
            utilization: util,
            needId: selectedNeed.id,
          });
        }
        setCandidateNeedId(null);
      },
      [selectedNeed, oppLookup, pipelineJobcodes, onOpenEditor, assignments, scenarioId]
    );

    // Shared row layout: all rows use the same flex structure for alignment
    const ROW_SX = { display: "flex", alignItems: "center", px: 2 } as const;
    const LEFT_COL_SX = { width: 240, flexShrink: 0, overflow: "hidden" } as const;
    const GRADE_COL_SX = { flex: 1, textAlign: "center", minWidth: 50 } as const;
    const TOTAL_COL_SX = { width: 52, textAlign: "center", flexShrink: 0 } as const;

    if (allNeeds.length === 0) {
      return (
        <Box sx={{ textAlign: "center", py: 4, color: "text.disabled" }}>
          <Typography variant="body2">Aucun besoin d'expert</Typography>
        </Box>
      );
    }

    const colW = `${Math.floor(100 / (activeGrades.length + 1))}%`;

    return (
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Box sx={{ flex: 1, overflow: "auto", minWidth: 0, px: 1.5, py: 1 }}>
          {/* Active filter chip */}
          {gradeFilter && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <Chip
                label={`Grade: ${gradeFilter}`}
                size="small"
                onDelete={onClearFilter}
                sx={{
                  height: 24,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  bgcolor: alpha(getGradeColor(gradeFilter).text, 0.12),
                  color: getGradeColor(gradeFilter).text,
                }}
              />
            </Box>
          )}

          {/* ── Column headers ── */}
          <Box sx={{ ...ROW_SX, position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper", py: 0.75 }}>
            <Box sx={{ ...LEFT_COL_SX, display: "flex", alignItems: "center" }}>
              <IconButton size="small" onClick={toggleAll} sx={{ p: 0.25, color: "text.disabled" }}>
                {allExpanded ? <UnfoldLessIcon sx={{ fontSize: 15 }} /> : <UnfoldMoreIcon sx={{ fontSize: 15 }} />}
              </IconButton>
            </Box>
            {activeGrades.map((grade) => {
              const gc = getGradeColor(grade);
              return (
                <Box key={grade} sx={GRADE_COL_SX}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      bgcolor: gc.text,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
                      {getGradeAbbr(grade)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <Box sx={TOTAL_COL_SX}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af" }}>Total</Typography>
            </Box>
          </Box>

          {/* ── Totals row ── */}
          <Box
            sx={{
              ...ROW_SX,
              py: 0.75,
              mb: 1,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              bgcolor: alpha("#CC2931", 0.05),
            }}
          >
            <Box sx={LEFT_COL_SX}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#374151", pl: 1 }}>Total</Typography>
            </Box>
            {activeGrades.map((grade) => {
              const t = totals[grade] || { total: 0, filled: 0 };
              const st = statusStyle(t.filled, t.total);
              return (
                <Box key={grade} sx={GRADE_COL_SX}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: st.color }}>
                    {t.total > 0 ? (t.filled > 0 && t.filled < t.total ? `${t.filled}/${t.total}` : t.total) : "·"}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={TOTAL_COL_SX}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>
                {Object.values(totals).reduce((s, t) => s + t.total, 0)}
              </Typography>
            </Box>
          </Box>

          {/* ── Account groups (StaffingTab GroupedEmployeeList style) ── */}
          {groups.map(({ account, opportunities }) => {
            const isExpanded = expandedAccounts.has(account) || expandedAccounts.has("__all__");

            // Account-level totals per grade
            const accountAllNeeds = opportunities.flatMap((o) => o.needs);
            const accountCells = activeGrades.map((grade) => {
              const gradeNeeds = accountAllNeeds.filter((n) => n._grade === grade);
              const total = gradeNeeds.reduce((s, n) => s + (n.quantity || 1), 0);
              const filled = gradeNeeds.reduce(
                (s, n) => s + getAssignmentsForNeed(n.id, assignments, scenarioId).length,
                0
              );
              return { grade, total, filled };
            });
            const accountTotal = accountCells.reduce((s, c) => s + c.total, 0);
            const accountFilled = accountCells.reduce((s, c) => s + c.filled, 0);

            return (
              <Box key={account} sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
                {/* ── Account header (depth 0) ── */}
                <Box
                  onClick={() => toggleAccount(account)}
                  sx={{
                    ...ROW_SX,
                    py: 1.25,
                    borderRadius: 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                    bgcolor: "#f5f2f0",
                    cursor: "pointer",
                    transition: "background-color 150ms ease",
                    "&:hover": { bgcolor: "#ede8e6" },
                  }}
                >
                  <Box sx={{ ...LEFT_COL_SX, display: "flex", alignItems: "center", gap: 0.5 }}>
                    {isExpanded ? (
                      <ExpandLessIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                    )}
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#374151",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {account}
                    </Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: "#6b7280", flexShrink: 0 }}>
                      ({accountTotal})
                    </Typography>
                  </Box>
                  {accountCells.map(({ grade, total, filled }) => {
                    const st = statusStyle(filled, total);
                    return (
                      <Box key={grade} sx={GRADE_COL_SX}>
                        {total > 0 ? (
                          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: st.color }}>
                            {filled > 0 && filled < total ? `${filled}/${total}` : total}
                          </Typography>
                        ) : (
                          <Typography sx={{ fontSize: "0.75rem", color: "#d1d5db" }}>·</Typography>
                        )}
                      </Box>
                    );
                  })}
                  <Box sx={TOTAL_COL_SX}>
                    <Typography
                      sx={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: accountFilled === accountTotal && accountTotal > 0 ? "#10b981" : "#374151",
                      }}
                    >
                      {accountFilled > 0 && accountFilled < accountTotal
                        ? `${accountFilled}/${accountTotal}`
                        : accountTotal}
                    </Typography>
                  </Box>
                </Box>

                <Collapse in={isExpanded}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {opportunities.map(({ opportunityId, oppName, needs, isLost }: any) => {
                      const cells = activeGrades.map((grade) => {
                        const gradeNeeds = needs.filter((n: any) => n._grade === grade);
                        const total = gradeNeeds.reduce((s: number, n: any) => s + (n.quantity || 1), 0);
                        const filled = gradeNeeds.reduce(
                          (s: number, n: any) => s + getAssignmentsForNeed(n.id, assignments, scenarioId).length,
                          0
                        );
                        return { grade, gradeNeeds, total, filled };
                      });
                      const rowTotal = cells.reduce((s, c) => s + c.total, 0);
                      const rowFilled = cells.reduce((s, c) => s + c.filled, 0);
                      const isSelected = selectedOppId === opportunityId;

                      return (
                        <Box key={opportunityId} sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {/* ── Opportunity row (depth 1) ── */}
                          <Box
                            onClick={() => handleRowClick(opportunityId)}
                            sx={{
                              ...ROW_SX,
                              py: 1,
                              borderRadius: 3,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
                              bgcolor: isSelected ? "#eceef0" : "#f8f9fa",
                              cursor: "pointer",
                              transition: "background-color 150ms ease",
                              "&:hover": { bgcolor: "#eceef0" },
                            }}
                          >
                            <Box sx={{ ...LEFT_COL_SX, display: "flex", alignItems: "center", gap: 0.5, pl: 3 }}>
                              {isSelected ? (
                                <ExpandLessIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                              ) : (
                                <ExpandMoreIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                              )}
                              <Typography
                                sx={{
                                  fontWeight: 500,
                                  fontSize: "0.82rem",
                                  color: isLost ? "#ef4444" : "#374151",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  textDecoration: isLost ? "line-through" : "none",
                                }}
                                title={isLost ? `${oppName} (LOST)` : oppName}
                              >
                                {oppName}
                              </Typography>
                              {isLost && (
                                <Typography
                                  component="span"
                                  sx={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    color: "#ef4444",
                                    bgcolor: "rgba(239,68,68,0.1)",
                                    px: 0.5,
                                    py: 0.125,
                                    borderRadius: "4px",
                                    flexShrink: 0,
                                  }}
                                >
                                  LOST
                                </Typography>
                              )}
                            </Box>
                            {cells.map(({ grade, gradeNeeds, total, filled }) => {
                              const st = statusStyle(filled, total);
                              const firstNeed = gradeNeeds[0];
                              const isDrop = firstNeed && dropTarget === firstNeed.id;
                              return (
                                <Box
                                  key={grade}
                                  onDragOver={(e) => firstNeed && handleDragOver(e, firstNeed.id)}
                                  onDragLeave={() => setDropTarget(null)}
                                  onDrop={(e) => {
                                    e.stopPropagation();
                                    firstNeed && handleDrop(e, firstNeed);
                                  }}
                                  sx={{ ...GRADE_COL_SX, display: "flex", justifyContent: "center" }}
                                >
                                  {total > 0 ? (
                                    <Box
                                      sx={{
                                        px: 1.5,
                                        py: 0.25,
                                        borderRadius: 1.5,
                                        bgcolor: isDrop ? alpha("#3b82f6", 0.12) : st.bg,
                                        transition: "background-color 100ms ease",
                                      }}
                                    >
                                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: st.color }}>
                                        {filled > 0 && filled < total ? `${filled}/${total}` : total}
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Typography sx={{ fontSize: "0.75rem", color: "#d1d5db" }}>·</Typography>
                                  )}
                                </Box>
                              );
                            })}
                            <Box sx={TOTAL_COL_SX}>
                              <Typography
                                sx={{
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  color: rowFilled === rowTotal && rowTotal > 0 ? "#10b981" : "#6b7280",
                                }}
                              >
                                {rowFilled > 0 && rowFilled < rowTotal ? `${rowFilled}/${rowTotal}` : rowTotal}
                              </Typography>
                            </Box>
                          </Box>

                          {/* ── Need detail rows (like EmployeeRows under a group) ── */}
                          {isSelected && (
                            <CellDetail
                              needs={needs}
                              assignments={assignments}
                              scenarioId={scenarioId}
                              onConfirm={handleConfirm}
                              onRemove={handleRemove}
                              onFindCandidates={setCandidateNeedId}
                              candidateNeedId={candidateNeedId}
                              activeGrades={activeGrades}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}

          {/* totals row moved to top */}
        </Box>

        {/* Candidate drawer */}
        {selectedNeed && candidateNeedId && (
          <CandidateDrawer
            need={selectedNeed}
            onClose={() => setCandidateNeedId(null)}
            onAssign={handleAssign}
            onOpenEditor={onOpenEditor}
            scenarioId={scenarioId}
          />
        )}
      </Box>
    );
  }
);
NeedsMatrix.displayName = "NeedsMatrix";

// ── Row detail — same column layout as parent rows, content placed under each grade ──
const CellDetail = memo(
  ({
    needs,
    assignments,
    scenarioId,
    onConfirm,
    onRemove,
    onFindCandidates,
    candidateNeedId,
    activeGrades,
  }: {
    needs: StaffingNeedItem[];
    assignments: StaffingAssignment[];
    scenarioId?: string | null;
    onConfirm: (id: string) => void;
    onRemove: (id: string) => void;
    onFindCandidates: (needId: string | null) => void;
    candidateNeedId: string | null;
    activeGrades: string[];
  }) => {
    if (needs.length === 0) return null;

    // Group needs by grade
    const byGrade = new Map<string, StaffingNeedItem[]>();
    for (const n of needs) {
      const g = n.grade || "Unknown";
      const list = byGrade.get(g) || [];
      list.push(n);
      byGrade.set(g, list);
    }

    return (
      <Box
        sx={{
          display: "flex",
          px: 2,
          py: 0.75,
          bgcolor: "#f3f4f5",
          borderRadius: "0 0 12px 12px",
        }}
      >
        {/* Empty left column — same width as opp name column */}
        <Box sx={{ width: 240, flexShrink: 0 }} />

        {/* One column per grade — same flex as the cells above */}
        {activeGrades.map((grade) => {
          const gradeNeeds = byGrade.get(grade);
          return (
            <Box key={grade} sx={{ flex: 1, minWidth: 50, textAlign: "center", px: 0.25 }}>
              {gradeNeeds?.map((need) => {
                const needAssignments = getAssignmentsForNeed(need.id, assignments, scenarioId);
                const isOpen = needAssignments.length < (need.quantity || 1);

                return (
                  <Box key={need.id} sx={{ mb: 0.5 }}>
                    {/* Dates */}
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.82rem", color: "#9ca3af", display: "block", lineHeight: 1.3 }}
                    >
                      {(need.quantity || 1) > 1 && <strong>×{need.quantity} </strong>}
                      {need.startDate ? `${need.startDate.slice(8, 10)}/${need.startDate.slice(5, 7)}` : "?"} →{" "}
                      {need.endDate ? `${need.endDate.slice(8, 10)}/${need.endDate.slice(5, 7)}` : "?"}
                      {` · ${Math.round(need.utilization ?? 100)}%`}
                      {need.probability != null && need.probability < 1 && ` · P${Math.round(need.probability * 100)}%`}
                    </Typography>

                    {/* Assignments */}
                    {needAssignments.map((a) => (
                      <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 0.3, mt: 0.2 }}>
                        <PersonIcon
                          sx={{
                            fontSize: 11,
                            color: a.status === "proposed" ? "#d97706" : "#10b981",
                            opacity: 0.7,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.75rem", fontWeight: 500, flex: 1, lineHeight: 1.2 }}
                          noWrap
                        >
                          {a.empName}
                        </Typography>
                        {a.status === "proposed" && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConfirm(a.id);
                            }}
                            sx={{ p: 0.1 }}
                          >
                            <CheckCircleIcon sx={{ fontSize: 12, color: "#10b981" }} />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(a.id);
                          }}
                          sx={{ p: 0.1, opacity: 0.3, "&:hover": { opacity: 1 } }}
                        >
                          <CancelIcon sx={{ fontSize: 11 }} />
                        </IconButton>
                      </Box>
                    ))}

                    {/* Find candidates */}
                    {isOpen && (
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          onFindCandidates(candidateNeedId === need.id ? null : need.id);
                        }}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.2,
                          mt: 0.2,
                          cursor: "pointer",
                          color: "#CC2931",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        <PersonAddIcon sx={{ fontSize: 11 }} />
                        <Typography variant="caption" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>
                          Candidats
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}

        {/* Empty right column (aligned with total) */}
        <Box sx={{ width: 52, flexShrink: 0 }} />
      </Box>
    );
  }
);
CellDetail.displayName = "CellDetail";

export default NeedsMatrix;
