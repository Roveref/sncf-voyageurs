import { useState, useCallback, useRef, useEffect } from "react";

interface HeatmapCell {
  startDate: Date;
  endDate: Date;
  isWeekend?: boolean;
  [key: string]: any;
}

interface DragState {
  startIdx: number;
  currentIdx: number;
}

interface SelectionDates {
  startDate: Date;
  endDate: Date;
}

interface UseHeatmapDragSelectOptions {
  cells: HeatmapCell[];
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  onSelectionDatesChange?: (dates: SelectionDates | null) => void;
}

interface SelectionRange {
  minIdx: number;
  maxIdx: number;
}

/**
 * Custom hook for drag-to-select on heatmap cells.
 * Click on a cell + drag to another to select a date range.
 */
export const useHeatmapDragSelect = ({
  cells,
  onDateRangeSelect,
  onSelectionDatesChange,
}: UseHeatmapDragSelectOptions): {
  selectionRange: SelectionRange | null;
  handleCellMouseDown: (e: React.MouseEvent) => void;
} => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragRafRef = useRef<number | null>(null);

  // Cleanup RAF on unmount
  useEffect(
    () => () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    },
    []
  );

  const selectionRange = dragState
    ? {
        minIdx: Math.min(dragState.startIdx, dragState.currentIdx),
        maxIdx: Math.max(dragState.startIdx, dragState.currentIdx),
      }
    : null;

  // Compute date range from cell indices and broadcast
  const broadcastDates = useCallback(
    (state: DragState | null): void => {
      if (!onSelectionDatesChange || !cells || !state) {
        onSelectionDatesChange?.(null);
        return;
      }
      const minIdx = Math.min(state.startIdx, state.currentIdx);
      const maxIdx = Math.max(state.startIdx, state.currentIdx);
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      for (let j = minIdx; j <= maxIdx; j++) {
        if (cells[j] && !cells[j].isWeekend) {
          if (!startDate) startDate = cells[j].startDate;
          endDate = cells[j].endDate;
        }
      }
      if (startDate && endDate) {
        onSelectionDatesChange({ startDate, endDate });
      }
    },
    [cells, onSelectionDatesChange]
  );

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      const el = (e.target as HTMLElement).closest("[data-idx]");
      const idx = (el as HTMLElement)?.dataset?.idx;
      if (idx === undefined) return;
      const i = +idx;
      if (cells && cells[i]?.isWeekend) return;

      e.preventDefault();
      const state = { startIdx: i, currentIdx: i };
      setDragState(state);
      dragRef.current = state;
      broadcastDates(state);

      // Find the timeline container boundary for cancel-on-leave
      const timelineContainer = (e.target as HTMLElement).closest("[data-timeline-container]");

      // Snapshot cell positions once at drag start (avoids elementFromPoint per frame)
      const cellPositions: Array<{ left: number; right: number }> = [];
      const stripEl = (e.target as HTMLElement).closest("[data-idx]")?.parentElement;
      if (stripEl) {
        const cellEls = stripEl.querySelectorAll("[data-idx]");
        cellEls.forEach((el) => {
          const rect = el.getBoundingClientRect();
          cellPositions[+(el as HTMLElement).dataset.idx!] = { left: rect.left, right: rect.right };
        });
      }

      const findCellIdxFromX = (clientX: number): number | undefined => {
        for (let j = 0; j < cellPositions.length; j++) {
          const pos = cellPositions[j];
          if (pos && clientX >= pos.left && clientX < pos.right) return j;
        }
        return undefined;
      };

      const cancel = (): void => {
        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        cleanup();
        setDragState(null);
        dragRef.current = null;
        onSelectionDatesChange?.(null);
      };

      const handleDocMouseMove = (moveEvent: MouseEvent): void => {
        // Cancel if cursor left the timeline container (immediate, not deferred)
        if (timelineContainer) {
          const rect = timelineContainer.getBoundingClientRect();
          if (
            moveEvent.clientX < rect.left ||
            moveEvent.clientX > rect.right ||
            moveEvent.clientY < rect.top ||
            moveEvent.clientY > rect.bottom
          ) {
            cancel();
            return;
          }
        }

        // RAF-throttle index lookup from snapshotted positions (no DOM query per frame)
        const cx = moveEvent.clientX;
        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          const cellIdx = findCellIdxFromX(cx);
          if (cellIdx !== undefined) {
            const newState: DragState = { ...dragRef.current!, currentIdx: cellIdx };
            dragRef.current = newState;
            setDragState(newState);
            broadcastDates(newState);
          }
        });
      };

      const cleanup = (): void => {
        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        document.removeEventListener("mousemove", handleDocMouseMove);
        document.removeEventListener("mouseup", handleDocMouseUp);
        document.removeEventListener("keydown", handleKeyDown);
      };

      const handleDocMouseUp = (): void => {
        cleanup();
        const finalState = dragRef.current;
        if (finalState && cells && onDateRangeSelect) {
          const minIdx = Math.min(finalState.startIdx, finalState.currentIdx);
          const maxIdx = Math.max(finalState.startIdx, finalState.currentIdx);
          let startDate: Date | null = null;
          let endDate: Date | null = null;
          for (let j = minIdx; j <= maxIdx; j++) {
            if (cells[j] && !cells[j].isWeekend) {
              if (!startDate) startDate = cells[j].startDate;
              endDate = cells[j].endDate;
            }
          }
          if (startDate && endDate) {
            onDateRangeSelect(startDate, endDate);
          }
        }
        setDragState(null);
        dragRef.current = null;
        onSelectionDatesChange?.(null);
      };

      const handleKeyDown = (keyEvent: KeyboardEvent): void => {
        if (keyEvent.key === "Escape") {
          cancel();
        }
      };

      document.addEventListener("mousemove", handleDocMouseMove);
      document.addEventListener("mouseup", handleDocMouseUp);
      document.addEventListener("keydown", handleKeyDown);
    },
    [cells, onDateRangeSelect, onSelectionDatesChange, broadcastDates]
  );

  return { selectionRange, handleCellMouseDown };
};
