import { useCallback, useRef, useEffect, useMemo, type MutableRefObject } from "react";
import { formatLocalDate } from "../utils/dateUtils";
import { MS_PER_DAY, SNAP_DAYS } from "../constants";
import { markDragMouseUp, markDragStateCommit } from "../utils/perf";

/**
 * Custom hook for timeline interaction: drag-to-pan, Alt+wheel zoom,
 * and magnetic snap.
 */
export const useTimelineInteractions = (
  timelineStart: Date,
  timelineEnd: Date,
  setCustomDateRangeDirect: (startDateStr: string, endDateStr: string) => void,
  filteredEmployees: any[],
  isDraggingRef: MutableRefObject<boolean>,
  onDragComplete: () => void
) => {
  // ── Period boundaries for magnetic snap ─────────────────────────────────
  const periodBoundaries = useMemo((): Date[] => {
    const dates = new Set<string>();
    for (const emp of filteredEmployees) {
      if (!emp.assignments) continue;
      for (const a of emp.assignments) {
        if (a.startDate) dates.add(formatLocalDate(new Date(a.startDate)));
        if (a.endDate) {
          const end = new Date(a.endDate);
          dates.add(formatLocalDate(end));
          const next = new Date(end);
          next.setDate(next.getDate() + 1);
          dates.add(formatLocalDate(next));
        }
      }
    }
    return [...dates].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  }, [filteredEmployees]);

  const periodBoundariesRef = useRef(periodBoundaries);
  periodBoundariesRef.current = periodBoundaries;

  // ── Snap helper ─────────────────────────────────────────────────────────
  const snapToNearest = useCallback((target: Date, boundaries: Date[], snapDays: number): Date => {
    let best: Date | null = null,
      bestDiff = Infinity;
    for (const bd of boundaries) {
      const diff = Math.abs(Math.round((bd.getTime() - target.getTime()) / MS_PER_DAY));
      if (diff > 0 && diff <= snapDays && diff < bestDiff) {
        best = bd;
        bestDiff = diff;
      }
    }
    return best || target;
  }, []);

  // ── Month-bar drag-to-pan ──────────────────────────────────────────────
  // Live updates: on mousemove we call setCustomDateRangeDirect (throttled via
  // rAF) so month headers and heatmap strips update in real-time during drag.
  // Only fires when the rounded-day delta actually changes (avoids sub-day
  // recalculations).  No magnetic snap on mouseup — live position is precise.
  const handleMonthBarMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX;
      const origStart = new Date(timelineStart);
      const origEnd = new Date(timelineEnd);
      const totalDays = Math.round((origEnd.getTime() - origStart.getTime()) / MS_PER_DAY);
      const daysPerPixel = totalDays / rect.width;
      const fmt = formatLocalDate;
      let lastDeltaDays = 0;
      let committedDeltaDays = 0; // last value actually sent to React
      let rafId = 0;

      document.body.style.cursor = "grabbing";
      isDraggingRef.current = true;

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startX;
        lastDeltaDays = Math.round(-deltaX * daysPerPixel);
        // Throttle via rAF and skip if the day-level delta hasn't changed
        if (!rafId && lastDeltaDays !== committedDeltaDays) {
          rafId = requestAnimationFrame(() => {
            rafId = 0;
            if (lastDeltaDays !== committedDeltaDays) {
              committedDeltaDays = lastDeltaDays;
              const ms = lastDeltaDays * MS_PER_DAY;
              setCustomDateRangeDirect(fmt(new Date(origStart.getTime() + ms)), fmt(new Date(origEnd.getTime() + ms)));
            }
          });
        }
      };

      const cleanup = (): void => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.cursor = "";
      };

      const handleMouseUp = (): void => {
        markDragMouseUp();
        cleanup();
        isDraggingRef.current = false;
        if (lastDeltaDays === 0) return;
        const ms = lastDeltaDays * MS_PER_DAY;
        setCustomDateRangeDirect(fmt(new Date(origStart.getTime() + ms)), fmt(new Date(origEnd.getTime() + ms)));
        // Force a render so useFrozenWhileDragging releases frozen values.
        // setCustomDateRangeDirect uses ref-equality bail-out and may skip
        // the setState when the rAF already committed the same dates, so
        // onDragComplete guarantees at least one render with isDraggingRef=false.
        onDragComplete();
        markDragStateCommit();
      };
      const handleKeyDown = (keyEvent: KeyboardEvent): void => {
        if (keyEvent.key === "Escape") {
          cleanup();
          isDraggingRef.current = false;
          setCustomDateRangeDirect(fmt(origStart), fmt(origEnd));
          onDragComplete();
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("keydown", handleKeyDown);
    },
    [timelineStart, timelineEnd, setCustomDateRangeDirect, onDragComplete]
  );

  // ── Alt+wheel zoom ─────────────────────────────────────────────────────
  const handleTimelineWheel = useCallback(
    (e: WheelEvent): void => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();

      const fmt = formatLocalDate;
      const start = new Date(timelineStart);
      const end = new Date(timelineEnd);

      if (e.deltaY < 0) {
        const newEnd = new Date(end);
        newEnd.setMonth(newEnd.getMonth() - 1);
        const minEnd = new Date(start);
        minEnd.setMonth(minEnd.getMonth() + 1);
        if (newEnd <= minEnd) return;
        setCustomDateRangeDirect(fmt(start), fmt(snapToNearest(newEnd, periodBoundaries, SNAP_DAYS)));
      } else if (e.deltaY > 0) {
        const newEnd = new Date(end);
        newEnd.setMonth(newEnd.getMonth() + 1);
        setCustomDateRangeDirect(fmt(start), fmt(snapToNearest(newEnd, periodBoundaries, SNAP_DAYS)));
      }
    },
    [timelineStart, timelineEnd, setCustomDateRangeDirect, periodBoundaries, snapToNearest]
  );

  // ── Gantt ref with passive:false wheel listener ─────────────────────────
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const handleTimelineWheelRef = useRef<(e: WheelEvent) => void>(handleTimelineWheel);
  handleTimelineWheelRef.current = handleTimelineWheel;

  const ganttRefCallback = useCallback((node: HTMLDivElement | null): void => {
    if (ganttRef.current) {
      const prev = ganttRef.current as HTMLDivElement & { __wheelHandler?: EventListener };
      prev.__wheelHandler && ganttRef.current.removeEventListener("wheel", prev.__wheelHandler);
    }
    ganttRef.current = node;
    if (node) {
      const handler = (e: Event): void => handleTimelineWheelRef.current(e as WheelEvent);
      (node as HTMLDivElement & { __wheelHandler?: EventListener }).__wheelHandler = handler;
      node.addEventListener("wheel", handler, { passive: false });
    }
  }, []);

  // ── Alt key body class toggle ──────────────────────────────────────────
  useEffect(() => {
    const sync = (e: KeyboardEvent | MouseEvent): void => {
      document.body.classList.toggle("alt-pressed", e.altKey);
    };
    const onBlur = (): void => document.body.classList.remove("alt-pressed");
    window.addEventListener("keydown", sync, true);
    window.addEventListener("keyup", sync, true);
    window.addEventListener("mousemove", sync, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", sync, true);
      window.removeEventListener("keyup", sync, true);
      window.removeEventListener("mousemove", sync, true);
      window.removeEventListener("blur", onBlur);
      document.body.classList.remove("alt-pressed");
    };
  }, []);

  return {
    handleMonthBarMouseDown,
    ganttRefCallback,
    periodBoundaries,
  };
};
