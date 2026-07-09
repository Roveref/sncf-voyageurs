/**
 * SchemaDirecteurImmoWidget — trajectoire MCO immobilier + conformité décrets par site.
 *
 * Source : slide 19/21 Présentation A2P (pilotage trajectoires immobilier, GTB,
 * décrets BACS/Tertiaire/CEPIA/ACC).
 *
 * Par site immobilier TN, affiche :
 *   - État ABE dominant (du parc)
 *   - Nombre de bâtiments en alerte (Insuffisant/Moyen)
 *   - Taux de conformité moyen
 *   - Couverture GTB (% surface équipée — proxy sur l'existence d'un contrat E2MT/Engie)
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { alpha } from "@mui/material/styles";
import { useCrmData } from "../../../queries/useCrmData";
import { parseAssetMetrics, ETAT_ABE_COLORS } from "../../../data/gaifAssetMetrics";

type ViewMode = "etat" | "conformite" | "gtb";

interface SiteSummary {
  site: string;
  total: number;
  surface: number;
  satisfaisant: number;
  acceptable: number;
  moyen: number;
  insuffisant: number;
  nonVisite: number;
  confSum: number;
  gtbCover: number;
  worstAbe: number; // 0-5, plus haut = pire
}

const ALERT_THRESHOLD = 20; // % bâtiments en Moyen/Insuffisant avant alerte

const SchemaDirecteurImmoWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const [view, setView] = useState<ViewMode>("etat");

  const sites = useMemo<SiteSummary[]>(() => {
    const map: Record<string, SiteSummary> = {};
    for (const opp of opportunityData) {
      if (opp.subSegmentCode !== "Immobilier") continue;
      const site = String(opp.serviceLine1 || "—");
      if (!map[site]) {
        map[site] = {
          site,
          total: 0,
          surface: 0,
          satisfaisant: 0,
          acceptable: 0,
          moyen: 0,
          insuffisant: 0,
          nonVisite: 0,
          confSum: 0,
          gtbCover: 0,
          worstAbe: 0,
        };
      }
      const s = map[site];
      const metrics = parseAssetMetrics(opp);
      s.total++;
      s.surface += metrics.surfaceM2;
      s.confSum += Number(opp.cm1Pct) || 0;
      // GTB cover : on considère équipé si partner inclut "Engie" ou "E2MT"
      if (String(opp.partner || "").match(/(Engie|E2MT)/)) s.gtbCover++;
      switch (metrics.etatAbe) {
        case "Satisfaisant":
          s.satisfaisant++;
          break;
        case "Acceptable":
          s.acceptable++;
          break;
        case "Moyen":
          s.moyen++;
          s.worstAbe = Math.max(s.worstAbe, 2);
          break;
        case "Insuffisant":
          s.insuffisant++;
          s.worstAbe = Math.max(s.worstAbe, 3);
          break;
        case "Non Visité":
          s.nonVisite++;
          break;
      }
    }
    return Object.values(map)
      .filter((s) => s.total >= 3) // Garde les sites avec 3+ bâtiments
      .sort((a, b) => b.insuffisant + b.moyen - (a.insuffisant + a.moyen));
  }, [opportunityData]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Schéma directeur immobilier
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
            {sites.length} sites · trajectoire MCO + conformité décrets BACS/Tertiaire
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, v) => v && setView(v as ViewMode)}
          sx={{ "& .MuiToggleButton-root": { fontSize: "0.6rem", py: 0.2, px: 0.7 } }}
        >
          <ToggleButton value="etat">État ABE</ToggleButton>
          <ToggleButton value="conformite">Conformité</ToggleButton>
          <ToggleButton value="gtb">Couv. GTB</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {sites.map((s) => {
          const alertPct = s.total > 0 ? ((s.insuffisant + s.moyen) / s.total) * 100 : 0;
          const alertColor = alertPct > ALERT_THRESHOLD ? "#EF4444" : alertPct > 10 ? "#F59E0B" : "#10B981";
          const confAvg = s.total > 0 ? s.confSum / s.total : 0;
          const gtbPct = s.total > 0 ? (s.gtbCover / s.total) * 100 : 0;
          const primaryValue = view === "etat" ? alertPct : view === "conformite" ? confAvg : gtbPct;
          const primaryLabel = view === "etat" ? "Moyen/Insuf." : view === "conformite" ? "Conformité" : "GTB";
          const primaryColor =
            view === "etat"
              ? alertColor
              : view === "conformite"
                ? confAvg >= 95
                  ? "#10B981"
                  : confAvg >= 90
                    ? "#F59E0B"
                    : "#EF4444"
                : gtbPct >= 80
                  ? "#10B981"
                  : gtbPct >= 40
                    ? "#F59E0B"
                    : "#EF4444";
          const progressBg = alpha(primaryColor, 0.15);
          return (
            <Tooltip
              key={s.site}
              arrow
              placement="left"
              title={
                <Box sx={{ p: 0.5, maxWidth: 300 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.72rem", fontWeight: 700, display: "block" }}>
                    {s.site}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block" }}>
                    {s.total} bâtiments · {Math.round(s.surface).toLocaleString("fr-FR")} m²
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", mt: 0.5 }}>
                    <b>État ABE</b> : {s.satisfaisant} Satisfait · {s.acceptable} Accept. · {s.moyen} Moyen ·{" "}
                    {s.insuffisant} Insuf.
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block" }}>
                    <b>Conformité moyenne</b> : {confAvg.toFixed(1)}% · <b>GTB/E2MT</b> : {gtbPct.toFixed(0)}%
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  p: 0.7,
                  borderRadius: 0.8,
                  bgcolor: alpha(primaryColor, 0.06),
                  borderLeft: `3px solid ${primaryColor}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.3 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700 }}>
                    {s.site}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Chip
                      size="small"
                      label={`${s.total} bât.`}
                      sx={{ fontSize: "0.55rem", height: 16, bgcolor: "rgba(0,0,0,0.06)", fontWeight: 600 }}
                    />
                    <Chip
                      size="small"
                      label={`${primaryValue.toFixed(view === "conformite" ? 1 : 0)}% ${primaryLabel}`}
                      sx={{
                        fontSize: "0.58rem",
                        height: 16,
                        bgcolor: alpha(primaryColor, 0.18),
                        color: primaryColor,
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, primaryValue)}
                  sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: progressBg,
                    "& .MuiLinearProgress-bar": { bgcolor: primaryColor },
                  }}
                />
                {view === "etat" && (
                  <Box sx={{ display: "flex", gap: 0.3, mt: 0.3 }}>
                    {(["Satisfaisant", "Acceptable", "Moyen", "Insuffisant"] as const).map((k) => {
                      const count =
                        k === "Satisfaisant"
                          ? s.satisfaisant
                          : k === "Acceptable"
                            ? s.acceptable
                            : k === "Moyen"
                              ? s.moyen
                              : s.insuffisant;
                      if (count === 0) return null;
                      return (
                        <Box
                          key={k}
                          sx={{
                            flexGrow: count,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: ETAT_ABE_COLORS[k],
                            opacity: 0.8,
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
});

SchemaDirecteurImmoWidget.displayName = "SchemaDirecteurImmoWidget";
export default SchemaDirecteurImmoWidget;
