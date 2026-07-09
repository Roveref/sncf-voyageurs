/**
 * OpportunityToolbar Component
 * Displays filters, export button, and meeting minutes
 * Performance optimized with React.memo
 */

import React, { memo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  FormControl,
  Select,
  MenuItem,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DialogTransition from "../../common/DialogTransition";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import AssignmentIcon from "@mui/icons-material/Assignment";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PercentIcon from "@mui/icons-material/Percent";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import ErrorIcon from "@mui/icons-material/Error";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ChatIcon from "@mui/icons-material/Chat";
import GroupIcon from "@mui/icons-material/Group";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import Divider from "@mui/material/Divider";
import { exportOpportunities } from "../../../utils/exportUtils";
import { exportActionsComments, importActionsComments } from "../../../utils/exportActionsComments";
import { importManualOpportunities } from "../../../utils/importOpportunitiesUtils";
import { easing, keyframes } from "../../../styles/animations";
import ImportActionsDialog from "./ImportActionsDialog";
import ImportOpportunitiesDialog from "./ImportOpportunitiesDialog";
import StatusFilterDialog from "./StatusFilterDialog";
import { STATUS_OPTIONS } from "../../../utils/statusOptions";

/**
 * Memoized toolbar component for opportunity list
 * Contains all filter controls and action buttons
 */
const OpportunityToolbar = memo(
  ({
    title,
    filteredDataLength,
    showNetRevenue,
    isFiltered,
    winPercentageFilter,
    winPercentageMode,
    statusFilter,
    showManualOnly,
    showWithActionsOnly,
    showWithStaffingOnly,
    hasActiveFilters,
    onWinPercentageChange,
    onWinPercentageModeChange,
    onStatusFilterChange,
    onToggleManualOnly,
    onToggleWithActionsOnly,
    onToggleWithStaffingOnly,
    searchText = "",
    onSearchTextChange,
    onResetAllFilters,
    onDeleteSelected,
    onOpportunityCreated,
    opportunitiesData,
    filteredData,
    selectedOpportunities = [],
    hideWinFilter = false,
    hideStatusFilter = false,
    excludeStatuses = [],
    onCollapseAll,
  }: any) => {
    const theme = useTheme();
    const [exportBounce, setExportBounce] = useState(false);
    const [exportActionsBounce, setExportActionsBounce] = useState(false);
    const [importActionsBounce, setImportActionsBounce] = useState(false);
    const [importOpportunitiesBounce, setImportOpportunitiesBounce] = useState(false);
    const [deleteBounce, setDeleteBounce] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [importOpportunitiesModalOpen, setImportOpportunitiesModalOpen] = useState(false);
    const [importOpportunitiesResult, setImportOpportunitiesResult] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [statusFilterModalOpen, setStatusFilterModalOpen] = useState(false);

    // Count how many manual opportunities are selected
    const manualSelectedCount = selectedOpportunities.filter((opp: any) => opp.isManual === true).length;

    // Available status options — source de vérité : STATUS_OPTIONS (labels GAIF en français,
    // mis à jour depuis les OptionSets CRM à l'hydratation) pour rester cohérent avec la liste.
    const STATUS_COLOR: Record<number, string> = {
      14: "success",
      15: "error",
    };
    const allStatusOptions = STATUS_OPTIONS.map((opt) => ({
      value: opt.status,
      label: opt.label,
      color: STATUS_COLOR[opt.status] || "primary",
    }));
    const statusOptions =
      excludeStatuses.length > 0
        ? allStatusOptions.filter((opt) => !excludeStatuses.includes(opt.value))
        : allStatusOptions;

    const handleExportClick = () => {
      setExportBounce(true);
      setTimeout(() => setExportBounce(false), 500);
      exportOpportunities(filteredData, selectedOpportunities, isFiltered || hasActiveFilters, showNetRevenue);
    };

    const handleExportActionsClick = () => {
      setExportActionsBounce(true);
      setTimeout(() => setExportActionsBounce(false), 500);
      const exportAll = selectedOpportunities.length === 0;
      exportActionsComments(selectedOpportunities, exportAll);
    };

    const handleImportActionsClick = () => {
      setImportActionsBounce(true);
      setTimeout(() => setImportActionsBounce(false), 500);
      document.getElementById("import-actions-file-input")?.click();
    };

    const handleFileChange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const result = await importActionsComments(file);
        setImportResult({ success: true, ...result });
        setImportModalOpen(true);
      } catch (error) {
        setImportResult({ success: false, error: (error as Error).message });
        setImportModalOpen(true);
      }

      // Reset file input
      event.target.value = "";
    };

    const handleCloseImportModal = () => {
      setImportModalOpen(false);
      setImportResult(null);
    };

    const handleDeleteClick = () => {
      if (manualSelectedCount === 0) return;
      setDeleteBounce(true);
      setTimeout(() => setDeleteBounce(false), 500);
      setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = () => {
      if (onDeleteSelected) {
        // Filter only manual opportunities from selected
        const manualOpportunities = selectedOpportunities.filter((opp: any) => opp.isManual === true);
        onDeleteSelected(manualOpportunities);
      }
      setDeleteConfirmOpen(false);
    };

    const handleDeleteCancel = () => {
      setDeleteConfirmOpen(false);
    };

    const handleOpenStatusFilterModal = () => {
      setStatusFilterModalOpen(true);
    };

    const handleCloseStatusFilterModal = () => {
      setStatusFilterModalOpen(false);
    };

    const handleApplyStatusFilter = (selectedStatuses: string[]) => {
      onStatusFilterChange({ target: { value: selectedStatuses } });
    };

    const handleImportOpportunitiesClick = () => {
      setImportOpportunitiesBounce(true);
      setTimeout(() => setImportOpportunitiesBounce(false), 500);
      document.getElementById("import-opportunities-file-input")?.click();
    };

    const handleImportOpportunitiesFileChange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      // Check file type
      if (!file.name.endsWith(".json")) {
        setImportOpportunitiesResult({ success: false, error: "Please upload a JSON file" });
        setImportOpportunitiesModalOpen(true);
        event.target.value = "";
        return;
      }

      await importManualOpportunities(
        file,
        opportunitiesData,
        (detailedResults) => {
          const totalCount =
            detailedResults.opportunities.created.length + detailedResults.opportunities.updated.length;
          setImportOpportunitiesResult({ success: true, details: detailedResults });
          setImportOpportunitiesModalOpen(true);
          // Trigger refresh of manual opportunities
          if (onOpportunityCreated) {
            onOpportunityCreated({ imported: totalCount });
          }
        },
        (error) => {
          setImportOpportunitiesResult({ success: false, error });
          setImportOpportunitiesModalOpen(true);
        }
      );

      // Reset file input
      event.target.value = "";
    };

    const handleCloseImportOpportunitiesModal = () => {
      setImportOpportunitiesModalOpen(false);
      setImportOpportunitiesResult(null);
    };

    return (
      <Box
        sx={{
          pb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 2,
        }}
      >
        {/* Title and Count */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography variant="h6" component="div" fontWeight={600}>
            {title || "Opportunities"}
          </Typography>
          {onCollapseAll && (
            <IconButton
              size="small"
              onClick={onCollapseAll}
              sx={{ ml: 0.5, color: "text.secondary" }}
              title="Collapse all"
            >
              <UnfoldLessIcon sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          )}
          {(showManualOnly || statusFilter.length > 0 || showWithActionsOnly || showWithStaffingOnly) && (
            <Typography variant="body2" color="text.secondary" component="div" sx={{ ml: 1 }}>
              {showManualOnly && (
                <Box component="span" sx={{ color: "error.main", fontWeight: 600 }}>
                  Manual Only
                </Box>
              )}
              {statusFilter.length > 0 && (
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {" "}
                  (Status: {statusFilter.join(", ")})
                </Box>
              )}
              {showWithActionsOnly && (
                <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>
                  {" "}
                  (With Actions/Comments)
                </Box>
              )}
              {showWithStaffingOnly && (
                <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>
                  {" "}
                  (With Staffing Needs)
                </Box>
              )}
            </Typography>
          )}
        </Box>

        {/* Control area with filters and actions */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {/* Win Percentage Filter */}
          {!hideWinFilter && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mr: 2,
                gap: 1,
              }}
            >
              {/* Label with icon */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "text.secondary",
                }}
              >
                <PercentIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: "0.8rem" }}>
                  Dispo
                </Typography>
              </Box>

              {/* Comparison dropdown */}
              <FormControl size="small" variant="standard" sx={{ width: 42, minWidth: 0 }}>
                <Select
                  value={winPercentageMode}
                  onChange={onWinPercentageModeChange}
                  displayEmpty
                  variant="standard"
                  disableUnderline
                  sx={{
                    fontSize: "0.8rem",
                    height: 32,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    "& .MuiSelect-select": {
                      padding: "2px 0 2px 6px !important",
                      paddingRight: "16px !important",
                      minHeight: "auto !important",
                      minWidth: "0 !important",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    "& .MuiSelect-icon": { right: 1 },
                  }}
                >
                  <MenuItem value="greater" sx={{ fontSize: "0.8rem", minHeight: "auto", py: 0.5 }}>
                    ≥
                  </MenuItem>
                  <MenuItem value="less" sx={{ fontSize: "0.8rem", minHeight: "auto", py: 0.5 }}>
                    ≤
                  </MenuItem>
                  <MenuItem value="equal" sx={{ fontSize: "0.8rem", minHeight: "auto", py: 0.5 }}>
                    =
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Input field */}
              <TextField
                size="small"
                type="number"
                value={winPercentageFilter || ""}
                onChange={onWinPercentageChange}
                placeholder="0"
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  inputProps: {
                    min: 0,
                    max: 150,
                    step: 1,
                  },
                  sx: {
                    fontSize: "0.8rem",
                  },
                }}
                sx={{
                  width: 62,
                  "& .MuiInputBase-root": { height: 32, bgcolor: "action.hover", borderRadius: 1 },
                  "& .MuiInputBase-input": { padding: "6px 8px", textAlign: "center", fontSize: "0.8rem" },
                  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                }}
              />
            </Box>
          )}

          {/* === FILTERS GROUP === */}
          {/* Status Filter Button */}
          {!hideStatusFilter && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterListIcon />}
              onClick={handleOpenStatusFilterModal}
              sx={{
                fontSize: "0.8rem",
                height: 32,
                px: 1.5,
                border: "none",
                color: statusFilter.length > 0 ? theme.palette.primary.main : "text.secondary",
                bgcolor: statusFilter.length > 0 ? alpha(theme.palette.primary.main, 0.08) : "action.hover",
                "&:hover": {
                  border: "none",
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                },
              }}
            >
              {statusFilter.length === 0
                ? "Tous les statuts"
                : `${statusFilter.length} statut${statusFilter.length > 1 ? "s" : ""}`}
            </Button>
          )}

          {/* Reset All Filters button */}
          <IconButton
            size="small"
            color="default"
            aria-label="reset all filters"
            onClick={onResetAllFilters}
            disabled={!isFiltered && !hasActiveFilters}
            title="Reset All Filters"
            sx={{
              ml: 1,
              boxShadow:
                !isFiltered && !hasActiveFilters ? "none" : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              opacity: !isFiltered && !hasActiveFilters ? 0.3 : 1,
              transition: `all 0.2s ${easing.bounce}`,
              "&:hover": {
                backgroundColor: !isFiltered && !hasActiveFilters ? "transparent" : alpha(theme.palette.grey[500], 0.1),
                boxShadow:
                  !isFiltered && !hasActiveFilters ? "none" : `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                transform: !isFiltered && !hasActiveFilters ? "none" : "scale(1.05)",
              },
              "&:active": {
                transform: !isFiltered && !hasActiveFilters ? "none" : "scale(0.98)",
              },
              "&.Mui-disabled": {
                opacity: 0.3,
                cursor: "not-allowed",
              },
            }}
          >
            <HighlightOffIcon fontSize="small" />
          </IconButton>

          {/* Divider */}
          <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 0.5 }} />

          {/* === GROUP 1: Export Data + Export Actions === */}
          {/* Export Opportunities button */}
          {opportunitiesData.length > 0 && (
            <IconButton
              size="small"
              color="primary"
              aria-label="export opportunities"
              onClick={handleExportClick}
              title="Export Opportunities List"
              sx={{
                boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
                transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}, opacity 0.2s ${easing.bounce}`,
                animation: exportBounce ? `bounce 0.5s ${easing.bounce}` : "none",
                ...keyframes.bounce,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                  transform: "scale(1.05)",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          )}

          {/* Export Actions & Comments button */}
          {opportunitiesData.length > 0 && (
            <IconButton
              size="small"
              color="primary"
              aria-label="export actions and comments"
              onClick={handleExportActionsClick}
              title="Export Actions & Comments"
              sx={{
                ml: 0.5,
                boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
                transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}`,
                animation: exportActionsBounce ? `bounce 0.5s ${easing.bounce}` : "none",
                ...keyframes.bounce,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                  transform: "scale(1.05)",
                },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              <AssignmentIcon fontSize="small" />
            </IconButton>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 0.5 }} />

          {/* === GROUP 2: Staffing + Actions filters === */}
          <IconButton
            size="small"
            color={showWithStaffingOnly ? "warning" : "info"}
            aria-label="filter opportunities with staffing needs"
            onClick={onToggleWithStaffingOnly}
            title={showWithStaffingOnly ? "Show All" : "With Staffing Needs Only"}
            sx={{
              boxShadow: showWithStaffingOnly
                ? `0 2px 4px ${alpha(theme.palette.warning.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}`,
              bgcolor: showWithStaffingOnly ? alpha(theme.palette.warning.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showWithStaffingOnly
                  ? alpha(theme.palette.warning.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                transform: "scale(1.05)",
              },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <GroupIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color={showWithActionsOnly ? "warning" : "info"}
            aria-label="filter opportunities with actions"
            onClick={onToggleWithActionsOnly}
            title={showWithActionsOnly ? "Show All" : "With Actions Only"}
            sx={{
              ml: 0.5,
              boxShadow: showWithActionsOnly
                ? `0 2px 4px ${alpha(theme.palette.warning.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}`,
              bgcolor: showWithActionsOnly ? alpha(theme.palette.warning.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showWithActionsOnly
                  ? alpha(theme.palette.warning.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                transform: "scale(1.05)",
              },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <ChatIcon fontSize="small" />
          </IconButton>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 0.5 }} />

          {/* === GROUP 3: Manual filter + Delete === */}
          <IconButton
            size="small"
            color={showManualOnly ? "error" : "info"}
            aria-label="filter manual opportunities"
            onClick={onToggleManualOnly}
            title={showManualOnly ? "Show All" : "Manual Only"}
            sx={{
              boxShadow: showManualOnly
                ? `0 2px 4px ${alpha(theme.palette.error.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}`,
              bgcolor: showManualOnly ? alpha(theme.palette.error.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showManualOnly
                  ? alpha(theme.palette.error.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                transform: "scale(1.05)",
              },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            aria-label="delete selected manual opportunities"
            onClick={handleDeleteClick}
            disabled={manualSelectedCount === 0}
            title={
              manualSelectedCount === 0
                ? "Select manual opportunities to delete"
                : `Delete ${manualSelectedCount} manual opportunit${manualSelectedCount > 1 ? "ies" : "y"}`
            }
            sx={{
              ml: 0.5,
              boxShadow: manualSelectedCount === 0 ? "none" : `0 2px 4px ${alpha(theme.palette.error.main, 0.2)}`,
              opacity: manualSelectedCount === 0 ? 0.3 : 1,
              transition: `transform 0.2s ${easing.bounce}, background-color 0.2s ${easing.bounce}, box-shadow 0.2s ${easing.bounce}, opacity 0.2s ${easing.bounce}`,
              animation: deleteBounce ? `bounce 0.5s ${easing.bounce}` : "none",
              ...keyframes.bounce,
              "&:hover": {
                backgroundColor: manualSelectedCount === 0 ? "transparent" : alpha(theme.palette.error.main, 0.1),
                transform: manualSelectedCount === 0 ? "none" : "scale(1.05)",
              },
              "&:active": { transform: manualSelectedCount === 0 ? "none" : "scale(0.98)" },
              "&.Mui-disabled": { opacity: 0.3, cursor: "not-allowed" },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>

          {/* Hidden file inputs */}
          <input
            id="import-opportunities-file-input"
            type="file"
            accept=".json"
            onChange={handleImportOpportunitiesFileChange}
            style={{ display: "none" }}
          />
          <input
            type="file"
            id="import-actions-file-input"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </Box>

        {/* Import Actions & Comments Results Modal */}
        <ImportActionsDialog open={importModalOpen} onClose={handleCloseImportModal} importResult={importResult} />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleDeleteCancel}
          TransitionComponent={DialogTransition}
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              pb: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <ErrorIcon sx={{ fontSize: 32, color: "error.main" }} />
            <Typography variant="h6" fontWeight={600}>
              Delete Manual Opportunities
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="body1">
              Are you sure you want to delete {manualSelectedCount} manual opportunit
              {manualSelectedCount > 1 ? "ies" : "y"}?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleDeleteCancel} variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Import Opportunities Results Dialog */}
        <ImportOpportunitiesDialog
          open={importOpportunitiesModalOpen}
          onClose={handleCloseImportOpportunitiesModal}
          importResult={importOpportunitiesResult}
        />

        {/* Status Filter Modal */}
        <StatusFilterDialog
          open={statusFilterModalOpen}
          onClose={handleCloseStatusFilterModal}
          statusFilter={statusFilter}
          statusOptions={statusOptions}
          onApply={handleApplyStatusFilter}
        />
      </Box>
    );
  }
);

OpportunityToolbar.displayName = "OpportunityToolbar";

export default OpportunityToolbar;
