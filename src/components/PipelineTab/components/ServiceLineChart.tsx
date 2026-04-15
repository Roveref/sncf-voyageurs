import React from "react";
import { roundedBarShape } from "./RoundedBarShape";
/**
 * ServiceLineChart Component
 * Displays bar chart of pipeline by service line
 * Performance-optimized with React.memo
 */

import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { RevenueChartTooltip } from "./ChartTooltips";
import { COLORS } from "../utils/constants";
import { formatCompactCurrency } from "../../../utils/formatters";

/**
 * Service line chart component
 * Memoized to prevent unnecessary re-renders
 *
 * @param {Array} data - Chart data
 * @param {Function} onChartClick - Click handler for filtering
 * @param {boolean} showIO - Whether to show I&O values
 */
const ServiceLineChart = React.memo(({ data, onChartClick, showIO }: any) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        height: "100%",
        borderRadius: 3,
        transition: "box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
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
          accessibilityLayer={false}
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={onChartClick}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis
            type="number"
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
          <Bar
            dataKey="originalValue"
            name="Revenue"
            shape={roundedBarShape(["originalValue"])}
            animationBegin={0}
            animationDuration={600}
            animationEasing="ease-out"
            isAnimationActive={true}
            cursor="pointer"
          >
            {data.map((_entry: any, index: number) => (
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
