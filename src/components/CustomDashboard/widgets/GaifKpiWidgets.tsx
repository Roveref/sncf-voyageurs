/**
 * GaifKpiWidgets — regroupe tous les widgets KPIs GAIF alignés sur la Prescription Performance PSGA :
 *
 * KPIs PSGA (3 indicateurs gestion d'actifs) :
 *   - Disponibilité résiduelle (avec seuils par criticité)
 *   - Conformité / non-conformité (avec seuils par criticité)
 *   - Coût GA / rame (évolution 5 ans)
 *
 * KPIs pilotage opérationnel (8) :
 *   - Taux d'utilisation (perf maintenance)
 *   - Nombre d'incidents AT (conformité/sécurité)
 *   - Consommation RSE (eau/élec/gaz — axe 2 PSGA)
 *   - MTBF / MTTR (IO, perf maintenance)
 *   - Coût de possession TCO (perf financière)
 *   - Coût exploitation au m² (immobilier, perf financière)
 *
 * 4 marqueurs d'industrialisation + 1 charge équipe par pôle.
 *
 * Tous consomment directement le cache React Query via useCrmData / useStaffingData.
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { brand } from "../../../config/brandConfig";
import { GAIF_PATRIMOINES, PSGA_THRESHOLDS, evalNonConfLevel } from "../../../data/gaifPatrimoines";
import { parseAssetMetrics, ETAT_ABE_COLORS } from "../../../data/gaifAssetMetrics";
import { useCrmData } from "../../../queries/useCrmData";
import { useStaffingData } from "../../../queries/useStaffingData";

// ── Header aligné sur le pattern des autres cartes du dashboard ──

function WidgetHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom={!subtitle}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      <Divider sx={{ mt: subtitle ? 1.5 : 1 }} />
    </Box>
  );
}

const WIDGET_SX = { p: 3, height: "100%", display: "flex", flexDirection: "column" } as const;

// ═══════════════════════════════════════════════════════════════════════════
// KPI #1 — Disponibilité résiduelle par patrimoine (seuils PSGA)
// Formule PSGA : résiduel = 1 - (disponibilité × utilisation)
// Seuils : critiques < 15% optimal / 15-30% acceptable / > 30% faible
//          autres   < 40% optimal / 40-70% acceptable / > 70% faible
// ═══════════════════════════════════════════════════════════════════════════

export const DisponibiliteWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const m: Record<string, { critTotal: number; critResSum: number; othTotal: number; othResSum: number }> = {};
    for (const p of GAIF_PATRIMOINES) m[p.key] = { critTotal: 0, critResSum: 0, othTotal: 0, othResSum: 0 };
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      const metrics = parseAssetMetrics(opp);
      const disp = (Number(opp.winPct) || 0) / 100;
      const util = (metrics.utilizationPct || 0) / 100;
      const residuel = Math.max(0, 1 - disp * util) * 100;
      const isCrit = typeof opp.engagementType === "string" && opp.engagementType.includes("Critique");
      if (isCrit) {
        m[pat].critTotal++;
        m[pat].critResSum += residuel;
      } else {
        m[pat].othTotal++;
        m[pat].othResSum += residuel;
      }
    }
    return GAIF_PATRIMOINES.map((p) => {
      const s = m[p.key];
      const critAvg = s.critTotal > 0 ? s.critResSum / s.critTotal : 0;
      const othAvg = s.othTotal > 0 ? s.othResSum / s.othTotal : 0;
      return {
        name: p.label.split(" ")[0],
        critique: parseFloat(critAvg.toFixed(1)),
        autre: parseFloat(othAvg.toFixed(1)),
        color: p.color,
      };
    });
  }, [opportunityData]);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader
        title="Disponibilité résiduelle"
        subtitle="Formule PSGA : 1 − (dispo × util) · cibles critiques < 15% / autres < 40%"
      />
      <LegendChips
        items={[
          { label: "Autres", color: brand.primary },
          { label: "Critiques", color: "#B91C1C" },
        ]}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={40} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${v}%`} />
            <ReferenceLine
              y={PSGA_THRESHOLDS.disponibiliteResiduelle.critique.optimal}
              stroke="#10B981"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={PSGA_THRESHOLDS.disponibiliteResiduelle.autre.optimal}
              stroke="#F59E0B"
              strokeDasharray="4 4"
            />
            <Bar dataKey="critique" name="Critiques" fill="#B91C1C" radius={[4, 4, 0, 0]} />
            <Bar dataKey="autre" name="Autres" fill={brand.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
DisponibiliteWidget.displayName = "DisponibiliteWidget";

/** Legend chips rendered in the widget header area (instead of inside the chart). */
function LegendChips({ items }: { items: { label: string; color: string }[] }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: it.color }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", fontWeight: 600 }}>
            {it.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KPI #2 — Taux de non-conformité par patrimoine (seuils PSGA)
// Critiques : < 1% optimal / 1-5% acceptable / > 5% faible
// Autres    : < 5% optimal / 5-8% acceptable / > 8% faible
// ═══════════════════════════════════════════════════════════════════════════

export const ConformiteWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const m: Record<string, { critTotal: number; critNc: number; othTotal: number; othNc: number }> = {};
    for (const p of GAIF_PATRIMOINES) m[p.key] = { critTotal: 0, critNc: 0, othTotal: 0, othNc: 0 };
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      const confValue = Number(opp.cm1Pct) || 0;
      const isNc = confValue < 95;
      const isCrit = typeof opp.engagementType === "string" && opp.engagementType.includes("Critique");
      if (isCrit) {
        m[pat].critTotal++;
        if (isNc) m[pat].critNc++;
      } else {
        m[pat].othTotal++;
        if (isNc) m[pat].othNc++;
      }
    }
    return GAIF_PATRIMOINES.map((p) => {
      const s = m[p.key];
      const critPct = s.critTotal > 0 ? (s.critNc / s.critTotal) * 100 : 0;
      const othPct = s.othTotal > 0 ? (s.othNc / s.othTotal) * 100 : 0;
      return {
        name: p.label.split(" ")[0],
        critique: parseFloat(critPct.toFixed(1)),
        autre: parseFloat(othPct.toFixed(1)),
        critLevel: evalNonConfLevel(critPct, true),
        othLevel: evalNonConfLevel(othPct, false),
      };
    });
  }, [opportunityData]);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Taux de non-conformité" subtitle="Cible critiques < 1% · autres < 5%" />
      <LegendChips
        items={[
          { label: "Autres", color: brand.primary },
          { label: "Critiques", color: "#B91C1C" },
        ]}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={40} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${v}%`} />
            <ReferenceLine y={PSGA_THRESHOLDS.nonConformite.critique.optimal} stroke="#10B981" strokeDasharray="4 4" />
            <ReferenceLine y={PSGA_THRESHOLDS.nonConformite.autre.optimal} stroke="#F59E0B" strokeDasharray="4 4" />
            <Bar dataKey="critique" name="Critiques" fill="#B91C1C" radius={[4, 4, 0, 0]} />
            <Bar dataKey="autre" name="Autres" fill={brand.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
ConformiteWidget.displayName = "ConformiteWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI #3 — Coût GA / rame TN
// ═══════════════════════════════════════════════════════════════════════════

export const CoutGAWidget = memo(() => {
  const theme = useTheme();
  const data = useMemo(
    () => [
      { month: "T4'24", value: 42.3 },
      { month: "T1'25", value: 41.8 },
      { month: "T2'25", value: 40.9 },
      { month: "T3'25", value: 39.7 },
      { month: "T4'25", value: 38.5 },
      { month: "T1'26", value: 37.9 },
    ],
    []
  );
  const latest = data[data.length - 1].value;
  const first = data[0].value;
  const evolution = ((latest - first) / first) * 100;
  const evolColor = evolution < 0 ? theme.palette.success.main : theme.palette.error.main;

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Coût GA / rame TN" subtitle="k€ annuel · objectif : stabilisation / baisse" />
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1.5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: brand.primary, lineHeight: 1 }}>
          {latest.toFixed(1)}
        </Typography>
        <Typography variant="h6" color="text.secondary" fontWeight={500}>
          k€
        </Typography>
        <Chip
          size="small"
          label={`${evolution > 0 ? "+" : ""}${evolution.toFixed(1)}% vs T4'24`}
          sx={{
            ml: "auto",
            bgcolor: alpha(evolColor, 0.15),
            color: evolColor,
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        />
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={brand.primary} strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
CoutGAWidget.displayName = "CoutGAWidget";

// ═══════════════════════════════════════════════════════════════════════════
// Marqueur #1 — Clients
// ═══════════════════════════════════════════════════════════════════════════

/** Tile compact pour les marqueurs — fond neutre, valeur dominante. */
function MarqueurTile({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: (theme: Theme) => string;
}) {
  const theme = useTheme();
  const tone = color ? color(theme) : theme.palette.text.primary;
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.04), height: "100%" }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: tone, lineHeight: 1 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", display: "block", mt: 0.75 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export const MarqueurClientsWidget = memo(() => {
  const theme = useTheme();
  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Marqueur Clients" subtitle="Demandes BU/SD traitées & satisfaction" />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, flexGrow: 1 }}>
        <MarqueurTile
          label="Demandes traitées YTD"
          value="47"
          hint="+12 vs 2024"
          color={(t) => t.palette.primary.main}
        />
        <MarqueurTile label="Backlog demandes" value="8" hint="dont 2 urgentes" color={(t) => t.palette.warning.main} />
        <Box sx={{ gridColumn: "1 / -1", p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", display: "block", mb: 0.5 }}>
            NPS stakeholders
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.success.main, lineHeight: 1 }}>
              7.8
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / 10
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={78}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.success.main, 0.15),
              "& .MuiLinearProgress-bar": { bgcolor: theme.palette.success.main },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
});
MarqueurClientsWidget.displayName = "MarqueurClientsWidget";

