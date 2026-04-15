/**
 * ManagementDialog — The main "Changes" dialog containing tabs, search toolbar,
 * tab content, footer actions, and the "more actions" menu.
 */

import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import UndoIcon from "@mui/icons-material/Undo";
import EditNoteIcon from "@mui/icons-material/EditNote";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import LayersIcon from "@mui/icons-material/Layers";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  StatusOverrideTab,
  ManualOpportunitiesTab,
  ManualAccountsTab,
  ActionsCommentsTab,
  StaffingNeedsTab,
  EmployeeMetadataTab,
  ScenariosTab,
} from "./components";
import ImportResultsPanel from "./ImportResultsPanel";
import { ManagementDialogProvider } from "./ManagementDialogContext";
import DeleteConfirmDialog from "../CreateOpportunityModal/DeleteConfirmDialog";

interface ManagementDialogProps {
  open: boolean;
  onClose: () => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  // Counts
  totalCount: number;
  overrideCount: number;
  manualCount: number;
  accountCount: number;
  actionsCount: number;
  staffingNeedsCount: number;
  employeesCount: number;
  scenariosCount: number;
  // Search
  searchText: string;
  setSearchText: (text: string) => void;
  // Selection
  selectedItems: Set<any>;
  setSelectedItems: (items: Set<any>) => void;
  toggleSelect: (id: any) => void;
  toggleSelectAll: (ids: any[]) => void;
  handleDeleteSelected: () => void;
  // Grouping
  groupBy: string;
  setGroupBy: (value: string) => void;
  isGroupCollapsed: (groupKey: string) => boolean;
  toggleGroupCollapse: (groupKey: string) => void;
  allCollapsed: boolean;
  allCollapsedMap: any;
  setAllCollapsedMap: (map: any) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: (groups: Set<string>) => void;
  groupSettingsOpen: boolean;
  setGroupSettingsOpen: (open: boolean) => void;
  // Tab data
  manualOpportunities: any[];
  manualAccounts: any[];
  opportunityMap: any;
  opportunityData: any[];
  empNameMap: Map<string, string>;
  // Handlers
  handleOpenOpportunityPopup: (opp: any, initialActionsTab?: any) => void;
  handleClearAll: () => void;
  confirmClearAll: boolean;
  setConfirmClearAll: (v: boolean) => void;
  // Manual opportunity handlers
  deleteConfirm: any;
  setDeleteConfirm: (v: any) => void;
  onDeleteManualOpportunity?: (id: string) => void;
  onDeleteManualAccount?: (id: string) => void;
  setEditOpportunity?: (opp: any) => void;
  setOpen: (open: boolean) => void;
  // Import/export
  importResult: any;
  copied: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleCopyReport: () => void;
  handleDownloadReport: () => void;
  handleExportJSON: () => void;
  handleImportFile: (e: any) => void;
  isImporting: boolean;
}

const TAB_SEARCH_PLACEHOLDERS = [
  "Search overrides...",
  "Search opportunities...",
  "Search accounts...",
  "Search actions & comments...",
  "Search staffing needs...",
  "Search employees...",
  "Search scenarios...",
];

