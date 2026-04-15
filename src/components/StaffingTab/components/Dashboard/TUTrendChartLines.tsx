import React from "react";
import { useTheme } from "@mui/material/styles";
import { Line } from "recharts";
import { COLORS } from "./TUTrendLegend";
import { brand } from "../../../../config/brandConfig";

interface TUTrendChartLinesProps {
  isVarianceMode: boolean;
  hasDelta: boolean;
  hasSap: boolean;
  showDots: boolean;
  useSapActuals: boolean;
  visible: Record<string, any>;
  heatmapMode: string;
  chartPoints: any[];
  showFte: boolean;
  crosshairMatchIdx: number;
  crosshairFromTimeline: boolean;
  crosshairIsFuture: boolean;
  ceilDot: (color: string) => any;
}

/**
 * Renders all <Line> elements inside TUTrendChart's ComposedChart.
 * Each line corresponds to a data series (forecast, target, actual, I&O, infinite
 * capacity variants, turnover, ETP, variance delta).
 *
 * Must be rendered as children of a <ComposedChart>, not as a standalone component.
 * All props are derived from the parent's state/memos.
 */
const TUTrendChartLines = ({
  isVarianceMode,
  hasDelta,
  hasSap,
  showDots,
  useSapActuals,
  visible,
  heatmapMode,
  chartPoints,
  showFte,
  crosshairMatchIdx,
  crosshairFromTimeline,
  crosshairIsFuture,
  ceilDot,
}: TUTrendChartLinesProps): React.ReactElement => {
  const theme = useTheme();

  return (
    <>
      {/* ── Variance mode: delta curve ── */}
      {isVarianceMode && hasDelta && (
        <Line
          key="delta"
          type="monotone"
          dataKey="delta"
          yAxisId="left"
          name={heatmapMode === "variance_hours" ? "Δh (SAP − Forecast)" : "Δh% (SAP − Forecast)"}
          stroke={theme.palette.info.main}
          strokeWidth={1.5}
          dot={showDots ? { r: 3, fill: "#fff", stroke: theme.palette.info.main, strokeWidth: 1.5 } : false}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Normal mode: forecast line ── */}
      {!isVarianceMode && !useSapActuals && visible.forecast !== false && (
        <Line
          key="forecast"
          type="monotone"
          dataKey="forecast"
          yAxisId="left"
          name="Forecast"
          stroke={COLORS.forecast}
          strokeWidth={1.5}
          dot={ceilDot(COLORS.forecast) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Normal mode: theoretical target line ── */}
      {!isVarianceMode && visible.target !== false && (
        <Line
          key="target"
          type="monotone"
          dataKey="target"
          yAxisId="left"
          name="Theoretical"
          stroke={COLORS.target}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Normal mode: SAP actual line ── */}
      {!isVarianceMode && hasSap && visible.actual !== false && (
        <Line
          key="actual"
          type="monotone"
          dataKey="actual"
          yAxisId="left"
          name="Actual (SAP)"
          stroke={COLORS.actual}
          strokeWidth={1.5}
          dot={
            (showDots || crosshairMatchIdx >= 0
              ? (props: any) => {
                  const isHighlighted = crosshairMatchIdx >= 0 && props.index === crosshairMatchIdx;
                  if (isHighlighted && crosshairIsFuture) return null;
                  if (!isHighlighted && !showDots) return null;
                  if (!isHighlighted && (props.value == null || props.value >= 98)) return null;
                  const r = isHighlighted ? 5 : 3;
                  const fill = isHighlighted ? COLORS.actual : "#fff";
                  const showLabel = isHighlighted && crosshairFromTimeline && props.value != null;
                  return (
                    <g>
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={r}
                        fill={fill}
                        stroke={COLORS.actual}
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
                          fill={COLORS.actual}
                        >
                          {props.value.toFixed(1)}%
                        </text>
                      )}
                    </g>
                  );
                }
              : false) as any
          }
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── I&O TU curve on primary axis ── */}
      {!isVarianceMode && visible.ioTU !== false && chartPoints.some((p) => p.ioTU != null) && (
        <Line
          key="ioTU"
          type="monotone"
          dataKey="ioTU"
          yAxisId="left"
          name="I&O"
          stroke={COLORS.io}
          strokeWidth={1.5}
          strokeDasharray="8 3 2 3"
          dot={ceilDot(COLORS.io) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Infinite capacity TU curve ── */}
      {!isVarianceMode && visible.infiniteTU !== false && chartPoints.some((p) => p.infiniteTU != null) && (
        <Line
          key="infiniteTU"
          type="monotone"
          dataKey="infiniteTU"
          yAxisId="left"
          name="∞ Capacity"
          stroke={COLORS.infinite}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={ceilDot(COLORS.infinite) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Probabilized infinite capacity TU curve ── */}
      {!isVarianceMode && visible.probInfTU !== false && chartPoints.some((p) => p.probInfTU != null) && (
        <Line
          key="probInfTU"
          type="monotone"
          dataKey="probInfTU"
          yAxisId="left"
          name="∞ Capacity prob."
          stroke={COLORS.probInfinite}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={ceilDot(COLORS.probInfinite) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Grade-capped infinite capacity TU curve ── */}
      {!isVarianceMode && visible.gradeCappedTU !== false && chartPoints.some((p) => p.gradeCappedTU != null) && (
        <Line
          key="gradeCappedTU"
          type="monotone"
          dataKey="gradeCappedTU"
          yAxisId="left"
          name="∞ Cap. grade"
          stroke={brand.secondary}
          strokeWidth={1.5}
          strokeDasharray="8 4"
          dot={ceilDot(brand.secondary) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── Turnover churn curve ── */}
      {!isVarianceMode && visible.turnoverChurn !== false && chartPoints.some((p) => p.turnoverChurn != null) && (
        <Line
          key="turnoverChurn"
          type="monotone"
          dataKey="turnoverChurn"
          yAxisId="left"
          name="Turnover"
          stroke={COLORS.turnoverChurn}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={ceilDot(COLORS.turnoverChurn) as any}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}

      {/* ── ETP curve on secondary axis ── */}
      {showFte && (
        <Line
          key="fte"
          type="monotone"
          dataKey="fte"
          yAxisId="right"
          name="FTE"
          stroke={COLORS.fte}
          strokeWidth={1.5}
          dot={showDots ? { r: 3, fill: "#fff", stroke: COLORS.fte, strokeWidth: 1.5 } : false}
          animationBegin={0}
          animationDuration={600}
          isAnimationActive
          activeDot={false}
          connectNulls
        />
      )}
    </>
  );
};

TUTrendChartLines.displayName = "TUTrendChartLines";

export default TUTrendChartLines;
