import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// TU / TO legend: grade-relative categorical bands (flat colors)
// Colors match getHeatmapStyle() in theme.js -- no gradient
const TU_BANDS = [
  { color: "#f59e0b", label: "<50%", flex: 50 }, // amber-500
  { color: "#38bdf8", label: "50-80%", flex: 30 }, // sky-400  (UTILIZATION.low)
  { color: "#3b82f6", label: "80-100%", flex: 20 }, // blue-500 (UTILIZATION.partial)
  { color: "#10b981", label: ">= target", flex: 20 }, // emerald  (UTILIZATION.optimal)
  { color: "#059669", label: "100%", flex: 10 }, // emerald-600
];

// Dispo legend: availability bands
const DISPO_BANDS = [
  { from: "rgb(229,245,237)", to: "rgb(153,233,218)", flex: 40 }, // 0->40%
  { from: "rgb(153,233,218)", to: "rgb(52,211,153)", flex: 30 }, // 40->70%
  { from: "rgb(52,211,153)", to: "rgb(6,95,70)", flex: 30 }, // 70->100%
];
const DISPO_TICKS = ["0%", "40%", "70%", "100%"];

const SAP_HATCH =
  "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 5px)";

const VARIANCE_BANDS = [
  { color: "#991b1b", label: "< -10" },
  { color: "#ef4444", label: "-5" },
  { color: "#fca5a5", label: "-1" },
  { color: "#d1d5db", label: "0" },
  { color: "#86efac", label: "+1" },
  { color: "#16a34a", label: "+5" },
  { color: "#065f46", label: "> +10" },
];

const VARIANCE_HOURS_BANDS = [
  { color: "#991b1b", label: "< -2h" },
  { color: "#ef4444", label: "-1h" },
  { color: "#fca5a5", label: "-0.2h" },
  { color: "#d1d5db", label: "0" },
  { color: "#86efac", label: "+0.2h" },
  { color: "#16a34a", label: "+1h" },
  { color: "#065f46", label: "> +2h" },
];

const VARIANCE_HOURS_PCT_BANDS = [
  { color: "#991b1b", label: "< -10" },
  { color: "#ef4444", label: "-5" },
  { color: "#fca5a5", label: "-1" },
  { color: "#d1d5db", label: "0" },
  { color: "#86efac", label: "+1" },
  { color: "#16a34a", label: "+5" },
  { color: "#065f46", label: "> +10" },
];

const legendTextSx = { fontSize: "9px", color: "text.disabled", fontWeight: 500 };
const legendTitleSx = { fontSize: "9px", color: "text.secondary", fontWeight: 500, mr: 0.5 };
const swatchSx = { width: 10, height: 10, borderRadius: "2px" };

const HeatmapLegend = memo(({ mode, hasSapData }: any) => {
  const isTU = mode === "utilization" || mode === "to" || mode === "hours";
  const isVariance = mode === "variance";
  const isVarianceHours = mode === "variance_hours";
  const isVarianceHoursPct = mode === "variance_hours_pct";

  const sapIndicator = hasSapData ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.75, pl: 0.75, borderLeft: "1px solid #d1d5db" }}>
      <Box sx={{ ...swatchSx, backgroundColor: "#16a34a", backgroundImage: SAP_HATCH }} />
      <Typography component="span" sx={{ fontSize: "9px", color: "#f59e0b", fontWeight: 500 }}>
        SAP (actual)
      </Typography>
    </Box>
  ) : null;

  if (isVariance || isVarianceHours || isVarianceHoursPct) {
    const bands = isVarianceHoursPct
      ? VARIANCE_HOURS_PCT_BANDS
      : isVarianceHours
        ? VARIANCE_HOURS_BANDS
        : VARIANCE_BANDS;
    const title = isVarianceHoursPct
      ? "Delta TU% (SAP - Staffing) pts :"
      : isVarianceHours
        ? "Delta Variance hours (SAP - Staffing) /day:"
        : "Delta Variance (SAP - Staffing) pts :";
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
        <Typography component="span" sx={legendTitleSx}>
          {title}
        </Typography>
        {bands.map((b, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <Box sx={{ ...swatchSx, backgroundColor: b.color }} />
            <Typography component="span" sx={legendTextSx}>
              {b.label}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  if (isTU) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
        {TU_BANDS.map((b, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ ...swatchSx, backgroundColor: b.color }} />
            <Typography component="span" sx={legendTextSx}>
              {b.label}
            </Typography>
          </Box>
        ))}
        <Typography component="span" sx={{ ...legendTextSx, ml: 0.25 }}>
          du target
        </Typography>
        {/* Overbooked indicator */}
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.75, pl: 0.75, borderLeft: "1px solid #d1d5db" }}
        >
          <Box sx={{ ...swatchSx, backgroundColor: "#ef4444" }} />
          <Typography component="span" sx={legendTextSx}>
            &gt;100% overloaded
          </Typography>
        </Box>
        {sapIndicator}
      </Box>
    );
  }

  // Dispo mode: keep existing gradient legend
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
      <Box sx={{ display: "flex", height: 10, borderRadius: "2px", overflow: "hidden", width: 180 }}>
        {DISPO_BANDS.map((b, i) => (
          <Box
            key={i}
            style={{
              flex: b.flex,
              background: `linear-gradient(to right, ${b.from}, ${b.to})`,
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {DISPO_TICKS.map((label, i) => (
          <Typography key={i} component="span" sx={legendTextSx} style={i > 0 ? { marginLeft: 2 } : undefined}>
            {label}
          </Typography>
        ))}
        <Typography component="span" sx={legendTextSx}>
          {" "}
          avail
        </Typography>
      </Box>
      {sapIndicator}
    </Box>
  );
});

HeatmapLegend.displayName = "HeatmapLegend";
export default HeatmapLegend;
