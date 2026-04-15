/**
 * Pure calculation primitives — segment accumulation, utilization capping, TU/TO formulas.
 */

import { ABSENCE_CATS, CHARGEABLE_CATS, GO_CATS, TRAINING_CATS } from "./staffingConstants";

export interface SegmentLike {
  category: string;
  util: number;
}

export interface SegmentAccum {
  absU: number;
  chU: number;
  goU: number;
  trU: number;
  otU: number;
  rawGoU: number;
  workUtils: number[];
}

export interface CappedResult {
  cappedAbsU: number;
  netU: number;
  cappedChU: number;
  cappedGoU: number;
  cappedTrU: number;
  cappedOtU: number;
  cappedTotal: number;
  absScale: number;
  chScale: number;
  goScale: number;
  trScale: number;
}

export const accumulateSegmentsByCategory = (segments: SegmentLike[], chargeableCombined: boolean): SegmentAccum => {
  let absU = 0,
    chU = 0,
    goU = 0,
    trU = 0,
    otU = 0,
    rawGoU = 0;
  const workUtils: number[] = [];
  for (const seg of segments) {
    if (ABSENCE_CATS.has(seg.category)) absU += seg.util;
    else {
      workUtils.push(seg.util);
      if (CHARGEABLE_CATS.has(seg.category)) chU += seg.util;
      else if (GO_CATS.has(seg.category)) {
        rawGoU += seg.util;
        if (chargeableCombined) chU += seg.util;
        else goU += seg.util;
      } else if (TRAINING_CATS.has(seg.category)) trU += seg.util;
      else otU += seg.util;
    }
  }
  return { absU, chU, goU, trU, otU, rawGoU, workUtils };
};

export const capUtilizations = (raw: {
  absU: number;
  chU: number;
  goU: number;
  trU: number;
  otU?: number;
}): CappedResult => {
  const cappedAbsU = Math.min(raw.absU, 100);
  const netU = Math.max(0, 100 - cappedAbsU);
  const cappedChU = Math.min(raw.chU, netU);
  const cappedGoU = Math.min(raw.goU, Math.max(0, netU - cappedChU));
  const cappedTrU = Math.min(raw.trU, Math.max(0, netU - cappedChU - cappedGoU));
  const otU = raw.otU ?? 0;
  const cappedOtU = Math.min(otU, Math.max(0, netU - cappedChU - cappedGoU - cappedTrU));
  return {
    cappedAbsU,
    netU,
    cappedChU,
    cappedGoU,
    cappedTrU,
    cappedOtU,
    cappedTotal: cappedAbsU + cappedChU + cappedGoU + cappedTrU + cappedOtU,
    absScale: raw.absU > 0 ? cappedAbsU / raw.absU : 1,
    chScale: raw.chU > 0 ? cappedChU / raw.chU : 1,
    goScale: raw.goU > 0 ? cappedGoU / raw.goU : 1,
    trScale: raw.trU > 0 ? cappedTrU / raw.trU : 1,
  };
};

export const computeTuRate = (chU: number, netU: number, fallback: number = 100): number =>
  netU > 0 ? (chU / netU) * 100 : fallback;

export const computeToRate = (chU: number, goU: number, trU: number, netU: number, fallback: number = 100): number =>
  netU > 0 ? ((chU + goU + trU) / netU) * 100 : fallback;
