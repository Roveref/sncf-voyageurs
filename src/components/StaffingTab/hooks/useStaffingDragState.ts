import { useState, useCallback, useRef, startTransition } from "react";

/**
 * Manages drag-in-progress state:
 * - groupingLevels for the employee grouping UI
 * - isDraggingRef for suppressing expensive recalculations during timeline drags
 * - dragVersion counter + handleDragComplete to trigger a re-render after drag ends
 */
export function useStaffingDragState() {
  const [groupingLevels, setGroupingLevels] = useState<string[]>([]);
  const isDraggingRef = useRef(false);
  const [, setDragVersion] = useState(0);
  const handleDragComplete = useCallback(() => startTransition(() => setDragVersion((v) => v + 1)), []);

  return { groupingLevels, setGroupingLevels, isDraggingRef, handleDragComplete };
}
