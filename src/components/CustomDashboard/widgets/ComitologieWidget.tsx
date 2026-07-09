/**
 * ComitologieWidget — calendrier synthétique des 4 comités officiels GAIF.
 *
 * Affiche pour chaque comité : prochaine occurrence, cadence, pôle responsable,
 * thèmes principaux. Tooltip complet avec livrables attendus.
 *
 * Source : Prescription Gouvernance et Comitologie + slide 16 Présentation A2P.
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { GAIF_COMITES as STATIC_COMITES, type ComiteCadence } from "../../../data/gaifComites";
import { useGaifData } from "../../../queries/useGaifData";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysFromNow(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const CADENCE_LABEL: Record<ComiteCadence, string> = {
  mensuel: "Mensuel",
  bimestriel: "Bimestriel",
  trimestriel: "Trimestriel",
  semestriel: "Semestriel",
};

const ComitologieWidget = memo(() => {
  const theme = useTheme();
  const { comites: dbComites } = useGaifData();
  const comites = useMemo(() => {
    // Utilise les données SQLite si dispo, sinon fallback sur les constantes statiques
    const source =
      dbComites.length > 0
        ? dbComites.map((c) => ({
            key: c.id,
            label: c.label,
            shortLabel: c.shortLabel ?? c.label,
            cadence: c.cadence as ComiteCadence,
            coAnimateur: c.coAnimateur ?? "",
            themes: c.themes,
            livrables: [] as string[],
            nextOccurrence: c.nextOccurrence,
            color: c.color ?? "#6B7280",
            raciLead: "",
          }))
        : STATIC_COMITES;
    return [...source].sort((a, b) => new Date(a.nextOccurrence).getTime() - new Date(b.nextOccurrence).getTime());
  }, [dbComites]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Comitologie GAIF
        </Typography>
        <Typography variant="body2" color="text.secondary">
          4 comités officiels · Prescription Gouvernance
        </Typography>
        <Divider sx={{ mt: 1.5 }} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flexGrow: 1, overflow: "auto" }}>
        {comites.map((c) => {
          const days = daysFromNow(c.nextOccurrence);
          const urgency = days <= 7 ? "urgent" : days <= 21 ? "soon" : "normal";
          const urgencyColor =
            urgency === "urgent"
              ? theme.palette.error.main
              : urgency === "soon"
                ? theme.palette.warning.main
                : theme.palette.success.main;
          return (
            <Tooltip
              key={c.key}
              arrow
              placement="left"
              title={
                <Box sx={{ p: 0.5, maxWidth: 320 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                    {c.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", display: "block", opacity: 0.85, mb: 1 }}>
                    Co-animateur : {c.coAnimateur}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                    Thèmes
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.68rem" }}>
                    {c.themes.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mt: 0.75 }}>
                    Livrables
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.68rem" }}>
                    {c.livrables.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </Box>
                </Box>
              }
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                  cursor: "help",
                  transition: "background-color 0.2s ease",
                  "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75, gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.82rem" }}>
                    {c.shortLabel}
                  </Typography>
                  <Chip
                    size="small"
                    icon={<CalendarMonthIcon sx={{ fontSize: 12 }} />}
                    label={CADENCE_LABEL[c.cadence]}
                    sx={{
                      fontSize: "0.65rem",
                      height: 20,
                      bgcolor: alpha(theme.palette.text.primary, 0.08),
                      color: "text.secondary",
                      fontWeight: 600,
                      "& .MuiChip-icon": { color: "text.secondary" },
                    }}
                  />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                    {formatDate(c.nextOccurrence)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: "0.72rem", fontWeight: 700, color: urgencyColor, whiteSpace: "nowrap" }}
                  >
                    {days === 0 ? "aujourd'hui" : days > 0 ? `dans ${days} j` : `il y a ${-days} j`}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.7rem", display: "block", mt: 0.5 }}
                >
                  {c.coAnimateur}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
});

ComitologieWidget.displayName = "ComitologieWidget";
export default ComitologieWidget;
