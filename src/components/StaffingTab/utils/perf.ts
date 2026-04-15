/**
 * Performance logger for the gantt timeline — development only.
 *
 * Four measured domains, each in its own console group:
 *
 *   [A] ⚡ Timeline calculations — useTimeline functions (labels, markers…)
 *   [B] 🎨 React rendering      — components via <React.Profiler>
 *   [C] 🖱  Drag & Drop          — pipeline mouseup → state → render → paint
 *   [D] 🗃  Data grid            — buildEmployeeStructures + buildDailyGrid
 *
 * All calls are no-ops in production (NODE_ENV === 'production').
 *
 * ─── Color legend ───────────────────────────────────────────────────
 *   green  < 20 ms   → fast, nothing to do
 *   orange 20–100 ms → worth monitoring
 *   red    > 100 ms  → investigate
 */

export const isDev = false; // disabled — set to `(import.meta as any).env?.DEV ?? true` to re-enable

// ─── Internal types ───────────────────────────────────────────────────────────

interface PerfStep {
  label: string;
  ms: number;
  detail?: string;
}

// ─── Domain A — Timeline calculations ────────────────────────────────────────

let _calcBatch: PerfStep[] | null = null;
let _calcTimer: ReturnType<typeof setTimeout> | null = null;

function flushCalc(): void {
  if (!_calcBatch || _calcBatch.length === 0) {
    _calcBatch = null;
    _calcTimer = null;
    return;
  }
  const batch = _calcBatch;
  _calcBatch = null;
  _calcTimer = null;
  printBatch("[A] ⚡ Timeline calculations", "#7c6af7", batch);
  if (_dragLifecycle) {
    _dragLifecycle.reactRenderEnd = performance.now();
    finishDragLifecycle();
  }
}

/**
 * Records a timeline calculation step (e.g. getTimelineLabels).
 * Called in useTimeline.ts after each useMemo.
 */
export function recordPerfStep(label: string, ms: number, detail?: string): void {
  if (!isDev) return;
  if (!_calcBatch) _calcBatch = [];
  _calcBatch.push({ label, ms, detail });
  if (_calcTimer !== null) clearTimeout(_calcTimer);
  _calcTimer = setTimeout(flushCalc, 0);
  if (_dragLifecycle && !_dragLifecycle.reactRenderStart) {
    _dragLifecycle.reactRenderStart = performance.now();
  }
}

// ─── Domain B — React rendering ──────────────────────────────────────────────

let _renderBatch: PerfStep[] | null = null;
let _renderTimer: ReturnType<typeof setTimeout> | null = null;

function flushRender(): void {
  if (!_renderBatch || _renderBatch.length === 0) {
    _renderBatch = null;
    _renderTimer = null;
    return;
  }
  const batch = _renderBatch;
  _renderBatch = null;
  _renderTimer = null;
  printBatch("[B] 🎨 React rendering", "#29b6f6", batch);
}

/**
 * onRender callback for <React.Profiler>.
 * Pass directly: <Profiler onRender={recordRenderStep}>
 *
 * Shows actual render time vs base time (without memoization)
 * to quantify the benefit of React.memo/useMemo.
 */
export function recordRenderStep(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number
): void {
  if (!isDev) return;
  const label = `${id}  (${phase})`;
  const saved = baseDuration - actualDuration;
  const detail =
    saved > 1
      ? `actual ${actualDuration.toFixed(1)} ms  ·  base ${baseDuration.toFixed(1)} ms  ·  memo saves ${saved.toFixed(1)} ms`
      : undefined;
  if (!_renderBatch) _renderBatch = [];
  _renderBatch.push({ label, ms: actualDuration, detail });
  if (_renderTimer !== null) clearTimeout(_renderTimer);
  _renderTimer = setTimeout(flushRender, 0);
}

// ─── Domain D — Data grid ───────────────────────────────────────────────────

let _gridBatch: PerfStep[] | null = null;
let _gridTimer: ReturnType<typeof setTimeout> | null = null;

function flushGrid(): void {
  if (!_gridBatch || _gridBatch.length === 0) {
    _gridBatch = null;
    _gridTimer = null;
    return;
  }
  const batch = _gridBatch;
  _gridBatch = null;
  _gridTimer = null;
  printBatch("[D] 🗃  Data grid", "#ff9800", batch);
}

/**
 * Records a data grid construction step
 * (buildEmployeeStructures, buildDailyGrid).
 * Called in StaffingTab.tsx after each heavy phase.
 */
export function recordGridStep(label: string, ms: number, detail?: string): void {
  if (!isDev) return;
  if (!_gridBatch) _gridBatch = [];
  _gridBatch.push({ label, ms, detail });
  if (_gridTimer !== null) clearTimeout(_gridTimer);
  _gridTimer = setTimeout(flushGrid, 0);
}

// ─── Console rendering utility ──────────────────────────────────────────────

