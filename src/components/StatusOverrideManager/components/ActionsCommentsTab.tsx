/**
 * ActionsCommentsTab — Tab 3: Actions / Comments
 */

import React, { memo } from "react";
import { Box, Button, Typography, Chip, alpha, useTheme, Checkbox } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIcon from "@mui/icons-material/Assignment";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { groupItemsBy } from "./tabUtils";
import { useManagementDialog } from "../ManagementDialogContext";

const ActionsCommentsTab = memo(() => {
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

  const storeActions = useUserDataStore((s) => s.opportunityActions);

  // Gather all actions from store
  const allActions: any[] = [];
  Object.entries(storeActions).forEach(([opportunityId, items]) => {
    items.forEach((a) => allActions.push({ ...a, opportunityId: a.opportunityId || opportunityId }));
  });

  // Filter by search text
  const lowerSearch = searchText.toLowerCase();
  const filteredActions = allActions.filter((a) => {
    if (!lowerSearch) return true;
    const opp = opportunityMap[a.opportunityId];
    const oppName = (opp?.opportunity || a.opportunityName || "").toLowerCase();
    const account = (opp?.account || a.opportunityAccount || "").toLowerCase();
    const owner = (a.owner || "").toLowerCase();
    const desc = (a.description || "").toLowerCase();
    return (
      oppName.includes(lowerSearch) ||
      account.includes(lowerSearch) ||
      owner.includes(lowerSearch) ||
      desc.includes(lowerSearch)
    );
  });
  // Group by opportunity
  const byOpp: Record<string, { actions: any[] }> = {};
  filteredActions.forEach((a: any) => {
    const id = a.opportunityId;
    if (!byOpp[id]) byOpp[id] = { actions: [] };
    byOpp[id].actions.push(a);
  });

  // Build grouping on the opportunityIds using groupItemsBy
  const opportunityIds = Object.keys(byOpp);
  const oppEntries = opportunityIds.map((opportunityId) => ({
    opportunityId,
    opp: opportunityMap[opportunityId],
  }));
  const grouped = groupItemsBy(oppEntries, (entry: any) => entry.opp, groupBy);

  const totalItems = filteredActions.length;
  const allOriginalItems = allActions.length;
  const allIds = filteredActions.map((a) => a.id);
  const selCount = allIds.filter((id) => selectedItems.has(id)).length;

  // Render a single opportunity's actions/comments
  const renderOppGroup = (opportunityId: string) => {
    const group = byOpp[opportunityId];
    const opp = opportunityMap[opportunityId];
    const oppName = opp?.opportunity || group.actions[0]?.opportunityName || opportunityId;
    const account = opp?.account || group.actions[0]?.opportunityAccount || "";
    return (
      <Box
        key={opportunityId}
        sx={{
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
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
            <OpenInNewIcon
              sx={{
                fontSize: 12,
                color: "text.disabled",
                ml: "auto",
                flexShrink: 0,
              }}
            />
          )}
        </Box>
        {group.actions.map((action: any) => {
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
                bgcolor: selectedItems.has(action.id) ? alpha(theme.palette.primary.main, 0.04) : "transparent",
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <Checkbox
                size="small"
                checked={selectedItems.has(action.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelect(action.id)}
                sx={{ p: 0, mt: 0.25 }}
              />
              <AssignmentIcon
                sx={{
                  fontSize: 14,
                  color: "text.disabled",
                  mt: 0.5,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                  {action.description}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    flexWrap: "wrap",
                    mt: 0.25,
                  }}
                >
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
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  flexShrink: 0,
                }}
              />
              <Chip
                label={action.priority || "medium"}
                size="small"
                color={action.priority === "high" ? "error" : action.priority === "low" ? "info" : "warning"}
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: "0.6rem",
                  flexShrink: 0,
                }}
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
            {allOriginalItems === 0 ? "Aucune action" : "Aucun résultat pour cette recherche"}
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
            ? Object.keys(byOpp).map((opportunityId) => renderOppGroup(opportunityId))
            : groupBy === "slThenSegment" || groupBy === "segmentThenSl"
              ? Object.entries(grouped)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([primary, { subGroups }]) => {
                    const primaryKey = `ac-${primary}`;
                    const primaryCollapsed = isGroupCollapsed(primaryKey);
                    const allEntries: any[] = (Object.values(subGroups) as any[]).flat();
                    const primaryCount = allEntries.reduce(
                      (s: number, entry: any) => s + (byOpp[entry.opportunityId]?.actions?.length || 0),
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
                          <Chip label={primaryCount as number} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                        </Box>
                        {!primaryCollapsed &&
                          (Object.entries(subGroups) as [string, any][])
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([secondary, entries]) => {
                              const secKey = `ac-${primary}::${secondary}`;
                              const secCollapsed = isGroupCollapsed(secKey);
                              const secCount = entries.reduce(
                                (s: any, entry: any) => s + (byOpp[entry.opportunityId]?.actions?.length || 0),
                                0
                              );
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
                                      label={secCount}
                                      size="small"
                                      sx={{
                                        height: 16,
                                        fontSize: "0.6rem",
                                      }}
                                    />
                                  </Box>
                                  {!secCollapsed && entries.map((entry: any) => renderOppGroup(entry.opportunityId))}
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
                      (s: number, entry: any) => s + (byOpp[entry.opportunityId]?.actions?.length || 0),
                      0
                    );
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
                          <Chip label={gCount} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                        </Box>
                        {!gCollapsed && items.map((entry: any) => renderOppGroup(entry.opportunityId))}
                      </React.Fragment>
                    );
                  })}
        </>
      )}
    </>
  );
});

ActionsCommentsTab.displayName = "ActionsCommentsTab";

export default ActionsCommentsTab;
