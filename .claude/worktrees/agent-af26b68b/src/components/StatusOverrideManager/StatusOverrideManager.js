/**
 * StatusOverrideManager Component
 * Displays all status overrides and manual opportunities, allows management
 */

import React, { memo, useState, useMemo, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  alpha,
  useTheme,
  Divider,
  Tabs,
  Tab,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Checkbox,
  Grid,
  Radio,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UndoIcon from "@mui/icons-material/Undo";
import DeleteIcon from "@mui/icons-material/Delete";
import EditNoteIcon from "@mui/icons-material/EditNote";

import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CommentIcon from "@mui/icons-material/Comment";
import GroupIcon from "@mui/icons-material/Group";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BugReportIcon from "@mui/icons-material/BugReport";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import OpportunityExpandedDetails from "../OpportunityList/components/OpportunityExpandedDetails";
import { useStatusOverride, STATUS_OPTIONS } from "../../contexts/StatusOverrideContext";
/**
 * Group an array of items into a hierarchy based on the chosen groupBy mode.
 * Modes: 'none', 'serviceLine', 'segment', 'both'
 * Returns: { [groupKey]: { items: [...], subGroups?: { [subKey]: items[] } } }
 * For 'none': single flat group with key '__all__'
 * For 'serviceLine' or 'segment': { [value]: { items: [...] } }
 * For 'both': { [primary]: { subGroups: { [secondary]: items[] } } }
 */
const groupItemsBy = (items, getOpp, mode) => {
  if (mode === "none" || !mode) {
    return { __all__: { items } };
  }

  const getGroupKey = (opp, field) => {
    const val = opp?.[field];
    return val && val !== "-" ? val : "Other";
  };

  if (mode === "serviceLine") {
    const groups = {};
    items.forEach((item) => {
      const opp = getOpp(item);
      const key = getGroupKey(opp, "Service Line 1");
      if (!groups[key]) groups[key] = { items: [] };
      groups[key].items.push(item);
    });
    return groups;
  }

  if (mode === "segment") {
    const groups = {};
    items.forEach((item) => {
      const opp = getOpp(item);
      const key = getGroupKey(opp, "Sub Segment Code");
      if (!groups[key]) groups[key] = { items: [] };
      groups[key].items.push(item);
    });
    return groups;
  }

  if (mode === "slThenSegment" || mode === "segmentThenSl") {
    const primaryField = mode === "slThenSegment" ? "Service Line 1" : "Sub Segment Code";
    const secondaryField = mode === "slThenSegment" ? "Sub Segment Code" : "Service Line 1";
    const groups = {};
    items.forEach((item) => {
      const opp = getOpp(item);
      const primary = getGroupKey(opp, primaryField);
      const secondary = getGroupKey(opp, secondaryField);
      if (!groups[primary]) groups[primary] = { subGroups: {} };
      if (!groups[primary].subGroups[secondary]) groups[primary].subGroups[secondary] = [];
      groups[primary].subGroups[secondary].push(item);
    });
    return groups;
  }

  return { __all__: { items } };
};

const getStatusLabel = (status) => {
  const option = STATUS_OPTIONS.find((s) => s.status === status);
  return option ? option.shortLabel : `Status ${status}`;
};

const StatusOverrideManager = memo(
  ({
    opportunityData = [],
    onDeleteManualOpportunity,
    onManualOpportunityUpdated,
    onAddManualOpportunity,
    manualAccounts = [],
    onDeleteManualAccount,
    onClearAllManualOpportunities,
    onClearAllManualAccounts,
    onAddManualAccount,
    onSaveToExcel,
    onCheckConflicts,
    onRefreshFromExcel,
    hasFileHandle = false,
    excelSavedSnapshot = null,
    collectCurrentChanges,
    showNetRevenue = false,
    showIO = true,
    setEditOpportunity,
    isLoading = false,
    modificationsEnabled = "all",
    onToggleModifications,
  }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const [confirmClearAll, setConfirmClearAll] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [selectedOpportunity, setSelectedOpportunity] = useState(null);
    const [copied, setCopied] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isSavingExcel, setIsSavingExcel] = useState(false);
    const [saveExcelResult, setSaveExcelResult] = useState(null);
    const [showUnsavedDetails, setShowUnsavedDetails] = useState(false);
    const fileInputRef = useRef(null);
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [mergeResultInfo, setMergeResultInfo] = useState(null);
    const [debugDialogOpen, setDebugDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [resultDialog, setResultDialog] = useState(null); // { title, message, severity } for save/refresh results
    const [actionsRefreshKey, setActionsRefreshKey] = useState(0); // Incremented to force recomputation after localStorage mutations (e.g. clear all actions)
    const [searchText, setSearchText] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [allCollapsedMap, setAllCollapsedMap] = useState({});
    const allCollapsed = allCollapsedMap[activeTab] || false;
    const [groupBy, setGroupBy] = useState("none"); // 'none' | 'serviceLine' | 'segment' | 'slThenSegment' | 'segmentThenSl'
    const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
    const [conflictResolution, setConflictResolution] = useState(null); // { mergeResult, choices: { [key]: 'local'|'remote' } }
    const [popupInitialActionsTab, setPopupInitialActionsTab] = useState(undefined);

    const { getAllOverrides, overrideCount, removeStatusOverride, clearAllOverrides, setStatusOverride } =
      useStatusOverride();

    // Get manual opportunities from opportunityData
    const manualOpportunities = useMemo(() => {
      return opportunityData.filter((opp) => opp.isManual);
    }, [opportunityData]);

    const manualCount = manualOpportunities.length;
    const accountCount = manualAccounts.length;

    // Count actions/comments from localStorage (always up-to-date, independent of syncInfo)
    const actionsCommentsCount = useMemo(() => {
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("opportunity_actions_") || key?.startsWith("opportunity_comments_")) {
          try {
            const items = JSON.parse(localStorage.getItem(key));
            count += Array.isArray(items) ? items.length : 0;
          } catch {
            /* ignore */
          }
        }
      }
      return count;
    }, [collectCurrentChanges, open, activeTab, actionsRefreshKey]);

    // Count staffing needs separately from localStorage
    const staffingNeedsCount = useMemo(() => {
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("staffing_needs_")) {
          try {
            const items = JSON.parse(localStorage.getItem(key));
            count += Array.isArray(items) ? items.length : 0;
          } catch {
            /* ignore */
          }
        }
      }
      return count;
    }, [collectCurrentChanges, open, activeTab, actionsRefreshKey]);

    const totalCount = overrideCount + manualCount + accountCount + actionsCommentsCount + staffingNeedsCount;

    // Compute per-item sync state (comparing current state vs what's saved in Excel)
    // IMPORTANT: For overrides, use getAllOverrides (React state) — it's always up to date.
    // localStorage is updated in a useEffect AFTER render, so collectCurrentChanges()
    // would read stale override data during the same render cycle.
    // For manual opportunities & accounts, use collectCurrentChanges() (localStorage)
    // because opportunityData has computed fields (_originalStatus, _statusOverride)
    // that don't exist in the saved snapshot.
    const syncInfo = useMemo(() => {
      if (!excelSavedSnapshot || !hasFileHandle || !collectCurrentChanges) return null;

      let saved;
      try {
        saved = JSON.parse(excelSavedSnapshot);
      } catch {
        return null;
      }

      const current = collectCurrentChanges();

      // Build saved lookup maps
      const savedOverrides = new Map();
      (saved.statusOverrides || []).forEach((o) => {
        savedOverrides.set(o.opportunityId, `${o.originalStatus}→${o.newStatus}`);
      });

      const savedOpps = new Map();
      (saved.manualOpportunities || []).forEach((o) => {
        savedOpps.set(o["Opportunity ID"], JSON.stringify(o));
      });

      const savedAccounts = new Map();
      (saved.manualAccounts || []).forEach((a) => {
        savedAccounts.set(a.Account, JSON.stringify(a));
      });

      // Build current overrides from React state (always in sync, unlike localStorage)
      const currentOverrides = new Map();
      getAllOverrides.forEach((o) => {
        currentOverrides.set(o.opportunityId, `${o.originalStatus}→${o.newStatus}`);
      });

      // Build current opps/accounts from localStorage (avoids computed fields from opportunityData)
      const currentOpps = new Map();
      (current.manualOpportunities || []).forEach((o) => {
        currentOpps.set(o["Opportunity ID"], JSON.stringify(o));
      });

      const currentAccounts = new Map();
      (current.manualAccounts || []).forEach((a) => {
        currentAccounts.set(a.Account, JSON.stringify(a));
      });

      // Build saved/current maps for actions & comments
      const savedActionsMap = new Map();
      (saved.actions || []).forEach((a) => {
        savedActionsMap.set(a.id, JSON.stringify(a));
      });
      const currentActionsMap = new Map();
      (current.actions || []).forEach((a) => {
        currentActionsMap.set(a.id, JSON.stringify(a));
      });
      const savedCommentsMap = new Map();
      (saved.comments || []).forEach((c) => {
        savedCommentsMap.set(c.id, JSON.stringify(c));
      });
      const currentCommentsMap = new Map();
      (current.comments || []).forEach((c) => {
        currentCommentsMap.set(c.id, JSON.stringify(c));
      });
      const savedStaffingNeedsMap = new Map();
      (saved.staffingNeeds || []).forEach((n) => {
        savedStaffingNeedsMap.set(n.id, JSON.stringify(n));
      });
      const currentStaffingNeedsMap = new Map();
      (current.staffingNeeds || []).forEach((n) => {
        currentStaffingNeedsMap.set(n.id, JSON.stringify(n));
      });

      // Per-item sync for overrides (using getAllOverrides IDs for the UI dots)
      const overrideSynced = {};
      getAllOverrides.forEach((override) => {
        const savedKey = savedOverrides.get(override.opportunityId);
        const currentKey = currentOverrides.get(override.opportunityId);
        overrideSynced[override.opportunityId] = savedKey === currentKey;
      });

      // Per-item sync for opportunities (using manualOpportunities IDs for the UI dots)
      const oppSynced = {};
      manualOpportunities.forEach((opp) => {
        const oppId = opp["Opportunity ID"];
        const savedData = savedOpps.get(oppId);
        const currentData = currentOpps.get(oppId);
        oppSynced[oppId] = savedData === currentData;
      });

      // Per-item sync for accounts
      const accSynced = {};
      manualAccounts.forEach((acc) => {
        const savedData = savedAccounts.get(acc.Account);
        const currentData = currentAccounts.get(acc.Account);
        accSynced[acc.Account] = savedData === currentData;
      });

      // Per-item sync for actions
      const actionSynced = {};
      (current.actions || []).forEach((a) => {
        actionSynced[a.id] = savedActionsMap.get(a.id) === currentActionsMap.get(a.id);
      });

      // Per-item sync for comments
      const commentSynced = {};
      (current.comments || []).forEach((c) => {
        commentSynced[c.id] = savedCommentsMap.get(c.id) === currentCommentsMap.get(c.id);
      });

      // Per-item sync for staffing needs
      const staffingNeedSynced = {};
      (current.staffingNeeds || []).forEach((n) => {
        staffingNeedSynced[n.id] = savedStaffingNeedsMap.get(n.id) === currentStaffingNeedsMap.get(n.id);
      });

      // Tab-level: check if all items match and counts are equal
      const overridesTabSynced =
        Object.values(overrideSynced).every((v) => v) && savedOverrides.size === currentOverrides.size;
      const oppsTabSynced = Object.values(oppSynced).every((v) => v) && savedOpps.size === currentOpps.size;
      const accsTabSynced = Object.values(accSynced).every((v) => v) && savedAccounts.size === currentAccounts.size;
      const actionsTabSynced =
        Object.values(actionSynced).every((v) => v) &&
        savedActionsMap.size === currentActionsMap.size &&
        Object.values(commentSynced).every((v) => v) &&
        savedCommentsMap.size === currentCommentsMap.size;
      const staffingTabSynced =
        Object.values(staffingNeedSynced).every((v) => v) &&
        savedStaffingNeedsMap.size === currentStaffingNeedsMap.size;

      const allSynced = overridesTabSynced && oppsTabSynced && accsTabSynced && actionsTabSynced && staffingTabSynced;

      // Build detailed unsaved changes lists
      const unsavedDetails = {
        newOverrides: [],
        modifiedOverrides: [],
        removedOverrides: [],
        newOpps: [],
        modifiedOpps: [],
        removedOpps: [],
        newAccounts: [],
        modifiedAccounts: [],
        removedAccounts: [],
        newActions: [],
        modifiedActions: [],
        removedActions: [],
        newComments: [],
        modifiedComments: [],
        removedComments: [],
        newStaffingNeeds: [],
        modifiedStaffingNeeds: [],
        removedStaffingNeeds: [],
      };

      // Overrides: new or modified (current vs saved)
      currentOverrides.forEach((currentKey, oppId) => {
        const savedKey = savedOverrides.get(oppId);
        // Enrich with full override data from getAllOverrides for display
        const overrideData = getAllOverrides.find((o) => o.opportunityId === oppId) || { opportunityId: oppId };
        if (!savedKey) {
          unsavedDetails.newOverrides.push(overrideData);
        } else if (savedKey !== currentKey) {
          const [savedOriginal, savedNew] = savedKey.split("→").map(Number);
          unsavedDetails.modifiedOverrides.push({
            ...overrideData,
            savedOriginalStatus: savedOriginal,
            savedNewStatus: savedNew,
          });
        }
      });
      // Overrides: removed (in saved but not in current)
      savedOverrides.forEach((savedKey, oppId) => {
        if (!currentOverrides.has(oppId)) {
          const [savedOriginal, savedNew] = savedKey.split("→").map(Number);
          unsavedDetails.removedOverrides.push({
            opportunityId: oppId,
            savedOriginalStatus: savedOriginal,
            savedNewStatus: savedNew,
          });
        }
      });

      // Opportunities: new or modified
      currentOpps.forEach((currentData, oppId) => {
        const savedData = savedOpps.get(oppId);
        const currentOpp = JSON.parse(currentData);
        if (!savedData) {
          unsavedDetails.newOpps.push(currentOpp);
        } else if (savedData !== currentData) {
          const savedOpp = JSON.parse(savedData);
          unsavedDetails.modifiedOpps.push({ current: currentOpp, saved: savedOpp });
        }
      });
      // Opportunities: removed
      savedOpps.forEach((_, oppId) => {
        if (!currentOpps.has(oppId)) {
          unsavedDetails.removedOpps.push({ "Opportunity ID": oppId });
        }
      });

      // Accounts: new or modified
      currentAccounts.forEach((currentData, accName) => {
        const savedData = savedAccounts.get(accName);
        if (!savedData) {
          unsavedDetails.newAccounts.push(JSON.parse(currentData));
        } else if (savedData !== currentData) {
          unsavedDetails.modifiedAccounts.push({ current: JSON.parse(currentData), saved: JSON.parse(savedData) });
        }
      });
      // Accounts: removed
      savedAccounts.forEach((_, accName) => {
        if (!currentAccounts.has(accName)) {
          unsavedDetails.removedAccounts.push({ Account: accName });
        }
      });

      // Actions: new or modified
      currentActionsMap.forEach((currentData, actionId) => {
        const savedData = savedActionsMap.get(actionId);
        if (!savedData) {
          unsavedDetails.newActions.push(JSON.parse(currentData));
        } else if (savedData !== currentData) {
          unsavedDetails.modifiedActions.push({ current: JSON.parse(currentData), saved: JSON.parse(savedData) });
        }
      });
      // Actions: removed
      savedActionsMap.forEach((savedData, actionId) => {
        if (!currentActionsMap.has(actionId)) {
          unsavedDetails.removedActions.push(JSON.parse(savedData));
        }
      });

      // Comments: new or modified
      currentCommentsMap.forEach((currentData, commentId) => {
        const savedData = savedCommentsMap.get(commentId);
        if (!savedData) {
          unsavedDetails.newComments.push(JSON.parse(currentData));
        } else if (savedData !== currentData) {
          unsavedDetails.modifiedComments.push({ current: JSON.parse(currentData), saved: JSON.parse(savedData) });
        }
      });
      // Comments: removed
      savedCommentsMap.forEach((savedData, commentId) => {
        if (!currentCommentsMap.has(commentId)) {
          unsavedDetails.removedComments.push(JSON.parse(savedData));
        }
      });

      // Staffing needs: new or modified
      currentStaffingNeedsMap.forEach((currentData, needId) => {
        const savedData = savedStaffingNeedsMap.get(needId);
        if (!savedData) {
          unsavedDetails.newStaffingNeeds.push(JSON.parse(currentData));
        } else if (savedData !== currentData) {
          unsavedDetails.modifiedStaffingNeeds.push({ current: JSON.parse(currentData), saved: JSON.parse(savedData) });
        }
      });
      // Staffing needs: removed
      savedStaffingNeedsMap.forEach((savedData, needId) => {
        if (!currentStaffingNeedsMap.has(needId)) {
          unsavedDetails.removedStaffingNeeds.push(JSON.parse(savedData));
        }
      });

      const totalUnsaved =
        unsavedDetails.newOverrides.length +
        unsavedDetails.modifiedOverrides.length +
        unsavedDetails.removedOverrides.length +
        unsavedDetails.newOpps.length +
        unsavedDetails.modifiedOpps.length +
        unsavedDetails.removedOpps.length +
        unsavedDetails.newAccounts.length +
        unsavedDetails.modifiedAccounts.length +
        unsavedDetails.removedAccounts.length +
        unsavedDetails.newActions.length +
        unsavedDetails.modifiedActions.length +
        unsavedDetails.removedActions.length +
        unsavedDetails.newComments.length +
        unsavedDetails.modifiedComments.length +
        unsavedDetails.removedComments.length +
        unsavedDetails.newStaffingNeeds.length +
        unsavedDetails.modifiedStaffingNeeds.length +
        unsavedDetails.removedStaffingNeeds.length;

      return {
        overrideSynced,
        oppSynced,
        accSynced,
        actionSynced,
        commentSynced,
        staffingNeedSynced,
        overridesTabSynced,
        oppsTabSynced,
        accsTabSynced,
        actionsTabSynced,
        staffingTabSynced,
        allSynced,
        unsavedDetails,
        totalUnsaved,
        currentActions: current.actions || [],
        currentComments: current.comments || [],
        currentStaffingNeeds: current.staffingNeeds || [],
      };
    }, [
      excelSavedSnapshot,
      hasFileHandle,
      collectCurrentChanges,
      getAllOverrides,
      manualOpportunities,
      manualAccounts,
      open,
      activeTab,
      actionsRefreshKey,
    ]);

    // Create a map of opportunity data for quick lookup
    const opportunityMap = useMemo(() => {
      const map = {};
      opportunityData.forEach((opp) => {
        map[opp["Opportunity ID"]] = opp;
      });
      return map;
    }, [opportunityData]);

    // Listen for real-time actions/comments changes from OpportunityActions component
    useEffect(() => {
      const handler = () => setActionsRefreshKey((k) => k + 1);
      window.addEventListener("actionsCommentsChanged", handler);
      return () => window.removeEventListener("actionsCommentsChanged", handler);
    }, []);

    const handleOpen = () => setOpen(true);
    const handleClose = () => {
      setOpen(false);
      setConfirmClearAll(false);
      setDeleteConfirm(null);
    };

    const handleRevert = (opportunityId, event) => {
      event.stopPropagation();
      removeStatusOverride(opportunityId);
    };

    const handleOpenOpportunityPopup = (opportunity, initialActionsTab) => {
      setSelectedOpportunity(opportunity);
      setPopupInitialActionsTab(initialActionsTab);
    };

    const handleCloseOpportunityPopup = () => {
      setSelectedOpportunity(null);
      setPopupInitialActionsTab(undefined);
    };

    const handleDeleteManual = (opportunityId, event) => {
      event.stopPropagation();
      setDeleteConfirm(opportunityId);
    };

    const confirmDeleteManual = () => {
      if (deleteConfirm && onDeleteManualOpportunity) {
        onDeleteManualOpportunity(deleteConfirm);
        setDeleteConfirm(null);
      }
    };

    const handleClearAll = () => {
      if (activeTab === 0) clearAllOverrides();
      else if (activeTab === 1 && onClearAllManualOpportunities) onClearAllManualOpportunities();
      else if (activeTab === 2 && onClearAllManualAccounts) onClearAllManualAccounts();
      else if (activeTab === 3) {
        // Clear all actions, comments, and staffing needs from localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key?.startsWith("opportunity_actions_") ||
            key?.startsWith("opportunity_comments_") ||
            key?.startsWith("staffing_needs_")
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        setActionsRefreshKey((k) => k + 1);
        window.dispatchEvent(new CustomEvent("actionsCommentsChanged"));
        window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));
      }
      setConfirmClearAll(false);
      setSelectedItems(new Set());
    };

    // Multi-select helpers
    const toggleSelect = (id) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const toggleSelectAll = (ids) => {
      setSelectedItems((prev) => {
        const allSelected = ids.every((id) => prev.has(id));
        if (allSelected) return new Set();
        return new Set(ids);
      });
    };

    // When allCollapsed is false: groups in collapsedGroups set are collapsed (normal)
    // When allCollapsed is true: groups NOT in collapsedGroups set are collapsed (inverted)
    const isGroupCollapsed = (groupKey) => {
      return allCollapsed ? !collapsedGroups.has(groupKey) : collapsedGroups.has(groupKey);
    };

    const toggleGroupCollapse = (groupKey) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) next.delete(groupKey);
        else next.add(groupKey);
        return next;
      });
    };

    // Reset search when tab changes
    useEffect(() => {
      setSearchText("");
    }, [activeTab]);

    const handleDeleteSelected = () => {
      if (activeTab === 0) {
        selectedItems.forEach((id) => removeStatusOverride(id));
      } else if (activeTab === 1) {
        selectedItems.forEach((id) => onDeleteManualOpportunity && onDeleteManualOpportunity(id));
      } else if (activeTab === 2) {
        selectedItems.forEach((id) => onDeleteManualAccount && onDeleteManualAccount(id));
      } else if (activeTab === 3) {
        // Delete selected actions and comments from localStorage
        const idsToDelete = new Set(selectedItems);
        const keysToProcess = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("opportunity_actions_") || key?.startsWith("opportunity_comments_")) {
            keysToProcess.push(key);
          }
        }
        keysToProcess.forEach((key) => {
          try {
            const items = JSON.parse(localStorage.getItem(key));
            const filtered = items.filter((item) => !idsToDelete.has(item.id));
            if (filtered.length === 0) localStorage.removeItem(key);
            else if (filtered.length !== items.length) localStorage.setItem(key, JSON.stringify(filtered));
          } catch {
            /* ignore */
          }
        });
        setActionsRefreshKey((k) => k + 1);
        window.dispatchEvent(new CustomEvent("actionsCommentsChanged"));
      } else if (activeTab === 4) {
        // Delete selected staffing needs from localStorage
        const idsToDelete = new Set(selectedItems);
        const keysToProcess = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("staffing_needs_")) {
            keysToProcess.push(key);
          }
        }
        keysToProcess.forEach((key) => {
          try {
            const items = JSON.parse(localStorage.getItem(key));
            const filtered = items.filter((item) => !idsToDelete.has(item.id));
            if (filtered.length === 0) localStorage.removeItem(key);
            else if (filtered.length !== items.length) localStorage.setItem(key, JSON.stringify(filtered));
          } catch {
            /* ignore */
          }
        });
        setActionsRefreshKey((k) => k + 1);
        window.dispatchEvent(new CustomEvent("staffingNeedsChanged"));
      }
      setSelectedItems(new Set());
    };

    const formatDate = (isoString) => {
      if (!isoString) return "-";
      return new Date(isoString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatDateShort = (isoString) => {
      if (!isoString) return "-";
      return new Date(isoString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    // Generate report content as table format
    const generateReportContent = () => {
      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      let report = `ACTION ITEMS REPORT - ${today}\n`;
      report += `${"=".repeat(120)}\n\n`;

      // Summary
      report += `SUMMARY\n`;
      report += `${"-".repeat(40)}\n`;
      report += `• Statuses to modify in CRM: ${overrideCount}\n`;
      report += `• Opportunities to create in CRM: ${manualCount}\n`;
      report += `• Accounts to create in CRM: ${accountCount}\n`;
      report += `• Total actions: ${totalCount}\n\n`;

      // Status overrides section as table
      if (overrideCount > 0) {
        report += `\n${"=".repeat(120)}\n`;
        report += `STATUSES TO MODIFY IN CRM\n`;
        report += `${"=".repeat(120)}\n\n`;

        // Table header
        const col1 = "Opportunity".padEnd(35);
        const col2 = "Account".padEnd(20);
        const col3 = "Manager".padEnd(20);
        const col4 = "Action".padEnd(25);
        const col5 = "Amount".padEnd(15);
        report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
        report += `${"-".repeat(35)} | ${"-".repeat(20)} | ${"-".repeat(20)} | ${"-".repeat(25)} | ${"-".repeat(15)}\n`;

        getAllOverrides.forEach((override) => {
          const opportunity = opportunityMap[override.opportunityId];
          const oppName = (opportunity?.["Opportunity"] || override.opportunityId).substring(0, 33).padEnd(35);
          const account = (opportunity?.["Account"] || "-").substring(0, 18).padEnd(20);
          const manager = (opportunity?.["Manager"] || opportunity?.["EM"] || "-").substring(0, 18).padEnd(20);
          const action = `${getStatusLabel(override.originalStatus)} → ${getStatusLabel(override.newStatus)}`.padEnd(
            25
          );
          const revenue = new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
            .format(opportunity?.["Gross Revenue"] || 0)
            .padEnd(15);

          report += `${oppName} | ${account} | ${manager} | ${action} | ${revenue}\n`;
        });

        report += `\n`;
      }

      // Manual opportunities section as table
      if (manualCount > 0) {
        report += `\n${"=".repeat(120)}\n`;
        report += `OPPORTUNITIES TO CREATE IN CRM\n`;
        report += `${"=".repeat(120)}\n\n`;

        // Table header
        const col1 = "Opportunity".padEnd(35);
        const col2 = "Account".padEnd(20);
        const col3 = "Manager".padEnd(20);
        const col4 = "Status".padEnd(15);
        const col5 = "Amount".padEnd(15);
        report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
        report += `${"-".repeat(35)} | ${"-".repeat(20)} | ${"-".repeat(20)} | ${"-".repeat(15)} | ${"-".repeat(15)}\n`;

        manualOpportunities.forEach((opp) => {
          const oppName = (opp["Opportunity"] || opp["Opportunity ID"]).substring(0, 33).padEnd(35);
          const account = (opp["Account"] || "-").substring(0, 18).padEnd(20);
          const manager = (opp["Manager"] || opp["EM"] || "-").substring(0, 18).padEnd(20);
          const status = getStatusLabel(opp["Status"]).padEnd(15);
          const revenue = new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
            .format(opp["Gross Revenue"] || 0)
            .padEnd(15);

          report += `${oppName} | ${account} | ${manager} | ${status} | ${revenue}\n`;
        });

        report += `\n`;
      }

      // Accounts to create section
      if (accountCount > 0) {
        report += `\n${"=".repeat(120)}\n`;
        report += `ACCOUNTS TO CREATE IN CRM\n`;
        report += `${"=".repeat(120)}\n\n`;

        const col1 = "Account Name".padEnd(30);
        const col2 = "Parent Account".padEnd(25);
        const col3 = "Segment".padEnd(10);
        const col4 = "Sub-Segment".padEnd(20);
        const col5 = "Country".padEnd(15);
        report += `${col1} | ${col2} | ${col3} | ${col4} | ${col5}\n`;
        report += `${"-".repeat(30)} | ${"-".repeat(25)} | ${"-".repeat(10)} | ${"-".repeat(20)} | ${"-".repeat(15)}\n`;

        manualAccounts.forEach((acc) => {
          const name = (acc.Account || "-").substring(0, 28).padEnd(30);
          const parent = (acc["Parent Account"] || "-").substring(0, 23).padEnd(25);
          const segment = (acc["Sub Segment Code"] || "-").substring(0, 8).padEnd(10);
          const subSeg = (acc["Sub Segment"] || "-").substring(0, 18).padEnd(20);
          const country = (acc.Country || "-").substring(0, 13).padEnd(15);
          report += `${name} | ${parent} | ${segment} | ${subSeg} | ${country}\n`;
        });

        report += `\n`;
      }

      // Actions checklist by manager
      report += `\n${"=".repeat(120)}\n`;
      report += `ACTIONS BY MANAGER\n`;
      report += `${"=".repeat(120)}\n\n`;

      // Group actions by manager
      const actionsByManager = {};

      // Add status overrides
      getAllOverrides.forEach((override) => {
        const opportunity = opportunityMap[override.opportunityId];
        const manager = opportunity?.["Manager"] || opportunity?.["EM"] || "Unassigned";
        if (!actionsByManager[manager]) {
          actionsByManager[manager] = { overrides: [], creates: [] };
        }
        actionsByManager[manager].overrides.push({
          name: opportunity?.["Opportunity"] || override.opportunityId,
          from: getStatusLabel(override.originalStatus),
          to: getStatusLabel(override.newStatus),
        });
      });

      // Add manual opportunities
      manualOpportunities.forEach((opp) => {
        const manager = opp["Manager"] || opp["EM"] || "Unassigned";
        if (!actionsByManager[manager]) {
          actionsByManager[manager] = { overrides: [], creates: [] };
        }
        actionsByManager[manager].creates.push({
          name: opp["Opportunity"] || opp["Opportunity ID"],
          account: opp["Account"],
          status: getStatusLabel(opp["Status"]),
        });
      });

      // Output by manager
      Object.keys(actionsByManager)
        .sort()
        .forEach((manager) => {
          const actions = actionsByManager[manager];
          const totalActions = actions.overrides.length + actions.creates.length;

          report += `\n► ${manager} (${totalActions} action${totalActions > 1 ? "s" : ""})\n`;
          report += `${"-".repeat(60)}\n`;

          if (actions.overrides.length > 0) {
            report += `  Statuses to modify:\n`;
            actions.overrides.forEach((a) => {
              report += `    □ ${a.name}: ${a.from} → ${a.to}\n`;
            });
          }

          if (actions.creates.length > 0) {
            report += `  Opportunities to create:\n`;
            actions.creates.forEach((a) => {
              report += `    □ ${a.name} (${a.account}) - ${a.status}\n`;
            });
          }
        });

      report += `\n${"=".repeat(120)}\n`;
      report += `Generated from AIM Team Dashboard - ${today}\n`;

      return report;
    };

    // Copy report to clipboard
    const handleCopyReport = async () => {
      const report = generateReportContent();
      try {
        await navigator.clipboard.writeText(report);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy report:", err);
      }
    };

    // Download report as text file
    const handleDownloadReport = () => {
      const report = generateReportContent();
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().split("T")[0];
      link.download = `modifications-report-${today}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Generate export data as JSON
    const generateExportData = () => {
      // Collect all actions and comments from localStorage
      const allActions = [];
      const allComments = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith("opportunity_actions_")) {
          try {
            const opportunityId = key.replace("opportunity_actions_", "");
            const actions = JSON.parse(localStorage.getItem(key));
            actions.forEach((action) => {
              allActions.push({
                opportunityId: action.opportunityId || opportunityId,
                opportunityName: action.opportunityName || "",
                id: action.id,
                owner: action.owner,
                description: action.description,
                dueDate: action.dueDate,
                priority: action.priority,
                status: action.status,
                createdAt: action.createdAt,
              });
            });
          } catch (e) {
            console.error("Error parsing actions:", e);
          }
        }

        if (key && key.startsWith("opportunity_comments_")) {
          try {
            const opportunityId = key.replace("opportunity_comments_", "");
            const comments = JSON.parse(localStorage.getItem(key));
            comments.forEach((comment) => {
              allComments.push({
                opportunityId: opportunityId,
                id: comment.id,
                author: comment.author,
                text: comment.text,
                commentType: comment.type || "specific",
                createdAt: comment.createdAt,
              });
            });
          } catch (e) {
            console.error("Error parsing comments:", e);
          }
        }
      }

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        statusOverrides: getAllOverrides.map((override) => ({
          opportunityId: override.opportunityId,
          originalStatus: override.originalStatus,
          newStatus: override.newStatus,
          comment: override.comment || "",
          modifiedAt: override.modifiedAt,
        })),
        manualOpportunities: manualOpportunities.map((opp) => ({
          ...opp,
          exportedAt: new Date().toISOString(),
        })),
        manualAccounts: manualAccounts.map((acc) => ({
          Account: acc.Account,
          "Sub Segment Code": acc["Sub Segment Code"] || "",
          "Sub Segment": acc["Sub Segment"] || "",
          Country: acc.Country || "",
          "Parent Account": acc["Parent Account"] || "",
          createdAt: acc.createdAt || new Date().toISOString(),
        })),
        actionsComments: {
          actions: allActions,
          comments: allComments,
        },
      };
      return exportData;
    };

    // Download export as JSON file
    const handleExportJSON = () => {
      const exportData = generateExportData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().split("T")[0];
      link.download = `dashboard-changes-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Handle file import
    const handleImportFile = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportResult(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          processImport(importData);
        } catch (err) {
          setImportResult({
            success: false,
            error: "Invalid JSON file. Please select a valid export file.",
            details: null,
          });
          setIsImporting(false);
        }
      };
      reader.onerror = () => {
        setImportResult({
          success: false,
          error: "Failed to read file.",
          details: null,
        });
        setIsImporting(false);
      };
      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    // Format currency for display
    const formatCurrency = (value) => {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value || 0);
    };

    // Process imported data with status comparison logic
    const processImport = (importData) => {
      const results = {
        statusOverrides: { created: [], updated: [], skipped: [] },
        manualOpportunities: { created: [], updated: [], skipped: [] },
        manualAccounts: { created: [], skipped: [] },
        actionsComments: {
          actions: { created: [], updated: [], skipped: [] },
          comments: { created: [], updated: [], skipped: [] },
        },
      };

      // Process status overrides
      if (importData.statusOverrides && Array.isArray(importData.statusOverrides)) {
        importData.statusOverrides.forEach((override) => {
          const existingOpp = opportunityMap[override.opportunityId];

          // Build imported data summary
          const importedData = {
            originalStatus: getStatusLabel(override.originalStatus),
            newStatus: getStatusLabel(override.newStatus),
            newStatusCode: override.newStatus,
            comment: override.comment || "-",
          };

          if (existingOpp) {
            // Get the current status from CRM data
            const currentCRMStatus = existingOpp["Status"];

            // Build existing data summary
            const existingData = {
              status: getStatusLabel(currentCRMStatus),
              statusCode: currentCRMStatus,
              account: existingOpp["Account"] || "-",
              revenue: formatCurrency(existingOpp["Gross Revenue"]),
            };

            // Compare: if CRM status is more advanced (higher), skip import
            const isCRMMoreAdvanced =
              currentCRMStatus >= override.newStatus || currentCRMStatus === 14 || currentCRMStatus === 15;

            if (isCRMMoreAdvanced && currentCRMStatus !== override.originalStatus) {
              results.statusOverrides.skipped.push({
                opportunityId: override.opportunityId,
                opportunityName: existingOpp["Opportunity"] || override.opportunityId,
                existing: existingData,
                imported: importedData,
                decision: "skipped",
                reason:
                  currentCRMStatus === 14
                    ? "CRM status is already Booked (final state)"
                    : currentCRMStatus === 15
                      ? "CRM status is already Lost (final state)"
                      : `CRM status (${getStatusLabel(currentCRMStatus)}) is more advanced`,
              });
            } else {
              // Apply the override
              setStatusOverride(override.opportunityId, override.originalStatus, override.newStatus, override.comment);
              results.statusOverrides.updated.push({
                opportunityId: override.opportunityId,
                opportunityName: existingOpp["Opportunity"] || override.opportunityId,
                existing: existingData,
                imported: importedData,
                decision: "updated",
                reason: "Status override applied",
              });
            }
          } else {
            results.statusOverrides.skipped.push({
              opportunityId: override.opportunityId,
              opportunityName: override.opportunityId,
              existing: null,
              imported: importedData,
              decision: "skipped",
              reason: "Opportunity not found in current data",
            });
          }
        });
      }

      // Process manual opportunities
      if (importData.manualOpportunities && Array.isArray(importData.manualOpportunities)) {
        importData.manualOpportunities.forEach((opp) => {
          const oppId = opp["Opportunity ID"];
          const oppName = opp["Opportunity"] || oppId;

          // Build imported data summary
          const importedData = {
            name: oppName,
            account: opp["Account"] || "-",
            status: getStatusLabel(opp["Status"]),
            statusCode: opp["Status"],
            revenue: formatCurrency(opp["Gross Revenue"]),
            manager: opp["Manager"] || opp["EM"] || "-",
          };

          // Check if this manual opportunity already exists
          const existingManual = manualOpportunities.find((m) => m["Opportunity ID"] === oppId);

          if (existingManual) {
            const existingStatus = existingManual["Status"];
            const importStatus = opp["Status"];

            // Build existing data summary
            const existingData = {
              name: existingManual["Opportunity"] || oppId,
              account: existingManual["Account"] || "-",
              status: getStatusLabel(existingStatus),
              statusCode: existingStatus,
              revenue: formatCurrency(existingManual["Gross Revenue"]),
              manager: existingManual["Manager"] || existingManual["EM"] || "-",
            };

            // Skip if existing is more advanced
            if (existingStatus >= importStatus || existingStatus === 14 || existingStatus === 15) {
              results.manualOpportunities.skipped.push({
                opportunityId: oppId,
                opportunityName: oppName,
                existing: existingData,
                imported: importedData,
                decision: "skipped",
                reason:
                  existingStatus === 14
                    ? "Existing opportunity is already Booked (final state)"
                    : existingStatus === 15
                      ? "Existing opportunity is already Lost (final state)"
                      : "Existing status is more advanced",
              });
            } else {
              // Update existing - delegate to parent
              onManualOpportunityUpdated?.(opp);
              results.manualOpportunities.updated.push({
                opportunityId: oppId,
                opportunityName: oppName,
                existing: existingData,
                imported: importedData,
                decision: "updated",
                reason: "Imported status is more advanced",
              });
            }
          } else {
            // Add new manual opportunity
            if (onAddManualOpportunity) {
              onAddManualOpportunity(opp);
              results.manualOpportunities.created.push({
                opportunityId: oppId,
                opportunityName: oppName,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New opportunity",
              });
            } else {
              results.manualOpportunities.skipped.push({
                opportunityId: oppId,
                opportunityName: oppName,
                existing: null,
                imported: importedData,
                decision: "skipped",
                reason: "Cannot create: handler not available",
              });
            }
          }
        });
      }

      // Process actions with detailed comparison
      if (importData.actionsComments) {
        const actions = importData.actionsComments.actions || [];
        actions.forEach((action) => {
          try {
            const storageKey = `opportunity_actions_${action.opportunityId}`;
            let existingActions = [];
            try {
              const stored = localStorage.getItem(storageKey);
              if (stored) existingActions = JSON.parse(stored);
            } catch (e) {}

            const existingIndex = existingActions.findIndex((a) => a.id === action.id);

            // Build imported data summary
            const importedData = {
              description: action.description || "-",
              owner: action.owner || "-",
              status: action.status || "-",
              priority: action.priority || "-",
              dueDate: formatDateShort(action.dueDate),
            };

            if (existingIndex >= 0) {
              const existingAction = existingActions[existingIndex];

              // Build existing data summary
              const existingData = {
                description: existingAction.description || "-",
                owner: existingAction.owner || "-",
                status: existingAction.status || "-",
                priority: existingAction.priority || "-",
                dueDate: formatDateShort(existingAction.dueDate),
              };

              // Check what changed
              const changes = [];
              if (existingAction.description !== action.description) changes.push("description");
              if (existingAction.owner !== action.owner) changes.push("owner");
              if (existingAction.status !== action.status) changes.push("status");
              if (existingAction.priority !== action.priority) changes.push("priority");
              if (existingAction.dueDate !== action.dueDate) changes.push("dueDate");

              if (changes.length > 0) {
                // Update existing action
                existingActions[existingIndex] = action;
                localStorage.setItem(storageKey, JSON.stringify(existingActions));

                results.actionsComments.actions.updated.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes: changes,
                });
              } else {
                // No changes, skip
                results.actionsComments.actions.skipped.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              // New action
              existingActions.push(action);
              localStorage.setItem(storageKey, JSON.stringify(existingActions));

              results.actionsComments.actions.created.push({
                id: action.id,
                opportunityId: action.opportunityId,
                opportunityName: action.opportunityName || action.opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New action",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing action:", e);
          }
        });

        // Process comments with detailed comparison
        const comments = importData.actionsComments.comments || [];
        comments.forEach((comment) => {
          try {
            const storageKey = `opportunity_comments_${comment.opportunityId}`;
            let existingComments = [];
            try {
              const stored = localStorage.getItem(storageKey);
              if (stored) existingComments = JSON.parse(stored);
            } catch (e) {}

            const existingIndex = existingComments.findIndex((c) => c.id === comment.id);

            // Build imported data summary
            const importedData = {
              text: comment.text || "-",
              author: comment.author || "-",
              type: comment.commentType || "specific",
              createdAt: formatDateShort(comment.createdAt),
            };

            const newCommentObj = {
              id: comment.id,
              text: comment.text,
              author: comment.author,
              type: comment.commentType || "specific",
              createdAt: comment.createdAt,
            };

            if (existingIndex >= 0) {
              const existingComment = existingComments[existingIndex];

              // Build existing data summary
              const existingData = {
                text: existingComment.text || "-",
                author: existingComment.author || "-",
                type: existingComment.type || "specific",
                createdAt: formatDateShort(existingComment.createdAt),
              };

              // Check what changed
              const changes = [];
              if (existingComment.text !== comment.text) changes.push("text");
              if (existingComment.author !== comment.author) changes.push("author");

              if (changes.length > 0) {
                // Update existing comment
                existingComments[existingIndex] = newCommentObj;
                localStorage.setItem(storageKey, JSON.stringify(existingComments));

                results.actionsComments.comments.updated.push({
                  id: comment.id,
                  opportunityId: comment.opportunityId,
                  opportunityName: comment.opportunityName || comment.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes: changes,
                });
              } else {
                // No changes, skip
                results.actionsComments.comments.skipped.push({
                  id: comment.id,
                  opportunityId: comment.opportunityId,
                  opportunityName: comment.opportunityName || comment.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              // New comment
              existingComments.push(newCommentObj);
              localStorage.setItem(storageKey, JSON.stringify(existingComments));

              results.actionsComments.comments.created.push({
                id: comment.id,
                opportunityId: comment.opportunityId,
                opportunityName: comment.opportunityName || comment.opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New comment",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing comment:", e);
          }
        });
      }

      // Process manual accounts
      if (importData.manualAccounts && Array.isArray(importData.manualAccounts)) {
        const existingAccountNames = new Set(manualAccounts.map((a) => a.Account));

        importData.manualAccounts.forEach((acc) => {
          const accName = acc.Account;
          const importedData = {
            name: accName || "-",
            parent: acc["Parent Account"] || "-",
            segment: acc["Sub Segment Code"] || "-",
            subSegment: acc["Sub Segment"] || "-",
            country: acc.Country || "-",
          };

          if (existingAccountNames.has(accName)) {
            results.manualAccounts.skipped.push({
              accountName: accName,
              imported: importedData,
              decision: "skipped",
              reason: "Account already exists",
            });
          } else {
            if (onAddManualAccount) {
              onAddManualAccount({
                Account: acc.Account,
                "Sub Segment Code": acc["Sub Segment Code"] || "",
                "Sub Segment": acc["Sub Segment"] || "",
                Country: acc.Country || "",
                "Parent Account": acc["Parent Account"] || "",
              });
            }
            existingAccountNames.add(accName);
            results.manualAccounts.created.push({
              accountName: accName,
              imported: importedData,
              decision: "created",
              reason: "New account",
            });
          }
        });
      }

      setImportResult({
        success: true,
        error: null,
        details: results,
      });
      setIsImporting(false);
    };

    return (
      <>
        {/* Three-state toggle: off (CRM only) / all (CRM+changes) / changes (changes only) */}
        {/* Switch cycles: off → all → changes → off. Label click opens dialog. */}
        <Tooltip
          title={
            {
              off: "CRM data only",
              all: "CRM data + local changes",
              changes: "Local changes only — click label to manage",
            }[modificationsEnabled]
          }
        >
          <FormControlLabel
            control={
              <Switch
                checked={modificationsEnabled !== "off"}
                onChange={() => {
                  const next = { off: "all", all: "changes", changes: "off" };
                  onToggleModifications?.(next[modificationsEnabled]);
                }}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: modificationsEnabled === "changes" ? "#9575CD" : "#FFB74D",
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: modificationsEnabled === "changes" ? "#7E57C2" : "#FFA726",
                  },
                  "& .MuiSwitch-track": {
                    backgroundColor: "rgba(255,255,255,0.3)",
                  },
                }}
              />
            }
            label={
              <Box
                onClick={(e) => {
                  if (modificationsEnabled !== "off") {
                    e.preventDefault();
                    handleOpen();
                  }
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: modificationsEnabled !== "off" ? "pointer" : "default",
                }}
              >
                <EditNoteIcon sx={{ mr: 0.5, fontSize: 18, color: "white" }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: "0.8rem", color: "white" }}>
                  {{ off: "CRM Only", all: "CRM + Chang.", changes: "Changes Only" }[modificationsEnabled]}
                </Typography>
              </Box>
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 1.5,
              py: 0.25,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          />
        </Tooltip>

        {/* Saved/Excel toggle — auto-OFF when unsaved, click OFF→ON opens save confirmation */}
        {hasFileHandle && (
          <FormControlLabel
            control={
              <Switch
                checked={!!(syncInfo && syncInfo.allSynced)}
                onChange={() => {
                  if (syncInfo && !syncInfo.allSynced) {
                    setConfirmSaveOpen(true);
                  }
                }}
                disabled={!syncInfo || syncInfo.allSynced || isSavingExcel}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: "#4CAF50",
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: "#66BB6A",
                  },
                  "& .MuiSwitch-track": {
                    backgroundColor: syncInfo && !syncInfo.allSynced ? "#FFB74D" : "rgba(255,255,255,0.3)",
                  },
                }}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <SaveIcon sx={{ mr: 0.5, fontSize: 18, color: "white" }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: "0.8rem", color: "white" }}>
                  {syncInfo && !syncInfo.allSynced ? `${syncInfo.totalUnsaved || 0} Unsaved` : "Saved"}
                </Typography>
              </Box>
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 1.5,
              py: 0.25,
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          />
        )}

        {/* Refresh from Excel button */}
        {hasFileHandle && onRefreshFromExcel && (
          <Tooltip title="Refresh data from Excel file">
            <span>
              <IconButton
                size="small"
                onClick={() => {
                  if (syncInfo && !syncInfo.allSynced) {
                    setConfirmRefreshOpen(true);
                  } else {
                    // No unsaved changes — refresh directly
                    (async () => {
                      setIsRefreshing(true);
                      const result = await onRefreshFromExcel();
                      setIsRefreshing(false);
                      if (result?.success) {
                        setResultDialog({
                          title: "Refresh Complete",
                          message: `Data refreshed from ${result.fileName}`,
                          severity: "success",
                        });
                      } else if (result?.error) {
                        setResultDialog({ title: "Refresh Failed", message: result.error, severity: "error" });
                      }
                    })();
                  }
                }}
                disabled={isLoading || isRefreshing}
                sx={{
                  color: "white",
                  ml: -0.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
                  ...(isRefreshing && {
                    animation: "spin 1s linear infinite",
                    "@keyframes spin": {
                      "0%": { transform: "rotate(0deg)" },
                      "100%": { transform: "rotate(360deg)" },
                    },
                  }),
                }}
              >
                {isRefreshing ? (
                  <CircularProgress size={18} sx={{ color: "white" }} />
                ) : (
                  <RefreshIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Save Confirmation Dialog - shows unsaved details before writing to Excel */}
        <Dialog
          open={confirmSaveOpen}
          onClose={() => {
            setConfirmSaveOpen(false);
            setMergeResultInfo(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {mergeResultInfo ? (
              <>
                <InfoOutlinedIcon sx={{ color: "info.main" }} />
                <Typography variant="h6" fontWeight={600}>
                  Saved — Remote changes detected
                </Typography>
              </>
            ) : conflictResolution ? (
              <>
                <WarningIcon sx={{ color: "warning.main" }} />
                <Typography variant="h6" fontWeight={600}>
                  Resolve Conflicts
                </Typography>
              </>
            ) : (
              <>
                <SaveIcon sx={{ color: "success.main" }} />
                <Typography variant="h6" fontWeight={600}>
                  Save to Excel?
                </Typography>
              </>
            )}
          </DialogTitle>
          <DialogContent dividers>
            {mergeResultInfo ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Your changes were saved. Another user has also modified this file — here's what was merged:
                </Typography>

                {/* Remote additions */}
                {mergeResultInfo.remoteInfo.added.length > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, color: "success.main" }}
                    >
                      <AddCircleOutlineIcon sx={{ fontSize: 16 }} /> Remote additions (auto-merged)
                    </Typography>
                    {mergeResultInfo.remoteInfo.added.map((entry, i) => (
                      <Box
                        key={i}
                        sx={{
                          ml: 2,
                          mb: 0.5,
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.success.main, 0.06),
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          + [{entry.type}] {entry.key}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Remote modifications */}
                {mergeResultInfo.remoteInfo.modified.length > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, color: "info.main" }}
                    >
                      <UpdateIcon sx={{ fontSize: 16 }} /> Remote modifications (auto-merged)
                    </Typography>
                    {mergeResultInfo.remoteInfo.modified.map((entry, i) => (
                      <Box
                        key={i}
                        sx={{ ml: 2, mb: 0.5, p: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.06) }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          ~ [{entry.type}] {entry.key}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Remote deletions — user specifically asked to be informed */}
                {mergeResultInfo.remoteInfo.removed.length > 0 && (
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                      bgcolor: alpha(theme.palette.warning.main, 0.06),
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, color: "warning.main" }}
                    >
                      <WarningIcon sx={{ fontSize: 16 }} /> Removed by remote user
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", mb: 1, color: "text.secondary" }}>
                      These items were deleted by another user and have been removed from the saved file.
                    </Typography>
                    {mergeResultInfo.remoteInfo.removed.map((entry, i) => (
                      <Box
                        key={i}
                        sx={{
                          ml: 2,
                          mb: 0.5,
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.error.main, 0.06),
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          - [{entry.type}] {entry.key}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Conflicts */}
                {mergeResultInfo.conflicts.length > 0 && (
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
                      bgcolor: alpha(theme.palette.error.main, 0.06),
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, color: "error.main" }}
                    >
                      <WarningIcon sx={{ fontSize: 16 }} /> Conflicts (your version kept)
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", mb: 1, color: "text.secondary" }}>
                      Both you and another user modified these items. Your version was kept.
                    </Typography>
                    {mergeResultInfo.conflicts.map((entry, i) => (
                      <Box
                        key={i}
                        sx={{
                          ml: 2,
                          mb: 0.5,
                          p: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.error.main, 0.08),
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          ⚡ [{entry.type}] {entry.key}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : conflictResolution ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <WarningIcon sx={{ fontSize: 16, color: "warning.main", verticalAlign: "middle", mr: 0.5 }} />
                  <strong>
                    {conflictResolution.mergeResult.conflicts.length} conflict
                    {conflictResolution.mergeResult.conflicts.length > 1 ? "s" : ""}
                  </strong>{" "}
                  detected — another user modified the same items. Choose which version to keep for each:
                </Typography>

                {conflictResolution.mergeResult.conflicts.map((conflict, i) => {
                  const chosen = conflictResolution.choices[conflict.key];
                  return (
                    <Box
                      key={i}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.warning.main, 0.02),
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                        [{conflict.type}] {conflict.key}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box
                            onClick={() =>
                              setConflictResolution((prev) => ({
                                ...prev,
                                choices: { ...prev.choices, [conflict.key]: "local" },
                              }))
                            }
                            sx={{
                              p: 1.5,
                              border: `2px solid`,
                              borderColor: chosen === "local" ? "primary.main" : "divider",
                              borderRadius: 1,
                              cursor: "pointer",
                              bgcolor: chosen === "local" ? alpha(theme.palette.primary.main, 0.06) : "transparent",
                              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                              transition: "all 0.15s",
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color={chosen === "local" ? "primary.main" : "text.secondary"}
                              sx={{ display: "block", mb: 1 }}
                            >
                              Your version {chosen === "local" ? "✓" : ""}
                            </Typography>
                            {conflict.type === "override" && conflict.local && (
                              <Box>
                                <Typography variant="caption" display="block">
                                  Status: {getStatusLabel(conflict.local.originalStatus)} →{" "}
                                  {getStatusLabel(conflict.local.newStatus)}
                                </Typography>
                                {conflict.local.comment && (
                                  <Typography variant="caption" display="block" sx={{ fontStyle: "italic" }}>
                                    "{conflict.local.comment}"
                                  </Typography>
                                )}
                              </Box>
                            )}
                            {conflict.type !== "override" && (
                              <Typography
                                variant="caption"
                                component="pre"
                                sx={{
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: "0.7rem",
                                  maxHeight: 120,
                                  overflow: "auto",
                                }}
                              >
                                {JSON.stringify(conflict.local, null, 2)}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box
                            onClick={() =>
                              setConflictResolution((prev) => ({
                                ...prev,
                                choices: { ...prev.choices, [conflict.key]: "remote" },
                              }))
                            }
                            sx={{
                              p: 1.5,
                              border: `2px solid`,
                              borderColor: chosen === "remote" ? "info.main" : "divider",
                              borderRadius: 1,
                              cursor: "pointer",
                              bgcolor: chosen === "remote" ? alpha(theme.palette.info.main, 0.06) : "transparent",
                              "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.04) },
                              transition: "all 0.15s",
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color={chosen === "remote" ? "info.main" : "text.secondary"}
                              sx={{ display: "block", mb: 1 }}
                            >
                              Remote version {chosen === "remote" ? "✓" : ""}
                            </Typography>
                            {conflict.type === "override" && conflict.remote && (
                              <Box>
                                <Typography variant="caption" display="block">
                                  Status: {getStatusLabel(conflict.remote.originalStatus)} →{" "}
                                  {getStatusLabel(conflict.remote.newStatus)}
                                </Typography>
                                {conflict.remote.comment && (
                                  <Typography variant="caption" display="block" sx={{ fontStyle: "italic" }}>
                                    "{conflict.remote.comment}"
                                  </Typography>
                                )}
                              </Box>
                            )}
                            {conflict.type !== "override" && (
                              <Typography
                                variant="caption"
                                component="pre"
                                sx={{
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontSize: "0.7rem",
                                  maxHeight: 120,
                                  overflow: "auto",
                                }}
                              >
                                {JSON.stringify(conflict.remote, null, 2)}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  );
                })}

                {/* Also show non-conflict remote changes for info */}
                {conflictResolution.mergeResult.remoteInfo?.added?.length > 0 && (
                  <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, color: "success.main" }}>
                      <AddCircleOutlineIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} /> Remote additions
                      (will be auto-merged)
                    </Typography>
                    {conflictResolution.mergeResult.remoteInfo.added.map((entry, i) => (
                      <Typography key={i} variant="caption" display="block" sx={{ ml: 2 }}>
                        + [{entry.type}] {entry.key}
                      </Typography>
                    ))}
                  </Box>
                )}
                {conflictResolution.mergeResult.remoteInfo?.modified?.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, color: "info.main" }}>
                      <UpdateIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} /> Remote modifications (will
                      be auto-merged)
                    </Typography>
                    {conflictResolution.mergeResult.remoteInfo.modified.map((entry, i) => (
                      <Typography key={i} variant="caption" display="block" sx={{ ml: 2 }}>
                        ~ [{entry.type}] {entry.key}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              syncInfo &&
              syncInfo.unsavedDetails && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {syncInfo.totalUnsaved} modification{syncInfo.totalUnsaved !== 1 ? "s" : ""} to write:
                  </Typography>

                  {/* Status Overrides */}
                  {(syncInfo.unsavedDetails.newOverrides.length > 0 ||
                    syncInfo.unsavedDetails.modifiedOverrides.length > 0 ||
                    syncInfo.unsavedDetails.removedOverrides.length > 0) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <SwapHorizIcon sx={{ fontSize: 16 }} /> Status Overrides
                      </Typography>
                      {syncInfo.unsavedDetails.newOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.5,
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.06),
                            }}
                          >
                            <Typography variant="caption" fontWeight={600}>
                              + {oppName}: {getStatusLabel(o.originalStatus)} → {getStatusLabel(o.newStatus)}
                            </Typography>
                          </Box>
                        );
                      })}
                      {syncInfo.unsavedDetails.modifiedOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.5,
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.info.main, 0.06),
                            }}
                          >
                            <Typography variant="caption" fontWeight={600}>
                              ~ {oppName}: {getStatusLabel(o.savedNewStatus)} → {getStatusLabel(o.newStatus)}
                            </Typography>
                          </Box>
                        );
                      })}
                      {syncInfo.unsavedDetails.removedOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.5,
                              p: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.error.main, 0.06),
                            }}
                          >
                            <Typography variant="caption" fontWeight={600}>
                              - {oppName}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {/* Manual Opportunities */}
                  {(syncInfo.unsavedDetails.newOpps.length > 0 ||
                    syncInfo.unsavedDetails.modifiedOpps.length > 0 ||
                    syncInfo.unsavedDetails.removedOpps.length > 0) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <NoteAddIcon sx={{ fontSize: 16 }} /> Manual Opportunities
                      </Typography>
                      {syncInfo.unsavedDetails.newOpps.map((opp) => (
                        <Box
                          key={opp["Opportunity ID"]}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            + {opp.Opportunity || opp["Opportunity ID"]} ({opp.Account})
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.modifiedOpps.map(({ current }) => (
                        <Box
                          key={current["Opportunity ID"]}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            ~ {current.Opportunity || current["Opportunity ID"]}
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.removedOpps.map((opp) => (
                        <Box
                          key={opp["Opportunity ID"]}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            - {opp["Opportunity ID"]}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Manual Accounts */}
                  {(syncInfo.unsavedDetails.newAccounts.length > 0 ||
                    syncInfo.unsavedDetails.modifiedAccounts.length > 0 ||
                    syncInfo.unsavedDetails.removedAccounts.length > 0) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <AddBusinessIcon sx={{ fontSize: 16 }} /> Manual Accounts
                      </Typography>
                      {syncInfo.unsavedDetails.newAccounts.map((acc) => (
                        <Box
                          key={acc.Account}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            + {acc.Account}
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.modifiedAccounts.map((acc) => (
                        <Box
                          key={acc.current.Account}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            ~ {acc.current.Account}
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.removedAccounts.map((acc) => (
                        <Box
                          key={acc.Account}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            - {acc.Account}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {(syncInfo.unsavedDetails.newStaffingNeeds.length > 0 ||
                    syncInfo.unsavedDetails.modifiedStaffingNeeds.length > 0 ||
                    syncInfo.unsavedDetails.removedStaffingNeeds.length > 0) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <GroupIcon sx={{ fontSize: 16 }} /> Staffing Needs
                      </Typography>
                      {syncInfo.unsavedDetails.newStaffingNeeds.map((n) => (
                        <Box
                          key={n.id}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            + {n.profile} x{n.quantity}
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.modifiedStaffingNeeds.map((n) => (
                        <Box
                          key={n.current.id}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            ~ {n.current.profile} x{n.current.quantity}
                          </Typography>
                        </Box>
                      ))}
                      {syncInfo.unsavedDetails.removedStaffingNeeds.map((n) => (
                        <Box
                          key={n.id}
                          sx={{
                            ml: 2,
                            mb: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            - {n.profile} x{n.quantity}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmSaveOpen(false);
                setMergeResultInfo(null);
                setConflictResolution(null);
              }}
            >
              {mergeResultInfo || conflictResolution ? "Close" : "Cancel"}
            </Button>
            <Button
              variant="contained"
              color={mergeResultInfo ? "primary" : conflictResolution ? "warning" : "success"}
              startIcon={
                isSavingExcel ? (
                  <CircularProgress size={18} color="inherit" />
                ) : mergeResultInfo ? (
                  <CheckIcon />
                ) : (
                  <SaveIcon />
                )
              }
              disabled={
                isSavingExcel ||
                (conflictResolution &&
                  Object.keys(conflictResolution.choices).length < conflictResolution.mergeResult.conflicts.length)
              }
              onClick={async () => {
                if (mergeResultInfo) {
                  setMergeResultInfo(null);
                  setConfirmSaveOpen(false);
                  return;
                }

                if (conflictResolution) {
                  // User has resolved conflicts — apply resolutions and save
                  const { mergeResult: mr, choices } = conflictResolution;
                  const resolved = { ...mr.merged };
                  // Apply user choices: replace local with remote where chosen
                  mr.conflicts.forEach((conflict) => {
                    if (choices[conflict.key] === "remote") {
                      const collection =
                        conflict.type === "override"
                          ? "statusOverrides"
                          : conflict.type === "manualOpportunity"
                            ? "manualOpportunities"
                            : "manualAccounts";
                      const keyField =
                        conflict.type === "override"
                          ? "opportunityId"
                          : conflict.type === "manualOpportunity"
                            ? "Opportunity ID"
                            : "Account";
                      resolved[collection] = (resolved[collection] || []).map((item) =>
                        item[keyField] === conflict.key ? conflict.remote : item
                      );
                    }
                    // 'local' = keep as-is in merged (already the default)
                  });

                  setIsSavingExcel(true);
                  setSaveExcelResult(null);
                  const result = await onSaveToExcel(resolved);
                  setSaveExcelResult(result);
                  setIsSavingExcel(false);
                  setConflictResolution(null);
                  if (result?.success) {
                    // Show merge info with remote additions/modifications (non-conflict)
                    const { mergeResult: originalMR } = conflictResolution;
                    if (originalMR.hasRemoteChanges) {
                      setMergeResultInfo({ ...originalMR, conflicts: [] }); // conflicts already resolved
                    } else {
                      setConfirmSaveOpen(false);
                      setResultDialog({
                        title: "Save Complete",
                        message: "All changes have been saved with your conflict resolutions.",
                        severity: "success",
                      });
                    }
                  } else if (result?.error) {
                    setConfirmSaveOpen(false);
                    setResultDialog({ title: "Save Failed", message: result.error, severity: "error" });
                  }
                  return;
                }

                // Step 1: Check for conflicts before saving
                setIsSavingExcel(true);
                setSaveExcelResult(null);

                if (onCheckConflicts) {
                  const checkResult = await onCheckConflicts();
                  if (checkResult?.conflicts?.length > 0) {
                    // Conflicts found — show resolution dialog
                    setIsSavingExcel(false);
                    setConflictResolution({
                      mergeResult: checkResult,
                      choices: {}, // User will fill this in
                    });
                    return;
                  }
                }

                // No conflicts — proceed with normal save
                const result = await onSaveToExcel();
                setSaveExcelResult(result);
                setIsSavingExcel(false);
                if (result?.success) {
                  if (result.mergeResult?.hasRemoteChanges) {
                    setMergeResultInfo(result.mergeResult);
                  } else {
                    setConfirmSaveOpen(false);
                    setResultDialog({
                      title: "Save Complete",
                      message: "All changes have been saved to the Excel file.",
                      severity: "success",
                    });
                  }
                } else if (result?.error) {
                  setConfirmSaveOpen(false);
                  setResultDialog({ title: "Save Failed", message: result.error, severity: "error" });
                }
              }}
            >
              {isSavingExcel
                ? "Saving..."
                : mergeResultInfo
                  ? "OK"
                  : conflictResolution
                    ? `Save with resolutions (${Object.keys(conflictResolution.choices).length}/${conflictResolution.mergeResult.conflicts.length})`
                    : "Confirm & Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Refresh Confirmation Dialog - warn about unsaved changes */}
        <Dialog
          open={confirmRefreshOpen}
          onClose={() => setConfirmRefreshOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <RefreshIcon sx={{ color: "warning.main" }} />
            <Typography variant="h6" fontWeight={600}>
              Unsaved Changes
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography>
              You have unsaved changes that will be lost if you refresh from the Excel file. Do you want to continue?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmRefreshOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={isRefreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              disabled={isRefreshing}
              onClick={async () => {
                setIsRefreshing(true);
                const result = await onRefreshFromExcel();
                setIsRefreshing(false);
                setConfirmRefreshOpen(false);
                if (result?.success) {
                  setResultDialog({
                    title: "Refresh Complete",
                    message: `Data refreshed from ${result.fileName}`,
                    severity: "success",
                  });
                } else if (result?.error) {
                  setResultDialog({ title: "Refresh Failed", message: result.error, severity: "error" });
                }
              }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Anyway"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Result Dialog - modal notification for save/refresh results */}
        <Dialog
          open={!!resultDialog}
          onClose={() => setResultDialog(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          {resultDialog && (
            <>
              <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {resultDialog.severity === "success" ? (
                  <CheckIcon sx={{ color: "success.main" }} />
                ) : (
                  <WarningIcon sx={{ color: "error.main" }} />
                )}
                <Typography variant="h6" fontWeight={600}>
                  {resultDialog.title}
                </Typography>
              </DialogTitle>
              <DialogContent>
                <Typography>{resultDialog.message}</Typography>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="contained" onClick={() => setResultDialog(null)}>
                  OK
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Management Dialog */}
        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="xl"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              maxHeight: "85vh",
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pb: 2,
              pt: 3,
              px: 4,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <EditNoteIcon sx={{ fontSize: 28, color: "primary.main" }} />
              <Typography variant="h6" fontWeight={600}>
                Changes
              </Typography>
              {totalCount > 0 && <Chip label={totalCount} size="small" sx={{ fontWeight: 700, height: 22 }} />}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Tooltip title="More actions">
                <IconButton size="small" onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          {/* Tabs */}
          <Tabs
            value={activeTab > 4 ? 0 : activeTab}
            onChange={(_, newValue) => {
              setActiveTab(newValue);
              setSelectedItems(new Set());
              setConfirmClearAll(false);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              "& .MuiTab-root": { minHeight: 48, textTransform: "none" },
            }}
          >
            <Tab
              value={0}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <SwapHorizIcon sx={{ fontSize: 18 }} />
                  <span>Status Changes</span>
                  {overrideCount > 0 && (
                    <Chip label={overrideCount} size="small" color="warning" sx={{ height: 20, fontSize: "0.7rem" }} />
                  )}
                  {syncInfo && overrideCount > 0 && !syncInfo.overridesTabSynced && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        display: "inline-block",
                      }}
                    />
                  )}
                </Box>
              }
            />
            <Tab
              value={1}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <NoteAddIcon sx={{ fontSize: 18 }} />
                  <span>New Opportunities</span>
                  {manualCount > 0 && (
                    <Chip label={manualCount} size="small" color="info" sx={{ height: 20, fontSize: "0.7rem" }} />
                  )}
                  {syncInfo && manualCount > 0 && !syncInfo.oppsTabSynced && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        display: "inline-block",
                      }}
                    />
                  )}
                </Box>
              }
            />
            <Tab
              value={2}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AddBusinessIcon sx={{ fontSize: 18 }} />
                  <span>New Accounts</span>
                  {accountCount > 0 && (
                    <Chip label={accountCount} size="small" color="success" sx={{ height: 20, fontSize: "0.7rem" }} />
                  )}
                  {syncInfo && accountCount > 0 && !syncInfo.accsTabSynced && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        display: "inline-block",
                      }}
                    />
                  )}
                </Box>
              }
            />
            <Tab
              value={3}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AssignmentIcon sx={{ fontSize: 18 }} />
                  <span>Actions / Comments</span>
                  {actionsCommentsCount > 0 && (
                    <Chip
                      label={actionsCommentsCount}
                      size="small"
                      color="secondary"
                      sx={{ height: 20, fontSize: "0.7rem" }}
                    />
                  )}
                  {syncInfo && actionsCommentsCount > 0 && !syncInfo.actionsTabSynced && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        display: "inline-block",
                      }}
                    />
                  )}
                </Box>
              }
            />
            <Tab
              value={4}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <GroupIcon sx={{ fontSize: 18 }} />
                  <span>Staffing Needs</span>
                  {staffingNeedsCount > 0 && (
                    <Chip
                      label={staffingNeedsCount}
                      size="small"
                      color="info"
                      sx={{ height: 20, fontSize: "0.7rem" }}
                    />
                  )}
                  {syncInfo && staffingNeedsCount > 0 && !syncInfo.staffingTabSynced && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        display: "inline-block",
                      }}
                    />
                  )}
                </Box>
              }
            />
          </Tabs>

          {/* Shared toolbar: search + group by */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(theme.palette.grey[500], 0.02),
            }}
          >
            <TextField
              size="small"
              placeholder={
                activeTab === 0
                  ? "Search overrides..."
                  : activeTab === 1
                    ? "Search opportunities..."
                    : activeTab === 2
                      ? "Search accounts..."
                      : activeTab === 3
                        ? "Search actions & comments..."
                        : "Search staffing needs..."
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
                ...(searchText && {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchText("")} sx={{ p: 0.25 }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }),
              }}
              sx={{ flex: 1, "& .MuiOutlinedInput-root": { fontSize: "0.85rem" } }}
            />
            {activeTab !== 2 && activeTab !== 4 && (
              <>
                <Tooltip title="Group settings">
                  <IconButton
                    size="small"
                    onClick={() => setGroupSettingsOpen(true)}
                    sx={{
                      border: "1px solid",
                      borderColor: groupBy !== "none" ? "primary.main" : "divider",
                      borderRadius: 1,
                      color: groupBy !== "none" ? "primary.main" : "text.secondary",
                      flexShrink: 0,
                    }}
                  >
                    <TuneIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {groupBy !== "none" && (
                  <Tooltip title={allCollapsed ? "Expand all groups" : "Collapse all groups"}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newVal = !(allCollapsedMap[activeTab] || false);
                        setAllCollapsedMap({ 0: newVal, 1: newVal, 2: newVal, 3: newVal, 4: newVal });
                        setCollapsedGroups(new Set());
                      }}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        color: "text.secondary",
                        flexShrink: 0,
                      }}
                    >
                      {allCollapsed ? (
                        <UnfoldMoreIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <UnfoldLessIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
          </Box>

          <DialogContent sx={{ p: 0 }}>
            {/* Status Overrides Tab */}
            {activeTab === 0 &&
              (() => {
                // Filter overrides by search text
                const lowerSearch = searchText.toLowerCase();
                const filtered = getAllOverrides.filter((override) => {
                  if (!lowerSearch) return true;
                  const opp = opportunityMap[override.opportunityId];
                  const name = (opp?.["Opportunity"] || override.opportunityId).toLowerCase();
                  const account = (opp?.["Account"] || "").toLowerCase();
                  return name.includes(lowerSearch) || account.includes(lowerSearch);
                });
                const allIds = filtered.map((o) => o.opportunityId);
                const selCount = allIds.filter((id) => selectedItems.has(id)).length;
                const grouped = groupItemsBy(filtered, (override) => opportunityMap[override.opportunityId], groupBy);

                // Render a list of override items (used for flat and grouped views)
                const renderOverrideItem = (override, index) => {
                  const opportunity = opportunityMap[override.opportunityId];
                  const opportunityName = opportunity?.["Opportunity"] || override.opportunityId;
                  const account = opportunity?.["Account"];
                  return (
                    <React.Fragment key={override.opportunityId}>
                      {index > 0 && <Divider variant="inset" sx={{ ml: 6 }} />}
                      <ListItem
                        button
                        onClick={() => opportunity && handleOpenOpportunityPopup(opportunity)}
                        sx={{
                          py: 1,
                          px: 2,
                          cursor: "pointer",
                          bgcolor: selectedItems.has(override.opportunityId)
                            ? alpha(theme.palette.primary.main, 0.05)
                            : "transparent",
                          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={selectedItems.has(override.opportunityId)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(override.opportunityId)}
                          sx={{ mr: 1, p: 0.5 }}
                        />
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {syncInfo && (
                                <Tooltip
                                  title={
                                    syncInfo.overrideSynced[override.opportunityId]
                                      ? "Saved to Excel"
                                      : "Not saved to Excel"
                                  }
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      width: 7,
                                      height: 7,
                                      minWidth: 7,
                                      borderRadius: "50%",
                                      bgcolor: syncInfo.overrideSynced[override.opportunityId]
                                        ? "success.main"
                                        : "warning.main",
                                    }}
                                  />
                                </Tooltip>
                              )}
                              {account && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                  sx={{ maxWidth: 130, flexShrink: 0, fontSize: "0.72rem" }}
                                >
                                  {account} –
                                </Typography>
                              )}
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                                sx={{ maxWidth: 220, fontSize: "0.82rem" }}
                              >
                                {opportunityName}
                              </Typography>
                              <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: "auto", flexShrink: 0 }} />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                              <Chip
                                label={getStatusLabel(override.originalStatus)}
                                size="small"
                                sx={{
                                  bgcolor: alpha(theme.palette.grey[500], 0.12),
                                  color: theme.palette.text.secondary,
                                  textDecoration: "line-through",
                                  fontSize: "0.7rem",
                                  height: 22,
                                }}
                              />
                              <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                              <Chip
                                label={getStatusLabel(override.newStatus)}
                                size="small"
                                color={
                                  override.newStatus === 15
                                    ? "error"
                                    : override.newStatus === 14
                                      ? "success"
                                      : "primary"
                                }
                                sx={{ fontSize: "0.7rem", fontWeight: 600, height: 22 }}
                              />
                              {override.comment && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                  "{override.comment}"
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.disabled">
                                {formatDate(override.modifiedAt)}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Undo this modification">
                            <IconButton
                              edge="end"
                              onClick={(e) => handleRevert(override.opportunityId, e)}
                              color="warning"
                              size="small"
                            >
                              <UndoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </React.Fragment>
                  );
                };

                return (
                  <>
                    {filtered.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          {overrideCount === 0 ? "No status modifications" : "No results matching your search"}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={allIds.length > 0 && selCount === allIds.length}
                            indeterminate={selCount > 0 && selCount < allIds.length}
                            onChange={() => toggleSelectAll(allIds)}
                          />
                          {selCount > 0 ? (
                            <>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {selCount} selected
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteSelected}
                                sx={{ ml: "auto" }}
                              >
                                Delete Selected
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                            </Typography>
                          )}
                        </Box>
                        <List sx={{ py: 0 }}>
                          {groupBy === "none"
                            ? filtered.map((override, index) => renderOverrideItem(override, index))
                            : groupBy === "slThenSegment" || groupBy === "segmentThenSl"
                              ? Object.entries(grouped)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([primary, { subGroups }]) => {
                                    const primaryKey = `override-${primary}`;
                                    const primaryCollapsed = isGroupCollapsed(primaryKey);
                                    const primaryCount = Object.values(subGroups).reduce((s, arr) => s + arr.length, 0);
                                    const primarySynced =
                                      syncInfo &&
                                      Object.values(subGroups)
                                        .flat()
                                        .every((o) => syncInfo.overrideSynced[o.opportunityId]);
                                    return (
                                      <React.Fragment key={primary}>
                                        <Box
                                          onClick={() => toggleGroupCollapse(primaryKey)}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            px: 2,
                                            py: 0.75,
                                            cursor: "pointer",
                                            bgcolor: alpha(theme.palette.grey[500], 0.06),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                          }}
                                        >
                                          {primaryCollapsed ? (
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                          ) : (
                                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                                          )}
                                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                            {primary}
                                          </Typography>
                                          <Chip
                                            label={primaryCount}
                                            size="small"
                                            sx={{ height: 18, fontSize: "0.65rem" }}
                                          />
                                          {syncInfo && (
                                            <Box
                                              component="span"
                                              sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                bgcolor: primarySynced ? "success.main" : "warning.main",
                                                flexShrink: 0,
                                              }}
                                            />
                                          )}
                                        </Box>
                                        {!primaryCollapsed &&
                                          Object.entries(subGroups)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([secondary, items]) => {
                                              const secKey = `override-${primary}::${secondary}`;
                                              const secCollapsed = isGroupCollapsed(secKey);
                                              const secSynced =
                                                syncInfo &&
                                                items.every((o) => syncInfo.overrideSynced[o.opportunityId]);
                                              return (
                                                <React.Fragment key={secondary}>
                                                  <Box
                                                    onClick={() => toggleGroupCollapse(secKey)}
                                                    sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: 1,
                                                      pl: 4,
                                                      pr: 2,
                                                      py: 0.5,
                                                      cursor: "pointer",
                                                      bgcolor: alpha(theme.palette.grey[500], 0.03),
                                                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                                      "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.06) },
                                                    }}
                                                  >
                                                    {secCollapsed ? (
                                                      <ExpandMoreIcon sx={{ fontSize: 14 }} />
                                                    ) : (
                                                      <ExpandLessIcon sx={{ fontSize: 14 }} />
                                                    )}
                                                    <Typography
                                                      variant="caption"
                                                      fontWeight={600}
                                                      color="text.secondary"
                                                    >
                                                      {secondary}
                                                    </Typography>
                                                    <Chip
                                                      label={items.length}
                                                      size="small"
                                                      sx={{ height: 16, fontSize: "0.6rem" }}
                                                    />
                                                    {syncInfo && (
                                                      <Box
                                                        component="span"
                                                        sx={{
                                                          width: 6,
                                                          height: 6,
                                                          borderRadius: "50%",
                                                          bgcolor: secSynced ? "success.main" : "warning.main",
                                                          flexShrink: 0,
                                                        }}
                                                      />
                                                    )}
                                                  </Box>
                                                  {!secCollapsed &&
                                                    items.map((override, index) => renderOverrideItem(override, index))}
                                                </React.Fragment>
                                              );
                                            })}
                                      </React.Fragment>
                                    );
                                  })
                              : Object.entries(grouped)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([groupName, { items }]) => {
                                    if (!items || items.length === 0) return null;
                                    const gKey = `override-${groupName}`;
                                    const gCollapsed = isGroupCollapsed(gKey);
                                    const gSynced =
                                      syncInfo && items.every((o) => syncInfo.overrideSynced[o.opportunityId]);
                                    return (
                                      <React.Fragment key={groupName}>
                                        <Box
                                          onClick={() => toggleGroupCollapse(gKey)}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            px: 2,
                                            py: 0.75,
                                            cursor: "pointer",
                                            bgcolor: alpha(theme.palette.grey[500], 0.06),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                          }}
                                        >
                                          {gCollapsed ? (
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                          ) : (
                                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                                          )}
                                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                            {groupName}
                                          </Typography>
                                          <Chip
                                            label={items.length}
                                            size="small"
                                            sx={{ height: 18, fontSize: "0.65rem" }}
                                          />
                                          {syncInfo && (
                                            <Box
                                              component="span"
                                              sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                bgcolor: gSynced ? "success.main" : "warning.main",
                                                flexShrink: 0,
                                              }}
                                            />
                                          )}
                                        </Box>
                                        {!gCollapsed &&
                                          items.map((override, index) => renderOverrideItem(override, index))}
                                      </React.Fragment>
                                    );
                                  })}
                        </List>
                      </>
                    )}
                  </>
                );
              })()}

            {/* Manual Opportunities Tab */}
            {activeTab === 1 &&
              (() => {
                const lowerSearch = searchText.toLowerCase();
                const filtered = manualOpportunities.filter((opp) => {
                  if (!lowerSearch) return true;
                  const name = (opp["Opportunity"] || opp["Opportunity ID"]).toLowerCase();
                  const account = (opp["Account"] || "").toLowerCase();
                  return name.includes(lowerSearch) || account.includes(lowerSearch);
                });
                const allIds = filtered.map((o) => o["Opportunity ID"]);
                const selCount = allIds.filter((id) => selectedItems.has(id)).length;
                const grouped = groupItemsBy(filtered, (opp) => opp, groupBy);

                const renderOppItem = (opp, index) => {
                  const isDeleting = deleteConfirm === opp["Opportunity ID"];
                  const account = opp["Account"];
                  return (
                    <React.Fragment key={opp["Opportunity ID"]}>
                      {index > 0 && <Divider variant="inset" sx={{ ml: 6 }} />}
                      <ListItem
                        button
                        onClick={() => handleOpenOpportunityPopup(opp)}
                        sx={{
                          py: 1,
                          px: 2,
                          cursor: "pointer",
                          bgcolor: isDeleting
                            ? alpha(theme.palette.error.main, 0.06)
                            : selectedItems.has(opp["Opportunity ID"])
                              ? alpha(theme.palette.primary.main, 0.05)
                              : "transparent",
                          "&:hover": {
                            bgcolor: isDeleting
                              ? alpha(theme.palette.error.main, 0.08)
                              : alpha(theme.palette.primary.main, 0.06),
                          },
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={selectedItems.has(opp["Opportunity ID"])}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(opp["Opportunity ID"])}
                          sx={{ mr: 1, p: 0.5 }}
                        />
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {syncInfo && (
                                <Tooltip
                                  title={
                                    syncInfo.oppSynced[opp["Opportunity ID"]] ? "Saved to Excel" : "Not saved to Excel"
                                  }
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      width: 7,
                                      height: 7,
                                      minWidth: 7,
                                      borderRadius: "50%",
                                      bgcolor: syncInfo.oppSynced[opp["Opportunity ID"]]
                                        ? "success.main"
                                        : "warning.main",
                                    }}
                                  />
                                </Tooltip>
                              )}
                              {account && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                  sx={{ maxWidth: 130, flexShrink: 0, fontSize: "0.72rem" }}
                                >
                                  {account} –
                                </Typography>
                              )}
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                                sx={{ maxWidth: 220, fontSize: "0.82rem" }}
                              >
                                {opp["Opportunity"] || opp["Opportunity ID"]}
                              </Typography>
                              <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: "auto", flexShrink: 0 }} />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                              <Chip
                                label={
                                  opp._creationStatus != null && opp._creationStatus !== opp["Status"]
                                    ? getStatusLabel(opp._creationStatus)
                                    : "New"
                                }
                                size="small"
                                sx={{
                                  bgcolor: alpha(theme.palette.grey[500], 0.12),
                                  color: theme.palette.text.secondary,
                                  textDecoration:
                                    opp._creationStatus != null && opp._creationStatus !== opp["Status"]
                                      ? "line-through"
                                      : "none",
                                  fontSize: "0.7rem",
                                  height: 22,
                                }}
                              />
                              <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                              <Chip
                                label={getStatusLabel(opp["Status"])}
                                size="small"
                                color={opp["Status"] === 15 ? "error" : opp["Status"] === 14 ? "success" : "primary"}
                                sx={{ fontSize: "0.7rem", fontWeight: 600, height: 22 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: "EUR",
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }).format(opp["Gross Revenue"] || 0)}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {formatDate(opp["Creation Date"])}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          {isDeleting ? (
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(null);
                                }}
                                sx={{ minWidth: "auto", px: 1 }}
                              >
                                No
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteManual();
                                }}
                                sx={{ minWidth: "auto", px: 1 }}
                              >
                                Yes
                              </Button>
                            </Box>
                          ) : (
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              {setEditOpportunity && (
                                <Tooltip title="Edit this opportunity">
                                  <IconButton
                                    edge="end"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpen(false);
                                      setEditOpportunity(opp);
                                    }}
                                    color="info"
                                    size="small"
                                  >
                                    <EditNoteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Delete this opportunity">
                                <IconButton
                                  edge="end"
                                  onClick={(e) => handleDeleteManual(opp["Opportunity ID"], e)}
                                  color="error"
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    </React.Fragment>
                  );
                };

                return (
                  <>
                    {filtered.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          {manualCount === 0 ? "No opportunities to create" : "No results matching your search"}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={allIds.length > 0 && selCount === allIds.length}
                            indeterminate={selCount > 0 && selCount < allIds.length}
                            onChange={() => toggleSelectAll(allIds)}
                          />
                          {selCount > 0 ? (
                            <>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {selCount} selected
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteSelected}
                                sx={{ ml: "auto" }}
                              >
                                Delete Selected
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                            </Typography>
                          )}
                        </Box>
                        <List sx={{ py: 0 }}>
                          {groupBy === "none"
                            ? filtered.map((opp, index) => renderOppItem(opp, index))
                            : groupBy === "slThenSegment" || groupBy === "segmentThenSl"
                              ? Object.entries(grouped)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([primary, { subGroups }]) => {
                                    const primaryKey = `opp-${primary}`;
                                    const primaryCollapsed = isGroupCollapsed(primaryKey);
                                    const primaryCount = Object.values(subGroups).reduce((s, arr) => s + arr.length, 0);
                                    const primarySynced =
                                      syncInfo &&
                                      Object.values(subGroups)
                                        .flat()
                                        .every((o) => syncInfo.oppSynced[o["Opportunity ID"]]);
                                    return (
                                      <React.Fragment key={primary}>
                                        <Box
                                          onClick={() => toggleGroupCollapse(primaryKey)}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            px: 2,
                                            py: 0.75,
                                            cursor: "pointer",
                                            bgcolor: alpha(theme.palette.grey[500], 0.06),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                          }}
                                        >
                                          {primaryCollapsed ? (
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                          ) : (
                                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                                          )}
                                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                            {primary}
                                          </Typography>
                                          <Chip
                                            label={primaryCount}
                                            size="small"
                                            sx={{ height: 18, fontSize: "0.65rem" }}
                                          />
                                          {syncInfo && (
                                            <Box
                                              component="span"
                                              sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                bgcolor: primarySynced ? "success.main" : "warning.main",
                                                flexShrink: 0,
                                              }}
                                            />
                                          )}
                                        </Box>
                                        {!primaryCollapsed &&
                                          Object.entries(subGroups)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([secondary, items]) => {
                                              const secKey = `opp-${primary}::${secondary}`;
                                              const secCollapsed = isGroupCollapsed(secKey);
                                              const secSynced =
                                                syncInfo && items.every((o) => syncInfo.oppSynced[o["Opportunity ID"]]);
                                              return (
                                                <React.Fragment key={secondary}>
                                                  <Box
                                                    onClick={() => toggleGroupCollapse(secKey)}
                                                    sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: 1,
                                                      pl: 4,
                                                      pr: 2,
                                                      py: 0.5,
                                                      cursor: "pointer",
                                                      bgcolor: alpha(theme.palette.grey[500], 0.03),
                                                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                                      "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.06) },
                                                    }}
                                                  >
                                                    {secCollapsed ? (
                                                      <ExpandMoreIcon sx={{ fontSize: 14 }} />
                                                    ) : (
                                                      <ExpandLessIcon sx={{ fontSize: 14 }} />
                                                    )}
                                                    <Typography
                                                      variant="caption"
                                                      fontWeight={600}
                                                      color="text.secondary"
                                                    >
                                                      {secondary}
                                                    </Typography>
                                                    <Chip
                                                      label={items.length}
                                                      size="small"
                                                      sx={{ height: 16, fontSize: "0.6rem" }}
                                                    />
                                                    {syncInfo && (
                                                      <Box
                                                        component="span"
                                                        sx={{
                                                          width: 6,
                                                          height: 6,
                                                          borderRadius: "50%",
                                                          bgcolor: secSynced ? "success.main" : "warning.main",
                                                          flexShrink: 0,
                                                        }}
                                                      />
                                                    )}
                                                  </Box>
                                                  {!secCollapsed &&
                                                    items.map((opp, index) => renderOppItem(opp, index))}
                                                </React.Fragment>
                                              );
                                            })}
                                      </React.Fragment>
                                    );
                                  })
                              : Object.entries(grouped)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([groupName, { items }]) => {
                                    if (!items || items.length === 0) return null;
                                    const gKey = `opp-${groupName}`;
                                    const gCollapsed = isGroupCollapsed(gKey);
                                    const gSynced =
                                      syncInfo && items.every((o) => syncInfo.oppSynced[o["Opportunity ID"]]);
                                    return (
                                      <React.Fragment key={groupName}>
                                        <Box
                                          onClick={() => toggleGroupCollapse(gKey)}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            px: 2,
                                            py: 0.75,
                                            cursor: "pointer",
                                            bgcolor: alpha(theme.palette.grey[500], 0.06),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                          }}
                                        >
                                          {gCollapsed ? (
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                          ) : (
                                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                                          )}
                                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                            {groupName}
                                          </Typography>
                                          <Chip
                                            label={items.length}
                                            size="small"
                                            sx={{ height: 18, fontSize: "0.65rem" }}
                                          />
                                          {syncInfo && (
                                            <Box
                                              component="span"
                                              sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                bgcolor: gSynced ? "success.main" : "warning.main",
                                                flexShrink: 0,
                                              }}
                                            />
                                          )}
                                        </Box>
                                        {!gCollapsed && items.map((opp, index) => renderOppItem(opp, index))}
                                      </React.Fragment>
                                    );
                                  })}
                        </List>
                      </>
                    )}
                  </>
                );
              })()}

            {/* Accounts to Create Tab */}
            {activeTab === 2 &&
              (() => {
                const lowerSearch = searchText.toLowerCase();
                const filtered = manualAccounts.filter((acc) => {
                  if (!lowerSearch) return true;
                  const name = (acc.Account || "").toLowerCase();
                  const parent = (acc["Parent Account"] || "").toLowerCase();
                  const country = (acc.Country || "").toLowerCase();
                  return name.includes(lowerSearch) || parent.includes(lowerSearch) || country.includes(lowerSearch);
                });
                const allIds = filtered.map((a) => a.Account);
                const selCount = allIds.filter((id) => selectedItems.has(id)).length;
                return (
                  <>
                    {filtered.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          {accountCount === 0 ? "No accounts to create" : "No results matching your search"}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={allIds.length > 0 && selCount === allIds.length}
                            indeterminate={selCount > 0 && selCount < allIds.length}
                            onChange={() => toggleSelectAll(allIds)}
                          />
                          {selCount > 0 ? (
                            <>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {selCount} selected
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteSelected}
                                sx={{ ml: "auto" }}
                              >
                                Delete Selected
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                            </Typography>
                          )}
                        </Box>
                        <List sx={{ py: 0 }}>
                          {filtered.map((acc, index) => {
                            const isDeleting = deleteConfirm === `account_${acc.Account}`;

                            return (
                              <React.Fragment key={acc.Account}>
                                {index > 0 && <Divider />}
                                <ListItem
                                  sx={{
                                    py: 2,
                                    bgcolor: isDeleting
                                      ? alpha(theme.palette.error.main, 0.08)
                                      : selectedItems.has(acc.Account)
                                        ? alpha(theme.palette.primary.main, 0.06)
                                        : "transparent",
                                    "&:hover": {
                                      bgcolor: isDeleting
                                        ? alpha(theme.palette.error.main, 0.12)
                                        : alpha(theme.palette.primary.main, 0.08),
                                    },
                                  }}
                                >
                                  <Checkbox
                                    size="small"
                                    checked={selectedItems.has(acc.Account)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleSelect(acc.Account)}
                                    sx={{ mr: 1 }}
                                  />
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        {syncInfo && (
                                          <Tooltip
                                            title={
                                              syncInfo.accSynced[acc.Account] ? "Saved to Excel" : "Not saved to Excel"
                                            }
                                          >
                                            <Box
                                              component="span"
                                              sx={{
                                                width: 8,
                                                height: 8,
                                                minWidth: 8,
                                                borderRadius: "50%",
                                                bgcolor: syncInfo.accSynced[acc.Account]
                                                  ? "success.main"
                                                  : "warning.main",
                                              }}
                                            />
                                          </Tooltip>
                                        )}
                                        <AddBusinessIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                                        <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 250 }}>
                                          {acc.Account}
                                        </Typography>
                                        <Chip
                                          label="New"
                                          size="small"
                                          color="success"
                                          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700 }}
                                        />
                                      </Box>
                                    }
                                    secondary={
                                      <Box sx={{ mt: 1 }}>
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                            mb: 0.5,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          {acc["Parent Account"] && (
                                            <Typography variant="caption" color="text.secondary">
                                              <strong>Parent:</strong> {acc["Parent Account"]}
                                            </Typography>
                                          )}
                                          {acc["Sub Segment Code"] && (
                                            <Chip
                                              label={acc["Sub Segment Code"]}
                                              size="small"
                                              sx={{ fontSize: "0.65rem", height: 18 }}
                                            />
                                          )}
                                          {acc["Sub Segment"] && (
                                            <Typography variant="caption" color="text.secondary">
                                              {acc["Sub Segment"]}
                                            </Typography>
                                          )}
                                        </Box>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                          {acc.Country && (
                                            <Typography variant="caption" color="text.secondary">
                                              <strong>Country:</strong> {acc.Country}
                                            </Typography>
                                          )}
                                          <Typography variant="caption" color="text.disabled">
                                            Created on {formatDateShort(acc.createdAt)}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    }
                                  />
                                  <ListItemSecondaryAction>
                                    {isDeleting ? (
                                      (() => {
                                        const associatedOpps = manualOpportunities.filter(
                                          (opp) => opp["Account"] === acc.Account
                                        );
                                        const oppCount = associatedOpps.length;
                                        return (
                                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            {oppCount > 0 && (
                                              <Typography
                                                variant="caption"
                                                color="error.main"
                                                fontWeight={600}
                                                sx={{ maxWidth: 180 }}
                                              >
                                                {oppCount} opportunit{oppCount > 1 ? "ies" : "y"} will also be deleted
                                              </Typography>
                                            )}
                                            <Button
                                              size="small"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirm(null);
                                              }}
                                              sx={{ minWidth: "auto", px: 1 }}
                                            >
                                              No
                                            </Button>
                                            <Button
                                              size="small"
                                              color="error"
                                              variant="contained"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (onDeleteManualAccount) {
                                                  onDeleteManualAccount(acc.Account);
                                                }
                                                setDeleteConfirm(null);
                                              }}
                                              sx={{ minWidth: "auto", px: 1 }}
                                            >
                                              Yes
                                            </Button>
                                          </Box>
                                        );
                                      })()
                                    ) : (
                                      <Tooltip title="Delete this account">
                                        <IconButton
                                          edge="end"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirm(`account_${acc.Account}`);
                                          }}
                                          color="error"
                                          size="small"
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </ListItemSecondaryAction>
                                </ListItem>
                              </React.Fragment>
                            );
                          })}
                        </List>
                      </>
                    )}
                  </>
                );
              })()}

            {/* Actions / Comments Tab */}
            {activeTab === 3 &&
              (() => {
                // Gather all actions and comments from localStorage
                const allActions = [];
                const allComments = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key?.startsWith("opportunity_actions_")) {
                    try {
                      const oppId = key.replace("opportunity_actions_", "");
                      const items = JSON.parse(localStorage.getItem(key));
                      items.forEach((a) => allActions.push({ ...a, opportunityId: a.opportunityId || oppId }));
                    } catch {
                      /* ignore */
                    }
                  }
                  if (key?.startsWith("opportunity_comments_")) {
                    try {
                      const oppId = key.replace("opportunity_comments_", "");
                      const items = JSON.parse(localStorage.getItem(key));
                      items.forEach((c) => allComments.push({ ...c, opportunityId: c.opportunityId || oppId }));
                    } catch {
                      /* ignore */
                    }
                  }
                }

                // Filter by search text
                const lowerSearch = searchText.toLowerCase();
                const filteredActions = allActions.filter((a) => {
                  if (!lowerSearch) return true;
                  const opp = opportunityMap[a.opportunityId];
                  const oppName = (opp?.Opportunity || a.opportunityName || "").toLowerCase();
                  const account = (opp?.Account || a.opportunityAccount || "").toLowerCase();
                  const owner = (a.owner || "").toLowerCase();
                  const desc = (a.description || "").toLowerCase();
                  return (
                    oppName.includes(lowerSearch) ||
                    account.includes(lowerSearch) ||
                    owner.includes(lowerSearch) ||
                    desc.includes(lowerSearch)
                  );
                });
                const filteredComments = allComments.filter((c) => {
                  if (!lowerSearch) return true;
                  const opp = opportunityMap[c.opportunityId];
                  const oppName = (opp?.Opportunity || c.opportunityName || "").toLowerCase();
                  const account = (opp?.Account || "").toLowerCase();
                  const author = (c.author || "").toLowerCase();
                  const text = (c.text || "").toLowerCase();
                  return (
                    oppName.includes(lowerSearch) ||
                    account.includes(lowerSearch) ||
                    author.includes(lowerSearch) ||
                    text.includes(lowerSearch)
                  );
                });
                // Group by opportunity
                const byOpp = {};
                filteredActions.forEach((a) => {
                  const id = a.opportunityId;
                  if (!byOpp[id]) byOpp[id] = { actions: [], comments: [] };
                  byOpp[id].actions.push(a);
                });
                filteredComments.forEach((c) => {
                  const id = c.opportunityId;
                  if (!byOpp[id]) byOpp[id] = { actions: [], comments: [] };
                  byOpp[id].comments.push(c);
                });

                // Build grouping on the oppIds using groupItemsBy
                const oppIds = Object.keys(byOpp);
                // Create pseudo-items for grouping (one per oppId)
                const oppEntries = oppIds.map((oppId) => ({ oppId, opp: opportunityMap[oppId] }));
                const grouped = groupItemsBy(oppEntries, (entry) => entry.opp, groupBy);

                const totalItems = filteredActions.length + filteredComments.length;
                const allOriginalItems = allActions.length + allComments.length;
                const allIds = [...filteredActions.map((a) => a.id), ...filteredComments.map((c) => c.id)];
                const selCount = allIds.filter((id) => selectedItems.has(id)).length;

                // Render a single opportunity's actions/comments
                const renderOppGroup = (oppId) => {
                  const group = byOpp[oppId];
                  const opp = opportunityMap[oppId];
                  const oppName =
                    opp?.Opportunity ||
                    group.actions[0]?.opportunityName ||
                    group.comments[0]?.opportunityName ||
                    oppId;
                  const account = opp?.Account || group.actions[0]?.opportunityAccount || "";
                  return (
                    <Box key={oppId} sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                      <Box
                        onClick={() => {
                          if (opp) handleOpenOpportunityPopup(opp);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 2,
                          py: 0.75,
                          cursor: opp ? "pointer" : "default",
                          "&:hover": opp ? { bgcolor: alpha(theme.palette.primary.main, 0.04) } : {},
                        }}
                      >
                        {(() => {
                          const oppAllSynced =
                            syncInfo &&
                            group.actions.every((a) => syncInfo.actionSynced[a.id]) &&
                            group.comments.every((c) => syncInfo.commentSynced[c.id]);
                          return syncInfo ? (
                            <Tooltip title={oppAllSynced ? "Saved to Excel" : "Not saved to Excel"}>
                              <Box
                                component="span"
                                sx={{
                                  width: 7,
                                  height: 7,
                                  minWidth: 7,
                                  borderRadius: "50%",
                                  bgcolor: oppAllSynced ? "success.main" : "warning.main",
                                }}
                              />
                            </Tooltip>
                          ) : null;
                        })()}
                        {account && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ maxWidth: 130, flexShrink: 0, fontSize: "0.72rem" }}
                          >
                            {account} –
                          </Typography>
                        )}
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: "0.82rem" }}>
                          {oppName}
                        </Typography>
                        {opp && (
                          <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: "auto", flexShrink: 0 }} />
                        )}
                      </Box>
                      {group.actions.map((action) => {
                        const isSynced = syncInfo?.actionSynced?.[action.id];
                        return (
                          <Box
                            key={action.id}
                            onClick={() => {
                              if (opp) handleOpenOpportunityPopup(opp, 0);
                            }}
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              mx: 2,
                              mb: 0.5,
                              px: 1.5,
                              py: 1,
                              borderRadius: 1,
                              cursor: "pointer",
                              border: `1px solid ${selectedItems.has(action.id) ? theme.palette.primary.main : "transparent"}`,
                              bgcolor: selectedItems.has(action.id)
                                ? alpha(theme.palette.primary.main, 0.04)
                                : syncInfo && isSynced !== true
                                  ? alpha(theme.palette.warning.main, 0.03)
                                  : "transparent",
                              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={selectedItems.has(action.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(action.id)}
                              sx={{ p: 0, mt: 0.25 }}
                            />
                            {syncInfo && (
                              <Tooltip title={isSynced ? "Saved to Excel" : "Not saved to Excel"}>
                                <Box
                                  component="span"
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: isSynced ? "success.main" : "warning.main",
                                    flexShrink: 0,
                                    mt: 0.75,
                                  }}
                                />
                              </Tooltip>
                            )}
                            <AssignmentIcon sx={{ fontSize: 14, color: "text.disabled", mt: 0.5, flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {action.description}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {action.owner}
                                </Typography>
                                <Typography variant="caption" color="text.disabled">
                                  {action.dueDate ? new Date(action.dueDate).toLocaleDateString("en-GB") : ""}
                                </Typography>
                              </Box>
                            </Box>
                            <Chip
                              label={action.status === "done" ? "Done" : "Open"}
                              size="small"
                              color={action.status === "done" ? "success" : "default"}
                              sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }}
                            />
                            <Chip
                              label={action.priority || "medium"}
                              size="small"
                              color={
                                action.priority === "high" ? "error" : action.priority === "low" ? "info" : "warning"
                              }
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.6rem", flexShrink: 0 }}
                            />
                          </Box>
                        );
                      })}
                      {group.comments.map((comment) => {
                        const isSynced = syncInfo?.commentSynced?.[comment.id];
                        return (
                          <Box
                            key={comment.id}
                            onClick={() => {
                              if (opp) handleOpenOpportunityPopup(opp, 1);
                            }}
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              mx: 2,
                              mb: 0.5,
                              px: 1.5,
                              py: 1,
                              borderRadius: 1,
                              cursor: "pointer",
                              border: `1px solid ${selectedItems.has(comment.id) ? theme.palette.primary.main : "transparent"}`,
                              bgcolor: selectedItems.has(comment.id)
                                ? alpha(theme.palette.primary.main, 0.04)
                                : syncInfo && isSynced !== true
                                  ? alpha(theme.palette.warning.main, 0.03)
                                  : "transparent",
                              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={selectedItems.has(comment.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(comment.id)}
                              sx={{ p: 0, mt: 0.25 }}
                            />
                            {syncInfo && (
                              <Tooltip title={isSynced ? "Saved to Excel" : "Not saved to Excel"}>
                                <Box
                                  component="span"
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: isSynced ? "success.main" : "warning.main",
                                    flexShrink: 0,
                                    mt: 0.75,
                                  }}
                                />
                              </Tooltip>
                            )}
                            <CommentIcon sx={{ fontSize: 14, color: "text.disabled", mt: 0.5, flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                {comment.text}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1.5, mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {comment.author}
                                </Typography>
                                <Typography variant="caption" color="text.disabled">
                                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString("en-GB") : ""}
                                </Typography>
                                <Chip
                                  label={comment.type === "generic" ? "General" : "Specific"}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 16, fontSize: "0.6rem" }}
                                />
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                };

                return (
                  <>
                    {totalItems === 0 ? (
                      <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          {allOriginalItems === 0 ? "No actions or comments" : "No results matching your search"}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={allIds.length > 0 && selCount === allIds.length}
                            indeterminate={selCount > 0 && selCount < allIds.length}
                            onChange={() => toggleSelectAll(allIds)}
                          />
                          {selCount > 0 ? (
                            <>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {selCount} selected
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteSelected}
                                sx={{ ml: "auto" }}
                              >
                                Delete Selected
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {totalItems} item{totalItems !== 1 ? "s" : ""}
                            </Typography>
                          )}
                        </Box>
                        {groupBy === "none"
                          ? Object.keys(byOpp).map((oppId) => renderOppGroup(oppId))
                          : groupBy === "slThenSegment" || groupBy === "segmentThenSl"
                            ? Object.entries(grouped)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([primary, { subGroups }]) => {
                                  const primaryKey = `ac-${primary}`;
                                  const primaryCollapsed = isGroupCollapsed(primaryKey);
                                  const allEntries = Object.values(subGroups).flat();
                                  const primaryCount = allEntries.reduce(
                                    (s, entry) =>
                                      s +
                                      (byOpp[entry.oppId]?.actions?.length || 0) +
                                      (byOpp[entry.oppId]?.comments?.length || 0),
                                    0
                                  );
                                  const primarySynced =
                                    syncInfo &&
                                    allEntries.every((entry) => {
                                      const g = byOpp[entry.oppId];
                                      return (
                                        g &&
                                        g.actions.every((a) => syncInfo.actionSynced[a.id]) &&
                                        g.comments.every((c) => syncInfo.commentSynced[c.id])
                                      );
                                    });
                                  return (
                                    <React.Fragment key={primary}>
                                      <Box
                                        onClick={() => toggleGroupCollapse(primaryKey)}
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          px: 2,
                                          py: 0.75,
                                          cursor: "pointer",
                                          bgcolor: alpha(theme.palette.grey[500], 0.06),
                                          borderBottom: `1px solid ${theme.palette.divider}`,
                                          "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                        }}
                                      >
                                        {primaryCollapsed ? (
                                          <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                          <ExpandLessIcon sx={{ fontSize: 16 }} />
                                        )}
                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                          {primary}
                                        </Typography>
                                        <Chip
                                          label={primaryCount}
                                          size="small"
                                          sx={{ height: 18, fontSize: "0.65rem" }}
                                        />
                                        {syncInfo && (
                                          <Box
                                            component="span"
                                            sx={{
                                              width: 7,
                                              height: 7,
                                              borderRadius: "50%",
                                              bgcolor: primarySynced ? "success.main" : "warning.main",
                                              flexShrink: 0,
                                            }}
                                          />
                                        )}
                                      </Box>
                                      {!primaryCollapsed &&
                                        Object.entries(subGroups)
                                          .sort(([a], [b]) => a.localeCompare(b))
                                          .map(([secondary, entries]) => {
                                            const secKey = `ac-${primary}::${secondary}`;
                                            const secCollapsed = isGroupCollapsed(secKey);
                                            const secCount = entries.reduce(
                                              (s, entry) =>
                                                s +
                                                (byOpp[entry.oppId]?.actions?.length || 0) +
                                                (byOpp[entry.oppId]?.comments?.length || 0),
                                              0
                                            );
                                            const secSynced =
                                              syncInfo &&
                                              entries.every((entry) => {
                                                const g = byOpp[entry.oppId];
                                                return (
                                                  g &&
                                                  g.actions.every((a) => syncInfo.actionSynced[a.id]) &&
                                                  g.comments.every((c) => syncInfo.commentSynced[c.id])
                                                );
                                              });
                                            return (
                                              <React.Fragment key={secondary}>
                                                <Box
                                                  onClick={() => toggleGroupCollapse(secKey)}
                                                  sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    pl: 4,
                                                    pr: 2,
                                                    py: 0.5,
                                                    cursor: "pointer",
                                                    bgcolor: alpha(theme.palette.grey[500], 0.03),
                                                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                                    "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.06) },
                                                  }}
                                                >
                                                  {secCollapsed ? (
                                                    <ExpandMoreIcon sx={{ fontSize: 14 }} />
                                                  ) : (
                                                    <ExpandLessIcon sx={{ fontSize: 14 }} />
                                                  )}
                                                  <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                    {secondary}
                                                  </Typography>
                                                  <Chip
                                                    label={secCount}
                                                    size="small"
                                                    sx={{ height: 16, fontSize: "0.6rem" }}
                                                  />
                                                  {syncInfo && (
                                                    <Box
                                                      component="span"
                                                      sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        bgcolor: secSynced ? "success.main" : "warning.main",
                                                        flexShrink: 0,
                                                      }}
                                                    />
                                                  )}
                                                </Box>
                                                {!secCollapsed && entries.map((entry) => renderOppGroup(entry.oppId))}
                                              </React.Fragment>
                                            );
                                          })}
                                    </React.Fragment>
                                  );
                                })
                            : Object.entries(grouped)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([groupName, { items }]) => {
                                  if (!items || items.length === 0) return null;
                                  const gKey = `ac-${groupName}`;
                                  const gCollapsed = isGroupCollapsed(gKey);
                                  const gCount = items.reduce(
                                    (s, entry) =>
                                      s +
                                      (byOpp[entry.oppId]?.actions?.length || 0) +
                                      (byOpp[entry.oppId]?.comments?.length || 0),
                                    0
                                  );
                                  const gSynced =
                                    syncInfo &&
                                    items.every((entry) => {
                                      const g = byOpp[entry.oppId];
                                      return (
                                        g &&
                                        g.actions.every((a) => syncInfo.actionSynced[a.id]) &&
                                        g.comments.every((c) => syncInfo.commentSynced[c.id])
                                      );
                                    });
                                  return (
                                    <React.Fragment key={groupName}>
                                      <Box
                                        onClick={() => toggleGroupCollapse(gKey)}
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          px: 2,
                                          py: 0.75,
                                          cursor: "pointer",
                                          bgcolor: alpha(theme.palette.grey[500], 0.06),
                                          borderBottom: `1px solid ${theme.palette.divider}`,
                                          "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.1) },
                                        }}
                                      >
                                        {gCollapsed ? (
                                          <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                          <ExpandLessIcon sx={{ fontSize: 16 }} />
                                        )}
                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                          {groupName}
                                        </Typography>
                                        <Chip label={gCount} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                                        {syncInfo && (
                                          <Box
                                            component="span"
                                            sx={{
                                              width: 7,
                                              height: 7,
                                              borderRadius: "50%",
                                              bgcolor: gSynced ? "success.main" : "warning.main",
                                              flexShrink: 0,
                                            }}
                                          />
                                        )}
                                      </Box>
                                      {!gCollapsed && items.map((entry) => renderOppGroup(entry.oppId))}
                                    </React.Fragment>
                                  );
                                })}
                      </>
                    )}
                  </>
                );
              })()}

            {/* Staffing Needs Tab */}
            {activeTab === 4 &&
              (() => {
                // Gather all staffing needs from localStorage
                const allStaffingNeeds = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key?.startsWith("staffing_needs_")) {
                    try {
                      const oppId = key.replace("staffing_needs_", "");
                      const items = JSON.parse(localStorage.getItem(key));
                      items.forEach((n) => allStaffingNeeds.push({ ...n, opportunityId: n.opportunityId || oppId }));
                    } catch {
                      /* ignore */
                    }
                  }
                }

                // Filter by search text
                const lowerSearch = searchText.toLowerCase();
                const filteredStaffingNeeds = allStaffingNeeds.filter((n) => {
                  if (!lowerSearch) return true;
                  const opp = opportunityMap[n.opportunityId];
                  const oppName = (opp?.Opportunity || "").toLowerCase();
                  const account = (opp?.Account || "").toLowerCase();
                  const profile = (n.profile || "").toLowerCase();
                  const skills = (n.skills || []).join(" ").toLowerCase();
                  return (
                    oppName.includes(lowerSearch) ||
                    account.includes(lowerSearch) ||
                    profile.includes(lowerSearch) ||
                    skills.includes(lowerSearch)
                  );
                });

                // Group by opportunity
                const byOpp = {};
                filteredStaffingNeeds.forEach((n) => {
                  const id = n.opportunityId;
                  if (!byOpp[id]) byOpp[id] = { staffingNeeds: [] };
                  byOpp[id].staffingNeeds.push(n);
                });

                const totalItems = filteredStaffingNeeds.length;
                const allOriginalItems = allStaffingNeeds.length;
                const allIds = filteredStaffingNeeds.map((n) => n.id);
                const selCount = allIds.filter((id) => selectedItems.has(id)).length;

                // Render a single opportunity's staffing needs
                const renderOppGroup = (oppId) => {
                  const group = byOpp[oppId];
                  const opp = opportunityMap[oppId];
                  const oppName = opp?.Opportunity || oppId;
                  const account = opp?.Account || "";
                  return (
                    <Box key={oppId} sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                      <Box
                        onClick={() => {
                          if (opp) handleOpenOpportunityPopup(opp, 2);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 2,
                          py: 0.75,
                          cursor: opp ? "pointer" : "default",
                          "&:hover": opp ? { bgcolor: alpha(theme.palette.primary.main, 0.04) } : {},
                        }}
                      >
                        {(() => {
                          const oppAllSynced =
                            syncInfo && group.staffingNeeds.every((n) => syncInfo.staffingNeedSynced[n.id]);
                          return syncInfo ? (
                            <Tooltip title={oppAllSynced ? "Saved to Excel" : "Not saved to Excel"}>
                              <Box
                                component="span"
                                sx={{
                                  width: 7,
                                  height: 7,
                                  minWidth: 7,
                                  borderRadius: "50%",
                                  bgcolor: oppAllSynced ? "success.main" : "warning.main",
                                }}
                              />
                            </Tooltip>
                          ) : null;
                        })()}
                        {account && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ maxWidth: 130, flexShrink: 0, fontSize: "0.72rem" }}
                          >
                            {account} –
                          </Typography>
                        )}
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: "0.82rem" }}>
                          {oppName}
                        </Typography>
                        {opp && (
                          <OpenInNewIcon sx={{ fontSize: 12, color: "text.disabled", ml: "auto", flexShrink: 0 }} />
                        )}
                      </Box>
                      {group.staffingNeeds.map((need) => {
                        const isSynced = syncInfo?.staffingNeedSynced?.[need.id];
                        return (
                          <Box
                            key={need.id}
                            onClick={() => {
                              if (opp) handleOpenOpportunityPopup(opp, 2);
                            }}
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              mx: 2,
                              mb: 0.5,
                              px: 1.5,
                              py: 1,
                              borderRadius: 1,
                              cursor: "pointer",
                              border: `1px solid ${selectedItems.has(need.id) ? theme.palette.primary.main : "transparent"}`,
                              bgcolor: selectedItems.has(need.id)
                                ? alpha(theme.palette.primary.main, 0.04)
                                : syncInfo && isSynced !== true
                                  ? alpha(theme.palette.warning.main, 0.03)
                                  : "transparent",
                              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={selectedItems.has(need.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(need.id)}
                              sx={{ p: 0, mt: 0.25 }}
                            />
                            {syncInfo && (
                              <Tooltip title={isSynced ? "Saved to Excel" : "Not saved to Excel"}>
                                <Box
                                  component="span"
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: isSynced ? "success.main" : "warning.main",
                                    flexShrink: 0,
                                    mt: 0.75,
                                  }}
                                />
                              </Tooltip>
                            )}
                            <GroupIcon sx={{ fontSize: 14, color: "info.main", mt: 0.5, flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {need.profile} x{need.quantity}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 0.25 }}>
                                {need.startDate && (
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(need.startDate).toLocaleDateString("en-GB")} →{" "}
                                    {need.endDate ? new Date(need.endDate).toLocaleDateString("en-GB") : "-"}
                                  </Typography>
                                )}
                                {need.skills &&
                                  need.skills.length > 0 &&
                                  need.skills.map((s) => (
                                    <Chip
                                      key={s}
                                      label={s}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 16, fontSize: "0.6rem" }}
                                    />
                                  ))}
                              </Box>
                            </Box>
                            <Chip
                              label="Staffing"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.6rem", flexShrink: 0 }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  );
                };

                return (
                  <>
                    {totalItems === 0 ? (
                      <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          {allOriginalItems === 0 ? "No staffing needs" : "No results matching your search"}
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={allIds.length > 0 && selCount === allIds.length}
                            indeterminate={selCount > 0 && selCount < allIds.length}
                            onChange={() => toggleSelectAll(allIds)}
                          />
                          {selCount > 0 ? (
                            <>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                                {selCount} selected
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteSelected}
                                sx={{ ml: "auto" }}
                              >
                                Delete Selected
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                              {totalItems} staffing need{totalItems !== 1 ? "s" : ""}
                            </Typography>
                          )}
                        </Box>
                        {Object.keys(byOpp).map((oppId) => renderOppGroup(oppId))}
                      </>
                    )}
                  </>
                );
              })()}

            {/* Hidden file input for JSON import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              style={{ display: "none" }}
            />

            {/* Unsaved Changes Details Panel (collapsible, above footer) */}
            {showUnsavedDetails && syncInfo && syncInfo.unsavedDetails && (
              <>
                <Divider />
                <Box
                  sx={{
                    mx: 2,
                    mt: 2,
                    mb: 2,
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <WarningIcon sx={{ fontSize: 18, color: "warning.main" }} />
                    {syncInfo.totalUnsaved} unsaved change{syncInfo.totalUnsaved !== 1 ? "s" : ""} vs Excel
                  </Typography>

                  {/* Status Overrides Section */}
                  {(syncInfo.unsavedDetails.newOverrides.length > 0 ||
                    syncInfo.unsavedDetails.modifiedOverrides.length > 0 ||
                    syncInfo.unsavedDetails.removedOverrides.length > 0) && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <SwapHorizIcon sx={{ fontSize: 16 }} />
                        Status Overrides
                      </Typography>

                      {syncInfo.unsavedDetails.newOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        const account = opportunityMap[o.opportunityId]?.Account;
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.75,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.06),
                              border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                              {oppName}
                            </Typography>
                            {account && (
                              <Typography variant="caption" color="text.disabled">
                                {account}
                              </Typography>
                            )}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                              <Chip
                                label={getStatusLabel(o.originalStatus)}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.65rem", height: 20 }}
                              />
                              <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                              <Chip
                                label={getStatusLabel(o.newStatus)}
                                size="small"
                                color="primary"
                                sx={{ fontSize: "0.65rem", height: 20, fontWeight: 600 }}
                              />
                            </Box>
                          </Box>
                        );
                      })}

                      {syncInfo.unsavedDetails.modifiedOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        const account = opportunityMap[o.opportunityId]?.Account;
                        const changedFields = [];
                        if (o.savedNewStatus !== o.newStatus)
                          changedFields.push({
                            label: "Status",
                            from: getStatusLabel(o.savedNewStatus),
                            to: getStatusLabel(o.newStatus),
                          });
                        if (o.savedOriginalStatus !== o.originalStatus)
                          changedFields.push({
                            label: "Original",
                            from: getStatusLabel(o.savedOriginalStatus),
                            to: getStatusLabel(o.originalStatus),
                          });
                        if (changedFields.length === 0)
                          changedFields.push({ label: "Override", from: "(previous)", to: "(updated)" });
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.75,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.info.main, 0.06),
                              border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                              {oppName}
                            </Typography>
                            {account && (
                              <Typography variant="caption" color="text.disabled">
                                {account}
                              </Typography>
                            )}
                            {changedFields.map((field, idx) => (
                              <Box
                                key={idx}
                                sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5, mt: 0.25 }}
                              >
                                <Typography variant="caption" fontWeight={600} sx={{ minWidth: 80 }}>
                                  {field.label}:
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ textDecoration: "line-through" }}
                                >
                                  {field.from}
                                </Typography>
                                <ArrowForwardIcon sx={{ fontSize: 10, color: "text.disabled" }} />
                                <Typography variant="caption" fontWeight={600} color="info.main">
                                  {field.to}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        );
                      })}

                      {syncInfo.unsavedDetails.removedOverrides.map((o) => {
                        const oppName = opportunityMap[o.opportunityId]?.Opportunity || o.opportunityId;
                        return (
                          <Box
                            key={o.opportunityId}
                            sx={{
                              ml: 2,
                              mb: 0.75,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.error.main, 0.06),
                              border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                              {oppName}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              Was: {getStatusLabel(o.savedOriginalStatus)} → {getStatusLabel(o.savedNewStatus)}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {/* Manual Opportunities Section */}
                  {(syncInfo.unsavedDetails.newOpps.length > 0 ||
                    syncInfo.unsavedDetails.modifiedOpps.length > 0 ||
                    syncInfo.unsavedDetails.removedOpps.length > 0) && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <NoteAddIcon sx={{ fontSize: 16 }} />
                        Manual Opportunities
                      </Typography>

                      {syncInfo.unsavedDetails.newOpps.map((opp) => (
                        <Box
                          key={opp["Opportunity ID"]}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            {opp.Opportunity || opp["Opportunity ID"]}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>
                            {opp.Account}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label={getStatusLabel(opp.Status)}
                              size="small"
                              color="primary"
                              sx={{ fontSize: "0.65rem", height: 20, fontWeight: 600 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatCurrency(opp["Gross Revenue"])}
                            </Typography>
                          </Box>
                        </Box>
                      ))}

                      {syncInfo.unsavedDetails.modifiedOpps.map(({ current, saved }) => {
                        const changedFields = [];
                        if (current.Status !== saved.Status)
                          changedFields.push({
                            label: "Status",
                            from: getStatusLabel(saved.Status),
                            to: getStatusLabel(current.Status),
                          });
                        if (current["Gross Revenue"] !== saved["Gross Revenue"])
                          changedFields.push({
                            label: "Revenue",
                            from: formatCurrency(saved["Gross Revenue"]),
                            to: formatCurrency(current["Gross Revenue"]),
                          });
                        if (current.Opportunity !== saved.Opportunity)
                          changedFields.push({ label: "Name", from: saved.Opportunity, to: current.Opportunity });
                        if (current.Account !== saved.Account)
                          changedFields.push({ label: "Account", from: saved.Account, to: current.Account });
                        if (current.Manager !== saved.Manager)
                          changedFields.push({
                            label: "Manager",
                            from: saved.Manager || "-",
                            to: current.Manager || "-",
                          });
                        if (current["Net Revenue"] !== saved["Net Revenue"])
                          changedFields.push({
                            label: "Net Revenue",
                            from: formatCurrency(saved["Net Revenue"]),
                            to: formatCurrency(current["Net Revenue"]),
                          });
                        if (current["Booking Date"] !== saved["Booking Date"])
                          changedFields.push({
                            label: "Booking Date",
                            from: formatDateShort(saved["Booking Date"]),
                            to: formatDateShort(current["Booking Date"]),
                          });
                        if (current["Close Date"] !== saved["Close Date"])
                          changedFields.push({
                            label: "Close Date",
                            from: formatDateShort(saved["Close Date"]),
                            to: formatDateShort(current["Close Date"]),
                          });
                        if (changedFields.length === 0)
                          changedFields.push({ label: "Other fields", from: "(previous)", to: "(updated)" });

                        return (
                          <Box
                            key={current["Opportunity ID"]}
                            sx={{
                              ml: 2,
                              mb: 0.75,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.info.main, 0.06),
                              border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                              {current.Opportunity || current["Opportunity ID"]}
                            </Typography>
                            {current.Account && (
                              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>
                                {current.Account}
                              </Typography>
                            )}
                            {changedFields.map((field, idx) => (
                              <Box
                                key={idx}
                                sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5, mt: 0.25 }}
                              >
                                <Typography variant="caption" fontWeight={600} sx={{ minWidth: 80 }}>
                                  {field.label}:
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ textDecoration: "line-through" }}
                                >
                                  {field.from}
                                </Typography>
                                <ArrowForwardIcon sx={{ fontSize: 10, color: "text.disabled" }} />
                                <Typography variant="caption" fontWeight={600} color="info.main">
                                  {field.to}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        );
                      })}

                      {syncInfo.unsavedDetails.removedOpps.map((opp) => (
                        <Box
                          key={opp["Opportunity ID"]}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            {opp["Opportunity ID"]}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Accounts Section */}
                  {(syncInfo.unsavedDetails.newAccounts.length > 0 ||
                    syncInfo.unsavedDetails.modifiedAccounts.length > 0 ||
                    syncInfo.unsavedDetails.removedAccounts.length > 0) && (
                    <Box sx={{ mb: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <AddBusinessIcon sx={{ fontSize: 16 }} />
                        Accounts
                      </Typography>

                      {syncInfo.unsavedDetails.newAccounts.map((acc) => (
                        <Box
                          key={acc.Account}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            {acc.Account}
                          </Typography>
                          {acc.Website && (
                            <Typography variant="caption" color="text.disabled">
                              {acc.Website}
                            </Typography>
                          )}
                        </Box>
                      ))}

                      {syncInfo.unsavedDetails.modifiedAccounts.map((acc) => (
                        <Box
                          key={acc.current.Account}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            {acc.current.Account}
                          </Typography>
                        </Box>
                      ))}

                      {syncInfo.unsavedDetails.removedAccounts.map((acc) => (
                        <Box
                          key={acc.Account}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            {acc.Account}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Staffing Needs Section */}
                  {(syncInfo.unsavedDetails.newStaffingNeeds.length > 0 ||
                    syncInfo.unsavedDetails.modifiedStaffingNeeds.length > 0 ||
                    syncInfo.unsavedDetails.removedStaffingNeeds.length > 0) && (
                    <Box sx={{ mb: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <GroupIcon sx={{ fontSize: 16 }} />
                        Staffing Needs
                      </Typography>

                      {syncInfo.unsavedDetails.newStaffingNeeds.map((n) => (
                        <Box
                          key={n.id}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            + {n.profile} x{n.quantity}
                          </Typography>
                          {n.startDate && (
                            <Typography variant="caption" color="text.disabled">
                              {new Date(n.startDate).toLocaleDateString("en-GB")} →{" "}
                              {n.endDate ? new Date(n.endDate).toLocaleDateString("en-GB") : "-"}
                            </Typography>
                          )}
                        </Box>
                      ))}

                      {syncInfo.unsavedDetails.modifiedStaffingNeeds.map((n) => (
                        <Box
                          key={n.current.id}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            ~ {n.current.profile} x{n.current.quantity}
                          </Typography>
                        </Box>
                      ))}

                      {syncInfo.unsavedDetails.removedStaffingNeeds.map((n) => (
                        <Box
                          key={n.id}
                          sx={{
                            ml: 2,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.06),
                            border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                            - {n.profile} x{n.quantity}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {syncInfo.totalUnsaved === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      No detailed differences found.
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {/* Import Results - Comparison View */}
            {importResult && (
              <Box sx={{ mx: 2, mb: 2 }}>
                {importResult.error ? (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.error.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <WarningIcon color="error" />
                    <Typography variant="body2" color="error.main">
                      {importResult.error}
                    </Typography>
                  </Box>
                ) : (
                  importResult.details && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Summary Chips */}
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Chip
                          icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                          label={`${(importResult.details.statusOverrides.created?.length || 0) + (importResult.details.manualOpportunities.created?.length || 0) + (importResult.details.manualAccounts?.created?.length || 0) + (importResult.details.actionsComments?.actions?.created?.length || 0) + (importResult.details.actionsComments?.comments?.created?.length || 0)} Created`}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip
                          icon={<UpdateIcon sx={{ fontSize: 16 }} />}
                          label={`${(importResult.details.statusOverrides.updated?.length || 0) + (importResult.details.manualOpportunities.updated?.length || 0) + (importResult.details.actionsComments?.actions?.updated?.length || 0) + (importResult.details.actionsComments?.comments?.updated?.length || 0)} Updated`}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                        <Chip
                          icon={<BlockIcon sx={{ fontSize: 16 }} />}
                          label={`${(importResult.details.statusOverrides.skipped?.length || 0) + (importResult.details.manualOpportunities.skipped?.length || 0) + (importResult.details.manualAccounts?.skipped?.length || 0) + (importResult.details.actionsComments?.actions?.skipped?.length || 0) + (importResult.details.actionsComments?.comments?.skipped?.length || 0)} Skipped`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>

                      {/* Status Overrides Section */}
                      {(importResult.details.statusOverrides.updated?.length > 0 ||
                        importResult.details.statusOverrides.skipped?.length > 0) && (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <SwapHorizIcon sx={{ fontSize: 18 }} /> Status Overrides
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {[
                              ...(importResult.details.statusOverrides.updated || []),
                              ...(importResult.details.statusOverrides.skipped || []),
                            ].map((item, idx) => {
                              const isUpdated = item.decision === "updated";
                              const decisionColor = isUpdated ? "info" : "warning";
                              const DecisionIcon = isUpdated ? UpdateIcon : BlockIcon;
                              const statusChanged =
                                item.existing && item.existing.statusCode !== item.imported.newStatusCode;

                              return (
                                <Box
                                  key={`override-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                  }}
                                >
                                  {/* Header */}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      mb: 1,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Chip
                                        label={item.opportunityId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem", height: 18 }}
                                      />
                                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                        {item.opportunityName}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                                      label={isUpdated ? "Applied" : "Skipped"}
                                      size="small"
                                      color={decisionColor}
                                      sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                                    />
                                  </Box>

                                  {/* Comparison */}
                                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
                                    {/* Left: Existing */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette.grey[500], 0.06),
                                        border: `1px solid ${alpha(theme.palette.grey[400], 0.15)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        CRM Status
                                      </Typography>
                                      {item.existing ? (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: statusChanged
                                              ? alpha(theme.palette.warning.main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                          }}
                                        >
                                          {item.existing.status}
                                        </Typography>
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="text.disabled"
                                          sx={{ fontStyle: "italic" }}
                                        >
                                          Not found
                                        </Typography>
                                      )}
                                    </Box>

                                    {/* Arrow */}
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                      <ArrowForwardIcon sx={{ fontSize: 18, color: `${decisionColor}.main` }} />
                                    </Box>

                                    {/* Right: Imported */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color={`${decisionColor}.main`}
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Import Status
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                          bgcolor: statusChanged
                                            ? alpha(theme.palette[decisionColor].main, 0.2)
                                            : "transparent",
                                          px: 0.5,
                                          borderRadius: 0.5,
                                          fontWeight: statusChanged ? 600 : 400,
                                        }}
                                      >
                                        {item.imported.newStatus}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  {/* Reason */}
                                  <Typography
                                    variant="caption"
                                    color={`${decisionColor}.dark`}
                                    fontWeight={500}
                                    sx={{ display: "block", mt: 1 }}
                                  >
                                    {isUpdated ? "✓" : "⊘"} {item.reason}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Manual Opportunities Section */}
                      {(importResult.details.manualOpportunities.created?.length > 0 ||
                        importResult.details.manualOpportunities.updated?.length > 0 ||
                        importResult.details.manualOpportunities.skipped?.length > 0) && (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <NoteAddIcon sx={{ fontSize: 18 }} /> Manual Opportunities
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {[
                              ...(importResult.details.manualOpportunities.created || []),
                              ...(importResult.details.manualOpportunities.updated || []),
                              ...(importResult.details.manualOpportunities.skipped || []),
                            ].map((item, idx) => {
                              const isCreated = item.decision === "created";
                              const isUpdated = item.decision === "updated";
                              const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                              const DecisionIcon = isCreated
                                ? AddCircleOutlineIcon
                                : isUpdated
                                  ? UpdateIcon
                                  : BlockIcon;
                              const statusChanged =
                                item.existing && item.existing.statusCode !== item.imported.statusCode;

                              return (
                                <Box
                                  key={`manual-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                  }}
                                >
                                  {/* Header */}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      mb: 1,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Chip
                                        label={item.opportunityId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem", height: 18 }}
                                      />
                                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                        {item.opportunityName}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                                      label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                                      size="small"
                                      color={decisionColor}
                                      sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                                    />
                                  </Box>

                                  {/* Comparison */}
                                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
                                    {/* Left: Existing */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: item.existing
                                          ? alpha(theme.palette.grey[500], 0.06)
                                          : alpha(theme.palette.grey[300], 0.08),
                                        border: `1px solid ${alpha(theme.palette.grey[400], 0.15)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Existing
                                      </Typography>
                                      {item.existing ? (
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: statusChanged
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Status:</strong> {item.existing.status}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: "0.7rem" }}
                                          >
                                            <strong>Revenue:</strong> {item.existing.revenue}
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="text.disabled"
                                          sx={{ fontStyle: "italic" }}
                                        >
                                          No existing data
                                        </Typography>
                                      )}
                                    </Box>

                                    {/* Arrow */}
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                      <ArrowForwardIcon sx={{ fontSize: 18, color: `${decisionColor}.main` }} />
                                    </Box>

                                    {/* Right: Imported */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color={`${decisionColor}.main`}
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Imported
                                      </Typography>
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: statusChanged
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: statusChanged ? 600 : 400,
                                          }}
                                        >
                                          <strong>Status:</strong> {item.imported.status}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ fontSize: "0.7rem" }}
                                        >
                                          <strong>Revenue:</strong> {item.imported.revenue}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>

                                  {/* Reason */}
                                  <Typography
                                    variant="caption"
                                    color={`${decisionColor}.dark`}
                                    fontWeight={500}
                                    sx={{ display: "block", mt: 1 }}
                                  >
                                    {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Manual Accounts Section */}
                      {(importResult.details.manualAccounts?.created?.length > 0 ||
                        importResult.details.manualAccounts?.skipped?.length > 0) && (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <AddBusinessIcon sx={{ fontSize: 18 }} /> Manual Accounts
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {[
                              ...(importResult.details.manualAccounts.created || []),
                              ...(importResult.details.manualAccounts.skipped || []),
                            ].map((item, idx) => {
                              const isCreated = item.decision === "created";
                              const decisionColor = isCreated ? "success" : "warning";
                              const DecisionIcon = isCreated ? AddCircleOutlineIcon : BlockIcon;

                              return (
                                <Box
                                  key={`account-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      mb: 1,
                                    }}
                                  >
                                    <Typography variant="caption" fontWeight={600}>
                                      {item.accountName}
                                    </Typography>
                                    <Chip
                                      icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                                      label={isCreated ? "Created" : "Skipped"}
                                      size="small"
                                      color={decisionColor}
                                      sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                                    />
                                  </Box>
                                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                                      <strong>Parent:</strong> {item.imported.parent}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                                      <strong>Segment:</strong> {item.imported.segment}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                                      <strong>Country:</strong> {item.imported.country}
                                    </Typography>
                                  </Box>
                                  <Typography
                                    variant="caption"
                                    color={`${decisionColor}.dark`}
                                    fontWeight={500}
                                    sx={{ display: "block", mt: 1 }}
                                  >
                                    {isCreated ? "✓" : "⊘"} {item.reason}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Actions Section */}
                      {(importResult.details.actionsComments?.actions?.created?.length > 0 ||
                        importResult.details.actionsComments?.actions?.updated?.length > 0 ||
                        importResult.details.actionsComments?.actions?.skipped?.length > 0) && (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <AssignmentIcon sx={{ fontSize: 18 }} /> Actions
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {[
                              ...(importResult.details.actionsComments.actions.created || []),
                              ...(importResult.details.actionsComments.actions.updated || []),
                              ...(importResult.details.actionsComments.actions.skipped || []),
                            ].map((item, idx) => {
                              const isCreated = item.decision === "created";
                              const isUpdated = item.decision === "updated";
                              const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                              const DecisionIcon = isCreated
                                ? AddCircleOutlineIcon
                                : isUpdated
                                  ? UpdateIcon
                                  : BlockIcon;

                              return (
                                <Box
                                  key={`action-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                  }}
                                >
                                  {/* Header */}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      mb: 1,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Chip
                                        label={item.opportunityId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem", height: 18 }}
                                      />
                                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                        {item.opportunityName}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                                      label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                                      size="small"
                                      color={decisionColor}
                                      sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                                    />
                                  </Box>

                                  {/* Comparison */}
                                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
                                    {/* Left: Existing */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: item.existing
                                          ? alpha(theme.palette.grey[500], 0.06)
                                          : alpha(theme.palette.grey[300], 0.08),
                                        border: `1px solid ${alpha(theme.palette.grey[400], 0.15)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Existing
                                      </Typography>
                                      {item.existing ? (
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: item.changes?.includes("description")
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Desc:</strong> {item.existing.description?.substring(0, 40)}
                                            {item.existing.description?.length > 40 ? "..." : ""}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: item.changes?.includes("owner")
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Owner:</strong> {item.existing.owner}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: item.changes?.includes("status")
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Status:</strong> {item.existing.status}
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="text.disabled"
                                          sx={{ fontStyle: "italic" }}
                                        >
                                          No existing data
                                        </Typography>
                                      )}
                                    </Box>

                                    {/* Arrow */}
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                      <ArrowForwardIcon sx={{ fontSize: 18, color: `${decisionColor}.main` }} />
                                    </Box>

                                    {/* Right: Imported */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color={`${decisionColor}.main`}
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Imported
                                      </Typography>
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: item.changes?.includes("description")
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: item.changes?.includes("description") ? 600 : 400,
                                          }}
                                        >
                                          <strong>Desc:</strong> {item.imported.description?.substring(0, 40)}
                                          {item.imported.description?.length > 40 ? "..." : ""}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: item.changes?.includes("owner")
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: item.changes?.includes("owner") ? 600 : 400,
                                          }}
                                        >
                                          <strong>Owner:</strong> {item.imported.owner}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: item.changes?.includes("status")
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: item.changes?.includes("status") ? 600 : 400,
                                          }}
                                        >
                                          <strong>Status:</strong> {item.imported.status}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>

                                  {/* Reason */}
                                  <Typography
                                    variant="caption"
                                    color={`${decisionColor}.dark`}
                                    fontWeight={500}
                                    sx={{ display: "block", mt: 1 }}
                                  >
                                    {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Comments Section */}
                      {(importResult.details.actionsComments?.comments?.created?.length > 0 ||
                        importResult.details.actionsComments?.comments?.updated?.length > 0 ||
                        importResult.details.actionsComments?.comments?.skipped?.length > 0) && (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <CommentIcon sx={{ fontSize: 18 }} /> Comments
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {[
                              ...(importResult.details.actionsComments.comments.created || []),
                              ...(importResult.details.actionsComments.comments.updated || []),
                              ...(importResult.details.actionsComments.comments.skipped || []),
                            ].map((item, idx) => {
                              const isCreated = item.decision === "created";
                              const isUpdated = item.decision === "updated";
                              const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                              const DecisionIcon = isCreated
                                ? AddCircleOutlineIcon
                                : isUpdated
                                  ? UpdateIcon
                                  : BlockIcon;

                              return (
                                <Box
                                  key={`comment-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                                    border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                  }}
                                >
                                  {/* Header */}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      mb: 1,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Chip
                                        label={item.opportunityId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem", height: 18 }}
                                      />
                                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                        {item.opportunityName}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                                      label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                                      size="small"
                                      color={decisionColor}
                                      sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                                    />
                                  </Box>

                                  {/* Comparison */}
                                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
                                    {/* Left: Existing */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: item.existing
                                          ? alpha(theme.palette.grey[500], 0.06)
                                          : alpha(theme.palette.grey[300], 0.08),
                                        border: `1px solid ${alpha(theme.palette.grey[400], 0.15)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Existing
                                      </Typography>
                                      {item.existing ? (
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: item.changes?.includes("text")
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Text:</strong> {item.existing.text?.substring(0, 50)}
                                            {item.existing.text?.length > 50 ? "..." : ""}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              bgcolor: item.changes?.includes("author")
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : "transparent",
                                              px: 0.5,
                                              borderRadius: 0.5,
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            <strong>Author:</strong> {item.existing.author}
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="text.disabled"
                                          sx={{ fontStyle: "italic" }}
                                        >
                                          No existing data
                                        </Typography>
                                      )}
                                    </Box>

                                    {/* Arrow */}
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                      <ArrowForwardIcon sx={{ fontSize: 18, color: `${decisionColor}.main` }} />
                                    </Box>

                                    {/* Right: Imported */}
                                    <Box
                                      sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight={600}
                                        color={`${decisionColor}.main`}
                                        sx={{
                                          display: "block",
                                          mb: 0.5,
                                          textTransform: "uppercase",
                                          fontSize: "0.6rem",
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Imported
                                      </Typography>
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: item.changes?.includes("text")
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: item.changes?.includes("text") ? 600 : 400,
                                          }}
                                        >
                                          <strong>Text:</strong> {item.imported.text?.substring(0, 50)}
                                          {item.imported.text?.length > 50 ? "..." : ""}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            bgcolor: item.changes?.includes("author")
                                              ? alpha(theme.palette[decisionColor].main, 0.2)
                                              : "transparent",
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            fontSize: "0.7rem",
                                            fontWeight: item.changes?.includes("author") ? 600 : 400,
                                          }}
                                        >
                                          <strong>Author:</strong> {item.imported.author}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>

                                  {/* Reason */}
                                  <Typography
                                    variant="caption"
                                    color={`${decisionColor}.dark`}
                                    fontWeight={500}
                                    sx={{ display: "block", mt: 1 }}
                                  >
                                    {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Empty State */}
                      {importResult.details.statusOverrides.updated?.length === 0 &&
                        importResult.details.statusOverrides.skipped?.length === 0 &&
                        importResult.details.manualOpportunities.created?.length === 0 &&
                        importResult.details.manualOpportunities.updated?.length === 0 &&
                        importResult.details.manualOpportunities.skipped?.length === 0 &&
                        importResult.details.manualAccounts?.created?.length === 0 &&
                        importResult.details.manualAccounts?.skipped?.length === 0 &&
                        importResult.details.actionsComments?.actions?.created?.length === 0 &&
                        importResult.details.actionsComments?.actions?.updated?.length === 0 &&
                        importResult.details.actionsComments?.actions?.skipped?.length === 0 &&
                        importResult.details.actionsComments?.comments?.created?.length === 0 &&
                        importResult.details.actionsComments?.comments?.updated?.length === 0 &&
                        importResult.details.actionsComments?.comments?.skipped?.length === 0 && (
                          <Box
                            sx={{
                              p: 3,
                              textAlign: "center",
                              bgcolor: alpha(theme.palette.grey[500], 0.05),
                              borderRadius: 2,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              No items were found in the import file.
                            </Typography>
                          </Box>
                        )}
                    </Box>
                  )
                )}
              </Box>
            )}
          </DialogContent>

          <DialogActions
            sx={{
              px: 4,
              py: 2.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {syncInfo && !syncInfo.allSynced && (
                <>
                  <Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "warning.main" }} />
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    {syncInfo.totalUnsaved} unsaved
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setShowUnsavedDetails((prev) => !prev)}
                    sx={{ textTransform: "none", minWidth: 0, fontSize: "0.75rem" }}
                  >
                    {showUnsavedDetails ? "Hide details" : "Details"}
                  </Button>
                </>
              )}
              {saveExcelResult && !saveExcelResult.success && (
                <Typography variant="body2" color="error.main" fontWeight={600}>
                  Error: {saveExcelResult.error}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {confirmClearAll ? (
                <>
                  <Typography variant="body2" color="error" sx={{ mr: 1 }}>
                    Reset all changes?
                  </Typography>
                  <Button onClick={() => setConfirmClearAll(false)} size="small">
                    Cancel
                  </Button>
                  <Button color="error" variant="contained" size="small" onClick={handleClearAll}>
                    Confirm
                  </Button>
                </>
              ) : (
                <>
                  {((activeTab === 0 && overrideCount > 0) ||
                    (activeTab === 1 && manualCount > 0) ||
                    (activeTab === 2 && accountCount > 0) ||
                    (activeTab === 3 && actionsCommentsCount > 0)) && (
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      startIcon={<UndoIcon />}
                      onClick={() => setConfirmClearAll(true)}
                    >
                      Reset All
                    </Button>
                  )}
                  {hasFileHandle && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<SaveIcon />}
                      onClick={() => setConfirmSaveOpen(true)}
                      disabled={isSavingExcel || (syncInfo && syncInfo.allSynced)}
                    >
                      Save to Excel
                    </Button>
                  )}
                  <Button onClick={handleClose} variant="contained">
                    Close
                  </Button>
                </>
              )}
            </Box>
          </DialogActions>
        </Dialog>

        {/* Menu for secondary actions */}
        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
          <MenuItem
            onClick={() => {
              handleCopyReport();
              setMenuAnchorEl(null);
            }}
            disabled={totalCount === 0}
          >
            <ListItemIcon>
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </ListItemIcon>
            {copied ? "Copied!" : "Copy Report"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleDownloadReport();
              setMenuAnchorEl(null);
            }}
            disabled={totalCount === 0}
          >
            <ListItemIcon>
              <AssignmentIcon fontSize="small" />
            </ListItemIcon>
            Download Report
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              handleExportJSON();
              setMenuAnchorEl(null);
            }}
            disabled={totalCount === 0}
          >
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            Export JSON
          </MenuItem>
          <MenuItem
            onClick={() => {
              fileInputRef.current?.click();
              setMenuAnchorEl(null);
            }}
            disabled={isImporting}
          >
            <ListItemIcon>
              <FileUploadIcon fontSize="small" />
            </ListItemIcon>
            {isImporting ? "Importing..." : "Import JSON"}
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setDebugDialogOpen(true);
              setMenuAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <BugReportIcon fontSize="small" />
            </ListItemIcon>
            Debug
          </MenuItem>
        </Menu>

        {/* Debug Dialog */}
        <Dialog
          open={debugDialogOpen}
          onClose={() => setDebugDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, maxHeight: "90vh" } }}
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <BugReportIcon />
              <Typography variant="h6" fontWeight={600}>
                Debug — Excel Data
              </Typography>
            </Box>
            <IconButton onClick={() => setDebugDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            {/* Differences section — always shown first */}
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Differences (saved vs current)
              </Typography>
              {syncInfo?.unsavedDetails ? (
                (() => {
                  const d = syncInfo.unsavedDetails;
                  const preStyle = {
                    margin: 0,
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  };

                  // Each section has its own way to extract saved/current from modified items
                  const sections = [
                    {
                      label: "Status Overrides",
                      added: d.newOverrides,
                      modified: d.modifiedOverrides.map((o) => {
                        // Overrides are flat objects: split into saved vs current
                        const { savedOriginalStatus, savedNewStatus, ...currentFields } = o;
                        return {
                          saved: { ...currentFields, originalStatus: savedOriginalStatus, newStatus: savedNewStatus },
                          current: currentFields,
                        };
                      }),
                      removed: d.removedOverrides,
                    },
                    {
                      label: "Manual Opportunities",
                      added: d.newOpps,
                      modified: d.modifiedOpps, // already { current, saved }
                      removed: d.removedOpps,
                    },
                    {
                      label: "Manual Accounts",
                      added: d.newAccounts,
                      modified: d.modifiedAccounts, // now { current, saved }
                      removed: d.removedAccounts,
                    },
                  ];
                  const hasAny = sections.some((s) => s.added.length || s.modified.length || s.removed.length);
                  if (!hasAny)
                    return (
                      <Typography variant="body2" color="text.secondary">
                        No differences — everything is synced.
                      </Typography>
                    );
                  return sections.map((s) => {
                    if (!s.added.length && !s.modified.length && !s.removed.length) return null;
                    return (
                      <Box key={s.label} sx={{ mb: 2 }}>
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{ textTransform: "uppercase", color: "text.secondary" }}
                        >
                          {s.label}
                        </Typography>
                        {s.added.map((item, i) => (
                          <Box key={`a${i}`} sx={{ ml: 1, mt: 0.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Chip
                                label="ADDED"
                                size="small"
                                sx={{
                                  bgcolor: "#e8f5e9",
                                  color: "#2e7d32",
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Box>
                            <Box
                              sx={{ bgcolor: "#f1f8e9", border: "1px solid #c5e1a5", borderRadius: 1, p: 1, mt: 0.5 }}
                            >
                              <pre style={preStyle}>{JSON.stringify(item, null, 2)}</pre>
                            </Box>
                          </Box>
                        ))}
                        {s.modified.map((item, i) => (
                          <Box key={`m${i}`} sx={{ ml: 1, mt: 0.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Chip
                                label="MODIFIED"
                                size="small"
                                sx={{
                                  bgcolor: "#fff3e0",
                                  color: "#e65100",
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                              <Box
                                sx={{ flex: 1, bgcolor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 1, p: 1 }}
                              >
                                <Typography variant="caption" fontWeight={700} color="error.main">
                                  Saved
                                </Typography>
                                <pre style={preStyle}>{JSON.stringify(item.saved, null, 2)}</pre>
                              </Box>
                              <Box
                                sx={{ flex: 1, bgcolor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 1, p: 1 }}
                              >
                                <Typography variant="caption" fontWeight={700} color="success.main">
                                  Current
                                </Typography>
                                <pre style={preStyle}>{JSON.stringify(item.current, null, 2)}</pre>
                              </Box>
                            </Box>
                          </Box>
                        ))}
                        {s.removed.map((item, i) => (
                          <Box key={`r${i}`} sx={{ ml: 1, mt: 0.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Chip
                                label="REMOVED"
                                size="small"
                                sx={{
                                  bgcolor: "#ffebee",
                                  color: "#c62828",
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Box>
                            <Box
                              sx={{ bgcolor: "#fce4ec", border: "1px solid #ef9a9a", borderRadius: 1, p: 1, mt: 0.5 }}
                            >
                              <pre style={preStyle}>{JSON.stringify(item, null, 2)}</pre>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    );
                  });
                })()
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {hasFileHandle ? "Computing differences..." : "No Excel file loaded — no diff available."}
                </Typography>
              )}
            </Box>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Imported from Excel (saved snapshot)
              </Typography>
              <Box
                sx={{
                  bgcolor: alpha(theme.palette.grey[900], 0.04),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  p: 1.5,
                  maxHeight: 300,
                  overflow: "auto",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {excelSavedSnapshot
                    ? JSON.stringify(JSON.parse(excelSavedSnapshot), null, 2)
                    : "No Excel file loaded"}
                </pre>
              </Box>
            </Box>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Current state (will be saved on next Save)
              </Typography>
              <Box
                sx={{
                  bgcolor: alpha(theme.palette.grey[900], 0.04),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  p: 1.5,
                  maxHeight: 300,
                  overflow: "auto",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {collectCurrentChanges
                    ? JSON.stringify(collectCurrentChanges(), null, 2)
                    : "No collect function available"}
                </pre>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDebugDialogOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Grouping Settings Modal */}
        <Dialog
          open={groupSettingsOpen}
          onClose={() => setGroupSettingsOpen(false)}
          PaperProps={{ sx: { borderRadius: 2.5, p: 2.5, minWidth: 320, maxWidth: 360 } }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, px: 0.5 }}>
            Group by
          </Typography>
          {[
            { value: "none", label: "No grouping", desc: "Flat list of all items" },
            { value: "serviceLine", label: "Service Line", desc: "Group by Service Line 1" },
            { value: "segment", label: "Segment", desc: "Group by Sub Segment Code" },
          ].map((opt) => (
            <Box
              key={opt.value}
              onClick={() => {
                setGroupBy(opt.value);
                setCollapsedGroups(new Set());
                setAllCollapsedMap({ 0: false, 1: false, 2: false, 3: false, 4: false });
                setGroupSettingsOpen(false);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: "pointer",
                mb: 0.5,
                border: `2px solid ${groupBy === opt.value ? theme.palette.primary.main : "transparent"}`,
                bgcolor: groupBy === opt.value ? alpha(theme.palette.primary.main, 0.06) : "transparent",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                transition: "all 0.15s",
              }}
            >
              <Radio checked={groupBy === opt.value} size="small" sx={{ p: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={groupBy === opt.value ? 700 : 500} sx={{ fontSize: "0.85rem" }}>
                  {opt.label}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {opt.desc}
                </Typography>
              </Box>
            </Box>
          ))}
          <Divider sx={{ my: 1 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ mb: 0.5, px: 0.5, display: "block" }}
          >
            Two-level hierarchy
          </Typography>
          {[
            { value: "slThenSegment", label: "Service Line \u2192 Segment", desc: "Service Line first, then Segment" },
            { value: "segmentThenSl", label: "Segment \u2192 Service Line", desc: "Segment first, then Service Line" },
          ].map((opt) => (
            <Box
              key={opt.value}
              onClick={() => {
                setGroupBy(opt.value);
                setCollapsedGroups(new Set());
                setAllCollapsedMap({ 0: false, 1: false, 2: false, 3: false, 4: false });
                setGroupSettingsOpen(false);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: "pointer",
                mb: 0.5,
                border: `2px solid ${groupBy === opt.value ? theme.palette.primary.main : "transparent"}`,
                bgcolor: groupBy === opt.value ? alpha(theme.palette.primary.main, 0.06) : "transparent",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                transition: "all 0.15s",
              }}
            >
              <Radio checked={groupBy === opt.value} size="small" sx={{ p: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={groupBy === opt.value ? 700 : 500} sx={{ fontSize: "0.85rem" }}>
                  {opt.label}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {opt.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Dialog>

        {/* Opportunity Details Popup */}
        <Dialog
          open={!!selectedOpportunity}
          onClose={handleCloseOpportunityPopup}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              {selectedOpportunity?.["Opportunity"] || "Opportunity Details"}
            </Typography>
            <IconButton onClick={handleCloseOpportunityPopup} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {selectedOpportunity && (
              <Box sx={{ p: 2 }}>
                <OpportunityExpandedDetails
                  row={selectedOpportunity}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                  setEditOpportunity={(opp) => {
                    handleCloseOpportunityPopup();
                    setOpen(false);
                    if (setEditOpportunity) setEditOpportunity(opp);
                  }}
                  onManualOpportunityUpdated={onManualOpportunityUpdated}
                  initialActionsTab={popupInitialActionsTab}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Button onClick={handleCloseOpportunityPopup} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

StatusOverrideManager.displayName = "StatusOverrideManager";

export default StatusOverrideManager;
