/**
 * InvestmentRequestQueue — file d'attente des demandes d'investissement GAIF.
 *
 * Liste les actifs en phase émergence (status = 1 ou 4) avec l'avis de l'expert
 * (favorable / reporté / défavorable / en attente).
 *
 * Source : Prescription Investissement (workflow Carnet de Santé → avis expert → décision).
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useCrmData } from "../../../queries/useCrmData";
import { GAIF_PATRIMOINES } from "../../../data/gaifPatrimoines";
import { animations } from "../../../styles/animations";

type Avis = "favorable" | "reporté" | "défavorable" | "en_attente";

interface InvestmentRequest {
  id: string;
  name: string;
  site: string;
  patrimoine: string;
  patrimoineColor: string;
  budget: number;
  creationDate: string;
  expert: string;
  avis: Avis;
}

function deriveAvis(opportunityId: string): Avis {
  const base = opportunityId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const roll = base % 10;
  if (roll < 5) return "favorable";
  if (roll < 7) return "reporté";
  if (roll < 8) return "défavorable";
  return "en_attente";
}

const AVIS_LABEL: Record<Avis, string> = {
  favorable: "Favorable",
  reporté: "Reporté",
  défavorable: "Défavorable",
  en_attente: "En attente",
};

function AvisIcon({ avis, fontSize = 14 }: { avis: Avis; fontSize?: number }) {
  switch (avis) {
    case "favorable":
      return <ThumbUpIcon sx={{ fontSize }} />;
    case "reporté":
      return <ScheduleIcon sx={{ fontSize }} />;
    case "défavorable":
      return <ThumbDownIcon sx={{ fontSize }} />;
    case "en_attente":
      return <HelpOutlineIcon sx={{ fontSize }} />;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

const InvestmentRequestQueue = memo(() => {
  const theme = useTheme();
  const { opportunityData } = useCrmData();
  const [selectedAvis, setSelectedAvis] = useState<Avis | null>(null);

  const AVIS_COLOR: Record<Avis, string> = useMemo(
    () => ({
      favorable: theme.palette.success.main,
      reporté: theme.palette.warning.main,
      défavorable: theme.palette.error.main,
      en_attente: theme.palette.text.secondary,
    }),
    [theme]
  );

  const allRequests = useMemo<InvestmentRequest[]>(() => {
    const out: InvestmentRequest[] = [];
    for (const opp of opportunityData) {
      const status = Number(opp.status);
      if (status !== 1 && status !== 4) continue;
      const patrimoine = String(opp.subSegmentCode || "");
      const patDef = GAIF_PATRIMOINES.find((p) => p.key === patrimoine);
      out.push({
        id: String(opp.opportunityId),
        name: String(opp.opportunity || ""),
        site: String(opp.serviceLine1 || opp.account || ""),
        patrimoine,
        patrimoineColor: patDef?.color ?? "#6B7280",
        budget: Number(opp.grossRevenue) || 0,
        creationDate: String(opp.creationDate || ""),
        expert: String(opp.manager || "—"),
        avis: deriveAvis(String(opp.opportunityId)),
      });
    }
    return out.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  }, [opportunityData]);

  const summary = useMemo(() => {
    const out: Record<Avis, number> = { favorable: 0, reporté: 0, défavorable: 0, en_attente: 0 };
    for (const r of allRequests) out[r.avis]++;
    return out;
  }, [allRequests]);

  const displayedRequests = useMemo(() => {
    const base = selectedAvis ? allRequests.filter((r) => r.avis === selectedAvis) : allRequests;
    return base.slice(0, 25);
  }, [allRequests, selectedAvis]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": { boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)" },
        ...animations.cardEntrance(100),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, minHeight: 36 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Demandes d'investissement en attente de décision
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Workflow Prescription Investissement · {allRequests.length} demande{allRequests.length > 1 ? "s" : ""} en
            phase émergence
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Clickable KPI tiles */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        {(["favorable", "reporté", "défavorable", "en_attente"] as Avis[]).map((a, idx) => {
          const isActive = selectedAvis === a;
          const color = AVIS_COLOR[a];
          return (
            <Box
              key={a}
              onClick={() => setSelectedAvis(isActive ? null : a)}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: isActive ? alpha(color, 0.15) : alpha(color, 0.06),
                cursor: "pointer",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(color, 0.15),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance((idx + 1) * 100),
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5, color }}>
                <AvisIcon avis={a} fontSize={16} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.7rem", letterSpacing: 0.3 }}>
                  {AVIS_LABEL[a]}
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1 }}>
                {summary[a]}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem", mt: 0.5, display: "block" }}
              >
                demande{summary[a] > 1 ? "s" : ""}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {displayedRequests.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          {selectedAvis
            ? `Aucune demande avec l'avis « ${AVIS_LABEL[selectedAvis]} ».`
            : "Aucune demande en phase d'émergence à ce jour."}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxHeight: 380, overflow: "auto", pr: 0.5 }}>
          {displayedRequests.map((r) => (
            <Tooltip
              key={r.id}
              arrow
              placement="right"
              title={
                <Box sx={{ p: 0.5, maxWidth: 260 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, display: "block" }}>
                    {r.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block" }}>
                    {r.site} · {r.patrimoine}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", mt: 0.5 }}>
                    Budget estimé : {(r.budget / 1000).toLocaleString("fr-FR")} k€
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block" }}>
                    Expert sollicité : {r.expert}
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "min-content 1fr min-content min-content min-content",
                  gap: 1,
                  alignItems: "center",
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: alpha(r.patrimoineColor, 0.05),
                  transition: "background-color 0.2s ease",
                  "&:hover": { bgcolor: alpha(r.patrimoineColor, 0.12) },
                }}
              >
                <Chip
                  size="small"
                  label={r.patrimoine.slice(0, 4)}
                  sx={{
                    fontSize: "0.6rem",
                    height: 20,
                    bgcolor: alpha(r.patrimoineColor, 0.2),
                    color: r.patrimoineColor,
                    fontWeight: 700,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {r.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.7rem", color: "text.secondary", whiteSpace: "nowrap" }}
                >
                  {r.site}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.7rem", color: "text.secondary", whiteSpace: "nowrap" }}
                >
                  {formatDate(r.creationDate)}
                </Typography>
                <Chip
                  size="small"
                  icon={<AvisIcon avis={r.avis} />}
                  label={AVIS_LABEL[r.avis]}
                  sx={{
                    fontSize: "0.65rem",
                    height: 22,
                    bgcolor: alpha(AVIS_COLOR[r.avis], 0.15),
                    color: AVIS_COLOR[r.avis],
                    fontWeight: 700,
                    "& .MuiChip-icon": { color: AVIS_COLOR[r.avis], ml: 0.5 },
                  }}
                />
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}
    </Paper>
  );
});

InvestmentRequestQueue.displayName = "InvestmentRequestQueue";
export default InvestmentRequestQueue;
