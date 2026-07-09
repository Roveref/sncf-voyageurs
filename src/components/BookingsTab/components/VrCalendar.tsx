/**
 * VrCalendar — Calendrier des visites réglementaires (VR) à venir.
 *
 * Mise en forme alignée avec les autres cards (PipelineInsights, BookingsInsights) :
 *   - Paper elevation={0}, borderRadius 3, pas de bordure (shadow uniquement au hover)
 *   - Titre h6 fontWeight 700 + Divider
 *   - Couleurs thème (success / error / warning / info) plutôt que hex custom
 *   - KPI cliquables pour filtrer la liste des échéances
 */

import { memo, useMemo, useState, type ReactElement } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { alpha, useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { animations } from "../../../styles/animations";
import { useCrmData } from "../../../queries/useCrmData";

type KpiKey = "retard" | "retard7" | "30j" | "90j";

interface VrAsset {
  id: string;
  name: string;
  site: string;
  patrimoine: string;
  criticity: string;
  nextVr: string;
  daysToVr: number;
  monthKey: string;
}

interface KpiDef {
  key: KpiKey;
  label: string;
  tooltip: string;
  tone: "error" | "warning" | "info";
  icon: ReactElement;
  match: (days: number) => boolean;
}

const KPI_DEFS: KpiDef[] = [
  {
    key: "retard",
    label: "En retard",
    tooltip: "Visites dont l'échéance est dépassée",
    tone: "error",
    icon: <ErrorIcon sx={{ fontSize: 20 }} />,
    match: (d) => d < 0,
  },
  {
    key: "retard7",
    label: "Sous 7 jours",
    tooltip: "À réaliser dans la semaine",
    tone: "error",
    icon: <WarningAmberIcon sx={{ fontSize: 20 }} />,
    match: (d) => d >= 0 && d <= 7,
  },
  {
    key: "30j",
    label: "Sous 30 jours",
    tooltip: "À réaliser dans le mois",
    tone: "warning",
    icon: <ScheduleIcon sx={{ fontSize: 20 }} />,
    match: (d) => d > 7 && d <= 30,
  },
  {
    key: "90j",
    label: "Sous 90 jours",
    tooltip: "À planifier dans le trimestre",
    tone: "info",
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />,
    match: (d) => d > 30 && d <= 90,
  },
];

const toneColor = (theme: Theme, tone: KpiDef["tone"]) => theme.palette[tone].main;

function diffDays(target: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(target);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }).replace(".", "");
}

