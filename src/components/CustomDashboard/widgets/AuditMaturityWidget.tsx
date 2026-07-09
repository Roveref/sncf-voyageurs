/**
 * AuditMaturityWidget — maturité ISO 55001 par chapitre de la norme.
 *
 * Source : Note d'Audit Interne Transilien + Prescription Performance.
 * Heatmap des 23 chapitres × 2 niveaux (actuel / cible 2026).
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import {
  GAIF_ISO55001_GRID,
  getMaturityAverage,
  MATURITY_LABELS,
  MATURITY_COLORS,
} from "../../../data/gaifIso55001Grid";

const AuditMaturityWidget = memo(() => {
  const averages = useMemo(() => getMaturityAverage(), []);
  // Grouper par clause majeure (ex: 4.1 et 4.2 sous "4")
  const grouped = useMemo(() => {
    const map: Record<string, typeof GAIF_ISO55001_GRID> = {};
    for (const c of GAIF_ISO55001_GRID) {
      const chapter = c.clause.split(".")[0];
      if (!map[chapter]) map[chapter] = [];
      map[chapter].push(c);
    }
    return map;
  }, []);

  const CHAPTER_LABELS: Record<string, string> = {
    "4": "Contexte",
    "5": "Leadership",
    "6": "Planification",
    "7": "Support",
    "8": "Fonctionnement",
    "9": "Évaluation",
    "10": "Amélioration",
  };

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Maturité ISO 55001
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
            {GAIF_ISO55001_GRID.length} chapitres · actuel {averages.current} / cible {averages.target} · ∆{" "}
            {averages.gap}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {Object.entries(grouped).map(([chapterNum, chapters]) => (
          <Box key={chapterNum}>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.62rem", fontWeight: 700, color: "text.secondary", letterSpacing: 0.3 }}
            >
              § {chapterNum} — {CHAPTER_LABELS[chapterNum] || "Chapitre"}
            </Typography>
            <Box
              sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 0.5, mt: 0.25 }}
            >
              {chapters.map((c) => (
                <Tooltip
                  key={c.id}
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ p: 0.5, maxWidth: 260 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                        § {c.clause} — {c.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: "0.7rem", display: "block", mt: 0.25, opacity: 0.85 }}
                      >
                        {c.description}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: "0.7rem", display: "block", mt: 0.5 }}>
                        Actuel : <b>{MATURITY_LABELS[c.maturity]}</b> ({c.maturity}/4) · Cible :{" "}
                        <b>{MATURITY_LABELS[c.target]}</b> ({c.target}/4)
                      </Typography>
                      {c.roadmap && (
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.66rem", display: "block", mt: 0.25, fontStyle: "italic" }}
                        >
                          Roadmap : {c.roadmap}
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      p: 0.5,
                      borderRadius: 0.8,
                      bgcolor: alpha(MATURITY_COLORS[c.maturity], 0.12),
                      borderLeft: `3px solid ${MATURITY_COLORS[c.maturity]}`,
                      cursor: "help",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.6rem", fontWeight: 700, color: MATURITY_COLORS[c.maturity] }}
                    >
                      § {c.clause}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.62rem", display: "block", color: "text.secondary", lineHeight: 1.15 }}
                    >
                      {c.label.length > 26 ? c.label.slice(0, 24) + "…" : c.label}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.2 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: "0.58rem", fontWeight: 700, color: MATURITY_COLORS[c.maturity] }}
                      >
                        {c.maturity}→{c.target}
                      </Typography>
                      {c.target > c.maturity && (
                        <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#F59E0B", fontWeight: 700 }}>
                          ↑
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
        {MATURITY_LABELS.map((lbl, i) => (
          <Box key={lbl} sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.3, bgcolor: MATURITY_COLORS[i] }} />
            <Typography variant="caption" sx={{ fontSize: "0.58rem" }}>
              {i} · {lbl}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

AuditMaturityWidget.displayName = "AuditMaturityWidget";
export default AuditMaturityWidget;