function printBatch(title: string, color: string, batch: PerfStep[]): void {
  const total = batch.reduce((s, x) => s + x.ms, 0);
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c${title}%c  ${total.toFixed(1)} ms`,
    `color:${color};font-weight:bold`,
    "color:#888;font-weight:normal"
  );
  batch.forEach(({ label, ms, detail }) => {
    const bar = buildBar(ms, total);
    const msColor = ms > 100 ? "color:#ef5350;font-weight:bold" : ms > 20 ? "color:#ffa726" : "color:#66bb6a";
    if (detail) {
      // eslint-disable-next-line no-console
      console.log(
        `  %c${label.padEnd(40)}%c ${ms.toFixed(2).padStart(7)} ms  ${bar}\n    %c↳ ${detail}`,
        "color:#888",
        msColor,
        "color:#555;font-size:11px"
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`  %c${label.padEnd(40)}%c ${ms.toFixed(2).padStart(7)} ms  ${bar}`, "color:#888", msColor);
    }
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

function buildBar(ms: number, total: number): string {
  if (total === 0) return "";
  const pct = ms / total;
  const filled = Math.max(0, Math.min(20, Math.round(pct * 20)));
  return `[${"█".repeat(filled)}${"░".repeat(20 - filled)}] ${(pct * 100).toFixed(0).padStart(3)}%`;
}

// ─── Domain C — Drag & Drop ─────────────────────────────────────────────────
//
// Measures the full pipeline: mouseup → state → render React → DOM commit → paint
//
// Example console output:
//
//   🖱  Drag & Drop — mouseup → paint : 48 ms
//   ──────────────────────────────────────────
//     mouseup → state queued              0.3 ms  [░░░...]   1%
//     state queued → React render start   0.8 ms  [░░░...]   2%
//     React render pipeline              14.2 ms  [██████...]  30%
//     React commit → DOM (RAF)           18.5 ms  [███████...]  39%
//     DOM → paint (RAF+1)                14.2 ms  [█████...]   30%
//   ──────────────────────────────────────────
//     TOTAL                              48.0 ms

interface DragLifecycle {
  mouseUpTime: number;
  stateCommitTime: number;
  reactRenderStart?: number;
  reactRenderEnd?: number;
}

let _dragLifecycle: DragLifecycle | null = null;

/** Call at the START of handleMouseUp, before any calculation. */
export function markDragMouseUp(): void {
  if (!isDev) return;
  _dragLifecycle = { mouseUpTime: performance.now(), stateCommitTime: 0 };
}

/** Call AFTER setCustomDateRangeDirect() (state queued). */
export function markDragStateCommit(): void {
  if (!isDev || !_dragLifecycle) return;
  _dragLifecycle.stateCommitTime = performance.now();
}

function finishDragLifecycle(): void {
  const lc = _dragLifecycle;
  if (!lc) return;
  _dragLifecycle = null;
  requestAnimationFrame(() => {
    const commitTime = performance.now();
    requestAnimationFrame(() => {
      printDragLifecycle(lc, commitTime, performance.now());
    });
  });
}

function printDragLifecycle(lc: DragLifecycle, commitTime: number, paintTime: number): void {
  const phases = [
    { label: "mouseup → state queued", ms: lc.stateCommitTime - lc.mouseUpTime },
    {
      label: "state queued → React render start",
      ms: (lc.reactRenderStart || lc.stateCommitTime) - lc.stateCommitTime,
    },
    {
      label: "React render pipeline",
      ms: (lc.reactRenderEnd || commitTime) - (lc.reactRenderStart || lc.stateCommitTime),
    },
    { label: "React commit → DOM (RAF)", ms: commitTime - (lc.reactRenderEnd || commitTime) },
    { label: "DOM → paint (RAF+1)", ms: paintTime - commitTime },
  ];
  const total = paintTime - lc.mouseUpTime;

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[C] 🖱  Drag & Drop%c  mouseup → paint : ${total.toFixed(0)} ms`,
    "color:#ef5350;font-weight:bold",
    "color:#888;font-weight:normal"
  );
  phases.forEach(({ label, ms }) => {
    // eslint-disable-next-line no-console
    console.log(
      `  %c${label.padEnd(42)}%c ${ms.toFixed(1).padStart(8)} ms  ${buildBar(ms, total)}`,
      "color:#888",
      ms > 500 ? "color:#ef5350;font-weight:bold" : ms > 100 ? "color:#ffa726" : "color:#66bb6a"
    );
  });
  // eslint-disable-next-line no-console
  console.log("%c  ──────────────────────────────────────────────────", "color:#444");
  // eslint-disable-next-line no-console
  console.log(
    `  %c${"TOTAL".padEnd(42)}%c ${total.toFixed(1).padStart(8)} ms`,
    "color:#aaa;font-weight:bold",
    "color:#ef5350;font-weight:bold"
  );
  // eslint-disable-next-line no-console
  console.groupEnd();
}
