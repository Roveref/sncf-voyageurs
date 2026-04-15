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
import TableChartIcon from "@mui/icons-material/TableChart";
import SlideshowIcon from "@mui/icons-material/Slideshow";
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
import { useComputedStore } from "../../../stores/useComputedStore";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useUIStore } from "../../../stores/useUIStore";
import { API_BASE, apiFetch } from "../../../services/api";
import { brand } from "../../../config/brandConfig";

const formatDateSafely = formatDateFR;
const statusColors = STATUS_COLORS;
const statusText = STATUS_TEXT;
const EMPTY_TEAM: any[] = [];

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

    const staffingIndexVer = useComputedStore((s) => s.staffingIndexVersion);
    const currentStaffingCount = useMemo(() => {
      try {
        const raw = localStorage.getItem("staffing_employee_index");
        if (!raw) return 0;
        const index = JSON.parse(raw);
        const jobCode = row.jobCode;
        const opportunityId = row.opportunityId;
        const seen = new Set<string>();
        for (const key of [jobCode, opportunityId].filter(Boolean)) {
          const entries = index[String(key).trim()];
          if (entries)
            for (const e of entries) {
              if (e.empId && !seen.has(e.empId)) seen.add(e.empId);
            }
        }
        return seen.size;
      } catch {
        return 0;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row, staffingIndexVer]);

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
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  {row.crmGuid && !row.opportunityId?.startsWith("manual-") ? (
                    <Typography
                      variant="h6"
                      color={accentColor}
                      fontWeight={700}
                      component="a"
                      href={`https://bearingpoint.crm4.dynamics.com/main.aspx?appid=3e971613-c281-ea11-a813-000d3ab824d7&forceUCI=1&pagetype=entityrecord&etn=opportunity&id=${row.crmGuid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        textDecoration: "none",
                        cursor: "pointer",
                        transition: "color 0.2s ease, transform 0.2s ease",
                        "&:hover": {
                          textDecoration: "underline",
                          color: alpha(theme.palette.secondary.main, 0.7),
                          transform: "translateX(2px)",
                        },
                        "&:active": {
                          transform: "translateX(1px)",
                        },
                        display: "flex",
                        alignItems: "center",
                        mr: 2,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.opportunity}
                      <Box
                        component="span"
                        sx={{
                          ml: 1,
                          fontSize: "0.8rem",
                          opacity: 0.7,
                          transition: "opacity 0.2s ease",
                          "&:hover": {
                            opacity: 1,
                          },
                        }}
                      >
                        🔗
                      </Box>
                    </Typography>
                  ) : (
                    <Typography variant="h6" color={accentColor} fontWeight={700} sx={{ mr: 2 }}>
                      {row.opportunity}
                    </Typography>
                  )}

                  {/* Win Percentage Chip */}
                  {row.winPct && (
                    <Chip
                      label={`${row.winPct}%`}
                      color={row.winPct >= 75 ? "success" : row.winPct >= 50 ? "warning" : "error"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        mr: 1,
                      }}
                    />
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
                  ID: {row.opportunityId} • Created: {formatDateSafely(row.creationDate)}
                </Typography>
              </Box>
            </Box>
            {/* /logo + title wrapper */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Edit button for manual opportunities */}
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
                  Edit
                </Button>
              )}

              {/* Duplicate button (creates a manual copy of any opportunity) */}
              {setEditOpportunity && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    const copy = { ...row };
                    delete copy.opportunityId;
                    copy.isManual = true;
                    copy.opportunity = `${row.opportunity || row.opportunity || ""} (copy)`;
                    setEditOpportunity(copy);
                  }}
                  sx={{ fontSize: "0.72rem", textTransform: "none", color: "text.secondary" }}
                >
                  Duplicate
                </Button>
              )}

              {/* Override indicator and revert button */}
              {isOverridden && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
                  <Tooltip
                    title={`Status modified: ${statusText[override?.originalStatus as any]} → ${statusText[override?.newStatus as any]}`}
                  >
                    <Chip
                      icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                      label="Modified"
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </Tooltip>
                  <Tooltip title="Undo modification">
                    <IconButton
                      size="small"
                      aria-label="Undo status modification"
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

          {/* Lost Comment Section - Only for lost opportunities */}
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
                    Lost Comment
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
                {/* Revenue — full width */}
                <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
                  >
                    {showNetRevenue ? "Net Revenue" : "Gross Revenue"}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h5" fontWeight={700} color={accentColor}>
                      {formatCurrency(showNetRevenue ? row.netRevenue : row.grossRevenue)}
                    </Typography>
                    {row.opportunityId && (
                      <>
                        <Tooltip title="Contract BCS (SharePoint)">
                          <IconButton
                            size="small"
                            aria-label="Open Contract BCS on SharePoint"
                            component="a"
                            href={`https://be4you.sharepoint.com/sites/OPUS-${row.opportunityId}/OPUS%20Documents/Internal/ContractBCS/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: "#217346", "&:hover": { bgcolor: alpha("#217346", 0.1) } }}
                          >
                            <TableChartIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Submitted Proposal (SharePoint)">
                          <IconButton
                            size="small"
                            aria-label="Open Submitted Proposal on SharePoint"
                            component="a"
                            href={`https://be4you.sharepoint.com/sites/OPUS-${row.opportunityId}/OPUS%20Documents/Client/SubmittedProposal/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: "#D24726", "&:hover": { bgcolor: alpha("#D24726", 0.1) } }}
                          >
                            <SlideshowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                  {row.isAllocated && (
                    <Typography
                      variant="caption"
                      color="secondary.main"
                      sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}
                    >
                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "secondary.main" }} />
                      Alloc: {row.allocatedServiceLine} · {row.allocationPercentage}% ·{" "}
                      {formatCurrency(showNetRevenue ? row.allocatedNetRevenue : row.allocatedGrossRevenue)}
                    </Typography>
                  )}
                  {showIO && ioAmount > 0 && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}
                    >
                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "primary.main" }} />
                      I&O: {Math.round(ioPercentage)}% · {formatCurrency(ioAmount)}
                    </Typography>
                  )}
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
                      Details
                    </Typography>
                    {[
                      ["Account", row.account],
                      ["Segment", row.subSegmentCode || "—"],
                      ["Sub Segment", row.subSegment || "—"],
                    ].map(([label, value]) => (
                      <Box
                        key={label as string}
                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.3 }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          {label}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: "60%" }}>
                          {label === "Account" && <AccountLogo accountName={String(value || "")} size={16} />}
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
                          Technology
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
                      Project
                    </Typography>
                    {[
                      ["Project Type", row.engagementType || "—"],
                      ["CM1%", row.cm1Pct ? `${row.cm1Pct}%` : "—"],
                      ["Est. Booking", formatDateSafely(row.estimatedBookingDate)],
                      ["Actual Booking", formatDateSafely(row.bookingDate)],
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
                      Team
                    </Typography>
                    {[
                      ["EM", row.em],
                      ["EP", row.ep],
                      ["Manager", row.manager],
                      ["Partner", row.partner],
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

                    {/* Services */}
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
                      Services
                    </Typography>
                    {[
                      {
                        name: row.serviceLine1,
                        offering: row.serviceOffering1,
                        alloc: row.allocation1 || row.serviceOffering1Pct,
                        color: "primary" as const,
                      },
                      ...(row.serviceLine2 && row.serviceLine2 !== "-"
                        ? [
                            {
                              name: row.serviceLine2,
                              offering: row.serviceOffering2,
                              alloc: row.allocation2 || row.serviceOffering2Pct,
                              color: "secondary" as const,
                            },
                          ]
                        : []),
                      ...(row.serviceLine3 && row.serviceLine3 !== "-"
                        ? [
                            {
                              name: row.serviceLine3,
                              offering: row.serviceOffering3,
                              alloc: row.allocation3 || row.serviceOffering3Pct,
                              color: "info" as const,
                            },
                          ]
                        : []),
                    ].map((svc, i) => {
                      const svcAmount =
                        ((showNetRevenue ? row.netRevenue : row.grossRevenue) || 0) * ((svc.alloc || 0) / 100);
                      return (
                        <Box
                          key={i}
                          sx={{
                            mb: 0.75,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette[svc.color].main, 0.04),
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.72rem" }}>
                              {svc.name}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              {svc.alloc > 0 && (
                                <Chip
                                  label={`${svc.alloc}%`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: "0.6rem",
                                    fontWeight: 600,
                                    bgcolor: alpha(theme.palette[svc.color].main, 0.1),
                                    color: `${svc.color}.main`,
                                  }}
                                />
                              )}
                              {svc.alloc > 0 && (
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  sx={{ fontSize: "0.68rem", color: `${svc.color}.main` }}
                                >
                                  {formatCurrency(svcAmount)}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {svc.offering && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                              {svc.offering}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Grid>
                </Grid>

                {/* Revenue Team — full width below the 2-col grid */}
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
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
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
                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic", fontSize: "0.68rem" }}>
                    Not configured
                  </Typography>
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
                            Staffing
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
                        Voir dans Staffing →
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
                        EM: row.em,
                        EP: row.ep,
                        account: row.account,
                        Status: statusText[row.status] || `Status ${row.status}`,
                        Revenue: showNetRevenue ? row.netRevenue || 0 : row.grossRevenue || 0,
                        ServiceLine: row.serviceLine1,
                        Manager: row.manager,
                        Partner: row.partner,
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
      </Box>
    );
  }
);

OpportunityExpandedDetails.displayName = "OpportunityExpandedDetails";

export default OpportunityExpandedDetails;
