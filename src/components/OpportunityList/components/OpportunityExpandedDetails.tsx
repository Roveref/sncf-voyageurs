/**
 * OpportunityExpandedDetails Component
 * Displays detailed information when a row is expanded
 * Performance optimized with React.memo
 */

import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../utils/formatters";
import { AccountLogo } from "../../common/AccountLogo";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import CommentIcon from "@mui/icons-material/Comment";
import EditIcon from "@mui/icons-material/Edit";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import GroupIcon from "@mui/icons-material/Group";
import OpportunityActions from "./OpportunityActions";
import StaffingNeeds from "./StaffingNeeds";
import OpportunityContacts from "./OpportunityContacts";
import RevenueTeamDialog from "./RevenueTeamDialog";
import { OpportunityStatusTimeline } from "./OpportunityStatusTimeline";
import { getStatusColor as getStatusColorFn } from "../utils/statusColors";
import { STATUS_COLORS, STATUS_TEXT } from "../../../utils/constants";
import { formatDateFR } from "../../../utils/formatters";
import { getTechnologyPartnerTags } from "../utils/opportunityUtils";
import { calculateRevenueWithSegmentLogic } from "../../PipelineTab/utils/revenueCalculations";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useUIStore } from "../../../stores/useUIStore";
import { API_BASE, apiFetch } from "../../../services/api";
import { brand } from "../../../config/brandConfig";
import { parseAssetMetrics, ETAT_ABE_COLORS } from "../../../data/gaifAssetMetrics";
import { useStaffingIndex, lookupStaffingForAsset } from "../../../queries/useStaffingIndex";

const formatDateSafely = formatDateFR;
const statusColors = STATUS_COLORS;
const statusText = STATUS_TEXT;
const EMPTY_TEAM: any[] = [];

