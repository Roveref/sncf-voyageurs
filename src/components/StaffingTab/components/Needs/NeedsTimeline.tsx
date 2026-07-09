/**
 * NeedsTimeline — Gantt-like timeline of staffing needs grouped by grade.
 *
 * Features:
 * - Grouped by grade with expand/collapse headers
 * - Bar label: Account - Opp - Util% - Proba%
 * - Click bar to edit, horizontal drag to shift dates
 * - Drop employee to assign, at-risk indicator
 */

import { memo, useMemo, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import IconButton from "@mui/material/IconButton";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { GRADE_ORDER, getGradeColor, getGradeAbbr, getGradeUILabel } from "../../constants";
import { getAssignmentsForNeed, getAssignmentsFromEditorStates } from "../../utils/needStatusUtils";
import { formatLocalDate } from "../../utils/dateUtils";
import type { StaffingNeedItem, StaffingAssignment } from "../../../../types";

const resolveGrade = (n: StaffingNeedItem) => n.grade || "Unknown";

const BAR_H = 22;
const ROW_GAP = 3;
const MS_PER_DAY = 86400000;
const LEFT_W = 240; // same as NeedsMatrix LEFT_COL_SX

type NeedEx = StaffingNeedItem & { _grade: string; _oppName: string; _account: string };

interface NeedsTimelineProps {
  gradeFilter?: string | null;
  opportunityData?: any[];
  scenarioId?: string | null;
  buckets?: { key: string; startDate: string; endDate: string }[];
  employees?: { empId: string; name: string; grade?: string }[];
  onEditNeed?: (need: StaffingNeedItem) => void;
}

const NeedsTimeline = memo(
  ({ gradeFilter, opportunityData, scenarioId, buckets, employees, onEditNeed }: NeedsTimelineProps) => {
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

    const [collapsedGrades, setCollapsedGrades] = useState<Set<string>>(new Set());
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    // Opp + account lookup
    const oppLookup = useMemo(() => {
      if (!opportunityData?.length) return new Map<string, { name: string; account: string }>();
      const map = new Map<string, { name: string; account: string }>();
      for (const o of opportunityData) {
        const id = o.opportunityId || o.id;
        if (id) map.set(id, { name: o.opportunity || o.opportunity || id, account: o.account || o.account || "" });
      }
      return map;
    }, [opportunityData]);

    // Available grades for at-risk detection
    const availableGrades = useMemo(() => {
      if (!employees?.length) return new Set<string>();
      const s = new Set<string>();
      for (const e of employees) if (e.grade) s.add(e.grade);
      return s;
    }, [employees]);

    // Build allowed opp IDs for filtering
    const allowedOppIds = useMemo(() => {
      if (!opportunityData?.length) return null;
      const set = new Set<string>();
      for (const o of opportunityData) {
        const id = o.opportunityId || o.id;
        if (id) set.add(id);
      }
      return set;
    }, [opportunityData]);

    // Flatten + expand quantity into individual slots + group by grade
    const gradeGroups = useMemo(() => {
      type Slot = NeedEx & { _slotIndex: number; _assignment: StaffingAssignment | null };
      const flat: Slot[] = [];
      for (const [opportunityId, items] of Object.entries(storeNeeds)) {
        if (allowedOppIds && !allowedOppIds.has(opportunityId)) continue;
        const info = oppLookup.get(opportunityId);
        for (const n of items) {
          if (n.status === "cancelled" || !n.startDate || !n.endDate) continue;
          const grade = resolveGrade(n);
          if (gradeFilter && grade !== gradeFilter) continue;
          const base: NeedEx = {
            ...n,
            opportunityId: n.opportunityId || opportunityId,
            _grade: grade,
            _oppName: info?.name || opportunityId,
            _account: info?.account || "",
          };
          const qty = n.quantity || 1;
          const needAssigns = getAssignmentsForNeed(n.id, assignments, scenarioId);
          for (let i = 0; i < qty; i++) {
            flat.push({ ...base, _slotIndex: i, _assignment: needAssigns[i] || null });
          }
        }
      }
      const groups: { grade: string; slots: Slot[] }[] = [];
      for (const g of GRADE_ORDER) {
        const gSlots = flat.filter((s) => s._grade === g).sort((a, b) => a.startDate.localeCompare(b.startDate));
        if (gSlots.length > 0) groups.push({ grade: g, slots: gSlots });
      }
      return groups;
    }, [storeNeeds, gradeFilter, oppLookup, allowedOppIds, assignments, scenarioId]);

    // Timeline range from buckets
    const range = useMemo(() => {
      if (!buckets?.length) return null;
      const min = buckets[0].startDate;
      const max = buckets[buckets.length - 1].endDate;
      return { min, max, minMs: new Date(min + "T00:00:00").getTime(), maxMs: new Date(max + "T00:00:00").getTime() };
    }, [buckets]);

    const todayPct = useMemo(() => {
      if (!range) return null;
      const today = formatLocalDate(new Date());
      if (today < range.min || today > range.max) return null;
      return ((new Date(today + "T00:00:00").getTime() - range.minMs) / (range.maxMs - range.minMs || 1)) * 100;
    }, [range]);

    const toggleGrade = useCallback((grade: string) => {
      setCollapsedGrades((prev) => {
        const next = new Set(prev);
        if (next.has(grade)) next.delete(grade);
        else next.add(grade);
        return next;
      });
    }, []);

    const allCollapsed = gradeGroups.length > 0 && gradeGroups.every(({ grade }) => collapsedGrades.has(grade));
    const toggleAll = useCallback(() => {
      setCollapsedGrades((prev) => {
        if (prev.size > 0 && gradeGroups.every(({ grade }) => prev.has(grade))) return new Set();
        return new Set(gradeGroups.map(({ grade }) => grade));
      });
    }, [gradeGroups]);

    // ── Horizontal drag ──
    const dragRef = useRef<{
      needId: string;
      opportunityId: string;
      startX: number;
      origStart: string;
      origEnd: string;
    } | null>(null);

    const handleBarPointerDown = useCallback((e: React.PointerEvent, need: NeedEx) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        needId: need.id,
        opportunityId: need.opportunityId || "",
        startX: e.clientX,
        origStart: need.startDate,
        origEnd: need.endDate,
      };
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);

    const handleBarPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!dragRef.current || !range || !containerRef.current) return;
        const containerW = containerRef.current.clientWidth - LEFT_W;
        const dx = e.clientX - dragRef.current.startX;
        const deltaMs = (dx / containerW) * (range.maxMs - range.minMs);
        const deltaDays = Math.round(deltaMs / MS_PER_DAY);
        if (deltaDays === 0) return;
        const newStart = formatLocalDate(
          new Date(new Date(dragRef.current.origStart + "T00:00:00").getTime() + deltaDays * MS_PER_DAY)
        );
        const newEnd = formatLocalDate(
          new Date(new Date(dragRef.current.origEnd + "T00:00:00").getTime() + deltaDays * MS_PER_DAY)
        );
        const ds = useUserDataStore.getState();
        const oppNeeds = ds.staffingNeeds[dragRef.current.opportunityId];
        if (oppNeeds)
          ds.setStaffingNeeds(
            dragRef.current.opportunityId,
            oppNeeds.map((n) => (n.id === dragRef.current!.needId ? { ...n, startDate: newStart, endDate: newEnd } : n))
          );
        dragRef.current.startX = e.clientX;
        dragRef.current.origStart = newStart;
        dragRef.current.origEnd = newEnd;
      },
      [range]
    );

    const handleBarPointerUp = useCallback(() => {
      dragRef.current = null;
    }, []);

    // ── Drop employee ──
    const handleDragOver = useCallback((e: React.DragEvent, needId: string) => {
      if (e.dataTransfer.types.includes("application/scenario-employee")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTargetId(needId);
      }
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent, need: StaffingNeedItem) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTargetId(null);
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (!empId) return;

        const opportunityId = need.opportunityId || "";
        const oppInfo = oppLookup.get(opportunityId);
        const tr = (s: string, max = 20) => (s && s.length > max ? s.slice(0, max) + "\u2026" : s);
        const jobName = oppInfo ? `${tr(oppInfo.account || "")} - ${tr(oppInfo.name || "")}` : "Staffing Need";
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
      [oppLookup]
    );

    if (!gradeGroups.length || !range) {
      return (
        <Box sx={{ py: 1.5, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.78rem", color: "#9ca3af" }}>Aucun besoin à afficher</Typography>
        </Box>
      );
    }

    const span = range.maxMs - range.minMs || 1;

    return (
      <Box ref={containerRef} sx={{ py: 0.5 }}>
        {/* Expand/collapse all */}
        <Box sx={{ pl: 1, pb: 0.25 }}>
          <IconButton size="small" onClick={toggleAll} sx={{ p: 0.25, color: "#9ca3af" }}>
            {allCollapsed ? <UnfoldMoreIcon sx={{ fontSize: 15 }} /> : <UnfoldLessIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Box>

        {gradeGroups.map(({ grade, slots }) => {
          const gc = getGradeColor(grade);
          const isCollapsed = collapsedGrades.has(grade);
          const filledSlots = slots.filter((s) => s._assignment).length;

          return (
            <Box key={grade} sx={{ mb: 0.5 }}>
              {/* Grade header */}
              <Box
                onClick={() => toggleGrade(grade)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 1,
                  pr: 1,
                  py: 0.4,
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha(gc.text, 0.03) },
                }}
              >
                {isCollapsed ? (
                  <ChevronRightIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                )}
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 0.75,
                    bgcolor: gc.text,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#fff" }}>
                    {getGradeAbbr(grade)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", flex: 1 }}>
                  {getGradeUILabel(grade)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: filledSlots === slots.length && slots.length > 0 ? "#10b981" : "#9ca3af",
                  }}
                >
                  {filledSlots > 0 && filledSlots < slots.length ? `${filledSlots}/${slots.length}` : slots.length}
                </Typography>
              </Box>

              {/* Slot bars — one line per slot (quantity expanded) */}
              <Collapse in={!isCollapsed}>
                <Box sx={{ position: "relative", pl: "34px", pr: "16px" }}>
                  {/* Today line */}
                  {todayPct !== null && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `calc(34px + ${todayPct}%)`,
                        width: 1.5,
                        bgcolor: "#CC2931",
                        opacity: 0.3,
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {slots.map((slot, si) => {
                    const ns = new Date(slot.startDate + "T00:00:00").getTime();
                    const ne = new Date(slot.endDate + "T00:00:00").getTime();
                    const leftPct = Math.max(0, ((ns - range.minMs) / span) * 100);
                    const rightPct = Math.min(100, ((ne - range.minMs) / span) * 100);
                    const widthPct = Math.max(3, rightPct - leftPct);
                    const isFilled = !!slot._assignment;
                    const isDrop = dropTargetId === `${slot.id}_${si}`;
                    const util = Math.round(slot.utilization ?? 100);
                    const proba =
                      slot.probability != null
                        ? slot.probability <= 1
                          ? Math.round(slot.probability * 100)
                          : Math.round(slot.probability)
                        : 100;
                    const isAtRisk = !isFilled && !availableGrades.has(slot._grade);

                    // Bar label: Account - Opp · Util% · P% [· Prénom Nom]
                    const oppShort = slot._oppName.length > 30 ? slot._oppName.slice(0, 28) + "…" : slot._oppName;
                    const parts = [slot._account ? `${slot._account} - ${oppShort}` : oppShort];
                    parts.push(`${util}%`);
                    if (proba < 100) parts.push(`P${proba}%`);
                    if (isFilled) parts.push(slot._assignment!.empName);
                    const barLabel = parts.join(" · ");

                    const tooltipText = [
                      `${slot._grade} · ${slot._account} - ${slot._oppName}`,
                      `${slot.startDate.slice(8, 10)}/${slot.startDate.slice(5, 7)} → ${slot.endDate.slice(8, 10)}/${slot.endDate.slice(5, 7)}`,
                      `Util: ${util}%${proba < 100 ? ` · Proba: ${proba}%` : ""}`,
                      isFilled ? `Assigned: ${slot._assignment!.empName}` : null,
                      isAtRisk ? "⚠ No employee available for this grade" : null,
                    ]
                      .filter(Boolean)
                      .join("\n");

                    return (
                      <Tooltip
                        key={`${slot.id}_${si}`}
                        placement="top"
                        arrow
                        title={<span style={{ whiteSpace: "pre-line" }}>{tooltipText}</span>}
                      >
                        <Box
                          sx={{ position: "relative", height: BAR_H, mb: `${ROW_GAP}px` }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes("application/scenario-employee")) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "copy";
                              setDropTargetId(`${slot.id}_${si}`);
                            }
                          }}
                          onDragLeave={() => setDropTargetId(null)}
                          onDrop={(e) => handleDrop(e, slot)}
                        >
                          <Box
                            onPointerDown={(e) => handleBarPointerDown(e, slot)}
                            onPointerMove={handleBarPointerMove}
                            onPointerUp={handleBarPointerUp}
                            onClick={() => onEditNeed?.(slot)}
                            sx={{
                              position: "absolute",
                              top: 0,
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: "100%",
                              borderRadius: 1.5,
                              bgcolor: isDrop
                                ? alpha("#3b82f6", 0.25)
                                : isFilled
                                  ? alpha(gc.text, 0.65)
                                  : alpha(gc.border, 0.35),
                              border:
                                isAtRisk && !isFilled
                                  ? "1.5px dashed #ef4444"
                                  : isDrop
                                    ? "1.5px solid #3b82f6"
                                    : "none",
                              display: "flex",
                              alignItems: "center",
                              px: 0.75,
                              gap: 0.3,
                              overflow: "hidden",
                              cursor: "grab",
                              "&:active": { cursor: "grabbing" },
                              transition: "filter 0.15s ease, background-color 0.1s ease",
                              "&:hover": { filter: "brightness(1.08)" },
                            }}
                          >
                            {isAtRisk && !isFilled && (
                              <WarningAmberIcon data-no-drag sx={{ fontSize: 10, color: "#ef4444", flexShrink: 0 }} />
                            )}
                            <Typography
                              sx={{
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                color: isFilled ? "#fff" : gc.text,
                                textShadow: isFilled ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
                              }}
                            >
                              {barLabel}
                            </Typography>
                          </Box>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    );
  }
);
NeedsTimeline.displayName = "NeedsTimeline";

export default NeedsTimeline;
