/**
 * segmentHelpers.ts — Compatibility wrapper over calcPrimitives.accumulateSegmentsByCategory.
 *
 * Extends the canonical accumulator with support for `hours` and `utilization` fields
 * (used by some data shapes where segments don't have a pre-computed `util`).
 *
 * The core logic lives in calcPrimitives.ts — this file avoids duplicating it.
 */

import { accumulateSegmentsByCategory, type SegmentAccum } from "./calcPrimitives";

/** @deprecated Use SegmentAccum from calcPrimitives instead */
export interface SegmentAccumulation {
  absU: number;
  chU: number;
  goU: number;
  trU: number;
  otherU: number;
}

/**
 * Accumulate segment utilizations by category.
 *
 * Accepts segments with any of these utilization fields (checked in order):
 *   1. `util`         — pre-computed utilization %
 *   2. `hours`        — raw hours, converted via `hoursPerDay`
 *   3. `utilization`  — alias for util (used in some data shapes)
 *
 * When `chargeableCombined` is true, GO segments are folded into `chU`.
 * Otherwise they accumulate separately in `goU`.
 */
export function accumulateSegments(
  segments: { category: string; util?: number; hours?: number; utilization?: number }[],
  chargeableCombined: boolean,
  hoursPerDay?: number
): SegmentAccumulation {
  // Normalize segments to { category, util } for the canonical accumulator
  const normalized = segments.map((seg) => ({
    category: seg.category,
    util: seg.util ?? (hoursPerDay ? (seg.hours! / hoursPerDay) * 100 : (seg.utilization ?? 0)),
  }));
  const acc: SegmentAccum = accumulateSegmentsByCategory(normalized, chargeableCombined);
  return { absU: acc.absU, chU: acc.chU, goU: acc.goU, trU: acc.trU, otherU: acc.otU };
}
