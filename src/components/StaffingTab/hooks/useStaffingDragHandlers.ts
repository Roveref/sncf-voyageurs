import React, { useCallback } from "react";
import { getHoursPerDay } from "../constants";
import type { Employee, WaterfallStep } from "../types";

/** Waterfall hover tooltip data shape */
interface WaterfallHoverData {
  x: number;
  y: number;
  title: string;
  steps: WaterfallStep[];
  grossH: number;
  tu: number;
}

const DRAG_TYPE_TO_GROUPING: Record<string, string> = {
  macroGrade: "grade",
  segmentCode: "team",
  segmentCodeGroup: "team",
  subSegment: "team",
  serviceLine: "team",
  serviceLineGroup: "team",
  serviceOffering: "team",
  macroCategory: "project",
};

interface UseStaffingDragHandlersParams {
  setGanttDragOver: (val: boolean) => void;
  setWaterfallHover: React.Dispatch<React.SetStateAction<WaterfallHoverData | null>>;
  buildWaterfallData: (employees: Employee[]) => WaterfallStep[];
  groupingLevels: string[];
  handleGroupingChange: (levels: string[]) => void;
}

export function useStaffingDragHandlers({
  setGanttDragOver,
  setWaterfallHover,
  buildWaterfallData,
  groupingLevels,
  handleGroupingChange,
}: UseStaffingDragHandlersParams) {
  // ── Waterfall tooltip handlers ───────────────────────────────────────────
  const handleWaterfallEnter = useCallback(
    (e: React.MouseEvent, title: string, employees: Employee[], tu: number) => {
      setWaterfallHover({
        x: e.clientX,
        y: e.clientY,
        title,
        steps: buildWaterfallData(employees),
        grossH: employees.reduce(
          (s: number, emp: Employee) => s + (emp.totalWorkingDaysInPeriod || 0) * getHoursPerDay(emp.grade),
          0
        ),
        tu,
      });
    },
    [buildWaterfallData]
  );

  const handleWaterfallMove = useCallback((e: React.MouseEvent) => {
    setWaterfallHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  }, []);

  const handleWaterfallLeave = useCallback(() => setWaterfallHover(null), []);

  // ── Drag-to-group: drop a sidebar filter on the Gantt to activate grouping ──
  const handleGanttDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    const types = Array.from(e.dataTransfer.types);
    // dataTransfer.types stores keys in lowercase per HTML5 spec
    if (Object.keys(DRAG_TYPE_TO_GROUPING).some((t) => types.includes(t.toLowerCase()))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setGanttDragOver(true);
    }
  }, []);

  const handleGanttDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setGanttDragOver(false);
  }, []);

  const handleGanttDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setGanttDragOver(false);
      let criterion: string | null = null;
      for (const [dragType, groupCriterion] of Object.entries(DRAG_TYPE_TO_GROUPING)) {
        if (e.dataTransfer.getData(dragType)) {
          criterion = groupCriterion;
          break;
        }
      }
      if (!criterion) return;
      if (groupingLevels.includes(criterion)) return; // already active
      const newLevels = [...groupingLevels];
      if (newLevels.length < 3) newLevels.push(criterion);
      handleGroupingChange(newLevels);
    },
    [groupingLevels, handleGroupingChange]
  );

  const handleGroupDragOut = useCallback(
    (criterion: string) => {
      handleGroupingChange(groupingLevels.filter((l) => l !== criterion));
    },
    [groupingLevels, handleGroupingChange]
  );

  return {
    handleWaterfallEnter,
    handleWaterfallMove,
    handleWaterfallLeave,
    handleGanttDragOver,
    handleGanttDragLeave,
    handleGanttDrop,
    handleGroupDragOut,
  };
}