const ManagementDialog = memo(
  ({
    open,
    onClose,
    activeTab,
    setActiveTab,
    totalCount,
    overrideCount,
    manualCount,
    accountCount,
    actionsCount,
    staffingNeedsCount,
    employeesCount,
    scenariosCount,
    searchText,
    setSearchText,
    selectedItems,
    setSelectedItems,
    toggleSelect,
    toggleSelectAll,
    handleDeleteSelected,
    groupBy,
    setGroupBy: _setGroupBy,
    isGroupCollapsed,
    toggleGroupCollapse,
    allCollapsed,
    allCollapsedMap,
    setAllCollapsedMap,
    collapsedGroups,
    setCollapsedGroups,
    groupSettingsOpen: _groupSettingsOpen,
    setGroupSettingsOpen,
    manualOpportunities,
    manualAccounts,
    opportunityMap,
    opportunityData,
    empNameMap,
    handleOpenOpportunityPopup,
    handleClearAll,
    confirmClearAll,
    setConfirmClearAll,
    deleteConfirm,
    setDeleteConfirm,
    onDeleteManualOpportunity,
    onDeleteManualAccount,
    setEditOpportunity,
    setOpen,
    importResult,
    copied,
    fileInputRef,
    handleCopyReport,
    handleDownloadReport,
    handleExportJSON,
    handleImportFile,
    isImporting,
  }: ManagementDialogProps) => {
    const theme = useTheme();
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);

    // Build a human-readable message for the clear-all confirmation dialog
    const clearAllDialogMessage = useMemo(() => {
      if (activeTab === 0)
        return `This will remove ${overrideCount} status override${overrideCount !== 1 ? "s" : ""}. This cannot be undone.`;
      if (activeTab === 1)
        return `This will remove ${manualCount} manual opportunit${manualCount !== 1 ? "ies" : "y"}. This cannot be undone.`;
      if (activeTab === 2)
        return `This will remove ${accountCount} manual account${accountCount !== 1 ? "s" : ""}. This cannot be undone.`;
      if (activeTab === 3)
        return `This will remove ${actionsCount} action${actionsCount !== 1 ? "s" : ""}. This cannot be undone.`;
      return "This cannot be undone.";
    }, [activeTab, overrideCount, manualCount, accountCount, actionsCount]);

    const contextValue = useMemo(
      () => ({
        searchText,
        selectedItems,
        toggleSelect,
        toggleSelectAll,
        handleDeleteSelected,
        groupBy,
        isGroupCollapsed,
        toggleGroupCollapse,
        handleOpenOpportunityPopup,
        opportunityMap,
      }),
      [
        searchText,
        selectedItems,
        toggleSelect,
        toggleSelectAll,
        handleDeleteSelected,
        groupBy,
        isGroupCollapsed,
        toggleGroupCollapse,
        handleOpenOpportunityPopup,
        opportunityMap,
      ]
    );

    const tabLabels = [
      {
        icon: <SwapHorizIcon sx={{ fontSize: 18 }} />,
        label: "Status Changes",
        count: overrideCount,
        color: "warning" as const,
      },
      {
        icon: <NoteAddIcon sx={{ fontSize: 18 }} />,
        label: "New Opportunities",
        count: manualCount,
        color: "info" as const,
      },
      {
        icon: <AddBusinessIcon sx={{ fontSize: 18 }} />,
        label: "New Accounts",
        count: accountCount,
        color: "success" as const,
      },
      {
        icon: <AssignmentIcon sx={{ fontSize: 18 }} />,
        label: "Actions / Comments",
        count: actionsCount,
        color: "secondary" as const,
      },
      {
        icon: <GroupIcon sx={{ fontSize: 18 }} />,
        label: "Staffing Needs",
        count: staffingNeedsCount,
        color: "info" as const,
      },
      { icon: <PersonIcon sx={{ fontSize: 18 }} />, label: "Employees", count: employeesCount, color: "info" as const },
      {
        icon: <LayersIcon sx={{ fontSize: 18 }} />,
        label: "Scenarios",
        count: scenariosCount,
        color: "secondary" as const,
      },
    ];

    return (
      <>
        <DeleteConfirmDialog
          open={confirmClearAll}
          onCancel={() => setConfirmClearAll(false)}
          onConfirm={() => {
            handleClearAll();
            setConfirmClearAll(false);
          }}
          title="Reset all changes?"
          message={clearAllDialogMessage}
          confirmLabel="Reset All"
        />
        <Dialog
          open={open}
          onClose={onClose}
          TransitionComponent={DialogTransition}
          maxWidth="xl"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, maxHeight: "85vh" } }}
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
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
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
                <IconButton size="small" onClick={(e) => setMenuAnchorEl(e.currentTarget)} aria-label="More actions">
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={onClose} size="small" aria-label="Close management dialog">
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
            {tabLabels.map((tab, i) => (
              <Tab
                key={i}
                value={i}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <Chip label={tab.count} size="small" color={tab.color} sx={{ height: 20, fontSize: "0.7rem" }} />
                    )}
                  </Box>
                }
              />
            ))}
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
              placeholder={TAB_SEARCH_PLACEHOLDERS[activeTab] || "Search..."}
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
            <ManagementDialogProvider value={contextValue}>
              {activeTab === 0 && <StatusOverrideTab />}
              {activeTab === 1 && (
                <ManualOpportunitiesTab
                  manualOpportunities={manualOpportunities}
                  deleteConfirm={deleteConfirm}
                  setDeleteConfirm={setDeleteConfirm}
                  onDeleteManualOpportunity={onDeleteManualOpportunity}
                  setEditOpportunity={setEditOpportunity}
                  setOpen={setOpen}
                />
              )}
              {activeTab === 2 && (
                <ManualAccountsTab
                  manualAccounts={manualAccounts}
                  manualOpportunities={manualOpportunities}
                  deleteConfirm={deleteConfirm}
                  setDeleteConfirm={setDeleteConfirm}
                  onDeleteManualAccount={onDeleteManualAccount}
                />
              )}
              {activeTab === 3 && <ActionsCommentsTab />}
              {activeTab === 4 && <StaffingNeedsTab />}
              {activeTab === 5 && <EmployeeMetadataTab empNameMap={empNameMap} />}
              {activeTab === 6 && (
                <ScenariosTab
                  empNameMap={empNameMap}
                  opportunityData={opportunityData}
                  collapsedGroups={collapsedGroups}
                />
              )}
            </ManagementDialogProvider>

            {/* Hidden file input for JSON import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              style={{ display: "none" }}
            />

            {/* Import Results */}
            <ImportResultsPanel importResult={importResult} />
          </DialogContent>

          <DialogActions
            sx={{
              px: 4,
              py: 2.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              justifyContent: "space-between",
            }}
          >
            <Box />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {((activeTab === 0 && overrideCount > 0) ||
                (activeTab === 1 && manualCount > 0) ||
                (activeTab === 2 && accountCount > 0) ||
                (activeTab === 3 && actionsCount > 0)) && (
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
              <Button onClick={onClose} variant="contained">
                Close
              </Button>
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
        </Menu>
      </>
    );
  }
);

ManagementDialog.displayName = "ManagementDialog";

export default ManagementDialog;