// ═══════════════════════════════════════════════════════════════════════════
// Marqueur #2 — Agilité
// ═══════════════════════════════════════════════════════════════════════════

export const MarqueurAgiliteWidget = memo(() => {
  const theme = useTheme();
  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Marqueur Agilité" subtitle="Vitesse de cadrage → livraison" />
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08), mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", display: "block", mb: 0.5 }}>
          Délai moyen cadrage → livraison
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.info.main, lineHeight: 1 }}>
            42
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={500}>
            j
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{ fontSize: "0.72rem", color: theme.palette.success.main, display: "block", mt: 0.5, fontWeight: 600 }}
        >
          −8 j vs objectif 50 j ✓
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
        <Chip
          size="small"
          label="82% dans délais"
          sx={{
            bgcolor: alpha(theme.palette.success.main, 0.15),
            color: theme.palette.success.main,
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        />
        <Chip
          size="small"
          label="3 bloquées"
          sx={{
            bgcolor: alpha(theme.palette.error.main, 0.15),
            color: theme.palette.error.main,
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", mt: "auto" }}>
        Mesuré sur les 30 dernières initiatives d'industrialisation
      </Typography>
    </Box>
  );
});
MarqueurAgiliteWidget.displayName = "MarqueurAgiliteWidget";

// ═══════════════════════════════════════════════════════════════════════════
// Marqueur #3 — Juste besoin
// ═══════════════════════════════════════════════════════════════════════════

export const MarqueurJusteBesoinWidget = memo(() => {
  const theme = useTheme();
  const data = useMemo(
    () => [
      { type: "Planifié", short: "FIXE", value: 68, color: theme.palette.primary.main },
      { type: "À la demande", short: "FREE", value: 32, color: theme.palette.info.main },
    ],
    [theme]
  );
  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Marqueur Juste Besoin" subtitle="Planifié vs à la demande" />
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        {data.map((d) => (
          <Box
            key={d.type}
            sx={{
              flex: d.value,
              textAlign: "center",
              py: 1.5,
              px: 1,
              bgcolor: alpha(d.color, 0.1),
              borderRadius: 2,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: d.color, lineHeight: 1 }}>
              {d.value}%
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.7rem", fontWeight: 700, color: d.color, mt: 0.5, display: "block" }}
            >
              {d.type}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", display: "block", mb: 0.5 }}>
          Taux de planification des sollicitations
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.success.main, lineHeight: 1 }}>
            76%
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontSize: "0.72rem", color: theme.palette.success.main, fontWeight: 600 }}
          >
            ↑ +14 pts vs T4 2025
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={76}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.success.main, 0.15),
            "& .MuiLinearProgress-bar": { bgcolor: theme.palette.success.main },
          }}
        />
      </Box>
    </Box>
  );
});
MarqueurJusteBesoinWidget.displayName = "MarqueurJusteBesoinWidget";

