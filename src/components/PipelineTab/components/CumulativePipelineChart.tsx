import React, { useState, useCallback, useEffect, useMemo, memo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import { alpha, useTheme } from "@mui/material/styles";
import { ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { usePipelineStockData } from "../hooks/usePipelineStockData";
import PipelineStockTooltip from "./PipelineStockTooltip";
import MonthlyDetailsTable from "../../BookingsTab/components/MonthlyDetailsTable";
import { animations } from "../../../styles/animations";
import { chartPalette, brand } from "../../../config/brandConfig";

const PALETTE = [...chartPalette];

import { roundedBarShapeTop } from "./RoundedBarShape";

function generateYearColors(yearsArray: number[]) {
  if (!yearsArray || yearsArray.length === 0) return {};
  const sorted = [...yearsArray].sort((a, b) => b - a);
  const colors: Record<number, { bar: string; line: string; opacity: number }> = {};
  sorted.forEach((year, i) => {
    const hex = PALETTE[i % PALETTE.length];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lineColor = `rgb(${Math.round(r * 0.75)}, ${Math.round(g * 0.75)}, ${Math.round(b * 0.75)})`;
    colors[year] = { bar: hex, line: lineColor, opacity: 0.85 };
  });
  return colors;
}

const CumulativePipelineChart = memo(
  ({
    allOpportunityData,
    loading,
    showNetRevenue,
    showIO,
    onBarClick,
    activeMonth,
    sinceYear = null,
  }: {
    allOpportunityData: any[];
    loading: boolean;
    showNetRevenue: boolean;
    showIO: boolean;
    onBarClick?: (month: number, year: number, stockOpps: any[]) => void;
    activeMonth?: string | null; // "month:year" format
    sinceYear?: number | null;
  }) => {
    const theme = useTheme();

    const { years, monthlyData } = usePipelineStockData(allOpportunityData, loading, showNetRevenue, sinceYear);

    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const [showExits, setShowExits] = useState(false);
    const [chartKey, setChartKey] = useState(0);

    // Default to the 2 most recent years, regardless of sinceYear
    useEffect(() => {
      if (years.length > 0) {
        const defaults = years.slice(-2);
        setSelectedYears((s) => (s.length === 0 ? defaults : s.filter((y) => years.includes(y))));
      }
    }, [years]);

    const COLOR_BY_YEAR = useMemo(() => generateYearColors(years), [years]);

    const handleYearToggle = useCallback((year: number) => {
      setSelectedYears((prev) => {
        if (prev.includes(year)) {
          return prev.length > 1 ? prev.filter((y) => y !== year) : prev;
        }
        return [...prev, year];
      });
      setChartKey((k) => k + 1);
    }, []);

    // Filter data to only include months with data for selected years
    const chartData = useMemo(
      () => monthlyData.filter((md) => selectedYears.some((y) => md[`${y}_stock`] != null)),
      [monthlyData, selectedYears]
    );

    // Only animate on first render, not on clicks
    const hasRenderedRef = React.useRef(false);
    React.useEffect(() => {
      hasRenderedRef.current = true;
    }, []);

    // Local highlight state — prevents parent re-render from causing a flash
    const [localHighlight, setLocalHighlight] = useState<string | null>(null);
    React.useEffect(() => {
      setLocalHighlight(activeMonth ?? null);
    }, [activeMonth]);

    const activeMonthNum = localHighlight ? Number(localHighlight.split(":")[0]) : -1;
    const activeYearNum = localHighlight ? Number(localHighlight.split(":")[1]) : -1;

    const cellOpacity = (month: number, year: number, base: number) => {
      if (activeMonthNum < 0) return base;
      if (month === activeMonthNum && year === activeYearNum) return 1;
      return 0.3;
    };

    const chartWrapperRef = React.useRef<HTMLDivElement>(null);

    // Memoized shape functions for stacked exits (keyed by year)
    const exitShapes = useMemo(() => {
      const shapes: Record<
        number,
        { booked: (props: any) => React.ReactElement | null; lost: (props: any) => React.ReactElement | null }
      > = {};
      for (const year of years) {
        const stackKeys = [`${year}_exits_booked`, `${year}_exits_lost`];
        shapes[year] = {
          booked: roundedBarShapeTop(stackKeys),
          lost: roundedBarShapeTop(stackKeys),
        };
      }
      return shapes;
    }, [years]);

    // Map pipeline data to MonthlyDetailsTable format: ${year} = entries/exits, ${year}_cumulative = stock
    const detailsTableData = useMemo(() => {
      return monthlyData.map((md) => {
        const mapped: Record<string, any> = { month: md.month, monthName: md.monthName };
        for (const y of years) {
          mapped[`${y}`] = showExits ? md[`${y}_exits`] || 0 : md[`${y}_entries`] || 0;
          mapped[`${y}_cumulative`] = md[`${y}_stock`] || 0;
          mapped[`${y}_io_cumulative`] = md[`${y}_stock_io`] || 0;
        }
        return mapped;
      });
    }, [monthlyData, years, showExits]);

    // Click handler: extract stock opportunities for the clicked month
    const handleBarClick = useCallback(
      (year: number) => (barData: any) => {
        if (!barData?.payload || !onBarClick) return;
        const month = barData.payload.month;
        if (month == null) return;
        const filterValue = `${month}:${year}`;
        const isDeselect = localHighlight === filterValue;
        // Local state first → visual update paints immediately
        setLocalHighlight(isDeselect ? null : filterValue);
        // Defer parent update to next frame so local paint happens first
        requestAnimationFrame(() => {
          const stockOpps = barData.payload[`${year}StockOpps`] || [];
          onBarClick(month, year, stockOpps);
        });
      },
      [onBarClick, localHighlight]
    );

    if (years.length === 0) return null;

    const yearsSorted = [...selectedYears].sort((a, b) => a - b);

    return (
      <Card
        sx={{
          borderRadius: 3,
          overflow: "visible",
          position: "relative",
          zIndex: 1,
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": { transform: "translateY(-4px)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" },
          ...animations.cardEntrance(200),
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h6" fontWeight={700}>
              Cumulative Pipeline
            </Typography>

            {/* Year selector chips (left, same as BookingsTab) */}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              {years
                .sort((a, b) => a - b)
                .map((year) => {
                  const on = selectedYears.includes(year);
                  const color = COLOR_BY_YEAR[year]?.bar || brand.primaryDark;
                  return (
                    <Chip
                      key={year}
                      label={year}
                      size="small"
                      onClick={() => handleYearToggle(year)}
                      sx={{
                        bgcolor: on ? color : alpha(color, 0.08),
                        color: on ? "white" : "text.secondary",
                        border: "none",
                        fontWeight: on ? 600 : 400,
                        transition:
                          "background-color 0.2s ease-in-out, color 0.2s ease-in-out, transform 0.2s ease-in-out",
                        "&:hover": {
                          bgcolor: on ? color : alpha(color, 0.15),
                          transform: "scale(1.05)",
                        },
                        "&::before": !on
                          ? {
                              content: '""',
                              position: "absolute",
                              left: 8,
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              bgcolor: color,
                            }
                          : {},
                        pl: !on ? 2.5 : 1.5,
                        position: "relative",
                      }}
                    />
                  );
                })}
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Entries / Exits toggle (right, Status 11 style) */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.grey[500], 0.06),
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1.5,
                  bgcolor: !showExits ? alpha("#5C4A3F", 0.15) : "transparent",
                  transition: "background-color 0.2s ease-in-out",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha("#5C4A3F", 0.1) },
                }}
                onClick={() => {
                  setShowExits(false);
                  setChartKey((k) => k + 1);
                }}
              >
                <Box
                  sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#5C4A3F", opacity: !showExits ? 1 : 0.4 }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: !showExits ? 600 : 400,
                    color: !showExits ? "#5C4A3F" : "text.secondary",
                    transition: "font-weight 0.2s ease-in-out, color 0.2s ease-in-out",
                    userSelect: "none",
                  }}
                >
                  Entries
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1.5,
                  bgcolor: showExits ? alpha(brand.primaryDark, 0.15) : "transparent",
                  transition: "background-color 0.2s ease-in-out",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha(brand.primaryDark, 0.1) },
                }}
                onClick={() => {
                  setShowExits(true);
                  setChartKey((k) => k + 1);
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: brand.primaryDark,
                    opacity: showExits ? 1 : 0.4,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: showExits ? 600 : 400,
                    color: showExits ? brand.primaryDark : "text.secondary",
                    transition: "font-weight 0.2s ease-in-out, color 0.2s ease-in-out",
                    userSelect: "none",
                  }}
                >
                  Exits
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Chart */}
          <Box ref={chartWrapperRef}>
            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart
                accessibilityLayer={false}
                barGap={0}
                key={`pipeline-${chartKey}-${yearsSorted.join("-")}`}
                data={chartData}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="monthName"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                />
                {/* Left Y-axis: bars (entries/exits) */}
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `${Math.round(v / 1000000)} M€`}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                />
                {/* Right Y-axis: line (stock) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${Math.round(v / 1000000)} M€`}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                />
                <Tooltip
                  offset={50}
                  position={{ y: 0 }}
                  wrapperStyle={{ zIndex: 1000 }}
                  content={
                    <PipelineStockTooltip
                      pipelineData={monthlyData}
                      showNetRevenue={showNetRevenue}
                      showExits={showExits}
                      showIO={showIO}
                      yearColors={COLOR_BY_YEAR}
                    />
                  }
                />

                {/* Bars: entries or stacked exits (booked + lost) per year */}
                {showExits
                  ? yearsSorted.map((year) => (
                      <React.Fragment key={`exits-${year}`}>
                        <Bar
                          yAxisId="left"
                          dataKey={`${year}_exits_booked`}
                          stackId={`exits-${year}`}
                          fill={COLOR_BY_YEAR[year]?.bar || brand.primaryDark}
                          name={`${year} Booked`}
                          shape={exitShapes[year]?.booked}
                          isAnimationActive={!hasRenderedRef.current}
                          animationDuration={600}
                          cursor="pointer"
                          activeBar={false}
                          onClick={handleBarClick(year)}
                        >
                          {chartData.map((d, i) => (
                            <Cell key={i} opacity={cellOpacity(d.month, year, 0.9)} />
                          ))}
                        </Bar>
                        <Bar
                          yAxisId="left"
                          dataKey={`${year}_exits_lost`}
                          stackId={`exits-${year}`}
                          fill={COLOR_BY_YEAR[year]?.bar || brand.primaryDark}
                          fillOpacity={0.35}
                          name={`${year} Lost`}
                          shape={exitShapes[year]?.lost}
                          isAnimationActive={!hasRenderedRef.current}
                          animationDuration={600}
                          cursor="pointer"
                          activeBar={false}
                          onClick={handleBarClick(year)}
                        >
                          {chartData.map((d, i) => (
                            <Cell key={i} opacity={cellOpacity(d.month, year, 1)} />
                          ))}
                        </Bar>
                      </React.Fragment>
                    ))
                  : yearsSorted.map((year) => (
                      <Bar
                        key={`bar-${year}`}
                        yAxisId="left"
                        dataKey={`${year}_entries`}
                        fill={COLOR_BY_YEAR[year]?.bar || brand.primaryDark}
                        name={`${year} Entries`}
                        shape={roundedBarShapeTop([`${year}_entries`])}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={600}
                        animationEasing="ease-out"
                        cursor="pointer"
                        onClick={handleBarClick(year)}
                      >
                        {chartData.map((d, i) => (
                          <Cell key={i} opacity={cellOpacity(d.month, year, 0.85)} />
                        ))}
                      </Bar>
                    ))}

                {/* Lines: pipeline stock at end of month — dimmed when a month is selected */}
                {yearsSorted.map((year) => (
                  <Line
                    key={`line-${year}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`${year}_stock`}
                    stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                    strokeWidth={2}
                    strokeOpacity={localHighlight ? 0.2 : 1}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5, style: { pointerEvents: "none" } }}
                    name={`${year} Pipeline Stock`}
                    isAnimationActive={!hasRenderedRef.current}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </Box>

          {/* Monthly Details Table */}
          <Box sx={{ mt: 1 }}>
            <MonthlyDetailsTable
              cumulativeData={detailsTableData}
              years={years}
              selectedYears={selectedYears}
              yearColors={COLOR_BY_YEAR}
              hasFiltersApplied={false}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              theme={theme}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }
);

CumulativePipelineChart.displayName = "CumulativePipelineChart";
export default CumulativePipelineChart;
