import { memo, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { COLORS, SERIES } from "./TUTrendLegend";
import { brand } from "../../../../config/brandConfig";
import { setCrosshairRange } from "../../hooks/useCrosshairSync";

/** Tooltip aligned with Bookings CustomTooltip design */
const ChartTooltip = ({ active, payload, label, visible, heatmapMode }: any) => {
  const theme = useTheme();

  // Emit crosshair for timeline sync — uses the tooltip's active state which Recharts reliably manages
  const pt = active && payload?.[0]?.payload;
  const mStart = pt?._mStart as number | undefined;
  const mEnd = pt?._mEnd as number | undefined;
  useEffect(() => {
    if (mStart != null && mEnd != null) {
      setCrosshairRange({ startMs: mStart, endMs: mEnd, source: "trend" });
    } else {
      setCrosshairRange(null);
    }
  }, [mStart, mEnd]);

  if (!active || !payload?.length) return null;

  const isVariance = heatmapMode === "variance_hours" || heatmapMode === "variance_hours_pct";
  const deltaVal = payload.find((e: any) => e.dataKey === "delta")?.value;
  const forecastVal = payload.find((e: any) => e.dataKey === "forecast")?.value;
  const actualVal = payload.find((e: any) => e.dataKey === "actual")?.value;
  const targetVal = payload.find((e: any) => e.dataKey === "target")?.value;
  const hasFADelta = forecastVal != null && actualVal != null;
  const faDelta = hasFADelta ? actualVal - forecastVal : null;

  const fteVal = payload.find((e: any) => e.dataKey === "fte")?.value;

  const rows = isVariance
    ? [] // variance mode uses single delta row below
    : SERIES.filter((s) => s.key !== "fte" && visible[s.key] !== false)
        .map((s) => {
          const entry = payload.find((e: any) => e.dataKey === s.key);
          if (!entry || entry.value == null) return null;
          return { ...s, value: entry.value };
        })
        .filter(Boolean);

  return (
    <Box
      sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: "blur(10px)",
        borderRadius: 2,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        overflow: "hidden",
        minWidth: 200,
        animation: "tooltipFadeIn 0.2s ease-out",
        "@keyframes tooltipFadeIn": {
          from: { opacity: 0, transform: "translateY(-4px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        {(() => {
          const pt = payload?.[0]?.payload;
          const textLabel = pt?.label || "";
          const display = typeof textLabel === "string" ? textLabel.trim().split("·").join(" 20") : "";
          const c1c2 = pt?._isC2 === true ? " — C2" : pt?._isC2 === false ? " — C1" : "";
          const empCount = pt?._presentCount;
          return (
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                {display}
                {c1c2}
              </Typography>
              {empCount > 0 && (
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {empCount} emp.
                </Typography>
              )}
            </Box>
          );
        })()}
      </Box>

      {/* Series rows */}
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {/* Variance mode: single delta row */}
        {isVariance && deltaVal != null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: alpha(deltaVal >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.06),
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: theme.palette.info.main, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {heatmapMode === "variance_hours" ? "Δ hours" : "Δ points"}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: deltaVal >= 0 ? theme.palette.success.main : theme.palette.error.main,
              }}
            >
              {deltaVal >= 0 ? "+" : ""}
              {heatmapMode === "variance_hours" ? `${deltaVal.toFixed(1)}h` : `${deltaVal.toFixed(1)}pts`}
            </Typography>
          </Box>
        )}

        {/* Normal mode: series rows */}
        {rows.map(
          (row) =>
            row && (
              <Box
                key={row.key}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: alpha(row.color, 0.04),
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: row.color, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                    {row.label}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                  {row.value != null ? `${row.value.toFixed(1)}%` : "—"}
                </Typography>
              </Box>
            )
        )}

        {/* Delta section (normal mode only) */}
        {!isVariance && hasFADelta && visible.forecast !== false && visible.actual !== false && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 1,
              py: 0.5,
              mt: 0.25,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
              Delta (Actual − Forecast)
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: faDelta! >= 0 ? theme.palette.success.main : theme.palette.error.main,
              }}
            >
              {faDelta! >= 0 ? "+" : ""}
              {faDelta!.toFixed(1)} pts
            </Typography>
          </Box>
        )}

        {/* Target gap (forecast vs theoretical) */}
        {!isVariance &&
          forecastVal != null &&
          targetVal != null &&
          visible.forecast !== false &&
          visible.target !== false && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                vs Target
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: forecastVal >= targetVal ? theme.palette.success.main : theme.palette.warning.main,
                }}
              >
                {forecastVal - targetVal >= 0 ? "+" : ""}
                {(forecastVal - targetVal).toFixed(1)} pts
              </Typography>
            </Box>
          )}

        {/* FTE row */}
        {visible.fte !== false && fteVal != null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 1,
              py: 0.5,
              mt: 0.25,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COLORS.fte, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                FTE
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: COLORS.fte }}>
              {fteVal.toFixed(1)}
            </Typography>
          </Box>
        )}

        {/* Turnover / grade changes info */}
        {(() => {
          const pt = payload?.[0]?.payload;
          if (!pt) return null;
          const { _bucketArrivals: arr, _bucketDepartures: dep, _bucketGradeChanges: gc } = pt;
          if (!arr && !dep && !gc) return null;
          return (
            <Box sx={{ mt: 0.25, pt: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
              {(arr > 0 || dep > 0) && (
                <Box sx={{ display: "flex", justifyContent: "space-between", px: 1, py: 0.15 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
                    Turnover
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.7rem", color: "#f97316" }}>
                    {arr > 0 ? `${arr} arr.` : ""}
                    {arr > 0 && dep > 0 ? " · " : ""}
                    {dep > 0 ? `${dep} dep.` : ""}
                  </Typography>
                </Box>
              )}
              {gc > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between", px: 1, py: 0.15 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
                    Grade changes
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, fontSize: "0.7rem", color: brand.secondaryLight }}
                  >
                    {gc}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })()}

        {/* Grid debug info */}
        {(() => {
          const pt = payload?.[0]?.payload;
          if (!pt || pt._totalH == null) return null;
          const rows = [
            { label: "Active emp-days", value: `${pt._gridActiveEmpDays} (${pt._presentCount} emp)` },
            { label: "Total hours", value: `${pt._totalH}h` },
            { label: "Absence hours", value: `${pt._absH}h` },
            { label: "Net hours", value: `${pt._netH}h` },
            { label: "Chargeable hours", value: `${pt._chH}h` },
            { label: "Training hours", value: `${pt._trH}h` },
          ];
          return (
            <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.6rem", px: 1, display: "block", mb: 0.25 }}
              >
                Grid debug
              </Typography>
              {rows.map((r) => (
                <Box key={r.label} sx={{ display: "flex", justifyContent: "space-between", px: 1, py: 0.15 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
                    {r.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.65rem" }}>
                    {r.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          );
        })()}
      </Box>
    </Box>
  );
};

export { ChartTooltip };
