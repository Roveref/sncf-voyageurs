/**
 * RisksRegisterWidget — registre des risques & opportunités ISO 55001.
 *
 * Source : Prescription Performance + ISO 55001 §6.1 + audit interne.
 * Bascule entre vue « Risques » et « Opportunités ». Le funnel (Identifié →
 * Évalué → Plan d'action → Clôturé) complète la liste détaillée.
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { alpha } from "@mui/material/styles";
import {
  GAIF_RISKS as STATIC_RISKS,
  SEVERITY_COLORS,
  SEVERITY_LABEL,
  STAGE_LABEL,
  type RiskKind,
  type RiskStage,
  type RiskSeverity,
} from "../../../data/gaifRisks";
import { useGaifData } from "../../../queries/useGaifData";

const STAGES: RiskStage[] = ["identifie", "evalue", "plan_mitigation", "cloture"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

const RisksRegisterWidget = memo(() => {
  const [kind, setKind] = useState<RiskKind>("risque");
  const { risks: dbRisks } = useGaifData();

  const allRisks = useMemo(() => {
    // Utilise SQLite si dispo, sinon fallback sur les constantes statiques
    if (dbRisks.length === 0) return STATIC_RISKS;
    return dbRisks.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      kind: r.kind,
      severity: r.severity as RiskSeverity,
      stage: r.stage as RiskStage,
      owner: r.ownerId ?? "",
      processus: r.processus ?? "",
      patrimoine: r.patrimoine,
      dueDate: r.dueDate ?? "",
    }));
  }, [dbRisks]);

  const filtered = useMemo(() => allRisks.filter((r) => r.kind === kind), [allRisks, kind]);
  const byStage = useMemo(() => {
    const out: Record<RiskStage, number> = { identifie: 0, evalue: 0, plan_mitigation: 0, cloture: 0 };
    for (const r of filtered) out[r.stage]++;
    return out;
  }, [filtered]);
  const total = filtered.length;

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {kind === "risque" ? "Registre des risques" : "Opportunités d'amélioration"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
            ISO 55001 §6.1 · {total} entrée{total > 1 ? "s" : ""}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={kind}
          exclusive
          size="small"
          onChange={(_, v) => v && setKind(v as RiskKind)}
          sx={{ "& .MuiToggleButton-root": { fontSize: "0.65rem", py: 0.2, px: 0.8 } }}
        >
          <ToggleButton value="risque">Risques</ToggleButton>
          <ToggleButton value="opportunite">Opportunités</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Funnel par étape */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.5, mb: 1.5 }}>
        {STAGES.map((s) => {
          const pct = total > 0 ? (byStage[s] / total) * 100 : 0;
          const stageColor =
            s === "cloture" ? "#10B981" : s === "plan_mitigation" ? "#F59E0B" : s === "evalue" ? "#0EA5E9" : "#94A3B8";
          return (
            <Box key={s} sx={{ p: 0.75, borderRadius: 0.8, bgcolor: alpha(stageColor, 0.1), textAlign: "center" }}>
              <Typography
                variant="caption"
                sx={{ fontSize: "0.55rem", fontWeight: 700, color: stageColor, display: "block", letterSpacing: 0.2 }}
              >
                {STAGE_LABEL[s].toUpperCase()}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.1rem", color: stageColor }}>
                {byStage[s]}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "text.secondary" }}>
                {pct.toFixed(0)}%
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.4 }}>
        {filtered.map((r) => (
          <Tooltip
            key={r.id}
            arrow
            placement="left"
            title={
              <Box sx={{ p: 0.5, maxWidth: 280 }}>
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, display: "block" }}>
                  {r.title}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block", mt: 0.5, opacity: 0.85 }}>
                  {r.description}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", mt: 0.5 }}>
                  <b>Owner</b> : {r.owner} · <b>Processus</b> : {r.processus}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block" }}>
                  <b>Échéance</b> : {formatDate(r.dueDate)}
                </Typography>
              </Box>
            }
          >
            <Box
              sx={{
                p: 0.6,
                borderRadius: 0.8,
                bgcolor: alpha(SEVERITY_COLORS[r.severity], 0.06),
                borderLeft: `3px solid ${SEVERITY_COLORS[r.severity]}`,
                display: "grid",
                gridTemplateColumns: "min-content 1fr min-content",
                gap: 0.75,
                alignItems: "center",
              }}
            >
              <Chip
                size="small"
                label={r.id.replace(/^(RISK|OPP)-/, "")}
                sx={{
                  fontSize: "0.55rem",
                  height: 17,
                  bgcolor: alpha(SEVERITY_COLORS[r.severity], 0.18),
                  color: SEVERITY_COLORS[r.severity],
                  fontWeight: 700,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.title}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                  {r.patrimoine ?? "Transverse"} · {r.owner}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={SEVERITY_LABEL[r.severity]}
                sx={{
                  fontSize: "0.58rem",
                  height: 17,
                  bgcolor: alpha(SEVERITY_COLORS[r.severity], 0.18),
                  color: SEVERITY_COLORS[r.severity],
                  fontWeight: 700,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
});

RisksRegisterWidget.displayName = "RisksRegisterWidget";
export default RisksRegisterWidget;
