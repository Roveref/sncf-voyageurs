/**
 * BookingsTimelineCharts — Cumulative bookings chart.
 * Chart rendering is a mirror of CumulativePipelineChart with Bookings-specific features:
 * - Source breakdown (CRM Original / Manual / Modified / Status 11)
 * - Status 11 toggle
 * - Lost mode
 */

import React, { useState, useMemo, useCallback, memo } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import { useTheme, alpha } from "@mui/material/styles";

import { keyframes as animationKeyframes } from "../../../styles/animations";

import { ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { CustomTooltip, MonthlyDetailsTable, SOURCE_COLORS } from "./index";
import { brand } from "../../../config/brandConfig";
import { roundedBarShapeTop } from "../../PipelineTab/components/RoundedBarShape";

interface ChartFilter {
  type: string;
  value: string;
}

interface BookingsTimelineChartsProps {
  cumulativeData: any[];
  cumulativeLossData: any[];
  years: number[];
  lossYears: number[];
  selectedYears: number[];
  setSelectedYears: (years: number[] | ((prev: number[]) => number[])) => void;
  includeStatus11: boolean;
  showSourceBreakdown: boolean;
  setShowSourceBreakdown: (value: boolean | ((prev: boolean) => boolean)) => void;
  curveVisibility: Record<string, boolean>;
  chartKey: number;
  setChartKey: (value: number | ((prev: number) => number)) => void;
  chartFilter: ChartFilter | null;
  setChartFilter: React.Dispatch<React.SetStateAction<ChartFilter | null>>;
  showNetRevenue: boolean;
  showIO: boolean;
  showLost: boolean;
  handleStatus11Toggle: () => void;
  COLOR_BY_YEAR: Record<number, { bar: string; line: string; opacity: number }>;
  yearOptions: Array<{ value: number; label: string; color: string }>;
}

const BookingsTimelineCharts = memo(
  ({
    cumulativeData,
    cumulativeLossData,
    years,
    lossYears,
    selectedYears,
    setSelectedYears,
    includeStatus11,
    showSourceBreakdown,
    setShowSourceBreakdown,
    curveVisibility,
    chartKey,
    setChartKey,
    chartFilter,
    setChartFilter,
    showNetRevenue,
    showIO,
    showLost,
    handleStatus11Toggle,
    COLOR_BY_YEAR,
    yearOptions,
  }: BookingsTimelineChartsProps) => {
    const theme = useTheme();

    // ── Exact same chart engine as CumulativePipelineChart ──

    // Only animate on first render, not on re-renders
    const hasRenderedRef = React.useRef(false);
    React.useEffect(() => {
      hasRenderedRef.current = true;
    }, []);

    // Local highlight state (same as Pipeline — prevents parent re-render flash)
    const [localHighlight, setLocalHighlight] = useState<string | null>(null);
    React.useEffect(() => {
      setLocalHighlight(chartFilter?.type === "month" ? chartFilter.value : null);
    }, [chartFilter]);

    const activeMonthNum = localHighlight ? Number(localHighlight.split(":")[0]) : -1;
    const activeYearNum = localHighlight ? Number(localHighlight.split(":")[1]) : -1;

    // Per-cell opacity (same as Pipeline)
    const cellOpacity = (month: number, year: number, base: number) => {
      if (activeMonthNum < 0) return base;
      if (month === activeMonthNum && year === activeYearNum) return 1;
      return 0.3;
    };

    // Memoized rounded-top shape functions for stacked source breakdown bars
    const sourceBreakdownShapes = useMemo(() => {
      const shapes: Record<number, Record<string, (props: any) => React.ReactElement | null>> = {};
      for (const year of selectedYears) {
        const stackKeys = includeStatus11
          ? [`${year}_src_crmOriginal`, `${year}_status11`, `${year}_src_manual`, `${year}_src_crmModified`]
          : [`${year}_src_crmOriginal`, `${year}_src_manual`, `${year}_src_crmModified`];
        const map: Record<string, (props: any) => React.ReactElement | null> = {};
        for (const k of stackKeys) map[k] = roundedBarShapeTop(stackKeys);
        shapes[year] = map;
      }
      return shapes;
    }, [selectedYears, includeStatus11]);

    // Chart data — no zeroing on click (keeps Y-axis stable, same as Pipeline)
    const filteredChartData = useMemo(
      () => (showLost ? cumulativeLossData : cumulativeData),
      [cumulativeData, cumulativeLossData, showLost]
    );

    // Bar click handler (same pattern as Pipeline handleBarClick)
    const createBarClickHandler = useCallback(
      (year: number) => (barData: any) => {
        if (!barData?.payload) return;
        const month = barData.payload.month;
        if (month == null) return;
        const filterValue = `${month}:${year}`;
        const isDeselect = localHighlight === filterValue;
        setLocalHighlight(isDeselect ? null : filterValue);
        requestAnimationFrame(() => {
          setChartFilter(isDeselect ? null : { type: "month", value: filterValue });
        });
      },
      [localHighlight, setChartFilter]
    );

    const yearsSorted = [...selectedYears].sort((a, b) => a - b);

    return (
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": { transform: "translateY(-4px)", boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)" },
          ...animationKeyframes.fadeInUp,
          animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 400ms both",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* ── Header (same layout as Pipeline) ── */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h6" fontWeight={700}>
              {showLost ? "Déclassements cumulés" : "Maintenance cumulative"}
            </Typography>

            {/* Year selector chips */}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              {yearOptions.map((option) => {
                const on = selectedYears.includes(option.value);
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    size="small"
                    onClick={() => {
                      if (on) setSelectedYears(selectedYears.filter((y) => y !== option.value));
                      else setSelectedYears([...selectedYears, option.value]);
                    }}
                    sx={{
                      bgcolor: on ? option.color : alpha(option.color, 0.08),
                      color: on ? "white" : "text.secondary",
                      border: "none",
                      fontWeight: on ? 600 : 400,
                      transition:
                        "background-color 0.2s ease-in-out, color 0.2s ease-in-out, transform 0.2s ease-in-out",
                      "&:hover": { bgcolor: on ? option.color : alpha(option.color, 0.15), transform: "scale(1.05)" },
                      "&::before": !on
                        ? {
                            content: '""',
                            position: "absolute",
                            left: 8,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            bgcolor: option.color,
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

            {/* Bookings-specific toggles: Status 11 + Source Breakdown */}
            {!showLost && (
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
                {/* Status 11 Toggle */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: includeStatus11 ? alpha(SOURCE_COLORS.status11, 0.15) : "transparent",
                    transition: "background-color 0.2s ease-in-out",
                    cursor: "pointer",
                    "&:hover": { bgcolor: alpha(SOURCE_COLORS.status11, 0.1) },
                  }}
                  onClick={handleStatus11Toggle}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: SOURCE_COLORS.status11,
                      opacity: includeStatus11 ? 1 : 0.4,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: includeStatus11 ? 600 : 400,
                      color: includeStatus11 ? SOURCE_COLORS.status11 : "text.secondary",
                      userSelect: "none",
                    }}
                  >
                    Maintenance lourde
                  </Typography>
                  <Switch
                    size="small"
                    checked={includeStatus11}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleStatus11Toggle();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      width: 32,
                      height: 18,
                      padding: 0,
                      ml: 0.5,
                      "& .MuiSwitch-switchBase": {
                        padding: "2px",
                        "&.Mui-checked": {
                          color: SOURCE_COLORS.status11,
                          "& + .MuiSwitch-track": { bgcolor: alpha(SOURCE_COLORS.status11, 0.5) },
                        },
                      },
                      "& .MuiSwitch-thumb": { width: 14, height: 14 },
                      "& .MuiSwitch-track": { borderRadius: 9 },
                    }}
                  />
                </Box>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Source Breakdown Toggle */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: showSourceBreakdown ? alpha(theme.palette.secondary.main, 0.15) : "transparent",
                    transition: "background-color 0.2s ease-in-out",
                    cursor: "pointer",
                    "&:hover": { bgcolor: alpha(theme.palette.secondary.main, 0.1) },
                  }}
                  onClick={() => {
                    setShowSourceBreakdown(!showSourceBreakdown);
                    setChartKey((prev) => prev + 1);
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: theme.palette.secondary.main,
                      opacity: showSourceBreakdown ? 1 : 0.4,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: showSourceBreakdown ? 600 : 400,
                      color: showSourceBreakdown ? "secondary.main" : "text.secondary",
                      userSelect: "none",
                    }}
                  >
                    Détail par source
                  </Typography>
                  <Switch
                    size="small"
                    checked={showSourceBreakdown}
                    onChange={() => {
                      setShowSourceBreakdown(!showSourceBreakdown);
                      setChartKey((prev) => prev + 1);
                    }}
                    color="secondary"
                    sx={{
                      width: 32,
                      height: 18,
                      padding: 0,
                      ml: 0.5,
                      "& .MuiSwitch-switchBase": { padding: "2px" },
                      "& .MuiSwitch-thumb": { width: 14, height: 14 },
                      "& .MuiSwitch-track": { borderRadius: 9 },
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* ── Chart (exact same structure as CumulativePipelineChart) ── */}
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
              accessibilityLayer={false}
              barGap={0}
              key={`bookings-${chartKey}-${yearsSorted.join("-")}`}
              data={filteredChartData}
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
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => `${Math.round(v / 1000000)} M€`}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${Math.round(v / 1000000)} M€`}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <Tooltip
                offset={50}
                content={
                  <CustomTooltip
                    cumulativeData={showLost ? cumulativeLossData : cumulativeData}
                    showNetRevenue={showNetRevenue}
                    curveVisibility={curveVisibility}
                    includeStatus11={showLost ? false : includeStatus11}
                    showIOGlobal={showIO}
                    showSourceBreakdown={showSourceBreakdown}
                    yearColors={COLOR_BY_YEAR}
                  />
                }
              />

              {/* ── Bars ── */}
              {showSourceBreakdown && !showLost
                ? // Stacked source breakdown bars
                  yearsSorted.map((year) => (
                    <React.Fragment key={`bars-${year}`}>
                      <Bar
                        yAxisId="left"
                        dataKey={`${year}_src_crmOriginal`}
                        stackId={`stack-${year}`}
                        fill={COLOR_BY_YEAR[year]?.bar || brand.primaryDark}
                        name={`${year} CRM Original`}
                        shape={sourceBreakdownShapes[year]?.[`${year}_src_crmOriginal`]}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={600}
                        cursor="pointer"
                        onClick={createBarClickHandler(year)}
                      >
                        {filteredChartData.map((d, i) => (
                          <Cell key={i} opacity={cellOpacity(d.month, year, 0.85)} />
                        ))}
                      </Bar>
                      {includeStatus11 && (
                        <Bar
                          yAxisId="left"
                          dataKey={`${year}_status11`}
                          stackId={`stack-${year}`}
                          fill={SOURCE_COLORS.status11}
                          name={`${year} Status 11`}
                          shape={sourceBreakdownShapes[year]?.[`${year}_status11`]}
                          isAnimationActive={!hasRenderedRef.current}
                          animationDuration={600}
                          cursor="pointer"
                          onClick={createBarClickHandler(year)}
                        >
                          {filteredChartData.map((d, i) => (
                            <Cell key={i} opacity={cellOpacity(d.month, year, 0.9)} />
                          ))}
                        </Bar>
                      )}
                      <Bar
                        yAxisId="left"
                        dataKey={`${year}_src_manual`}
                        stackId={`stack-${year}`}
                        fill={SOURCE_COLORS.manual}
                        name={`${year} Manual`}
                        shape={sourceBreakdownShapes[year]?.[`${year}_src_manual`]}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={600}
                        cursor="pointer"
                        onClick={createBarClickHandler(year)}
                      >
                        {filteredChartData.map((d, i) => (
                          <Cell key={i} opacity={cellOpacity(d.month, year, 0.85)} />
                        ))}
                      </Bar>
                      <Bar
                        yAxisId="left"
                        dataKey={`${year}_src_crmModified`}
                        stackId={`stack-${year}`}
                        fill={SOURCE_COLORS.crmModified}
                        name={`${year} Modified`}
                        shape={sourceBreakdownShapes[year]?.[`${year}_src_crmModified`]}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={600}
                        cursor="pointer"
                        onClick={createBarClickHandler(year)}
                      >
                        {filteredChartData.map((d, i) => (
                          <Cell key={i} opacity={cellOpacity(d.month, year, 0.85)} />
                        ))}
                      </Bar>
                    </React.Fragment>
                  ))
                : // Normal single bar per year (same as Pipeline entries)
                  yearsSorted.map((year) => {
                    const dataKey = !showLost && includeStatus11 ? `${year}_combined_total` : `${year}`;
                    return (
                      <Bar
                        key={`bar-${year}`}
                        yAxisId="left"
                        dataKey={dataKey}
                        fill={COLOR_BY_YEAR[year]?.bar || brand.primaryDark}
                        name={`${year} ${showLost ? "Déclassés" : "Maintenance"}`}
                        shape={roundedBarShapeTop([dataKey])}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={600}
                        animationEasing="ease-out"
                        cursor="pointer"
                        onClick={createBarClickHandler(year)}
                      >
                        {filteredChartData.map((d, i) => (
                          <Cell key={i} opacity={cellOpacity(d.month, year, 0.85)} />
                        ))}
                      </Bar>
                    );
                  })}

              {/* ── Lines: cumulative — dimmed when a month is selected (same as Pipeline) ── */}
              {showSourceBreakdown && !showLost
                ? yearsSorted.map((year) => (
                    <React.Fragment key={`lines-${year}`}>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={`${year}_src_crmOriginal_cumulative`}
                        stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                        strokeWidth={2}
                        strokeOpacity={localHighlight ? 0.2 : 1}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4, style: { pointerEvents: "none" } }}
                        name={`${year} CRM Original`}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={includeStatus11 ? `${year}_combined_cumulative` : `${year}_cumulative`}
                        stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                        strokeWidth={2}
                        strokeOpacity={localHighlight ? 0.2 : 1}
                        strokeDasharray="5 5"
                        dot={{ r: 2, strokeDasharray: "0" }}
                        activeDot={{ r: 4, strokeDasharray: "0", style: { pointerEvents: "none" } }}
                        name={`${year} Total`}
                        isAnimationActive={!hasRenderedRef.current}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    </React.Fragment>
                  ))
                : yearsSorted.map((year) => (
                    <Line
                      key={`line-${year}`}
                      yAxisId="right"
                      type="monotone"
                      dataKey={!showLost && includeStatus11 ? `${year}_combined_cumulative` : `${year}_cumulative`}
                      stroke={COLOR_BY_YEAR[year]?.line || "#A11F26"}
                      strokeWidth={2}
                      strokeOpacity={localHighlight ? 0.2 : 1}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5, style: { pointerEvents: "none" } }}
                      name={`${year} Cumulative`}
                      isAnimationActive={!hasRenderedRef.current}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    />
                  ))}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Monthly Details Table */}
          <Box sx={{ mt: 1 }}>
            <MonthlyDetailsTable
              cumulativeData={showLost ? cumulativeLossData : cumulativeData}
              years={showLost ? lossYears : years}
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

BookingsTimelineCharts.displayName = "BookingsTimelineCharts";

export default BookingsTimelineCharts;
