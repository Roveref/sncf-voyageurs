import React, { memo, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Customized,
} from "recharts";

import { COLORS, TUTrendLegend, useTrendVisibility } from "./TUTrendLegend";
import { TUTrendYearSelector, useTrendYears } from "./TUTrendYearSelector";
import { ChartTooltip } from "./TUTrendTooltip";
import { HighlightHandles } from "./TUTrendHandles";
import { setCrosshairRange, useCrosshairRange } from "../../hooks/useCrosshairSync";
import TUTrendChartLines from "./TUTrendChartLines";
import TUTrendChartXAxisTick from "./TUTrendChartXAxisTick";
import { useTUTrendChartData } from "./useTUTrendChartData";

// Re-export sub-components and hooks for backward compatibility
export { TUTrendLegend, useTrendVisibility } from "./TUTrendLegend";
export { TUTrendYearSelector, useTrendYears } from "./TUTrendYearSelector";

const TUTrendChart = memo(
  ({
    employees,
    allEmployees,
    timelineStart,
    timelineEnd,
    chargeableCombined,
    enabledHolidayDates,
    sapLookup,
    fullSapLookup = null,
    granularity = "month",
    visible,
    onToggle,
    theoreticalTU,
    heatmapMode = "utilization",
    employeeMetadata = null,
    ioJobcodes = null,
    staffingNeeds = null,
    selectedYears = null,
    onYearsAvailable = null,
    useSapActuals = false,
    onDateRangeChange = null,
  }: any) => {
    const theme = useTheme();

    // Use allEmployees (unfiltered by presence) so that the TU for a given bucket
    // is stable regardless of the timeline selection. Per-bucket presence is handled
    // inside buildTimePoints via employeeMetadata.
    const allEmpsForTU = allEmployees || employees;
    const allEmpsKey = allEmpsForTU
      .map((e: any) => {
        const aLen = e.assignments?.length ?? 0;
        // When assignments are patched for live simulation (_consolidated cleared), include content hash
        if (!e._consolidated && aLen > 0) {
          const a = e.assignments;
          const h = a.map((x: any) => `${x.startDate}${x.endDate}${x.utilization}`).join("");
          return `${e.empId}:${aLen}:${h}`;
        }
        return `${e.empId}:${aLen}`;
      })
      .join(",");

    const {
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
    } = useTUTrendChartData({
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
    });

    const hasSap = chartPoints.some((d) => d.actual != null);
    const hasDelta = chartPoints.some((d) => d.delta != null);

    // Show dots for coarse granularities, hide for day/week
    const showDots = granularity === "month" || granularity === "halfmonth" || granularity === "2week";

    // ── Crosshair from timeline hover → highlight matching bucket on TU Trend ──
    const crosshair = useCrosshairRange();
    const nextMonthMs = useMemo(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    }, []);
    const crosshairIsFuture = crosshair ? crosshair.startMs >= nextMonthMs : false;
    const crosshairMatchIdx = useMemo(() => {
      if (!crosshair || chartPoints.length === 0) return -1;
      if (crosshair.source !== "timeline" && crosshair.source !== "trend") return -1;
      return chartPoints.findIndex((pt: any) => pt._mStart <= crosshair.startMs && pt._mEnd > crosshair.startMs);
    }, [crosshair, chartPoints]);

    // Hide dots when value is at the chart ceiling (>=98%) — they merge with the top border
    // When crosshairMatchIdx matches, enlarge and fill the dot
    const crosshairFromTimeline = crosshair?.source === "timeline";
    const ceilDot = useCallback(
      (color: string) =>
        showDots || crosshairMatchIdx >= 0
          ? (props: any) => {
              const isHighlighted = crosshairMatchIdx >= 0 && props.index === crosshairMatchIdx;
              if (!isHighlighted && !showDots) return null;
              if (!isHighlighted && (props.value == null || props.value >= 98)) return null;
              const r = isHighlighted ? 5 : 3;
              const fill = isHighlighted ? color : "#fff";
              const showLabel = isHighlighted && crosshairFromTimeline && props.value != null;
              return (
                <g>
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={r}
                    fill={fill}
                    stroke={color}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                  />
                  {showLabel && (
                    <text
                      x={props.cx}
                      y={props.cy - 10}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="Aptos, sans-serif"
                      fill={color}
                    >
                      {props.value.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            }
          : false,
      [showDots, crosshairMatchIdx, crosshairFromTimeline]
    );

    const showFte = visible.fte !== false;

    if (chartPoints.length < 2) return null;

    // Variance mode with no SAP data in any bucket → show message
    if (isVarianceMode && !hasDelta) {
      return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 200 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No SAP data in this period to compute {heatmapMode === "variance_hours" ? "Δh" : "Δh%"}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartPoints}
              margin={{ top: 2, right: showFte ? 5 : 10, left: 0, bottom: 0 }}
              onMouseLeave={() => setCrosshairRange(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} />

              {/* Horizontal grid lines — exclude 100% to avoid top-border effect */}
              {!isVarianceMode &&
                [0, 20, 40, 60, 80].map((v) => (
                  <ReferenceLine
                    key={`hgrid-${v}`}
                    y={v}
                    yAxisId="left"
                    stroke={theme.palette.text.disabled}
                    strokeDasharray="3 3"
                    strokeWidth={0.5}
                    ifOverflow="hidden"
                  />
                ))}

              <XAxis
                dataKey="_xPos"
                type="number"
                domain={
                  granularity === "halfmonth"
                    ? ["dataMin", "dataMax"]
                    : [(min: number) => min - 0.5, (max: number) => max + 0.5]
                }
                ticks={granularity === "halfmonth" ? hmTicks : seqTicks}
                tick={(props) => (
                  <TUTrendChartXAxisTick
                    {...props}
                    granularity={granularity}
                    hmTicks={hmTicks}
                    seqTicks={seqTicks}
                    monthTicksMap={monthTicksMap}
                    chartPoints={chartPoints}
                    yearFirstIdx={yearFirstIdx}
                  />
                )}
                axisLine={false}
                tickLine={false}
                height={36}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                domain={isVarianceMode ? varianceYDomain : [0, 100]}
                ticks={isVarianceMode ? undefined : [0, 20, 40, 60, 80, 100]}
                tickFormatter={
                  isVarianceMode ? (v) => (heatmapMode === "variance_hours" ? `${v}h` : `${v}pts`) : (v) => `${v}%`
                }
                tick={{ fontSize: 12, fill: theme.palette.text.secondary, fontFamily: "Aptos, sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={isVarianceMode ? 48 : 38}
              />
              {showFte && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={fteDomain}
                  tickFormatter={(v) => `${v}`}
                  tick={{ fontSize: 12, fill: COLORS.fte, fontFamily: "Aptos, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  label={{
                    value: "FTE",
                    angle: 90,
                    position: "insideRight",
                    fill: COLORS.fte,
                    fontSize: 11,
                    fontWeight: 600,
                    dx: 5,
                    fontFamily: "Aptos, sans-serif",
                  }}
                />
              )}
              <Tooltip content={<ChartTooltip visible={visible} heatmapMode={heatmapMode} />} />

              {/* Firm target line at 75% TU */}
              {!isVarianceMode && (
                <ReferenceLine
                  y={75}
                  yAxisId="left"
                  stroke={theme.palette.error.main}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{
                    value: "75%",
                    position: "left",
                    fill: theme.palette.error.main,
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: "Aptos, sans-serif",
                  }}
                />
              )}

              {/* Quarter-boundary vertical grid lines */}
              {quarterBoundaryPositions.map((pos) => (
                <ReferenceLine
                  key={`qgrid-${pos}`}
                  x={pos}
                  yAxisId="left"
                  stroke={theme.palette.grey[300]}
                  strokeDasharray="3 3"
                />
              ))}
              {/* Year separator lines */}
              {yearChangePositions.map((pos) => (
                <ReferenceLine
                  key={`yr-${pos}`}
                  x={pos}
                  yAxisId="left"
                  stroke={theme.palette.text.disabled}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              ))}

              {/* Highlight selected timeline range — day-precise via numerical axis */}
              {selStartXPos != null && selEndXPos != null && (
                <ReferenceArea
                  x1={selStartXPos}
                  x2={selEndXPos}
                  yAxisId="left"
                  fill={theme.palette.text.secondary}
                  fillOpacity={0.06}
                  stroke={theme.palette.text.secondary}
                  strokeOpacity={0.15}
                  strokeDasharray="4 2"
                />
              )}

              {/* Drag handles on highlight edges */}
              {selStartXPos != null && selEndXPos != null && onDateRangeChange && (
                <Customized
                  component={(props: any) => (
                    <HighlightHandles
                      {...props}
                      selStartXPos={selStartXPos}
                      selEndXPos={selEndXPos}
                      chartPoints={chartPoints}
                      timelineStart={timelineStart}
                      timelineEnd={timelineEnd}
                      onDateRangeChange={onDateRangeChange}
                    />
                  )}
                />
              )}

              {/* Variance mode: zero reference line */}
              {isVarianceMode && (
                <ReferenceLine
                  yAxisId="left"
                  y={0}
                  stroke={theme.palette.text.secondary}
                  strokeOpacity={0.4}
                  strokeDasharray="4 2"
                  label={{
                    value: heatmapMode === "variance_hours" ? "0h" : "0%",
                    position: "right",
                    fill: theme.palette.text.secondary,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "Aptos, sans-serif",
                  }}
                />
              )}

              <TUTrendChartLines
                isVarianceMode={isVarianceMode}
                hasDelta={hasDelta}
                hasSap={hasSap}
                showDots={showDots}
                useSapActuals={useSapActuals}
                visible={visible}
                heatmapMode={heatmapMode}
                chartPoints={chartPoints}
                showFte={showFte}
                crosshairMatchIdx={crosshairMatchIdx}
                crosshairFromTimeline={crosshairFromTimeline}
                crosshairIsFuture={crosshairIsFuture}
                ceilDot={ceilDot}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  }
);

TUTrendChart.displayName = "TUTrendChart";

export default TUTrendChart;
