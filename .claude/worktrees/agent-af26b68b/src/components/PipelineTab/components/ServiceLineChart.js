import React from "react";
/**
 * ServiceLineChart Component
 * Displays bar chart of pipeline by service line
 * Performance-optimized with React.memo
 */

import { Paper, Box, Typography, Divider, useTheme } from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { RevenueChartTooltip } from "./ChartTooltips";
import { COLORS } from "../utils/constants";

/**
 * Service line chart component
 * Memoized to prevent unnecessary re-renders
 *
 * @param {Array} data - Chart data
 * @param {Function} onChartClick - Click handler for filtering
 * @param {boolean} showIO - Whether to show I&O values
 */
const ServiceLineChart = React.memo(({ data, onChartClick, showIO }) => {
  const theme = useTheme();

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
        }}
      >
        <div>
          <Typography variant="h6" gutterBottom fontWeight={700}>
            Pipeline by Service Line
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Distribution of revenue across service lines
          </Typography>
        </div>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
          <Bar
            dataKey="originalValue"
            name="Revenue"
            radius={[0, 4, 4, 0]}
            animationBegin={0}
            animationDuration={600}
            isAnimationActive={true}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(value) => `${value} opps`}
              style={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
});

ServiceLineChart.displayName = "ServiceLineChart";

export default React.memo(ServiceLineChart);
