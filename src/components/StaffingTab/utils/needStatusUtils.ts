/**
 * needStatusUtils — Derive staffing need status from assignments
 *
 * Status is always computed, never manually stored (except "cancelled" which is explicit).
 * This keeps the data model consistent: if assignments change, status follows.
 */

import type { StaffingNeedItem, StaffingAssignment } from "../../../types";
import type { BaselineSegment } from "../components/Edit/bulkEditTypes";

export type DerivedNeedStatus = "open" | "partiallyFilled" | "filled" | "cancelled";

/**
 * Compute the derived status for a single need based on its assignments.
 *
 * Rules:
 * - If need.status === "cancelled" (explicit user action) → "cancelled"
 * - filledCount >= quantity → "filled"
 * - filledCount > 0 → "partiallyFilled"
 * - else → "open"
 */
export function computeNeedStatus(
  need: StaffingNeedItem,
  assignments: StaffingAssignment[],
  scenarioId?: string | null
): DerivedNeedStatus {
  if (need.status === "cancelled") return "cancelled";

  const relevant = assignments.filter(
    (a) =>
      a.needId === need.id &&
      a.status !== "cancelled" &&
      (scenarioId === undefined || a.scenarioId === null || a.scenarioId === scenarioId)
  );

  const filledCount = relevant.length;
  const quantity = need.quantity || 1;

  if (filledCount >= quantity) return "filled";
  if (filledCount > 0) return "partiallyFilled";
  return "open";
}

/**
 * Compute derived statuses for all needs.
 *
 * Returns a Map<needId, DerivedNeedStatus> for efficient lookup.
 */
export function computeAllNeedStatuses(
  needs: StaffingNeedItem[],
  assignments: StaffingAssignment[],
  scenarioId?: string | null
): Map<string, DerivedNeedStatus> {
  // Pre-group assignments by needId for O(n) instead of O(n*m)
  const assignmentsByNeed = new Map<string, StaffingAssignment[]>();
  for (const a of assignments) {
    if (a.status === "cancelled") continue;
    if (scenarioId !== undefined && a.scenarioId !== null && a.scenarioId !== scenarioId) continue;
    const list = assignmentsByNeed.get(a.needId) || [];
    list.push(a);
    assignmentsByNeed.set(a.needId, list);
  }

  const result = new Map<string, DerivedNeedStatus>();
  for (const need of needs) {
    if (need.status === "cancelled") {
      result.set(need.id, "cancelled");
      continue;
    }
    const filledCount = assignmentsByNeed.get(need.id)?.length || 0;
    const quantity = need.quantity || 1;
    if (filledCount >= quantity) result.set(need.id, "filled");
    else if (filledCount > 0) result.set(need.id, "partiallyFilled");
    else result.set(need.id, "open");
  }

  return result;
}

/**
 * Get assignments for a specific need, optionally filtered by scenario.
 */
export function getAssignmentsForNeed(
  needId: string,
  assignments: StaffingAssignment[],
  scenarioId?: string | null
): StaffingAssignment[] {
  return assignments.filter(
    (a) =>
      a.needId === needId &&
      a.status !== "cancelled" &&
      (scenarioId === undefined || a.scenarioId === null || a.scenarioId === scenarioId)
  );
}

/**
 * Summary stats across all needs.
 */
export function computeNeedsSummary(
  needs: StaffingNeedItem[],
  assignments: StaffingAssignment[],
  scenarioId?: string | null
): {
  total: number;
  open: number;
  partiallyFilled: number;
  filled: number;
  cancelled: number;
  totalSlots: number;
  filledSlots: number;
} {
  const statuses = computeAllNeedStatuses(needs, assignments, scenarioId);

  let open = 0,
    partiallyFilled = 0,
    filled = 0,
    cancelled = 0;
  let totalSlots = 0,
    filledSlots = 0;

  for (const need of needs) {
    const status = statuses.get(need.id) || "open";
    const qty = need.quantity || 1;
    totalSlots += qty;

    switch (status) {
      case "open":
        open++;
        break;
      case "partiallyFilled":
        partiallyFilled++;
        break;
      case "filled":
        filled++;
        break;
      case "cancelled":
        cancelled++;
        break;
    }

    // Count filled slots
    const relevant = assignments.filter(
      (a) =>
        a.needId === need.id &&
        a.status !== "cancelled" &&
        (scenarioId === undefined || a.scenarioId === null || a.scenarioId === scenarioId)
    );
    filledSlots += Math.min(relevant.length, qty);
  }

  return { total: needs.length, open, partiallyFilled, filled, cancelled, totalSlots, filledSlots };
}

/**
 * Derive virtual StaffingAssignment[] from editor states.
 *
 * Scans all editorStates' `current` arrays for segments with a `needId` field.
 * Returns them as StaffingAssignment objects so existing status computation works unchanged.
 *
 * @param empNameResolver Optional callback to resolve empId → display name.
 */
export function getAssignmentsFromEditorStates(
  editorStates: Record<string, any>,
  empNameResolver?: (empId: string) => string
): StaffingAssignment[] {
  const assignments: StaffingAssignment[] = [];
  const seen = new Set<string>();
  for (const [empId, state] of Object.entries(editorStates)) {
    if (!state?.current || !Array.isArray(state.current)) continue;
    for (const seg of state.current as BaselineSegment[]) {
      if (!seg.needId) continue;
      // Deduplicate by _uid (grade-split rows can duplicate segments)
      if (seen.has(seg._uid)) continue;
      seen.add(seg._uid);
      const resolvedId = seg.empId || empId;
      assignments.push({
        id: seg._uid,
        needId: seg.needId,
        empId: resolvedId,
        empName: empNameResolver ? empNameResolver(resolvedId) : resolvedId,
        startDate: seg.startDate,
        endDate: seg.endDate,
        utilization: seg.utilization,
        status: "confirmed",
        source: "manual",
        scenarioId: null,
        createdAt: "",
      });
    }
  }
  return assignments;
}
