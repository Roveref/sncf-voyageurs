/**
 * StaffingNeedsPiP v6 — Assignment board by grade.
 *
 * Features:
 * - Two-column layout: need slot ↔ assigned person
 * - Grouped by consulting grade (Partner → Intern)
 * - Inline need creation & editing
 * - TU impact display
 * - Multi-instance: one board per scenario
 * - Permutation drag & drop
 */

import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import Avatar from "@mui/material/Avatar";
import Portal from "@mui/material/Portal";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckIcon from "@mui/icons-material/Check";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { readAllStaffingNeeds } from "../../utils/scenarioUtils";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { safeJsonParse } from "../../../../utils/safeJson";
import { GRADE_ORDER } from "../../constants";
import { getGradeColor, GRADE_ABBR, compareGrades, type GradeColor } from "../../constants";
import NeedSlotRow from "./NeedSlotRow";
import { usePiPDragResize } from "./usePiPDragResize";
import PiPCreateForm from "./PiPCreateForm";

interface StaffingNeedsPiPProps {
  open: boolean;
  scenarioId: string;
  scenarioName: string;
  instanceIndex: number;
  onClose: () => void;
  onOpenAssignmentModal?: (prefill?: {
    empId?: string;
    jobNo?: string;
    startDate?: string;
    endDate?: string;
    needId?: string;
  }) => void;
  onReassign?: (
    sourceOverrideKey: string,
    target: { empId: string; jobNo: string; startDate: string; endDate: string; needId: string }
  ) => void;
  isScenarioActive: boolean;
  pipelineJobcodes: Map<string, any> | null;
  ioJobcodes: Set<string> | null;
  assignmentOverrides: Record<string, any> | null;
  enrichedGanttData: any[];
  allScenarios: any[];
  onOpenScenario: (id: string) => void;
  realTU: number;
  scenarioTU: number | null;
  onOpenOptimizer?: () => void;
}

interface Slot {
  needId: string;
  slotIndex: number;
  grade: string;
  gradeAbbr: string;
  opportunityId: string;
  oppLabel: string;
  startDate: string;
  endDate: string;
  probability: number | null;
  assignedEmpId: string | null;
  assignedName: string | null;
  overrideKey: string | null;
}

interface GradeGroup {
  grade: string;
  gradeAbbr: string;
  gradeColor: GradeColor;
  slots: Slot[];
}

const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

