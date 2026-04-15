import React from "react";
import { roundedBarShape } from "./RoundedBarShape";
/**
 * AccountChart Component
 * Displays stacked bar chart of pipeline by account
 * Performance-optimized with React.memo
 */

import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MuiTooltip from "@mui/material/Tooltip";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import { alpha, useTheme } from "@mui/material/styles";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Customized,
  useXAxisScale,
  useYAxisTicks,
} from "recharts";
import { StatusChartTooltip } from "./ChartTooltips";
import { formatCompactCurrency } from "../../../utils/formatters";

// BearingPoint brand colors for Allocated and Others
const COLORS = {
  earlyOthers: "#FFBDC0",
  midOthers: "#FFA3A8",
  lateOthers: "#FF787A",
};

/**
 * Custom labels rendered using Recharts v3 hooks (useXAxisScale, useYAxisScale)
 * to position labels at the end of each stacked bar.
 */
const BarTotalLabels = ({ data, textColor }: { data: any[]; textColor: string }) => {
  const xScale = useXAxisScale();
  const yTicks = useYAxisTicks();

  if (!xScale || !yTicks?.length || !data?.length) return null;

  return (
    <g className="bar-total-labels">
      {data.map((entry, i) => {
        const total =
          (entry.earlyAllocated || 0) +
          (entry.earlyNonAllocated || 0) +
          (entry.midAllocated || 0) +
          (entry.midNonAllocated || 0) +
          (entry.lateAllocated || 0) +
          (entry.lateNonAllocated || 0);
        const displayTotal = (entry.early || 0) + (entry.mid || 0) + (entry.late || 0);
        const count = entry.count || 0;
        const xPos = xScale(total) as number;
        const tick = yTicks[i];
        if (!tick) return null;
        const yPos = tick.coordinate;

        if (isNaN(xPos) || isNaN(yPos)) return null;

        return (
          <g key={entry.name || i}>
            <text
              x={xPos + 10}
              y={yPos - 6}
              fill={textColor}
              fontSize={10}
              fontWeight={500}
              textAnchor="start"
              dominantBaseline="middle"
            >
              {count} opp{count !== 1 ? "s" : ""}
            </text>
            <text
              x={xPos + 10}
              y={yPos + 6}
              fill={textColor}
              fontSize={10}
              fontWeight={600}
              textAnchor="start"
              dominantBaseline="middle"
            >
              {formatCompactCurrency(displayTotal)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const AccountChart = React.memo(
  ({
    data,
    onChartClick,
    showIO,
    showSegmentMode = false,
    onToggleMode,
    drillDownSegment = null,
    drillDownSubSegment = null,
    filteredAccount = null,
    onBackClick,
    onClearAllDrillDown,
  }: any) => {
    const theme = useTheme();

    // Recharts v3: Bar-level onClick, convert to legacy activePayload format
    const handleBarClick = (barData: any) => {
      if (onChartClick) {
        onChartClick({ activePayload: [barData] });
      }
    };

    const isSegmentDrillActive = showSegmentMode && Boolean(drillDownSegment || drillDownSubSegment);
    const isAccountDrillActive = !showSegmentMode && Boolean(filteredAccount);
    const isDrillActive = isSegmentDrillActive || isAccountDrillActive;

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          height: "100%",
          borderRadius: 3,
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            minHeight: "32px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {isDrillActive && (
              <MuiTooltip
                title={
                  isSegmentDrillActive
                    ? drillDownSubSegment
                      ? "Back to Sub-Segments"
                      : "Back to Segments"
                    : "Back to Accounts"
                }
              >
                <IconButton
                  onClick={onBackClick}
                  size="small"
                  sx={{
                    width: 28,
                    height: 28,
                    padding: 0.5,
                    color: "text.secondary",
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.text.secondary, 0.08),
                    },
                  }}
                >
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </MuiTooltip>
            )}
            {isSegmentDrillActive ? (
              <MuiBreadcrumbs aria-label="segment drill-down" sx={{ "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}>
                <Link
                  component="button"
                  variant="h6"
                  fontWeight={700}
                  underline="hover"
                  color="text.secondary"
                  onClick={onClearAllDrillDown ?? onBackClick}
                  sx={{ cursor: "pointer", fontSize: "inherit", lineHeight: "inherit" }}
                >
                  Segments
                </Link>
                {drillDownSubSegment ? (
                  <Link
                    component="button"
                    variant="h6"
                    fontWeight={700}
                    underline="hover"
                    color="text.secondary"
                    onClick={onBackClick}
                    sx={{ cursor: "pointer", fontSize: "inherit", lineHeight: "inherit" }}
                  >
                    {drillDownSegment}
                  </Link>
                ) : null}
                <Typography variant="h6" fontWeight={700} color="text.primary" noWrap>
                  {drillDownSubSegment ?? drillDownSegment}
                </Typography>
              </MuiBreadcrumbs>
            ) : isAccountDrillActive ? (
              <MuiBreadcrumbs aria-label="account drill-down" sx={{ "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}>
                <Link
                  component="button"
                  variant="h6"
                  fontWeight={700}
                  underline="hover"
                  color="text.secondary"
                  onClick={onBackClick}
                  sx={{ cursor: "pointer", fontSize: "inherit", lineHeight: "inherit" }}
                >
                  Accounts
                </Link>
                <Typography variant="h6" fontWeight={700} color="text.primary" noWrap>
                  {filteredAccount}
                </Typography>
              </MuiBreadcrumbs>
            ) : (
              <Typography variant="h6" fontWeight={700}>
                {showSegmentMode ? "Pipeline by Segment" : "Pipeline by Account"}
              </Typography>
            )}
          </Box>
          <MuiTooltip title={showSegmentMode ? "Show by Account" : "Show by Segment"}>
            <IconButton
              onClick={onToggleMode}
              size="small"
              sx={{
                color: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                },
              }}
            >
              <SwapHorizIcon />
            </IconButton>
          </MuiTooltip>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            accessibilityLayer={false}
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
          >
            <defs />

            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, "dataMax"]}
              tickFormatter={(value) => formatCompactCurrency(value)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            />
            <Tooltip content={<StatusChartTooltip showIO={showIO} />} />
            {(() => {
              const STACK = [
                "earlyAllocated",
                "earlyNonAllocated",
                "midAllocated",
                "midNonAllocated",
                "lateAllocated",
                "lateNonAllocated",
              ];
              const shape = roundedBarShape(STACK);
              const bars = [
                {
                  key: "earlyAllocated",
                  name: "Lead Identified → Go Approved (Allocated)",
                  fill: theme.palette.primary.light,
                },
                {
                  key: "earlyNonAllocated",
                  name: "Lead Identified → Go Approved (Other)",
                  fill: COLORS.earlyOthers,
                },
                { key: "midAllocated", name: "Proposal Submitted (Allocated)", fill: theme.palette.primary.main },
                { key: "midNonAllocated", name: "Proposal Submitted (Other)", fill: COLORS.midOthers },
                { key: "lateAllocated", name: "Client Won → AEL (Allocated)", fill: theme.palette.primary.dark },
                { key: "lateNonAllocated", name: "Client Won → AEL (Other)", fill: COLORS.lateOthers },
              ];
              return bars.map((b, i) => (
                <Bar
                  key={b.key}
                  dataKey={b.key}
                  name={b.name}
                  stackId="a"
                  fill={b.fill}
                  shape={shape}
                  animationBegin={i * 50}
                  animationDuration={600}
                  animationEasing="ease-out"
                  isAnimationActive={true}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              ));
            })()}
            {/* Labels at bar ends using Recharts v3 hooks */}
            <Customized component={<BarTotalLabels data={data} textColor={theme.palette.text.secondary} />} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }
);

AccountChart.displayName = "AccountChart";

export default React.memo(AccountChart);
