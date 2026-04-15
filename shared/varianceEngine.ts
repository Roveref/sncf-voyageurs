/**
 * Unified variance calculation primitives — SAP vs MDS (forecast).
 */

import { CHARGEABLE_CATS, GO_CATS } from "./staffingConstants";
import { accumulateSegmentsByCategory, capUtilizations, type SegmentLike } from "./calcPrimitives";

export const computeSapChH = (
  segments: SegmentLike[],
  chScale: number,
  empHPD: number,
  chargeableCombined: boolean
): number => {
  let sapChU = 0;
  for (const seg of segments) {
    if (CHARGEABLE_CATS.has(seg.category)) sapChU += seg.util * chScale;
    else if (GO_CATS.has(seg.category) && chargeableCombined) sapChU += seg.util * chScale;
  }
  return (sapChU * empHPD) / 100;
};

export const computeMdsChargeableHours = (
  forecastSegments: SegmentLike[],
  empHPD: number,
  chargeableCombined: boolean
): number => {
  const acc = accumulateSegmentsByCategory(forecastSegments, chargeableCombined);
  const capped = capUtilizations(acc);
  return (capped.cappedChU / 100) * empHPD;
};

export { computeMdsChargeableHours as computeMdsChH };

export const computeVarianceDelta = (sapChH: number, mdsChH: number): number => sapChH - mdsChH;

export const computeVarianceRate = (
  sapEmpDays: number,
  sapChU: number,
  sapAbsU: number,
  forecastChU: number,
  forecastAbsU: number
): number | null => {
  if (sapEmpDays <= 0) return null;
  const sapNet = sapEmpDays * 100 - sapAbsU;
  const sapTU = sapNet > 0 ? (sapChU / sapNet) * 100 : 100;
  const fNet = sapEmpDays * 100 - forecastAbsU;
  const forecastTU = fNet > 0 ? (forecastChU / fNet) * 100 : 100;
  return sapTU - forecastTU;
};
