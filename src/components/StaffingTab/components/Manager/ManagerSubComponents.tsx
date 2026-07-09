/**
 * Manager sub-components — TeamStatsCard, HierarchyNode, EmployeeDetailPanel.
 * Extracted from ManagerView for readability.
 */

import React, { memo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonIcon from "@mui/icons-material/Person";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import { getGradeColor, SUB_TEAM_COLORS, getGradeUILabel } from "../../constants";
import { easing } from "../../../../styles/animations";

// ─── TeamStatsCard ──────────────────────────────────────────────────────────

export const TeamStatsCard = memo(({ icon: Icon, label, value, subvalue, color }: any) => {
  const colorStyles: Record<string, { bgcolor: string; color: string; borderColor: string }> = {
    blue: { bgcolor: "#eff6ff", color: "primary.main", borderColor: "#bfdbfe" },
    green: { bgcolor: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" },
    yellow: { bgcolor: "#fefce8", color: "#ca8a04", borderColor: "#fde68a" },
    red: { bgcolor: "#fef2f2", color: "#ef4444", borderColor: "#fecaca" },
    purple: { bgcolor: "#faf5ff", color: "#9333ea", borderColor: "#e9d5ff" },
  };

  const styles = colorStyles[color];

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: 1,
        bgcolor: styles.bgcolor,
        color: styles.color,
        borderColor: styles.borderColor,
        transition: `background-color 0.3s ${easing.elegant}, color 0.3s ${easing.elegant}, border-color 0.3s ${easing.elegant}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Icon sx={{ fontSize: 20 }} />
        <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
          {label}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</Typography>
      {subvalue && <Typography sx={{ fontSize: "0.75rem", mt: 0.5, opacity: 0.75 }}>{subvalue}</Typography>}
    </Box>
  );
});

TeamStatsCard.displayName = "TeamStatsCard";

// ─── HierarchyNode ──────────────────────────────────────────────────────────

export const HierarchyNode = memo(({ employee, managers, level = 0, employees, onSelect, selectedEmpId }: any) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const isManager = managers[employee.empId];
  const directReports = isManager
    ? isManager.directReports.map((id: any) => employees.find((e: any) => e.empId === id)).filter(Boolean)
    : [];

  const gradeColors = getGradeColor(employee.grade);
  const isSelected = selectedEmpId === employee.empId;

  return (
    <Box sx={{ userSelect: "none" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          cursor: "pointer",
          transition: `background-color 0.3s ${easing.elegant}`,
          pl: `${level * 24 + 12}px`,
          ...(isSelected ? { bgcolor: "#dbeafe" } : { "&:hover": { bgcolor: "background.default" } }),
        }}
        onClick={() => onSelect(employee)}
      >
        {directReports.length > 0 ? (
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            sx={{
              p: 0.25,
              "&:hover": { bgcolor: "#e5e7eb" },
              borderRadius: 1,
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isExpanded ? (
              <ExpandMoreIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            )}
          </Box>
        ) : (
          <Box sx={{ width: 20 }} />
        )}

        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(isManager ? { bgcolor: "#dbeafe" } : { bgcolor: "#f3f4f6" }),
            }}
          >
            {isManager ? (
              <HowToRegIcon sx={{ fontSize: 16, color: "primary.main" }} />
            ) : (
              <PersonIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            )}
          </Box>
          <Box>
            <Box sx={{ fontWeight: 500, color: "text.primary" }}>{employee.name}</Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.75rem" }}>
              <Box
                component="span"
                sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: gradeColors.bg, color: gradeColors.text }}
              >
                {getGradeUILabel(employee.grade)}
              </Box>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {employee.subTeam}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ textAlign: "right" }}>
          <Box
            sx={{
              fontSize: "0.875rem",
              fontWeight: 500,
              ...(employee.trueUtilizationRate > 100
                ? { color: "#ef4444" }
                : employee.trueUtilizationRate >= 80
                  ? { color: "#16a34a" }
                  : employee.trueUtilizationRate >= 50
                    ? { color: "primary.main" }
                    : { color: "#ca8a04" }),
            }}
          >
            {employee.trueUtilizationRate.toFixed(0)}%
          </Box>
          <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {employee.availableCapacityHours.toFixed(1)}h avail.
          </Box>
        </Box>
      </Box>

      {isExpanded && directReports.length > 0 && (
        <Box>
          {directReports.map((report: any) => (
            <HierarchyNode
              key={report.empId}
              employee={report}
              managers={managers}
              level={level + 1}
              employees={employees}
              onSelect={onSelect}
              selectedEmpId={selectedEmpId}
            />
          ))}
        </Box>
      )}
    </Box>
  );
});

HierarchyNode.displayName = "HierarchyNode";

// ─── EmployeeDetailPanel ────────────────────────────────────────────────────

export const EmployeeDetailPanel = memo(({ employee, onClose }: any) => {
  if (!employee) return null;

  const gradeColors = getGradeColor(employee.grade);
  const teamColors = SUB_TEAM_COLORS[employee.subTeam] || { bg: "#f3f4f6", text: "#374151" };

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: 1, borderColor: "#e5e7eb", p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "#dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PersonIcon sx={{ fontSize: 24, color: "primary.main" }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary", fontSize: "inherit" }}>
              {employee.name}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: "0.75rem",
                  borderRadius: 1,
                  bgcolor: gradeColors.bg,
                  color: gradeColors.text,
                }}
              >
                {getGradeUILabel(employee.grade)}
              </Box>
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: "0.75rem",
                  borderRadius: 1,
                  bgcolor: teamColors.bg,
                  color: teamColors.text,
                }}
              >
                {employee.subTeam}
              </Box>
            </Box>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            p: 0.5,
            color: "text.disabled",
            "&:hover": { color: "text.secondary", bgcolor: "#f3f4f6" },
            borderRadius: 1,
          }}
          size="small"
        >
          &times;
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
        <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Charge</Typography>
          <Typography
            sx={{
              fontSize: "1.25rem",
              fontWeight: 700,
              ...(employee.trueUtilizationRate > 100
                ? { color: "#ef4444" }
                : employee.trueUtilizationRate >= 80
                  ? { color: "#16a34a" }
                  : { color: "primary.main" }),
            }}
          >
            {employee.trueUtilizationRate.toFixed(0)}%
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Disponibilité</Typography>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#16a34a" }}>
            {employee.availableCapacityHours.toFixed(1)}h/d
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Projets</Typography>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}>
            {employee.projectCount}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Chargeable hrs</Typography>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}>
            {employee.chargeableHours.toFixed(0)}h
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", mb: 1 }}>
          Active assignments
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 160, overflowY: "auto" }}>
          {employee.assignments.slice(0, 5).map((assignment: any, idx: number) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.875rem",
                p: 1,
                bgcolor: "background.default",
                borderRadius: 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  color: "text.primary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {assignment.jobName}
              </Box>
              <Box component="span" sx={{ color: "text.secondary", ml: 1 }}>
                {assignment.utilization}%
              </Box>
            </Box>
          ))}
          {employee.assignments.length > 5 && (
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", textAlign: "center" }}>
              +{employee.assignments.length - 5} more
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
});

EmployeeDetailPanel.displayName = "EmployeeDetailPanel";
