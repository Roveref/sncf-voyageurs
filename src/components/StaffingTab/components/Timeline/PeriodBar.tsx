import React, { memo, useMemo, useCallback, useState, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { MS_PER_DAY, HOURS_PER_DAY, ASSIGNMENT_BAR_HEIGHT } from "../../constants";
// ─── Shared constants ───────────────────────────────────────────────────────
const BAR_H = ASSIGNMENT_BAR_HEIGHT;

// ─── Helper: pixel → column index (gap-aware) ──────────────────────────────
const pxToCol = (clientX: number, rect: DOMRect, numCols: number) => {
  const W = rect.width;
  const slotW = (W + 1) / numCols; // cell + gap slot width
  return Math.max(0, Math.min(Math.floor((clientX - rect.left) / slotW), numCols - 1));
};

// ─── Helper: column → workday date string ──────────────────────────────────
// direction: 'forward' snaps to next workday (for drag start), 'backward' snaps to previous workday (for drag end)
const colToDateStr = (
  col: number,
  dayToCol: number[],
  totalDays: number,
  weekendSet: Set<number>,
  tlStart: Date,
  direction: "forward" | "backward" = "forward"
): string | null => {
  const fmt = (d: number) => {
    const date = new Date(tlStart);
    date.setDate(date.getDate() + d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  // Exact match on a workday
  for (let d = 0; d < totalDays; d++) {
    if (dayToCol[d] === col && !weekendSet.has(d)) return fmt(d);
  }
  // Column is a weekend — snap to nearest workday
  if (direction === "forward") {
    // Find the next workday after this column
    for (let d = 0; d < totalDays; d++) {
      if (dayToCol[d] > col && !weekendSet.has(d)) return fmt(d);
    }
  } else {
    // Find the previous workday before this column
    for (let d = totalDays - 1; d >= 0; d--) {
      if (dayToCol[d] < col && !weekendSet.has(d)) return fmt(d);
    }
  }
  return null;
};

// ─── Level 2: period bar (CSS grid, gap-aligned with HeatmapStrip) ─────────
const PeriodBar = memo(
  ({
    periods,
    color,
    tlStart,
    totalDays,
    numCols,
    dayToCol,
    weekendSet,
    mondayCols,
    onClick,
    jobName,
    barH = BAR_H,
    onDragSelect,
    persistedSelection,
    onSingleClick,
  }: any) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState<{ x: number; y: number; label: string; active: any[] } | null>(null);

    // Drag selection state (refs for performance during mousemove)
    const isDragging = useRef(false);
    const dragStartCol = useRef(-1);
    const [dragRange, setDragRange] = useState<{ startCol: number; endCol: number } | null>(null);

    const rects = useMemo(() => {
      const allRects: { col: number; span: number; prov: boolean }[] = [];
      periods.forEach((period: any) => {
        const pStart = new Date(period.startDate);
        pStart.setHours(0, 0, 0, 0);
        const pEnd = new Date(period.endDate);
        pEnd.setHours(0, 0, 0, 0);
        const s = Math.max(0, Math.round((pStart.getTime() - tlStart.getTime()) / MS_PER_DAY));
        const e = Math.min(totalDays, Math.round((pEnd.getTime() - tlStart.getTime()) / MS_PER_DAY) + 1);
        const prov = period.status === "P";

        // Check if this period includes any weekend day (SAP weekend work)
        let hasWeekendDay = false;
        for (let d = s; d < e; d++) {
          if (weekendSet.has(d)) {
            hasWeekendDay = true;
            break;
          }
        }

        if (hasWeekendDay) {
          // Continuous bar through weekends — don't split at weekend boundaries
          let firstCol = null,
            lastCol = null;
          for (let d = s; d < e; d++) {
            const col = dayToCol[d];
            if (col != null) {
              if (firstCol === null) firstCol = col;
              lastCol = col;
            }
          }
          if (firstCol !== null && lastCol !== null) {
            allRects.push({ col: firstCol, span: lastCol - firstCol + 1, prov });
          }
        } else {
          // Standard: split bar at weekends
          let segStartCol = null;
          for (let d = s; d < e; d++) {
            if (!weekendSet.has(d)) {
              if (segStartCol === null) segStartCol = dayToCol[d];
            } else {
              if (segStartCol !== null) {
                const endCol = dayToCol[d - 1];
                allRects.push({ col: segStartCol, span: endCol - segStartCol + 1, prov });
                segStartCol = null;
              }
            }
          }
          if (segStartCol !== null) {
            let lastWork = e - 1;
            while (lastWork >= s && weekendSet.has(lastWork)) lastWork--;
            if (lastWork >= s) {
              const endCol = dayToCol[lastWork];
              allRects.push({ col: segStartCol, span: endCol - segStartCol + 1, prov });
            }
          }
        }
      });
      return allRects;
    }, [periods, tlStart, totalDays, dayToCol, weekendSet]);

    // Weekend & monday column sets for O(1) lookup
    const weColSet = useMemo(() => {
      const seen = new Set<number>();
      weekendSet.forEach((d: number) => {
        if (d < totalDays) seen.add(dayToCol[d]);
      });
      return seen;
    }, [weekendSet, totalDays, dayToCol]);

    const mondayColSet = useMemo(() => new Set(mondayCols), [mondayCols]);

    // Stable refs for document-level drag listeners
    const onDragSelectRef = useRef(onDragSelect);
    onDragSelectRef.current = onDragSelect;
    const onSingleClickRef = useRef(onSingleClick);
    onSingleClickRef.current = onSingleClick;

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        // During drag, updates are handled by document-level listener
        if (isDragging.current) return;

        // Normal tooltip hover
        const rect = containerRef.current.getBoundingClientRect();
        const colIdx = pxToCol(e.clientX, rect, numCols);
        let dayIdx = -1;
        for (let d = 0; d < totalDays; d++) {
          if (dayToCol[d] === colIdx && !weekendSet.has(d)) {
            dayIdx = d;
            break;
          }
        }
        if (dayIdx < 0) {
          setHovered(null);
          return;
        }
        const date = new Date(tlStart);
        date.setDate(date.getDate() + dayIdx);
        const label = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
        const active: any[] = [];
        periods.forEach((p: any) => {
          const ps = new Date(p.startDate);
          ps.setHours(0, 0, 0, 0);
          const pe = new Date(p.endDate);
          pe.setHours(0, 0, 0, 0);
          const s = Math.round((ps.getTime() - tlStart.getTime()) / MS_PER_DAY);
          const eIdx = Math.round((pe.getTime() - tlStart.getTime()) / MS_PER_DAY) + 1;
          if (dayIdx >= s && dayIdx < eIdx) active.push(p);
        });
        if (active.length > 0) setHovered({ x: e.clientX, y: e.clientY, label, active });
        else setHovered(null);
      },
      [periods, tlStart, totalDays, numCols, dayToCol, weekendSet]
    );

    // ── Drag selection: document-level listeners so drag continues outside PeriodBar ──
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!onDragSelectRef.current || !containerRef.current) return;
        if (e.button !== 0) return;
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        const col = pxToCol(e.clientX, rect, numCols);
        isDragging.current = true;
        dragStartCol.current = col;
        setDragRange({ startCol: col, endCol: col });
        setHovered(null);

        const onDocMouseMove = (moveEvt: MouseEvent) => {
          if (!isDragging.current || !containerRef.current) return;
          const r = containerRef.current.getBoundingClientRect();
          const c = pxToCol(moveEvt.clientX, r, numCols);
          setDragRange({ startCol: dragStartCol.current, endCol: c });
        };

        const onDocMouseUp = (upEvt: MouseEvent) => {
          document.removeEventListener("mousemove", onDocMouseMove);
          document.removeEventListener("mouseup", onDocMouseUp);
          if (!isDragging.current || !containerRef.current) return;
          isDragging.current = false;
          const r = containerRef.current.getBoundingClientRect();
          const endC = pxToCol(upEvt.clientX, r, numCols);
          const minC = Math.min(dragStartCol.current, endC);
          const maxC = Math.max(dragStartCol.current, endC);
          setDragRange(null);
          // Single click (no drag) — fire onSingleClick if available
          if (minC === maxC && onSingleClickRef.current) {
            onSingleClickRef.current();
            return;
          }
          const sd = colToDateStr(minC, dayToCol, totalDays, weekendSet, tlStart, "forward");
          const ed = colToDateStr(maxC, dayToCol, totalDays, weekendSet, tlStart, "backward");
          if (sd && ed && onDragSelectRef.current) {
            onDragSelectRef.current({ start: sd, end: ed }, upEvt);
          }
        };

        document.addEventListener("mousemove", onDocMouseMove);
        document.addEventListener("mouseup", onDocMouseUp);
      },
      [numCols, dayToCol, totalDays, weekendSet, tlStart]
    );

    const handleMouseLeave = useCallback(() => {
      // Don't cancel drag — document listeners handle it
      if (!isDragging.current) setHovered(null);
    }, []);

    // Compute selection overlay columns (active drag)
    const selectionRange = useMemo(() => {
      if (!dragRange) return null;
      const minCol = Math.min(dragRange.startCol, dragRange.endCol);
      const maxCol = Math.max(dragRange.startCol, dragRange.endCol);
      return { startCol: minCol, endCol: maxCol };
    }, [dragRange]);

    // Compute persisted selection overlay (stays after drag ends)
    const persistedRange = useMemo(() => {
      if (!persistedSelection || dragRange) return null; // hide when actively dragging
      const { start, end } = persistedSelection;
      const sDate = new Date(start);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(end);
      eDate.setHours(0, 0, 0, 0);
      const sDay = Math.max(0, Math.round((sDate.getTime() - tlStart.getTime()) / MS_PER_DAY));
      const eDay = Math.min(totalDays - 1, Math.round((eDate.getTime() - tlStart.getTime()) / MS_PER_DAY));
      if (sDay > totalDays || eDay < 0) return null;
      const sCol = dayToCol[sDay] ?? 0;
      const eCol = dayToCol[eDay] ?? numCols - 1;
      return { startCol: Math.min(sCol, eCol), endCol: Math.max(sCol, eCol) };
    }, [persistedSelection, dragRange, tlStart, totalDays, dayToCol, numCols]);

    // Build background cells array
    const bgCells = useMemo(() => {
      const cells: { isWeekend: boolean; isMonday: boolean }[] = [];
      for (let c = 0; c < numCols; c++) {
        cells.push({
          isWeekend: weColSet.has(c),
          isMonday: mondayColSet.has(c),
        });
      }
      return cells;
    }, [numCols, weColSet, mondayColSet]);

    return (
      <Box
        ref={containerRef}
        sx={{ position: "relative" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${numCols}, 1fr)`,
            gap: "1px",
            height: barH,
            cursor: onDragSelect ? "crosshair" : onClick ? "pointer" : "default",
          }}
          onClick={!onDragSelect ? onClick : undefined}
        >
          {/* Background cells — one per column */}
          {bgCells.map((cell, c) => (
            <div
              key={c}
              style={{
                gridColumn: c + 1,
                gridRow: 1,
                height: barH,
                borderRadius: 4,
                backgroundColor: cell.isWeekend ? "#f0f0f0" : "#fafafa",
              }}
            />
          ))}
          {/* Assignment bars — span multiple columns */}
          {rects.map((r, i) => (
            <div
              key={`bar-${i}`}
              style={{
                gridColumn: `${r.col + 1} / ${r.col + r.span + 1}`,
                gridRow: 1,
                height: barH,
                backgroundColor: color,
                opacity: 0.85,
                borderRadius: 4,
                zIndex: 1,
              }}
            />
          ))}
          {/* Persisted selection overlay (stays visible) */}
          {persistedRange && (
            <div
              style={{
                gridColumn: `${persistedRange.startCol + 1} / ${persistedRange.endCol + 2}`,
                gridRow: 1,
                height: barH,
                backgroundColor: "rgba(128, 102, 89, 0.18)",
                boxShadow: "inset 0 0 0 0.5px rgba(128, 102, 89, 0.5)",
                zIndex: 2,
              }}
            />
          )}
          {/* Active drag selection overlay */}
          {selectionRange && (
            <div
              style={{
                gridColumn: `${selectionRange.startCol + 1} / ${selectionRange.endCol + 2}`,
                gridRow: 1,
                height: barH,
                backgroundColor: "rgba(128, 102, 89, 0.25)",
                boxShadow: "inset 0 0 0 0.5px rgba(128, 102, 89, 0.6)",
                zIndex: 3,
              }}
            />
          )}
        </div>

        {/* Tooltip */}
        {hovered && (
          <Box
            sx={{
              position: "fixed",
              left: hovered.x + 10,
              top: hovered.y - 30,
              pointerEvents: "none",
              zIndex: 1500,
              bgcolor: "background.paper",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              boxShadow: 2,
              fontSize: "0.7rem",
              whiteSpace: "nowrap",
            }}
          >
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{hovered.label}</Typography>
            {hovered.active.map((p, i) => (
              <Typography key={i} sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                {jobName || p.jobName || p.jobNo} — {p.utilization}%{p.status === "P" ? " (P)" : ""}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  }
);
PeriodBar.displayName = "PeriodBar";

export { PeriodBar };