const StaffingNeedsPiP = memo(
  ({
    open,
    scenarioId,
    scenarioName,
    instanceIndex,
    onClose,
    onOpenAssignmentModal,
    onReassign,
    isScenarioActive,
    pipelineJobcodes,
    ioJobcodes,
    assignmentOverrides,
    enrichedGanttData,
    allScenarios,
    onOpenScenario,
    realTU,
    scenarioTU,
    onOpenOptimizer,
  }: StaffingNeedsPiPProps) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const bg = isDark ? theme.palette.background.paper : "#fafafa";
    const accent = theme.palette.primary.main;
    const success = theme.palette.success.main;

    // ── Position + drag-to-move + resize ──
    const {
      pos,
      size,
      handleMoveDown,
      handleMoveMove,
      handleMoveUp,
      handleResizeDown,
      handleResizeMove,
      handleResizeUp,
    } = usePiPDragResize(instanceIndex);

    // ── Staffing needs data (reactive from store) ──
    const storeNeedsMap = useUserDataStore((s) => s.staffingNeeds);
    const allNeeds = useMemo(() => readAllStaffingNeeds(), [storeNeedsMap]);

    // ── Build needId → assigned employees ──
    const needAssignments = useMemo(() => {
      const map = new Map<string, { empId: string; name: string; overrideKey: string }[]>();
      if (!assignmentOverrides) return map;
      const empMap = new Map(enrichedGanttData.map((e) => [e.empId, e.name]));
      for (const [key, ov] of Object.entries(assignmentOverrides)) {
        const nid = ov.data?.needId;
        if (!nid || ov.type === "delete") continue;
        const empId = ov.data?.empId || "";
        const empName = empMap.get(empId) || empId || "?";
        if (!map.has(nid)) map.set(nid, []);
        map.get(nid)!.push({ empId, name: empName, overrideKey: key });
      }
      return map;
    }, [assignmentOverrides, enrichedGanttData]);

    // ── Search ──
    const [search, setSearch] = useState("");

    // ── Group by grade ──
    const gradeGroups = useMemo((): GradeGroup[] => {
      const map = new Map<string, GradeGroup>();
      for (const need of allNeeds) {
        const grade = need.grade || "Unknown";
        const gradeAbbr = GRADE_ABBR[grade] || grade.slice(0, 2).toUpperCase();
        const gradeColor = getGradeColor(grade);
        if (!map.has(grade)) map.set(grade, { grade, gradeAbbr, gradeColor, slots: [] });

        const opportunityId = need.opportunityId || "?";
        let oppLabel = opportunityId;
        if (pipelineJobcodes) {
          const info = pipelineJobcodes.get(opportunityId) || pipelineJobcodes.get(String(opportunityId));
          if (info) oppLabel = info.opportunityName || opportunityId;
        }

        const qty = Math.max(1, parseInt(need.quantity) || 1);
        const assignments = needAssignments.get(need.id) || [];
        for (let i = 0; i < qty; i++) {
          const assigned = assignments[i] || null;
          map.get(grade)!.slots.push({
            needId: need.id,
            slotIndex: i,
            grade,
            gradeAbbr,
            opportunityId,
            oppLabel,
            startDate: need.startDate || "",
            endDate: need.endDate || "",
            probability: need.probability ?? null,
            assignedEmpId: assigned?.empId || null,
            assignedName: assigned?.name || null,
            overrideKey: assigned?.overrideKey || null,
          });
        }
      }

      let groups = Array.from(map.values());
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        groups = groups
          .map((g) => ({
            ...g,
            slots: g.slots.filter(
              (s) =>
                s.grade.toLowerCase().includes(q) ||
                s.oppLabel.toLowerCase().includes(q) ||
                (s.assignedName || "").toLowerCase().includes(q)
            ),
          }))
          .filter((g) => g.slots.length > 0);
      }
      groups.sort((a, b) => compareGrades(a.grade, b.grade));
      return groups;
    }, [allNeeds, pipelineJobcodes, needAssignments, search]);

    const totalSlots = useMemo(() => gradeGroups.reduce((s, g) => s + g.slots.length, 0), [gradeGroups]);
    const totalAssigned = useMemo(
      () => gradeGroups.reduce((s, g) => s + g.slots.filter((sl) => sl.assignedName).length, 0),
      [gradeGroups]
    );

    // ── TU delta ──
    const deltaTU = scenarioTU != null ? scenarioTU - realTU : null;

    // ── Expanded ──
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggleExpanded = useCallback((grade: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.has(grade) ? next.delete(grade) : next.add(grade);
        return next;
      });
    }, []);

    const prevGroupCount = useRef(0);
    useEffect(() => {
      if (open && gradeGroups.length > 0 && prevGroupCount.current === 0)
        setExpanded(new Set(gradeGroups.map((g) => g.grade)));
      prevGroupCount.current = gradeGroups.length;
    }, [open, gradeGroups]);

    // ── Inline editing ──
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>(null);

    const startEdit = useCallback((needId: string, need: any) => {
      setEditingId(needId);
      setEditForm({
        grade: need.grade || "",
        quantity: need.quantity || 1,
        probability: need.probability ?? 1,
        startDate: need.startDate || "",
        endDate: need.endDate || "",
      });
    }, []);

    const saveEdit = useCallback(() => {
      if (!editingId || !editForm) return;
      const allNeedsList = readAllStaffingNeeds();
      const need = allNeedsList.find((n: any) => n.id === editingId);
      if (need) {
        const ds = useUserDataStore.getState();
        const arr = [...(ds.staffingNeeds[need.opportunityId] || [])];
        const idx = arr.findIndex((n: any) => n.id === editingId);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], ...editForm, updatedAt: new Date().toISOString() };
          ds.setStaffingNeeds(need.opportunityId, arr);
        }
      }
      setEditingId(null);
      setEditForm(null);
    }, [editingId, editForm]);

    // ── Drop target ──
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const handleSlotDragOver = useCallback(
      (e: React.DragEvent, slotKey: string) => {
        if (!isScenarioActive) return;
        const types = Array.from(e.dataTransfer.types);
        if (types.includes("application/scenario-employee") || types.includes("application/pip-assignment")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = types.includes("application/pip-assignment") ? "move" : "copy";
          setDropTarget(slotKey);
        }
      },
      [isScenarioActive]
    );

    const handleSlotDragLeave = useCallback((e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
    }, []);

    const handleDropOnSlot = useCallback(
      (e: React.DragEvent, slot: Slot) => {
        e.preventDefault();
        setDropTarget(null);
        const pipData = e.dataTransfer.getData("application/pip-assignment");
        if (pipData) {
          const source = safeJsonParse<any>(pipData, null);
          if (source?.overrideKey && source?.empId && onReassign) {
            onReassign(source.overrideKey, {
              empId: source.empId,
              jobNo: slot.opportunityId,
              startDate: slot.startDate,
              endDate: slot.endDate,
              needId: slot.needId,
            });
          }
          return;
        }
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (empId && onOpenAssignmentModal) {
          onOpenAssignmentModal({
            empId,
            jobNo: slot.opportunityId,
            startDate: slot.startDate,
            endDate: slot.endDate,
            needId: slot.needId,
          });
        }
      },
      [onOpenAssignmentModal, onReassign]
    );

    const handleNeedDragStart = useCallback(
      (e: React.DragEvent, slot: Slot) => {
        if (!isScenarioActive) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(
          "application/scenario-need",
          JSON.stringify({
            opportunityId: slot.opportunityId,
            startDate: slot.startDate,
            endDate: slot.endDate,
            grade: slot.grade,
            needId: slot.needId,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      },
      [isScenarioActive]
    );

    const handleAssignmentDragStart = useCallback(
      (e: React.DragEvent, slot: Slot) => {
        if (!isScenarioActive || !slot.assignedEmpId) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(
          "application/pip-assignment",
          JSON.stringify({
            empId: slot.assignedEmpId,
            name: slot.assignedName,
            sourceNeedId: slot.needId,
            sourceSlotIndex: slot.slotIndex,
            overrideKey: slot.overrideKey,
          })
        );
        e.dataTransfer.setData("application/scenario-employee", slot.assignedEmpId);
        e.dataTransfer.effectAllowed = "move";
      },
      [isScenarioActive]
    );

    const handleDropOnFreeZone = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setDropTarget(null);
        try {
          const empId = e.dataTransfer.getData("application/scenario-employee");
          if (empId && onOpenAssignmentModal) onOpenAssignmentModal({ empId });
        } catch {
          /* skip */
        }
      },
      [onOpenAssignmentModal]
    );

    // ── Scenario picker menu ──
    const [scenarioMenuAnchor, setScenarioMenuAnchor] = useState<null | HTMLElement>(null);
    const otherScenarios = allScenarios.filter((s) => s.id !== scenarioId);

    if (!open) return null;

    return (
      <Portal>
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            top: pos.y,
            left: pos.x,
            width: size.w,
            height: size.h,
            zIndex: 10100 + instanceIndex,
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            bgcolor: bg,
            boxShadow: `0 8px 32px ${alpha("#000", 0.08)}, 0 2px 8px ${alpha("#000", 0.04)}`,
            transition: `box-shadow 0.3s ${EASING}`,
            "&:hover": { boxShadow: `0 12px 40px ${alpha("#000", 0.12)}, 0 4px 12px ${alpha("#000", 0.06)}` },
          }}
        >
          {/* ── Header ── */}
          <Box
            onPointerDown={handleMoveDown}
            onPointerMove={handleMoveMove}
            onPointerUp={handleMoveUp}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 1,
              bgcolor: isScenarioActive ? alpha("#f59e0b", 0.06) : alpha(accent, 0.04),
              borderBottom: `1px solid ${isDark ? alpha("#fff", 0.06) : "#e5e7eb"}`,
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
              touchAction: "none",
              flexShrink: 0,
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 14, color: "text.disabled", opacity: 0.4 }} />
            <AssignmentIndIcon sx={{ fontSize: 16, color: isScenarioActive ? "#f59e0b" : accent }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.primary", lineHeight: 1.2 }} noWrap>
                {scenarioName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.125 }}>
                {totalSlots > 0 && (
                  <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                    {totalAssigned}/{totalSlots} assigned
                  </Typography>
                )}
                {deltaTU != null && (
                  <Chip
                    icon={
                      deltaTU >= 0 ? (
                        <TrendingUpIcon sx={{ fontSize: "12px !important" }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: "12px !important" }} />
                      )
                    }
                    label={`${deltaTU >= 0 ? "+" : ""}${deltaTU.toFixed(1)} pts TU`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      bgcolor: alpha(deltaTU >= 0 ? success : theme.palette.error.main, 0.08),
                      color: deltaTU >= 0 ? success : theme.palette.error.main,
                      "& .MuiChip-icon": { color: "inherit" },
                    }}
                  />
                )}
                {!isScenarioActive && (
                  <Chip
                    label="read only"
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: "0.5rem",
                      fontWeight: 600,
                      bgcolor: alpha("#9ca3af", 0.1),
                      color: "#9ca3af",
                    }}
                  />
                )}
              </Box>
            </Box>
            {/* Open another scenario */}
            {otherScenarios.length > 0 && (
              <>
                <Tooltip title="Open another scenario" arrow>
                  <IconButton
                    size="small"
                    data-no-drag
                    onClick={(e) => {
                      e.stopPropagation();
                      setScenarioMenuAnchor(e.currentTarget);
                    }}
                    sx={{ p: 0.375, color: "text.disabled", "&:hover": { color: accent } }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={scenarioMenuAnchor}
                  open={!!scenarioMenuAnchor}
                  onClose={() => setScenarioMenuAnchor(null)}
                  slotProps={{
                    paper: { sx: { minWidth: 180, borderRadius: 2, boxShadow: `0 4px 16px ${alpha("#000", 0.1)}` } },
                  }}
                >
                  {otherScenarios.map((sc) => (
                    <MenuItem
                      key={sc.id}
                      onClick={() => {
                        onOpenScenario(sc.id);
                        setScenarioMenuAnchor(null);
                      }}
                      sx={{ fontSize: "0.75rem", py: 0.75 }}
                    >
                      {sc.name}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            {isScenarioActive && onOpenOptimizer && (
              <Tooltip title="Staffing Optimizer" arrow>
                <IconButton
                  size="small"
                  data-no-drag
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptimizer();
                  }}
                  sx={{ p: 0.375, color: "#7c3aed", "&:hover": { bgcolor: alpha("#7c3aed", 0.08) } }}
                >
                  <AutoFixHighIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              size="small"
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              sx={{
                p: 0.375,
                color: "text.disabled",
                "&:hover": { color: "text.primary", bgcolor: alpha("#000", 0.04) },
              }}
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>

          {/* ── Search + Create ── */}
          <PiPCreateForm
            search={search}
            onSearchChange={setSearch}
            pipelineJobcodes={pipelineJobcodes}
            accent={accent}
          />

          {/* ── Column headers ── */}
          <Box
            sx={{
              display: "flex",
              px: 2,
              py: 0.375,
              gap: 1.5,
              flexShrink: 0,
              borderBottom: `1px solid ${isDark ? alpha("#fff", 0.06) : "#eeefef"}`,
            }}
          >
            <Typography
              sx={{
                flex: 1,
                fontSize: "0.58rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.disabled",
                pl: 1,
              }}
            >
              Need
            </Typography>
            <Box sx={{ width: 24 }} />
            <Typography
              sx={{
                flex: 1,
                fontSize: "0.58rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.disabled",
              }}
            >
              Assigned to
            </Typography>
          </Box>

          {/* ── Content ── */}
          <Box sx={{ overflow: "auto", flex: 1, py: 0.5 }}>
            {gradeGroups.length === 0 && (
              <Box sx={{ textAlign: "center", py: 5, px: 3 }}>
                <AssignmentIndIcon sx={{ fontSize: 36, color: alpha(accent, 0.1), mb: 1 }} />
                <Typography sx={{ color: "text.secondary", fontWeight: 500, fontSize: "0.8rem" }}>
                  {allNeeds.length === 0 ? "Aucun besoin" : "Aucun résultat"}
                </Typography>
              </Box>
            )}

            {gradeGroups.map((group) => {
              const isOpen = expanded.has(group.grade);
              const assignedCount = group.slots.filter((s) => s.assignedName).length;
              const gc = group.gradeColor;

              return (
                <Box key={group.grade} sx={{ mb: 0.25 }}>
                  {/* ── Grade header ── */}
                  <Box
                    onClick={() => toggleExpanded(group.grade)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      mx: 1,
                      px: 1.25,
                      py: 0.625,
                      borderRadius: 2,
                      bgcolor: gc.bg,
                      cursor: "pointer",
                      transition: `filter 0.2s ${EASING}`,
                      "&:hover": { filter: "brightness(0.97)" },
                    }}
                  >
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 16,
                        color: gc.text,
                        transition: `transform 0.25s ${EASING}`,
                        transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      }}
                    />
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        bgcolor: gc.border,
                        color: "#fff",
                        borderRadius: 1,
                      }}
                    >
                      {group.gradeAbbr}
                    </Avatar>
                    <Typography sx={{ flex: 1, fontSize: "0.75rem", fontWeight: 700, color: gc.text }}>
                      {group.grade}
                    </Typography>
                    <Chip
                      label={`${assignedCount}/${group.slots.length}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        borderRadius: "9px",
                        bgcolor:
                          assignedCount >= group.slots.length && assignedCount > 0
                            ? alpha(success, 0.12)
                            : alpha(gc.text, 0.08),
                        color: assignedCount >= group.slots.length && assignedCount > 0 ? success : gc.text,
                      }}
                    />
                  </Box>

                  {/* ── Slots ── */}
                  <Collapse in={isOpen} timeout={200}>
                    <Box sx={{ px: 1, py: 0.25 }}>
                      {group.slots.map((slot) => {
                        const slotKey = `${slot.needId}_${slot.slotIndex}`;
                        const isOver = dropTarget === slotKey;
                        const isAssigned = !!slot.assignedName;
                        const isEditing = editingId === slot.needId && slot.slotIndex === 0;

                        if (isEditing && editForm) {
                          return (
                            <Box
                              key={slotKey}
                              sx={{
                                mx: 0.5,
                                my: 0.375,
                                p: 1,
                                borderRadius: 2,
                                bgcolor: alpha(accent, 0.03),
                                border: `1px solid ${alpha(accent, 0.1)}`,
                              }}
                            >
                              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5 }}>
                                <Select
                                  size="small"
                                  value={editForm.grade}
                                  onChange={(e) => setEditForm((f: any) => ({ ...f, grade: e.target.value }))}
                                  sx={{ flex: 2, fontSize: "0.72rem", "& .MuiSelect-select": { py: 0.5 } }}
                                >
                                  {[...GRADE_ORDER].reverse().map((g) => (
                                    <MenuItem key={g} value={g} sx={{ fontSize: "0.72rem" }}>
                                      {g}
                                    </MenuItem>
                                  ))}
                                </Select>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="Qty"
                                  value={editForm.quantity}
                                  onChange={(e) =>
                                    setEditForm((f: any) => ({
                                      ...f,
                                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                                    }))
                                  }
                                  sx={{ width: 52, "& input": { py: 0.5, fontSize: "0.72rem" } }}
                                />
                                <IconButton size="small" onClick={saveEdit} sx={{ color: success }}>
                                  <CheckIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditForm(null);
                                  }}
                                  sx={{ color: "text.disabled" }}
                                >
                                  <CloseIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                              <Box sx={{ display: "flex", gap: 0.75 }}>
                                <TextField
                                  size="small"
                                  type="date"
                                  label="Start"
                                  value={editForm.startDate}
                                  InputLabelProps={{ shrink: true }}
                                  onChange={(e) => setEditForm((f: any) => ({ ...f, startDate: e.target.value }))}
                                  sx={{ flex: 1, "& input": { py: 0.5, fontSize: "0.68rem" } }}
                                />
                                <TextField
                                  size="small"
                                  type="date"
                                  label="End"
                                  value={editForm.endDate}
                                  InputLabelProps={{ shrink: true }}
                                  onChange={(e) => setEditForm((f: any) => ({ ...f, endDate: e.target.value }))}
                                  sx={{ flex: 1, "& input": { py: 0.5, fontSize: "0.68rem" } }}
                                />
                              </Box>
                              <Box sx={{ mt: 0.5, px: 0.5 }}>
                                <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                                  Probability: {Math.round((editForm.probability ?? 1) * 100)}%
                                </Typography>
                                <Slider
                                  size="small"
                                  value={editForm.probability ?? 1}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  onChange={(_, v) => setEditForm((f: any) => ({ ...f, probability: v as number }))}
                                  valueLabelDisplay="auto"
                                  valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                                  sx={{ py: 0.5 }}
                                />
                              </Box>
                            </Box>
                          );
                        }

                        return (
                          <NeedSlotRow
                            key={slotKey}
                            slot={slot}
                            gc={gc}
                            gradeAbbr={group.gradeAbbr}
                            isScenarioActive={isScenarioActive}
                            dropTarget={dropTarget}
                            accent={accent}
                            onNeedDragStart={handleNeedDragStart}
                            onAssignmentDragStart={handleAssignmentDragStart}
                            onSlotDragOver={handleSlotDragOver}
                            onSlotDragLeave={handleSlotDragLeave}
                            onDropOnSlot={handleDropOnSlot}
                            onStartEdit={(needId) => {
                              const need = allNeeds.find((n: any) => n.id === needId);
                              if (need) startEdit(needId, need);
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}

            {/* Free drop */}
            {isScenarioActive && (
              <Box
                onDragOver={(e) => handleSlotDragOver(e, "__free__")}
                onDragLeave={handleSlotDragLeave}
                onDrop={handleDropOnFreeZone}
                sx={{
                  mx: 1.5,
                  my: 1,
                  p: 1.5,
                  borderRadius: 2,
                  border: `1.5px dashed ${dropTarget === "__free__" ? accent : alpha(theme.palette.text.disabled, 0.12)}`,
                  bgcolor: dropTarget === "__free__" ? alpha(accent, 0.03) : "transparent",
                  textAlign: "center",
                  transition: `background-color 0.2s ${EASING}, border-color 0.2s ${EASING}`,
                }}
              >
                <PersonAddIcon
                  sx={{
                    fontSize: 18,
                    color: dropTarget === "__free__" ? accent : "text.disabled",
                    opacity: dropTarget === "__free__" ? 0.7 : 0.25,
                    mb: 0.25,
                  }}
                />
                <Typography
                  sx={{
                    color: dropTarget === "__free__" ? accent : "text.disabled",
                    fontWeight: 500,
                    fontSize: "0.65rem",
                  }}
                >
                  Free assignment
                </Typography>
              </Box>
            )}
          </Box>

          {/* Resize */}
          <Box
            onPointerDown={handleResizeDown}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            sx={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 18,
              height: 18,
              cursor: "nwse-resize",
              touchAction: "none",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              pr: 0.5,
              pb: 0.5,
              opacity: 0.2,
              "&:hover": { opacity: 0.5 },
              transition: "opacity 0.2s",
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8">
              <path d="M8 0L8 8L0 8Z" fill={isDark ? "#aaa" : "#999"} />
            </svg>
          </Box>
        </Paper>
      </Portal>
    );
  }
);

StaffingNeedsPiP.displayName = "StaffingNeedsPiP";
export default StaffingNeedsPiP;
