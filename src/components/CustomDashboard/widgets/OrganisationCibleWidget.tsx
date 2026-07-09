/**
 * OrganisationCibleWidget — visualisation de l'organisation cible GAIF / A2P à 3 ans.
 *
 * Source : slides 5, 6 et 7 Présentation A2P.
 * Affiche l'organigramme synthétique avec headcount actuel vs cible,
 * et met en évidence les mouvements prévus (+ / − / remplacement).
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import { GAIF_ORGANISATION_CIBLE, getHeadcountTotals } from "../../../data/gaifOrganisationCible";

const OrganisationCibleWidget = memo(() => {
  const theme = useTheme();
  const totals = useMemo(() => getHeadcountTotals(), []);
  // Regroupement par niveau pour affichage en cascade.
  const direction = GAIF_ORGANISATION_CIBLE.find((n) => n.key === "gaif");
  const sousPoles = GAIF_ORGANISATION_CIBLE.filter((n) => n.parent === "gaif");
  const subteams = GAIF_ORGANISATION_CIBLE.filter((n) => n.parent === "pole_expat");

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Organisation cible 3 ans
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cible janvier 2026-2027 · actuel {totals.current} ETP → cible {totals.target} ETP · ∆ +{totals.delta}
        </Typography>
        <Divider sx={{ mt: 1.5 }} />
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {direction && (
          <Tooltip arrow placement="top" title={direction.role}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontSize: "0.82rem", fontWeight: 700, color: theme.palette.primary.main }}
                >
                  {direction.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.72rem" }}>
                  {direction.role}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${direction.headcount.current} → ${direction.headcount.target}`}
                sx={{
                  fontSize: "0.7rem",
                  height: 22,
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  color: theme.palette.primary.main,
                  fontWeight: 700,
                }}
              />
            </Box>
          </Tooltip>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 1.5 }}>
          {sousPoles.map((p) => {
            const delta = p.headcount.target - p.headcount.current;
            const deltaColor =
              delta > 0
                ? theme.palette.success.main
                : delta < 0
                  ? theme.palette.error.main
                  : theme.palette.text.secondary;
            return (
              <Tooltip
                key={p.key}
                arrow
                placement="top"
                title={
                  <Box sx={{ p: 0.5, maxWidth: 240 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                      {p.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.7rem", display: "block", opacity: 0.8 }}>
                      {p.role}
                    </Typography>
                    {p.headcount.note && (
                      <Typography
                        variant="caption"
                        sx={{ fontSize: "0.66rem", display: "block", mt: 0.5, fontStyle: "italic" }}
                      >
                        {p.headcount.note}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                    cursor: "help",
                    transition: "background-color 0.2s ease",
                    "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.72rem", fontWeight: 700, display: "block", mb: 0.5 }}
                  >
                    {p.label}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.main, lineHeight: 1 }}>
                      {p.headcount.target}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.7rem", color: deltaColor, fontWeight: 700 }}>
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "="}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: "0.72rem", display: "block", mb: 0.75, fontWeight: 600 }}
        >
          Groupes d'expertise (Pôle Excellence Patrimoine)
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {subteams.map((t) => (
            <Tooltip key={t.key} arrow title={`${t.role} · ${t.headcount.current} → ${t.headcount.target}`}>
              <Chip
                size="small"
                label={`${t.label} · ${t.headcount.target}`}
                sx={{
                  fontSize: "0.7rem",
                  height: 22,
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  color: "text.secondary",
                  fontWeight: 600,
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
});

OrganisationCibleWidget.displayName = "OrganisationCibleWidget";
export default OrganisationCibleWidget;
