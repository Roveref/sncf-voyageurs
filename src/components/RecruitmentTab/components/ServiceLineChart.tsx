import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { chartPalette } from "../../../config/brandConfig";
import type { ServiceLineEntry } from "../utils/calculations";

interface Props {
  data: ServiceLineEntry[];
  maxItems?: number;
}

const ServiceLineChart = React.memo(({ data, maxItems = 12 }: Props) => {
  const theme = useTheme();
  const chartData = data.slice(0, maxItems);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        height: "100%",
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
      }}
    >
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Top service lines
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => (v.length > 30 ? v.slice(0, 28) + "..." : v)}
          />
          <Tooltip
            formatter={((value: number) => [value, "Candidats"]) as any}
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fill: theme.palette.text.primary, fontWeight: 600, fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
});
ServiceLineChart.displayName = "ServiceLineChart";

export default ServiceLineChart;
