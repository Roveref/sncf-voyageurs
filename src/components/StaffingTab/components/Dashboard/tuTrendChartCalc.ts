/**
 * Pure computation functions for TUTrendChart tick/grid calculations.
 * Extracted to reduce TUTrendChart.tsx line count.
 */

/** Map: index -> year string, only for the FIRST tick of each year */
export const computeYearFirstIdx = (chartPoints: any[]): Record<number, string> => {
  const result: Record<number, string> = {};
  let prevYear = "";
  chartPoints.forEach((pt, i) => {
    if (pt._year && pt._year !== prevYear) {
      result[i] = pt._year;
      prevYear = pt._year;
    }
  });
  return result;
};

/** Halfmonth mode: tick positions at integer months (centered between C1/C2) */
export const computeHmTicks = (chartPoints: any[], granularity: string): number[] => {
  if (granularity !== "halfmonth") return [];
  const months = new Set<number>();
  chartPoints.forEach((p) => {
    if (p._xPos != null) months.add(Math.floor(p._xPos));
  });
  return Array.from(months)
    .sort((a, b) => a - b)
    .map((m) => m + 0.5);
};

/** Day/week/2week: group points by month, compute center tick position per month */
export const computeMonthTicksMap = (
  chartPoints: any[],
  granularity: string
): Map<number, { monthIdx: number; year: string }> | null => {
  if (granularity === "month" || granularity === "halfmonth") return null;
  const map = new Map<number, { monthIdx: number; year: string }>();
  const groups: { monthIdx: number; year: string; positions: number[] }[] = [];
  let currentKey = "";
  chartPoints.forEach((pt) => {
    const key = `${pt._year}-${pt._monthIdx}`;
    if (key !== currentKey) {
      groups.push({ monthIdx: pt._monthIdx ?? 0, year: pt._year, positions: [] });
      currentKey = key;
    }
    groups[groups.length - 1].positions.push(pt._xPos);
  });
  groups.forEach((g) => {
    const center = (g.positions[0] + g.positions[g.positions.length - 1]) / 2;
    map.set(center, { monthIdx: g.monthIdx, year: g.year });
  });
  return map;
};

/** Non-halfmonth: tick positions -- month-centered for day/week/2week, per-point for month */
export const computeSeqTicks = (
  chartPoints: any[],
  granularity: string,
  monthTicksMap: Map<number, { monthIdx: number; year: string }> | null
): number[] => {
  if (granularity === "halfmonth") return [];
  if (monthTicksMap) return Array.from(monthTicksMap.keys());
  return chartPoints.map((p) => p._xPos);
};

/** Quarter-boundary vertical grid line positions */
export const computeQuarterBoundaryPositions = (chartPoints: any[], granularity: string): number[] => {
  const positions: number[] = [];
  if (granularity === "halfmonth") {
    const months = [...new Set(chartPoints.map((p) => Math.floor(p._xPos)))].sort((a, b) => a - b);
    for (const m of months) {
      if ((m % 12) % 3 === 0 && m !== months[0]) {
        positions.push(m);
      }
    }
  } else {
    for (let i = 1; i < chartPoints.length; i++) {
      const prevMonth = chartPoints[i - 1]._monthIdx;
      const curMonth = chartPoints[i]._monthIdx;
      if (prevMonth !== curMonth && curMonth != null && curMonth % 3 === 0) {
        positions.push((chartPoints[i - 1]._xPos + chartPoints[i]._xPos) / 2);
      }
    }
  }
  return positions;
};

/** Year-change x-positions for vertical separator lines */
export const computeYearChangePositions = (chartPoints: any[]): number[] => {
  const positions: number[] = [];
  for (let i = 1; i < chartPoints.length; i++) {
    if (chartPoints[i]._year !== chartPoints[i - 1]._year) {
      positions.push((chartPoints[i - 1]._xPos + chartPoints[i]._xPos) / 2);
    }
  }
  return positions;
};

/** Variance Y-axis domain */
export const computeVarianceYDomain = (isVarianceMode: boolean, chartPoints: any[]): [number, number] | undefined => {
  if (!isVarianceMode) return undefined;
  const deltas = chartPoints.map((p) => p.delta).filter((d) => d != null) as number[];
  if (deltas.length === 0) return [-10, 10];
  const min = Math.min(...deltas);
  const max = Math.max(...deltas);
  const pad = Math.max(Math.abs(max - min) * 0.15, 5);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
};

/** FTE Y-axis domain */
export const computeFteDomain = (chartPoints: any[]): [number, number] => {
  const ftes = chartPoints.map((p) => p.fte).filter((v) => v != null && v > 0);
  if (ftes.length === 0) return [0, 10];
  const max = Math.max(...ftes);
  return [0, Math.ceil(max * 1.15)];
};