// ═══════════════════════════════════════════════════════════════════════════
// Marqueur #4 — Innovation
// ═══════════════════════════════════════════════════════════════════════════

export const MarqueurInnovationWidget = memo(() => {
  const theme = useTheme();
  const tiles = [
    { value: 4, label: "Guides bonnes pratiques YTD", color: theme.palette.primary.main },
    { value: 2, label: "Certifs ISO 55001", color: theme.palette.warning.main },
    { value: 6, label: "POC industrialisés", color: theme.palette.success.main },
  ];
  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Marqueur Innovation" subtitle="Doctrine, certifications, POC industrialisés" />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
        {tiles.map((t) => (
          <Box
            key={t.label}
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(t.color, 0.08),
              textAlign: "center",
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: t.color, lineHeight: 1, mb: 0.75 }}>
              {t.value}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.7rem", lineHeight: 1.3, display: "block" }}
            >
              {t.label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: "0.72rem", mt: "auto", pt: 1.5, display: "block" }}
      >
        ★ Réussite récente : PIVOS Ardoines, Maximo v9 Noisy, GTB Massy
      </Typography>
    </Box>
  );
});
MarqueurInnovationWidget.displayName = "MarqueurInnovationWidget";

// ═══════════════════════════════════════════════════════════════════════════
// Widget transverse — Charge équipe par pôle
// ═══════════════════════════════════════════════════════════════════════════

