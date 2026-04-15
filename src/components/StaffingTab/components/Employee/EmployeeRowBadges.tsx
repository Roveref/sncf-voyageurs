import React, { memo } from "react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import WarningIcon from "@mui/icons-material/Warning";
import { FRAG_WARN, FRAG_ALERT, TL_WARN, TL_ALERT, SAP_COMPLETE, getGradeAbbr } from "../../constants";

// ── Shared sx constants (module-level, never recreated) ──
const SX_BADGE_BASE = {
  fontSize: "9px",
  fontWeight: 700,
  px: 0.5,
  borderRadius: 1,
  flexShrink: 0,
} as const;

// ─── AlertDots ───────────────────────────────────────────────────

interface AlertDotsProps {
  staffAlerts: { icon: string; color: string; tip: string }[];
}

export const AlertDots = memo(({ staffAlerts }: AlertDotsProps) => {
  if (staffAlerts.length === 0) return null;
  return (
    <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
      {staffAlerts.map((al) => (
        <WarningIcon key={al.tip} sx={{ height: 12, width: 12, color: al.color }} titleAccess={al.tip} />
      ))}
    </Box>
  );
});
AlertDots.displayName = "AlertDots";

// ─── FragBadge ───────────────────────────────────────────────────

interface FragBadgeProps {
  fragScore: number;
}

export const FragBadge = memo(({ fragScore }: FragBadgeProps) => {
  if (fragScore <= 0) return null;
  return (
    <Box
      component="span"
      sx={{
        ...SX_BADGE_BASE,
        bgcolor:
          fragScore >= FRAG_ALERT
            ? alpha("#ef4444", 0.1)
            : fragScore >= FRAG_WARN
              ? alpha("#d97706", 0.12)
              : alpha("#16a34a", 0.1),
        color: fragScore >= FRAG_ALERT ? "#ef4444" : fragScore >= FRAG_WARN ? "#d97706" : "#16a34a",
      }}
    >
      F{fragScore}
    </Box>
  );
});
FragBadge.displayName = "FragBadge";

// ─── TransitionLossBadge ─────────────────────────────────────────

interface TransitionLossBadgeProps {
  empTLPct: number;
  teamTLPct: number;
}

export const TransitionLossBadge = memo(({ empTLPct, teamTLPct }: TransitionLossBadgeProps) => {
  if (empTLPct <= 0) return null;
  return (
    <Box
      component="span"
      sx={{
        ...SX_BADGE_BASE,
        bgcolor:
          empTLPct >= TL_ALERT
            ? alpha("#ef4444", 0.1)
            : empTLPct >= TL_WARN
              ? alpha("#d97706", 0.12)
              : alpha("#ea580c", 0.1),
        color: empTLPct >= TL_ALERT ? "#ef4444" : empTLPct >= TL_WARN ? "#d97706" : "#ea580c",
      }}
    >
      {empTLPct.toFixed(2)}% | eq {teamTLPct.toFixed(2)}%
    </Box>
  );
});
TransitionLossBadge.displayName = "TransitionLossBadge";

// ─── GradeTransitionBadge ────────────────────────────────────────

interface GradeTransitionBadgeProps {
  gradeTransition: { from: string; to: string; since: string } | null;
}

export const GradeTransitionBadge = memo(({ gradeTransition }: GradeTransitionBadgeProps) => {
  if (!gradeTransition) return null;
  return (
    <Box
      component="span"
      title={`Transition ${gradeTransition.from} \u2192 ${gradeTransition.to} on ${gradeTransition.since}`}
      sx={{
        ...SX_BADGE_BASE,
        bgcolor: alpha("#8b5cf6", 0.1),
        color: "#7c3aed",
      }}
    >
      {getGradeAbbr(gradeTransition.from)} \u2192 {getGradeAbbr(gradeTransition.to)}
    </Box>
  );
});
GradeTransitionBadge.displayName = "GradeTransitionBadge";

// ─── EtpBadge ────────────────────────────────────────────────────

interface EtpBadgeProps {
  currentEtp: number | null;
}

export const EtpBadge = memo(({ currentEtp }: EtpBadgeProps) => {
  if (currentEtp == null || currentEtp >= 1) return null;
  return (
    <Box
      component="span"
      title={`Adjusted FTE: ${currentEtp}`}
      sx={{
        ...SX_BADGE_BASE,
        bgcolor: alpha("#6b7280", 0.1),
        color: "#6b7280",
      }}
    >
      {currentEtp} FTE
    </Box>
  );
});
EtpBadge.displayName = "EtpBadge";

// ─── PotentialBadge ──────────────────────────────────────────────

interface PotentialBadgeProps {
  potentialTeamPts: number;
}

export const PotentialBadge = memo(({ potentialTeamPts }: PotentialBadgeProps) => {
  if (potentialTeamPts <= 0) return null;
  return (
    <Box
      component="span"
      sx={{
        ...SX_BADGE_BASE,
        bgcolor: alpha("#047857", 0.1),
        color: "#047857",
      }}
    >
      +{potentialTeamPts.toFixed(2)}%eq
    </Box>
  );
});
PotentialBadge.displayName = "PotentialBadge";

// ─── TeamContribBadge ────────────────────────────────────────────

interface TeamContribBadgeProps {
  teamContribPts: number;
  chargeableH: number;
  teamNetHours: number;
}

export const TeamContribBadge = memo(({ teamContribPts, chargeableH, teamNetHours }: TeamContribBadgeProps) => {
  if (teamContribPts <= 0) return null;
  return (
    <Box
      component="span"
      title={`${chargeableH.toFixed(1)} billable hrs / ${teamNetHours.toFixed(0)}h net team hrs = ${teamContribPts.toFixed(2)} pts`}
      sx={{
        ...SX_BADGE_BASE,
        bgcolor: alpha("#0369a1", 0.1),
        color: "#0369a1",
      }}
    >
      {teamContribPts.toFixed(1)}pts
    </Box>
  );
});
TeamContribBadge.displayName = "TeamContribBadge";

// ─── SapCompletionBadge ──────────────────────────────────────────

interface SapCompletionBadgeProps {
  sapCompletion: { sapDays: number; workDays: number; pct: number } | null;
}

export const SapCompletionBadge = memo(({ sapCompletion }: SapCompletionBadgeProps) => {
  if (!sapCompletion) return null;
  const { sapDays, workDays, pct } = sapCompletion;
  const bgc = pct >= SAP_COMPLETE ? alpha("#047857", 0.1) : pct > 0 ? alpha("#b45309", 0.12) : alpha("#ef4444", 0.1);
  const clr = pct >= SAP_COMPLETE ? "#047857" : pct > 0 ? "#b45309" : "#ef4444";
  const icon = pct >= SAP_COMPLETE ? "\u2713" : pct > 0 ? "\u25D0" : "\u25CB";
  return (
    <Box component="span" sx={{ ...SX_BADGE_BASE, bgcolor: bgc, color: clr }}>
      {icon} {sapDays}/{workDays}
    </Box>
  );
});
SapCompletionBadge.displayName = "SapCompletionBadge";
