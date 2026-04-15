/**
 * Synthetic benchmark suite for the gantt timeline.
 *
 * Trigger from the browser console:
 *   __ganttPerf()              → all domains
 *   __ganttPerf('A')           → [A] Timeline calculations only
 *   __ganttPerf('B')           → [B] React rendering (instructions)
 *   __ganttPerf('C')           → [C] Drag & Drop only
 *   __ganttPerf('D')           → [D] Data grid only
 *
 * Benchmarks use realistic synthetic data.
 * Real-world measurements appear automatically in the
 * console on each interaction thanks to perf.ts.
 */

import {
  getTimelineRange,
  getTimelineLabels,
  getMonthLabels,
  getWeekendMarkers,
  getHolidayMarkers,
  calculateBarPosition,
} from "./timelineUtils";
import { buildEmployeeStructures, computeTimelineMetrics } from "./dataProcessing";
import { JOB_CATEGORIES, TIMEFRAME_OPTIONS, MS_PER_DAY, SNAP_DAYS } from "../constants";
import type { StaffingRecord } from "../types";
import { isDev } from "./perf";

// ─── Measurement helpers ────────────────────────────────────────────────────────

/** Executes fn once (JIT warmup) then N times, returns the average. */
function avg(fn: () => void, runs = 5): number {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - t0) / runs;
}

// ─── Synthetic data ─────────────────────────────────────────────────────

const CATS = [
  JOB_CATEGORIES.CHARGEABLE,
  JOB_CATEGORIES.GENERAL_OPPTY,
  JOB_CATEGORIES.TRAINING,
  JOB_CATEGORIES.VACATION,
  JOB_CATEGORIES.MEETING,
];

