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
  Checkbox,
  FormControlLabel,
  Chip,
} from "@mui/material";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import AssignmentIcon from "@mui/icons-material/Assignment";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PercentIcon from "@mui/icons-material/Percent";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ChatIcon from "@mui/icons-material/Chat";
import GroupIcon from "@mui/icons-material/Group";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";
import Divider from "@mui/material/Divider";
import { exportOpportunities } from "../../../utils/exportUtils";
import { exportActionsComments, importActionsComments } from "../../../utils/exportActionsComments";
import { importManualOpportunities } from "../../../utils/importOpportunitiesUtils";
import { easing, keyframes } from "../../../styles/animations";
import { STATUS_TEXT } from "../../../utils/constants";

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
  }) => {
    const theme = useTheme();
    const [exportBounce, setExportBounce] = useState(false);
    const [exportActionsBounce, setExportActionsBounce] = useState(false);
    const [importActionsBounce, setImportActionsBounce] = useState(false);
    const [importOpportunitiesBounce, setImportOpportunitiesBounce] = useState(false);
    const [deleteBounce, setDeleteBounce] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importOpportunitiesModalOpen, setImportOpportunitiesModalOpen] = useState(false);
    const [importOpportunitiesResult, setImportOpportunitiesResult] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [statusFilterModalOpen, setStatusFilterModalOpen] = useState(false);
    const [tempStatusFilter, setTempStatusFilter] = useState(statusFilter);

    // Count how many manual opportunities are selected
    const manualSelectedCount = selectedOpportunities.filter((opp) => opp.isManual === true).length;

    // Available status options (filtered by excludeStatuses)
    const allStatusOptions = [
      { value: 1, label: "Lead Identified", color: "primary" },
      { value: 4, label: "Go Approved", color: "primary" },
      { value: 6, label: "Proposal Submitted", color: "primary" },
      { value: 11, label: "Client Won", color: "primary" },
      { value: 13, label: "AEL", color: "primary" },
      { value: 14, label: "Booked", color: "success" },
      { value: 15, label: "Lost", color: "error" },
    ];
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

    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const result = await importActionsComments(file);
        setImportResult({ success: true, ...result });
        setImportModalOpen(true);
      } catch (error) {
        setImportResult({ success: false, error: error.message });
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
        const manualOpportunities = selectedOpportunities.filter((opp) => opp.isManual === true);
        onDeleteSelected(manualOpportunities);
      }
      setDeleteConfirmOpen(false);
    };

    const handleDeleteCancel = () => {
      setDeleteConfirmOpen(false);
    };

    const handleOpenStatusFilterModal = () => {
      setTempStatusFilter(statusFilter);
      setStatusFilterModalOpen(true);
    };

    const handleCloseStatusFilterModal = () => {
      setStatusFilterModalOpen(false);
    };

    const handleToggleStatus = (statusValue) => {
      const statusStr = String(statusValue);
      setTempStatusFilter((prev) => {
        if (prev.includes(statusStr)) {
          return prev.filter((s) => s !== statusStr);
        } else {
          return [...prev, statusStr];
        }
      });
    };

    const handleSelectAllStatuses = () => {
      setTempStatusFilter(statusOptions.map((opt) => String(opt.value)));
    };

    const handleClearAllStatuses = () => {
      setTempStatusFilter([]);
    };

    const handleApplyStatusFilter = () => {
      onStatusFilterChange({ target: { value: tempStatusFilter } });
      setStatusFilterModalOpen(false);
    };

    const handleImportOpportunitiesClick = () => {
      setImportOpportunitiesBounce(true);
      setTimeout(() => setImportOpportunitiesBounce(false), 500);
      document.getElementById("import-opportunities-file-input")?.click();
    };

    const handleImportOpportunitiesFileChange = async (event) => {
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
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "background.paper",
        }}
      >
        {/* Title and Count */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography variant="h6" component="div" fontWeight={600}>
            {title || "Opportunities"} {showNetRevenue ? "(Net Revenue)" : "(Gross Revenue)"}
          </Typography>
          {filteredDataLength > 0 && (
            <Typography variant="body2" color="text.secondary" component="div" sx={{ ml: 1 }}>
              {filteredDataLength} opportunities
              {showManualOnly && (
                <Box component="span" sx={{ color: "error.main", fontWeight: 600 }}>
                  {" "}
                  (Manual Only)
                </Box>
              )}
              {winPercentageFilter > 0 && (
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {" "}
                  (Win % {winPercentageMode === "greater" ? "≥" : winPercentageMode === "less" ? "≤" : "="}{" "}
                  {winPercentageFilter}%)
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
          {/* Global Search */}
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: "1rem", color: "text.secondary", mr: 0.5 }} />,
              endAdornment: searchText ? (
                <IconButton size="small" onClick={() => onSearchTextChange("")} sx={{ p: 0.25 }}>
                  <HighlightOffIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
              ) : null,
              sx: { fontSize: "0.8rem" },
            }}
            sx={{
              width: 180,
              mr: 2,
              "& .MuiInputBase-root": { height: 32 },
              "& .MuiInputBase-input": { padding: "6px 4px", fontSize: "0.8rem" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: searchText ? theme.palette.primary.main : alpha(theme.palette.divider, 0.8),
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(theme.palette.primary.main, 0.5),
              },
            }}
          />

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
                  Win
                </Typography>
              </Box>

              {/* Comparison dropdown */}
              <FormControl size="small" sx={{ minWidth: 30 }}>
                <Select
                  value={winPercentageMode}
                  onChange={onWinPercentageModeChange}
                  displayEmpty
                  variant="outlined"
                  sx={{
                    fontSize: "0.8rem",
                    height: 32,
                    "& .MuiSelect-select": {
                      padding: "6px 6px",
                      minHeight: "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha(theme.palette.divider, 0.8),
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha(theme.palette.primary.main, 0.5),
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: theme.palette.primary.main,
                    },
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
                variant="outlined"
                InputProps={{
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
                  width: 150,
                  "& .MuiInputBase-root": {
                    height: 32,
                  },
                  "& .MuiInputBase-input": {
                    padding: "6px 8px",
                    textAlign: "center",
                    fontSize: "0.8rem",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha(theme.palette.divider, 0.8),
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha(theme.palette.primary.main, 0.5),
                  },
                  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: theme.palette.primary.main,
                  },
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
                borderColor: statusFilter.length > 0 ? theme.palette.primary.main : alpha(theme.palette.divider, 0.8),
                color: statusFilter.length > 0 ? theme.palette.primary.main : "text.secondary",
                backgroundColor: statusFilter.length > 0 ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                "&:hover": {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                },
              }}
            >
              {statusFilter.length === 0
                ? "All Statuses"
                : `${statusFilter.length} Status${statusFilter.length > 1 ? "es" : ""}`}
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

          {/* === OPPORTUNITIES GROUP === */}
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
                transition: `all 0.2s ${easing.bounce}`,
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

          {/* Import Opportunities button */}
          <IconButton
            size="small"
            color="success"
            aria-label="import opportunities"
            onClick={handleImportOpportunitiesClick}
            title="Import Manual Opportunities from JSON"
            sx={{
              ml: 0.5,
              boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `all 0.2s ${easing.bounce}`,
              animation: importOpportunitiesBounce ? `bounce 0.5s ${easing.bounce}` : "none",
              ...keyframes.bounce,
              "&:hover": {
                backgroundColor: alpha(theme.palette.success.main, 0.1),
                boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                transform: "scale(1.05)",
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            <FileUploadIcon fontSize="small" />
          </IconButton>

          {/* Hidden file input for import */}
          <input
            id="import-opportunities-file-input"
            type="file"
            accept=".json"
            onChange={handleImportOpportunitiesFileChange}
            style={{ display: "none" }}
          />

          {/* Manual Opportunities Filter button */}
          <IconButton
            size="small"
            color={showManualOnly ? "error" : "info"}
            aria-label="filter manual opportunities"
            onClick={onToggleManualOnly}
            title={showManualOnly ? "Show All Opportunities" : "Show Manual Opportunities Only"}
            sx={{
              ml: 0.5,
              boxShadow: showManualOnly
                ? `0 2px 4px ${alpha(theme.palette.error.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `all 0.2s ${easing.bounce}`,
              bgcolor: showManualOnly ? alpha(theme.palette.error.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showManualOnly
                  ? alpha(theme.palette.error.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                transform: "scale(1.05)",
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>

          {/* Filter opportunities with actions/comments */}
          <IconButton
            size="small"
            color={showWithActionsOnly ? "warning" : "info"}
            aria-label="filter opportunities with actions"
            onClick={onToggleWithActionsOnly}
            title={showWithActionsOnly ? "Show All Opportunities" : "Show Opportunities with Actions/Comments Only"}
            sx={{
              ml: 0.5,
              boxShadow: showWithActionsOnly
                ? `0 2px 4px ${alpha(theme.palette.warning.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `all 0.2s ${easing.bounce}`,
              bgcolor: showWithActionsOnly ? alpha(theme.palette.warning.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showWithActionsOnly
                  ? alpha(theme.palette.warning.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                transform: "scale(1.05)",
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            <ChatIcon fontSize="small" />
          </IconButton>

          {/* Filter opportunities with staffing needs */}
          <IconButton
            size="small"
            color={showWithStaffingOnly ? "warning" : "info"}
            aria-label="filter opportunities with staffing needs"
            onClick={onToggleWithStaffingOnly}
            title={showWithStaffingOnly ? "Show All Opportunities" : "Show Opportunities with Staffing Needs Only"}
            sx={{
              ml: 0.5,
              boxShadow: showWithStaffingOnly
                ? `0 2px 4px ${alpha(theme.palette.warning.main, 0.2)}`
                : `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: `all 0.2s ${easing.bounce}`,
              bgcolor: showWithStaffingOnly ? alpha(theme.palette.warning.main, 0.1) : "transparent",
              "&:hover": {
                backgroundColor: showWithStaffingOnly
                  ? alpha(theme.palette.warning.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                transform: "scale(1.05)",
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            <GroupIcon fontSize="small" />
          </IconButton>

          {/* Delete Selected Manual Opportunities button */}
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
              transition: `all 0.2s ${easing.bounce}`,
              animation: deleteBounce ? `bounce 0.5s ${easing.bounce}` : "none",
              ...keyframes.bounce,
              "&:hover": {
                backgroundColor: manualSelectedCount === 0 ? "transparent" : alpha(theme.palette.error.main, 0.1),
                boxShadow: manualSelectedCount === 0 ? "none" : `0 2px 6px ${alpha(theme.palette.error.main, 0.3)}`,
                transform: manualSelectedCount === 0 ? "none" : "scale(1.05)",
              },
              "&:active": {
                transform: manualSelectedCount === 0 ? "none" : "scale(0.98)",
              },
              "&.Mui-disabled": {
                opacity: 0.3,
                cursor: "not-allowed",
              },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>

          {/* Divider */}
          <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 0.5 }} />

          {/* === ACTIONS & COMMENTS GROUP === */}
          {/* Export Actions & Comments button */}
          {opportunitiesData.length > 0 && (
            <IconButton
              size="small"
              color="primary"
              aria-label="export actions and comments"
              onClick={handleExportActionsClick}
              title="Export Actions & Comments"
              sx={{
                boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
                transition: `all 0.2s ${easing.bounce}`,
                animation: exportActionsBounce ? `bounce 0.5s ${easing.bounce}` : "none",
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
              <AssignmentIcon fontSize="small" />
            </IconButton>
          )}

          {/* Import Actions & Comments button */}
          {opportunitiesData.length > 0 && (
            <>
              <IconButton
                size="small"
                color="success"
                aria-label="import actions and comments"
                onClick={handleImportActionsClick}
                title="Import Actions & Comments"
                sx={{
                  ml: 0.5,
                  boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: `all 0.2s ${easing.bounce}`,
                  animation: importActionsBounce ? `bounce 0.5s ${easing.bounce}` : "none",
                  ...keyframes.bounce,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                    boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.12)}`,
                    transform: "scale(1.05)",
                  },
                  "&:active": {
                    transform: "scale(0.98)",
                  },
                }}
              >
                <UploadFileIcon fontSize="small" />
              </IconButton>
              <input
                type="file"
                id="import-actions-file-input"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </>
          )}
        </Box>

        {/* Import Actions & Comments Results Modal - Comparison View */}
        <Dialog
          open={importModalOpen}
          onClose={handleCloseImportModal}
          maxWidth="md"
          fullWidth
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
              justifyContent: "space-between",
              pb: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {importResult?.success ? (
                <>
                  <CheckCircleIcon sx={{ fontSize: 28, color: "success.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    Import Results - Actions & Comments
                  </Typography>
                </>
              ) : (
                <>
                  <ErrorIcon sx={{ fontSize: 28, color: "error.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    Import Failed
                  </Typography>
                </>
              )}
            </Box>
            {importResult?.success && importResult?.actions && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                  label={`${(importResult.actions?.created?.length || 0) + (importResult.comments?.created?.length || 0)} Created`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  icon={<UpdateIcon sx={{ fontSize: 16 }} />}
                  label={`${(importResult.actions?.updated?.length || 0) + (importResult.comments?.updated?.length || 0)} Updated`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  icon={<BlockIcon sx={{ fontSize: 16 }} />}
                  label={`${(importResult.actions?.skipped?.length || 0) + (importResult.comments?.skipped?.length || 0)} Skipped`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            )}
          </DialogTitle>
          <DialogContent sx={{ pt: 2, pb: 2, maxHeight: "60vh" }}>
            {importResult?.success && importResult?.actions ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Actions Section */}
                {(importResult.actions.created.length > 0 ||
                  importResult.actions.updated.length > 0 ||
                  importResult.actions.skipped.length > 0) && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <AssignmentIcon sx={{ fontSize: 20 }} /> Actions
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {[
                        ...importResult.actions.created,
                        ...importResult.actions.updated,
                        ...importResult.actions.skipped,
                      ].map((item, idx) => {
                        const isCreated = item.decision === "created";
                        const isUpdated = item.decision === "updated";
                        const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                        const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                        return (
                          <Box
                            key={`action-${idx}`}
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                              border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                            }}
                          >
                            {/* Header */}
                            <Box
                              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Chip
                                  label={item.opportunityId}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: "0.7rem", height: 20 }}
                                />
                                <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
                                  {item.opportunityName}
                                </Typography>
                              </Box>
                              <Chip
                                icon={<DecisionIcon sx={{ fontSize: 14 }} />}
                                label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                                size="small"
                                color={decisionColor}
                                sx={{ fontWeight: 600, height: 24 }}
                              />
                            </Box>

                            {/* Comparison */}
                            <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
                              {/* Left: Existing */}
                              <Box
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  bgcolor: item.existing
                                    ? alpha(theme.palette.grey[500], 0.08)
                                    : alpha(theme.palette.grey[300], 0.1),
                                  border: `1px solid ${alpha(theme.palette.grey[400], 0.2)}`,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color="text.secondary"
                                  sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                                >
                                  Existing
                                </Typography>
                                {item.existing ? (
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        bgcolor: item.changes?.includes("description")
                                          ? alpha(theme.palette.warning.main, 0.2)
                                          : "transparent",
                                        px: 0.5,
                                        borderRadius: 0.5,
                                      }}
                                    >
                                      <strong>Description:</strong> {item.existing.description}
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
                                      }}
                                    >
                                      <strong>Status:</strong> {item.existing.status}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        bgcolor: item.changes?.includes("priority")
                                          ? alpha(theme.palette.warning.main, 0.2)
                                          : "transparent",
                                        px: 0.5,
                                        borderRadius: 0.5,
                                      }}
                                    >
                                      <strong>Priority:</strong> {item.existing.priority}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        bgcolor: item.changes?.includes("dueDate")
                                          ? alpha(theme.palette.warning.main, 0.2)
                                          : "transparent",
                                        px: 0.5,
                                        borderRadius: 0.5,
                                      }}
                                    >
                                      <strong>Due:</strong> {item.existing.dueDate}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
                                    No existing data
                                  </Typography>
                                )}
                              </Box>

                              {/* Arrow */}
                              <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
                                <ArrowForwardIcon sx={{ fontSize: 24, color: `${decisionColor}.main` }} />
                              </Box>

                              {/* Right: Imported */}
                              <Box
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                  border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color={`${decisionColor}.main`}
                                  sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                                >
                                  Imported
                                </Typography>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      bgcolor: item.changes?.includes("description")
                                        ? alpha(theme.palette[decisionColor].main, 0.2)
                                        : "transparent",
                                      px: 0.5,
                                      borderRadius: 0.5,
                                      fontWeight: item.changes?.includes("description") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Description:</strong> {item.imported.description}
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
                                      fontWeight: item.changes?.includes("status") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Status:</strong> {item.imported.status}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      bgcolor: item.changes?.includes("priority")
                                        ? alpha(theme.palette[decisionColor].main, 0.2)
                                        : "transparent",
                                      px: 0.5,
                                      borderRadius: 0.5,
                                      fontWeight: item.changes?.includes("priority") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Priority:</strong> {item.imported.priority}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      bgcolor: item.changes?.includes("dueDate")
                                        ? alpha(theme.palette[decisionColor].main, 0.2)
                                        : "transparent",
                                      px: 0.5,
                                      borderRadius: 0.5,
                                      fontWeight: item.changes?.includes("dueDate") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Due:</strong> {item.imported.dueDate}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            {/* Reason */}
                            <Box
                              sx={{
                                mt: 1.5,
                                pt: 1,
                                borderTop: `1px dashed ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                              }}
                            >
                              <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500}>
                                {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* Comments Section */}
                {(importResult.comments.created.length > 0 ||
                  importResult.comments.updated.length > 0 ||
                  importResult.comments.skipped.length > 0) && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <AssignmentIcon sx={{ fontSize: 20 }} /> Comments
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {[
                        ...importResult.comments.created,
                        ...importResult.comments.updated,
                        ...importResult.comments.skipped,
                      ].map((item, idx) => {
                        const isCreated = item.decision === "created";
                        const isUpdated = item.decision === "updated";
                        const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                        const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                        return (
                          <Box
                            key={`comment-${idx}`}
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                              border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                            }}
                          >
                            {/* Header */}
                            <Box
                              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Chip
                                  label={item.opportunityId}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: "0.7rem", height: 20 }}
                                />
                                <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
                                  {item.opportunityName}
                                </Typography>
                              </Box>
                              <Chip
                                icon={<DecisionIcon sx={{ fontSize: 14 }} />}
                                label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                                size="small"
                                color={decisionColor}
                                sx={{ fontWeight: 600, height: 24 }}
                              />
                            </Box>

                            {/* Comparison */}
                            <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
                              {/* Left: Existing */}
                              <Box
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  bgcolor: item.existing
                                    ? alpha(theme.palette.grey[500], 0.08)
                                    : alpha(theme.palette.grey[300], 0.1),
                                  border: `1px solid ${alpha(theme.palette.grey[400], 0.2)}`,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color="text.secondary"
                                  sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                                >
                                  Existing
                                </Typography>
                                {item.existing ? (
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        bgcolor: item.changes?.includes("text")
                                          ? alpha(theme.palette.warning.main, 0.2)
                                          : "transparent",
                                        px: 0.5,
                                        borderRadius: 0.5,
                                      }}
                                    >
                                      <strong>Text:</strong> {item.existing.text}
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
                                      }}
                                    >
                                      <strong>Author:</strong> {item.existing.author}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
                                    No existing data
                                  </Typography>
                                )}
                              </Box>

                              {/* Arrow */}
                              <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
                                <ArrowForwardIcon sx={{ fontSize: 24, color: `${decisionColor}.main` }} />
                              </Box>

                              {/* Right: Imported */}
                              <Box
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                                  border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color={`${decisionColor}.main`}
                                  sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                                >
                                  Imported
                                </Typography>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      bgcolor: item.changes?.includes("text")
                                        ? alpha(theme.palette[decisionColor].main, 0.2)
                                        : "transparent",
                                      px: 0.5,
                                      borderRadius: 0.5,
                                      fontWeight: item.changes?.includes("text") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Text:</strong> {item.imported.text}
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
                                      fontWeight: item.changes?.includes("author") ? 600 : 400,
                                    }}
                                  >
                                    <strong>Author:</strong> {item.imported.author}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            {/* Reason */}
                            <Box
                              sx={{
                                mt: 1.5,
                                pt: 1,
                                borderTop: `1px dashed ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                              }}
                            >
                              <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500}>
                                {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* Empty state */}
                {importResult.actions.created.length === 0 &&
                  importResult.actions.updated.length === 0 &&
                  importResult.actions.skipped.length === 0 &&
                  importResult.comments.created.length === 0 &&
                  importResult.comments.updated.length === 0 &&
                  importResult.comments.skipped.length === 0 && (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        No actions or comments were found in the import file.
                      </Typography>
                    </Box>
                  )}
              </Box>
            ) : importResult?.error ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body1" color="error.main">
                  {importResult.error}
                </Typography>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Button
              onClick={handleCloseImportModal}
              variant="contained"
              color={importResult?.success ? "primary" : "error"}
              sx={{ px: 4 }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleDeleteCancel}
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

        {/* Import Opportunities Results Dialog - Comparison View */}
        <Dialog
          open={importOpportunitiesModalOpen}
          onClose={handleCloseImportOpportunitiesModal}
          maxWidth="md"
          fullWidth
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
              justifyContent: "space-between",
              pb: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {importOpportunitiesResult?.success ? (
                <>
                  <CheckCircleIcon sx={{ fontSize: 28, color: "success.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    Import Results
                  </Typography>
                </>
              ) : (
                <>
                  <ErrorIcon sx={{ fontSize: 28, color: "error.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    Import Failed
                  </Typography>
                </>
              )}
            </Box>
            {importOpportunitiesResult?.success && importOpportunitiesResult?.details && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                  label={`${importOpportunitiesResult.details.opportunities.created.length} Created`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  icon={<UpdateIcon sx={{ fontSize: 16 }} />}
                  label={`${importOpportunitiesResult.details.opportunities.updated.length} Updated`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  icon={<BlockIcon sx={{ fontSize: 16 }} />}
                  label={`${importOpportunitiesResult.details.opportunities.skipped.length} Skipped`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            )}
          </DialogTitle>
          <DialogContent sx={{ pt: 2, pb: 2 }}>
            {importOpportunitiesResult?.success && importOpportunitiesResult?.details ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {/* All opportunities with comparison view */}
                {[
                  ...importOpportunitiesResult.details.opportunities.created,
                  ...importOpportunitiesResult.details.opportunities.updated,
                  ...importOpportunitiesResult.details.opportunities.skipped,
                ].map((item, idx) => {
                  const isCreated = item.decision === "created";
                  const isUpdated = item.decision === "updated";
                  const isSkipped = item.decision === "skipped";

                  const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                  const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                  // Determine which fields changed (for highlighting)
                  const statusChanged = item.existing && item.existing.statusCode !== item.imported.statusCode;
                  const accountChanged = item.existing && item.existing.account !== item.imported.account;
                  const revenueChanged = item.existing && item.existing.revenue !== item.imported.revenue;
                  const managerChanged = item.existing && item.existing.manager !== item.imported.manager;

                  return (
                    <Box
                      key={idx}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                      }}
                    >
                      {/* Header with opportunity ID, name and decision */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip
                            label={item.opportunityId}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.7rem", height: 20 }}
                          />
                          <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
                            {item.opportunityName}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<DecisionIcon sx={{ fontSize: 14 }} />}
                          label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                          size="small"
                          color={decisionColor}
                          sx={{ fontWeight: 600, height: 24 }}
                        />
                      </Box>

                      {/* Comparison: Left (Existing) vs Right (Imported) */}
                      <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
                        {/* Left side: Existing data */}
                        <Box
                          sx={{
                            flex: 1,
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: item.existing
                              ? alpha(theme.palette.grey[500], 0.08)
                              : alpha(theme.palette.grey[300], 0.1),
                            border: `1px solid ${alpha(theme.palette.grey[400], 0.2)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                          >
                            Existing
                          </Typography>
                          {item.existing ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: statusChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                }}
                              >
                                <strong>Status:</strong> {item.existing.status}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: accountChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                }}
                              >
                                <strong>Account:</strong> {item.existing.account}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: revenueChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                }}
                              >
                                <strong>Revenue:</strong> {item.existing.revenue}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  bgcolor: managerChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                                  px: 0.5,
                                  borderRadius: 0.5,
                                }}
                              >
                                <strong>Manager:</strong> {item.existing.manager}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
                              No existing data
                            </Typography>
                          )}
                        </Box>

                        {/* Arrow */}
                        <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
                          <ArrowForwardIcon sx={{ fontSize: 24, color: `${decisionColor}.main` }} />
                        </Box>

                        {/* Right side: Imported data */}
                        <Box
                          sx={{
                            flex: 1,
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
                            border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color={`${decisionColor}.main`}
                            sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}
                          >
                            Imported
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                bgcolor: statusChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                                px: 0.5,
                                borderRadius: 0.5,
                                fontWeight: statusChanged ? 600 : 400,
                              }}
                            >
                              <strong>Status:</strong> {item.imported.status}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                bgcolor: accountChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                                px: 0.5,
                                borderRadius: 0.5,
                                fontWeight: accountChanged ? 600 : 400,
                              }}
                            >
                              <strong>Account:</strong> {item.imported.account}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                bgcolor: revenueChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                                px: 0.5,
                                borderRadius: 0.5,
                                fontWeight: revenueChanged ? 600 : 400,
                              }}
                            >
                              <strong>Revenue:</strong> {item.imported.revenue}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                bgcolor: managerChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                                px: 0.5,
                                borderRadius: 0.5,
                                fontWeight: managerChanged ? 600 : 400,
                              }}
                            >
                              <strong>Manager:</strong> {item.imported.manager}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Reason */}
                      <Box
                        sx={{
                          mt: 1.5,
                          pt: 1,
                          borderTop: `1px dashed ${alpha(theme.palette[decisionColor].main, 0.3)}`,
                        }}
                      >
                        <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500}>
                          {isCreated ? "✓" : isUpdated ? "↻" : "⊘"} {item.reason}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}

                {/* Empty state */}
                {importOpportunitiesResult.details.opportunities.created.length === 0 &&
                  importOpportunitiesResult.details.opportunities.updated.length === 0 &&
                  importOpportunitiesResult.details.opportunities.skipped.length === 0 && (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        No opportunities were found in the import file.
                      </Typography>
                    </Box>
                  )}
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body1" color="error.main">
                  {importOpportunitiesResult?.error || "An unknown error occurred during import."}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Button
              onClick={handleCloseImportOpportunitiesModal}
              variant="contained"
              color={importOpportunitiesResult?.success ? "primary" : "error"}
              sx={{ px: 4 }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Status Filter Modal */}
        <Dialog
          open={statusFilterModalOpen}
          onClose={handleCloseStatusFilterModal}
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
              minWidth: 320,
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pb: 1.5,
              pt: 2,
              px: 2.5,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FilterListIcon sx={{ fontSize: 22, color: "primary.main" }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Filter by Status
              </Typography>
            </Box>
            <Chip
              label={`${tempStatusFilter.length}`}
              size="small"
              color={tempStatusFilter.length > 0 ? "primary" : "default"}
              sx={{ fontWeight: 600, height: 22, fontSize: "0.75rem" }}
            />
          </DialogTitle>
          <DialogContent sx={{ pt: 2, pb: 1.5, px: 2.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {statusOptions.map((status) => {
                const isChecked = tempStatusFilter.includes(String(status.value));
                return (
                  <FormControlLabel
                    key={status.value}
                    control={
                      <Checkbox
                        checked={isChecked}
                        onChange={() => handleToggleStatus(status.value)}
                        size="small"
                        sx={{
                          color: `${status.color}.main`,
                          "&.Mui-checked": {
                            color: `${status.color}.main`,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: isChecked ? 600 : 400, fontSize: "0.875rem" }}>
                          {status.label}
                        </Typography>
                        <Chip
                          label={`${status.value}`}
                          size="small"
                          color={status.color}
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    }
                    sx={{
                      m: 0,
                      py: 0.75,
                      px: 1,
                      borderRadius: 1,
                      transition: `all 0.2s ${easing.bounce}`,
                      backgroundColor: isChecked ? alpha(theme.palette[status.color].main, 0.08) : "transparent",
                      "&:hover": {
                        backgroundColor: alpha(theme.palette[status.color].main, 0.12),
                      },
                    }}
                  />
                );
              })}
            </Box>
          </DialogContent>
          <DialogActions
            sx={{ px: 2.5, pb: 2, pt: 1.5, gap: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
          >
            <Button
              onClick={handleClearAllStatuses}
              variant="outlined"
              color="error"
              size="small"
              sx={{ fontSize: "0.75rem", py: 0.5 }}
            >
              Clear
            </Button>
            <Button
              onClick={handleSelectAllStatuses}
              variant="outlined"
              size="small"
              sx={{ fontSize: "0.75rem", py: 0.5 }}
            >
              All
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              onClick={handleCloseStatusFilterModal}
              variant="outlined"
              size="small"
              sx={{ fontSize: "0.75rem", py: 0.5 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyStatusFilter}
              variant="contained"
              color="primary"
              size="small"
              sx={{ fontSize: "0.75rem", py: 0.5 }}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
);

OpportunityToolbar.displayName = "OpportunityToolbar";

export default OpportunityToolbar;
