import React from "react";
/**
 * AccountChart Component
 * Displays stacked bar chart of pipeline by account
 * Performance-optimized with React.memo
 */

import { Paper, Box, Typography, Divider, useTheme, IconButton, Tooltip as MuiTooltip } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { StatusChartTooltip } from "./ChartTooltips";

// BearingPoint brand colors for Allocated and Others
const COLORS = {
  // Allocated (darker shades)
  earlyAllocated: "#FF787A", // R40
  midAllocated: "#FF3D47", // R50
  lateAllocated: "#CC2931", // R60
  // Others (lighter shades)
  earlyOthers: "#FFBDC0", // R20
  midOthers: "#FFA3A8", // R30
  lateOthers: "#FF787A", // R40
};

/**
 * Custom label renderer for displaying totals at the end of each bar
 * Shows opportunity count and total amount stacked vertically
 */
const createRenderTotalLabel =
  (textColor = "#666") =>
  (props) => {
    const { x, y, width, height, index } = props;
    const { data } = props;

    if (!data || !data[index]) return null;

    const entry = data[index];
    const total = (entry.early || 0) + (entry.mid || 0) + (entry.late || 0);
    const count = entry.count || 0;

    const formattedAmount = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(total);

    return (
      <g>
        {/* Opportunity count - top line */}
        <text
          x={x + width + 10}
          y={y + height / 2 - 6}
          fill={textColor}
          fontSize={10}
          fontWeight={500}
          textAnchor="start"
          dominantBaseline="middle"
        >
          {count} opp{count !== 1 ? "s" : ""}
        </text>
        {/* Total amount - bottom line */}
        <text
          x={x + width + 10}
          y={y + height / 2 + 6}
          fill={textColor}
          fontSize={10}
          fontWeight={600}
          textAnchor="start"
          dominantBaseline="middle"
        >
          {formattedAmount}
        </text>
      </g>
    );
  };

/**
 * Account chart component with stacked bars
 * Memoized to prevent unnecessary re-renders
 *
 * @param {Array} data - Chart data
 * @param {Function} onChartClick - Click handler for filtering
 * @param {boolean} showIO - Whether to show I&O values
 * @param {boolean} showSegmentMode - Whether to show segment mode (vs account mode)
 * @param {Function} onToggleMode - Handler for toggle button
 * @param {string} drillDownSegment - Segment being drilled down into
 * @param {string} drillDownSubSegment - Sub-segment being drilled down into
 * @param {string} filteredAccount - Account being filtered
 * @param {Function} onBackClick - Handler for back button
 */
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
  }) => {
    const theme = useTheme();
    const renderTotalLabel = createRenderTotalLabel(theme.palette.text.secondary);

    // Determine title based on mode and drill-down level
    let chartTitle = "Pipeline by Account";
    if (showSegmentMode) {
      if (drillDownSubSegment) {
        chartTitle = `${drillDownSubSegment}`;
      } else if (drillDownSegment) {
        chartTitle = `Sub-Segments - ${drillDownSegment}`;
      } else {
        chartTitle = "Pipeline by Segment";
      }
    } else if (filteredAccount) {
      chartTitle = `Account - ${filteredAccount}`;
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
            {((showSegmentMode && (drillDownSegment || drillDownSubSegment)) ||
              (!showSegmentMode && filteredAccount)) && (
              <MuiTooltip
                title={
                  showSegmentMode
                    ? drillDownSubSegment
                      ? "Retour aux Sub-Segments"
                      : "Retour aux Segments"
                    : "Retour aux Accounts"
                }
              >
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
            <Typography variant="h6" gutterBottom fontWeight={700} sx={{ mb: 0 }}>
              {chartTitle}
            </Typography>
          </Box>
          <MuiTooltip title={showSegmentMode ? "Afficher par Account" : "Afficher par Segment"}>
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
        </Box>
        <Divider sx={{ mb: 2 }} />
        <ResponsiveContainer width="100%" height="85%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
            onClick={onChartClick}
            animationDuration={600}
            animationEasing="ease-in-out"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, "dataMax"]}
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
            <Tooltip content={<StatusChartTooltip showIO={showIO} />} />
            {/* Early stage - Allocated (dark) */}
            <Bar
              dataKey="earlyAllocated"
              name="Lead Identified → Go Approved (Allocated)"
              stackId="a"
              fill={theme.palette.primary.light}
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            />
            {/* Early stage - Non-allocated (lighter color) */}
            <Bar
              dataKey="earlyNonAllocated"
              name="Lead Identified → Go Approved (Other)"
              stackId="a"
              fill={COLORS.earlyOthers}
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            />
            {/* Mid stage - Allocated (dark) */}
            <Bar
              dataKey="midAllocated"
              name="Proposal Submitted (Allocated)"
              stackId="a"
              fill={theme.palette.primary.main}
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            />
            {/* Mid stage - Non-allocated (lighter color) */}
            <Bar
              dataKey="midNonAllocated"
              name="Proposal Submitted (Other)"
              stackId="a"
              fill={COLORS.midOthers}
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            />
            {/* Late stage - Allocated (dark) */}
            <Bar
              dataKey="lateAllocated"
              name="Client Won → AEL (Allocated)"
              stackId="a"
              fill={theme.palette.primary.dark}
              radius={[0, 0, 0, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            />
            {/* Late stage - Non-allocated (lighter color) */}
            <Bar
              dataKey="lateNonAllocated"
              name="Client Won → AEL (Other)"
              stackId="a"
              fill={COLORS.lateOthers}
              radius={[0, 4, 4, 0]}
              animationBegin={0}
              animationDuration={600}
              isAnimationActive={true}
              cursor="pointer"
            >
              <LabelList content={(props) => renderTotalLabel({ ...props, data })} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    );
  }
);

AccountChart.displayName = "AccountChart";

export default React.memo(AccountChart);
