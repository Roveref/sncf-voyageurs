import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { GradeDistEntry } from "../utils/calculations";

interface Props {
  data: GradeDistEntry[];
}

const GradeDistributionChart = React.memo(({ data }: Props) => {
  const theme = useTheme();

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
        Distribution par niveau
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <XAxis dataKey="gradeBucket" tick={{ fontSize: 13 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="rejected" name="Rejected" stackId="a" fill={theme.palette.error.main} radius={[0, 0, 0, 0]} />
          <Bar dataKey="active" name="Active" stackId="a" fill={theme.palette.primary.main} />
          <Bar dataKey="hired" name="Hired" stackId="a" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
});
GradeDistributionChart.displayName = "GradeDistributionChart";

export default GradeDistributionChart;