/** Petite tuile KPI utilisée dans le bandeau hero d'un actif. */
const KpiTile = memo(
  ({
    label,
    value,
    tone = "neutral",
    customColor,
    theme,
  }: {
    label: string;
    value: string;
    tone?: "success" | "warning" | "error" | "neutral";
    customColor?: string;
    theme: any;
  }) => {
    const color =
      customColor ||
      (tone === "success"
        ? theme.palette.success.main
        : tone === "warning"
          ? theme.palette.warning.main
          : tone === "error"
            ? theme.palette.error.main
            : theme.palette.text.primary);
    return (
      <Box
        sx={{
          minWidth: 80,
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          bgcolor: alpha(color, 0.08),
          borderLeft: `3px solid ${color}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.6rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "text.secondary",
            display: "block",
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
        <Typography variant="body1" fontWeight={700} sx={{ color, lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    );
  }
);
KpiTile.displayName = "KpiTile";

/**
 * Memoized component for opportunity expanded details
 * Shows comprehensive information about an opportunity
 */
const OpportunityExpandedDetails = memo(
  ({ row, showNetRevenue, showIO = true, setEditOpportunity, onManualOpportunityUpdated, initialActionsTab }: any) => {
    const theme = useTheme();
    const technologyPartners = getTechnologyPartnerTags(row);

    // Check if this is a manual opportunity
    const isManualOpportunity = row.isManual === true;

    // Status overrides from store
    const statusOverrides = useUserDataStore((s) => s.statusOverrides);
    const setStatusOverride = useUserDataStore((s) => s.setStatusOverride);
    const removeStatusOverride = useUserDataStore((s) => s.removeStatusOverride);

    const hasOverride = (id: string) => {
      const o = statusOverrides[id];
      return !!o && !o._reverted;
    };
    const getOverride = (id: string) => {
      const o = statusOverrides[id];
      return o && !o._reverted ? o : null;
    };

    // Revenue team
    const [revenueTeamOpen, setRevenueTeamOpen] = useState(false);
    const revenueTeamMembers = useUserDataStore((s) => s.revenueTeam[row.opportunityId]) ?? EMPTY_TEAM;

    // Get the opportunity ID and original status
    const opportunityId = row.opportunityId;
    const originalStatus = row._originalStatus || row.status;
    const currentStatus = row.status; // This may already be overridden by App.js
    // Only show override indicator for non-manual opportunities
    const isOverridden = !isManualOpportunity && hasOverride(opportunityId);
    const override = !isManualOpportunity ? getOverride(opportunityId) : null;

    // Calculate I&O amount
    const ioAmount = calculateRevenueWithSegmentLogic(row, showNetRevenue);
    const totalAmount = showNetRevenue ? row.netRevenue || 0 : row.grossRevenue || 0;
    const ioPercentage = totalAmount > 0 ? (ioAmount / totalAmount) * 100 : 0;

    // GAIF metrics (parsed from native columns or legacy ::META:: encoding)
    const gaifMetrics = useMemo(() => parseAssetMetrics(row), [row]);
    const hasGaifMetrics =
      gaifMetrics.utilizationPct > 0 ||
      gaifMetrics.mtbf > 0 ||
      gaifMetrics.mttr > 0 ||
      gaifMetrics.incidents12m > 0 ||
      !!gaifMetrics.etatAbe ||
      !!row.cm1Pct;

    // Handle status change from timeline sub-component
    const handleStatusChange = useCallback(
      (newStatus: number, comment: string, bookingDate: Date) => {
        const formattedDate =
          (newStatus === 14 || newStatus === 15) && bookingDate ? bookingDate.toISOString().split("T")[0] : null;

        if (isManualOpportunity) {
          useUserDataStore.getState().updateManualOpportunityStatus(opportunityId, newStatus, formattedDate);
          if (onManualOpportunityUpdated) onManualOpportunityUpdated(opportunityId);
        } else {
          setStatusOverride(opportunityId, originalStatus, newStatus, comment, formattedDate);
        }
      },
      [isManualOpportunity, opportunityId, originalStatus, setStatusOverride, onManualOpportunityUpdated]
    );

    // Revert status override
    const handleRevertStatus = () => {
      removeStatusOverride(opportunityId);
    };

    const statusColor = getStatusColorFn(row.status, theme);
    const accentColor = theme.palette.secondary.main;
    const navigate = useNavigate();

    const handleGoToStaffing = useCallback(() => {
      const jobName = row.opportunity || row.jobCode || row.opportunityId;
      useUIStore.getState().setPendingStaffingFilter({ text: jobName, type: "project" });
      navigate("/staffing");
    }, [row, navigate]);

    // Workspace tabs — 0=Staffing (default), 1=Actions, 2=Contacts
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState(0);

    // Counts for tab badges — selectors return primitives for reliable Zustand equality checks
    const actionsCount = useUserDataStore((s) => {
      const actions = s.opportunityActions[opportunityId];
      if (!actions) return 0;
      let count = 0;
      for (const a of actions) if (a.status !== "done") count++;
      return count;
    });
    const staffingNeedsCount = useUserDataStore((s) => {
      const needs = s.staffingNeeds[opportunityId];
      if (!needs) return 0;
      let count = 0;
      for (const n of needs) count += (n as any).quantity || 1;
      return count;
    });
    // Contacts count fetched on-demand per account (no longer bulk-loaded)
    const rowAccountId = row.accountId;
    const rowAccountName = row.account;
    const [contactsCount, setContactsCount] = useState(0);
    useEffect(() => {
      const params = new URLSearchParams();
      if (rowAccountId) params.set("accountId", rowAccountId);
      else if (rowAccountName) params.set("account", rowAccountName);
      else return;
      const controller = new AbortController();
      apiFetch(`${API_BASE}/hydrate/contacts?${params}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setContactsCount(data.contacts?.length || 0))
        .catch(() => {
          if (!controller.signal.aborted) setContactsCount(0);
        });
      return () => controller.abort();
    }, [rowAccountId, rowAccountName]);

    // Staffing index from React Query cache (no dependency on StaffingTab being visited)
    const staffingIndex = useStaffingIndex();
    const currentStaffingCount = useMemo(
      () => lookupStaffingForAsset(staffingIndex, row.opportunityId, row.jobCode).length,
      [staffingIndex, row.opportunityId, row.jobCode]
    );

    return (
      <Box sx={{ m: 2 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            backgroundColor: "#faf8f7",
            border: "none",
            overflow: "hidden",
          }}
        >
          {/* Opportunity Title Banner */}
          <Box
            sx={{
              p: 2.5,
              bgcolor: alpha(statusColor.headerBg, 0.06),
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundImage: `linear-gradient(to right, ${alpha(
                statusColor.headerBg,
                0.1
              )}, ${alpha(statusColor.headerBg, 0.04)})`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
              {/* Company Logo */}
              <AccountLogo accountName={row.account || ""} size={56} />

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="h6" color={accentColor} fontWeight={700} sx={{ mr: 1 }}>
                    {row.opportunity}
                  </Typography>

                  {/* Disponibilité Chip (was winPct) — signal opérationnel fort */}
                  {row.winPct != null && row.winPct !== "" && (
                    <Tooltip title="Taux de disponibilité de l'actif">
                      <Chip
                        label={`Dispo ${row.winPct}%`}
                        color={row.winPct >= 90 ? "success" : row.winPct >= 70 ? "warning" : "error"}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Tooltip>
                  )}

                  {/* Criticité Chip — dimension métier prioritaire */}
                  {row.engagementType && (
                    <Tooltip title="Criticité patrimoniale">
                      <Chip
                        label={row.engagementType}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          bgcolor:
                            row.engagementType === "Critique"
                              ? alpha(theme.palette.error.main, 0.12)
                              : row.engagementType === "Modérée"
                                ? alpha(theme.palette.warning.main, 0.12)
                                : alpha(theme.palette.success.main, 0.12),
                          color:
                            row.engagementType === "Critique"
                              ? theme.palette.error.main
                              : row.engagementType === "Modérée"
                                ? theme.palette.warning.main
                                : theme.palette.success.main,
                        }}
                      />
                    </Tooltip>
                  )}

                  {/* Job Code Chip */}
                  {row.jobCode && (
                    <Chip
                      label={row.jobCode}
                      variant="outlined"
                      size="small"
                      sx={{
                        fontWeight: 500,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        color: theme.palette.primary.main,
                      }}
                    />
                  )}
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Identifiant {row.opportunityId} · Créé le {formatDateSafely(row.creationDate)}
                </Typography>
              </Box>
            </Box>
            {/* /logo + title wrapper */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Modifier (actifs manuels uniquement) */}
              {row.isManual && setEditOpportunity && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setEditOpportunity(row)}
                  sx={{
                    color: theme.palette.info.main,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.info.main, 0.08),
                    },
                  }}
                >
                  Modifier
                </Button>
              )}

              {/* Dupliquer (crée une copie manuelle de n'importe quel actif) */}
              {setEditOpportunity && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    const copy = { ...row };
                    delete copy.opportunityId;
                    copy.isManual = true;
                    copy.opportunity = `${row.opportunity || ""} (copie)`;
                    setEditOpportunity(copy);
                  }}
                  sx={{ fontSize: "0.72rem", textTransform: "none", color: "text.secondary" }}
                >
                  Dupliquer
                </Button>
              )}

              {/* Indicateur d'override et bouton annuler */}
              {isOverridden && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
                  <Tooltip
                    title={`Phase modifiée : ${statusText[override?.originalStatus as any]} → ${statusText[override?.newStatus as any]}`}
                  >
                    <Chip
                      icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                      label="Modifié"
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </Tooltip>
                  <Tooltip title="Annuler la modification">
                    <IconButton
                      size="small"
                      aria-label="Annuler la modification de phase"
                      onClick={handleRevertStatus}
                      sx={{
                        color: theme.palette.warning.main,
                        "&:hover": {
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                        },
                      }}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* Status Timeline */}
              <OpportunityStatusTimeline
                currentStatus={currentStatus}
                originalStatus={originalStatus}
                isManualOpportunity={isManualOpportunity}
                statusColor={statusColor}
                row={row}
                onStatusChange={handleStatusChange}
              />
            </Box>
          </Box>

          {/* Commentaire déclassement — uniquement pour les actifs en statut 15 */}
          {row.status === 15 && row.lostComment && (
            <Box
              sx={{
                p: 2.5,
              }}
            >
              <Box
                sx={{
                  backgroundColor: alpha(theme.palette.error.main, 0.06),
                  borderRadius: "8px",
                  maxWidth: "95%",
                  mx: "auto",
                  p: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                  <CommentIcon color="error" sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={600} color="error.main">
                    Commentaire déclassement
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    borderRadius: 1,
                    borderLeft: `3px solid ${theme.palette.error.main}`,
                    fontStyle: "italic",
                  }}
                >
                  "{row.lostComment}"
                </Typography>
              </Box>
            </Box>
          )}

          {/* ── Main: Sidebar + Tabbed Workspace ── */}
          <CardContent sx={{ p: 0 }}>
            <Grid container>
              {/* ── LEFT: Summary Sidebar ── */}
              <Grid
                size={{ xs: 12, md: 8 }}
                sx={{
                  p: 2.5,
                  bgcolor: alpha(theme.palette.background.default, 0.25),
                  borderRight: { md: `1px solid ${theme.palette.divider}` },
                }}
              >
                {/* ── HERO : valeur acquisition + résiduelle (+ % conservé) + KPIs GAIF clés ── */}
                <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, flexWrap: "wrap" }}>
                    {/* Valeur d'achat */}
                    <Box sx={{ minWidth: 160 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                        }}
                      >
                        Valeur d'achat
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color={accentColor} sx={{ lineHeight: 1.1 }}>
                        {formatCurrency(row.grossRevenue)}
                      </Typography>
                    </Box>

                    {/* Valeur résiduelle + % de valeur conservée */}
                    <Box sx={{ minWidth: 160 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                        }}
                      >
                        Valeur résiduelle
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                        <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.1 }}>
                          {formatCurrency(row.netRevenue)}
                        </Typography>
                        {Number(row.grossRevenue) > 0 && (
                          <Typography variant="body2" fontWeight={600} color="text.secondary">
                            ({Math.round(((Number(row.netRevenue) || 0) / Number(row.grossRevenue)) * 100)}%)
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Tuiles KPIs GAIF */}
                    {hasGaifMetrics && (
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", flex: 1 }}>
                        {row.cm1Pct != null && row.cm1Pct !== "" && (
                          <KpiTile
                            label="Conformité"
                            value={`${row.cm1Pct}%`}
                            tone={row.cm1Pct >= 95 ? "success" : row.cm1Pct >= 80 ? "warning" : "error"}
                            theme={theme}
                          />
                        )}
                        {gaifMetrics.utilizationPct > 0 && (
                          <KpiTile
                            label="Utilisation"
                            value={`${Math.round(gaifMetrics.utilizationPct)}%`}
                            tone={gaifMetrics.utilizationPct >= 80 ? "success" : "warning"}
                            theme={theme}
                          />
                        )}
                        {gaifMetrics.mtbf > 0 && (
                          <KpiTile
                            label="MTBF"
                            value={`${Math.round(gaifMetrics.mtbf)} h`}
                            tone="neutral"
                            theme={theme}
                          />
                        )}
                        {gaifMetrics.mttr > 0 && (
                          <KpiTile
                            label="MTTR"
                            value={`${gaifMetrics.mttr.toFixed(1)} h`}
                            tone="neutral"
                            theme={theme}
                          />
                        )}
                        {gaifMetrics.incidents12m > 0 && (
                          <KpiTile
                            label="Incidents 12m"
                            value={String(gaifMetrics.incidents12m)}
                            tone={
                              gaifMetrics.incidents12m >= 5
                                ? "error"
                                : gaifMetrics.incidents12m >= 2
                                  ? "warning"
                                  : "success"
                            }
                            theme={theme}
                          />
                        )}
                        {gaifMetrics.etatAbe && (
                          <KpiTile
                            label="État ABE"
                            value={gaifMetrics.etatAbe}
                            customColor={ETAT_ABE_COLORS[gaifMetrics.etatAbe]}
                            theme={theme}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* 2-column grid: Details+Services | Team */}
                <Grid container spacing={3}>
                  {/* Left col: Details + Services */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        mb: 1,
                        display: "block",
                      }}
                    >
                      Informations
                    </Typography>
                    {[
                      ["Site", row.account],
                      ["Patrimoine", row.subSegmentCode || "—"],
                      ["Famille", row.subSegment || "—"],
                    ].map(([label, value]) => (
                      <Box
                        key={label as string}
                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.3 }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          {label}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: "60%" }}>
                          {label === "Site" && <AccountLogo accountName={String(value || "")} size={16} />}
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            sx={{
                              fontSize: "0.72rem",
                              textAlign: "right",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {value}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {technologyPartners.length > 0 && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          Prestataire
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end" }}>
                          {technologyPartners.map((p) => (
                            <Chip
                              key={p}
                              label={p}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                bgcolor: alpha(theme.palette.info.main, 0.12),
                                color: theme.palette.info.main,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    <Divider sx={{ my: 1.5 }} />
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        mb: 1,
                        display: "block",
                      }}
                    >
                      Cycle de maintenance
                    </Typography>
                    {[
                      ["Prochaine VR", formatDateSafely(row.estimatedBookingDate)],
                      ["Dernière VR", formatDateSafely(row.bookingDate)],
                      ...(gaifMetrics.surfaceM2 > 0
                        ? [["Surface", `${gaifMetrics.surfaceM2.toLocaleString("fr-FR")} m²`]]
                        : []),
                      ...(gaifMetrics.consoElec > 0
                        ? [
                            [
                              "Conso électricité",
                              gaifMetrics.surfaceM2 > 0
                                ? `${gaifMetrics.consoElec} kWh/m²/an`
                                : `${gaifMetrics.consoElec.toLocaleString("fr-FR")} kWh/an`,
                            ],
                          ]
                        : []),
                      ...(gaifMetrics.consoEau > 0
                        ? [["Conso eau", `${gaifMetrics.consoEau.toLocaleString("fr-FR")} m³/an`]]
                        : []),
                      ...(gaifMetrics.consoGaz > 0
                        ? [["Conso gaz", `${gaifMetrics.consoGaz.toLocaleString("fr-FR")} kWh/an`]]
                        : []),
                    ].map(([label, value]) => (
                      <Box key={label as string} sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          {label}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={{
                            fontSize: "0.72rem",
                            textAlign: "right",
                            maxWidth: "60%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Grid>

                  {/* Right col: Team + Services */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        mb: 1,
                        display: "block",
                      }}
                    >
                      Équipe
                    </Typography>
                    {[
                      ["Responsable mission", row.em],
                      ["Expert référent", row.ep],
                      ["Chef de projet", row.manager],
                      ["Directeur de patrimoine", row.partner],
                    ].map(([label, value]) => (
                      <Box key={label as string} sx={{ display: "flex", justifyContent: "space-between", py: 0.3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          {label}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.72rem" }}>
                          {value || "—"}
                        </Typography>
                      </Box>
                    ))}

                    {/* Missions socles — mapping GAIF : serviceOffering1 = mission socle,
                        serviceOffering2Pct = coût maintenance annuel (€) */}
                    {(row.serviceOffering1 || row.serviceOffering2Pct) && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            mb: 1,
                            display: "block",
                          }}
                        >
                          Missions socles
                        </Typography>

                        {row.serviceOffering1 && (
                          <Box
                            sx={{
                              mb: 0.75,
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                            }}
                          >
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.72rem" }}>
                                {row.serviceOffering1}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {Number(row.serviceOffering2Pct) > 0 && (
                          <Box
                            sx={{
                              mb: 0.75,
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.04),
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.72rem" }}>
                              Coût maintenance annuel
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ fontSize: "0.72rem", color: "success.main" }}
                            >
                              {formatCurrency(Number(row.serviceOffering2Pct))}
                            </Typography>
                          </Box>
                        )}
                      </>
                    )}
                  </Grid>
                </Grid>

                {/* Revenue Team — hidden for GAIF Pilot */}
                {false && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}
                      >
                        Revenue Team
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label="Edit revenue team"
                        onClick={() => setRevenueTeamOpen(true)}
                        sx={{ p: 0.25, color: "secondary.main" }}
                      >
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                    {revenueTeamMembers.length > 0 ? (
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                        {["M/SM", "Director", "Partner"].map((bucket) => {
                          const bucketMembers = revenueTeamMembers.filter((m: any) => m.gradeBucket === bucket);
                          const bucketTotal = bucketMembers.reduce((s: number, m: any) => s + (m.percentage || 0), 0);
                          const bucketColor =
                            bucket === "Partner"
                              ? brand.secondaryDark
                              : bucket === "Director"
                                ? brand.secondaryLight
                                : brand.secondary;
                          return (
                            <Box key={bucket}>
                              <Box
                                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  sx={{
                                    fontSize: "0.6rem",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    color: bucketColor,
                                  }}
                                >
                                  {bucket}
                                </Typography>
                                {bucketMembers.length > 0 && (
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    sx={{
                                      fontSize: "0.6rem",
                                      color:
                                        bucketTotal > 100
                                          ? "error.main"
                                          : bucketTotal === 100
                                            ? "success.main"
                                            : "text.disabled",
                                    }}
                                  >
                                    {bucketTotal}%
                                  </Typography>
                                )}
                              </Box>
                              {bucketMembers.length > 0 ? (
                                bucketMembers.map((m: any) => (
                                  <Box
                                    key={m.id}
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      py: 0.25,
                                      px: 0.75,
                                      borderRadius: 1,
                                      bgcolor: alpha(bucketColor, 0.04),
                                      mb: 0.25,
                                    }}
                                  >
                                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.7rem" }}>
                                      {m.name || "—"}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      sx={{ fontSize: "0.7rem", color: bucketColor }}
                                    >
                                      {m.percentage}%
                                    </Typography>
                                  </Box>
                                ))
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ fontSize: "0.65rem", fontStyle: "italic" }}
                                >
                                  —
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ fontStyle: "italic", fontSize: "0.68rem" }}
                      >
                        Not configured
                      </Typography>
                    )}
                  </>
                )}
              </Grid>

              {/* ── RIGHT: Tabbed Workspace ── */}
              <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column" }}>
                <Box sx={{ p: 2.5, flex: 1, overflow: "auto" }}>
                  {/* Tabs row — aligned with Revenue divider */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-end",
                      mb: 2,
                      pb: 2,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Tabs
                      value={activeWorkspaceTab}
                      onChange={(_e, v) => setActiveWorkspaceTab(v)}
                      sx={{ minHeight: 0, flex: 1, "& .MuiTabs-indicator": { bottom: -17 } }}
                    >
                      <Tab
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            Experts
                            {staffingNeedsCount > 0 && (
                              <Chip
                                label={staffingNeedsCount}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  bgcolor: alpha(accentColor, 0.1),
                                  color: accentColor,
                                }}
                              />
                            )}
                          </Box>
                        }
                        sx={{ minHeight: 0, textTransform: "none", fontWeight: 600, fontSize: "0.72rem", p: 0, mr: 3 }}
                      />
                      <Tab
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            Actions
                            {actionsCount > 0 && (
                              <Chip
                                label={actionsCount}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  color: "primary.main",
                                }}
                              />
                            )}
                          </Box>
                        }
                        sx={{ minHeight: 0, textTransform: "none", fontWeight: 600, fontSize: "0.72rem", p: 0, mr: 3 }}
                      />
                      <Tab
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            Contacts
                            {contactsCount > 0 && (
                              <Chip
                                label={contactsCount}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  bgcolor: alpha(theme.palette.info.main, 0.1),
                                  color: "info.main",
                                }}
                              />
                            )}
                          </Box>
                        }
                        sx={{ minHeight: 0, textTransform: "none", fontWeight: 600, fontSize: "0.72rem", p: 0 }}
                      />
                    </Tabs>
                    {(currentStaffingCount > 0 || staffingNeedsCount > 0) && (
                      <Typography
                        variant="caption"
                        onClick={handleGoToStaffing}
                        sx={{
                          fontSize: "0.65rem",
                          color: accentColor,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        Voir dans Plan de charge →
                      </Typography>
                    )}
                  </Box>
                  {activeWorkspaceTab === 0 && (
                    <StaffingNeeds opportunityId={row.opportunityId} jobCode={row.jobCode} opportunityRow={row} />
                  )}
                  {activeWorkspaceTab === 1 && (
                    <OpportunityActions
                      opportunityId={row.opportunityId}
                      opportunityName={row.opportunity}
                      opportunityDetails={{
                        Responsable: row.em,
                        Prestataire: row.ep,
                        account: row.account,
                        Status: statusText[row.status] || `Status ${row.status}`,
                        Revenue: showNetRevenue ? row.netRevenue || 0 : row.grossRevenue || 0,
                        ServiceLine: row.serviceLine1,
                        Responsable2: row.manager,
                        Prestataire2: row.partner,
                      }}
                    />
                  )}
                  {activeWorkspaceTab === 2 && (
                    <OpportunityContacts
                      accountId={row.accountId}
                      accountName={row.account}
                      primaryContactId={row.primaryContactId}
                    />
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* RevenueTeamDialog — hidden for GAIF Pilot */}
        {false && (
          <RevenueTeamDialog
            open={revenueTeamOpen}
            onClose={() => setRevenueTeamOpen(false)}
            opportunityId={opportunityId}
            opportunityName={row.opportunity || ""}
            em={row.em}
            ep={row.ep}
            manager={row.manager}
            partner={row.partner}
          />
        )}
      </Box>
    );
  }
);

OpportunityExpandedDetails.displayName = "OpportunityExpandedDetails";

export default OpportunityExpandedDetails;
