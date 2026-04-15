/**
 * StaffingNeedsTab — Tab 4: Staffing Needs
 */

import React, { memo } from "react";
import { Box, Button, Typography, Chip, alpha, useTheme, Checkbox } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupIcon from "@mui/icons-material/Group";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { useAppStore } from "../../../stores/useAppStore";
import { useManagementDialog } from "../ManagementDialogContext";

const StaffingNeedsTab = memo(() => {
  const {
    searchText,
    selectedItems,
    toggleSelect,
    toggleSelectAll,
    handleDeleteSelected,
    handleOpenOpportunityPopup,
    opportunityMap,
  } = useManagementDialog();
  const theme = useTheme();

  const storeNeeds = useUserDataStore((s) => s.staffingNeeds);
  const globalFilteredOppIds = useAppStore((s) => s.filteredOppIds);

  // Gather staffing needs (filtered by region)
  const allStaffingNeeds: any[] = [];
  Object.entries(storeNeeds).forEach(([opportunityId, items]) => {
    if (globalFilteredOppIds.size > 0 && !globalFilteredOppIds.has(opportunityId)) return;
    items.forEach((n) =>
      allStaffingNeeds.push({
        ...n,
        opportunityId: n.opportunityId || opportunityId,
      })
    );
  });

  // Filter by search text
  const lowerSearch = searchText.toLowerCase();
  const filteredStaffingNeeds = allStaffingNeeds.filter((n) => {
    if (!lowerSearch) return true;
    const opp = opportunityMap[n.opportunityId];
    const oppName = (opp?.opportunity || "").toLowerCase();
    const account = (opp?.account || "").toLowerCase();
    const grade = (n.grade || "").toLowerCase();
    const skills = (n.skills || []).join(" ").toLowerCase();
    return (
      oppName.includes(lowerSearch) ||
      account.includes(lowerSearch) ||
      grade.includes(lowerSearch) ||
      skills.includes(lowerSearch)
    );
  });

  // Group by opportunity
  const byOpp: Record<string, any> = {};
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
  const renderOppGroup = (opportunityId: string) => {
    const group = byOpp[opportunityId];
    const opp = opportunityMap[opportunityId];
    const oppName = opp?.opportunity || opportunityId;
    const account = opp?.account || "";
    return (
      <Box
        key={opportunityId}
        sx={{
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
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
        {group.staffingNeeds.map((need: any) => {
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
                bgcolor: selectedItems.has(need.id) ? alpha(theme.palette.primary.main, 0.04) : "transparent",
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <Checkbox
                size="small"
                checked={selectedItems.has(need.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelect(need.id)}
                sx={{ p: 0, mt: 0.25 }}
              />
              <GroupIcon
                sx={{
                  fontSize: 14,
                  color: "info.main",
                  mt: 0.5,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                  {need.grade} x{need.quantity}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    flexWrap: "wrap",
                    mt: 0.25,
                  }}
                >
                  {need.startDate && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(need.startDate).toLocaleDateString("en-GB")} →{" "}
                      {need.endDate ? new Date(need.endDate).toLocaleDateString("en-GB") : "-"}
                    </Typography>
                  )}
                  {need.skills &&
                    need.skills.length > 0 &&
                    need.skills.map((s: any) => (
                      <Chip key={s} label={s} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
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
          {Object.keys(byOpp).map((opportunityId) => renderOppGroup(opportunityId))}
        </>
      )}
    </>
  );
});

StaffingNeedsTab.displayName = "StaffingNeedsTab";

export default StaffingNeedsTab;
