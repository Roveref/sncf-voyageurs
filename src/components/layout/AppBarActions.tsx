import React, { memo, useMemo } from "react";
import { useUIStore } from "../../stores/useUIStore";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import BusinessIcon from "@mui/icons-material/Business";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import BugReportIcon from "@mui/icons-material/BugReport";
import SettingsIcon from "@mui/icons-material/Settings";
import NotificationBell from "../common/NotificationBell";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import StatusOverrideManager from "../StatusOverrideManager";
import { SaveStatusIndicator } from "../common/SaveStatusIndicator";
import { useAppStore } from "../../stores/useAppStore";
import { useLoadingStore } from "../../stores/useLoadingStore";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useStaffingStatus } from "../../queries/useStaffingStatus";
import { brand } from "../../config/brandConfig";
import { timing, easing } from "../../styles/animations";

interface AppBarActionsProps {
  dataReady: boolean;
  activeTab: number;
  allOpportunityData: any[];
  setActiveTab?: (tab: number) => void;
  onSettingsOpen: () => void;
  filteredOppIds?: Set<string>;
}

function formatPipeDelta(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M€`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K€`;
  return `${Math.round(value)}€`;
}

const CrmDeltaIndicator = memo(
  ({ onNavigateToPipeline, filteredOppIds }: { onNavigateToPipeline: () => void; filteredOppIds?: Set<string> }) => {
    const liveChangedOppIds = useAppStore((s) => s.liveChangedOppIds);
    const liveRevenueDelta = useAppStore((s) => s.liveRevenueDelta);
    const filterActive = useAppStore((s) => s.liveFilterActive);

    // When sidebar filters are active, only count live changes that match
    const { count, revDelta } = useMemo(() => {
      if (!filteredOppIds || filteredOppIds.size === 0) {
        return { count: liveChangedOppIds.size, revDelta: liveRevenueDelta };
      }
      let c = 0;
      for (const id of liveChangedOppIds) {
        if (filteredOppIds.has(id)) c++;
      }
      // Revenue delta can't be split per-opp from the global counter,
      // so we scale proportionally: (filtered count / total count) * total delta
      const ratio = liveChangedOppIds.size > 0 ? c / liveChangedOppIds.size : 0;
      return { count: c, revDelta: Math.round(liveRevenueDelta * ratio) };
    }, [liveChangedOppIds, liveRevenueDelta, filteredOppIds]);

    if (count === 0) return null;

    const hasPipe = Math.abs(revDelta) >= 1000;
    const isPositive = revDelta >= 0;
    const parts: string[] = [];
    parts.push(`${count} modif${count > 1 ? "s" : ""}`);
    if (hasPipe) parts.push(`${isPositive ? "+" : ""}${formatPipeDelta(revDelta)}`);

    const handleClick = () => {
      useAppStore.getState().toggleLiveFilter();
      onNavigateToPipeline();
    };

    return (
      <Tooltip title={filterActive ? "Cliquer pour retirer le filtre" : "Cliquer pour voir les actifs modifiés"}>
        <Chip
          icon={
            isPositive ? (
              <TrendingUpIcon sx={{ fontSize: "0.85rem !important" }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: "0.85rem !important" }} />
            )
          }
          label={parts.join(" · ")}
          size="small"
          onClick={handleClick}
          sx={{
            height: 22,
            fontSize: "0.68rem",
            fontWeight: 700,
            cursor: "pointer",
            bgcolor: filterActive
              ? "rgba(59,130,246,0.2)"
              : isPositive
                ? "rgba(16,185,129,0.15)"
                : "rgba(239,68,68,0.15)",
            color: filterActive ? "#3b82f6" : isPositive ? "#10b981" : "#ef4444",
            border: filterActive ? "1px solid rgba(59,130,246,0.4)" : "none",
            "& .MuiChip-icon": {
              color: filterActive ? "#3b82f6" : isPositive ? "#10b981" : "#ef4444",
            },
            mr: 1,
            "&:hover": { opacity: 0.85 },
          }}
        />
      </Tooltip>
    );
  }
);
CrmDeltaIndicator.displayName = "CrmDeltaIndicator";

