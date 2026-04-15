/**
 * ManualOpportunitiesTab — Tab 1: New Opportunities
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import EditNoteIcon from "@mui/icons-material/EditNote";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { groupItemsBy, getStatusLabel, formatDate } from "./tabUtils";
import { formatCurrency } from "../../../utils/formatters";
import { useManagementDialog } from "../ManagementDialogContext";

const ManualOpportunitiesTab = memo(
  ({
    manualOpportunities,
    deleteConfirm,
    setDeleteConfirm,
    onDeleteManualOpportunity,
    setEditOpportunity,
    setOpen,
  }: any) => {
    const {
      searchText,
      selectedItems,
      toggleSelect,
      toggleSelectAll,
      handleDeleteSelected,
      handleOpenOpportunityPopup,
      groupBy,
      isGroupCollapsed,
      toggleGroupCollapse,
    } = useManagementDialog();
    const theme = useTheme();

    const manualCount = manualOpportunities.length;

    const lowerSearch = searchText.toLowerCase();
    const filtered = manualOpportunities.filter((opp: any) => {
      if (!lowerSearch) return true;
      const name = (opp.opportunity || opp.opportunityId).toLowerCase();
      const account = (opp.account || "").toLowerCase();
      return name.includes(lowerSearch) || account.includes(lowerSearch);
    });
    const allIds = filtered.map((o: any) => o.opportunityId);
    const selCount = allIds.filter((id: string) => selectedItems.has(id)).length;
    const grouped = groupItemsBy(filtered, (opp: any) => opp, groupBy);

    const confirmDeleteManual = () => {
      if (deleteConfirm && onDeleteManualOpportunity) {
        onDeleteManualOpportunity(deleteConfirm);
        setDeleteConfirm(null);
      }
    };

    const renderOppItem = (opp: any, index: number) => {
      const isDeleting = deleteConfirm === opp.opportunityId;
      const account = opp.account;
      return (
        <React.Fragment key={opp.opportunityId}>
          {index > 0 && <Divider variant="inset" sx={{ ml: 6 }} />}
          <ListItem
            component="div"
            onClick={() => handleOpenOpportunityPopup(opp)}
            sx={{
              py: 1,
              px: 2,
              cursor: "pointer",
              bgcolor: isDeleting
                ? alpha(theme.palette.error.main, 0.06)
                : selectedItems.has(opp.opportunityId)
                  ? alpha(theme.palette.primary.main, 0.05)
                  : "transparent",
              "&:hover": {
                bgcolor: isDeleting ? alpha(theme.palette.error.main, 0.08) : alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            <Checkbox
              size="small"
              checked={selectedItems.has(opp.opportunityId)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelect(opp.opportunityId)}
              sx={{ mr: 1, p: 0.5 }}
            />
            <ListItemText
              primary={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {account && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{
                        maxWidth: 130,
                        flexShrink: 0,
                        fontSize: "0.72rem",
                      }}
                    >
                      {account} –
                    </Typography>
                  )}
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220, fontSize: "0.82rem" }}>
                    {opp.opportunity || opp.opportunityId}
                  </Typography>
                  <OpenInNewIcon
                    sx={{
                      fontSize: 12,
                      color: "text.disabled",
                      ml: "auto",
                      flexShrink: 0,
                    }}
                  />
                </Box>
              }
              secondary={
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mt: 0.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Chip
                    label={
                      opp._creationStatus != null && opp._creationStatus !== opp.status
                        ? getStatusLabel(opp._creationStatus)
                        : "New"
                    }
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.grey[500], 0.12),
                      color: theme.palette.text.secondary,
                      textDecoration:
                        opp._creationStatus != null && opp._creationStatus !== opp.status ? "line-through" : "none",
                      fontSize: "0.7rem",
                      height: 22,
                    }}
                  />
                  <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                  <Chip
                    label={getStatusLabel(opp.status)}
                    size="small"
                    color={opp.status === 15 ? "error" : opp.status === 14 ? "success" : "primary"}
                    sx={{ fontSize: "0.7rem", fontWeight: 600, height: 22 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(opp.grossRevenue)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {formatDate(opp.creationDate)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(opp.opportunityId);
                      }}
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
                ? filtered.map((opp: any, index: number) => renderOppItem(opp, index))
                : groupBy === "slThenSegment" || groupBy === "segmentThenSl"
                  ? Object.entries(grouped)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([primary, { subGroups }]) => {
                        const primaryKey = `opp-${primary}`;
                        const primaryCollapsed = isGroupCollapsed(primaryKey);
                        const primaryCount = Object.values(subGroups).reduce(
                          (s: number, arr: any) => s + arr.length,
                          0
                        );
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
                                "&:hover": {
                                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                                },
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
                                label={primaryCount as number}
                                size="small"
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                            </Box>
                            {!primaryCollapsed &&
                              (Object.entries(subGroups) as [string, any][])
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([secondary, items]) => {
                                  const secKey = `opp-${primary}::${secondary}`;
                                  const secCollapsed = isGroupCollapsed(secKey);
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
                                          "&:hover": {
                                            bgcolor: alpha(theme.palette.grey[500], 0.06),
                                          },
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
                                          label={items.length}
                                          size="small"
                                          sx={{
                                            height: 16,
                                            fontSize: "0.6rem",
                                          }}
                                        />
                                      </Box>
                                      {!secCollapsed &&
                                        items.map((opp: any, index: number) => renderOppItem(opp, index))}
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
                                "&:hover": {
                                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                                },
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
                              <Chip label={items.length} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                            </Box>
                            {!gCollapsed && items.map((opp: any, index: number) => renderOppItem(opp, index))}
                          </React.Fragment>
                        );
                      })}
            </List>
          </>
        )}
      </>
    );
  }
);

ManualOpportunitiesTab.displayName = "ManualOpportunitiesTab";

export default ManualOpportunitiesTab;
