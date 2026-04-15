import { useMemo, useEffect } from "react";
import { computeNeedsExtraHours, computeGradeCappedInfiniteCh } from "../../utils/scenarioUtils";
import { buildTimePoints, buildTargetSeries, findSelectionXPos } from "./TUTrendData";
import {
  computeYearFirstIdx,
  computeHmTicks,
  computeMonthTicksMap,
  computeSeqTicks,
  computeQuarterBoundaryPositions,
  computeYearChangePositions,
  computeVarianceYDomain,
  computeFteDomain,
} from "./tuTrendChartCalc";

/**
 * Encapsulates all data-preparation and axis-computation memos for TUTrendChart:
 * - Raw time-point generation (expensive)
 * - Theoretical target series
 * - Infinite / probabilized / grade-capped capacity overlays
 * - Year extraction + parent notification
 * - Year filtering
 * - _xPos re-indexing (uniform spacing after year filter)
 * - Highlight zone position clamping
 * - Axis tick / grid / domain computations
 */
export function useTUTrendChartData({
  allEmpsForTU,
  allEmpsKey,
  chargeableCombined,
  enabledHolidayDates,
  sapLookup,
  fullSapLookup,
  granularity,
  heatmapMode,
  ioJobcodes,
  employeeMetadata,
  useSapActuals,
  staffingNeeds,
  selectedYears,
  onYearsAvailable,
  timelineStart,
  timelineEnd,
}: {
  allEmpsForTU: any[];
  allEmpsKey: string;
  chargeableCombined: any;
  enabledHolidayDates: any;
  sapLookup: any;
  fullSapLookup: any;
  granularity: string;
  heatmapMode: string;
  ioJobcodes: any;
  employeeMetadata: any;
  useSapActuals: boolean;
  staffingNeeds: any[] | null;
  selectedYears: number[] | null;
  onYearsAvailable: ((years: number[]) => void) | null;
  timelineStart: any;
  timelineEnd: any;
}) {
  // Expensive: recomputes only when assignment data or settings change
  const rawPoints = useMemo(
    () =>
      buildTimePoints(
        allEmpsForTU,
        chargeableCombined,
        enabledHolidayDates,
        sapLookup,
        granularity,
        heatmapMode,
        ioJobcodes,
        employeeMetadata,
        useSapActuals,
        fullSapLookup
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      allEmpsKey,
      chargeableCombined,
      enabledHolidayDates,
      sapLookup,
      granularity,
      heatmapMode,
      ioJobcodes,
      employeeMetadata,
      useSapActuals,
      fullSapLookup,
    ]
  );

  // Per-bucket theoretical TU based on employee grades and presence
  const isVarMode = heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct";
  const targetSeries = useMemo(
    () =>
      isVarMode
        ? new Map<string, number>()
        : buildTargetSeries(allEmpsForTU, employeeMetadata, fullSapLookup || sapLookup, granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEmpsKey, employeeMetadata, sapLookup, fullSapLookup, granularity, isVarMode]
  );

  // Infinite capacity: add extra chargeable hours from staffing needs to the NUMERATOR only
  // TU∞ = (totalCh + extraH) / totalNet * 100 — always >= forecast TU
  const holidaySet = enabledHolidayDates instanceof Set ? enabledHolidayDates : null;
  const points = useMemo(
    () =>
      rawPoints.map((pt) => {
        let infiniteTU: number | null = null;
        let probInfTU: number | null = null;
        let gradeCappedTU: number | null = null;

        if (staffingNeeds && staffingNeeds.length > 0 && pt._totalNet > 0) {
          try {
            const bStart = new Date(pt._mStart);
            const bEnd = new Date(pt._mEnd);
            const extraH = computeNeedsExtraHours(staffingNeeds, bStart, bEnd, holidaySet, false);
            const extraHProb = computeNeedsExtraHours(staffingNeeds, bStart, bEnd, holidaySet, true);
            if (extraH > 0) {
              infiniteTU = ((pt._totalCh + extraH) / pt._totalNet) * 100;
            }
            if (extraHProb > 0) {
              probInfTU = ((pt._totalCh + extraHProb) / pt._totalNet) * 100;
            }
            // Grade-capped: cap (ch + needs) at each grade's net capacity
            if (pt._gradeBreakdown) {
              const cappedCh = computeGradeCappedInfiniteCh(
                staffingNeeds,
                bStart,
                bEnd,
                holidaySet,
                pt._gradeBreakdown,
                false
              );
              if (cappedCh > pt._totalCh) {
                gradeCappedTU = (cappedCh / pt._totalNet) * 100;
              }
            }
          } catch (err) {
            console.warn("[TUTrendChart] Error computing infinite capacity:", err);
          }
        }

        // Target covers the full period; infinite only when we have forecast data
        const hasData = pt.forecast != null;
        return {
          ...pt,
          target: targetSeries.get(pt.label) ?? null,
          infiniteTU: hasData ? infiniteTU : null,
          probInfTU: hasData ? probInfTU : null,
          gradeCappedTU: hasData ? gradeCappedTU : null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPoints, targetSeries, staffingNeeds, holidaySet]
  );

  // Extract available years from points and notify parent
  const extractedYears = useMemo(() => {
    const yrs = new Set<number>();
    points.forEach((pt) => {
      if (pt._year) yrs.add(2000 + parseInt(pt._year, 10));
    });
    return [...yrs].sort((a, b) => a - b);
  }, [points]);

  // Notify parent of available years (for the year selector UI)
  useEffect(() => {
    if (onYearsAvailable && extractedYears.length > 0) onYearsAvailable(extractedYears);
  }, [extractedYears, onYearsAvailable]);

  // Filter points by selected years
  const filteredPoints = useMemo(() => {
    if (!selectedYears || selectedYears.length === 0) return points;
    const yrSet = new Set(selectedYears.map((y: any) => String(y).slice(-2)));
    return points.filter((pt) => pt._year && yrSet.has(pt._year));
  }, [points, selectedYears]);

  // Re-index _xPos for non-halfmonth modes after year filtering (uniform spacing)
  const chartPoints = useMemo(() => {
    if (granularity === "halfmonth") return filteredPoints;
    return filteredPoints.map((pt, i) => ({ ...pt, _xPos: i }));
  }, [filteredPoints, granularity]);

  // Day-precise highlight zone positions, clamped to chart domain so Recharts
  // doesn't discard the ReferenceArea when the selection starts before the first
  // bucket (e.g. LY in halfmonth mode where edges(0) falls before dataMin).
  const { selStartXPos, selEndXPos } = useMemo(() => {
    const raw = findSelectionXPos(chartPoints, timelineStart, timelineEnd);
    if (raw.selStartXPos == null || raw.selEndXPos == null || chartPoints.length === 0) return raw;
    const dataMin = chartPoints[0]._xPos;
    const dataMax = chartPoints[chartPoints.length - 1]._xPos;
    return {
      selStartXPos: Math.max(raw.selStartXPos, dataMin),
      selEndXPos: Math.min(raw.selEndXPos, dataMax),
    };
  }, [chartPoints, timelineStart, timelineEnd]);

  // Axis tick / grid / domain computations
  const isVarianceMode = heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct";
  const yearFirstIdx = useMemo(() => computeYearFirstIdx(chartPoints), [chartPoints]);
  const hmTicks = useMemo(() => computeHmTicks(chartPoints, granularity), [chartPoints, granularity]);
  const monthTicksMap = useMemo(() => computeMonthTicksMap(chartPoints, granularity), [chartPoints, granularity]);
  const seqTicks = useMemo(
    () => computeSeqTicks(chartPoints, granularity, monthTicksMap),
    [chartPoints, granularity, monthTicksMap]
  );
  const quarterBoundaryPositions = useMemo(
    () => computeQuarterBoundaryPositions(chartPoints, granularity),
    [chartPoints, granularity]
  );
  const yearChangePositions = useMemo(() => computeYearChangePositions(chartPoints), [chartPoints]);
  const varianceYDomain = useMemo(
    () => computeVarianceYDomain(isVarianceMode, chartPoints),
    [isVarianceMode, chartPoints]
  );
  const fteDomain = useMemo(() => computeFteDomain(chartPoints), [chartPoints]);

  return {
    chartPoints,
    selStartXPos,
    selEndXPos,
    isVarianceMode,
    yearFirstIdx,
    hmTicks,
    monthTicksMap,
    seqTicks,
    quarterBoundaryPositions,
    yearChangePositions,
    varianceYDomain,
    fteDomain,
  };
}
