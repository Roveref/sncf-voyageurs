/**
 * calcPrimitives.ts — Re-exports from @shared/calcPrimitives.
 * Backward-compatible: all existing imports continue to work.
 */

export { accumulateSegmentsByCategory, capUtilizations, computeTuRate, computeToRate } from "@shared/calcPrimitives";

export type { SegmentLike, SegmentAccum, CappedResult } from "@shared/calcPrimitives";
