/**
 * LandingPage — Pre-data landing screen with region map, year selector, and tab chooser.
 * Extracted from App.tsx to reduce its size.
 */

import { memo, useState, useEffect, useCallback, Suspense, lazy } from "react";
import type { RegionData } from "../RegionMap/RegionMap";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Fade from "@mui/material/Fade";
import CircularProgress from "@mui/material/CircularProgress";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { brand } from "../../config/brandConfig";
import { alpha } from "@mui/material/styles";
import { timing, easing } from "../../styles/animations";
import { useAppStore } from "../../stores/useAppStore";
import YearWheel from "../common/YearWheel";
import type { GaifSitesSelection } from "../GaifSitesMap";

const GaifSitesMap = lazy(() => import("../GaifSitesMap/GaifSitesMap"));

interface LandingPageProps {
  darkMode: boolean;
  backendAvailable: boolean;
  regions: RegionData[];
  hydrating: boolean;
  hydrationPercent?: number;
  landingTab: number;
  setLandingTab: (tab: number) => void;
  startHydration: (opts: { region?: string; country?: string; since?: string }) => void;
}

const TABS = [
  { value: 0, label: "Parc d'actifs", icon: <TrendingUpRoundedIcon /> },
  { value: 1, label: "Maintenance", icon: <TaskAltRoundedIcon /> },
  { value: 2, label: "Plan de charge", icon: <GroupsRoundedIcon /> },
  { value: 3, label: "Cycle de vie", icon: <HubRoundedIcon /> },
  { value: 4, label: "Conformité", icon: <PersonAddAltRoundedIcon /> },
] as const;

const LandingPage = memo(
  ({
    darkMode,
    backendAvailable,
    regions: _regions,
    hydrating,
    hydrationPercent,
    landingTab,
    setLandingTab,
    startHydration,
  }: LandingPageProps) => {
    // Sélection sur la carte France — BU ou site. Par défaut : toute la France.
    const [mapSelection, setMapSelection] = useState<GaifSitesSelection>({ kind: "all" });
    const sinceYear = useAppStore((s) => s.sinceYear);
    const setSinceYear = useAppStore((s) => s.setSinceYear);

    const enabled = backendAvailable && !hydrating;

    const handleStart = useCallback(() => {
      if (!backendAvailable || hydrating) return;
      const since = sinceYear ? `${sinceYear}-01-01` : undefined;
      // Hydratation : on charge tout le périmètre (region=IDF est la valeur historique
      // qui couvre l'ensemble des sites GAIF, TN + TER + IC). La sélection BU/site
      // sert à pré-filtrer côté dashboard une fois les données chargées.
      useAppStore.getState().setHydrationFilter({ region: "IDF" });
      startHydration({ region: "IDF", since });
    }, [backendAvailable, hydrating, sinceYear, startHydration]);

    // Enter key → start hydration
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        handleStart();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [handleStart]);

    return (
      <Fade in timeout={800}>
        <Paper
          elevation={2}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: { xs: "calc(100vh - 140px)", md: "calc(100vh - 160px)" },
            borderRadius: 3,
            p: { xs: 3, md: 4 },
            background: darkMode
              ? `linear-gradient(to bottom right, ${brand.darkPaper}, ${brand.darkBg})`
              : "linear-gradient(to bottom right, #ffffff, #f8fafc)",
            textAlign: "center",
            border: "1px solid",
            borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0, 0, 0, 0.05)",
            overflow: "auto",
          }}
        >
          <Box
            component="img"
            src="/sncf-voyageurs-logo.png"
            alt="SNCF Voyageurs"
            sx={{ height: 70, width: "auto", mb: 2 }}
          />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
            Plateforme de pilotage des installations fixes — SNCF Voyageurs
          </Typography>

          {/* Tab selector */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap", justifyContent: "center" }}>
            {TABS.map(({ value, label, icon }) => {
              const selected = landingTab === value;
              return (
                <Box
                  key={value}
                  onClick={() => setLandingTab(value)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    width: 100,
                    height: 88,
                    borderRadius: 2.5,
                    cursor: "pointer",
                    background: selected
                      ? darkMode
                        ? alpha(brand.primary, 0.18)
                        : alpha(brand.primary, 0.1)
                      : darkMode
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                    transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
                    "&:hover": {
                      background: selected
                        ? darkMode
                          ? alpha(brand.primary, 0.24)
                          : alpha(brand.primary, 0.14)
                        : darkMode
                          ? "rgba(255,255,255,0.10)"
                          : "rgba(0,0,0,0.08)",
                      transform: "translateY(-2px)",
                    },
                    "& .landing-tab-icon": {
                      fontSize: 28,
                      color: selected ? brand.primary : "text.secondary",
                      transition: `color ${timing.normal} ${easing.elegant}`,
                    },
                  }}
                >
                  <Box className="landing-tab-icon" component="span" sx={{ display: "flex" }}>
                    {icon}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: selected ? 700 : 500,
                      color: selected ? brand.primary : "text.secondary",
                      transition: `color ${timing.normal} ${easing.elegant}`,
                      fontSize: "0.8rem",
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Sites GAIF Map — carte France avec les 18 sites opérationnels */}
          {backendAvailable && (
            <Box sx={{ mt: 0, width: "100%", maxWidth: 720, mx: "auto" }}>
              <Suspense fallback={null}>
                <GaifSitesMap
                  selection={mapSelection}
                  onSelectionChange={setMapSelection}
                  darkMode={darkMode}
                  height={320}
                />
              </Suspense>
            </Box>
          )}

          {/* Year wheel */}
          <Box sx={{ mt: 1, mb: 1 }}>
            <YearWheel selectedYear={sinceYear} onSelect={setSinceYear} darkMode={darkMode} />
          </Box>

          {/* Database button */}
          <Box sx={{ mt: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
            <Box
              onClick={handleStart}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2.5,
                py: 1.5,
                borderRadius: 2,
                cursor: enabled ? "pointer" : "default",
                opacity: enabled ? 1 : 0.4,
                background: enabled
                  ? darkMode
                    ? alpha(brand.primary, 0.18)
                    : alpha(brand.primary, 0.1)
                  : darkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.04)",
                transition: `background-color ${timing.normal} ${easing.elegant}, opacity ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}`,
                "&:hover": enabled
                  ? {
                      background: darkMode ? alpha(brand.primary, 0.28) : alpha(brand.primary, 0.18),
                      transform: "translateY(-2px)",
                    }
                  : {},
              }}
            >
              {hydrating ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, minWidth: 60 }}>
                  <CircularProgress size={16} sx={{ color: brand.primary }} />
                  <Box
                    sx={{
                      width: 60,
                      height: 3,
                      borderRadius: 1.5,
                      bgcolor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${hydrationPercent ?? 0}%`,
                        height: "100%",
                        borderRadius: 1.5,
                        bgcolor: brand.primary,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </Box>
                </Box>
              ) : (
                <Typography
                  sx={{
                    fontWeight: enabled ? 700 : 500,
                    color: enabled ? brand.primary : "text.secondary",
                    fontSize: "0.85rem",
                    lineHeight: 1.2,
                  }}
                >
                  Accéder au tableau de bord
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      </Fade>
    );
  }
);

LandingPage.displayName = "LandingPage";
export default LandingPage;
