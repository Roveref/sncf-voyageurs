/**
 * useDemandData — Hook connecting stores to the demand calculation engine.
 *
 * Provides monthly demand/supply/gap data for the NeedsBoardV2 demand chart,
 * plus drill-down helpers and summary KPIs.
 */

import { useMemo } from "react";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useComputedStore } from "../../../stores/useComputedStore";
import { getAssignmentsFromEditorStates } from "../utils/needStatusUtils";
import {
  generateMonthBuckets,
  computeDemandByMonth,
  computeSupplyByMonth,
  buildDemandSupplyRows,
  getNeedsForCell,
} from "../utils/demandCalc";
import { formatLocalDate } from "../utils/dateUtils";
import type { MonthBucket, DemandSupplyRow } from "../utils/demandCalc";
import type { Employee } from "../types";
import type { StaffingNeedItem } from "../../../types";

interface UseDemandDataParams {
  employees: Employee[];
  isHoliday: (dateStr: string) => boolean;
  horizon?: number; // months, default 9
  /** Filtered opportunity data — needs are filtered to only include opps in this list */
  opportunityData?: any[];
}

interface DemandSummary {
  totalDemandEtp: number;
  totalSupplyEtp: number;
  peakGap: number;
  peakMonth: string;
  openNeeds: number;
  filledNeeds: number;
  totalNeeds: number;
  fillRate: number; // 0-100
}

interface UseDemandDataResult {
  rows: DemandSupplyRow[];
  buckets: MonthBucket[];
  allNeeds: StaffingNeedItem[];
  summary: DemandSummary;
  getNeedsForCell: (monthKey: string, grade: string) => StaffingNeedItem[];
}

/** Flatten staffing needs from the store */
function flattenNeeds(needsMap: Record<string, StaffingNeedItem[]>): StaffingNeedItem[] {
  const flat: StaffingNeedItem[] = [];
  for (const [opportunityId, items] of Object.entries(needsMap)) {
    for (const n of items) flat.push({ ...n, opportunityId: n.opportunityId || opportunityId });
  }
  return flat;
}

export function useDemandData({
  employees,
  isHoliday,
  horizon = 9,
  opportunityData,
}: UseDemandDataParams): UseDemandDataResult {
  // ── Store subscriptions ────────────────────────────────────────────────
  const storeNeeds = useUserDataStore((s) => s.staffingNeeds);
  const editorStates = useUserDataStore((s) => s.editorStates);
  const assignments = useMemo(() => getAssignmentsFromEditorStates(editorStates), [editorStates]);
  const dailyGrid = useComputedStore((s) => s.dailyGrid);
  const calendarIndex = useComputedStore((s) => s.calendarIndex);

  // ── Build allowed opp IDs from filtered opportunityData ────────────────
  const allowedOppIds = useMemo(() => {
    if (!opportunityData?.length) return null; // null = no filter
    const set = new Set<string>();
    for (const o of opportunityData) {
      const id = o.opportunityId || o.id;
      if (id) set.add(id);
    }
    return set;
  }, [opportunityData]);

  // ── Flatten needs (filtered by allowed opps for demand) ────────────────
  const allNeeds = useMemo(() => {
    const flat = flattenNeeds(storeNeeds);
    if (!allowedOppIds) return flat;
    return flat.filter((n) => allowedOppIds.has(n.opportunityId || ""));
  }, [storeNeeds, allowedOppIds]);

  // ── Generate buckets from current month ────────────────────────────────
  const buckets = useMemo(() => {
    const today = new Date();
    const startStr = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
    return generateMonthBuckets(startStr, horizon, isHoliday);
  }, [horizon, isHoliday]);

  // ── Compute demand ─────────────────────────────────────────────────────
  const demand = useMemo(
    () => computeDemandByMonth(allNeeds, assignments, buckets, isHoliday),
    [allNeeds, assignments, buckets, isHoliday]
  );

  // ── Compute supply (uses dailyGrid for per-day availability) ────────────
  const supply = useMemo(
    () => computeSupplyByMonth(employees, buckets, isHoliday, dailyGrid, calendarIndex),
    [employees, buckets, isHoliday, dailyGrid, calendarIndex]
  );

  // ── Build Recharts rows ────────────────────────────────────────────────
  const rows = useMemo(() => buildDemandSupplyRows(buckets, demand, supply), [buckets, demand, supply]);

  // ── Summary KPIs ───────────────────────────────────────────────────────
  const summary = useMemo<DemandSummary>(() => {
    let totalDemandEtp = 0;
    let totalSupplyEtp = 0;
    let peakGap = -Infinity;
    let peakMonth = "";

    for (const row of rows) {
      totalDemandEtp += row.demandTotal;
      totalSupplyEtp += row.supplyTotal;
      if (row.gapTotal > peakGap) {
        peakGap = row.gapTotal;
        peakMonth = row.monthLabel;
      }
    }

    // Need status counts
    let openNeeds = 0;
    let filledNeeds = 0;
    for (const need of allNeeds) {
      if (need.status === "cancelled") continue;
      const qty = need.quantity || 1;
      const filledCount = assignments.filter((a) => a.needId === need.id && a.status !== "cancelled").length;
      if (filledCount >= qty) filledNeeds++;
      else openNeeds++;
    }

    const totalNeeds = openNeeds + filledNeeds;
    const fillRate = totalNeeds > 0 ? Math.round((filledNeeds / totalNeeds) * 100) : 0;

    return {
      totalDemandEtp: Math.round(totalDemandEtp * 10) / 10,
      totalSupplyEtp: Math.round(totalSupplyEtp * 10) / 10,
      peakGap: peakGap === -Infinity ? 0 : Math.round(peakGap * 10) / 10,
      peakMonth,
      openNeeds,
      filledNeeds,
      totalNeeds,
      fillRate,
    };
  }, [rows, allNeeds, assignments]);

  // ── Drill-down helper ──────────────────────────────────────────────────
  const getCellNeeds = useMemo(
    () => (monthKey: string, grade: string) => getNeedsForCell(monthKey, grade, allNeeds, buckets),
    [allNeeds, buckets]
  );

  return { rows, buckets, allNeeds, summary, getNeedsForCell: getCellNeeds };
}