export const ChargeParPoleWidget = memo(() => {
  const theme = useTheme();
  const { records } = useStaffingData();
  const data = useMemo(() => {
    const byPole: Record<
      string,
      { pilotage: number; projet: number; transverse: number; formation: number; absence: number }
    > = {};
    for (const rec of records) {
      const pole = rec.subTeam || "Autre";
      if (!byPole[pole]) byPole[pole] = { pilotage: 0, projet: 0, transverse: 0, formation: 0, absence: 0 };
      const cat = rec.category || "";
      const u = rec.utilization || 0;
      if (cat === "chargeable") byPole[pole].pilotage += u;
      else if (cat === "generalOppty") byPole[pole].projet += u;
      else if (cat === "nonChargeable" || cat === "businessDev") byPole[pole].transverse += u;
      else if (cat === "training") byPole[pole].formation += u;
      else if (cat === "otherAbsence" || cat === "vacation" || cat === "rtt" || cat === "holiday")
        byPole[pole].absence += u;
    }
    return Object.entries(byPole).map(([pole, v]) => ({ pole, ...v }));
  }, [records]);

  const colors = {
    pilotage: theme.palette.primary.main,
    projet: theme.palette.info.main,
    transverse: theme.palette.warning.main,
    formation: theme.palette.success.main,
    absence: theme.palette.text.disabled,
  };

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Charge par pôle" subtitle="Répartition par type d'activité" />
      <LegendChips
        items={[
          { label: "Pilotage", color: colors.pilotage },
          { label: "Projet", color: colors.projet },
          { label: "Transverse", color: colors.transverse },
          { label: "Formation", color: colors.formation },
          { label: "Absence", color: colors.absence },
        ]}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <XAxis dataKey="pole" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="pilotage" stackId="a" fill={colors.pilotage} name="Pilotage" />
            <Bar dataKey="projet" stackId="a" fill={colors.projet} name="Projet" />
            <Bar dataKey="transverse" stackId="a" fill={colors.transverse} name="Transverse" />
            <Bar dataKey="formation" stackId="a" fill={colors.formation} name="Formation" />
            <Bar dataKey="absence" stackId="a" fill={colors.absence} name="Absence" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
ChargeParPoleWidget.displayName = "ChargeParPoleWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Pilotage #4 — Taux d'utilisation par patrimoine
// Source PSGA : temps actif utilisé / temps disponible
// ═══════════════════════════════════════════════════════════════════════════

export const TauxUtilisationWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const m: Record<string, { total: number; sum: number }> = {};
    for (const p of GAIF_PATRIMOINES) m[p.key] = { total: 0, sum: 0 };
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      const metrics = parseAssetMetrics(opp);
      if (metrics.utilizationPct <= 0) continue;
      m[pat].total++;
      m[pat].sum += metrics.utilizationPct;
    }
    return GAIF_PATRIMOINES.map((p) => {
      const s = m[p.key];
      const avg = s.total > 0 ? s.sum / s.total : 0;
      return { name: p.label.split(" ")[0], value: parseFloat(avg.toFixed(1)), color: p.color };
    });
  }, [opportunityData]);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Taux d'utilisation" subtitle="Temps utilisé / temps dispo · moyenne par patrimoine" />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
