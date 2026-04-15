import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface GroupedBarData {
  label: string;
  value: number;
  target: number;
}

interface GroupedBarChartProps {
  title: string;
  data: GroupedBarData[];
  unit?: string;
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

function statusColor(value: number, target: number): string {
  const ratio = value / target;
  return ratio >= 0.95 ? "#4caf50" : ratio >= 0.8 ? "#ff9800" : "#f44336";
}

const GroupedBarChart = memo(({ title, data, unit = "", isDark, warm }: GroupedBarChartProps) => {
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.target)), 1);

  return (
    <Box
      sx={{
        my: 1,
        p: 1.5,
        borderRadius: 2,
        bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${warm.border}`,
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1, color: warm.text }}>{title}</Typography>
      {data.map((d, i) => {
        const color = statusColor(d.value, d.target);
        return (
          <Box key={i} sx={{ mb: 1, "&:last-child": { mb: 0 } }}>
            {/* Label + values */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.25 }}>
              <Typography sx={{ fontSize: 10.5, color: warm.muted }}>{d.label}</Typography>
              <Typography sx={{ fontSize: 10.5, fontWeight: 600, color }}>
                {d.value.toLocaleString("fr-FR")}
                {unit} vs {d.target}
                {unit}
              </Typography>
            </Box>
            {/* Actual bar */}
            <Box
              sx={{
                position: "relative",
                height: 14,
                borderRadius: 4,
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              }}
            >
              <Box
                sx={{
                  width: `${(d.value / maxVal) * 100}%`,
                  height: "100%",
                  borderRadius: 4,
                  bgcolor: color,
                  opacity: 0.85,
                  transition: "width 0.6s ease",
                }}
              />
              {/* Target marker */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${(d.target / maxVal) * 100}%`,
                  top: -1,
                  bottom: -1,
                  width: 2,
                  bgcolor: warm.muted,
                  borderRadius: 1,
                  opacity: 0.6,
                }}
              />
            </Box>
          </Box>
        );
      })}
      {/* Legend */}
      <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 10, height: 6, borderRadius: 2, bgcolor: "#D97757" }} />
          <Typography sx={{ fontSize: 9.5, color: warm.muted }}>Actuel</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 2, height: 10, borderRadius: 1, bgcolor: warm.muted, opacity: 0.6 }} />
          <Typography sx={{ fontSize: 9.5, color: warm.muted }}>Cible</Typography>
        </Box>
      </Box>
    </Box>
  );
});
GroupedBarChart.displayName = "GroupedBarChart";

export { GroupedBarChart };
