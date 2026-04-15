import React, { useMemo, useCallback, useState, useEffect, useRef, lazy, Suspense } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import useResponsive from "./hooks/useResponsive";
import MobileBottomNav from "./components/mobile/MobileBottomNav";
import MobileAppBar from "./components/mobile/MobileAppBar";
import AppBarOverflowDrawer from "./components/mobile/AppBarOverflowDrawer";
import MobileFilterModal from "./components/mobile/MobileFilterModal";
import DemoToggle from "./components/common/DemoToggle";
import OnboardingOverlay from "./components/common/OnboardingOverlay";
import { brand, onBrandConfigChange } from "./config/brandConfig";

// OPTIMIZED: Lazy load tab components for faster initial load
const ChatPanel = lazy(() => import("./components/ChatPanel/ChatPanel"));
const NeedsBoardV2 = lazy(() => import("./components/StaffingTab/components/Needs/NeedsBoardV2"));
// Widget catalog is now auto-built from the widget registry (DetachableCard auto-registers)
import GlobalCardExport from "./components/common/GlobalCardExport";

/**
 * Invisible component placed inside <Suspense>.
 * Mounts only when all lazy siblings have resolved.
 * useLayoutEffect fires synchronously before paint,
 * so the sidebar content mounts in the same paint frame as the cards.
 */

import ErrorBoundary from "./components/common/ErrorBoundary";
import AppBarActions from "./components/layout/AppBarActions";
import FloatingActions from "./components/layout/FloatingActions";
import LandingPage from "./components/layout/LandingPage";
import AppModals from "./components/layout/AppModals";
import TabRouter from "./components/layout/TabRouter";

// Eagerly load components that are always visible
import FilterPanel from "./components/Filters/FilterPanel";
import LeftSidebar from "./components/Sidebars/LeftSidebar";
import RightSidebar from "./components/Sidebars/RightSidebar";
// StaffingNeedsOverview replaced by NeedsBoardV2 PiP in StaffingTab
import { SERVICE_LINE_GROUPS } from "./components/Sidebars/serviceLineConstants";
import { SEGMENT_CODE_GROUPS } from "./components/Sidebars/segmentConstants";
import { getIncludedValues } from "./utils/filterHelpers";
import { createAppTheme } from "./theme";
import { timing, easing, keyframes } from "./styles/animations";
import { useTabRouting } from "./hooks/useTabRouting";
import { useFilterStore, useActiveFilterCount } from "./stores/useFilterStore";
import { useDerivedData } from "./hooks/useDerivedData";
import { useAppStore } from "./stores/useAppStore";
import { useLoadingStore } from "./stores/useLoadingStore";
import { useUndoStore } from "./stores/useUndoStore";
import { useThemeStore } from "./stores/useThemeStore";
import { useComputedStore } from "./stores/useComputedStore";
import { PUBLIC_HOLIDAY_DATES } from "./components/StaffingTab/constants";
import { useCrmData } from "./queries/useCrmData";
import { useStaffingStatus } from "./queries/useStaffingStatus";
import { useUserDataStore } from "./stores/useUserDataStore";
import { useUIStore } from "./stores/useUIStore";
import { useShallow } from "zustand/react/shallow";
import { useHydration } from "./hooks/useHydration";
import { useAutoSave } from "./hooks/useAutoSave";
import { useServerEventsV2 } from "./hooks/useServerEventsV2";
import { Navigate, Routes, Route } from "react-router-dom";
import { SkeletonDashboard, SkeletonSidebar } from "./components/common/SkeletonLoaders";
// Elegant icons for tabs
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";

// Sidebar width definition
const LEFT_DRAWER_WIDTH = 240;
const RIGHT_DRAWER_WIDTH = 240;

