/**
 * NeedsList — Extracted needs list from NeedsBoard with grade/period filtering.
 * Shows needs grouped by grade, with status badges, assignments, and candidate search.
 */

import { memo, useState, useMemo, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { getGradeColor, getGradeAbbr, GRADE_ORDER, compareGrades } from "../../constants";
import {
  computeAllNeedStatuses,
  getAssignmentsForNeed,
  getAssignmentsFromEditorStates,
} from "../../utils/needStatusUtils";
import CandidateDrawer from "./CandidateDrawer";
import type { CandidateResult } from "./CandidateDrawer";
import type { StaffingNeedItem, StaffingAssignment } from "../../../../types";

// ── Status badge (borderless, alpha-bg like PipelineTab status chips) ──
const STATUS_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  open: { bg: "rgba(3,105,161,0.08)", text: "#0369a1", accent: "#0369a1" },
  partiallyFilled: { bg: "rgba(133,77,14,0.08)", text: "#854d0e", accent: "#d97706" },
  filled: { bg: "rgba(22,101,52,0.08)", text: "#166534", accent: "#10b981" },
  cancelled: { bg: "rgba(107,114,128,0.06)", text: "#6b7280", accent: "#9ca3af" },
};

const StatusBadge = memo(({ status }: { status: string }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.open;
  const label = status === "partiallyFilled" ? "Partial" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Typography
      variant="caption"
      sx={{
        px: 0.75,
        py: 0.15,
        borderRadius: 1,
        fontSize: "0.62rem",
        fontWeight: 600,
        bgcolor: c.bg,
        color: c.text,
        flexShrink: 0,
      }}
    >
      {label}
    </Typography>
  );
});
StatusBadge.displayName = "StatusBadge";