const VrCalendar = memo(() => {
  const theme = useTheme();
  const { opportunityData } = useCrmData();
  const [filter, setFilter] = useState<"tous" | "critique">("tous");
  const [selectedKpi, setSelectedKpi] = useState<KpiKey | null>(null);

  const horizonMonthKeys = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    today.setDate(1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  const assets = useMemo<VrAsset[]>(() => {
    const out: VrAsset[] = [];
    for (const opp of opportunityData) {
      const vr = opp.estimatedBookingDate;
      if (!vr) continue;
      const days = diffDays(String(vr));
      const criticity = String(opp.engagementType || "");
      if (days > 365) continue;
      if (filter === "critique" && !criticity.includes("Critique")) continue;
      out.push({
        id: String(opp.opportunityId),
        name: String(opp.opportunity || ""),
        site: String(opp.serviceLine1 || opp.account || ""),
        patrimoine: String(opp.subSegmentCode || ""),
        criticity,
        nextVr: String(vr),
        daysToVr: days,
        monthKey: monthKey(String(vr)),
      });
    }
    return out.sort((a, b) => a.daysToVr - b.daysToVr);
  }, [opportunityData, filter]);

  const kpi = useMemo(() => {
    const out: Record<KpiKey, number> = { retard: 0, retard7: 0, "30j": 0, "90j": 0 };
    for (const a of assets) {
      for (const def of KPI_DEFS) if (def.match(a.daysToVr)) out[def.key]++;
    }
    return out;
  }, [assets]);

  const monthlyTimeline = useMemo(() => {
    const byMonth: Record<string, { total: number; critique: number; urgent: number; planifie: number }> = {};
    for (const k of horizonMonthKeys) byMonth[k] = { total: 0, critique: 0, urgent: 0, planifie: 0 };
    for (const a of assets) {
      if (a.daysToVr < 0) continue;
      const k = a.monthKey;
      if (!byMonth[k]) continue;
      byMonth[k].total++;
      if (a.criticity.includes("Critique")) byMonth[k].critique++;
      else if (a.daysToVr <= 30) byMonth[k].urgent++;
      else byMonth[k].planifie++;
    }
    const maxTotal = Math.max(1, ...Object.values(byMonth).map((m) => m.total));
    return horizonMonthKeys.map((k) => ({ key: k, ...byMonth[k], maxTotal }));
  }, [assets, horizonMonthKeys]);

  const filteredList = useMemo(() => {
    if (!selectedKpi) return assets.slice(0, 8);
    const def = KPI_DEFS.find((d) => d.key === selectedKpi);
    if (!def) return assets.slice(0, 8);
    return assets.filter((a) => def.match(a.daysToVr)).slice(0, 10);
  }, [assets, selectedKpi]);

  const toggleKpi = (key: KpiKey) => setSelectedKpi((prev) => (prev === key ? null : key));

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        overflow: "visible",
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
        ...animations.cardEntrance(0),
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Calendrier des visites réglementaires
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Suivi des VR sur les 12 mois à venir · {assets.length} actif{assets.length > 1 ? "s" : ""} concerné
            {assets.length > 1 ? "s" : ""}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={filter}
          exclusive
          size="small"
          onChange={(_, v) => v && setFilter(v)}
          sx={{
            bgcolor: "action.hover",
            borderRadius: 2,
            p: 0.5,
            "& .MuiToggleButton-root": {
              fontSize: "0.7rem",
              py: 0.25,
              px: 1.25,
              border: "none",
              borderRadius: 1.5,
              color: "text.secondary",
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                "&:hover": { bgcolor: "background.paper" },
              },
              "&:hover": { bgcolor: "transparent" },
            },
          }}
        >
          <ToggleButton value="tous">Tous</ToggleButton>
          <ToggleButton value="critique">Critiques</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ── KPIs cliquables ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
          mb: 3,
        }}
      >
        {KPI_DEFS.map((def) => {
          const color = toneColor(theme, def.tone);
          const isActive = selectedKpi === def.key;
          const value = kpi[def.key];
          return (
            <Tooltip key={def.key} title={def.tooltip} arrow>
              <Box
                onClick={() => toggleKpi(def.key)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: isActive ? alpha(color, 0.12) : alpha(color, 0.04),
                  outline: isActive ? `2px solid ${alpha(color, 0.5)}` : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  cursor: "pointer",
                  transition:
                    "background-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease, outline-color 0.25s ease",
                  "&:hover": {
                    bgcolor: alpha(color, 0.1),
                    transform: "translateY(-3px)",
                    boxShadow: `0 8px 24px ${alpha(color, 0.18)}`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    bgcolor: alpha(color, 0.18),
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {def.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1, color }}>{value}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.68rem",
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      fontWeight: 600,
                    }}
                  >
                    {def.label}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* ── Timeline mensuelle ── */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            mb: 1.5,
            display: "block",
          }}
        >
          Répartition par mois — 12 mois glissants
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${monthlyTimeline.length}, 1fr)`,
            gap: 0.75,
            alignItems: "end",
            minHeight: 120,
          }}
        >
          {monthlyTimeline.map((m) => {
            const total = m.total;
            const height = (total / m.maxTotal) * 90 + (total > 0 ? 10 : 4);
            return (
              <Tooltip
                key={m.key}
                arrow
                title={
                  <Box>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{formatMonthLabel(m.key)}</Typography>
                    <Typography sx={{ fontSize: "0.65rem" }}>
                      {total} VR planifiée{total > 1 ? "s" : ""}
                    </Typography>
                    {m.critique > 0 && (
                      <Typography sx={{ fontSize: "0.62rem", color: alpha(theme.palette.error.light, 0.9) }}>
                        {m.critique} critique{m.critique > 1 ? "s" : ""}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 0.3,
                    cursor: "pointer",
                    "&:hover > .vr-bar": { transform: "scaleY(1.05)" },
                  }}
                >
                  <Box
                    className="vr-bar"
                    sx={{
                      display: "flex",
                      flexDirection: "column-reverse",
                      height,
                      borderRadius: "6px 6px 0 0",
                      overflow: "hidden",
                      bgcolor: total === 0 ? alpha(theme.palette.text.secondary, 0.06) : "transparent",
                      transform: "scaleY(1)",
                      transformOrigin: "bottom",
                      transition: "transform 0.25s ease",
                      border: total === 0 ? `1px dashed ${alpha(theme.palette.text.secondary, 0.2)}` : "none",
                    }}
                  >
                    {m.critique > 0 && (
                      <Box sx={{ flex: m.critique, bgcolor: theme.palette.error.main, minHeight: 3 }} />
                    )}
                    {m.urgent > 0 && <Box sx={{ flex: m.urgent, bgcolor: theme.palette.warning.main, minHeight: 3 }} />}
                    {m.planifie > 0 && (
                      <Box sx={{ flex: m.planifie, bgcolor: theme.palette.info.main, minHeight: 3 }} />
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textAlign: "center",
                      color: total > 0 ? "text.primary" : "text.disabled",
                    }}
                  >
                    {total > 0 ? total : ""}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.6rem",
                      textAlign: "center",
                      color: "text.secondary",
                      textTransform: "capitalize",
                    }}
                  >
                    {formatMonthLabel(m.key)}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        <Box sx={{ display: "flex", gap: 2.5, mt: 1.5, flexWrap: "wrap" }}>
          {[
            { color: theme.palette.error.main, label: "Critique" },
            { color: theme.palette.warning.main, label: "Sous 30 j" },
            { color: theme.palette.info.main, label: "À planifier" },
          ].map((l) => (
            <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: l.color }} />
              <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>{l.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Liste échéances ── */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {selectedKpi
              ? `Filtre : ${KPI_DEFS.find((d) => d.key === selectedKpi)?.label}`
              : "Échéances les plus urgentes"}
          </Typography>
          {selectedKpi && (
            <Chip
              label="Réinitialiser"
              size="small"
              onClick={() => setSelectedKpi(null)}
              sx={{ fontSize: "0.65rem", height: 22, cursor: "pointer" }}
            />
          )}
        </Box>
        {filteredList.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.78rem" }}>
            Aucune VR dans ce bucket.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
            {filteredList.map((a) => {
              const isCrit = a.criticity.includes("Critique");
              const tone: KpiDef["tone"] = a.daysToVr < 0 ? "error" : a.daysToVr <= 30 ? "warning" : "info";
              const color = toneColor(theme, tone);
              return (
                <Box
                  key={a.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr auto auto",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.85,
                    borderRadius: 1.5,
                    bgcolor: alpha(color, 0.04),
                    transition: "background-color 0.2s ease",
                    "&:hover": { bgcolor: alpha(color, 0.12) },
                  }}
                >
                  <Chip
                    size="small"
                    label={formatShortDate(a.nextVr)}
                    sx={{
                      fontSize: "0.65rem",
                      height: 22,
                      bgcolor: alpha(color, 0.15),
                      color,
                      fontWeight: 700,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.68rem",
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.site} · {a.patrimoine}
                    </Typography>
                  </Box>
                  {isCrit ? (
                    <Chip
                      size="small"
                      label="Critique"
                      sx={{
                        fontSize: "0.62rem",
                        height: 20,
                        bgcolor: alpha(theme.palette.error.main, 0.15),
                        color: theme.palette.error.main,
                        fontWeight: 700,
                      }}
                    />
                  ) : (
                    <Box />
                  )}
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color,
                      minWidth: 52,
                      textAlign: "right",
                    }}
                  >
                    {a.daysToVr < 0 ? `J${a.daysToVr}` : `J+${a.daysToVr}`}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Paper>
  );
});

VrCalendar.displayName = "VrCalendar";
export default VrCalendar;
