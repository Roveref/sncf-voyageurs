/**
 * RaciMatrixWidget — matrice RACI des processus de gestion d'actifs GAIF.
 *
 * Source : Prescription "Processus, Gouvernance et Comitologie" Transilien.
 */

import { memo, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import {
  RACI_PROCESSES,
  RACI_STAKEHOLDERS,
  RACI_MATRIX,
  RACI_COLORS,
  RACI_LABELS,
  STAKEHOLDER_ACTIVITIES,
  STAKEHOLDER_COLUMNS,
  STAKEHOLDER_MATRIX,
  type RaciProcess,
  type RaciRole,
} from "../../../data/gaifRaci";

const PHASES: Array<RaciProcess["phase"] | "Toutes"> = [
  "Toutes",
  "Pilotage",
  "Cycle de vie",
  "Amélioration continue",
  "Gestion documentaire",
];

type RaciMode = "processus" | "parties_prenantes";

const RaciMatrixWidget = memo(() => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [mode, setMode] = useState<RaciMode>("processus");
  const [phase, setPhase] = useState<(typeof PHASES)[number]>("Toutes");

  const filteredProcesses = useMemo(
    () => (phase === "Toutes" ? RACI_PROCESSES : RACI_PROCESSES.filter((p) => p.phase === phase)),
    [phase]
  );

  const isProcessMode = mode === "processus";
  const rows = isProcessMode
    ? filteredProcesses.map((p) => ({ key: p.key, label: p.label }))
    : STAKEHOLDER_ACTIVITIES.map((a) => ({ key: a.key, label: a.label }));
  const cols = isProcessMode ? RACI_STAKEHOLDERS : STAKEHOLDER_COLUMNS;
  const matrix = isProcessMode ? RACI_MATRIX : STAKEHOLDER_MATRIX;

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            RACI GAIF
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isProcessMode
              ? "11 processus × 10 rôles (Prescription Gouvernance)"
              : "12 activités × 6 parties prenantes (Note Parties Prenantes)"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            onChange={(_, v) => v && setMode(v as RaciMode)}
            sx={{
              bgcolor: "action.hover",
              borderRadius: 2,
              p: 0.25,
              "& .MuiToggleButton-root": {
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "none",
                border: "none",
                borderRadius: 1.5,
                color: "text.secondary",
                py: 0.5,
                px: 1.25,
                "&.Mui-selected": {
                  bgcolor: "background.paper",
                  color: "text.primary",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  "&:hover": { bgcolor: "background.paper" },
                },
              },
            }}
          >
            <ToggleButton value="processus">Processus</ToggleButton>
            <ToggleButton value="parties_prenantes">Parties prenantes</ToggleButton>
          </ToggleButtonGroup>
          {isProcessMode && (
            <ToggleButtonGroup
              value={phase}
              exclusive
              size="small"
              onChange={(_, v) => v && setPhase(v)}
              sx={{
                bgcolor: "action.hover",
                borderRadius: 2,
                p: 0.25,
                "& .MuiToggleButton-root": {
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  textTransform: "none",
                  border: "none",
                  borderRadius: 1.5,
                  color: "text.secondary",
                  py: 0.5,
                  px: 1,
                  "&.Mui-selected": {
                    bgcolor: "background.paper",
                    color: "text.primary",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    "&:hover": { bgcolor: "background.paper" },
                  },
                },
              }}
            >
              {PHASES.map((p) => (
                <ToggleButton key={p} value={p}>
                  {p}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { padding: "4px 6px", fontSize: "0.7rem" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: isDark ? "#1e293b" : "#f1f5f9" }}>
                {isProcessMode ? "Processus" : "Activité"}
              </TableCell>
              {cols.map((s) => (
                <TableCell
                  key={s}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    bgcolor: isDark ? "#1e293b" : "#f1f5f9",
                    fontSize: "0.62rem",
                    minWidth: 56,
                    maxWidth: 82,
                  }}
                >
                  {s}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((rowDef) => {
              const row = matrix[rowDef.key] || [];
              return (
                <TableRow key={rowDef.key} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{rowDef.label}</TableCell>
                  {row.map((role: RaciRole, idx: number) => (
                    <TableCell key={idx} align="center" sx={{ p: 0 }}>
                      {role ? (
                        <Tooltip title={RACI_LABELS[role]}>
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              margin: "0 auto",
                              borderRadius: 1,
                              bgcolor: RACI_COLORS[role],
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {role}
                          </Box>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap" }}>
        {(["R", "A", "C", "I"] as RaciRole[]).map((r) => (
          <Box key={r} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: RACI_COLORS[r] }} />
            <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
              {RACI_LABELS[r]}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

RaciMatrixWidget.displayName = "RaciMatrixWidget";
export default RaciMatrixWidget;
