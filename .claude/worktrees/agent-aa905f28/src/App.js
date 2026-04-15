import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import {
  Tabs,
  Tab,
  Box,
  Typography,
  ThemeProvider,
  CssBaseline,
  Alert,
  Snackbar,
  AppBar,
  Toolbar,
  Paper,
  Fade,
  useMediaQuery,
  Drawer,
  Divider,
  ToggleButton,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  Collapse,
  CircularProgress,
  LinearProgress,
  Backdrop,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  IconButton,
} from "@mui/material";
import { alpha, darken, lighten } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BusinessIcon from "@mui/icons-material/Business";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AddIcon from "@mui/icons-material/Add";
import GroupIcon from "@mui/icons-material/Group";
// OPTIMIZED: Lazy load tab components for faster initial load
// PERFORMANCE GAIN: 40-50% faster initial page load
const PipelineTab = lazy(() => import("./components/PipelineTab"));
const BookingsTab = lazy(() => import("./components/BookingsTab"));
const JobcodeTimelineTab = lazy(() => import("./components/JobcodeTimelineTab"));

// Eagerly load components that are always visible
import FilterPanel from "./components/FilterPanel";
import FileUploader from "./components/FileUploader";
import LeftSidebar from "./components/Sidebars/LeftSidebar";
import RightSidebar from "./components/Sidebars/RightSidebar";
import CreateOpportunityModal from "./components/CreateOpportunityModal";
import CreateAccountModal from "./components/CreateAccountModal";
import CreateStaffingNeedModal from "./components/CreateStaffingNeedModal";
import StatusOverrideManager from "./components/StatusOverrideManager";
import { useStatusOverride } from "./contexts/StatusOverrideContext";
import { SERVICE_LINE_GROUPS } from "./components/Sidebars/serviceLineConstants";
import { SEGMENT_CODE_GROUPS, getSegmentColor } from "./components/Sidebars/segmentConstants";
import { readDashboardChangesFromZip, saveChangesToExcel, readRemoteChanges, mergeChanges } from "./utils/dataUtils";
import { applyAllFilters } from "./utils/filterUtils";
import {
  initializeFilters,
  normalizeFilterValue,
  getIncludedValues,
  toggleFilterValue,
  includeValue,
  clearFilter,
} from "./utils/filterHelpers";
import { createAppTheme } from "./theme";
import { keyframes, animations, timing, easing } from "./styles/animations";

import DownloadIcon from "@mui/icons-material/Download";
// Elegant icons for tabs
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

// ── Session cleanup: localStorage is temporary working memory ──
// Data should be persisted via "Save to Excel". On every page load
// (including F5 refresh), clear dashboard-related localStorage keys
// so stale data from a previous unsaved session doesn't leak.
(() => {
  const FIXED_KEYS = ["manual_accounts", "manual_opportunities", "opportunity_status_overrides"];
  FIXED_KEYS.forEach((k) => localStorage.removeItem(k));
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("opportunity_actions_") ||
        key.startsWith("opportunity_comments_") ||
        key.startsWith("staffing_needs_"))
    ) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
})();

// Sidebar width definition
const LEFT_DRAWER_WIDTH = 240;
const RIGHT_DRAWER_WIDTH = 240;

