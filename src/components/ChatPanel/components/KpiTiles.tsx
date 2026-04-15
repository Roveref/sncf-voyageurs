import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface KpiData {
  label: string;
  value: number;
  target?: number;
  unit?: string;
}

interface KpiTilesProps {
  title: string;
  data: KpiData[];
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

function gaugeColor(value: number, target: number | undefined): string {
  if (target == null) return "#D97757";
  const ratio = value / target;
  return ratio >= 0.95 ? "#4caf50" : ratio >= 0.8 ? "#ff9800" : "#f44336";
}

const ARC_RADIUS = 28;
const ARC_STROKE = 5;
const ARC_SIZE = (ARC_RADIUS + ARC_STROKE) * 2;

function describeArc(pct: number): string {
  const angle = Math.min(pct, 100) * 2.7; // 270deg max arc
  const startAngle = 135; // start bottom-left
  const endAngle = startAngle + angle;
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const cx = ARC_SIZE / 2;
  const cy = ARC_SIZE / 2;
  const x1 = cx + ARC_RADIUS * Math.cos(toRad(startAngle));
  const y1 = cy + ARC_RADIUS * Math.sin(toRad(startAngle));
  const x2 = cx + ARC_RADIUS * Math.cos(toRad(endAngle));
  const y2 = cy + ARC_RADIUS * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function describeArcBg(): string {
  return describeArc(100);
}

const KpiTiles = memo(({ title, data, isDark, warm }: KpiTilesProps) => (
  <Box sx={{ my: 1 }}>
    <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1, color: warm.text }}>{title}</Typography>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {data.map((kpi, i) => {
        const color = gaugeColor(kpi.value, kpi.target);
        const pct = kpi.target ? Math.min((kpi.value / kpi.target) * 100, 115) : Math.min(kpi.value, 100);
        return (
          <Box
            key={i}
            sx={{
              flex: "1 1 0",
              minWidth: 100,
              p: 1.5,
              borderRadius: 2,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${warm.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 600,
                color: warm.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {kpi.label}
            </Typography>
            {/* Arc gauge */}
            <Box sx={{ position: "relative", width: ARC_SIZE, height: ARC_SIZE - 10 }}>
              <svg width={ARC_SIZE} height={ARC_SIZE} style={{ position: "absolute", top: 0, left: 0 }}>
                <path
                  d={describeArcBg()}
                  fill="none"
                  stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                  strokeWidth={ARC_STROKE}
                  strokeLinecap="round"
                />
                <path
                  d={describeArc(pct)}
                  fill="none"
                  stroke={color}
                  strokeWidth={ARC_STROKE}
                  strokeLinecap="round"
                  style={{ transition: "d 0.6s ease" }}
                />
              </svg>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pt: 0.5,
                }}
              >
                <Typography sx={{ fontSize: 16, fontWeight: 800, color }}>
                  {kpi.value.toLocaleString("fr-FR")}
                  {kpi.unit || ""}
                </Typography>
              </Box>
            </Box>
            {kpi.target != null && (
              <Typography sx={{ fontSize: 10, color: warm.muted }}>
                cible {kpi.target}
                {kpi.unit || ""}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  </Box>
));
KpiTiles.displayName = "KpiTiles";

export { KpiTiles };
