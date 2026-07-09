import React from "react";
import { roundedBarShape } from "../../PipelineTab/components/RoundedBarShape";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MuiTooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Customized,
  useXAxisScale,
  useYAxisTicks,
} from "recharts";
import { RevenueChartTooltip } from "./ChartTooltips";
import { formatCompactCurrency } from "../../../utils/formatters";
import { chartPalette, serviceLineColors, brand } from "../../../config/brandConfig";

// GAIF color palette (from brandConfig)
const COLORS = [...chartPalette];

// Couleur alignée avec le reste : si le nom est un patrimoine GAIF connu, on utilise
// la couleur brand (serviceLineColors). Sinon (ex. sites), dégradé brand primary.
const SITE_SHADES = [brand.primary, brand.primaryDark, brand.primaryLight, brand.primaryDeep, brand.primaryLighter];

const resolveBarColor = (name: string, index: number): string => {
  if (!name) return COLORS[index % COLORS.length];
  if (serviceLineColors[name]) return serviceLineColors[name];
  return SITE_SHADES[index % SITE_SHADES.length];
};

/**
 * Custom labels rendered using Recharts v3 hooks
 */
const BarEndLabels = ({ data, textColor }: { data: any[]; textColor: string }) => {
  const xScale = useXAxisScale();
  const yTicks = useYAxisTicks();

  if (!xScale || !yTicks?.length || !data?.length) return null;

  return (
    <g className="bar-end-labels">
      {data.map((entry, i) => {
        const total = entry.originalValue || 0;
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
              {formatCompactCurrency(total)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * Simple horizontal bar chart for Bookings/Lost by Segment or Service Line
 */
const SimpleBarChart = React.memo(
  ({
    data = [],
    title = "Chart",
    showIO = false,
    valueKey = "value",
    onChartClick,
    onBackClick,
    isDrillDown = false,
    onToggleMode,
    toggleTooltip = "",
    showToggle = false,
  }: any) => {
    const theme = useTheme();

    // Sort data by value descending and take top items
    const sortedData = [...data]
      .sort((a, b) => b[valueKey] - a[valueKey])
      .slice(0, 10)
      .map((item) => {
        const total = item[valueKey] || 0;
        const allocated = item.allocatedValue !== undefined ? item.allocatedValue : total;
        const nonAllocated = Math.max(0, total - allocated);
        return {
          ...item,
          originalValue: total,
          allocatedValue: allocated,
          nonAllocatedValue: nonAllocated,
          hasAllocation: allocated !== total,
        };
      });

    // Recharts v3: Bar-level onClick, convert to legacy activePayload format
    const handleBarClick = (barData: any) => {
      if (onChartClick) {
        onChartClick({ activePayload: [barData] });
      }
    };

    if (!data || data.length === 0) {
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
              {isDrillDown && onBackClick && (
                <MuiTooltip title="Retour">
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
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0 }}>
                {title}
              </Typography>
            </Box>
            {showToggle && onToggleMode && (
              <MuiTooltip title={toggleTooltip}>
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
            )}
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 300,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No data available
            </Typography>
          </Box>
        </Paper>
      );
    }

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
            {isDrillDown && onBackClick && (
              <MuiTooltip title="Back">
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
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0 }}>
              {title}
            </Typography>
          </Box>
          {showToggle && onToggleMode && (
            <MuiTooltip title={toggleTooltip}>
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
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            accessibilityLayer={false}
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 70, left: 20, bottom: 5 }}
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
            <Tooltip content={<RevenueChartTooltip showIO={showIO} />} />
            {/* Allocated portion (solid color) */}
            <Bar
              dataKey="allocatedValue"
              name="Allocated"
              stackId="revenue"
              shape={roundedBarShape(["allocatedValue", "nonAllocatedValue"])}
              animationBegin={0}
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={true}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-allocated-${index}`} fill={resolveBarColor(entry.name, index)} />
              ))}
            </Bar>
            {/* Non-allocated portion (lighter color) */}
            <Bar
              dataKey="nonAllocatedValue"
              name="Other"
              stackId="revenue"
              shape={roundedBarShape(["allocatedValue", "nonAllocatedValue"])}
              animationBegin={100}
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={true}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-other-${index}`} fill={`${resolveBarColor(entry.name, index)}40`} />
              ))}
            </Bar>
            {/* Labels at bar ends using Recharts v3 hooks */}
            <Customized component={<BarEndLabels data={sortedData} textColor={theme.palette.text.secondary} />} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }
);

SimpleBarChart.displayName = "SimpleBarChart";

export default SimpleBarChart;