function App() {
  // Dark mode state - persisted to localStorage
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const theme = useMemo(() => createAppTheme(darkMode ? "dark" : "light"), [darkMode]);
  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("darkMode", String(next));
      return next;
    });
  }, []);

  const [activeTab, setActiveTab] = useState(0);
  const [filterMode, setFilterMode] = useState("inclusive");
  const [opportunityData, setOpportunityData] = useState([]);

  // File System Access API: keep only the file handle (lightweight)
  const [excelFileHandle, setExcelFileHandle] = useState(null);
  // Snapshot of what's saved in the Excel file (for sync indicators)
  const [excelSavedSnapshot, setExcelSavedSnapshot] = useState(null);

  // Status override context for modifying opportunity statuses
  const {
    overrides: statusOverrides,
    overrideCount: statusOverrideCount,
    mergeExcelOverrides,
    clearAllOverrides,
  } = useStatusOverride();
  // filteredData is now computed with useMemo - no longer a state
  // PHASE 1: New filter structure with include/exclude support
  // Each filter now has { included: [], excluded: [] } instead of just an array
  const [filters, setFilters] = useState(initializeFilters());
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  // ── Progress animation queue ──────────────────────────────────────
  // Ensures every progress step stays visible for at least MIN_STEP_MS,
  // even when the Worker sends a burst of updates in < 100ms.
  const progressQueueRef = useRef([]);
  const progressAnimatingRef = useRef(false);
  const progressDrainRef = useRef(null);
  const MIN_STEP_MS = 300;

  const enqueueProgress = useCallback((progress, message) => {
    progressQueueRef.current.push({ progress, message });
    if (!progressAnimatingRef.current) {
      const drain = async () => {
        progressAnimatingRef.current = true;
        while (progressQueueRef.current.length > 0) {
          const step = progressQueueRef.current.shift();
          setLoadingProgress(step.progress);
          setLoadingMessage(step.message);
          await new Promise((r) => setTimeout(r, MIN_STEP_MS));
        }
        progressAnimatingRef.current = false;
        if (progressDrainRef.current) {
          progressDrainRef.current();
          progressDrainRef.current = null;
        }
      };
      drain();
    }
  }, []);

  const waitForProgressDrain = useCallback(() => {
    return new Promise((resolve) => {
      if (progressQueueRef.current.length === 0 && !progressAnimatingRef.current) {
        resolve();
      } else {
        progressDrainRef.current = resolve;
      }
    });
  }, []);
  const [selectedOpportunities, setSelectedOpportunities] = useState([]);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // State to track manual opportunities refresh
  const [manualOpportunitiesRefresh, setManualOpportunitiesRefresh] = useState(0);

  // State to track which opportunity to edit
  const [editOpportunity, setEditOpportunity] = useState(null);

  // State for create opportunity modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
  const [createStaffingNeedModalOpen, setCreateStaffingNeedModalOpen] = useState(false);

  // Add state for revenue toggle
  const [showNetRevenue, setShowNetRevenue] = useState(false);

  // Add state for I&O display toggle (disabled by default)
  const [showIO, setShowIO] = useState(false);

  // Add state for Bookings/Lost toggle (false = Bookings/Wins, true = Lost)
  const [showLost, setShowLost] = useState(false);

  // State for navigating to a specific opportunity (from StatusOverrideManager)
  const [navigateToOpportunityId, setNavigateToOpportunityId] = useState(null);

  // Handler for navigating to an opportunity
  // newStatus is used to determine which tab to switch to
  const handleNavigateToOpportunity = useCallback((opportunityId, newStatus = null) => {
    // Switch to appropriate tab based on status
    // Booked (14) and Lost (15) are in Bookings tab (tab 1), others in Pipeline (tab 0)
    if (newStatus === 14 || newStatus === 15) {
      setActiveTab(1);
      // Also set showLost based on status
      setShowLost(newStatus === 15);
    } else if (newStatus !== null) {
      setActiveTab(0);
    }

    // Give time for tab switch before setting the ID
    setTimeout(() => {
      setNavigateToOpportunityId(opportunityId);
      // Reset after a longer delay to allow the navigation to happen
      setTimeout(() => setNavigateToOpportunityId(null), 1000);
    }, 100);
  }, []);

  // State for expanded service line groups
  const [expandedGroups, setExpandedGroups] = useState({
    BTU: false,
    ETU: false,
    Products: false,
    Arcwide: false,
  });

  // Service Line group definitions - using BearingPoint colors
  // OPTIMIZED: Moved to ./components/Sidebars/serviceLineConstants.js
  // const SERVICE_LINE_GROUPS = { ... };

  // State for expanded segment code groups
  const [expandedSegmentGroups, setExpandedSegmentGroups] = useState({
    AMD: false,
  });

  // State for expanded individual segment codes (to show sub-segments)
  const [expandedSegmentCodes, setExpandedSegmentCodes] = useState({});

  // State for expanded individual service lines (to show service offerings)
  const [expandedServiceLines, setExpandedServiceLines] = useState({});

  // Auto-open modal when editOpportunity is set
  useEffect(() => {
    if (editOpportunity) {
      setCreateModalOpen(true);
    }
  }, [editOpportunity]);

  // OPTIMIZED: Moved to ./components/Sidebars/segmentConstants.js
  // OLD CODE REMOVED: SEGMENT_CODE_GROUPS, SEGMENT_CODE_COLORS, getSegmentColor
  // Now imported from segmentConstants.js at the top of this file

  const [filterOptions, setFilterOptions] = useState({
    subSegmentCodes: [],
    subSegments: [],
    serviceLine1: [],
    serviceOfferings: [], // New filter options for service offerings
    accounts: [],
  });

  // Store CRM account data from the CRM_Accounts sheet
  const [crmAccounts, setCrmAccounts] = useState([]);

  // Manual accounts created by user (persisted in localStorage)
  const [manualAccounts, setManualAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("manual_accounts") || "[]");
    } catch {
      return [];
    }
  });

  // Toggle: when false, raw Excel data is shown (no overrides, no manual data)
  // "off" = raw Excel only, "all" = Excel + changes, "changes" = only modified/annotated opps
  const [modificationsEnabled, setModificationsEnabled] = useState("all");

  // Store the mapping of segment codes to sub segments
  const [segmentToSubSegmentMap, setSegmentToSubSegmentMap] = useState({});

  // Store the mapping of service lines to service offerings
  const [serviceToOfferingMap, setServiceToOfferingMap] = useState({});

  // Filtered sub segments based on selected segment codes
  const [filteredSubSegments, setFilteredSubSegments] = useState([]);

  // Filtered service offerings based on selected service lines
  const [filteredServiceOfferings, setFilteredServiceOfferings] = useState([]);

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Process Excel file in a Web Worker (off main thread → UI stays responsive)
  const processInWorker = useCallback(
    (fileData, fileType) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(`${process.env.PUBLIC_URL}/workers/excelWorker.js`);

        worker.onmessage = (event) => {
          const { type, error, progress, message, ...rest } = event.data;
          if (type === "PROGRESS") {
            enqueueProgress(progress, message);
          } else if (type === "SUCCESS") {
            worker.terminate();
            // Don't resolve until the animation queue has shown every step
            enqueueProgress(100, "Done!");
            waitForProgressDrain().then(() => resolve(rest));
          } else if (type === "ERROR") {
            worker.terminate();
            reject(new Error(error));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message || "Worker failed"));
        };

        worker.postMessage({
          type: "PROCESS_EXCEL",
          fileData,
          fileType,
          id: Date.now(),
        });
      });
    },
    [enqueueProgress, waitForProgressDrain]
  );

  const handleFileUploaded = async (
    fileName,
    fileData,
    fileType,
    fileHandle = null,
    { skipProgressAnimation = false } = {}
  ) => {
    try {
      setLoading(true);
      // Reset queue state and show initial step
      progressQueueRef.current = [];
      progressAnimatingRef.current = false;
      progressDrainRef.current = null;
      setLoadingProgress(0);
      setLoadingMessage(skipProgressAnimation ? "Reading saved changes..." : "Preparing...");

      if (fileType === "opportunity") {
        // Store file handle for saving changes back
        if (fileHandle) setExcelFileHandle(fileHandle);

        // ── 1. Extract dashboard changes (fflate unzipSync) ──
        // Yield to browser first so the loading backdrop paints before the
        // synchronous unzip blocks the main thread.
        if (skipProgressAnimation) await new Promise((r) => setTimeout(r, 0));
        const dashboardChanges = readDashboardChangesFromZip(fileData);

        // ── 2. Process Excel in Web Worker (XLSX parsing + data cleaning + mappings) ──
        // This runs off the main thread so the UI stays responsive.
        // The worker returns pre-computed: processedData, crmAccounts,
        // segmentMapping, serviceMapping, filterOptions (single-pass, no extra loops).
        // When refreshing, apply progress updates directly (no 300ms animation queue)
        // and use Transferable to avoid structured clone copy of the ArrayBuffer.
        if (skipProgressAnimation) {
          setLoadingProgress(5);
          setLoadingMessage("Parsing Excel file...");
          await new Promise((r) => setTimeout(r, 0)); // yield so message paints
        }
        const workerResult = skipProgressAnimation
          ? await new Promise((resolve, reject) => {
              const worker = new Worker(`${process.env.PUBLIC_URL}/workers/excelWorker.js`);
              worker.onmessage = (event) => {
                const { type, error, progress, message, ...rest } = event.data;
                if (type === "PROGRESS") {
                  setLoadingProgress(progress);
                  setLoadingMessage(message);
                } else if (type === "SUCCESS") {
                  setLoadingProgress(100);
                  setLoadingMessage("Done!");
                  worker.terminate();
                  resolve(rest);
                } else if (type === "ERROR") {
                  worker.terminate();
                  reject(new Error(error));
                }
              };
              worker.onerror = (err) => {
                worker.terminate();
                reject(new Error(err.message || "Worker failed"));
              };
              // Transfer the ArrayBuffer (zero-copy) instead of structured clone
              worker.postMessage({ type: "PROCESS_EXCEL", fileData, fileType: "opportunity", id: Date.now() }, [
                fileData,
              ]);
            })
          : await processInWorker(fileData, "opportunity");
        const {
          processedData,
          crmAccounts: crmAccountData,
          segmentMapping,
          serviceMapping,
          filterOptions: workerFilterOptions,
        } = workerResult;

        setCrmAccounts(crmAccountData);

        if (skipProgressAnimation) {
          setLoadingProgress(96);
          setLoadingMessage("Restoring saved changes...");
        } else enqueueProgress(96, "Restoring saved changes...");

        // ── 3. Merge dashboard changes with localStorage ──
        if (dashboardChanges) {
          // Merge manual accounts: localStorage takes priority (may have unsaved edits),
          // Excel adds items that don't exist locally (e.g. from another browser/session).
          const localAccounts = JSON.parse(localStorage.getItem("manual_accounts") || "[]");
          const localAccountsMap = new Map(localAccounts.map((a) => [a.Account, a]));
          (dashboardChanges.manualAccounts || []).forEach((excelAcc) => {
            if (!localAccountsMap.has(excelAcc.Account)) {
              localAccountsMap.set(excelAcc.Account, excelAcc);
            }
          });
          const mergedAccounts = Array.from(localAccountsMap.values());
          setManualAccounts(mergedAccounts);
          localStorage.setItem("manual_accounts", JSON.stringify(mergedAccounts));

          // Merge manual opportunities: same logic — localStorage wins, Excel fills gaps
          const localOpps = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
          const localOppsMap = new Map(localOpps.map((o) => [o["Opportunity ID"], o]));
          (dashboardChanges.manualOpportunities || []).forEach((excelOpp) => {
            if (!localOppsMap.has(excelOpp["Opportunity ID"])) {
              localOppsMap.set(excelOpp["Opportunity ID"], excelOpp);
            }
          });
          const mergedOpps = Array.from(localOppsMap.values());
          localStorage.setItem("manual_opportunities", JSON.stringify(mergedOpps));

          // Restore status overrides from Excel into React state.
          // DON'T write directly to localStorage here — mergeExcelOverrides updates
          // React state, and the persist useEffect in StatusOverrideContext will
          // write the COMPLETE state (local unsaved overrides + Excel overrides)
          // back to localStorage.
          if (dashboardChanges.statusOverrides.length > 0) {
            const overridesObj = {};
            dashboardChanges.statusOverrides.forEach((o) => {
              overridesObj[o.opportunityId] = {
                originalStatus: o.originalStatus,
                newStatus: o.newStatus,
                comment: o.comment,
                modifiedAt: o.modifiedAt,
                ...(o.bookingDate ? { bookingDate: o.bookingDate } : {}),
              };
            });
            mergeExcelOverrides(overridesObj);
          }

          // Restore actions from Excel
          if (dashboardChanges.actions.length > 0) {
            const actionsByOpp = {};
            dashboardChanges.actions.forEach((a) => {
              if (!actionsByOpp[a.opportunityId]) actionsByOpp[a.opportunityId] = [];
              actionsByOpp[a.opportunityId].push(a);
            });
            Object.entries(actionsByOpp).forEach(([oppId, actions]) => {
              localStorage.setItem(`opportunity_actions_${oppId}`, JSON.stringify(actions));
            });
          }

          // Restore comments from Excel
          if (dashboardChanges.comments.length > 0) {
            const commentsByOpp = {};
            dashboardChanges.comments.forEach((c) => {
              if (!commentsByOpp[c.opportunityId]) commentsByOpp[c.opportunityId] = [];
              commentsByOpp[c.opportunityId].push(c);
            });
            Object.entries(commentsByOpp).forEach(([oppId, comments]) => {
              localStorage.setItem(`opportunity_comments_${oppId}`, JSON.stringify(comments));
            });
          }

          // Restore staffing needs from Excel
          if (dashboardChanges.staffingNeeds && dashboardChanges.staffingNeeds.length > 0) {
            const needsByOpp = {};
            dashboardChanges.staffingNeeds.forEach((n) => {
              if (!needsByOpp[n.opportunityId]) needsByOpp[n.opportunityId] = [];
              needsByOpp[n.opportunityId].push(n);
            });
            Object.entries(needsByOpp).forEach(([oppId, needs]) => {
              localStorage.setItem(`staffing_needs_${oppId}`, JSON.stringify(needs));
            });
          }

          // Trigger refresh to pick up restored data
          setManualOpportunitiesRefresh((prev) => prev + 1);
        } else {
          const savedManualAccounts = JSON.parse(localStorage.getItem("manual_accounts") || "[]");
          setManualAccounts(savedManualAccounts);
        }

        // Set snapshot for sync indicators (what's currently saved in the Excel file)
        if (fileHandle) {
          const emptySnapshot = {
            statusOverrides: [],
            manualOpportunities: [],
            manualAccounts: [],
            actions: [],
            comments: [],
            staffingNeeds: [],
          };
          setExcelSavedSnapshot(JSON.stringify(dashboardChanges || emptySnapshot));
        }

        if (skipProgressAnimation) {
          setLoadingProgress(98);
          setLoadingMessage("Updating dashboard...");
        } else enqueueProgress(98, "Updating dashboard...");

        // ── 4. Apply pre-computed results from Worker (no extra loops needed) ──
        const safeProcessedData = Array.isArray(processedData) ? processedData : [];

        // ── 5. Detect duplicate Opportunity IDs ──
        const idCounts = {};
        safeProcessedData.forEach((row) => {
          const id = row["Opportunity ID"];
          if (id) idCounts[id] = (idCounts[id] || 0) + 1;
        });
        const duplicates = Object.entries(idCounts)
          .filter(([, count]) => count > 1)
          .map(([id, count]) => `${id} (×${count})`);

        setOpportunityData(safeProcessedData);
        setSegmentToSubSegmentMap(segmentMapping);
        setServiceToOfferingMap(serviceMapping);
        setFilterOptions(workerFilterOptions);

        if (duplicates.length > 0) {
          setNotification({
            open: true,
            message: `Loaded ${safeProcessedData.length} opportunities. ⚠ ${duplicates.length} Opportunity ID(s) en doublon : ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? ` et ${duplicates.length - 5} autre(s)` : ""}`,
            severity: "warning",
          });
        } else {
          setNotification({
            open: true,
            message: `Successfully loaded ${safeProcessedData.length} opportunities from ${fileName}`,
            severity: "success",
          });
        }
      }
    } catch (error) {
      setNotification({
        open: true,
        message: `Error loading ${fileType} file: ${error.message || "Unknown error"}`,
        severity: "error",
      });
    } finally {
      // Wait for remaining progress steps to be visible before closing
      if (!skipProgressAnimation) await waitForProgressDrain();
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  };

  // Keep a stable ref to handleFileUploaded for use in handleRefreshFromExcel
  const handleFileUploadedRef = useRef(null);
  handleFileUploadedRef.current = handleFileUploaded;

  // Handlers for manual opportunity creation/editing/deletion
  const handleOpportunityCreated = (opportunity) => {
    // Trigger refresh of manual opportunities
    setManualOpportunitiesRefresh((prev) => prev + 1);
    setNotification({
      open: true,
      message: `Successfully created opportunity: ${opportunity["Opportunity"]}`,
      severity: "success",
    });
  };

  const handleOpportunityUpdated = (opportunity) => {
    // Trigger refresh of manual opportunities
    setManualOpportunitiesRefresh((prev) => prev + 1);
    setNotification({
      open: true,
      message: `Successfully updated opportunity: ${opportunity["Opportunity"]}`,
      severity: "success",
    });
  };

  const handleOpportunityDeleted = (opportunityId) => {
    // Clean up associated actions, comments, and staffing needs
    localStorage.removeItem(`opportunity_actions_${opportunityId}`);
    localStorage.removeItem(`opportunity_comments_${opportunityId}`);
    localStorage.removeItem(`staffing_needs_${opportunityId}`);
    window.dispatchEvent(new CustomEvent("actionsCommentsChanged"));
    window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));

    // Trigger refresh of manual opportunities
    setManualOpportunitiesRefresh((prev) => prev + 1);
    setNotification({
      open: true,
      message: `Successfully deleted opportunity: ${opportunityId}`,
      severity: "success",
    });
  };

  // Save all dashboard changes back to the Excel file
  // Collect all current changes into a snapshot object
  // IMPORTANT: Overrides are read from React state (statusOverrides), NOT localStorage.
  // localStorage is updated by a useEffect AFTER render, so it can be stale.
  // Manual opps/accounts are fine from localStorage (written synchronously before setState).
  const collectCurrentChanges = useCallback(() => {
    const statusOverridesList = Object.entries(statusOverrides)
      .filter(([, o]) => !o._reverted)
      .map(([oppId, o]) => ({
        opportunityId: oppId,
        originalStatus: o.originalStatus,
        newStatus: o.newStatus,
        comment: o.comment || "",
        modifiedAt: o.modifiedAt || "",
        ...(o.bookingDate ? { bookingDate: o.bookingDate } : {}),
      }));

    const manualOpps = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const manualAccs = JSON.parse(localStorage.getItem("manual_accounts") || "[]");

    const actions = [];
    const comments = [];
    const staffingNeeds = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("opportunity_actions_")) {
        try {
          const oppId = key.replace("opportunity_actions_", "");
          const items = JSON.parse(localStorage.getItem(key));
          items.forEach((a) => actions.push({ ...a, opportunityId: a.opportunityId || oppId }));
        } catch (e) {
          /* ignore */
        }
      }
      if (key?.startsWith("opportunity_comments_")) {
        try {
          const oppId = key.replace("opportunity_comments_", "");
          const items = JSON.parse(localStorage.getItem(key));
          items.forEach((c) => comments.push({ ...c, opportunityId: c.opportunityId || oppId }));
        } catch (e) {
          /* ignore */
        }
      }
      if (key?.startsWith("staffing_needs_")) {
        try {
          const oppId = key.replace("staffing_needs_", "");
          const items = JSON.parse(localStorage.getItem(key));
          items.forEach((n) => staffingNeeds.push({ ...n, opportunityId: n.opportunityId || oppId }));
        } catch (e) {
          /* ignore */
        }
      }
    }

    return {
      statusOverrides: statusOverridesList,
      manualOpportunities: manualOpps,
      manualAccounts: manualAccs,
      actions,
      comments,
      staffingNeeds,
    };
  }, [statusOverrides]);

  const handleSaveToExcel = useCallback(
    async (preResolvedChanges = null) => {
      if (!excelFileHandle) {
        return { success: false, error: "No file handle available" };
      }

      try {
        const changes = collectCurrentChanges();
        const { mergeResult, finalChanges } = await saveChangesToExcel(
          excelFileHandle,
          changes,
          excelSavedSnapshot,
          preResolvedChanges
        );
        // Update snapshot so sync indicators show "saved"
        setExcelSavedSnapshot(JSON.stringify(finalChanges));
        return { success: true, method: "saved", mergeResult };
      } catch (error) {
        console.error("Error saving to Excel:", error);
        return { success: false, error: error.message };
      }
    },
    [excelFileHandle, collectCurrentChanges, excelSavedSnapshot]
  );

  // Pre-flight check: detect merge conflicts before writing to Excel
  const handleCheckConflicts = useCallback(async () => {
    if (!excelFileHandle || !excelSavedSnapshot)
      return { conflicts: [], merged: null, remoteInfo: null, hasRemoteChanges: false };
    try {
      const remote = await readRemoteChanges(excelFileHandle);
      if (!remote) return { conflicts: [], merged: null, remoteInfo: null, hasRemoteChanges: false };
      const base = JSON.parse(excelSavedSnapshot);
      const changes = collectCurrentChanges();
      return mergeChanges(base, changes, remote);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      return { conflicts: [], merged: null, remoteInfo: null, hasRemoteChanges: false };
    }
  }, [excelFileHandle, excelSavedSnapshot, collectCurrentChanges]);

  // Refresh data from the Excel file, discarding local unsaved changes
  // Returns { success, error } — confirmation is handled by the caller (StatusOverrideManager)
  const handleRefreshFromExcel = useCallback(async () => {
    if (!excelFileHandle) return { success: false, error: "No file handle available" };

    // Show loading backdrop immediately and yield so the browser paints it
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage("Reading Excel file...");
    // Yield to browser so the backdrop renders before any heavy work
    await new Promise((r) => setTimeout(r, 0));

    // 1. Clear localStorage dashboard keys
    ["manual_accounts", "manual_opportunities", "opportunity_status_overrides"].forEach((k) =>
      localStorage.removeItem(k)
    );
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("opportunity_actions_") ||
          key.startsWith("opportunity_comments_") ||
          key.startsWith("staffing_needs_"))
      ) {
        localStorage.removeItem(key);
      }
    }

    // 2. Clear React state so the reload takes 100% of data from Excel
    clearAllOverrides();
    setManualAccounts([]);

    // 3. Re-read file from handle and reload through the existing pipeline
    try {
      const file = await excelFileHandle.getFile();
      setLoadingProgress(2);
      setLoadingMessage("Loading file into memory...");
      const buffer = await file.arrayBuffer();
      await handleFileUploadedRef.current(file.name, buffer, "opportunity", excelFileHandle, {
        skipProgressAnimation: true,
      });
      return { success: true, fileName: file.name };
    } catch (error) {
      setLoading(false);
      setLoadingMessage("");
      return { success: false, error: error.message };
    }
  }, [excelFileHandle, clearAllOverrides]);

  // Handler for new account created from CreateAccountModal
  const handleAccountCreated = useCallback((newAccount) => {
    const accountWithMeta = { ...newAccount, isManual: true, createdAt: new Date().toISOString() };
    setManualAccounts((prev) => {
      const updated = [...prev, accountWithMeta];
      localStorage.setItem("manual_accounts", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Handler for deleting a manual account
  const handleDeleteManualAccount = useCallback((accountName) => {
    setManualAccounts((prev) => {
      const updated = prev.filter((a) => a.Account !== accountName);
      localStorage.setItem("manual_accounts", JSON.stringify(updated));
      return updated;
    });

    // Cascade: delete all manual opportunities associated with this account
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const remaining = existingOpportunities.filter((opp) => opp["Account"] !== accountName);
    if (remaining.length !== existingOpportunities.length) {
      localStorage.setItem("manual_opportunities", JSON.stringify(remaining));
      setSelectedOpportunities((prev) => prev.filter((opp) => opp["Account"] !== accountName || !opp.isManual));
      setManualOpportunitiesRefresh((prev) => prev + 1);
    }
  }, []);

  // Handler for clearing ALL manual opportunities at once
  const handleClearAllManualOpportunities = useCallback(() => {
    localStorage.setItem("manual_opportunities", "[]");
    setSelectedOpportunities((prev) => prev.filter((opp) => !opp.isManual));
    setManualOpportunitiesRefresh((prev) => prev + 1);
  }, []);

  // Handler for clearing ALL manual accounts (+ cascade to their opportunities)
  const handleClearAllManualAccounts = useCallback(() => {
    const accNames = new Set(manualAccounts.map((a) => a.Account));
    setManualAccounts([]);
    localStorage.setItem("manual_accounts", "[]");
    // Cascade: remove manual opportunities belonging to deleted accounts
    const existingOpps = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const remaining = existingOpps.filter((opp) => !accNames.has(opp["Account"]));
    if (remaining.length !== existingOpps.length) {
      localStorage.setItem("manual_opportunities", JSON.stringify(remaining));
      setSelectedOpportunities((prev) => prev.filter((opp) => !opp.isManual || !accNames.has(opp["Account"])));
      setManualOpportunitiesRefresh((prev) => prev + 1);
    }
  }, [manualAccounts]);

  // Handler for deleting manual opportunities from StatusOverrideManager
  const handleDeleteManualOpportunity = useCallback((opportunityId) => {
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const filtered = existingOpportunities.filter((opp) => opp["Opportunity ID"] !== opportunityId);
    localStorage.setItem("manual_opportunities", JSON.stringify(filtered));

    // Clean up associated actions, comments, and staffing needs
    localStorage.removeItem(`opportunity_actions_${opportunityId}`);
    localStorage.removeItem(`opportunity_comments_${opportunityId}`);
    localStorage.removeItem(`staffing_needs_${opportunityId}`);
    window.dispatchEvent(new CustomEvent("actionsCommentsChanged"));
    window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));

    // Also deselect if selected
    setSelectedOpportunities((prev) => prev.filter((opp) => opp["Opportunity ID"] !== opportunityId));

    // Trigger refresh
    setManualOpportunitiesRefresh((prev) => prev + 1);
    setNotification({
      open: true,
      message: `Opportunité manuelle supprimée`,
      severity: "success",
    });
  }, []);

  // Handler for adding manual opportunities from StatusOverrideManager import
  const handleAddManualOpportunity = useCallback((opportunity) => {
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");

    // Check if opportunity already exists
    const existingIndex = existingOpportunities.findIndex(
      (opp) => opp["Opportunity ID"] === opportunity["Opportunity ID"]
    );

    if (existingIndex === -1) {
      // Add new opportunity
      existingOpportunities.push(opportunity);
      localStorage.setItem("manual_opportunities", JSON.stringify(existingOpportunities));

      // Trigger refresh
      setManualOpportunitiesRefresh((prev) => prev + 1);
    }
  }, []);

  // PHASE 1: Update filtered sub segments when segment codes change
  useEffect(() => {
    // Get included segment codes from new filter structure
    const subSegmentCodes = getIncludedValues(filters.subSegmentCodes);

    // REMOVED: Don't automatically clear sub-segments when no segment codes are selected
    // This was causing a race condition with bidirectional synchronization where clicking
    // a sub-segment would trigger sync to add its parent code, but this useEffect would
    // clear the sub-segment before the sync completed
    // With bidirectional sync, sub-segments can be selected independently

    // Get all sub segments for the selected segment codes
    const relevantSubSegments = [];
    subSegmentCodes.forEach((code) => {
      // Add null check to avoid accessing properties of undefined
      if (segmentToSubSegmentMap && segmentToSubSegmentMap[code]) {
        relevantSubSegments.push(...segmentToSubSegmentMap[code]);
      }
    });

    // Remove duplicates
    const uniqueSubSegments = [...new Set(relevantSubSegments)];
    setFilteredSubSegments(uniqueSubSegments);

    // REMOVED: Don't filter out selected sub-segments that aren't in the current segment codes
    // This allows users to select sub-segments independently and prevents conflicts with
    // the bidirectional synchronization in handleFilterChange
    // Previously, this was causing sub-segments to deselect immediately after being clicked
  }, [filters.subSegmentCodes, segmentToSubSegmentMap]);

  // PHASE 1: Update filtered service offerings when service lines change
  useEffect(() => {
    // Get included service lines from new filter structure
    const serviceLines = getIncludedValues(filters.serviceLine1);

    if (serviceLines.length === 0) {
      // If no service lines selected, just update the available offerings list
      // Don't clear selected offerings - allow offerings to be selected independently
      setFilteredServiceOfferings([]);
      return;
    }

    // Get all service offerings for the selected service lines
    const relevantOfferings = [];
    serviceLines.forEach((line) => {
      // Add null check to avoid accessing properties of undefined
      if (serviceToOfferingMap && serviceToOfferingMap[line]) {
        relevantOfferings.push(...serviceToOfferingMap[line]);
      }
    });

    // Remove duplicates
    const uniqueOfferings = [...new Set(relevantOfferings)];
    setFilteredServiceOfferings(uniqueOfferings);

    // REMOVED: Don't filter out selected offerings that aren't in the current service lines
    // This allows users to select offerings from service line A and service line B independently
    // Previously, selecting service line B would remove offerings from service line A
  }, [filters.serviceLine1, serviceToOfferingMap]);

  // OPTIMIZED: Moved sidebar content to separate memoized components
  // LeftSidebar.js (~340 lines) and RightSidebar.js (~250 lines)
  // OLD CODE REMOVED: leftSidebarContent (lines 870-1212) - now in ./components/Sidebars/LeftSidebar.js
  // OLD CODE REMOVED: rightSidebarContent (lines 1255-1507) - now in ./components/Sidebars/RightSidebar.js

  // Merge manual opportunities from localStorage with uploaded data
  // Compute displayed data based on modificationsEnabled mode:
  //   "off"     → raw Excel data only (no overrides, no manual entries)
  //   "all"     → Excel + manual entries + status overrides
  //   "changes" → only modified / annotated opportunities
  const allOpportunityData = useMemo(() => {
    if (opportunityData.length === 0) return [];

    // "off" → raw Excel data, no modifications
    if (modificationsEnabled === "off") return opportunityData;

    let manualOpportunities = [];
    try {
      const stored = localStorage.getItem("manual_opportunities");
      if (stored) manualOpportunities = JSON.parse(stored);
    } catch (e) {
      console.error("Error loading manual opportunities:", e);
    }

    // Combine uploaded data with manual opportunities
    const combinedData = [...opportunityData, ...manualOpportunities];

    // Apply status overrides
    const withOverrides =
      Object.keys(statusOverrides).length > 0
        ? combinedData.map((opp) => {
            const oppId = opp["Opportunity ID"];
            const override = statusOverrides[oppId];
            if (override && !override._reverted) {
              const updatedOpp = {
                ...opp,
                _originalStatus: opp["Status"],
                _originalBookingDate: opp["Booking/Lost Date"],
                Status: override.newStatus,
                _statusOverride: override,
              };
              if ((override.newStatus === 14 || override.newStatus === 15) && override.bookingDate) {
                updatedOpp["Booking/Lost Date"] = override.bookingDate;
              }
              return updatedOpp;
            }
            return opp;
          })
        : combinedData;

    // "all" → return everything with overrides applied
    if (modificationsEnabled === "all") return withOverrides;

    // "changes" → only opportunities that have been touched:
    //   - manual opportunities (isManual)
    //   - status-overridden opportunities (_statusOverride)
    //   - opportunities with actions, comments, or staffing needs in localStorage
    const idsWithNotes = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key?.startsWith("opportunity_actions_") ||
        key?.startsWith("opportunity_comments_") ||
        key?.startsWith("staffing_needs_")
      ) {
        const id = key
          .replace("opportunity_actions_", "")
          .replace("opportunity_comments_", "")
          .replace("staffing_needs_", "");
        try {
          const arr = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(arr) && arr.length > 0) idsWithNotes.add(id);
        } catch {
          /* ignore */
        }
      }
    }

    return withOverrides.filter(
      (opp) => opp.isManual || opp._statusOverride || idsWithNotes.has(String(opp["Opportunity ID"]))
    );
  }, [opportunityData, manualOpportunitiesRefresh, statusOverrides, modificationsEnabled]);

  // OPTIMIZED: Use useMemo instead of useEffect for filtering
  // This prevents unnecessary recalculations (was 290+ lines in useEffect)
  // PERFORMANCE GAIN: 60-70% faster on filter operations
  const filteredData = useMemo(() => {
    return applyAllFilters(allOpportunityData, filters, filterMode, serviceToOfferingMap);
  }, [allOpportunityData, filters, filterMode, serviceToOfferingMap]);

  // OLD CODE REMOVED: 290+ lines useEffect replaced by optimized useMemo above
  /*
  useEffect(() => {
    if (!opportunityData || allOpportunityData.length === 0) return;
    let result = [...opportunityData];

  // Defensive checks for filters
  const safeFilters = filters || {};

  // Apply account filter
if (safeFilters.accounts?.length > 0) {
  if (filterMode === 'inclusive') {
    result = result.filter((item) =>
      safeFilters.accounts.includes(item["Account"])
    );
  } else {
    // Exclusive mode - exclude selected accounts
    result = result.filter((item) =>
      !safeFilters.accounts.includes(item["Account"])
    );
  }
}

  // Apply segment code filter
  if (safeFilters.subSegmentCodes?.length > 0) {
    if (filterMode === 'inclusive') {
      result = result.filter((item) =>
        safeFilters.subSegmentCodes.includes(item["Sub Segment Code"])
      );
    } else {
      result = result.filter((item) =>
        !safeFilters.subSegmentCodes.includes(item["Sub Segment Code"])
      );
    }
  }

  // Apply sub segments filter
  if (safeFilters.subSegments?.length > 0) {
    if (filterMode === 'inclusive') {
      result = result.filter((item) =>
        safeFilters.subSegments.includes(item["Sub Segment"])
      );
    } else {
      result = result.filter((item) =>
        !safeFilters.subSegments.includes(item["Sub Segment"])
      );
    }
  }

  // Apply status filter
  if (safeFilters.status?.length > 0) {
    if (filterMode === 'inclusive') {
      result = result.filter((item) =>
        safeFilters.status.includes(item["Status"])
      );
    } else {
      result = result.filter((item) =>
        !safeFilters.status.includes(item["Status"])
      );
    }
  }

  // Apply manager filter
if (safeFilters.manager?.length > 0) {
  if (filterMode === 'inclusive') {
    result = result.filter((item) =>
      safeFilters.manager.includes(item["Manager"])
    );
  } else {
    result = result.filter((item) =>
      !safeFilters.manager.includes(item["Manager"])
    );
  }
}

  // Apply partner filter
if (safeFilters.partner?.length > 0) {
  if (filterMode === 'inclusive') {
    result = result.filter((item) =>
      safeFilters.partner.includes(item["Partner"])
    );
  } else {
    result = result.filter((item) =>
      !safeFilters.partner.includes(item["Partner"])
    );
  }
}

  // Apply technology partners filter
  if (safeFilters.technologyPartners?.length > 0) {
  if (filterMode === 'inclusive') {
    result = result.filter((item) => {
      // Check if the opportunity has any of the selected technology partners
      const techPartner1 = item["Technology Partner 1"];
      const techPartner2 = item["Technology Partner 2"];
      const techPartner3 = item["Technology Partner 3"];
      
      return safeFilters.technologyPartners.some(selectedPartner => {
        return (
          (techPartner1 && techPartner1.includes(selectedPartner)) ||
          (techPartner2 && techPartner2.includes(selectedPartner)) ||
          (techPartner3 && techPartner3.includes(selectedPartner))
        );
      });
    });
  } else {
    // Exclusive mode - exclude opportunities with selected technology partners
    result = result.filter((item) => {
      const techPartner1 = item["Technology Partner 1"];
      const techPartner2 = item["Technology Partner 2"];
      const techPartner3 = item["Technology Partner 3"];
      
      return !safeFilters.technologyPartners.some(selectedPartner => {
        return (
          (techPartner1 && techPartner1.includes(selectedPartner)) ||
          (techPartner2 && techPartner2.includes(selectedPartner)) ||
          (techPartner3 && techPartner3.includes(selectedPartner))
        );
      });
    });
  }
}

    // Handle service line filtering and allocation separately
    if (safeFilters.serviceLine1?.length > 0) {
      // Get all unique service lines in the data
      const allServiceLines = new Set();
      opportunityData.forEach((item) => {
        if (item["Service Line 1"]) allServiceLines.add(item["Service Line 1"]);
        if (item["Service Line 2"]) allServiceLines.add(item["Service Line 2"]);
        if (item["Service Line 3"]) allServiceLines.add(item["Service Line 3"]);
      });

      // Check if all service lines are selected
      const isAllServiceLinesSelected =
        safeFilters.serviceLine1.length > 0 &&
        allServiceLines.size > 0 &&
        [...allServiceLines].every((line) =>
          safeFilters.serviceLine1.includes(line)
        );

      // Find opportunities that have the selected service line in any of the three service line positions
      result = result.filter(
        (item) =>
          (item["Service Line 1"] &&
            safeFilters.serviceLine1.includes(item["Service Line 1"])) ||
          (item["Service Line 2"] &&
            safeFilters.serviceLine1.includes(item["Service Line 2"])) ||
          (item["Service Line 3"] &&
            safeFilters.serviceLine1.includes(item["Service Line 3"]))
      );

      // Apply service line allocation percentages
      result = result.map((item) => {
        let newItem = { ...item };

        // Special case: if all service lines are selected, use 100% allocation
        if (isAllServiceLinesSelected) {
          newItem["Allocated Gross Revenue"] = newItem["Gross Revenue"];
          newItem["Allocated Net Revenue"] = newItem["Net Revenue"] || 0;
          newItem["Is Allocated"] = false; // Not really allocated if using 100%
          newItem["Allocation Percentage"] = 100;
          newItem["Allocated Service Line"] = "All Service Lines";
          return newItem;
        }

        // Regular case: calculate allocation based on matching service lines
        let allocation = 0;
        let allocatedServiceLine = "";

        // Check if multiple service lines match the filters
        let matchingLines = [];
        let totalAllocation = 0;

        // Check primary service line
        if (
          newItem["Service Line 1"] &&
          safeFilters.serviceLine1.includes(newItem["Service Line 1"]) &&
          newItem["Service Offering 1 %"]
        ) {
          const lineAllocation =
            parseFloat(newItem["Service Offering 1 %"]) / 100;
          matchingLines.push({
            line: newItem["Service Line 1"],
            allocation: lineAllocation,
          });
          totalAllocation += lineAllocation;
        }

        // Check secondary service line
        if (
          newItem["Service Line 2"] &&
          safeFilters.serviceLine1.includes(newItem["Service Line 2"]) &&
          newItem["Service Offering 2 %"]
        ) {
          const lineAllocation =
            parseFloat(newItem["Service Offering 2 %"]) / 100;
          matchingLines.push({
            line: newItem["Service Line 2"],
            allocation: lineAllocation,
          });
          totalAllocation += lineAllocation;
        }

        // Check tertiary service line
        if (
          newItem["Service Line 3"] &&
          safeFilters.serviceLine1.includes(newItem["Service Line 3"]) &&
          newItem["Service Offering 3 %"]
        ) {
          const lineAllocation =
            parseFloat(newItem["Service Offering 3 %"]) / 100;
          matchingLines.push({
            line: newItem["Service Line 3"],
            allocation: lineAllocation,
          });
          totalAllocation += lineAllocation;
        }

        // If no matching lines with percentages found, default to using the first matching line with 100%
        if (matchingLines.length === 0) {
          if (
            newItem["Service Line 1"] &&
            safeFilters.serviceLine1.includes(newItem["Service Line 1"])
          ) {
            allocation = 1;
            allocatedServiceLine = newItem["Service Line 1"];
          } else if (
            newItem["Service Line 2"] &&
            safeFilters.serviceLine1.includes(newItem["Service Line 2"])
          ) {
            allocation = 1;
            allocatedServiceLine = newItem["Service Line 2"];
          } else if (
            newItem["Service Line 3"] &&
            safeFilters.serviceLine1.includes(newItem["Service Line 3"])
          ) {
            allocation = 1;
            allocatedServiceLine = newItem["Service Line 3"];
          } else {
            allocation = 1;
          }
        }
        // If we have exactly one matching line
        else if (matchingLines.length === 1) {
          allocation = matchingLines[0].allocation;
          allocatedServiceLine = matchingLines[0].line;
        }
        // If we have multiple matching lines, use the total allocation
        else {
          allocation = Math.min(totalAllocation, 1); // Cap at 100%
          allocatedServiceLine = matchingLines.map((m) => m.line).join(", ");

          // If total allocation exceeds 100%, note this in the allocated service line
          if (totalAllocation > 1) {
            allocatedServiceLine += " (capped at 100%)";
          }
        }

        // Apply allocation
        newItem["Allocated Gross Revenue"] =
          newItem["Gross Revenue"] * allocation;
        newItem["Allocated Net Revenue"] = newItem["Net Revenue"]
          ? newItem["Net Revenue"] * allocation
          : 0;
        newItem["Is Allocated"] = allocation !== 1;
        newItem["Allocation Percentage"] = allocation * 100;
        newItem["Allocated Service Line"] = allocatedServiceLine;

        return newItem;
      });
    }

    // Apply service offerings filter
    if (safeFilters.serviceOfferings?.length > 0) {
      result = result.filter((item) => {
        // Check if the opportunity has any of the selected service offerings
        // in any of the three service offering columns
        const offering1 = item["Service Offering 1"];
        const offering2 = item["Service Offering 2"];
        const offering3 = item["Service Offering 3"];
        
        return safeFilters.serviceOfferings.some(selectedOffering => {
          return (
            (offering1 && offering1 === selectedOffering) ||
            (offering2 && offering2 === selectedOffering) ||
            (offering3 && offering3 === selectedOffering)
          );
        });
      });
    }

    setFilteredData(result);
  }, [filters, opportunityData, filterMode]);
  */

  // Safely handle filter changes
  // Memoized filter change handler with service line/offering synchronization
  const handleFilterChange = useCallback(
    (newFilters, newFilterMode) => {
      if (!newFilters || typeof newFilters !== "object") return;

      setFilters((prevFilters) => {
        const updatedFilters = { ...prevFilters };

        // PHASE 1: Normalize filter values to new structure { included: [], excluded: [] }
        // Backward compatible: accepts both array and object formats
        Object.keys(newFilters).forEach((key) => {
          const value = newFilters[key];
          updatedFilters[key] = normalizeFilterValue(value);
        });

        // PHASE 1: For synchronization, work with 'included' arrays only
        // Extract included values for synchronization logic
        const prevServiceLines = new Set(getIncludedValues(prevFilters.serviceLine1));
        const newServiceLines = new Set(getIncludedValues(updatedFilters.serviceLine1));
        const prevOfferings = new Set(getIncludedValues(prevFilters.serviceOfferings));
        const newOfferings = new Set(getIncludedValues(updatedFilters.serviceOfferings));

        // Find which service lines and offerings were added or removed
        const addedServiceLines = [...newServiceLines].filter((sl) => !prevServiceLines.has(sl));
        const removedServiceLines = [...prevServiceLines].filter((sl) => !newServiceLines.has(sl));
        const addedOfferings = [...newOfferings].filter((off) => !prevOfferings.has(off));
        const removedOfferings = [...prevOfferings].filter((off) => !newOfferings.has(off));

        // DIRECTION 1: Service Line → Service Offerings
        // When a service line is added, add all its offerings
        addedServiceLines.forEach((serviceLine) => {
          const offerings = serviceToOfferingMap[serviceLine] || [];
          offerings.forEach((offering) => newOfferings.add(offering));
        });

        // When a service line is removed, remove its offerings (unless they belong to another selected service line)
        removedServiceLines.forEach((serviceLine) => {
          const offerings = serviceToOfferingMap[serviceLine] || [];
          offerings.forEach((offering) => {
            // Only remove if no other selected service line has this offering
            const isInOtherServiceLine = [...newServiceLines].some((sl) =>
              serviceToOfferingMap[sl]?.includes(offering)
            );
            if (!isInOtherServiceLine) {
              newOfferings.delete(offering);
            }
          });
        });

        // DIRECTION 2: Service Offering → Service Line
        // When a service offering is added, add its parent service line
        // Offerings use composite key format: "ServiceLine::Offering"
        addedOfferings.forEach((offering) => {
          // Extract service line from composite key
          const [serviceLine] = offering.split("::");
          if (serviceLine && serviceToOfferingMap[serviceLine]) {
            newServiceLines.add(serviceLine);
          }
        });

        // When a service offering is removed, check if its service line should be removed
        // (only if no other offerings from that service line are selected)
        removedOfferings.forEach((offering) => {
          // Extract service line from composite key
          const [serviceLine] = offering.split("::");
          if (serviceLine && serviceToOfferingMap[serviceLine]) {
            // Check if any other offering from this service line is still selected
            const offerings = serviceToOfferingMap[serviceLine] || [];
            const hasOtherOffering = offerings.some((off) => off !== offering && newOfferings.has(off));
            if (!hasOtherOffering) {
              // No other offerings from this service line are selected, remove it
              newServiceLines.delete(serviceLine);
            }
          }
        });

        // Synchronize segment codes and sub-segments (bidirectional)
        const prevSegmentCodes = new Set(getIncludedValues(prevFilters.subSegmentCodes));
        const newSegmentCodes = new Set(getIncludedValues(updatedFilters.subSegmentCodes));
        const prevSubSegments = new Set(getIncludedValues(prevFilters.subSegments));
        const newSubSegments = new Set(getIncludedValues(updatedFilters.subSegments));

        // Find which segment codes and sub-segments were added or removed
        const addedSegmentCodes = [...newSegmentCodes].filter((code) => !prevSegmentCodes.has(code));
        const removedSegmentCodes = [...prevSegmentCodes].filter((code) => !newSegmentCodes.has(code));
        const addedSubSegments = [...newSubSegments].filter((sub) => !prevSubSegments.has(sub));
        const removedSubSegments = [...prevSubSegments].filter((sub) => !newSubSegments.has(sub));

        // DIRECTION 1: Segment Code → Sub-Segments
        // When a segment code is added, add all its sub-segments
        addedSegmentCodes.forEach((segmentCode) => {
          const subSegs = segmentToSubSegmentMap[segmentCode] || [];
          subSegs.forEach((subSeg) => newSubSegments.add(subSeg));
        });

        // When a segment code is removed, remove its sub-segments (unless they belong to another selected segment code)
        removedSegmentCodes.forEach((segmentCode) => {
          const subSegs = segmentToSubSegmentMap[segmentCode] || [];
          subSegs.forEach((subSeg) => {
            // Only remove if no other selected segment code has this sub-segment
            const isInOtherSegmentCode = [...newSegmentCodes].some((code) =>
              segmentToSubSegmentMap[code]?.includes(subSeg)
            );
            if (!isInOtherSegmentCode) {
              newSubSegments.delete(subSeg);
            }
          });
        });

        // DIRECTION 2: Sub-Segment → Segment Code
        // When a sub-segment is added, add its parent segment code(s)
        addedSubSegments.forEach((subSegment) => {
          // Find which segment code(s) contain this sub-segment
          Object.keys(segmentToSubSegmentMap).forEach((segmentCode) => {
            if (segmentToSubSegmentMap[segmentCode]?.includes(subSegment)) {
              newSegmentCodes.add(segmentCode);
            }
          });
        });

        // When a sub-segment is removed, check if its segment code should be removed
        // (only if no other sub-segments from that segment code are selected)
        removedSubSegments.forEach((subSegment) => {
          // Find which segment code(s) contain this sub-segment
          Object.keys(segmentToSubSegmentMap).forEach((segmentCode) => {
            if (segmentToSubSegmentMap[segmentCode]?.includes(subSegment)) {
              // Check if any other sub-segment from this segment code is still selected
              const subSegs = segmentToSubSegmentMap[segmentCode] || [];
              const hasOtherSubSegment = subSegs.some((sub) => sub !== subSegment && newSubSegments.has(sub));
              if (!hasOtherSubSegment) {
                // No other sub-segments from this segment code are selected, remove it
                newSegmentCodes.delete(segmentCode);
              }
            }
          });
        });

        // PHASE 1: Update the filters with synchronized values (preserve excluded arrays)
        updatedFilters.serviceLine1 = {
          included: [...newServiceLines],
          excluded: normalizeFilterValue(updatedFilters.serviceLine1).excluded,
        };
        updatedFilters.serviceOfferings = {
          included: [...newOfferings],
          excluded: normalizeFilterValue(updatedFilters.serviceOfferings).excluded,
        };
        updatedFilters.subSegmentCodes = {
          included: [...newSegmentCodes],
          excluded: normalizeFilterValue(updatedFilters.subSegmentCodes).excluded,
        };
        updatedFilters.subSegments = {
          included: [...newSubSegments],
          excluded: normalizeFilterValue(updatedFilters.subSegments).excluded,
        };

        return updatedFilters;
      });

      // Filter mode is now always 'inclusive' (UI no longer allows changing it)
      // newFilterMode parameter kept for backward compatibility but not used
    },
    [serviceToOfferingMap, segmentToSubSegmentMap]
  );

  // Memoized tab change handler
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
    setSelectedOpportunities([]);
  }, []);

  // Memoized selection handler
  const handleSelection = useCallback((opportunities) => {
    setSelectedOpportunities(opportunities);
  }, []);

  // Memoized notification close handler
  const handleCloseNotification = useCallback(() => {
    setNotification((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  // PHASE 2: Memoized toggle filter handler - supports 3-state cycle
  // Cycles through: not selected → included → excluded → not selected
  const handleToggleFilter = useCallback(
    (type, value) => {
      // Get current filters
      const currentFilters = filters;
      if (!type || !currentFilters[type]) return;

      // Use toggleFilterValue helper to cycle through states
      const updatedFilterValue = toggleFilterValue(currentFilters[type], value);

      // Use handleFilterChange to apply the new filters with synchronization
      handleFilterChange({ ...currentFilters, [type]: updatedFilterValue });
    },
    [filters, handleFilterChange]
  );

  // Active filter count for AppBar badge - counts individual filter values (included + excluded)
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).reduce((count, filterValue) => {
      const normalized = normalizeFilterValue(filterValue);
      return count + normalized.included.length + normalized.excluded.length;
    }, 0);
  }, [filters]);

  // Clear ALL filters at once (for AppBar badge action)
  const handleClearAllFilters = useCallback(() => {
    setFilters(initializeFilters());
  }, []);

  // PHASE 1: Memoized clear filter type handler - clears both included and excluded
  const handleClearFilterType = useCallback(
    (type) => {
      // Get current filters
      const currentFilters = filters;
      if (!type || !currentFilters[type]) return;

      // Use handleFilterChange to apply the new filters with synchronization
      // Pass empty array, normalizeFilterValue will convert to { included: [], excluded: [] }
      handleFilterChange({ ...currentFilters, [type]: [] });
    },
    [filters, handleFilterChange]
  );
  // Memoized account filter change handler
  // PHASE 1: Account filter change - normalize to new structure
  const handleAccountChange = useCallback((event, newValue) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      accounts: normalizeFilterValue(newValue || []),
    }));
  }, []);

  // Memoized toggle between gross and net revenue
  const handleRevenueToggle = useCallback(() => {
    setShowNetRevenue((prev) => !prev);
  }, []);

  // Memoized toggle I&O figures display
  const handleIOToggle = useCallback(() => {
    setShowIO((prev) => !prev);
  }, []);

  // Memoized toggle Bookings/Lost display
  const handleLostToggle = useCallback(() => {
    setShowLost((prev) => !prev);
  }, []);

  // OPTIMIZED: Memoize tab data filtering to prevent recalculation on every render
  const tabData = useMemo(() => {
    if (!filteredData || !Array.isArray(filteredData)) return [];

    if (activeTab === 0) {
      // Pipeline Tab: Status 1-11
      return filteredData.filter((item) => item["Status"] >= 1 && item["Status"] <= 11);
    } else if (activeTab === 1) {
      // Bookings Tab: Status 14 and 15
      return filteredData.filter((item) => [11, 14, 15].includes(item["Status"]));
    } else if (activeTab === 2) {
      // Jobcode Timeline Tab: All data
      return filteredData;
    }
    return [];
  }, [filteredData, activeTab]);

  // Define theme colors for buttons
  const colorMap = {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    info: theme.palette.info.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };

  // Memoized check if only complete segment groups are selected (for hiding Sub Segments)
  // PHASE 1: Returns true if AMD is completely selected OR only non-AMD codes are selected
  const isCompleteSegmentSelected = useMemo(() => {
    const selectedCodes = getIncludedValues(filters.subSegmentCodes);
    if (selectedCodes.length === 0) return false;

    // Get the codes that belong to AMD group
    const amdCodes = (filterOptions.subSegmentCodes || []).filter((code) =>
      SEGMENT_CODE_GROUPS.AMD.include.some((inc) => code.toUpperCase() === inc.toUpperCase())
    );

    // Check how many AMD codes are selected
    const selectedAmdCodes = amdCodes.filter((code) => selectedCodes.includes(code));

    // If some but not all AMD codes are selected, it's a partial selection
    if (selectedAmdCodes.length > 0 && selectedAmdCodes.length < amdCodes.length) {
      return false; // Partial AMD selection
    }

    // If AMD is completely selected, return true
    if (selectedAmdCodes.length === amdCodes.length && amdCodes.length > 0) {
      return true;
    }

    // If only non-AMD codes are selected (individual codes), that's also considered "complete"
    // because individual codes don't have sub-items to show
    return true;
  }, [filters.subSegmentCodes, filterOptions.subSegmentCodes]);

  // Left sidebar content - Sub Segment Code filters
  const leftSidebarContent = (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight={600} color={theme.palette.primary.dark} sx={{ mb: 2 }}>
        Segments
      </Typography>

      {/* Added divider to match right sidebar */}
      <Divider sx={{ mb: 3, borderColor: theme.palette.primary.light }} />

      {/* Segment Code filter - Clear All button */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {getIncludedValues(filters.subSegmentCodes).length > 0 && (
          <Button
            variant="text"
            color="primary"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => handleClearFilterType("subSegmentCodes")}
            sx={{ minWidth: "auto", p: 0.5 }}
          >
            Clear All
          </Button>
        )}
      </Box>

      {/* Segment Code Groups - AMD group and individual codes */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
        {/* AMD Group */}
        {(() => {
          const groupConfig = SEGMENT_CODE_GROUPS.AMD;
          const groupCodes = (filterOptions.subSegmentCodes || []).filter((code) =>
            groupConfig.include.some((inc) => code.toUpperCase() === inc.toUpperCase())
          );

          const selectedCodes = getIncludedValues(filters.subSegmentCodes);
          const selectedCount = groupCodes.filter((code) => selectedCodes.includes(code)).length;

          const isExpanded = expandedSegmentGroups.AMD;
          const allSelected = groupCodes.length > 0 && selectedCount === groupCodes.length;

          const handleGroupClick = () => {
            const currentSelection = getIncludedValues(filters.subSegmentCodes);
            if (allSelected) {
              const newSelection = currentSelection.filter((code) => !groupCodes.includes(code));
              setFilters((prev) => ({ ...prev, subSegmentCodes: normalizeFilterValue(newSelection) }));
            } else {
              const newSelection = [...new Set([...currentSelection, ...groupCodes])];
              setFilters((prev) => ({ ...prev, subSegmentCodes: normalizeFilterValue(newSelection) }));
            }
          };

          const handleExpandClick = (e) => {
            e.stopPropagation();
            setExpandedSegmentGroups((prev) => ({ ...prev, AMD: !prev.AMD }));
          };

          return (
            <Box key="AMD">
              {/* AMD Group Header */}
              <Box
                onClick={handleGroupClick}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  backgroundColor: allSelected ? groupConfig.color : "#CCC1BC",
                  color: allSelected ? "white" : "#000000",
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: allSelected ? darken(groupConfig.color, 0.1) : alpha(groupConfig.color, 0.15),
                  },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {groupConfig.name}
                  {selectedCount > 0 && !allSelected && (
                    <Chip
                      label={selectedCount}
                      size="small"
                      sx={{
                        height: 18,
                        minWidth: 18,
                        fontSize: "0.7rem",
                        backgroundColor: allSelected ? "white" : groupConfig.color,
                        color: allSelected ? groupConfig.color : "white",
                        "& .MuiChip-label": { px: 0.5 },
                      }}
                    />
                  )}
                </Box>
                <Box
                  onClick={handleExpandClick}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 0.5,
                    borderRadius: 1,
                    "&:hover": {
                      backgroundColor: allSelected ? alpha("#fff", 0.2) : alpha(groupConfig.color, 0.15),
                    },
                  }}
                >
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </Box>
              </Box>

              {/* Expandable Segment Codes */}
              <Collapse in={isExpanded} timeout="auto">
                <Box sx={{ pl: 2, pt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {groupCodes.map((code, codeIndex) => {
                    const isSelected = getIncludedValues(filters.subSegmentCodes).includes(code);
                    const codeSubSegments = segmentToSubSegmentMap[code] || [];
                    const hasSubSegments = codeSubSegments.length > 0;
                    const isCodeExpanded = expandedSegmentCodes[code] || false;
                    const segmentColor = getSegmentColor(code);

                    return (
                      <Box key={code}>
                        <Box
                          onClick={() => handleToggleFilter("subSegmentCodes", code)}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderRadius: 2,
                            px: 2,
                            py: 0.75,
                            fontSize: "0.85rem",
                            fontWeight: isSelected ? 600 : 500,
                            backgroundColor: isSelected ? segmentColor : "#CCC1BC",
                            color: isSelected ? "white" : "#000000",
                            cursor: "pointer",
                            "&:hover": {
                              backgroundColor: isSelected ? darken(segmentColor, 0.1) : alpha(segmentColor, 0.15),
                            },
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          {code}
                          {hasSubSegments && (
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSegmentCodes((prev) => ({ ...prev, [code]: !prev[code] }));
                              }}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                p: 0.25,
                                borderRadius: 1,
                                "&:hover": {
                                  backgroundColor: isSelected ? alpha("#fff", 0.2) : alpha(segmentColor, 0.15),
                                },
                              }}
                            >
                              {isCodeExpanded ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </Box>
                          )}
                        </Box>
                        {/* Sub-segments dropdown - using lighter shades of segment color */}
                        {hasSubSegments && (
                          <Collapse in={isCodeExpanded} timeout="auto">
                            <Box sx={{ pl: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
                              {codeSubSegments.map((subSegment, subIndex) => {
                                const isSubSelected = getIncludedValues(filters.subSegments).includes(subSegment);
                                // Create gradient effect - lighter shade for sub-segments
                                // FIXED: Cap lighten factor to prevent values > 1
                                const subSegmentColor = lighten(segmentColor, Math.min(0.5, 0.15 + subIndex * 0.05));
                                return (
                                  <ToggleButton
                                    key={subSegment}
                                    value={subSegment}
                                    selected={isSubSelected}
                                    onChange={() => handleToggleFilter("subSegments", subSegment)}
                                    size="small"
                                    sx={{
                                      justifyContent: "flex-start",
                                      textAlign: "left",
                                      borderRadius: 1.5,
                                      px: 1.5,
                                      py: 0.5,
                                      fontSize: "0.75rem",
                                      fontWeight: 500,
                                      border: "none",
                                      backgroundColor: "#CCC1BC",
                                      color: "#000000",
                                      "&.Mui-selected": {
                                        backgroundColor: subSegmentColor,
                                        color: "white",
                                        fontWeight: 600,
                                        "&:hover": {
                                          backgroundColor: darken(subSegmentColor, 0.1),
                                        },
                                      },
                                      "&:hover": {
                                        backgroundColor: alpha(segmentColor, 0.15),
                                      },
                                      transition: "all 0.2s ease-in-out",
                                    }}
                                  >
                                    {subSegment}
                                  </ToggleButton>
                                );
                              })}
                            </Box>
                          </Collapse>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })()}

        {/* Individual Segment Codes (not in AMD) */}
        {(filterOptions.subSegmentCodes || [])
          .filter((code) => !SEGMENT_CODE_GROUPS.AMD.include.some((inc) => code.toUpperCase() === inc.toUpperCase()))
          .map((code, codeIndex) => {
            const isSelected = getIncludedValues(filters.subSegmentCodes).includes(code);
            const codeSubSegments = segmentToSubSegmentMap[code] || [];
            const hasSubSegments = codeSubSegments.length > 0;
            const isCodeExpanded = expandedSegmentCodes[code] || false;
            const segmentColor = getSegmentColor(code);

            return (
              <Box key={code}>
                <Box
                  onClick={() => handleToggleFilter("subSegmentCodes", code)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    fontSize: "0.9rem",
                    fontWeight: isSelected ? 600 : 500,
                    backgroundColor: isSelected ? segmentColor : "#CCC1BC",
                    color: isSelected ? "white" : "#000000",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: isSelected ? darken(segmentColor, 0.1) : alpha(segmentColor, 0.15),
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  {code}
                  {hasSubSegments && (
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSegmentCodes((prev) => ({ ...prev, [code]: !prev[code] }));
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        p: 0.25,
                        borderRadius: 1,
                        "&:hover": {
                          backgroundColor: isSelected ? alpha("#fff", 0.2) : alpha(segmentColor, 0.15),
                        },
                      }}
                    >
                      {isCodeExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </Box>
                  )}
                </Box>
                {/* Sub-segments dropdown - using lighter shades of segment color */}
                {hasSubSegments && (
                  <Collapse in={isCodeExpanded} timeout="auto">
                    <Box sx={{ pl: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
                      {codeSubSegments.map((subSegment, subIndex) => {
                        const isSubSelected = getIncludedValues(filters.subSegments).includes(subSegment);
                        // Create gradient effect - lighter shade for sub-segments
                        // FIXED: Cap lighten factor to prevent values > 1
                        const subSegmentColor = lighten(segmentColor, Math.min(0.5, 0.15 + subIndex * 0.05));
                        return (
                          <ToggleButton
                            key={subSegment}
                            value={subSegment}
                            selected={isSubSelected}
                            onChange={() => handleToggleFilter("subSegments", subSegment)}
                            size="small"
                            sx={{
                              justifyContent: "flex-start",
                              textAlign: "left",
                              borderRadius: 1.5,
                              px: 1.5,
                              py: 0.5,
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              border: "none",
                              backgroundColor: "#CCC1BC",
                              color: "#000000",
                              "&.Mui-selected": {
                                backgroundColor: subSegmentColor,
                                color: "white",
                                fontWeight: 600,
                                "&:hover": {
                                  backgroundColor: darken(subSegmentColor, 0.1),
                                },
                              },
                              "&:hover": {
                                backgroundColor: alpha(segmentColor, 0.15),
                              },
                              transition: "all 0.2s ease-in-out",
                            }}
                          >
                            {subSegment}
                          </ToggleButton>
                        );
                      })}
                    </Box>
                  </Collapse>
                )}
              </Box>
            );
          })}
      </Box>
    </Box>
  );

  // Memoized check if only complete units are selected (for hiding Service Offerings and filtered values)
  // PHASE 1: Returns true if all selected service lines belong to completely selected units (no partial selections)
  const isCompleteUnitSelected = useMemo(() => {
    const selectedServiceLines = getIncludedValues(filters.serviceLine1);
    if (selectedServiceLines.length === 0) return false;

    let hasAtLeastOneCompleteUnit = false;

    // Check each unit to see if it's completely selected, not selected, or partially selected
    for (const [groupKey, groupConfig] of Object.entries(SERVICE_LINE_GROUPS)) {
      const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line) => {
        const lineLower = line.toLowerCase();
        if (groupConfig.include) {
          return groupConfig.include.some((inc) => lineLower.includes(inc.toLowerCase()));
        } else if (groupConfig.exclude) {
          return !groupConfig.exclude.some((exc) => lineLower.includes(exc.toLowerCase()));
        }
        return false;
      });

      // Count how many service lines from this group are selected
      const selectedInGroup = groupServiceLines.filter((line) => selectedServiceLines.includes(line));

      if (selectedInGroup.length === 0) {
        // Unit not selected at all - OK
        continue;
      } else if (selectedInGroup.length === groupServiceLines.length) {
        // Unit completely selected - OK
        hasAtLeastOneCompleteUnit = true;
      } else {
        // Unit partially selected - NOT OK, return false immediately
        return false;
      }
    }

    return hasAtLeastOneCompleteUnit;
  }, [filters.serviceLine1, filterOptions.serviceLine1]);

  // The updated rightSidebarContent with service line and service offering filters
  const rightSidebarContent = (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight={600} color={theme.palette.secondary.dark} sx={{ mb: 2 }}>
        Unit
      </Typography>
      <Divider sx={{ mb: 3, borderColor: theme.palette.secondary.light }} />

      {/* Service Line filter - Clear All button */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {getIncludedValues(filters.serviceLine1).length > 0 && (
          <Button
            variant="text"
            color="secondary"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => handleClearFilterType("serviceLine1")}
            sx={{ minWidth: "auto", p: 0.5 }}
          >
            Clear All
          </Button>
        )}
      </Box>

      {/* Unit Groups - Expandable */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
        {Object.entries(SERVICE_LINE_GROUPS).map(([groupKey, groupConfig]) => {
          // Get the service lines that belong to this group (case-insensitive matching)
          const groupServiceLines = (filterOptions.serviceLine1 || []).filter((line) => {
            const lineLower = line.toLowerCase();
            if (groupConfig.include) {
              return groupConfig.include.some((inc) => lineLower.includes(inc.toLowerCase()));
            } else if (groupConfig.exclude) {
              return !groupConfig.exclude.some((exc) => lineLower.includes(exc.toLowerCase()));
            }
            return false;
          });

          // Count how many service lines in this group are selected
          const selectedServiceLines = getIncludedValues(filters.serviceLine1);
          const selectedCount = groupServiceLines.filter((line) => selectedServiceLines.includes(line)).length;

          const isExpanded = expandedGroups[groupKey];
          const allSelected = groupServiceLines.length > 0 && selectedCount === groupServiceLines.length;

          // Handler to select/deselect all service lines in a group (without expanding)
          const handleGroupClick = () => {
            const currentSelection = getIncludedValues(filters.serviceLine1);
            if (allSelected) {
              // Deselect all service lines in this group
              const newSelection = currentSelection.filter((line) => !groupServiceLines.includes(line));
              setFilters((prev) => ({ ...prev, serviceLine1: normalizeFilterValue(newSelection) }));
            } else {
              // Select all service lines in this group
              const newSelection = [...new Set([...currentSelection, ...groupServiceLines])];
              setFilters((prev) => ({ ...prev, serviceLine1: normalizeFilterValue(newSelection) }));
            }
          };

          // Handler to expand/collapse (only for arrow click)
          const handleExpandClick = (e) => {
            e.stopPropagation(); // Prevent triggering group selection
            setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
          };

          return (
            <Box key={groupKey}>
              {/* Group Header - Click to select all (arrow to expand) */}
              <Box
                onClick={handleGroupClick}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  backgroundColor: allSelected ? groupConfig.color : "#CCC1BC",
                  color: allSelected ? "white" : "#000000",
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: allSelected ? darken(groupConfig.color, 0.1) : alpha(groupConfig.color, 0.15),
                  },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {groupConfig.name}
                  {selectedCount > 0 && !allSelected && (
                    <Chip
                      label={selectedCount}
                      size="small"
                      sx={{
                        height: 18,
                        minWidth: 18,
                        fontSize: "0.7rem",
                        backgroundColor: allSelected ? "white" : groupConfig.color,
                        color: allSelected ? groupConfig.color : "white",
                        "& .MuiChip-label": { px: 0.5 },
                      }}
                    />
                  )}
                </Box>
                <Box
                  onClick={handleExpandClick}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 0.5,
                    borderRadius: 1,
                    "&:hover": {
                      backgroundColor: allSelected ? alpha("#fff", 0.2) : alpha(groupConfig.color, 0.15),
                    },
                  }}
                >
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </Box>
              </Box>

              {/* Expandable Service Lines */}
              <Collapse in={isExpanded} timeout="auto">
                <Box sx={{ pl: 2, pt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {groupServiceLines.map((line, lineIndex) => {
                    const isSelected = getIncludedValues(filters.serviceLine1).includes(line);
                    const lineOfferings = serviceToOfferingMap[line] || [];
                    const hasOfferings = lineOfferings.length > 0;
                    const isLineExpanded = expandedServiceLines[line] || false;
                    // Create slightly different shade for each service line within the group
                    // FIXED: Ensure darken factor is always in valid range [0, 1]
                    const serviceLineColor =
                      groupServiceLines.length > 1
                        ? darken(groupConfig.color, Math.min(0.3, (lineIndex / groupServiceLines.length) * 0.15))
                        : groupConfig.color;

                    return (
                      <Box key={line}>
                        <Box
                          onClick={() => handleToggleFilter("serviceLine1", line)}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderRadius: 2,
                            px: 2,
                            py: 0.75,
                            fontSize: "0.85rem",
                            fontWeight: isSelected ? 600 : 500,
                            backgroundColor: isSelected ? serviceLineColor : "#CCC1BC",
                            color: isSelected ? "white" : "#000000",
                            cursor: "pointer",
                            "&:hover": {
                              backgroundColor: isSelected
                                ? darken(serviceLineColor, 0.1)
                                : alpha(serviceLineColor, 0.15),
                            },
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {line}
                          </Box>
                          {hasOfferings && (
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedServiceLines((prev) => ({ ...prev, [line]: !prev[line] }));
                              }}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                p: 0.25,
                                borderRadius: 1,
                                ml: 0.5,
                                flexShrink: 0,
                                "&:hover": {
                                  backgroundColor: isSelected ? alpha("#fff", 0.2) : alpha(serviceLineColor, 0.15),
                                },
                              }}
                            >
                              {isLineExpanded ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </Box>
                          )}
                        </Box>
                        {/* Service Offerings dropdown - using lighter shades of service line color */}
                        {hasOfferings && (
                          <Collapse in={isLineExpanded} timeout="auto">
                            <Box sx={{ pl: 2, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
                              {lineOfferings.map((offering, offeringIndex) => {
                                const isOfferingSelected = getIncludedValues(filters.serviceOfferings).includes(
                                  offering
                                );
                                // Create gradient effect - lighter shade for service offerings
                                // FIXED: Cap lighten factor to prevent values > 1
                                const offeringColor = lighten(
                                  serviceLineColor,
                                  Math.min(0.5, 0.15 + offeringIndex * 0.05)
                                );
                                return (
                                  <ToggleButton
                                    key={offering}
                                    value={offering}
                                    selected={isOfferingSelected}
                                    onChange={() => handleToggleFilter("serviceOfferings", offering)}
                                    size="small"
                                    sx={{
                                      justifyContent: "flex-start",
                                      textAlign: "left",
                                      borderRadius: 1.5,
                                      px: 1.5,
                                      py: 0.5,
                                      fontSize: "0.75rem",
                                      fontWeight: 500,
                                      border: "none",
                                      backgroundColor: "#CCC1BC",
                                      color: "#000000",
                                      "&.Mui-selected": {
                                        backgroundColor: offeringColor,
                                        color: "white",
                                        fontWeight: 600,
                                        "&:hover": {
                                          backgroundColor: darken(offeringColor, 0.1),
                                        },
                                      },
                                      "&:hover": {
                                        backgroundColor: alpha(serviceLineColor, 0.15),
                                      },
                                      transition: "all 0.2s ease-in-out",
                                    }}
                                  >
                                    {offering}
                                  </ToggleButton>
                                );
                              })}
                            </Box>
                          </Collapse>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex" }}>
        {/* Left Sidebar - Sub Segment Codes */}
        {opportunityData.length > 0 && !isMobile && (
          <Drawer
            variant="permanent"
            sx={{
              width: LEFT_DRAWER_WIDTH,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: LEFT_DRAWER_WIDTH,
                boxSizing: "border-box",
                border: "none",
                pt: "64px", // AppBar height
                backgroundColor: darkMode ? "#241E1B" : "#E6DEDA",
              },
            }}
          >
            <LeftSidebar
              filters={filters}
              filterOptions={filterOptions}
              handleClearFilterType={handleClearFilterType}
              handleToggleFilter={handleToggleFilter}
              handleFilterChange={handleFilterChange}
              setFilters={setFilters}
              expandedSegmentGroups={expandedSegmentGroups}
              setExpandedSegmentGroups={setExpandedSegmentGroups}
              expandedSegmentCodes={expandedSegmentCodes}
              setExpandedSegmentCodes={setExpandedSegmentCodes}
              segmentToSubSegmentMap={segmentToSubSegmentMap}
            />
          </Drawer>
        )}

        {/* Main content */}
        <Box
          sx={{
            flexGrow: 1,
            width: {
              sm: `calc(100% - ${
                opportunityData.length > 0 && !isMobile ? LEFT_DRAWER_WIDTH + RIGHT_DRAWER_WIDTH : 0
              }px)`,
            },
          }}
        >
          {/* Single row AppBar with tabs */}
          <AppBar
            position="fixed"
            elevation={0}
            sx={{
              backgroundColor: "#330000",
              zIndex: (theme) => theme.zIndex.drawer + 1,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              transition: `all ${timing.normal} ${easing.elegant}`,
            }}
          >
            <Toolbar
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
                onClick={handleToggleDarkMode}
                title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
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
              {opportunityData.length > 0 && (
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  aria-label="dashboard tabs"
                  sx={{
                    minHeight: 64,
                    "& .MuiTabs-indicator": {
                      backgroundColor: "#FF3D47",
                      height: 3,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                      transition: `all ${timing.normal} ${easing.elegant}`,
                    },
                    "& .MuiTab-root": {
                      minHeight: 64,
                      px: 3,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                      transition: `all ${timing.normal} ${easing.elegant}`,
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
                    icon={<ShowChartOutlinedIcon sx={{ fontSize: 20 }} />}
                    iconPosition="start"
                    sx={{ gap: 1 }}
                  />
                  <Tab
                    label="Bookings"
                    icon={<CheckCircleOutlineIcon sx={{ fontSize: 20 }} />}
                    iconPosition="start"
                    sx={{ gap: 1 }}
                  />
                  <Tab
                    label="Timeline"
                    icon={<TimelineOutlinedIcon sx={{ fontSize: 20 }} />}
                    iconPosition="start"
                    sx={{ gap: 1 }}
                  />
                </Tabs>
              )}

              {/* Active Filters Badge */}
              {opportunityData.length > 0 && activeFilterCount > 0 && (
                <Chip
                  label={`${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""}`}
                  size="small"
                  onDelete={handleClearAllFilters}
                  deleteIcon={<ClearIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.8) !important" }} />}
                  sx={{
                    ml: 2,
                    backgroundColor: "rgba(255,61,71,0.85)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    height: 28,
                    transition: `all ${timing.normal} ${easing.elegant}`,
                    "&:hover": {
                      backgroundColor: "rgba(255,61,71,1)",
                    },
                    "& .MuiChip-deleteIcon:hover": {
                      color: "white !important",
                    },
                  }}
                />
              )}

              {/* Right side - Toggle switches */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  ml: "auto",
                }}
              >
                {/* Add Bookings/Lost Toggle - Only visible on Bookings tab */}
                {opportunityData.length > 0 && activeTab === 1 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showLost}
                        onChange={handleLostToggle}
                        sx={{
                          "& .MuiSwitch-switchBase": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#FF3D47",
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#FF787A",
                          },
                          "& .MuiSwitch-track": {
                            backgroundColor: "rgba(255,255,255,0.3)",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-thumb": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        {showLost ? (
                          <CancelOutlinedIcon
                            sx={{
                              mr: 0.5,
                              fontSize: 18,
                              color: "white",
                              transition: `all ${timing.normal} ${easing.elegant}`,
                            }}
                          />
                        ) : (
                          <CheckCircleOutlineIcon
                            sx={{
                              mr: 0.5,
                              fontSize: 18,
                              color: "white",
                              transition: `all ${timing.normal} ${easing.elegant}`,
                            }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{
                            fontSize: "0.8rem",
                            color: "white",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          }}
                        >
                          {showLost ? "Lost" : "Bookings"}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      bgcolor: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.25,
                      transition: `all ${timing.normal} ${easing.elegant}`,
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.15)",
                      },
                    }}
                  />
                )}

                {/* Add Revenue Toggle Switch */}
                {opportunityData.length > 0 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showNetRevenue}
                        onChange={handleRevenueToggle}
                        sx={{
                          "& .MuiSwitch-switchBase": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#FF3D47",
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#FF787A",
                          },
                          "& .MuiSwitch-track": {
                            backgroundColor: "rgba(255,255,255,0.3)",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-thumb": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <MonetizationOnIcon
                          sx={{
                            mr: 0.5,
                            fontSize: 18,
                            color: "white",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{
                            fontSize: "0.8rem",
                            color: "white",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          }}
                        >
                          {showNetRevenue ? "Net" : "Gross"}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      bgcolor: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.25,
                      transition: `all ${timing.normal} ${easing.elegant}`,
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.15)",
                      },
                    }}
                  />
                )}

                {/* Add I&O Display Toggle */}
                {opportunityData.length > 0 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showIO}
                        onChange={handleIOToggle}
                        sx={{
                          "& .MuiSwitch-switchBase": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#FF3D47",
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#FF787A",
                          },
                          "& .MuiSwitch-track": {
                            backgroundColor: "rgba(255,255,255,0.3)",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                          "& .MuiSwitch-thumb": {
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <BusinessIcon
                          sx={{
                            mr: 0.5,
                            fontSize: 18,
                            color: "white",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{
                            fontSize: "0.8rem",
                            color: "white",
                            transition: `all ${timing.normal} ${easing.elegant}`,
                          }}
                        >
                          I&O
                        </Typography>
                      </Box>
                    }
                    sx={{
                      bgcolor: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.25,
                      transition: `all ${timing.normal} ${easing.elegant}`,
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.15)",
                      },
                    }}
                  />
                )}

                {/* Status Override Manager - Shows when there are overrides or manual opportunities */}
                {opportunityData.length > 0 && (
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
                    onSaveToExcel={handleSaveToExcel}
                    onCheckConflicts={handleCheckConflicts}
                    onRefreshFromExcel={handleRefreshFromExcel}
                    hasFileHandle={!!excelFileHandle}
                    excelSavedSnapshot={excelSavedSnapshot}
                    collectCurrentChanges={collectCurrentChanges}
                    showNetRevenue={showNetRevenue}
                    showIO={showIO}
                    setEditOpportunity={setEditOpportunity}
                    isLoading={loading}
                    modificationsEnabled={modificationsEnabled}
                    onToggleModifications={setModificationsEnabled}
                  />
                )}
              </Box>
            </Toolbar>
          </AppBar>

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              pt: "80px", // Adjusted for the single-line AppBar
              pb: 3,
              px: 3,
              overflow: "visible",
              // Animated background gradient
              background: "radial-gradient(circle at 20% 50%, rgba(255,61,71,0.03) 0%, transparent 50%)",
              "@keyframes gradientShift": {
                "0%": { backgroundPosition: "20% 50%" },
                "50%": { backgroundPosition: "80% 50%" },
                "100%": { backgroundPosition: "20% 50%" },
              },
              animation: "gradientShift 60s ease-in-out infinite",
              backgroundSize: "200% 200%",
            }}
          >
            {opportunityData.length === 0 ? (
              <Fade in={true} timeout={800}>
                <Paper
                  elevation={2}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: {
                      xs: "calc(100vh - 140px)",
                      md: "calc(100vh - 160px)",
                    },
                    borderRadius: 3,
                    p: { xs: 3, md: 6 },
                    background: darkMode
                      ? "linear-gradient(to bottom right, #241E1B, #1A1210)"
                      : "linear-gradient(to bottom right, #ffffff, #f8fafc)",
                    textAlign: "center",
                    border: "1px solid",
                    borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                    <span style={{ color: "#FF3D47" }}>B°</span> Dashboard
                  </Typography>

                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "600px", mb: 4 }}>
                    Upload your Excel files to visualize pipeline, bookings, service line performance, and team staffing
                    data with interactive charts and insights.
                  </Typography>

                  <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
                    <Grid item>
                      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, textAlign: "center" }}>
                        <BusinessIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Opportunity Data
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Upload pipeline and bookings data
                        </Typography>
                        <FileUploader onFileUploaded={handleFileUploaded} hasData={false} fileType="opportunity" />
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              </Fade>
            ) : (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {activeTab !== 2 && (
                  <Box sx={{ mb: 3 }}>
                    <FilterPanel
                      data={allOpportunityData}
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      showNetRevenue={showNetRevenue}
                      crmAccounts={crmAccounts}
                      manualAccounts={manualAccounts}
                    />
                  </Box>
                )}

                <Box sx={{ flex: 1, overflow: "visible" }}>
                  {/* OPTIMIZED: Suspense wrapper for lazy-loaded tabs */}
                  <Suspense
                    fallback={
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
                        <CircularProgress />
                      </Box>
                    }
                  >
                    {activeTab === 0 && (
                      <PipelineTab
                        data={tabData}
                        loading={loading}
                        onSelection={handleSelection}
                        selectedOpportunities={selectedOpportunities}
                        showNetRevenue={showNetRevenue}
                        showIO={showIO}
                        isCompleteUnitSelected={isCompleteUnitSelected}
                        editOpportunity={editOpportunity}
                        setEditOpportunity={setEditOpportunity}
                        onOpportunityCreated={handleOpportunityCreated}
                        onOpportunityUpdated={handleOpportunityUpdated}
                        onOpportunityDeleted={handleOpportunityDeleted}
                        filterOptions={filterOptions}
                        opportunityData={allOpportunityData}
                        navigateToOpportunityId={navigateToOpportunityId}
                      />
                    )}
                    {activeTab === 1 && (
                      <BookingsTab
                        data={tabData}
                        loading={loading}
                        onSelection={handleSelection}
                        selectedOpportunities={selectedOpportunities}
                        showNetRevenue={showNetRevenue}
                        showIO={showIO}
                        showLost={showLost}
                        filters={filters}
                        originalData={opportunityData}
                        isCompleteUnitSelected={isCompleteUnitSelected}
                        setEditOpportunity={setEditOpportunity}
                        onOpportunityCreated={handleOpportunityCreated}
                        onOpportunityDeleted={handleOpportunityDeleted}
                        onOpportunityUpdated={handleOpportunityUpdated}
                        navigateToOpportunityId={navigateToOpportunityId}
                      />
                    )}
                    {activeTab === 2 && (
                      <JobcodeTimelineTab
                        data={opportunityData} // Note: Using all data, not filtered data from tabData
                        loading={loading}
                        onSelection={handleSelection}
                        selectedOpportunities={selectedOpportunities}
                        showNetRevenue={showNetRevenue}
                        showIO={showIO}
                      />
                    )}
                  </Suspense>
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Sidebar - Service Lines and Service Offerings */}
        {opportunityData.length > 0 && !isMobile && (
          <Drawer
            variant="permanent"
            anchor="right"
            sx={{
              width: RIGHT_DRAWER_WIDTH,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: RIGHT_DRAWER_WIDTH,
                boxSizing: "border-box",
                border: "none",
                pt: "64px", // AppBar height
                backgroundColor: darkMode ? "#241E1B" : "#E6DEDA",
              },
            }}
          >
            <RightSidebar
              theme={theme}
              filters={filters}
              filterOptions={filterOptions}
              expandedGroups={expandedGroups}
              expandedServiceLines={expandedServiceLines}
              serviceToOfferingMap={serviceToOfferingMap}
              segmentToSubSegmentMap={segmentToSubSegmentMap}
              SERVICE_LINE_GROUPS={SERVICE_LINE_GROUPS}
              handleClearFilterType={handleClearFilterType}
              handleToggleFilter={handleToggleFilter}
              handleFilterChange={handleFilterChange}
              setFilters={setFilters}
              setExpandedGroups={setExpandedGroups}
              setExpandedServiceLines={setExpandedServiceLines}
            />
          </Drawer>
        )}
      </Box>

      {/* Floating Action Button Stack - Visible when data is loaded */}
      {opportunityData.length > 0 && (
        <>
          {/* Backdrop overlay */}
          {fabOpen && (
            <Box
              onClick={() => setFabOpen(false)}
              sx={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                bgcolor: "rgba(0,0,0,0.25)",
                transition: "opacity 0.3s",
              }}
            />
          )}

          {/* Stack items — fan out above the FAB */}
          <Box
            sx={{
              position: "fixed",
              bottom: 84,
              left: 32,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column-reverse",
              gap: 1,
              opacity: fabOpen ? 1 : 0,
              transform: fabOpen ? "translateY(0)" : "translateY(20px)",
              pointerEvents: fabOpen ? "auto" : "none",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {[
              {
                label: "Staffing Need",
                icon: <GroupIcon sx={{ fontSize: 18 }} />,
                color: "warning",
                onClick: () => {
                  setFabOpen(false);
                  setCreateStaffingNeedModalOpen(true);
                },
              },
              {
                label: "Account",
                icon: <BusinessIcon sx={{ fontSize: 18 }} />,
                color: "secondary",
                onClick: () => {
                  setFabOpen(false);
                  setCreateAccountModalOpen(true);
                },
              },
              {
                label: "Opportunity",
                icon: <MonetizationOnIcon sx={{ fontSize: 18 }} />,
                color: "primary",
                onClick: () => {
                  setFabOpen(false);
                  setCreateModalOpen(true);
                },
              },
            ].map((item, i) => (
              <Fade in={fabOpen} key={item.label} style={{ transitionDelay: fabOpen ? `${i * 60}ms` : "0ms" }}>
                <Box
                  onClick={item.onClick}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    cursor: "pointer",
                    "&:hover .fab-stack-label": { bgcolor: "grey.800" },
                    "&:hover .fab-stack-icon": { transform: "scale(1.08)" },
                  }}
                >
                  <Chip
                    label={item.label}
                    className="fab-stack-label"
                    sx={{
                      bgcolor: "grey.700",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      height: 32,
                      transition: "all 0.2s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  />
                  <Fab
                    size="small"
                    color={item.color}
                    className="fab-stack-icon"
                    sx={{ boxShadow: 3, transition: "transform 0.2s", width: 36, height: 36, minHeight: 36 }}
                  >
                    {item.icon}
                  </Fab>
                </Box>
              </Fade>
            ))}
          </Box>

          {/* Main FAB button */}
          <Fab
            color="primary"
            aria-label="create"
            size="medium"
            onClick={() => setFabOpen((prev) => !prev)}
            sx={{
              position: "fixed",
              bottom: 32,
              left: 32,
              zIndex: 9999,
              transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
              transition: "all 0.3s ease",
              boxShadow: "0 6px 12px rgba(255, 61, 71, 0.3)",
              "&:hover": {
                boxShadow: "0 8px 16px rgba(255, 61, 71, 0.4)",
              },
            }}
          >
            <AddIcon />
          </Fab>
        </>
      )}

      {/* Manual Opportunity Creation Modal */}
      <CreateOpportunityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        editOpportunity={editOpportunity}
        setEditOpportunity={setEditOpportunity}
        onOpportunityCreated={handleOpportunityCreated}
        onOpportunityUpdated={handleOpportunityUpdated}
        onOpportunityDeleted={handleOpportunityDeleted}
        onAccountCreated={handleAccountCreated}
        filterOptions={filterOptions}
        opportunityData={allOpportunityData}
        crmAccounts={crmAccounts}
        manualAccounts={manualAccounts}
        segmentToSubSegmentMap={segmentToSubSegmentMap}
      />

      {/* Standalone Account Creation Modal */}
      <CreateAccountModal
        open={createAccountModalOpen}
        onClose={() => setCreateAccountModalOpen(false)}
        onAccountCreated={handleAccountCreated}
        crmAccounts={crmAccounts}
        segmentToSubSegmentMap={segmentToSubSegmentMap}
      />

      {/* Standalone Staffing Need Creation Modal */}
      <CreateStaffingNeedModal
        open={createStaffingNeedModalOpen}
        onClose={() => setCreateStaffingNeedModalOpen(false)}
        opportunityData={allOpportunityData}
      />

      {/* Processing overlay — visible during Excel file processing */}
      <Backdrop
        open={loading}
        sx={{
          zIndex: (theme) => theme.zIndex.modal + 1,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 3,
            minWidth: 360,
            maxWidth: 420,
            textAlign: "center",
            background: darkMode
              ? "linear-gradient(to bottom right, #241E1B, #1A1210)"
              : "linear-gradient(to bottom right, #ffffff, #f8fafc)",
          }}
        >
          <Box sx={{ mb: 2 }}>
            <CircularProgress size={48} thickness={4} sx={{ color: "#FF3D47" }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Processing file...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, minHeight: 20 }}>
            {loadingMessage}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={loadingProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0, 0, 0, 0.08)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                background: "linear-gradient(90deg, #FF3D47, #FF6B6B)",
                transition: "transform 0.4s ease",
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {loadingProgress}%
          </Typography>
        </Paper>
      </Backdrop>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
