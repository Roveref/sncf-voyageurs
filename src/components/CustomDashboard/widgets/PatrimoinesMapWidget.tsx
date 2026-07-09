/**
 * PatrimoinesMapWidget — carte visuelle des 6 patrimoines GAIF.
 *
 * Affiche chaque patrimoine sous forme de carte avec :
 *  - label + icône
 *  - volume (chiffres clés)
 *  - disponibilité moyenne et conformité moyenne calculées en temps réel
 *    depuis les actifs présents dans la base
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import TrainIcon from "@mui/icons-material/Train";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import BuildIcon from "@mui/icons-material/Build";
import CableIcon from "@mui/icons-material/Cable";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { alpha, useTheme } from "@mui/material/styles";
import { GAIF_PATRIMOINES } from "../../../data/gaifPatrimoines";
import { useCrmData } from "../../../queries/useCrmData";

const ICON_MAP: Record<string, React.ReactElement> = {
  Train: <TrainIcon />,
  HomeWork: <HomeWorkIcon />,
  Build: <BuildIcon />,
  Cable: <CableIcon />,
  MenuBook: <MenuBookIcon />,
  Storefront: <StorefrontIcon />,
};

const PatrimoinesMapWidget = memo(() => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { opportunityData } = useCrmData();

  // Aggrégats par patrimoine
  const stats = useMemo(() => {
    const m: Record<string, { count: number; disponibilite: number; conformite: number; critiques: number }> = {};
    for (const p of GAIF_PATRIMOINES) {
      m[p.key] = { count: 0, disponibilite: 0, conformite: 0, critiques: 0 };
    }
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      m[pat].count++;
      m[pat].disponibilite += Number(opp.winPct) || 0;
      m[pat].conformite += Number(opp.cm1Pct) || 0;
      if (opp.subSegmentCode === "critique") m[pat].critiques++;
    }
    for (const key of Object.keys(m)) {
      if (m[key].count > 0) {
        m[key].disponibilite = m[key].disponibilite / m[key].count;
        m[key].conformite = m[key].conformite / m[key].count;
      }
    }
    return m;
  }, [opportunityData]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Les 6 patrimoines d'installations fixes
        </Typography>
        <Divider sx={{ mt: 1 }} />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          flexGrow: 1,
        }}
      >
        {GAIF_PATRIMOINES.map((p) => {
          const s = stats[p.key];
          const count = s?.count || 0;
          const dispo = s?.disponibilite || 0;
          const conf = s?.conformite || 0;
          const crit = s?.critiques || 0;

          return (
            <Box
              key={p.key}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(p.color, isDark ? 0.1 : 0.06),
                display: "flex",
                flexDirection: "column",
                gap: 1,
                transition: "background-color 0.3s, transform 0.3s, box-shadow 0.3s",
                "&:hover": {
                  bgcolor: alpha(p.color, isDark ? 0.18 : 0.12),
                  transform: "translateY(-3px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ color: p.color, display: "flex" }}>{ICON_MAP[p.icon] || <BuildIcon />}</Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.2 }}>
                  {p.label}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                {p.volumeLabel}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                <Chip
                  label={`${count} actifs`}
                  size="small"
                  sx={{
                    fontSize: "0.68rem",
                    height: 22,
                    bgcolor: alpha(p.color, 0.2),
                    color: p.color,
                    fontWeight: 700,
                  }}
                />
                {crit > 0 && (
                  <Chip
                    label={`${crit} critiques`}
                    size="small"
                    sx={{
                      fontSize: "0.68rem",
                      height: 22,
                      bgcolor: alpha(theme.palette.error.main, 0.15),
                      color: theme.palette.error.main,
                      fontWeight: 700,
                    }}
                  />
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 2, mt: "auto", pt: 0.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
                    Disponibilité
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, fontSize: "1rem", color: p.color, lineHeight: 1.2 }}
                  >
                    {dispo.toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
                    Conformité
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, fontSize: "1rem", color: p.color, lineHeight: 1.2 }}
                  >
                    {conf.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});

PatrimoinesMapWidget.displayName = "PatrimoinesMapWidget";
export default PatrimoinesMapWidget;
