/**
 * AuditCalendarWidget — calendrier des audits internes, pré-audits,
 * audits de certification et revues de direction GAIF.
 *
 * Source : ISO 55001 §9.2 (audit interne) et §9.3 (revue de direction).
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VerifiedIcon from "@mui/icons-material/Verified";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ForumIcon from "@mui/icons-material/Forum";
import { GAIF_AUDITS as STATIC_AUDITS, type AuditEvent } from "../../../data/gaifRisks";
import { useGaifData } from "../../../queries/useGaifData";

const KIND_COLOR: Record<AuditEvent["kind"], string> = {
  audit_interne: "#0EA5E9",
  revue_direction: "#7C3AED",
  pre_audit: "#F59E0B",
  certification: "#10B981",
};

const KIND_LABEL: Record<AuditEvent["kind"], string> = {
  audit_interne: "Audit interne",
  revue_direction: "Revue de direction",
  pre_audit: "Pré-audit",
  certification: "Certification",
};

const STATUS_COLOR: Record<AuditEvent["status"], string> = {
  planifie: "#94A3B8",
  en_cours: "#F59E0B",
  realise: "#10B981",
};

const STATUS_LABEL: Record<AuditEvent["status"], string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  realise: "Réalisé",
};

function KindIcon({ kind }: { kind: AuditEvent["kind"] }) {
  switch (kind) {
    case "audit_interne":
      return <AssignmentIcon sx={{ fontSize: 14 }} />;
    case "revue_direction":
      return <ForumIcon sx={{ fontSize: 14 }} />;
    case "pre_audit":
      return <CalendarMonthIcon sx={{ fontSize: 14 }} />;
    case "certification":
      return <VerifiedIcon sx={{ fontSize: 14 }} />;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysFromNow(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const AuditCalendarWidget = memo(() => {
  const { audits: dbAudits } = useGaifData();
  const auditsList = useMemo<AuditEvent[]>(() => {
    if (dbAudits.length === 0) return STATIC_AUDITS;
    return dbAudits.map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.label,
      scope: a.scope ?? "",
      date: a.plannedDate,
      auditeur: a.auditor ?? "",
      status: a.status,
    }));
  }, [dbAudits]);

  const sorted = useMemo(
    () => [...auditsList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [auditsList]
  );

  const summary = useMemo(() => {
    const out = { planifie: 0, en_cours: 0, realise: 0 } as Record<AuditEvent["status"], number>;
    for (const a of auditsList) out[a.status]++;
    return out;
  }, [auditsList]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Calendrier des audits ISO 55001
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
          {summary.planifie} planifié{summary.planifie > 1 ? "s" : ""} · {summary.en_cours} en cours · {summary.realise}{" "}
          réalisé{summary.realise > 1 ? "s" : ""}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {sorted.map((a) => {
          const days = daysFromNow(a.date);
          const urgency = days < 30 ? "#EF4444" : days < 90 ? "#F59E0B" : "#10B981";
          return (
            <Tooltip
              key={a.id}
              arrow
              placement="left"
              title={
                <Box sx={{ p: 0.5, maxWidth: 260 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, display: "block" }}>
                    {a.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block", mt: 0.5 }}>
                    Scope : {a.scope}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", mt: 0.5, opacity: 0.85 }}>
                    Auditeur : {a.auditeur}
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  p: 0.8,
                  borderRadius: 0.8,
                  bgcolor: alpha(KIND_COLOR[a.kind], 0.07),
                  borderLeft: `3px solid ${KIND_COLOR[a.kind]}`,
                  display: "grid",
                  gridTemplateColumns: "min-content 1fr min-content",
                  gap: 0.75,
                  alignItems: "center",
                }}
              >
                <Chip
                  size="small"
                  icon={<KindIcon kind={a.kind} />}
                  label={KIND_LABEL[a.kind]}
                  sx={{
                    fontSize: "0.58rem",
                    height: 18,
                    bgcolor: alpha(KIND_COLOR[a.kind], 0.18),
                    color: KIND_COLOR[a.kind],
                    fontWeight: 700,
                    "& .MuiChip-icon": { color: KIND_COLOR[a.kind], ml: 0.5 },
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                    {formatDate(a.date)} ·{" "}
                    <span style={{ color: urgency, fontWeight: 700 }}>
                      {days >= 0 ? `dans ${days} j` : `il y a ${-days} j`}
                    </span>
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={STATUS_LABEL[a.status]}
                  sx={{
                    fontSize: "0.56rem",
                    height: 17,
                    bgcolor: alpha(STATUS_COLOR[a.status], 0.18),
                    color: STATUS_COLOR[a.status],
                    fontWeight: 700,
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

AuditCalendarWidget.displayName = "AuditCalendarWidget";
export default AuditCalendarWidget;