function dateStr(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function syntheticPeriods(n: number, base: Date, totalDays: number) {
  const seg = Math.max(1, Math.floor(totalDays / n));
  return Array.from({ length: n }, (_, i) => {
    const ps = new Date(base);
    ps.setDate(ps.getDate() + i * seg);
    ps.setHours(0, 0, 0, 0);
    const pe = new Date(ps);
    pe.setDate(pe.getDate() + Math.min(seg - 1, 30));
    pe.setHours(0, 0, 0, 0);
    return { start: ps.getTime(), end: pe.getTime(), util: 50 + ((i * 10) % 50), category: CATS[i % CATS.length] };
  });
}

function syntheticRecords(numEmp: number, asgn: number, base: Date, totalDays: number) {
  const seg = Math.max(1, Math.floor(totalDays / asgn));
  const out: StaffingRecord[] = [];
  for (let e = 0; e < numEmp; e++) {
    const empId = `EMP${String(e).padStart(4, "0")}`;
    for (let a = 0; a < asgn; a++) {
      const start = dateStr(base, a * seg);
      const end = dateStr(base, a * seg + Math.min(seg - 1, 30));
      out.push({
        empId,
        firstName: `F${e}`,
        lastName: `L${e}`,
        startDate: start,
        endDate: end,
        startDateParsed: start,
        endDateParsed: end,
        utilization: 50 + ((a * 10) % 50),
        category: CATS[a % CATS.length],
        jobName: `Projet-${empId}-${a}`,
        jobNo: `JN-${empId}-${a}`,
        status: "C",
      });
    }
  }
  return out;
}

// ─── Common periods ────────────────────────────────────────────────────────

const Q_START = new Date("2025-01-01");
const Q_END = new Date("2025-10-01"); // ~273 days (QUARTER)
const Q_DAYS = Math.round((Q_END.getTime() - Q_START.getTime()) / MS_PER_DAY);

const M_START = new Date("2025-01-01");
const M_END = new Date("2025-04-01"); //  ~90 days (MONTH)

const W_START = new Date("2025-01-01");
const W_END = new Date("2025-01-29"); //  ~28 days (WEEK)

const L_START = new Date("2024-01-01");
const L_END = new Date("2026-01-01"); // ~730 days (2 years)

const FR_HOLIDAYS = new Set([
  "2025-01-01",
  "2025-04-21",
  "2025-05-01",
  "2025-05-08",
  "2025-05-29",
  "2025-06-09",
  "2025-07-14",
  "2025-08-15",
  "2025-11-01",
  "2025-11-11",
  "2025-12-25",
]);

// ─── Console formatting ────────────────────────────────────────────────────────

interface BenchResult {
  label: string;
  ms: number;
  threshold: number;
  detail?: string;
}

function status(ms: number, threshold: number): string {
  if (ms > threshold) return "❌";
  if (ms > threshold * 0.7) return "⚠️";
  return "✅";
}

function printDomain(tag: string, icon: string, color: string, results: BenchResult[]): void {
  const worst = Math.max(...results.map((r) => r.ms));
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[${tag}] ${icon}%c  ${results.length} measurements  ·  worst: ${worst.toFixed(1)} ms`,
    `color:${color};font-weight:bold`,
    "color:#888"
  );
  results.forEach(({ label, ms, threshold, detail }) => {
    const icon = status(ms, threshold);
    // eslint-disable-next-line no-console
    console.log(
      `  ${icon}  %c${label.padEnd(46)}%c ${ms.toFixed(2).padStart(7)} ms  %c(threshold ${threshold} ms)${detail ? "  · " + detail : ""}`,
      "color:#ccc",
      ms > threshold ? "color:#ef5350;font-weight:bold" : ms > threshold * 0.7 ? "color:#ffa726" : "color:#66bb6a",
      "color:#555;font-size:11px"
    );
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

// ─── Suite [A] — Timeline calculations ────────────────────────────────────────────

function benchA(): BenchResult[] {
  return [
    {
      label: "getTimelineLabels  WEEK   (28 j)",
      ms: avg(() => getTimelineLabels(TIMEFRAME_OPTIONS.WEEK, W_START, W_END)),
      threshold: 2,
    },
    {
      label: "getTimelineLabels  MONTH  (90 j)",
      ms: avg(() => getTimelineLabels(TIMEFRAME_OPTIONS.MONTH, M_START, M_END)),
      threshold: 2,
    },
    {
      label: "getTimelineLabels  QRTR  (273 j)",
      ms: avg(() => getTimelineLabels(TIMEFRAME_OPTIONS.QUARTER, Q_START, Q_END)),
      threshold: 3,
    },
    {
      label: "getTimelineLabels  2 YRS (730 j)",
      ms: avg(() => getTimelineLabels(TIMEFRAME_OPTIONS.QUARTER, L_START, L_END)),
      threshold: 5,
    },
    {
      label: "getMonthLabels     QRTR   (9 months)",
      ms: avg(() => getMonthLabels(Q_START, Q_END, TIMEFRAME_OPTIONS.QUARTER)),
      threshold: 3,
    },
    {
      label: "getMonthLabels     2 YRS (24 months)",
      ms: avg(() => getMonthLabels(L_START, L_END, TIMEFRAME_OPTIONS.QUARTER)),
      threshold: 5,
    },
    { label: "getWeekendMarkers  QRTR  (273 j)", ms: avg(() => getWeekendMarkers(Q_START, Q_END)), threshold: 5 },
    { label: "getWeekendMarkers  2 YRS (730 j)", ms: avg(() => getWeekendMarkers(L_START, L_END)), threshold: 15 },
    {
      label: "getHolidayMarkers  QRTR  11 holidays",
      ms: avg(() => getHolidayMarkers(Q_START, Q_END, (d) => FR_HOLIDAYS.has(d))),
      threshold: 10,
    },
    {
      label: "getHolidayMarkers  2 YRS 22 holidays",
      ms: avg(() => getHolidayMarkers(L_START, L_END, (d) => FR_HOLIDAYS.has(d))),
      threshold: 20,
    },
    {
      label: "getTimelineRange   preset QUARTER",
      ms: avg(() => getTimelineRange(TIMEFRAME_OPTIONS.QUARTER, { enabled: false, startDate: "", endDate: "" })),
      threshold: 1,
    },
    {
      label: "calculateBarPos  × 500   (100 emp)",
      ms: avg(() => {
        const p = syntheticPeriods(20, Q_START, Q_DAYS);
        for (let i = 0; i < 500; i++) {
          const s = p[i % p.length];
          calculateBarPosition(
            new Date(s.start).toISOString().split("T")[0],
            new Date(s.end).toISOString().split("T")[0],
            Q_START,
            Q_END
          );
        }
      }),
      threshold: 5,
    },
    {
      label: "calculateBarPos  × 2000  (200 emp)",
      ms: avg(() => {
        const p = syntheticPeriods(20, Q_START, Q_DAYS);
        for (let i = 0; i < 2000; i++) {
          const s = p[i % p.length];
          calculateBarPosition(
            new Date(s.start).toISOString().split("T")[0],
            new Date(s.end).toISOString().split("T")[0],
            Q_START,
            Q_END
          );
        }
      }),
      threshold: 20,
    },
    {
      label: "Full cycle  QRTR (range+labels+months+WE+holidays)",
      ms: avg(() => {
        getTimelineRange(TIMEFRAME_OPTIONS.QUARTER, { enabled: false, startDate: "", endDate: "" });
        getTimelineLabels(TIMEFRAME_OPTIONS.QUARTER, Q_START, Q_END);
        getMonthLabels(Q_START, Q_END, TIMEFRAME_OPTIONS.QUARTER);
        getWeekendMarkers(Q_START, Q_END);
        getHolidayMarkers(Q_START, Q_END, (d) => FR_HOLIDAYS.has(d));
      }),
      threshold: 20,
      detail: "full useTimeline pipeline",
    },
    {
      label: "Full cycle  2 YRS (range+labels+months+WE+holidays)",
      ms: avg(() => {
        getTimelineRange(TIMEFRAME_OPTIONS.QUARTER, { enabled: false, startDate: "", endDate: "" });
        getTimelineLabels(TIMEFRAME_OPTIONS.QUARTER, L_START, L_END);
        getMonthLabels(L_START, L_END, TIMEFRAME_OPTIONS.QUARTER);
        getWeekendMarkers(L_START, L_END);
        getHolidayMarkers(L_START, L_END, (d) => FR_HOLIDAYS.has(d));
      }),
      threshold: 40,
    },
  ];
}

// ─── Suite [C] — Drag & Drop ─────────────────────────────────────────────────

function makeFakeEmployees(numEmp: number, asgn: number) {
  return Array.from({ length: numEmp }, (_, e) => ({
    assignments: Array.from({ length: asgn }, (_, a) => ({
      startDate: dateStr(Q_START, e * 3 + a * 14),
      endDate: dateStr(Q_START, e * 3 + a * 14 + 13),
    })),
  }));
}

function extractBoundaries(employees: ReturnType<typeof makeFakeEmployees>): Date[] {
  const dates = new Set<string>();
  for (const emp of employees) {
    for (const a of emp.assignments) {
      if (a.startDate) dates.add(a.startDate);
      if (a.endDate) {
        dates.add(a.endDate);
        const next = new Date(a.endDate);
        next.setDate(next.getDate() + 1);
        dates.add(next.toISOString().split("T")[0]);
      }
    }
  }
  return [...dates].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
}

function snapToNearest(target: Date, boundaries: Date[], snapDays: number): Date {
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
}

function benchC(): BenchResult[] {
  const emp50x5 = makeFakeEmployees(50, 5);
  const emp200x10 = makeFakeEmployees(200, 10);
  const b50 = extractBoundaries(emp50x5);
  const b200 = extractBoundaries(emp200x10);
  const targets = Array.from({ length: 1000 }, (_, i) => {
    const d = new Date(Q_START);
    d.setDate(d.getDate() + (i % Q_DAYS));
    return d;
  });

  const panMs = (() => {
    let offset = 0;
    const t0 = performance.now();
    for (let frame = 0; frame < 60; frame++) {
      offset += 2;
      const ps = new Date(Q_START.getTime() + offset * MS_PER_DAY);
      const pe = new Date(Q_END.getTime() + offset * MS_PER_DAY);
      getTimelineLabels(TIMEFRAME_OPTIONS.QUARTER, ps, pe);
      getMonthLabels(ps, pe, TIMEFRAME_OPTIONS.QUARTER);
      getWeekendMarkers(ps, pe);
    }
    return performance.now() - t0;
  })();

  return [
    {
      label: "periodBoundaries   50 emp × 5 missions",
      ms: avg(() => extractBoundaries(emp50x5)),
      threshold: 5,
      detail: `${b50.length} boundaries`,
    },
    {
      label: "periodBoundaries  200 emp × 10 missions",
      ms: avg(() => extractBoundaries(emp200x10)),
      threshold: 20,
      detail: `${b200.length} boundaries`,
    },
    {
      label: `snapToNearest  × 1000  (${b50.length} boundaries)`,
      ms: avg(() => {
        for (const t of targets) snapToNearest(t, b50, SNAP_DAYS);
      }),
      threshold: 5,
    },
    {
      label: `snapToNearest  × 1000  (${b200.length} boundaries)`,
      ms: avg(() => {
        for (const t of targets) snapToNearest(t, b200, SNAP_DAYS);
      }),
      threshold: 15,
    },
    {
      label: "Pan simulation   60 frames × recalc header",
      ms: panMs,
      threshold: 200,
      detail: `${(panMs / 60).toFixed(1)} ms/frame`,
    },
  ];
}

// ─── Suite [D] — Data grid ───────────────────────────────────────────

function benchD(): BenchResult[] {
  const r50x5 = syntheticRecords(50, 5, Q_START, Q_DAYS);
  const r200x5 = syntheticRecords(200, 5, Q_START, Q_DAYS);
  const r200x10 = syntheticRecords(200, 10, Q_START, Q_DAYS);
  const e50x5 = buildEmployeeStructures(r50x5, []);
  const e200x5 = buildEmployeeStructures(r200x5, []);

  return [
    {
      label: "buildEmployeeStructures   50 emp × 5 missions",
      ms: avg(() => buildEmployeeStructures(r50x5, [])),
      threshold: 50,
    },
    {
      label: "buildEmployeeStructures  200 emp × 5 missions",
      ms: avg(() => buildEmployeeStructures(r200x5, [])),
      threshold: 200,
    },
    {
      label: "buildEmployeeStructures  200 emp × 10 missions",
      ms: avg(() => buildEmployeeStructures(r200x10, [])),
      threshold: 400,
    },
    {
      label: "computeTimelineMetrics    50 emp  QRTR (273 j)",
      ms: avg(() => computeTimelineMetrics(e50x5, [], Q_START, Q_END)),
      threshold: 100,
    },
    {
      label: "computeTimelineMetrics   200 emp  QRTR (273 j)",
      ms: avg(() => computeTimelineMetrics(e200x5, [], Q_START, Q_END)),
      threshold: 500,
    },
    {
      label: "computeTimelineMetrics    50 emp  WEEK  (28 j)",
      ms: avg(() => computeTimelineMetrics(e50x5, [], W_START, W_END)),
      threshold: 20,
    },
    {
      label: "computeTimelineMetrics    50 emp  2 YRS (730 j)",
      ms: avg(() => computeTimelineMetrics(e50x5, [], L_START, L_END)),
      threshold: 300,
    },
    {
      label: "5 sequential pans × 200 emp  (2 wk/pan)",
      ms: (() => {
        const t0 = performance.now();
        for (let step = 0; step < 5; step++) {
          const shift = step * 14 * MS_PER_DAY;
          computeTimelineMetrics(e200x5, [], new Date(Q_START.getTime() + shift), new Date(Q_END.getTime() + shift));
        }
        return performance.now() - t0;
      })(),
      threshold: 2000,
      detail: "simulates a fast scroll",
    },
    {
      label: "Zoom QRTR vs WEEK — expected speedup",
      ms: (() => {
        const full = avg(() => computeTimelineMetrics(e50x5, [], Q_START, Q_END));
        const zoom = avg(() => computeTimelineMetrics(e50x5, [], W_START, W_END));
        // eslint-disable-next-line no-console
        console.log(
          `    %cQUARTER : ${full.toFixed(2)} ms  ·  WEEK : ${zoom.toFixed(2)} ms  ·  gain : ${(full / Math.max(zoom, 0.01)).toFixed(1)}×`,
          "color:#888;font-size:11px"
        );
        return zoom;
      })(),
      threshold: 20,
      detail: "zoom in = shorter window = fewer days to compute",
    },
  ];
}

// ─── Entry point ───────────────────────────────────────────────────────────

export function runGanttBenchmarks(domain?: string): void {
  if (!isDev) {
    // eslint-disable-next-line no-console
    console.warn("[ganttPerf] Benchmarks disabled in production.");
    return;
  }

  const d = domain?.toUpperCase();

  // eslint-disable-next-line no-console
  console.log(
    "%c╔══════════════════════════════════════════════════════════╗\n" +
      "║      🏁  GANTT PERFORMANCE BENCHMARKS                    ║\n" +
      "╚══════════════════════════════════════════════════════════╝",
    "color:#7c6af7;font-weight:bold"
  );
  // eslint-disable-next-line no-console
  console.log("%c  Synthetic data · 5 runs with JIT warmup", "color:#555;font-size:11px");

  if (!d || d === "A") {
    // eslint-disable-next-line no-console
    console.log("%c\n[A] ⚡ Timeline calculations", "color:#7c6af7;font-weight:bold");
    printDomain("A", "⚡ Timeline calculations", "#7c6af7", benchA());
  }

  if (!d || d === "B") {
    // eslint-disable-next-line no-console
    console.log("%c\n[B] 🎨 React Rendering", "color:#29b6f6;font-weight:bold");
    // eslint-disable-next-line no-console
    console.log(
      "  %cReact rendering cannot be measured synthetically.\n" +
        "  Interact with the gantt (pan, zoom, view change):\n" +
        "  measurements will appear automatically in the console\n" +
        "  under the group  [B] 🎨 React Rendering",
      "color:#666"
    );
    // eslint-disable-next-line no-console
    console.log(
      "  %cInstrumented components via <React.Profiler>:\n" +
        "    TopToolbar · TUOverview · FilterHeader · MonthHeaderBar\n" +
        "    AggregateHeatmapStrip · GroupedEmployeeList · EmployeeList",
      "color:#555;font-size:11px"
    );
  }

  if (!d || d === "C") {
    // eslint-disable-next-line no-console
    console.log("%c\n[C] 🖱  Drag & Drop", "color:#ef5350;font-weight:bold");
    printDomain("C", "🖱  Drag & Drop", "#ef5350", benchC());
    // eslint-disable-next-line no-console
    console.log(
      "  %cTo measure the full mouseup→paint pipeline,\n" + "  drag on the month bar in the gantt.",
      "color:#555;font-size:11px"
    );
  }

  if (!d || d === "D") {
    // eslint-disable-next-line no-console
    console.log("%c\n[D] 🗃  Data grid", "color:#ff9800;font-weight:bold");
    printDomain("D", "🗃  Data grid", "#ff9800", benchD());
  }

  // ─── Global summary ──────────────────────────────────────────────────────
  if (!d) {
    const all = [...benchA(), ...benchC(), ...benchD()];
    const pass = all.filter((r) => r.ms <= r.threshold).length;
    const warn = all.filter((r) => r.ms > r.threshold * 0.7 && r.ms <= r.threshold).length;
    const fail = all.filter((r) => r.ms > r.threshold).length;
    // eslint-disable-next-line no-console
    console.log(
      "\n%c══════════════════════════════════════════════════════════\n" +
        `  ✅ ${pass} OK   ⚠️ ${warn} near threshold   ❌ ${fail} exceeded\n` +
        "══════════════════════════════════════════════════════════",
      fail > 0
        ? "color:#ef5350;font-weight:bold"
        : warn > 0
          ? "color:#ffa726;font-weight:bold"
          : "color:#66bb6a;font-weight:bold"
    );
    // eslint-disable-next-line no-console
    console.log('%c  Re-run:  __ganttPerf()  or  __ganttPerf("A"|"C"|"D")', "color:#555;font-size:11px");
  }
}

// ─── Expose on window (dev only) ───────────────────────────────────

if (typeof window !== "undefined" && ((import.meta as any).env?.DEV ?? true)) {
  (window as any).__ganttPerf = runGanttBenchmarks;
}
