import React, { useMemo } from "react";
import { roundedBarShape } from "./RoundedBarShape";
/**
 * StatusChart Component
 * Displays stacked bar chart of pipeline by status and service line
 * Performance-optimized with React.memo
 */

import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Customized,
  useXAxisScale,
  useYAxisTicks,
} from "recharts";
import { StatusChartTooltip } from "./ChartTooltips";
import { formatCompactCurrency } from "../../../utils/formatters";

// GAIF brand colors
const COLORS = {
  earlyOthers: "#FFBDC0",
  midOthers: "#FFA3A8",
  lateOthers: "#FF787A",
};

/**
 * Custom labels rendered using Recharts v3 hooks
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
              {count} actif{count !== 1 ? "s" : ""}
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

const StatusChart = React.memo(
  ({ data, onChartClick, showIO, drillDownServiceLine, drillDownOffering, onBackClick, onClearAllDrillDown }: any) => {
    const theme = useTheme();

    // Recharts v3: Bar-level onClick, convert to legacy activePayload format
    const handleBarClick = (barData: any) => {
      if (onChartClick) {
        onChartClick({ activePayload: [barData] }, true);
      }
    };

    const isDrillActive = Boolean(drillDownServiceLine || drillDownOffering);

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
              <Tooltip title={drillDownOffering ? "Retour aux sites" : "Retour aux entités"}>
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
              </Tooltip>
            )}
            {isDrillActive ? (
              <MuiBreadcrumbs
                aria-label="service line drill-down"
                sx={{ "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
              >
                <Link
                  component="button"
                  variant="h6"
                  fontWeight={700}
                  underline="hover"
                  color="text.secondary"
                  onClick={onClearAllDrillDown ?? onBackClick}
                  sx={{ cursor: "pointer", fontSize: "inherit", lineHeight: "inherit" }}
                >
                  Parc par entité
                </Link>
                {drillDownOffering ? (
                  <Link
                    component="button"
                    variant="h6"
                    fontWeight={700}
                    underline="hover"
                    color="text.secondary"
                    onClick={onBackClick}
                    sx={{ cursor: "pointer", fontSize: "inherit", lineHeight: "inherit" }}
                  >
                    {drillDownServiceLine}
                  </Link>
                ) : null}
                <Typography variant="h6" fontWeight={700} color="text.primary" noWrap>
                  {drillDownOffering ?? drillDownServiceLine}
                </Typography>
              </MuiBreadcrumbs>
            ) : (
              <Typography variant="h6" fontWeight={700}>
                Parc par entité
              </Typography>
            )}
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            accessibilityLayer={false}
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
          >
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
            <RechartsTooltip content={<StatusChartTooltip showIO={showIO} />} />
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

StatusChart.displayName = "StatusChart";

export default React.memo(StatusChart);