TauxUtilisationWidget.displayName = "TauxUtilisationWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Pilotage #5 — Incidents / AT par patrimoine (12 mois glissants)
// Source PSGA : Nb incidents ou accidents de travail par actif
// ═══════════════════════════════════════════════════════════════════════════

export const IncidentsWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const m: Record<string, { incidents: number; actifs: number }> = {};
    for (const p of GAIF_PATRIMOINES) m[p.key] = { incidents: 0, actifs: 0 };
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      const metrics = parseAssetMetrics(opp);
      m[pat].actifs++;
      m[pat].incidents += metrics.incidents12m;
    }
    return GAIF_PATRIMOINES.map((p) => ({
      name: p.label.split(" ")[0],
      incidents: m[p.key].incidents,
      ratio: m[p.key].actifs > 0 ? parseFloat(((m[p.key].incidents / m[p.key].actifs) * 100).toFixed(1)) : 0,
      color: p.color,
    }));
  }, [opportunityData]);

  const total = data.reduce((acc, d) => acc + d.incidents, 0);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Incidents / AT 12 mois" subtitle={`Total déclaré : ${total} incidents`} />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="incidents" name="Incidents" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
IncidentsWidget.displayName = "IncidentsWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Pilotage #6 — Consommation RSE (eau / élec / gaz)
// Source PSGA (axe 2 stratégique) : décret BACS, Décret Tertiaire, CEPIA
// ═══════════════════════════════════════════════════════════════════════════

export const ConsommationRSEWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    let eau = 0;
    let elecImmo = 0;
    let elecIO = 0;
    let gaz = 0;
    let surfImmo = 0;
    for (const opp of opportunityData) {
      const metrics = parseAssetMetrics(opp);
      eau += metrics.consoEau;
      gaz += metrics.consoGaz;
      if (opp.subSegmentCode === "Immobilier") {
        elecImmo += metrics.consoElec * (metrics.surfaceM2 || 1); // kWh/m²/an × m² = kWh/an
        surfImmo += metrics.surfaceM2;
      }
      if (opp.subSegmentCode === "IO") elecIO += metrics.consoElec;
    }
    const elecPerM2 = surfImmo > 0 ? elecImmo / surfImmo : 0;
    return {
      eau: Math.round(eau),
      elecImmo: Math.round(elecImmo / 1000), // MWh
      elecIO: Math.round(elecIO / 1000),
      gaz: Math.round(gaz / 1000),
      elecPerM2: parseFloat(elecPerM2.toFixed(1)),
      surfImmo: Math.round(surfImmo),
    };
  }, [opportunityData]);

  const CEPIA_TARGET = 85; // kWh/m²/an cible décret tertiaire moyen
  const elecM2Level =
    data.elecPerM2 <= CEPIA_TARGET ? "optimal" : data.elecPerM2 <= CEPIA_TARGET * 1.3 ? "acceptable" : "faible";

  const theme = useTheme();
  const tiles = [
    { label: "Eau (immo)", value: data.eau, unit: "m³/an" },
    { label: "Élec immo", value: data.elecImmo, unit: "MWh/an" },
    { label: "Élec IO", value: data.elecIO, unit: "MWh/an" },
    { label: "Gaz (immo)", value: data.gaz, unit: "MWh/an" },
  ];
  const intensityColor =
    elecM2Level === "optimal"
      ? theme.palette.success.main
      : elecM2Level === "acceptable"
        ? theme.palette.warning.main
        : theme.palette.error.main;

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Consommation RSE" subtitle="Axe 2 PSGA · décret BACS / tertiaire / CEPIA" />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, flexGrow: 1 }}>
        {tiles.map((t) => (
          <Box key={t.label} sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
              {t.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: brand.primary, lineHeight: 1.1, mt: 0.25 }}>
              {t.value.toLocaleString("fr-FR")}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.65rem", mt: 0.25, display: "block" }}
            >
              {t.unit}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          mt: 1,
          px: 1,
          py: 0.75,
          borderRadius: 2,
          bgcolor: alpha(intensityColor, 0.1),
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
          Intensité élec immo
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: intensityColor, fontSize: "0.85rem" }}>
          {data.elecPerM2} kWh/m²/an
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", ml: "auto" }}>
          cible CEPIA {CEPIA_TARGET}
        </Typography>
      </Box>
    </Box>
  );
});
ConsommationRSEWidget.displayName = "ConsommationRSEWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Pilotage #7 — MTBF / MTTR (Installations & Outillages)
// Source : Prescription Criticité IO (seuils par niveaux 0-3)
// ═══════════════════════════════════════════════════════════════════════════