const AppBarActions = memo(
  ({ dataReady, activeTab, allOpportunityData, setActiveTab, onSettingsOpen, filteredOppIds }: AppBarActionsProps) => {
    // Read from stores directly instead of receiving 16+ props
    const { hasStaffingData } = useStaffingStatus();
    const loading = useLoadingStore((s) => s.loading);
    const showIO = useAppStore((s) => s.showIO);
    const toggleIO = useAppStore((s) => s.toggleIO);
    const showLost = useAppStore((s) => s.showLost);
    const toggleLost = useAppStore((s) => s.toggleLost);
    const showNetRevenue = useAppStore((s) => s.showNetRevenue);
    const toggleNetRevenue = useAppStore((s) => s.toggleNetRevenue);
    const modificationsEnabled = useAppStore((s) => s.modificationsEnabled);
    const setModificationsEnabled = useAppStore((s) => s.setModificationsEnabled);
    const setEditOpportunity = useUIStore((s) => s.setEditOpportunity);
    const handleDeleteManualOpportunity = useUserDataStore((s) => s.deleteManualOpportunity);
    const handleOpportunityUpdated = useUserDataStore((s) => s.updateManualOpportunity);
    const handleAddManualOpportunity = useUserDataStore((s) => s.addManualOpportunity);
    const manualAccounts = useUserDataStore((s) => s.manualAccounts);
    const handleDeleteManualAccount = useUserDataStore((s) => s.deleteManualAccount);
    const handleClearAllManualOpportunities = useUserDataStore((s) => s.clearAllManualOpportunities);
    const handleClearAllManualAccounts = useUserDataStore((s) => s.clearAllManualAccounts);
    const handleAccountCreated = useUserDataStore((s) => s.addManualAccount);
    const transitionSx = {
      transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
    };

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          position: "absolute",
          right: 6,
          // Reserve space but hide until data ready (prevents CLS)
          ...(!dataReady && { visibility: "hidden", pointerEvents: "none" }),
        }}
      >
        {/* Four-state I&O toggle: hidden for GAIF Pilot */}
        {false && dataReady && (
          <FormControlLabel
            title={
              {
                off: "GAIF masqué",
                show: "Afficher GAIF",
                ioOnly: "GAIF uniquement",
                ioTeam: "Équipe GAIF",
                ioLead: "Responsable GAIF",
              }[showIO]
            }
            control={
              <Switch
                checked={showIO !== "off"}
                onChange={toggleIO}
                inputProps={{ "aria-label": "Toggle I&O display" }}
                sx={{
                  "& .MuiSwitch-switchBase": transitionSx,
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color:
                      showIO === "ioOnly"
                        ? "#9575CD"
                        : showIO === "ioTeam"
                          ? "#26A69A"
                          : showIO === "ioLead"
                            ? "#42A5F5"
                            : undefined,
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor:
                      showIO === "ioOnly"
                        ? "#7E57C2"
                        : showIO === "ioTeam"
                          ? "#00897B"
                          : showIO === "ioLead"
                            ? "#1E88E5"
                            : brand.primaryDark,
                  },
                  "& .MuiSwitch-track": {
                    backgroundColor: "rgba(255,255,255,0.3)",
                    ...transitionSx,
                  },
                  "& .MuiSwitch-thumb": transitionSx,
                }}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <BusinessIcon sx={{ mr: 0.5, fontSize: 18, color: "white", ...transitionSx }} />
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ fontSize: "0.8rem", color: "white", ...transitionSx }}
                >
                  {
                    {
                      off: "GAIF",
                      show: "GAIF",
                      ioOnly: "GAIF uniquement",
                      ioTeam: "Équipe GAIF",
                      ioLead: "Responsable GAIF",
                    }[showIO]
                  }
                </Typography>
              </Box>
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 1.5,
              py: 0.25,
              ...transitionSx,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          />
        )}

        {/* Bookings/Lost Toggle - Only visible on Bookings tab */}
        {dataReady && activeTab === 1 && (
          <FormControlLabel
            control={
              <Switch
                checked={showLost}
                onChange={toggleLost}
                inputProps={{ "aria-label": showLost ? "Afficher maintenance" : "Afficher fin de vie" }}
                sx={{
                  "& .MuiSwitch-switchBase": transitionSx,
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: brand.primaryDark,
                  },
                  "& .MuiSwitch-track": {
                    backgroundColor: "rgba(255,255,255,0.3)",
                    ...transitionSx,
                  },
                  "& .MuiSwitch-thumb": transitionSx,
                }}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {showLost ? (
                  <CancelOutlinedIcon sx={{ mr: 0.5, fontSize: 18, color: "white", ...transitionSx }} />
                ) : (
                  <CheckCircleOutlineIcon sx={{ mr: 0.5, fontSize: 18, color: "white", ...transitionSx }} />
                )}
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ fontSize: "0.8rem", color: "white", ...transitionSx }}
                >
                  {showLost ? "Déclassés" : "Maintenance"}
                </Typography>
              </Box>
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 1.5,
              py: 0.25,
              ...transitionSx,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          />
        )}

        {/* Revenue Toggle Switch */}
        {dataReady && (
          <FormControlLabel
            control={
              <Switch
                checked={showNetRevenue}
                onChange={toggleNetRevenue}
                inputProps={{ "aria-label": showNetRevenue ? "Afficher valeur d'achat" : "Afficher valeur résiduelle" }}
                sx={{
                  "& .MuiSwitch-switchBase": transitionSx,
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: brand.primaryDark,
                  },
                  "& .MuiSwitch-track": {
                    backgroundColor: "rgba(255,255,255,0.3)",
                    ...transitionSx,
                  },
                  "& .MuiSwitch-thumb": transitionSx,
                }}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <MonetizationOnIcon sx={{ mr: 0.5, fontSize: 18, color: "white", ...transitionSx }} />
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ fontSize: "0.8rem", color: "white", ...transitionSx }}
                >
                  {showNetRevenue ? "Val. résid." : "Val. achat"}
                </Typography>
              </Box>
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 1.5,
              py: 0.25,
              ...transitionSx,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          />
        )}

        {/* Status Override Manager - Shows when there are overrides or manual opportunities */}
        {dataReady && (
          <StatusOverrideManager
            opportunityData={allOpportunityData}
            onDeleteManualOpportunity={handleDeleteManualOpportunity}
            onManualOpportunityUpdated={handleOpportunityUpdated}
            onAddManualOpportunity={handleAddManualOpportunity}
            manualAccounts={manualAccounts}
            onDeleteManualAccount={handleDeleteManualAccount}
            onClearAllManualOpportunities={handleClearAllManualOpportunities}
            onClearAllManualAccounts={handleClearAllManualAccounts}
            onAddManualAccount={handleAccountCreated}
            showNetRevenue={showNetRevenue}
            showIO={showIO !== "off"}
            setEditOpportunity={setEditOpportunity}
            isLoading={loading}
            modificationsEnabled={modificationsEnabled}
            onToggleModifications={setModificationsEnabled}
          />
        )}

        {/* Live CRM delta indicator */}
        {dataReady && (
          <CrmDeltaIndicator onNavigateToPipeline={() => setActiveTab?.(0)} filteredOppIds={filteredOppIds} />
        )}

        {/* Notification Bell */}
        {dataReady && <NotificationBell />}

        {/* Settings button */}
        {dataReady && (
          <Tooltip title="Settings">
            <IconButton
              size="small"
              onClick={onSettingsOpen}
              aria-label="Open settings"
              sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white" } }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Debug toggle - Staffing tab only */}
        {activeTab === 2 && hasStaffingData && !loading && (
          <Tooltip title="Debug data">
            <IconButton
              size="small"
              onClick={() => useUIStore.getState().toggleStaffingDebug()}
              aria-label="Show debug data"
              sx={{ color: "text.secondary" }}
            >
              <BugReportIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }
);

AppBarActions.displayName = "AppBarActions";

export default AppBarActions;
