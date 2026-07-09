/**
 * SkillsGapCoverageWidget — couverture des compétences par mission socle GAIF.
 *
 * Source : Cahier des charges Phase 1 (« analyse adéquation ressources et besoins
 * en compétences ») + 6 missions socles GAIF (slide 9 Présentation A2P).
 *
 * Pour chaque mission socle, affiche :
 *   - Le nombre d'experts niveau 4+ identifiés (dans hr_skills)
 *   - Le nombre d'experts souhaité (cible)
 *   - Le gap restant
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { useSkillsData } from "../../../queries/useSkillsData";

interface MissionSocle {
  key: string;
  label: string;
  shortLabel: string;
  /** Compétences reconnues comme couvrant cette mission socle. */
  skills: string[];
  /** Cible d'experts niveau ≥ 4 pour bien couvrir la mission. */
  target: number;
  color: string;
}

const MISSIONS: MissionSocle[] = [
  {
    key: "strat_ift",
    label: "Définition & pilotage stratégie IFT",
    shortLabel: "Stratégie IFT",
    skills: ["ISO 55001 manager", "ISO 55001 auditeur", "PSGA rédaction", "Stratégie cycle de vie"],
    target: 3,
    color: "#EB0070",
  },
  {
    key: "connaissance",
    label: "Connaissance du patrimoine",
    shortLabel: "Connaissance parc",
    skills: ["Cartographie immobilière", "Voies & ADV", "Maximo v8", "Maximo v9 déploiement", "Tour en fosse"],
    target: 4,
    color: "#0EA5E9",
  },
  {
    key: "emergence_sd",
    label: "Contribution SD & projets émergence",
    shortLabel: "Émergence SD",
    skills: ["RAO / AO / CEB", "Priorisation investissements", "MOA bâtimentaire"],
    target: 3,
    color: "#7C3AED",
  },
  {
    key: "prescription",
    label: "Prescription politiques GA",
    shortLabel: "Prescription GA",
    skills: ["Stratégie cycle de vie", "Matrice de criticité", "PSGA rédaction"],
    target: 3,
    color: "#10B981",
  },
  {
    key: "contrats",
    label: "Pilotage contrats prestataires",
    shortLabel: "Contrats prestataires",
    skills: ["Contract management TSO/SFERIS", "Contrat E2MT", "Contractualisation SNCF Réseau"],
    target: 3,
    color: "#F59E0B",
  },
  {
    key: "foncier",
    label: "Gestion dossiers fonciers",
    shortLabel: "Dossiers fonciers",
    skills: ["CGI foncier", "Désimbrication sites", "Transfert d'actifs", "Relation IDFM/AOT"],
    target: 2,
    color: "#14B8A6",
  },
];

const SkillsGapCoverageWidget = memo(() => {
  const { skillsData } = useSkillsData();

  const coverage = useMemo(() => {
    const skillsByEmployee = skillsData?.skills ?? new Map();
    return MISSIONS.map((mission) => {
      const skillSet = new Set(mission.skills);
      const experts = new Set<string>();
      const apprentices = new Set<string>();
      for (const [empId, empSkills] of skillsByEmployee.entries()) {
        for (const sk of empSkills.skills ?? []) {
          // skillFull est le nom complet (ex: "ISO 55001 manager")
          const name = sk.skillFull ?? sk.skillShort;
          if (!skillSet.has(name)) continue;
          if (sk.level >= 4) experts.add(empId);
          else if (sk.level >= 2) apprentices.add(empId);
        }
      }
      const covPct = Math.min(100, (experts.size / mission.target) * 100);
      const gap = Math.max(0, mission.target - experts.size);
      return { ...mission, expertsCount: experts.size, apprenticesCount: apprentices.size, covPct, gap };
    });
  }, [skillsData]);

  const totalGap = coverage.reduce((acc, m) => acc + m.gap, 0);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Adéquation compétences / 6 missions socles
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
          Cahier des charges Phase 1 · {totalGap} experts seniors à recruter/former
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {coverage.map((m) => {
          const covColor = m.covPct >= 100 ? "#10B981" : m.covPct >= 66 ? "#F59E0B" : "#EF4444";
          return (
            <Tooltip
              key={m.key}
              arrow
              placement="left"
              title={
                <Box sx={{ p: 0.5, maxWidth: 280 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, display: "block" }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block", mt: 0.5 }}>
                    Compétences : {m.skills.join(" · ")}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block", mt: 0.5 }}>
                    <b>{m.expertsCount}</b> experts niveau 4+ / <b>{m.target}</b> cible
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", opacity: 0.8 }}>
                    + {m.apprenticesCount} profils en montée en compétences
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  p: 0.8,
                  borderRadius: 1,
                  bgcolor: alpha(m.color, 0.07),
                  borderLeft: `3px solid ${m.color}`,
                  cursor: "help",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.35 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, color: m.color }}>
                    {m.shortLabel}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Chip
                      size="small"
                      label={`${m.expertsCount}/${m.target}`}
                      sx={{
                        fontSize: "0.6rem",
                        height: 18,
                        bgcolor: alpha(covColor, 0.18),
                        color: covColor,
                        fontWeight: 700,
                      }}
                    />
                    {m.gap > 0 && (
                      <Chip
                        size="small"
                        label={`gap ${m.gap}`}
                        sx={{
                          fontSize: "0.58rem",
                          height: 18,
                          bgcolor: alpha("#EF4444", 0.15),
                          color: "#B91C1C",
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, m.covPct)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(covColor, 0.15),
                    "& .MuiLinearProgress-bar": { bgcolor: covColor },
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
});

SkillsGapCoverageWidget.displayName = "SkillsGapCoverageWidget";
export default SkillsGapCoverageWidget;
