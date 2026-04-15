import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { DurationByStatus } from "../utils/calculations";

const STATUS_LABELS: Record<string, string> = {
  rejected: "Rejected",
  active: "Active",
  hired: "Hired",
};

const STATUS_COLORS: Record<string, string> = {
  rejected: "#CC2931",
  active: "#806659",
  hired: "#10B981",
};

interface Props {
  data: DurationByStatus[];
}

const ProcessDurationChart = React.memo(({ data }: Props) => {
  const theme = useTheme();
  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] || d.status,
    color: STATUS_COLORS[d.status] || theme.palette.primary.main,
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
        Duree moyenne du process
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
          <XAxis dataKey="label" tick={{ fontSize: 13 }} />
          <YAxis tick={{ fontSize: 12 }} unit="j" />
          <Tooltip
            formatter={
              ((value: number, _: string, { payload }: any) => [
                `${value} jours (${payload.count} candidats)`,
                "Duree moyenne",
              ]) as any
            }
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
          />
          <Bar dataKey="avgDays" radius={[6, 6, 0, 0]} barSize={48}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
            <LabelList
              dataKey="avgDays"
              position="top"
              formatter={((v: number) => `${v}j`) as any}
              style={{ fill: theme.palette.text.primary, fontWeight: 600, fontSize: 13 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
});
ProcessDurationChart.displayName = "ProcessDurationChart";

export default ProcessDurationChart;
