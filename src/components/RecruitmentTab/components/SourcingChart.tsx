import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { chartPalette } from "../../../config/brandConfig";
import type { ChannelEntry } from "../utils/calculations";

interface Props {
  data: ChannelEntry[];
}

const LABEL_MAP: Record<string, string> = {
  direct: "Direct",
  connected: "Connected",
  sourced: "Sourced",
  sourced_application: "Sourced App.",
  referred: "Referred",
  shared: "Shared",
  internal: "Interne",
  unsubscribed: "Desinscrit",
};

const SourcingChart = React.memo(({ data }: Props) => {
  const theme = useTheme();
  const chartData = data.map((d) => ({
    ...d,
    label: LABEL_MAP[d.channel] || d.channel,
  }));

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
        Canaux de sourcing
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="total"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            paddingAngle={2}
            label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={((value: number, name: string) => [value, name]) as any}
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
});
SourcingChart.displayName = "SourcingChart";

export default SourcingChart;
