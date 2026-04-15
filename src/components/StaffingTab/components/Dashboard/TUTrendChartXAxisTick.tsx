import React from "react";
import { useTheme } from "@mui/material/styles";
import { MONTHS_FR } from "./TUTrendData";

interface TUTrendChartXAxisTickProps {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value: number };
  granularity: string;
  hmTicks: number[];
  seqTicks: number[];
  monthTicksMap: Map<number, { monthIdx: number; year: string }> | null;
  chartPoints: any[];
  yearFirstIdx: Record<number, string>;
}

/**
 * Custom tick renderer for the XAxis of TUTrendChart.
 * Renders month abbreviation + optional year label.
 * Handles three display modes: halfmonth, day/week/2week (monthTicksMap), and month.
 */
const TUTrendChartXAxisTick = ({
  x: _x = 0,
  y: _y = 0,
  index = 0,
  payload,
  granularity,
  hmTicks,
  seqTicks,
  monthTicksMap,
  chartPoints,
  yearFirstIdx,
}: TUTrendChartXAxisTickProps): React.ReactElement => {
  const theme = useTheme();
  const x = Number(_x);
  const y = Number(_y);

  // ── Halfmonth mode ──
  if (granularity === "halfmonth") {
    const monthVal = Math.floor(payload!.value);
    const monthIdx = monthVal % 12;
    const yearVal = Math.floor(monthVal / 12);
    const display = MONTHS_FR[monthIdx];
    const yearStr = String(yearVal).slice(-2);
    const showYear = index === 0 || (index > 0 && Math.floor(Math.floor(hmTicks[index - 1]) / 12) !== yearVal);
    return (
      <g>
        <text
          x={x}
          y={y + 11}
          textAnchor="middle"
          fontSize={11}
          fill={theme.palette.text.secondary}
          fontFamily="Aptos, sans-serif"
        >
          {display}
        </text>
        {showYear && (
          <text
            x={x}
            y={y + 26}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={theme.palette.text.primary}
            fontFamily="Aptos, sans-serif"
          >
            20{yearStr}
          </text>
        )}
      </g>
    );
  }

  // ── Day/Week/2week: month-centered ticks ──
  if (monthTicksMap) {
    const tickInfo = monthTicksMap.get(payload!.value);
    if (!tickInfo) return <g />;
    const display = MONTHS_FR[tickInfo.monthIdx];
    const prevTick = index > 0 ? seqTicks[index - 1] : null;
    const prevInfo = prevTick != null ? monthTicksMap.get(prevTick) : null;
    const showYear = index === 0 || (prevInfo != null && prevInfo.year !== tickInfo.year);
    return (
      <g>
        <text
          x={x}
          y={y + 11}
          textAnchor="middle"
          fontSize={11}
          fill={theme.palette.text.secondary}
          fontFamily="Aptos, sans-serif"
        >
          {display}
        </text>
        {showYear && (
          <text
            x={x}
            y={y + 26}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={theme.palette.text.primary}
            fontFamily="Aptos, sans-serif"
          >
            20{tickInfo.year}
          </text>
        )}
      </g>
    );
  }

  // ── Month granularity: use point label ──
  const pt = chartPoints[payload!.value];
  if (!pt) return <g />;
  const display = pt.label.trim().split("·")[0];
  const yearLabel = yearFirstIdx[payload!.value];

  return (
    <g>
      <text
        x={x}
        y={y + 11}
        textAnchor="middle"
        fontSize={11}
        fill={theme.palette.text.secondary}
        fontFamily="Aptos, sans-serif"
      >
        {display}
      </text>
      {yearLabel && (
        <text
          x={x}
          y={y + 26}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={theme.palette.text.primary}
          fontFamily="Aptos, sans-serif"
        >
          20{yearLabel}
        </text>
      )}
    </g>
  );
};

TUTrendChartXAxisTick.displayName = "TUTrendChartXAxisTick";

export default TUTrendChartXAxisTick;
