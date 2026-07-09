import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import { alpha, useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EventIcon from "@mui/icons-material/Event";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import useScenarioStore from "../../../../stores/useScenarioStore";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { useAppStore } from "../../../../stores/useAppStore";
import type { AssignmentOverride, EmployeeOverride } from "../../types";

const GRADE_COLORS: Record<string, string> = {
  Intern: "#9ca3af",
  Analyst: "#6b7280",
  Consultant: "#3b82f6",
  "Senior Consultant": "#2563eb",
  Manager: "#f59e0b",
  "Senior Manager": "#d97706",
  Director: "#8b5cf6",
  Partner: "#ef4444",
};

const TYPE_CONFIG = {
  create: { icon: AddCircleOutlineIcon, color: "#10b981", label: "Ajouter" },
  edit: { icon: EditIcon, color: "#3b82f6", label: "Modifier" },
  delete: { icon: DeleteOutlineIcon, color: "#ef4444", label: "Supprimer" },
};

interface Props {
  employees: any[];
  pipelineJobcodes: Map<string, any> | null;
  onOpenAssignmentModal: (prefill?: { empId?: string; jobNo?: string; startDate?: string; endDate?: string }) => void;
}

const ScenarioWorkbench = memo(({ employees, pipelineJobcodes, onOpenAssignmentModal }: Props) => {
  const theme = useTheme();
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const removeAssignmentOverride = useScenarioStore((s) => s.removeAssignmentOverride);
  const removeEmployeeOverride = useScenarioStore((s) => s.removeEmployeeOverride);

  const storeNeedsMap = useUserDataStore((s) => s.staffingNeeds);
  const globalFilteredOppIds = useAppStore((s) => s.filteredOppIds);
  const staffingNeeds = useMemo(() => {
    const all: any[] = [];
    Object.entries(storeNeedsMap).forEach(([opportunityId, items]) => {
      if (globalFilteredOppIds.size > 0 && !globalFilteredOppIds.has(opportunityId)) return;
      items.forEach((n) => all.push({ ...n, opportunityId: n.opportunityId || opportunityId }));
    });
    return all;
  }, [storeNeedsMap, globalFilteredOppIds]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  if (!activeScenario) return null;

  // Employee lookup
  const empMap = useMemo(() => {
    const map = new Map<string, any>();
    employees.forEach((e) => map.set(e.empId, e));
    return map;
  }, [employees]);

  // Enrich job label
  const getJobLabel = useCallback(
    (jobNo: string) => {
      if (!pipelineJobcodes || !jobNo) return jobNo;
      const info = pipelineJobcodes.get(jobNo);
      if (!info) return jobNo;
      return `${info.account ? info.account + " - " : ""}${info.opportunityName || jobNo}`;
    },
    [pipelineJobcodes]
  );

  // ── Assignment overrides ──
  const assignmentOverrides = Object.entries(activeScenario.assignmentOverrides);
  const employeeOverrides = Object.entries(activeScenario.employeeOverrides);
  const totalOverrides = assignmentOverrides.length + employeeOverrides.length;

  // ── Drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes("application/scenario-employee")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropTarget(targetId);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
  }, []);

  const handleDropOnNeed = useCallback(
    (e: React.DragEvent, need: any) => {
      e.preventDefault();
      setDropTarget(null);
      try {
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (!empId) return;
        // Find opportunity job code
        const opp = need.opportunityId;
        onOpenAssignmentModal({
          empId,
          jobNo: opp,
          startDate: need.startDate || "",
          endDate: need.endDate || "",
        });
      } catch {
        /* skip */
      }
    },
    [onOpenAssignmentModal]
  );

  const handleDropOnFreeZone = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      try {
        const empId = e.dataTransfer.getData("application/scenario-employee");
        if (empId) onOpenAssignmentModal({ empId });
      } catch {
        /* skip */
      }
    },
    [onOpenAssignmentModal]
  );

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, bgcolor: "#fffbeb", border: "1px solid #fbbf24", overflow: "hidden" }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: alpha("#fbbf24", 0.4),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WorkOutlineIcon sx={{ fontSize: 18, color: "#92400e" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#92400e" }}>
            Scenario workbench
          </Typography>
          <Chip
            label={`${totalOverrides} change${totalOverrides > 1 ? "s" : ""}`}
            size="small"
            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 600, bgcolor: "#fef3c7", color: "#92400e" }}
          />
        </Box>
      </Box>

      {/* Two columns */}
      <Box sx={{ display: "flex", gap: 0, minHeight: 120 }}>
        {/* Left: modifications */}
        <Box
          sx={{
            flex: 1,
            p: 2,
            borderRight: "1px solid",
            borderColor: alpha("#fbbf24", 0.3),
            overflow: "auto",
            maxHeight: 320,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              mb: 1,
              display: "block",
            }}
          >
            Changes ({assignmentOverrides.length + employeeOverrides.length})
          </Typography>

          {totalOverrides === 0 && (
            <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic", mt: 1 }}>
              No changes. Edit assignments or profiles to create overrides.
            </Typography>
          )}

          {/* Assignment overrides */}
          {assignmentOverrides.map(([key, override]) => {
            const cfg = TYPE_CONFIG[override.type] || TYPE_CONFIG.edit;
            const Icon = cfg.icon;
            const emp = empMap.get(override.data.empId);
            const empName = emp?.name || override.data.empId;
            const jobLabel = getJobLabel(override.data.jobNo);

            return (
              <Box
                key={key}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  mb: 0.5,
                  borderRadius: 1.5,
                  bgcolor: alpha(cfg.color, 0.06),
                  border: `1px solid ${alpha(cfg.color, 0.15)}`,
                }}
              >
                <Tooltip title={cfg.label}>
                  <Icon sx={{ fontSize: 16, color: cfg.color, flexShrink: 0 }} />
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>
                    {empName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {jobLabel}
                    {override.data.startDate && ` · ${override.data.startDate}`}
                  </Typography>
                </Box>
                <Tooltip title="Delete change">
                  <IconButton size="small" onClick={() => removeAssignmentOverride(key)} sx={{ p: 0.25 }}>
                    <DeleteOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })}

          {/* Employee overrides */}
          {employeeOverrides.map(([empId, override]) => {
            const emp = empMap.get(empId);
            const empName = emp?.name || empId;
            const isRemoved = override.isRemoved;
            const isVirtual = override.isVirtual;
            const color = isRemoved ? "#ef4444" : isVirtual ? "#10b981" : "#8b5cf6";
            const Icon = isRemoved ? PersonRemoveIcon : isVirtual ? PersonAddIcon : SwapHorizIcon;
            const label = isRemoved ? "Departure" : isVirtual ? "Virtual" : "Metadata";

            return (
              <Box
                key={empId}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  mb: 0.5,
                  borderRadius: 1.5,
                  bgcolor: alpha(color, 0.06),
                  border: `1px solid ${alpha(color, 0.15)}`,
                }}
              >
                <Tooltip title={label}>
                  <Icon sx={{ fontSize: 16, color, flexShrink: 0 }} />
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>
                    {empName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {override.metadata?.team && `Team: ${override.metadata.team}`}
                    {override.metadata?.dm && ` · DM: ${override.metadata.dm}`}
                  </Typography>
                </Box>
                <Tooltip title="Delete change">
                  <IconButton size="small" onClick={() => removeEmployeeOverride(empId)} sx={{ p: 0.25 }}>
                    <DeleteOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })}
        </Box>

        {/* Right: staffing needs + drop zone */}
        <Box sx={{ flex: 1, p: 2, overflow: "auto", maxHeight: 320 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              mb: 1,
              display: "block",
            }}
          >
            Staffing needs ({staffingNeeds.length})
          </Typography>

          {staffingNeeds.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic", mt: 1 }}>
              No needs defined. Create needs from the Pipeline.
            </Typography>
          )}

          {staffingNeeds.map((need) => {
            const gradeColor = GRADE_COLORS[need.grade] || "#6b7280";
            const isOver = dropTarget === need.id;

            return (
              <Box
                key={need.id}
                onDragOver={(e) => handleDragOver(e, need.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnNeed(e, need)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  mb: 0.5,
                  borderRadius: 1.5,
                  bgcolor: isOver ? alpha(theme.palette.primary.main, 0.08) : alpha(gradeColor, 0.04),
                  border: `1px solid ${isOver ? theme.palette.primary.main : alpha(gradeColor, 0.15)}`,
                  transition:
                    "background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                  ...(isOver && {
                    transform: "scale(1.01)",
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                  }),
                }}
              >
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    bgcolor: alpha(gradeColor, 0.15),
                    color: gradeColor,
                  }}
                >
                  {need.quantity || 1}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>
                    {need.grade || "Undefined"}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {(need.startDate || need.endDate) && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        <EventIcon sx={{ fontSize: 10, color: "text.disabled" }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                          {need.startDate ? new Date(need.startDate).toLocaleDateString("en-GB") : "?"}
                          {" → "}
                          {need.endDate ? new Date(need.endDate).toLocaleDateString("en-GB") : "?"}
                        </Typography>
                      </Box>
                    )}
                    {need.skills?.length > 0 &&
                      need.skills
                        .slice(0, 2)
                        .map((s: string) => (
                          <Chip key={s} label={s} size="small" sx={{ height: 16, fontSize: "0.55rem" }} />
                        ))}
                  </Box>
                </Box>
                {isOver && <PersonAddIcon sx={{ fontSize: 16, color: "primary.main" }} />}
              </Box>
            );
          })}

          {/* Free drop zone */}
          <Box
            onDragOver={(e) => handleDragOver(e, "__free__")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnFreeZone}
            sx={{
              mt: 1,
              p: 2,
              borderRadius: 2,
              border: `2px dashed ${dropTarget === "__free__" ? theme.palette.primary.main : alpha("#92400e", 0.2)}`,
              bgcolor: dropTarget === "__free__" ? alpha(theme.palette.primary.main, 0.06) : "transparent",
              textAlign: "center",
              transition: "background-color 0.15s ease, border-color 0.15s ease",
            }}
          >
            <PersonAddIcon
              sx={{ fontSize: 20, color: dropTarget === "__free__" ? "primary.main" : "text.disabled", mb: 0.5 }}
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: dropTarget === "__free__" ? "primary.main" : "text.disabled",
                fontWeight: 500,
              }}
            >
              Drop an employee here to create a free assignment
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
});

ScenarioWorkbench.displayName = "ScenarioWorkbench";
export default ScenarioWorkbench;
