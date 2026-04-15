import React, { useMemo } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { chartPalette } from "../../../config/brandConfig";
import type { ConversionEntry } from "../utils/calculations";

const POSTE_COLORS: Record<string, string> = {
  Stagiaire: chartPalette[0],
  "Consultant junior": chartPalette[1],
  "Consultant expérimenté / Manager": chartPalette[2],
};

interface Props {
  data: ConversionEntry[];
}

const ConversionRateChart = React.memo(({ data }: Props) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const years = [...new Set(data.map((d) => d.year))].sort();
    return years.map((year) => {
      const row: Record<string, number | string> = { year };
      for (const entry of data) {
        if (entry.year === year) {
          row[entry.poste] = Math.round(entry.rate * 10) / 10;
        }
      }
      return row;
    });
  }, [data]);

  const postes = useMemo(() => [...new Set(data.map((d) => d.poste))], [data]);

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
        Taux de conversion par poste
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="year" tick={{ fontSize: 13 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip
            formatter={((value: number, name: string) => [`${value}%`, name]) as any}
            contentStyle={{
              borderRadius: 8,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              backgroundColor: theme.palette.background.paper,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {postes.map((poste) => (
            <Bar
              key={poste}
              dataKey={poste}
              name={poste}
              fill={POSTE_COLORS[poste] || theme.palette.primary.main}
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
});
ConversionRateChart.displayName = "ConversionRateChart";

export default ConversionRateChart;
