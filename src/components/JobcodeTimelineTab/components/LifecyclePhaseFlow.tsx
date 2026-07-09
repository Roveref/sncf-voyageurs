/**
 * LifecyclePhaseFlow — représentation horizontale des 4 phases PSGA du cycle de vie
 * d'un actif installation fixe : Émergence → Stratégie → Exploitation → Fin de vie.
 *
 * Chaque phase affiche :
 *   - Compteur d'actifs (du dataset courant) positionnés sur la phase
 *   - Responsable RACI
 *   - Directives PSGA synthétiques (tooltip)
 *   - Jalons
 *
 * Le composant réagit au patrimoine sélectionné via la prop `filterPatrimoine`.
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { alpha } from "@mui/material/styles";
import { GAIF_LIFECYCLE_PHASES, phaseForStatus, type LifecyclePhase } from "../../../data/gaifLifecyclePrescriptions";
import { useCrmData } from "../../../queries/useCrmData";
import { animations } from "../../../styles/animations";

interface LifecyclePhaseFlowProps {
  filterPatrimoine?: string | null;
  filterSite?: string | null;
}

const LifecyclePhaseFlow = memo(({ filterPatrimoine, filterSite }: LifecyclePhaseFlowProps) => {
  const { opportunityData } = useCrmData();
  const [expanded, setExpanded] = useState(true);

  const phaseStats = useMemo(() => {
    const counts: Record<LifecyclePhase, number> = {
      emergence: 0,
      strategie: 0,
      exploitation: 0,
      fin_de_vie: 0,
    };
    for (const opp of opportunityData) {
      if (filterPatrimoine && opp.subSegmentCode !== filterPatrimoine) continue;
      if (filterSite && opp.serviceLine1 !== filterSite) continue;
      const phase = phaseForStatus(Number(opp.status));
      if (phase) counts[phase]++;
    }
    const total = Object.values(counts).reduce((acc, v) => acc + v, 0);
    return { counts, total };
  }, [opportunityData, filterPatrimoine, filterSite]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": { boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)" },
        ...animations.cardEntrance(0),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, minHeight: 36 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Cycle de vie des actifs — 4 phases PSGA
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {phaseStats.total} actif{phaseStats.total > 1 ? "s" : ""} dans le périmètre filtré · référentiel
            Prescriptions Cycle de vie
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Réduire" : "Déployer"}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Collapse in={expanded}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          {GAIF_LIFECYCLE_PHASES.map((phase, idx) => {
            const count = phaseStats.counts[phase.key];
            const share = phaseStats.total > 0 ? (count / phaseStats.total) * 100 : 0;
            return (
              <Tooltip
                key={phase.key}
                title={
                  <Box sx={{ p: 0.5, maxWidth: 320 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                      {phase.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.7rem", display: "block", mb: 1, opacity: 0.85 }}>
                      {phase.description}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mt: 0.5, mb: 0.25 }}>
                      Directives
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.68rem" }}>
                      {phase.directives.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mt: 0.75, mb: 0.25 }}>
                      Jalons
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.68rem", opacity: 0.85 }}>
                      {phase.jalons.join(" → ")}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    position: "relative",
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(phase.color, 0.06),
                    cursor: "help",
                    height: "100%",
                    transition:
                      "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                    "&:hover": {
                      bgcolor: alpha(phase.color, 0.12),
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                    },
                    ...animations.cardEntrance((idx + 1) * 100),
                  }}
                >
                  {idx < GAIF_LIFECYCLE_PHASES.length - 1 && (
                    <ChevronRightIcon
                      sx={{
                        position: "absolute",
                        right: -14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 2,
                        display: { xs: "none", md: "block" },
                        color: phase.color,
                        fontSize: 22,
                      }}
                    />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: phase.color,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      display: "block",
                      mb: 0.5,
                    }}
                  >
                    Phase {idx + 1} · {phase.shortLabel}
                  </Typography>

                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: phase.color, lineHeight: 1 }}>
                      {count}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      actifs · {share.toFixed(0)}%
                    </Typography>
                  </Box>

                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, mb: 1.5, lineHeight: 1.4 }}>
                    {phase.label}
                  </Typography>

                  <Chip
                    size="small"
                    label={phase.raciLead}
                    sx={{
                      fontSize: "0.65rem",
                      height: 20,
                      bgcolor: alpha(phase.color, 0.15),
                      color: phase.color,
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
});

LifecyclePhaseFlow.displayName = "LifecyclePhaseFlow";
export default LifecyclePhaseFlow;