export const MtbfMttrWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const families: Record<string, { mtbfSum: number; mttrSum: number; n: number; color: string }> = {};
    for (const opp of opportunityData) {
      if (opp.subSegmentCode !== "IO") continue;
      const metrics = parseAssetMetrics(opp);
      if (metrics.mtbf === 0 && metrics.mttr === 0) continue;
      const fam = opp.subSegment || "Autre";
      if (!families[fam]) families[fam] = { mtbfSum: 0, mttrSum: 0, n: 0, color: "#00A3A1" };
      families[fam].mtbfSum += metrics.mtbf;
      families[fam].mttrSum += metrics.mttr;
      families[fam].n++;
    }
    return Object.entries(families)
      .map(([fam, s]) => ({
        fam: fam.length > 15 ? fam.slice(0, 14) + "…" : fam,
        mtbf: Math.round(s.mtbfSum / s.n),
        mttr: parseFloat((s.mttrSum / s.n).toFixed(1)),
      }))
      .sort((a, b) => b.mtbf - a.mtbf)
      .slice(0, 7);
  }, [opportunityData]);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="MTBF / MTTR (IO)" subtitle="Par famille — heures entre pannes vs temps réparation" />
      <LegendChips
        items={[
          { label: "MTBF (h)", color: brand.primary },
          { label: "MTTR (h)", color: brand.secondary },
        ]}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="fam" type="category" tick={{ fontSize: 10 }} width={110} />
            <Tooltip />
            <Bar dataKey="mtbf" name="MTBF (h)" fill={brand.primary} radius={[0, 4, 4, 0]} />
            <Bar dataKey="mttr" name="MTTR (h)" fill={brand.secondary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
MtbfMttrWidget.displayName = "MtbfMttrWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Financier #1 — Coût de possession TCO par patrimoine
// Source PSGA : acquisition + exploitation + maintenance + fin de vie, agrégés par patrimoine
// ═══════════════════════════════════════════════════════════════════════════

export const CoutTCOWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const m: Record<string, { achat: number; maint: number; total: number; n: number; color: string }> = {};
    for (const p of GAIF_PATRIMOINES) m[p.key] = { achat: 0, maint: 0, total: 0, n: 0, color: p.color };
    for (const opp of opportunityData) {
      const pat = opp.subSegmentCode;
      if (!pat || !m[pat]) continue;
      const achat = Number(opp.grossRevenue) || 0;
      // Coût maintenance annuel × durée de vie résiduelle estimée
      const maintAnnual = Number(opp.serviceOffering2Pct) || achat * 0.05;
      const dureeRes = opp.subSegmentCode === "Immobilier" ? 20 : opp.subSegmentCode === "Ferroviaire" ? 15 : 10;
      const maintCumul = maintAnnual * dureeRes;
      m[pat].achat += achat;
      m[pat].maint += maintCumul;
      m[pat].total += achat + maintCumul;
      m[pat].n++;
    }
    return GAIF_PATRIMOINES.map((p) => ({
      name: p.label.split(" ")[0],
      achat: Math.round(m[p.key].achat / 1000),
      maint: Math.round(m[p.key].maint / 1000),
      color: p.color,
    }));
  }, [opportunityData]);

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader title="Coût de possession (TCO)" subtitle="Acquisition + maintenance cumulée · k€ par patrimoine" />
      <LegendChips
        items={[
          { label: "Acquisition", color: brand.primary },
          { label: "Maintenance cumul.", color: brand.secondary },
        ]}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={40} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("fr-FR")} k€`} />
            <Bar dataKey="achat" name="Acquisition" stackId="a" fill={brand.primary} radius={[0, 0, 0, 0]} />
            <Bar dataKey="maint" name="Maintenance cumul." stackId="a" fill={brand.secondary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
CoutTCOWidget.displayName = "CoutTCOWidget";

// ═══════════════════════════════════════════════════════════════════════════
// KPI Financier #2 — Coût d'exploitation au m² (patrimoine immobilier)
// Source PSGA : coût exploitation total / surface en m²
// ═══════════════════════════════════════════════════════════════════════════

export const CoutM2Widget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const bySite: Record<string, { cout: number; surface: number }> = {};
    for (const opp of opportunityData) {
      if (opp.subSegmentCode !== "Immobilier") continue;
      const metrics = parseAssetMetrics(opp);
      if (metrics.surfaceM2 <= 0) continue;
      const site = opp.serviceLine1 || "Autre";
      if (!bySite[site]) bySite[site] = { cout: 0, surface: 0 };
      const maintAnnual = Number(opp.serviceOffering2Pct) || 0;
      bySite[site].cout += maintAnnual;
      bySite[site].surface += metrics.surfaceM2;
    }
    return Object.entries(bySite)
      .map(([site, s]) => ({
        site: site.length > 15 ? site.slice(0, 14) + "…" : site,
        value: s.surface > 0 ? parseFloat((s.cout / s.surface).toFixed(1)) : 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [opportunityData]);

  const avg = data.length > 0 ? data.reduce((acc, d) => acc + d.value, 0) / data.length : 0;

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader
        title="Coût exploitation € / m² (immobilier)"
        subtitle={`Moyenne ${avg.toFixed(0)} €/m²/an · top 8 sites`}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="site" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip formatter={(v) => `${v} €/m²/an`} />
            <Bar dataKey="value" fill={brand.primary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
CoutM2Widget.displayName = "CoutM2Widget";

// ═══════════════════════════════════════════════════════════════════════════
// Widget bonus — État ABE du parc immobilier (donut par catégorie ABE)
// Source : Note inventaire (Satisfaisant / Acceptable / Moyen / Insuffisant / Non Visité / Non Concerné)
// ═══════════════════════════════════════════════════════════════════════════

export const EtatParcImmoWidget = memo(() => {
  const { opportunityData } = useCrmData();
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opp of opportunityData) {
      if (opp.subSegmentCode !== "Immobilier") continue;
      const metrics = parseAssetMetrics(opp);
      if (!metrics.etatAbe) continue;
      counts[metrics.etatAbe] = (counts[metrics.etatAbe] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: ETAT_ABE_COLORS[name] || "#94A3B8" }))
      .sort((a, b) => b.value - a.value);
  }, [opportunityData]);

  const total = data.reduce((acc, d) => acc + d.value, 0);
  const insuffisants = data.find((d) => d.name === "Insuffisant")?.value ?? 0;
  const moyens = data.find((d) => d.name === "Moyen")?.value ?? 0;
  const alertePct = total > 0 ? ((insuffisants + moyens) / total) * 100 : 0;

  return (
    <Box sx={WIDGET_SX}>
      <WidgetHeader
        title="État parc immobilier (ABE)"
        subtitle={`${total} bâtiments · ${alertePct.toFixed(0)}% Moyen/Insuffisant`}
      />
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "0.65rem" }} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
EtatParcImmoWidget.displayName = "EtatParcImmoWidget";
