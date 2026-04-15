import React from "react";
import { Box, Paper, Typography, Divider, useTheme, IconButton, Tooltip as MuiTooltip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { RevenueChartTooltip } from "./ChartTooltips";

// BearingPoint color palette
const COLORS = [
  "#FF3D47", // Bearing Red
  "#806659", // Warm Grey
  "#98847A", // Medium Grey
  "#5C4A3F", // Dark Grey
  "#D6CCC5", // Light Grey
  "#B2A59F", // Grey 40
  "#CCC1BC", // Grey 30
  "#E6DEDA", // Grey 20
];

/**
 * Simple horizontal bar chart for Bookings/Lost by Segment or Service Line
 * Matches PipelineTab design with clickable bars for drill-down
 *
 * @param {Array} data - Array of { name, value, count } objects
 * @param {string} title - Chart title
 * @param {boolean} showIO - Whether to show I&O data
 * @param {string} valueKey - Key for the value (default: 'value')
 * @param {Function} onChartClick - Click handler for filtering
 * @param {Function} onBackClick - Back button handler for drill-down
 * @param {boolean} isDrillDown - Whether currently in drill-down mode
 * @param {Function} onToggleMode - Toggle button handler (optional)
 * @param {string} toggleTooltip - Tooltip text for toggle button (optional)
 * @param {boolean} showToggle - Whether to show toggle button
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
  }) => {
    const theme = useTheme();

    // Sort data by value descending and take top items
    const sortedData = [...data]
      .sort((a, b) => b[valueKey] - a[valueKey])
      .slice(0, 10) // Top 10
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

    // Currency formatter for labels
    const formatCompact = (value) =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value);

    // Custom label render function to show count and value stacked (count on top, value below)
    // When there's an allocation difference, show: total → allocated (independent of showIO)
    const renderCustomLabel = (props) => {
      const { x, y, width, height, value, index } = props;
      const entry = sortedData[index];
      const originalValue = entry?.originalValue || 0;
      const allocatedValue = entry?.allocatedValue;

      // Check if there's an allocation difference (independent of showIO toggle)
      const hasAllocation = allocatedValue !== undefined && allocatedValue !== originalValue;

      const formattedTotal = formatCompact(originalValue);
      const formattedAllocated = hasAllocation ? formatCompact(allocatedValue) : null;

      return (
        <g>
          <text
            x={x + width + 8}
            y={y + height / 2 - 6}
            fill={theme.palette.text.secondary}
            fontSize={11}
            fontWeight={600}
            dominantBaseline="middle"
          >
            {value} opps
          </text>
          <text
            x={x + width + 8}
            y={y + height / 2 + 8}
            fill={theme.palette.text.disabled}
            fontSize={10}
            dominantBaseline="middle"
          >
            {hasAllocation ? `${formattedTotal} → ${formattedAllocated}` : formattedTotal}
          </text>
        </g>
      );
    };

    if (!data || data.length === 0) {
      return (
        <Paper
          elevation={2}
          sx={{
            p: 3,
            height: "100%",
            borderRadius: 3,
            transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
            "&:hover": {
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
                      color: theme.palette.primary.main,
                      "&:hover": {
                        backgroundColor: theme.palette.primary.light + "20",
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
                      backgroundColor: theme.palette.primary.light + "20",
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
        elevation={2}
        sx={{
          p: 3,
          height: "100%",
          borderRadius: 3,
          transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
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
                    color: theme.palette.primary.main,
                    "&:hover": {
                      backgroundColor: theme.palette.primary.light + "20",
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
                    backgroundColor: theme.palette.primary.light + "20",
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
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 70, left: 20, bottom: 5 }}
            onClick={onChartClick}
            animationDuration={600}
            animationEasing="ease-in-out"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              tickFormatter={(value) =>
                new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  notation: "compact",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value)
              }
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
            {/* Allocated portion (darker color) */}
            <Bar
              dataKey="allocatedValue"
              name="Allocated"
              stackId="revenue"
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-allocated-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
            {/* Non-allocated portion (lighter/striped color) */}
            <Bar
              dataKey="nonAllocatedValue"
              name="Other"
              stackId="revenue"
              radius={[0, 4, 4, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-other-${index}`} fill={`${COLORS[index % COLORS.length]}40`} />
              ))}
              <LabelList dataKey="count" content={renderCustomLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }
);

SimpleBarChart.displayName = "SimpleBarChart";

export default SimpleBarChart;
