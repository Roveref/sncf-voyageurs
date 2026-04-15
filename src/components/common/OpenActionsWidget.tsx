/**
 * OpenActionsWidget — Shows all open actions across all opportunities.
 * Designed as a compact dashboard card for quick visibility.
 */

import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useCrmData } from "../../queries/useCrmData";

const OpenActionsWidget = memo(() => {
  const theme = useTheme();
  const allActions = useUserDataStore((s) => s.opportunityActions);
  const { opportunityData } = useCrmData();

  const openActions = useMemo(() => {
    const actions: Array<{
      id: string;
      opportunityId: string;
      oppName: string;
      description: string;
      owner: string;
      dueDate: string;
      priority: string;
      isOverdue: boolean;
    }> = [];
    const today = new Date().toISOString().slice(0, 10);
    const oppMap = new Map(
      opportunityData.map((o) => [o.opportunityId, String(o.opportunity || o.opportunity || o.opportunityId)])
    );

    for (const [opportunityId, oppActions] of Object.entries(allActions)) {
      for (const a of oppActions as any[]) {
        if (a.status !== "done") {
          actions.push({
            id: a.id,
            opportunityId,
            oppName: oppMap.get(opportunityId) || opportunityId,
            description: a.description || "",
            owner: a.owner || "",
            dueDate: a.dueDate || "",
            priority: a.priority || "medium",
            isOverdue: !!a.dueDate && a.dueDate < today,
          });
        }
      }
    }

    return actions.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });
  }, [allActions, opportunityData]);

  if (openActions.length === 0) return null;

  const overdueCount = openActions.filter((a) => a.isOverdue).length;

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <AssignmentLateIcon sx={{ fontSize: 18, color: overdueCount > 0 ? "error.main" : "text.secondary" }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: "0.8rem" }}>
          Open Actions
        </Typography>
        <Chip
          label={openActions.length}
          size="small"
          sx={{
            height: 18,
            fontSize: "0.65rem",
            fontWeight: 700,
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            color: theme.palette.warning.main,
          }}
        />
        {overdueCount > 0 && (
          <Chip
            label={`${overdueCount} overdue`}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.65rem",
              fontWeight: 700,
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: theme.palette.error.main,
            }}
          />
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 200, overflowY: "auto" }}>
        {openActions.slice(0, 10).map((a) => (
          <Box
            key={a.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              py: 0.25,
              px: 0.5,
              borderRadius: 1,
              bgcolor: a.isOverdue ? alpha(theme.palette.error.main, 0.04) : "transparent",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: a.isOverdue ? "error.main" : a.priority === "high" ? "warning.main" : "text.disabled",
                flexShrink: 0,
              }}
            />
            <Typography
              variant="caption"
              sx={{ fontSize: "0.68rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {a.description}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem", flexShrink: 0 }}>
              {a.oppName}
            </Typography>
            {a.dueDate && (
              <Typography
                variant="caption"
                sx={{ fontSize: "0.6rem", color: a.isOverdue ? "error.main" : "text.secondary", flexShrink: 0 }}
              >
                {a.dueDate}
              </Typography>
            )}
          </Box>
        ))}
        {openActions.length > 10 && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem", textAlign: "center" }}>
            +{openActions.length - 10} more
          </Typography>
        )}
      </Box>
    </Box>
  );
});

OpenActionsWidget.displayName = "OpenActionsWidget";
export default OpenActionsWidget;
