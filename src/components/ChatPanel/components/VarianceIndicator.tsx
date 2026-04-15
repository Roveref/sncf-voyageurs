import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface VarianceData {
  name: string;
  actual: number;
  forecast: number;
  delta: number;
  status?: "surperformance" | "sous-performance" | "aligne";
}

interface VarianceIndicatorProps {
  title: string;
  data: VarianceData[];
  unit?: string;
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

function deltaColor(delta: number): string {
  if (delta > 2) return "#4caf50";
  if (delta < -2) return "#f44336";
  return "#ff9800";
}

function statusLabel(status: string | undefined, delta: number): string {
  if (status === "surperformance") return "surperf.";
  if (status === "sous-performance") return "sous-perf.";
  if (status === "aligne") return "aligne";
  if (delta > 2) return "surperf.";
  if (delta < -2) return "sous-perf.";
  return "aligne";
}

const VarianceIndicator = memo(({ title, data, unit = "pts", isDark, warm }: VarianceIndicatorProps) => (
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
      const color = deltaColor(d.delta);
      const arrow = d.delta > 0 ? "\u25B2" : d.delta < 0 ? "\u25BC" : "\u25CF";
      return (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 0.5,
            borderBottom:
              i < data.length - 1 ? `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none",
          }}
        >
          {/* Name */}
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 500,
              color: warm.text,
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.name}
          </Typography>
          {/* Actual → Forecast */}
          <Typography sx={{ fontSize: 10.5, color: warm.muted, flexShrink: 0 }}>
            SAP {d.actual}
            {unit === "%" ? "%" : ""} / MDS {d.forecast}
            {unit === "%" ? "%" : ""}
          </Typography>
          {/* Delta badge */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: "10px",
              bgcolor: color + "18",
              border: `1px solid ${color}40`,
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: 11, color, lineHeight: 1 }}>{arrow}</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>
              {d.delta > 0 ? "+" : ""}
              {d.delta}
              {unit}
            </Typography>
          </Box>
          {/* Status */}
          <Typography sx={{ fontSize: 9.5, color: warm.muted, minWidth: 55, textAlign: "right", flexShrink: 0 }}>
            {statusLabel(d.status, d.delta)}
          </Typography>
        </Box>
      );
    })}
  </Box>
));
VarianceIndicator.displayName = "VarianceIndicator";

export { VarianceIndicator };