// ── Assignment chip (borderless, left-accent like PipelineTab live rows) ──
const AssignmentChip = memo(
  ({
    assignment,
    onConfirm,
    onCancel,
  }: {
    assignment: StaffingAssignment;
    onConfirm: (id: string) => void;
    onCancel: (id: string) => void;
  }) => {
    const isProposed = assignment.status === "proposed";
    const accentColor = isProposed ? "#d97706" : "#10b981";
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.35,
          borderRadius: 1.5,
          bgcolor: isProposed ? "rgba(217,119,6,0.06)" : "rgba(16,185,129,0.06)",
          boxShadow: "none",
        }}
      >
        <PersonIcon sx={{ fontSize: 13, color: accentColor, opacity: 0.7 }} />
        <Typography variant="caption" sx={{ fontSize: "0.72rem", fontWeight: 500, flex: 1 }} noWrap>
          {assignment.empName}
        </Typography>
        {assignment.score != null && (
          <Typography variant="caption" sx={{ fontSize: "0.58rem", color: "text.disabled" }}>
            ({assignment.score})
          </Typography>
        )}
        {isProposed && (
          <Tooltip title="Confirm">
            <IconButton
              size="small"
              onClick={() => onConfirm(assignment.id)}
              sx={{ p: 0.2, "&:hover": { bgcolor: "rgba(16,185,129,0.1)" } }}
            >
              <CheckCircleIcon sx={{ fontSize: 14, color: "#10b981" }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Retirer">
          <IconButton
            size="small"
            onClick={() => onCancel(assignment.id)}
            sx={{ p: 0.2, opacity: 0.4, "&:hover": { opacity: 1, bgcolor: "rgba(239,68,68,0.08)" } }}
          >
            <CancelIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }
);
AssignmentChip.displayName = "AssignmentChip";

// ── Main component ──

interface NeedsListProps {
  gradeFilter?: string | null;
  periodFilter?: { start: string; end: string } | null;
  scenarioId?: string | null;
  pipelineJobcodes?: Map<string, any> | null;
  opportunityData?: any[];
  onOpenEditor?: (prefill: {
    empId: string;
    jobNo?: string;
    jobName?: string;
    startDate?: string;
    endDate?: string;
    utilization?: number;
    needId?: string;
  }) => void;
  onClearFilter?: () => void;
  /** Callback to expand the candidate drawer in the parent container */
  onCandidateOpen?: (needId: string | null) => void;
  candidateNeedId?: string | null;
  /** Employee list for resolving empId → name on drag & drop */
  employees?: { empId: string; name: string; grade?: string }[];
}

const NeedsList = memo(
  ({
    gradeFilter,
    periodFilter,
    scenarioId,
    pipelineJobcodes,
    opportunityData,
    onOpenEditor,
    onClearFilter,
    onCandidateOpen,
    candidateNeedId,
    employees,
  }: NeedsListProps) => {
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

    const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set(GRADE_ORDER));

    // Build allowed opp IDs for filtering by region/segment
    const allowedOppIds = useMemo(() => {
      if (!opportunityData?.length) return null;
      const set = new Set<string>();
      for (const o of opportunityData) {
        const id = o.opportunityId || o.id;
        if (id) set.add(id);
      }
      return set;
    }, [opportunityData]);

    // Flatten all needs (filtered by allowed opps)
    const allNeeds = useMemo(() => {
      const flat: StaffingNeedItem[] = [];
      for (const [opportunityId, items] of Object.entries(storeNeeds)) {
        if (allowedOppIds && !allowedOppIds.has(opportunityId)) continue;
        for (const n of items) flat.push({ ...n, opportunityId: n.opportunityId || opportunityId });
      }
      return flat;
    }, [storeNeeds, allowedOppIds]);

    // Filter by grade and period
    const filteredNeeds = useMemo(() => {
      let needs = allNeeds;
      if (gradeFilter) {
        needs = needs.filter((n) => {
          const grade = n.grade || "";
          return (
            grade === gradeFilter ||
            grade.toLowerCase().replace(/\s+/g, "_") === gradeFilter.toLowerCase().replace(/\s+/g, "_")
          );
        });
      }
      if (periodFilter) {
        needs = needs.filter((n) => {
          if (!n.startDate || !n.endDate) return false;
          return n.endDate >= periodFilter.start && n.startDate < periodFilter.end;
        });
      }
      return needs;
    }, [allNeeds, gradeFilter, periodFilter]);

    // Derive statuses
    const statuses = useMemo(
      () => computeAllNeedStatuses(filteredNeeds, assignments, scenarioId),
      [filteredNeeds, assignments, scenarioId]
    );

    // Group by grade
    const gradeGroups = useMemo(() => {
      const groups = new Map<string, StaffingNeedItem[]>();
      for (const n of filteredNeeds) {
        const grade = n.grade || "Unknown";
        const list = groups.get(grade) || [];
        list.push(n);
        groups.set(grade, list);
      }
      return [...groups.entries()].sort(([a], [b]) => compareGrades(a, b));
    }, [filteredNeeds]);

    const toggleGrade = useCallback((grade: string) => {
      setExpandedGrades((prev) => {
        const next = new Set(prev);
        if (next.has(grade)) next.delete(grade);
        else next.add(grade);
        return next;
      });
    }, []);

    // Selected need for candidate drawer
    const selectedNeed = useMemo(() => allNeeds.find((n) => n.id === candidateNeedId), [allNeeds, candidateNeedId]);

    const handleAssign = useCallback(
      (candidate: CandidateResult) => {
        if (!selectedNeed) return;

        // Check: don't assign more candidates than slots available
        const existingCount = getAssignmentsForNeed(selectedNeed.id, assignments, scenarioId).length;
        const maxSlots = selectedNeed.quantity || 1;
        if (existingCount >= maxSlots) return;

        const empId = candidate.empId;
        const opportunityId = selectedNeed.opportunityId || "";

        // Resolve job info from pipelineJobcodes (StaffingTab) or opportunityData (App.tsx fallback)
        const pjInfo = pipelineJobcodes?.get(opportunityId);
        const oppFallback =
          !pjInfo && opportunityData
            ? opportunityData.find((o: any) => o.opportunityId === opportunityId || o.id === opportunityId)
            : null;
        const jobNo = pjInfo?.jobNo || oppFallback?.jobCode || opportunityId;
        const tr = (s: string, max = 25) => (s && s.length > max ? s.slice(0, max) + "\u2026" : s);
        const account = pjInfo?.account || oppFallback?.account || "";
        const oppName = pjInfo?.opportunityName || oppFallback?.opportunity || "";
        const jobName = account || oppName ? `${tr(account)} - ${tr(oppName)}` : "";

        const util = selectedNeed.utilization ?? 100;

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

        onCandidateOpen?.(null);
      },
      [selectedNeed, pipelineJobcodes, opportunityData, onCandidateOpen, onOpenEditor, assignments, scenarioId]
    );

    // Assignments from editor states are already confirmed — confirm is a no-op
    const handleConfirm = useCallback((_assignmentId: string) => {}, []);

    // Cancel = remove the segment from the editor state
    const handleCancel = useCallback((assignmentId: string) => {
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

    // ── Drag & drop: accept employee drops from EmployeeRow ──
    const [dropTargetNeedId, setDropTargetNeedId] = useState<string | null>(null);
    const [isDragOverList, setIsDragOverList] = useState(false);
    const dragOverCountRef = useRef(0);

    const handleNeedDragOver = useCallback((e: React.DragEvent, needId: string) => {
      if (e.dataTransfer.types.includes("application/scenario-employee")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTargetNeedId(needId);
      }
    }, []);

    const handleNeedDragLeave = useCallback(() => {
      setDropTargetNeedId(null);
    }, []);

    const handleNeedDrop = useCallback(
      (e: React.DragEvent, need: StaffingNeedItem) => {
        e.preventDefault();
        setDropTargetNeedId(null);
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (!empId) return;

        const oppJobNo = pipelineJobcodes?.get(need.opportunityId || "")?.jobNo || need.opportunityId || "";
        const tr = (s: string, max = 20) => (s && s.length > max ? s.slice(0, max) + "\u2026" : s);
        const oppInfo = pipelineJobcodes?.get(need.opportunityId || "");
        const jobName = oppInfo
          ? `${tr(oppInfo.account || "")} - ${tr(oppInfo.opportunityName || "")}`
          : "Staffing Need";

        const util = need.utilization ?? 100;

        const uid = `need_${need.id}_${Date.now()}`;
        const newSeg = {
          _uid: uid,
          empId,
          jobNo: oppJobNo,
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
              groupKey: `${oppJobNo}__chargeable`,
              type: "create" as const,
              sourceUids: [],
              produced: [newSeg],
            },
          ],
          redoStack: [],
          current: [...current, newSeg],
        });
      },
      [pipelineJobcodes]
    );

    const handleListDragOver = useCallback((e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/scenario-employee")) {
        e.preventDefault();
        dragOverCountRef.current += 1;
        setIsDragOverList(true);
      }
    }, []);

    const handleListDragLeave = useCallback(() => {
      dragOverCountRef.current = Math.max(0, dragOverCountRef.current - 1);
      if (dragOverCountRef.current === 0) setIsDragOverList(false);
    }, []);

    const handleListDrop = useCallback(() => {
      dragOverCountRef.current = 0;
      setIsDragOverList(false);
    }, []);

    return (
      <Box sx={{ display: "flex", flexDirection: "row", flex: 1, overflow: "hidden" }}>
        {/* Main list */}
        <Box
          sx={{ flex: 1, overflow: "auto", px: 1, py: 0.5, minWidth: 0, position: "relative" }}
          onDragOver={handleListDragOver}
          onDragLeave={handleListDragLeave}
          onDrop={handleListDrop}
        >
          {/* Drop affordance overlay */}
          {isDragOverList && filteredNeeds.length > 0 && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                border: "2px dashed",
                borderColor: "#3b82f6",
                borderRadius: 2,
                bgcolor: alpha("#3b82f6", 0.04),
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                pt: 1.5,
                pointerEvents: "none",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#3b82f6",
                  bgcolor: alpha("#3b82f6", 0.08),
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                }}
              >
                Drop here to assign
              </Typography>
            </Box>
          )}
          {/* Active filter chip */}
          {(gradeFilter || periodFilter) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75, flexWrap: "wrap" }}>
              {gradeFilter && (
                <Chip
                  label={gradeFilter}
                  size="small"
                  onDelete={onClearFilter}
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    bgcolor: alpha(getGradeColor(gradeFilter).text, 0.1),
                    color: getGradeColor(gradeFilter).text,
                    "& .MuiChip-deleteIcon": { fontSize: 14, color: "inherit", opacity: 0.5 },
                  }}
                />
              )}
              {periodFilter && (
                <Chip
                  label={`${periodFilter.start.slice(0, 7)} → ${periodFilter.end.slice(0, 7)}`}
                  size="small"
                  onDelete={onClearFilter}
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    bgcolor: "rgba(0,0,0,0.05)",
                    "& .MuiChip-deleteIcon": { fontSize: 14, opacity: 0.5 },
                  }}
                />
              )}
            </Box>
          )}

          {filteredNeeds.length === 0 && (
            <Box sx={{ textAlign: "center", py: 3, color: "text.secondary" }}>
              <Typography variant="body2">
                {gradeFilter || periodFilter ? "No needs for this filter" : "No needs defined"}
              </Typography>
            </Box>
          )}

          {gradeGroups.map(([grade, needs]) => {
            const gradeColor = getGradeColor(grade);
            const expanded = expandedGrades.has(grade);
            const gradeAssigned = needs.reduce(
              (sum, n) => sum + getAssignmentsForNeed(n.id, assignments, scenarioId).length,
              0
            );
            const gradeTotal = needs.reduce((sum, n) => sum + (n.quantity || 1), 0);

            return (
              <Box key={grade} sx={{ mb: 0.5 }}>
                {/* Grade header — no border, subtle bg */}
                <Box
                  onClick={() => toggleGrade(grade)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    cursor: "pointer",
                    transition: "background-color 150ms ease",
                    "&:hover": { bgcolor: alpha(gradeColor.text, 0.04) },
                  }}
                >
                  {expanded ? (
                    <ExpandLessIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                  )}
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: 1,
                      bgcolor: gradeColor.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                      {getGradeAbbr(grade)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.78rem", flex: 1 }}>
                    {grade}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.68rem",
                      color: gradeAssigned === gradeTotal && gradeTotal > 0 ? "#10b981" : "text.disabled",
                    }}
                  >
                    {gradeAssigned}/{gradeTotal}
                  </Typography>
                </Box>

                <Collapse in={expanded}>
                  <Box sx={{ pt: 0.25 }}>
                    {needs.map((need) => {
                      const status = statuses.get(need.id) || "open";
                      const statusColor = STATUS_COLORS[status] || STATUS_COLORS.open;
                      const needAssignments = getAssignmentsForNeed(need.id, assignments, scenarioId);
                      const oppInfo = pipelineJobcodes?.get(need.opportunityId || "");
                      const oppLabel = oppInfo?.opportunityName || need.opportunityId || "";
                      const isDropTarget = dropTargetNeedId === need.id;
                      const isActive = candidateNeedId === need.id;

                      return (
                        <Box
                          key={need.id}
                          onDragOver={(e) => handleNeedDragOver(e, need.id)}
                          onDragLeave={handleNeedDragLeave}
                          onDrop={(e) => handleNeedDrop(e, need)}
                          sx={{
                            px: 1.5,
                            py: 1,
                            mx: 0.75,
                            mb: 0.5,
                            borderRadius: 2,
                            bgcolor: isDropTarget
                              ? alpha("#3b82f6", 0.08)
                              : isActive
                                ? alpha(statusColor.accent, 0.06)
                                : "#f8f9fa",
                            boxShadow: isDropTarget ? "0 1px 3px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
                            transition: "background-color 150ms ease, box-shadow 150ms ease",
                            "&:hover": { bgcolor: isDropTarget ? alpha("#3b82f6", 0.1) : "#eceef0" },
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.3 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontSize: "0.78rem", fontWeight: 500, flex: 1 }}
                              noWrap
                              title={oppLabel}
                            >
                              {oppLabel}
                            </Typography>
                            <StatusBadge status={status} />
                            {(need.quantity || 1) > 1 && (
                              <Typography
                                variant="caption"
                                sx={{ fontSize: "0.6rem", fontWeight: 600, color: "text.disabled" }}
                              >
                                ×{need.quantity}
                              </Typography>
                            )}
                          </Box>

                          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.disabled" }}>
                            {need.startDate?.slice(5)} → {need.endDate?.slice(5)}
                            {` · ${Math.round(need.utilization ?? 100)}%`}
                            {need.probability != null &&
                              need.probability < 100 &&
                              need.probability !== 1 &&
                              ` · P${Math.round(need.probability <= 1 ? need.probability * 100 : need.probability)}%`}
                          </Typography>

                          {need.skills && need.skills.length > 0 && (
                            <Box sx={{ display: "flex", gap: 0.3, flexWrap: "wrap", mt: 0.4 }}>
                              {need.skills.slice(0, 3).map((s) => (
                                <Typography
                                  key={s}
                                  variant="caption"
                                  sx={{
                                    fontSize: "0.58rem",
                                    color: "text.secondary",
                                    bgcolor: "rgba(0,0,0,0.04)",
                                    px: 0.6,
                                    py: 0.1,
                                    borderRadius: 0.75,
                                  }}
                                >
                                  {s}
                                </Typography>
                              ))}
                              {need.skills.length > 3 && (
                                <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "text.disabled" }}>
                                  +{need.skills.length - 3}
                                </Typography>
                              )}
                            </Box>
                          )}

                          {needAssignments.length > 0 && (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, mt: 0.5 }}>
                              {needAssignments.map((a) => (
                                <AssignmentChip
                                  key={a.id}
                                  assignment={a}
                                  onConfirm={handleConfirm}
                                  onCancel={handleCancel}
                                />
                              ))}
                            </Box>
                          )}

                          {status !== "filled" && status !== "cancelled" && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<PersonAddIcon sx={{ fontSize: 13 }} />}
                              onClick={() => onCandidateOpen?.(candidateNeedId === need.id ? null : need.id)}
                              sx={{
                                mt: 0.4,
                                textTransform: "none",
                                fontSize: "0.68rem",
                                py: 0.1,
                                fontWeight: 600,
                                color: "#CC2931",
                              }}
                            >
                              {candidateNeedId === need.id ? "Close" : "Candidates"}
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>

        {/* Candidate drawer */}
        {selectedNeed && candidateNeedId && (
          <CandidateDrawer
            need={selectedNeed}
            onClose={() => onCandidateOpen?.(null)}
            onAssign={handleAssign}
            scenarioId={scenarioId}
          />
        )}
      </Box>
    );
  }
);
NeedsList.displayName = "NeedsList";

export default NeedsList;