function App() {
  // ── Backend hydration (auto-load data from SQLite on startup) ──
  const { hydrating, hydrated, backendAvailable, hydrationPercent, startHydration, regions, loadingRegions } =
    useHydration();
  useAutoSave();
  useServerEventsV2();

  // ── Zustand store selectors: useThemeStore ──
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  // ── Zustand store selectors: useLoadingStore ──
  const loading = useLoadingStore((s) => s.loading);
  const notification = useLoadingStore((s) => s.notification);
  const closeNotification = useLoadingStore((s) => s.closeNotification);

  // ── Zustand store selectors: useAppStore ──
  const {
    showNetRevenue,
    toggleNetRevenue,
    showIO,
    toggleIO,
    showLost,
    toggleLost,
    modificationsEnabled,
    setModificationsEnabled,
  } = useAppStore(
    useShallow((s) => ({
      showNetRevenue: s.showNetRevenue,
      toggleNetRevenue: s.toggleNetRevenue,
      showIO: s.showIO,
      toggleIO: s.toggleIO,
      showLost: s.showLost,
      toggleLost: s.toggleLost,
      modificationsEnabled: s.modificationsEnabled,
      setModificationsEnabled: s.setModificationsEnabled,
    }))
  );

  // ── CRM data from React Query ──
  const { opportunityData, crmAccounts, filterOptions, segmentToSubSegmentMap, serviceToOfferingMap } = useCrmData();

  // ── Staffing status from React Query ──
  const { hasStaffingData } = useStaffingStatus();
  // ── Zustand store selectors: useComputedStore (staffing) ──
  const staffingEmployees = useComputedStore((s) => s.staffingEmployees);

  // ── Zustand store selectors: useUserDataStore ──
  const manualAccounts = useUserDataStore((s) => s.manualAccounts);

  // ── Zustand store selectors: useUIStore ──
  const setCreateStaffingNeedModalOpen = useUIStore((s) => s.setCreateStaffingNeedModalOpen);
  const staffingNeedsDrawerOpen = useUIStore((s) => s.staffingNeedsDrawerOpen);
  const setStaffingNeedsDrawerOpen = useUIStore((s) => s.setStaffingNeedsDrawerOpen);
  const selectedOpportunities = useUIStore((s) => s.selectedOpportunities);
  const setSelectedOpportunities = useUIStore((s) => s.setSelectedOpportunities);
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);

  // ── Staffing needs count for global badge ──
  const allStaffingNeedsMap = useUserDataStore((s) => s.staffingNeeds);
  // totalStaffingNeedsCount computed below (after filteredOppIds)

  // ── Existing hooks (kept as-is) ──
  const [activeTab, setActiveTab] = useTabRouting();
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const _handleFilterChange = useFilterStore((s) => s.handleFilterChange);
  const _handleToggleFilter = useFilterStore((s) => s.handleToggleFilter);
  const handleClearFilterType = useFilterStore((s) => s.handleClearFilterType);

  // Bind maps at the top level so downstream callers don't need store access
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>) =>
      _handleFilterChange(newFilters, segmentToSubSegmentMap, serviceToOfferingMap),
    [_handleFilterChange, segmentToSubSegmentMap, serviceToOfferingMap]
  );
  const handleToggleFilter = useCallback(
    (type: string, value: string) => _handleToggleFilter(type, value, segmentToSubSegmentMap, serviceToOfferingMap),
    [_handleToggleFilter, segmentToSubSegmentMap, serviceToOfferingMap]
  );
  const handleClearAllFilters = useFilterStore((s) => s.handleClearAllFilters);
  const segmentModes = useFilterStore((s) => s.segmentModes);
  const setSegmentModes = useFilterStore((s) => s.setSegmentModes);
  const serviceLineModes = useFilterStore((s) => s.serviceLineModes);
  const setServiceLineModes = useFilterStore((s) => s.setServiceLineModes);
  const activeFilterCount = useActiveFilterCount();
  const [landingTab, setLandingTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [globalSearchText, setGlobalSearchText] = useState("");
  const hasNavigatedRef = useRef(false);
  const statusOverrideCount = useUserDataStore(
    (s) => Object.values(s.statusOverrides).filter((o) => !o._reverted).length
  );

  const { allOpportunityData, filteredData, filteredDataRaw, tabData, pipelineData, bookingsData } = useDerivedData(
    filters,
    "inclusive",
    activeTab,
    segmentModes,
    serviceLineModes,
    globalSearchText
  );

  // ── Theme (reactive to brandConfig changes via onBrandConfigChange) ──
  const [themeVersion, setThemeVersion] = useState(0);
  useEffect(() => {
    onBrandConfigChange(() => setThemeVersion((v) => v + 1));
  }, []);
  const theme = useMemo(() => createAppTheme(darkMode ? "dark" : "light"), [darkMode, themeVersion]);
  const { isPhone, isTablet, isDesktop, isTouchDevice } = useResponsive();
  // Backward compat: isMobile = phone OR tablet (same as previous breakpoint.down("md"))
  const isMobile = isPhone || isTablet;

  // ── Mobile navigation state ──
  const [overflowDrawerOpen, setOverflowDrawerOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const handleOverflowOpen = useCallback((_anchor: HTMLElement) => setOverflowDrawerOpen(true), []);

  // ── Local callbacks ──
  const handleTabChange = useCallback(
    (_e: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      setSelectedOpportunities([]);
    },
    [setActiveTab, setSelectedOpportunities]
  );
  const handleMobileTabChange = useCallback(
    (newValue: number) => {
      setActiveTab(newValue);
      setSelectedOpportunities([]);
    },
    [setActiveTab, setSelectedOpportunities]
  );

  // Navigate to the landing-page-selected tab when data first loads
  const hasData = opportunityData.length > 0 || hasStaffingData;
  // Data fully processed and ready — requires explicit hydration (not just SSE data)
  const dataReady = hydrated && !loading && (opportunityData.length > 0 || hasStaffingData);

  // Tab content ready — set when Suspense resolves (lazy chunks loaded + rendered)
  const [tabReady, setTabReady] = useState(false);
  const handleTabReady = useCallback(() => setTabReady(true), []);

  useEffect(() => {
    if (hydrated && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      setActiveTab(landingTab);
    }
  }, [hydrated, landingTab, setActiveTab]);

  // ── Global undo: Ctrl+Z / Cmd+Z ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        const action = useUndoStore.getState().pop();
        if (action) {
          action.undo();
          useLoadingStore.getState().notify(`Undone: ${action.label}`, "info");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Handler for navigating to an opportunity by job code (from staffing tab)
  const handleNavigateToOpportunityByJobCode = useCallback(
    (jobNo: string) => {
      if (!allOpportunityData || allOpportunityData.length === 0) return;
      const opp = allOpportunityData.find((o: any) => {
        const jc = o.Jobcode || o.JobCode || o.jobCode || o.ProjectCode;
        return jc && String(jc).trim() === String(jobNo).trim();
      });
      if (!opp) return;
      const opportunityId = opp.opportunityId;
      const status = opp.status;
      const numStatus = typeof status === "number" ? status : parseInt(status, 10);
      if (numStatus === 14 || numStatus === 15) {
        setActiveTab(1);
        useAppStore.setState({ showLost: numStatus === 15 });
      } else {
        setActiveTab(0);
      }
      useUIStore.getState().navigateToOpportunity(opportunityId);
    },
    [allOpportunityData, setActiveTab]
  );

  // ── Filtered opp IDs (synced to store for global access) ──
  const filteredOppIds = useMemo(() => {
    return new Set(filteredData.map((o: any) => String(o.opportunityId)));
  }, [filteredData]);

  useEffect(() => {
    useAppStore.getState().setFilteredOppIds(filteredOppIds);
  }, [filteredOppIds]);

  // ── Notification-scoped opp IDs (sidebar filters only, no display toggles) ──
  const notifFilteredOppIds = useMemo(() => {
    return new Set(filteredDataRaw.map((o: any) => String(o.opportunityId)));
  }, [filteredDataRaw]);

  useEffect(() => {
    useAppStore.getState().setNotifFilteredOppIds(notifFilteredOppIds);
  }, [notifFilteredOppIds]);

  // ── Staffing needs count (filtered by region) ──
  const totalStaffingNeedsCount = useMemo(() => {
    let count = 0;
    for (const [opportunityId, items] of Object.entries(allStaffingNeedsMap)) {
      if (filteredOppIds.size > 0 && !filteredOppIds.has(opportunityId)) continue;
      for (const n of items) count += (n as any).quantity || 1;
    }
    return count;
  }, [allStaffingNeedsMap, filteredOppIds]);

  // ── Memoized checks for sidebar filter state ──
  const isCompleteSegmentSelected = useMemo(() => {
    const selectedCodes = getIncludedValues(filters.subSegmentCodes);
    if (selectedCodes.length === 0) return false;

    const amdCodes = (filterOptions.subSegmentCodes || []).filter((code) =>
      SEGMENT_CODE_GROUPS.AMD.include.some((inc: string) => code.toUpperCase() === inc.toUpperCase())
    );

    const selectedAmdCodes = amdCodes.filter((code) => selectedCodes.includes(code));

    if (selectedAmdCodes.length > 0 && selectedAmdCodes.length < amdCodes.length) {
      return false;
    }

    if (selectedAmdCodes.length === amdCodes.length && amdCodes.length > 0) {
      return true;
    }

    return true;
  }, [filters.subSegmentCodes, filterOptions.subSegmentCodes]);

  const isCompleteUnitSelected = useMemo(() => {
    const selectedServiceLines = getIncludedValues(filters.serviceLine1);
    if (selectedServiceLines.length === 0) return false;

    let hasAtLeastOneCompleteUnit = false;

    for (const [groupKey, groupConfig] of Object.entries(SERVICE_LINE_GROUPS)) {
      const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line: string) => {
        const lineLower = line.toLowerCase();
        if (groupConfig.include) {
          return groupConfig.include.some((inc: string) => lineLower.includes(inc.toLowerCase()));
        } else if (groupConfig.exclude) {
          return !groupConfig.exclude.some((exc: string) => lineLower.includes(exc.toLowerCase()));
        }
        return false;
      });

      const selectedInGroup = groupServiceLines.filter((line: string) => selectedServiceLines.includes(line));

      if (selectedInGroup.length === 0) {
        continue;
      } else if (selectedInGroup.length === groupServiceLines.length) {
        hasAtLeastOneCompleteUnit = true;
      } else {
        return false;
      }
    }

    return hasAtLeastOneCompleteUnit;
  }, [filters.serviceLine1, filterOptions.serviceLine1]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Redirect root to /pipeline */}
      <Routes>
        <Route path="/" element={<Navigate to="/pipeline" replace />} />
        <Route path="*" element={null} />
      </Routes>
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          zIndex: 9999,
        }}
        onFocus={(e) => {
          e.target.style.position = "fixed";
          e.target.style.left = "16px";
          e.target.style.top = "16px";
          e.target.style.width = "auto";
          e.target.style.height = "auto";
          e.target.style.overflow = "visible";
          e.target.style.padding = "8px 16px";
          e.target.style.backgroundColor = brand.primary;
          e.target.style.color = "white";
          e.target.style.borderRadius = "4px";
          e.target.style.textDecoration = "none";
          e.target.style.fontWeight = "600";
        }}
        onBlur={(e) => {
          e.target.style.position = "absolute";
          e.target.style.left = "-9999px";
          e.target.style.width = "1px";
          e.target.style.height = "1px";
          e.target.style.overflow = "hidden";
        }}
      >
        Skip to main content
      </a>
      <Box sx={{ display: "flex", maxWidth: "100vw", overflowX: "hidden" }}>
        {/* Left Sidebar - Sub Segment Codes */}
        {dataReady && !isMobile && (
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Drawer
              variant="permanent"
              data-onboarding="sidebar"
              sx={{
                width: leftSidebarOpen ? LEFT_DRAWER_WIDTH : 0,
                flexShrink: 0,
                transition: "width 200ms ease",
                "& .MuiDrawer-paper": {
                  width: LEFT_DRAWER_WIDTH,
                  boxSizing: "border-box",
                  border: "none",
                  pt: "64px", // AppBar height
                  backgroundColor: darkMode ? "#241E1B" : "#E6DEDA",
                  transition: "transform 200ms ease",
                  transform: leftSidebarOpen ? "translateX(0)" : `translateX(-${LEFT_DRAWER_WIDTH}px)`,
                  overflow: "hidden",
                },
              }}
            >
              {tabReady ? <LeftSidebar activeTab={activeTab} /> : <SkeletonSidebar />}
            </Drawer>
            {/* Toggle button anchored to the right edge of the sidebar strip */}
            <IconButton
              onClick={toggleLeftSidebar}
              size="small"
              aria-label={leftSidebarOpen ? "Collapse left sidebar" : "Expand left sidebar"}
              sx={{
                position: "fixed",
                top: "50%",
                left: leftSidebarOpen ? LEFT_DRAWER_WIDTH - 12 : 0,
                transform: "translateY(-50%)",
                transition: "left 200ms ease",
                zIndex: (t) => t.zIndex.drawer + 2,
                width: 24,
                height: 48,
                borderRadius: "0 4px 4px 0",
                backgroundColor: "transparent",
                border: "none",
                "&:hover": {
                  backgroundColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                },
                color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
              }}
            >
              {leftSidebarOpen ? <ChevronLeftIcon sx={{ fontSize: 24 }} /> : <ChevronRightIcon sx={{ fontSize: 24 }} />}
            </IconButton>
          </Box>
        )}

        {/* Main content */}
        <Box
          sx={{
            flexGrow: 1,
            width: {
              xs: "100%",
              sm: `calc(100% - ${
                dataReady && !isMobile
                  ? (leftSidebarOpen ? LEFT_DRAWER_WIDTH : 0) + (rightSidebarOpen ? RIGHT_DRAWER_WIDTH : 0)
                  : 0
              }px)`,
            },
            maxWidth: "100vw",
            overflowX: "hidden",
            transition: "width 200ms ease",
          }}
        >
          {/* ── Mobile AppBar (phone only) ── */}
          {isPhone && (
            <MobileAppBar
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              activeTab={activeTab}
              activeFilterCount={activeFilterCount}
              onFilterOpen={() => setMobileFilterOpen(true)}
              onOverflowOpen={handleOverflowOpen}
              dataReady={dataReady}
            />
          )}

          {/* ── Desktop/Tablet AppBar with tabs ── */}
          {!isPhone && (
            <AppBar
              position="fixed"
              elevation={0}
              sx={{
                backgroundColor: "#330000",
                zIndex: (theme) => theme.zIndex.drawer + 1,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
              }}
            >
              <Toolbar
                disableGutters
                sx={{
                  py: 0.5,
                  px: { xs: 2, md: 3 },
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* Left side - Logo (click to toggle dark mode) */}
                <Box
                  display="flex"
                  alignItems="center"
                  role="button"
                  tabIndex={0}
                  aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  onClick={toggleDarkMode}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDarkMode();
                    }
                  }}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  sx={{
                    mr: 3,
                    cursor: "pointer",
                    transition: `transform ${timing.normal} ${easing.elegant}`,
                    "&:hover": {
                      transform: "scale(1.1)",
                    },
                  }}
                >
                  {/* BearingPoint Logo SVG */}
                  <svg width="42" height="37.5" viewBox="0 0 28 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_4452_398)">
                      <g clipPath="url(#clip1_4452_398)">
                        <path
                          d="M15.3383 11.8074C16.6369 10.6491 17.3389 8.89423 17.3389 6.96374C17.3389 3.03266 14.531 0.294922 10.3542 0.294922H0V24.8643H10.5999C15.1628 24.8643 18.2164 21.951 18.2164 17.6339C18.2164 15.1769 17.1634 12.9657 15.3383 11.8074ZM4.56287 4.22602H9.79266C11.6178 4.22602 12.7059 5.3843 12.7059 7.20942C12.7059 9.03463 11.5827 10.1928 9.82771 10.1928H4.56287V4.22602ZM10.1085 20.9332H4.56287V14.124H10.1085C12.2144 14.124 13.5834 15.3876 13.5834 17.5286C13.5834 19.6697 12.2847 20.9332 10.1085 20.9332Z"
                          fill={darkMode ? "#000000" : "white"}
                        />
                        <path
                          d="M22.9832 0.212891C20.7551 0.212891 18.9482 2.0198 18.9482 4.24789C18.9482 6.47598 20.7551 8.28286 22.9832 8.28286C25.2113 8.28286 27.0182 6.47598 27.0182 4.24789C27.0182 2.0198 25.2127 0.212891 22.9832 0.212891ZM22.9832 6.18396C21.9134 6.18396 21.0471 5.31631 21.0471 4.24789C21.0471 3.17947 21.9148 2.31182 22.9832 2.31182C24.0516 2.31182 24.9192 3.17947 24.9192 4.24789C24.9192 5.31631 24.0516 6.18396 22.9832 6.18396Z"
                          fill={darkMode ? "#000000" : "white"}
                        />
                      </g>
                    </g>
                    <defs>
                      <clipPath id="clip0_4452_398">
                        <rect width="27.3649" height="25" fill="white" />
                      </clipPath>
                      <clipPath id="clip1_4452_398">
                        <rect width="27.027" height="24.6597" fill="white" transform="translate(0 0.212891)" />
                      </clipPath>
                    </defs>
                  </svg>
                </Box>

                {/* Center - Tabs */}
                {dataReady && (
                  <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    aria-label="dashboard tabs"
                    data-onboarding="tabs"
                    sx={{
                      minHeight: 64,
                      "& .MuiTabs-indicator": {
                        backgroundColor: brand.primary,
                        height: 3,
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                        transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
                      },
                      "& .MuiTab-root": {
                        minHeight: 64,
                        px: 3,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.7)",
                        transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
                        "&:hover": {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          color: "white",
                          transform: "scale(1.05)",
                        },
                        "&.Mui-selected": {
                          color: "white",
                          filter: "drop-shadow(0 0 8px rgba(255,61,71,0.5))",
                        },
                      },
                      flexGrow: 0,
                    }}
                  >
                    <Tab
                      label="Pipeline"
                      icon={<TrendingUpRoundedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                    <Tab
                      label="Bookings"
                      icon={<TaskAltRoundedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                    <Tab
                      label="Staffing"
                      icon={<GroupsRoundedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                    <Tab
                      label="Project"
                      icon={<HubRoundedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                    <Tab
                      label="Recruitment"
                      icon={<PersonAddAltRoundedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                    <Tab
                      label="Mon Dashboard"
                      icon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: 20 }} />}
                      iconPosition="start"
                      sx={{ gap: 1 }}
                    />
                  </Tabs>
                )}

                {/* Demo toggle — always visible in header */}
                {!dataReady && (
                  <Box sx={{ position: "absolute", right: 12, display: "flex", alignItems: "center" }}>
                    <DemoToggle darkMode />
                  </Box>
                )}

                {/* Right side - Toggle switches and action buttons */}
                <AppBarActions
                  dataReady={dataReady}
                  activeTab={activeTab}
                  allOpportunityData={allOpportunityData}
                  setActiveTab={setActiveTab}
                  onSettingsOpen={() => setSettingsOpen(true)}
                  filteredOppIds={filteredOppIds}
                />
              </Toolbar>
            </AppBar>
          )}

          <Box
            id="main-content"
            component="main"
            role="main"
            aria-label="Dashboard content"
            sx={{
              flexGrow: 1,
              pt: isPhone ? "56px" : "80px", // 48px AppBar + 8px buffer on phone, 64px + 16px on desktop
              pb: isPhone ? "80px" : 3, // Room for BottomNav (56px + safe area) on phone
              px: isPhone ? 1.5 : 3,
              overflow: isPhone ? "hidden" : "visible",
              // Animated background gradient (disabled on phone for GPU savings)
              ...(!isPhone && {
                background:
                  "radial-gradient(ellipse at 20% 30%, rgba(255,61,71,0.03), transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(128,102,89,0.03), transparent 60%)",
                "@keyframes gradientShift": {
                  "0%": { backgroundPosition: "20% 50%" },
                  "50%": { backgroundPosition: "80% 50%" },
                  "100%": { backgroundPosition: "20% 50%" },
                },
                animation: "gradientShift 60s ease-in-out infinite",
              }),
              backgroundSize: "200% 200%",
            }}
          >
            {/* Skeleton — shown during loading */}
            {loading && <SkeletonDashboard />}
            {!dataReady ? (
              <LandingPage
                darkMode={darkMode}
                backendAvailable={backendAvailable}
                regions={regions}
                hydrating={hydrating}
                hydrationPercent={hydrationPercent}
                landingTab={landingTab}
                setLandingTab={setLandingTab}
                startHydration={startHydration}
              />
            ) : (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  opacity: loading ? 0 : 1,
                  visibility: loading ? "hidden" : "visible",
                  pointerEvents: loading ? "none" : "auto",
                }}
              >
                {tabReady && activeTab !== 2 && activeTab !== 3 && activeTab !== 4 && !isPhone && (
                  <Box
                    sx={{
                      mb: 3,
                      animation: "fadeIn 0.6s cubic-bezier(0.23, 1, 0.32, 1) both",
                      "@keyframes fadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                    }}
                  >
                    <FilterPanel
                      data={allOpportunityData}
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      showNetRevenue={showNetRevenue}
                      crmAccounts={crmAccounts}
                      manualAccounts={manualAccounts}
                      searchText={globalSearchText}
                      onSearchTextChange={setGlobalSearchText}
                    />
                  </Box>
                )}

                <TabRouter
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  loading={loading}
                  darkMode={darkMode}
                  isPhone={isPhone}
                  pipelineData={pipelineData}
                  bookingsData={bookingsData}
                  filteredData={filteredData}
                  allOpportunityData={allOpportunityData}
                  selectedOpportunities={selectedOpportunities}
                  setSelectedOpportunities={setSelectedOpportunities}
                  isCompleteUnitSelected={isCompleteUnitSelected}
                  handleNavigateToOpportunityByJobCode={handleNavigateToOpportunityByJobCode}
                  onTabReady={handleTabReady}
                  skeletonFallback={<SkeletonDashboard />}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Sidebar - Service Lines and Service Offerings */}
        {dataReady && !isMobile && (
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            {/* Toggle button anchored to the left edge of the sidebar strip */}
            <IconButton
              onClick={toggleRightSidebar}
              size="small"
              aria-label={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
              sx={{
                position: "fixed",
                top: "50%",
                right: rightSidebarOpen ? RIGHT_DRAWER_WIDTH - 12 : 0,
                transform: "translateY(-50%)",
                transition: "right 200ms ease",
                zIndex: (t) => t.zIndex.drawer + 2,
                width: 24,
                height: 48,
                borderRadius: "4px 0 0 4px",
                backgroundColor: "transparent",
                border: "none",
                "&:hover": {
                  backgroundColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                },
                color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
              }}
            >
              {rightSidebarOpen ? (
                <ChevronRightIcon sx={{ fontSize: 24 }} />
              ) : (
                <ChevronLeftIcon sx={{ fontSize: 24 }} />
              )}
            </IconButton>
            <Drawer
              variant="permanent"
              anchor="right"
              sx={{
                width: rightSidebarOpen ? RIGHT_DRAWER_WIDTH : 0,
                flexShrink: 0,
                transition: "width 200ms ease",
                "& .MuiDrawer-paper": {
                  width: RIGHT_DRAWER_WIDTH,
                  boxSizing: "border-box",
                  border: "none",
                  pt: "64px", // AppBar height
                  backgroundColor: darkMode ? "#241E1B" : "#E6DEDA",
                  transition: "transform 200ms ease",
                  transform: rightSidebarOpen ? "translateX(0)" : `translateX(${RIGHT_DRAWER_WIDTH}px)`,
                  overflow: "hidden",
                },
              }}
            >
              {tabReady ? <RightSidebar /> : <SkeletonSidebar />}
            </Drawer>
          </Box>
        )}
      </Box>

      {/* Floating Action Button Stack */}
      {dataReady && <FloatingActions isPhone={isPhone} totalStaffingNeedsCount={totalStaffingNeedsCount} />}

      <AppModals
        allOpportunityData={allOpportunityData}
        settingsOpen={settingsOpen}
        onSettingsClose={() => setSettingsOpen(false)}
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={notification.severity === "error" || notification.severity === "warning" ? 12000 : 5000}
        onClose={closeNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={closeNotification} severity={notification.severity} variant="filled" sx={{ width: "100%" }}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* ── NeedsBoardV2 floating PiP (global, cross-tab) ── */}
      {dataReady && staffingNeedsDrawerOpen && (
        <Suspense fallback={null}>
          <ErrorBoundary>
            <NeedsBoardV2
              open={staffingNeedsDrawerOpen}
              onClose={() => setStaffingNeedsDrawerOpen(false)}
              employees={staffingEmployees}
              isHoliday={(d: string) => PUBLIC_HOLIDAY_DATES.has(d)}
              pipelineJobcodes={null}
              opportunityData={filteredData || []}
              onOpenCreateModal={() => setCreateStaffingNeedModalOpen(true)}
              onOpenEditor={(prefill) => {
                useUIStore.getState().setBulkEditPrefill(prefill);
              }}
            />
          </ErrorBoundary>
        </Suspense>
      )}

      {/* Chat IA — only visible when data is loaded (not on landing page) */}
      {dataReady && !isPhone && (
        <Suspense fallback={null}>
          <ErrorBoundary>
            <ChatPanel />
          </ErrorBoundary>
        </Suspense>
      )}

      {/* ── Mobile Bottom Navigation ── */}
      {isPhone && dataReady && <MobileBottomNav activeTab={activeTab} onTabChange={handleMobileTabChange} />}

      {/* ── Mobile Overflow Drawer (toggles) ── */}
      {isPhone && (
        <AppBarOverflowDrawer
          open={overflowDrawerOpen}
          onClose={() => setOverflowDrawerOpen(false)}
          onOpen={() => setOverflowDrawerOpen(true)}
          showIO={showIO}
          toggleIO={toggleIO}
          showLost={showLost}
          toggleLost={toggleLost}
          isBookingsTab={activeTab === 1}
          showNetRevenue={showNetRevenue}
          toggleNetRevenue={toggleNetRevenue}
        />
      )}

      {/* ── Mobile Filter Modal (fullscreen filter access) ── */}
      {isPhone && (
        <MobileFilterModal open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} activeTab={activeTab} />
      )}
      <GlobalCardExport />

      {/* ── First-visit onboarding tour ── */}
      {dataReady && !isPhone && <OnboardingOverlay />}
    </ThemeProvider>
  );
}

export default App;
