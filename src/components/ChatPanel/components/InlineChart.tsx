import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ChatChart } from "./ChatMarkdown";
import { CandidateCards } from "./CandidateCards";
import { KpiTiles } from "./KpiTiles";
import { GroupedBarChart } from "./GroupedBarChart";
import { MiniTimeline } from "./MiniTimeline";
import { VarianceIndicator } from "./VarianceIndicator";
import { SkillTags } from "./SkillTags";
import { chartPalette } from "../../../config/brandConfig";

// ── Constants ──

const DEFAULT_COLORS = chartPalette;

// ── Component ──

const InlineChart = memo(
  ({
    chart,
    isDark,
    warm,
  }: {
    chart: ChatChart;
    isDark: boolean;
    warm: { surface: string; border: string; muted: string; text: string };
  }) => {
    // ── Dispatch new chart types ──
    if (chart.chartType === "candidate-card") {
      return <CandidateCards title={chart.title} data={chart.data} isDark={isDark} warm={warm} />;
    }
    if (chart.chartType === "kpi-tile") {
      return <KpiTiles title={chart.title} data={chart.data} isDark={isDark} warm={warm} />;
    }
    if (chart.chartType === "grouped-bar") {
      return <GroupedBarChart title={chart.title} data={chart.data} unit={chart.unit} isDark={isDark} warm={warm} />;
    }
    if (chart.chartType === "timeline") {
      return <MiniTimeline title={chart.title} data={chart.data} isDark={isDark} warm={warm} />;
    }
    if (chart.chartType === "variance") {
      return <VarianceIndicator title={chart.title} data={chart.data} unit={chart.unit} isDark={isDark} warm={warm} />;
    }
    if (chart.chartType === "skill-tags") {
      return <SkillTags title={chart.title} data={chart.data} isDark={isDark} warm={warm} />;
    }

    // ── Legacy chart types ──
    // Coerce each row's value to a finite number or null (so we can skip invalid points).
    const toFinite = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const normalizedRows: { label: string; value: number | null; color?: string }[] = Array.isArray(chart.data)
      ? chart.data.map((d: any) => ({
          label: typeof d?.label === "string" && d.label.trim() ? d.label : "—",
          value: toFinite(d?.value),
          color: d?.color,
        }))
      : [];
    const finiteValues = normalizedRows.map((r) => r.value).filter((v): v is number => v !== null);
    const maxVal = Math.max(...finiteValues, 1);
    const isPercentUnit = (chart.unit || "").trim() === "%";
    // When the unit is %, fix the scale to 100 so 27% reads short and 95% reads long.
    // Otherwise scale to max for relative comparison.
    const scale = isPercentUnit ? 100 : maxVal;
    const accent = "#D97757";

    // Fail loud instead of rendering NaN bars: if nothing is numeric, show a compact warning.
    const hasRenderableData =
      (chart.chartType === "progress" || chart.chartType === "bar" || !chart.chartType) && finiteValues.length > 0;
    const shouldShowFallbackWarning =
      (chart.chartType === "progress" || chart.chartType === "bar" || !chart.chartType) &&
      Array.isArray(chart.data) &&
      chart.data.length > 0 &&
      !hasRenderableData;
    if (shouldShowFallbackWarning) {
      return (
        <Box
          sx={{
            my: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: `1px dashed ${warm.border}`,
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5, color: warm.text }}>{chart.title}</Typography>
          <Typography sx={{ fontSize: 11, color: warm.muted }}>
            Données non numériques — le graphique n'a pas pu être rendu. Voir le texte ci-dessus.
          </Typography>
        </Box>
      );
    }

    if (chart.chartType === "progress") {
      const gridStops = isPercentUnit ? [25, 50, 75] : [];
      return (
        <Box
          sx={{
            my: 1,
            p: 2,
            borderRadius: 2,
            bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: `1px solid ${warm.border}`,
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1.25, color: warm.text }}>{chart.title}</Typography>
          {normalizedRows.map((d, i) => {
            const pct = d.value == null ? 0 : Math.max(0, Math.min(100, (d.value / scale) * 100));
            return (
              <Box
                key={i}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75, "&:last-child": { mb: 0 } }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    color: warm.muted,
                    minWidth: 92,
                    flexShrink: 0,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {d.label}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    height: 8,
                    borderRadius: 2,
                    bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Subtle gridlines at 25/50/75 for % scale */}
                  {gridStops.map((stop) => (
                    <Box
                      key={stop}
                      sx={{
                        position: "absolute",
                        left: `${stop}%`,
                        top: 0,
                        bottom: 0,
                        width: "1px",
                        bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                      }}
                    />
                  ))}
                  <Box
                    sx={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 2,
                      bgcolor: d.color || accent,
                      transition: "width 0.6s ease",
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: warm.text,
                    minWidth: 48,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {d.value == null ? "—" : d.value.toLocaleString("fr-FR") + (chart.unit || "")}
                </Typography>
              </Box>
            );
          })}
        </Box>
      );
    }

    if (chart.chartType === "pie") {
      const total = chart.data.reduce((s: number, d: any) => s + d.value, 0) || 1;
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
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1, color: warm.text }}>{chart.title}</Typography>
          <Box sx={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", mb: 1 }}>
            {chart.data.map((d: any, i: number) => (
              <Box
                key={i}
                sx={{
                  width: `${(d.value / total) * 100}%`,
                  bgcolor: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                  transition: "width 0.6s ease",
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {chart.data.map((d: any, i: number) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                  }}
                />
                <Typography sx={{ fontSize: 10.5, color: warm.muted }}>
                  {d.label}: {d.value.toLocaleString("fr-FR")}
                  {chart.unit || ""} ({Math.round((d.value / total) * 100)}%)
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    // Bar chart (default) — clean layout with values outside bars, single accent color.
    return (
      <Box
        sx={{
          my: 1,
          p: 2,
          borderRadius: 2,
          bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          border: `1px solid ${warm.border}`,
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1.25, color: warm.text }}>{chart.title}</Typography>
        {normalizedRows.map((d, i) => {
          const pct = d.value == null ? 0 : Math.max(0, Math.min(100, (d.value / scale) * 100));
          return (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75, "&:last-child": { mb: 0 } }}>
              <Typography
                sx={{
                  fontSize: 11,
                  color: warm.muted,
                  minWidth: 92,
                  flexShrink: 0,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.label}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  height: 10,
                  borderRadius: 2,
                  bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 2,
                    bgcolor: d.color || accent,
                    transition: "width 0.6s ease",
                  }}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: warm.text,
                  minWidth: 56,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.value == null ? "—" : d.value.toLocaleString("fr-FR") + (chart.unit || "")}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  }
);
InlineChart.displayName = "InlineChart";

export { InlineChart, DEFAULT_COLORS };
export type { ChatChart };
