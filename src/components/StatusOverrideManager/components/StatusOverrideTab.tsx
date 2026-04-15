/**
 * StatusOverrideTab — Tab 0: Status Changes
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
import UndoIcon from "@mui/icons-material/Undo";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DeleteIcon from "@mui/icons-material/Delete";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { groupItemsBy, getStatusLabel, formatDate } from "./tabUtils";
import { useManagementDialog } from "../ManagementDialogContext";

const StatusOverrideTab = memo(() => {
  const {
    searchText,
    selectedItems,
    toggleSelect,
    toggleSelectAll,
    handleDeleteSelected,
    handleOpenOpportunityPopup,
    opportunityMap,
    groupBy,
    isGroupCollapsed,
    toggleGroupCollapse,
  } = useManagementDialog();
  const theme = useTheme();

  const statusOverridesMap = useUserDataStore((s) => s.statusOverrides);
  const removeStatusOverride = useUserDataStore((s) => s.removeStatusOverride);

  const getAllOverrides = React.useMemo(
    () =>
      Object.entries(statusOverridesMap)
        .filter(([, data]) => !data._reverted)
        .map(([id, data]) => ({ opportunityId: id, ...data })),
    [statusOverridesMap]
  );

  const handleRevert = (opportunityId: string, event: any) => {
    event.stopPropagation();
    removeStatusOverride(opportunityId);
  };

  const overrideCount = getAllOverrides.length;

  // Filter overrides by search text
  const lowerSearch = searchText.toLowerCase();
  const filtered = getAllOverrides.filter((override: any) => {
    if (!lowerSearch) return true;
    const opp = opportunityMap[override.opportunityId];
    const name = (opp?.opportunity || override.opportunityId).toLowerCase();
    const account = (opp?.account || "").toLowerCase();
    return name.includes(lowerSearch) || account.includes(lowerSearch);
  });
  const allIds = filtered.map((o) => o.opportunityId);
  const selCount = allIds.filter((id) => selectedItems.has(id)).length;
  const grouped = groupItemsBy(filtered, (override: any) => opportunityMap[override.opportunityId], groupBy);

  // Render a list of override items (used for flat and grouped views)
  const renderOverrideItem = (override: any, index: number) => {
    const opportunity = opportunityMap[override.opportunityId];
    const opportunityName = opportunity?.opportunity || override.opportunityId;
    const account = opportunity?.account;
    return (
      <React.Fragment key={override.opportunityId}>
        {index > 0 && <Divider variant="inset" sx={{ ml: 6 }} />}
        <ListItem
          component="div"
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
                  {opportunityName}
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
                  color={override.newStatus === 15 ? "error" : override.newStatus === 14 ? "success" : "primary"}
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
                      const primaryCount = Object.values(subGroups).reduce((s: number, arr: any) => s + arr.length, 0);
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
                                const secKey = `override-${primary}::${secondary}`;
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
                                      items.map((override: any, index: number) => renderOverrideItem(override, index))}
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
                          {!gCollapsed &&
                            items.map((override: any, index: number) => renderOverrideItem(override, index))}
                        </React.Fragment>
                      );
                    })}
          </List>
        </>
      )}
    </>
  );
});

StatusOverrideTab.displayName = "StatusOverrideTab";

export default StatusOverrideTab;
