import { useState, useCallback, useEffect, useRef } from "react";
import useScenarioStore from "../../../stores/useScenarioStore";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useLoadingStore } from "../../../stores/useLoadingStore";
import { useUIStore } from "../../../stores/useUIStore";
import { assignmentKey } from "../utils/scenarioUtils";
import type { Proposal } from "../utils/autoAssign";
import type { EditorState } from "../components/Edit/bulkEditTypes";

interface UseStaffingScenarioPipArgs {
  activeScenario: any;
  editorStates: Record<string, EditorState | null>;
  enrichedGanttData: any[];
}

/**
 * Manages:
 * - PiP multi-board panel (openPipScenarioIds state + open/close callbacks)
 * - Clearing MDS editor states when switching scenarios
 * - NeedsBoard drawer toggle (driven by UIStore)
 * - Staffing Optimizer open/close + handleApplyProposal
 */
export function useStaffingScenarioPip({
  activeScenario,
  editorStates,
  enrichedGanttData,
}: UseStaffingScenarioPipArgs) {
  // ── PiP multi-board ──────────────────────────────────────────────────────
  const [openPipScenarioIds, setOpenPipScenarioIds] = useState<string[]>([]);
  const allScenarios = useScenarioStore((s) => s.scenarios);
  const pipOpen = openPipScenarioIds.length > 0;

  const togglePipForActiveScenario = useCallback(() => {
    const id = activeScenario?.id;
    if (!id) return;
    setOpenPipScenarioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [activeScenario]);

  const openPipForScenario = useCallback((id: string) => {
    setOpenPipScenarioIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closePip = useCallback((id: string) => {
    setOpenPipScenarioIds((prev) => prev.filter((x) => x !== id));
  }, []);

  // ── Clear MDS editor states when switching scenarios ─────────────────────
  const prevScenarioIdRef = useRef(activeScenario?.id ?? null);
  useEffect(() => {
    const currentId = activeScenario?.id ?? null;
    if (prevScenarioIdRef.current !== currentId) {
      prevScenarioIdRef.current = currentId;
      if (Object.keys(editorStates).length > 0) {
        useUserDataStore.getState().setEditorStates({});
      }
    }
  }, [activeScenario?.id, editorStates]);

  // ── NeedsBoard drawer (driven by UIStore so App.tsx FAB can also open it) ──
  const needsBoardOpen = useUIStore((s) => s.staffingNeedsDrawerOpen);
  const toggleNeedsBoard = useCallback(
    () => useUIStore.getState().setStaffingNeedsDrawerOpen(!useUIStore.getState().staffingNeedsDrawerOpen),
    []
  );

  // ── Staffing Optimizer ───────────────────────────────────────────────────
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const handleOpenOptimizer = useCallback(() => setOptimizerOpen(true), []);
  const handleCloseOptimizer = useCallback(() => setOptimizerOpen(false), []);

  const handleApplyProposal = useCallback(
    (proposal: Proposal) => {
      const store = useScenarioStore.getState();
      const now = new Date();
      const name = `${proposal.name} — ${now.toLocaleDateString("fr-FR")} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      const newId = store.createScenario(name, activeScenario?.id || null, proposal.description);

      // Check for double-assignments (same employee assigned to overlapping dates)
      const empDateMap = new Map<string, string[]>();
      for (const a of proposal.assignments) {
        const existing = empDateMap.get(a.empId) || [];
        const overlap = existing.some((range) => {
          const [s, e] = range.split("|");
          return a.startDate <= e && a.endDate >= s;
        });
        if (overlap) {
          useLoadingStore.getState().notify(`Conflict: ${a.empId} assigned on overlapping dates`, "warning");
        }
        empDateMap.set(a.empId, [...existing, `${a.startDate}|${a.endDate}`]);
      }

      // Inject assignment overrides (skip employees no longer in data)
      for (const a of proposal.assignments) {
        const emp = enrichedGanttData.find((e: any) => e.empId === a.empId);
        if (!emp) continue;
        const nameParts = (emp?.name || "").split(" ");
        const key = assignmentKey(a.empId, a.jobNo, a.startDate, a.endDate);
        store.upsertAssignmentOverride(key, {
          type: "create" as const,
          data: {
            empId: a.empId,
            jobNo: a.jobNo,
            startDate: a.startDate,
            endDate: a.endDate,
            utilization: 100,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            needId: a.needId,
          },
        });
      }

      // Activate and open PiP
      store.setActiveScenario(newId);
      setOpenPipScenarioIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
      setOptimizerOpen(false);
    },
    [activeScenario, enrichedGanttData]
  );

  return {
    openPipScenarioIds,
    allScenarios,
    pipOpen,
    togglePipForActiveScenario,
    openPipForScenario,
    closePip,
    needsBoardOpen,
    toggleNeedsBoard,
    optimizerOpen,
    handleOpenOptimizer,
    handleCloseOptimizer,
    handleApplyProposal,
  };
}
