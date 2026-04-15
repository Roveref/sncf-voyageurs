/**
 * gridWorker.ts — Web Worker for cold-cache daily grid computation.
 *
 * Runs buildDailyGrid() off the main thread for initial loads / major data changes.
 * Incremental updates (panning within cached range) still run synchronously on the
 * main thread via the existing cell-cache mechanism in useDailyGrid.ts.
 *
 * Serialization notes:
 *   - Sets are sent as arrays (postMessage cannot clone Sets in all envs)
 *   - Maps are sent as plain objects keyed by empId
 *   - Employee._consolidated / _periods are plain arrays — safe to transfer
 */

import { buildDailyGrid } from "../utils/dataProcessing";
import type { Employee, CalendarDay, SapLookup } from "../types";

// ─── Message types ────────────────────────────────────────────────────────────

export interface GridWorkerRequest {
  type: "build";
  employees: any[]; // Employee[] with projects serialized as string[]
  calendar: CalendarDay[];
  sapLookup: SapLookup | null;
  chargeableCombined: boolean;
  enabledHolidayDates: string[];
  sapMonthDateStrs: string[];
  sapMonthWorkDays: number;
  dataSourceFilter?: "sap";
}

export interface GridWorkerResultMsg {
  type: "result";
  /** Map<empId, EmployeeDailyData> serialized as a plain object */
  grid: Record<string, any>;
}

export interface GridWorkerErrorMsg {
  type: "error";
  message: string;
}

export type GridWorkerResponse = GridWorkerResultMsg | GridWorkerErrorMsg;

// ─── Handler ──────────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<GridWorkerRequest>) => {
  if (e.data.type !== "build") return;

  try {
    const {
      employees: rawEmployees,
      calendar,
      sapLookup,
      chargeableCombined,
      enabledHolidayDates,
      sapMonthDateStrs,
      sapMonthWorkDays,
      dataSourceFilter,
    } = e.data;

    // Rebuild Set properties that were serialized as arrays
    const employees: Employee[] = rawEmployees.map((emp) => ({
      ...emp,
      projects: Array.isArray(emp.projects) ? new Set<string>(emp.projects) : emp.projects,
    }));

    const sapMonthSet = new Set<string>(sapMonthDateStrs);

    const t0 = performance.now();
    const result = buildDailyGrid(
      employees,
      calendar,
      sapLookup,
      chargeableCombined,
      enabledHolidayDates,
      sapMonthSet,
      sapMonthWorkDays,
      undefined, // no cell cache in worker — computing the full grid
      dataSourceFilter
    );
    const elapsed = performance.now() - t0;

    // Convert Map → plain object for postMessage (Maps are not structured-cloned
    // consistently across all bundlers / browsers; object is always safe)
    const grid: Record<string, any> = {};
    result.forEach((value, key) => {
      grid[key] = value;
    });

    const msg: GridWorkerResultMsg = { type: "result", grid };
    self.postMessage(msg);

    // eslint-disable-next-line no-console
    console.info(`[gridWorker] buildDailyGrid: ${elapsed.toFixed(1)}ms, ${employees.length} employees`);
  } catch (err) {
    const msg: GridWorkerErrorMsg = { type: "error", message: String(err) };
    self.postMessage(msg);
  }
};
