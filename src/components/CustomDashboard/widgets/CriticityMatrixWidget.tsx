/**
 * CriticityMatrixWidget — matrice 4×4 de criticité des actifs (occurrence × impact).
 *
 * Source : prescription "Définition de la criticité des actifs IF" Transilien.
 * Affiche le nombre d'actifs dans chaque cellule (lu en temps réel depuis assets).
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import { CRITICITY_AXES, getCriticityCellColor } from "../../../data/gaifCriticity";
import { useCrmData } from "../../../queries/useCrmData";

const PATRIMOINES_FILTERS = ["Tous", "Ferroviaire", "Immobilier", "IO"];

const CriticityMatrixWidget = memo(() => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { opportunityData } = useCrmData();
  const [filter, setFilter] = useState("Tous");
  const [selectedCell, setSelectedCell] = useState<{ occ: number; imp: number } | null>(null);

  // Calcule pour chaque actif un (occurrence, impact) dérivé de criticité + disponibilité
  const actifs = useMemo(() => {
    return opportunityData
      .filter((a) => (filter === "Tous" ? true : a.subSegmentCode === filter))
      .map((a) => {
        // Heuristique : criticité -> impact, (100 - disponibilité) -> occurrence
        const crit = a.subSegmentCode;
        const impact = crit === "critique" ? 3 : crit === "moderee" ? 2 : 1;
        const dispo = a.winPct || 95;
        const occurrence = dispo >= 97 ? 0 : dispo >= 93 ? 1 : dispo >= 88 ? 2 : 3;
        return { ...a, _impact: impact, _occurrence: occurrence };
      });
  }, [opportunityData, filter]);

  // Grid counts
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 4 }, () => Array(4).fill(0));
    for (const a of actifs) {
      g[a._occurrence][a._impact]++;
    }
    return g;
  }, [actifs]);

  const cellActifs = useMemo(() => {
    if (!selectedCell) return [];
    return actifs.filter((a) => a._occurrence === selectedCell.occ && a._impact === selectedCell.imp).slice(0, 20);
  }, [selectedCell, actifs]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Matrice de criticité
        </Typography>
        <ToggleButtonGroup
          value={filter}
          exclusive
          size="small"
          onChange={(_, v) => v && setFilter(v)}
          sx={{
            bgcolor: "action.hover",
            borderRadius: 2,
            p: 0.25,
            gap: 0.25,
            "& .MuiToggleButton-root": {
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "none",
              border: "none",
              borderRadius: 1.5,
              color: "text.secondary",
              py: 0.5,
              px: 1.25,
              "&.Mui-selected": {
                bgcolor: theme.palette.primary.main,
                color: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                "&:hover": { bgcolor: theme.palette.primary.dark },
              },
            },
          }}
        >
          {PATRIMOINES_FILTERS.map((f) => (
            <ToggleButton key={f} value={f}>
              {f}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ flexGrow: 1, display: "grid", gridTemplateColumns: "auto 1fr", gap: 0.5 }}>
        {/* Left: Y-axis labels */}
        <Box sx={{ display: "grid", gridTemplateRows: "auto repeat(4, 1fr)" }}>
          <Box />
          {[...CRITICITY_AXES.occurrence].reverse().map((o) => (
            <Box
              key={o.level}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                pr: 1,
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "text.secondary",
              }}
            >
              {o.label}
            </Box>
          ))}
        </Box>

        {/* Right: Grid + X-axis */}
        <Box sx={{ display: "grid", gridTemplateRows: "1fr auto" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(4, 1fr)",
              gap: 0.5,
            }}
          >
            {[3, 2, 1, 0].map((occ) =>
              CRITICITY_AXES.impact.map((imp) => {
                const count = grid[occ][imp.level];
                return (
                  <Box
                    key={`${occ}-${imp.level}`}
                    onClick={() => count > 0 && setSelectedCell({ occ, imp: imp.level })}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: getCriticityCellColor(occ, imp.level, isDark),
                      border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                      borderRadius: 1,
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: isDark ? "#f3f4f6" : "#1f2937",
                      cursor: count > 0 ? "pointer" : "default",
                      transition: "all 0.15s",
                      "&:hover": count > 0 ? { transform: "scale(1.05)", boxShadow: 2 } : undefined,
                    }}
                  >
                    {count || ""}
                  </Box>
                );
              })
            )}
          </Box>
          {/* X-axis labels */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", mt: 0.5 }}>
            {CRITICITY_AXES.impact.map((imp) => (
              <Box
                key={imp.level}
                sx={{
                  textAlign: "center",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                {imp.label}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{ display: "flex", justifyContent: "space-between", mt: 1, fontSize: "0.65rem", color: "text.secondary" }}
      >
        <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
          ← Occurrence défaillance
        </Typography>
        <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
          Impact & enjeux →
        </Typography>
      </Box>

      <Dialog open={!!selectedCell} onClose={() => setSelectedCell(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Actifs en zone de criticité
          {selectedCell && (
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Chip size="small" label={`Occurrence : ${CRITICITY_AXES.occurrence[selectedCell.occ].label}`} />
              <Chip size="small" label={`Impact : ${CRITICITY_AXES.impact[selectedCell.imp].label}`} />
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          <List dense>
            {cellActifs.map((a) => (
              <ListItem key={a.opportunityId} divider>
                <ListItemText
                  primary={a.opportunity}
                  secondary={`${a.serviceLine1} · ${a.account} · Dispo ${(a.winPct || 0).toFixed(1)}%`}
                />
              </ListItem>
            ))}
            {cellActifs.length === 0 && (
              <ListItem>
                <ListItemText primary="Aucun actif dans cette zone" />
              </ListItem>
            )}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
});

CriticityMatrixWidget.displayName = "CriticityMatrixWidget";
export default CriticityMatrixWidget;
