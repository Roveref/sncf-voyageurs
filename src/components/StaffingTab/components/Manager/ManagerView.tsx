import React, { memo, useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningIcon from "@mui/icons-material/Warning";
import BarChartIcon from "@mui/icons-material/BarChart";
import ApartmentIcon from "@mui/icons-material/Apartment";
import { getGradeColor, compareGrades, getGradeUILabel } from "../../constants";
import { easing } from "../../../../styles/animations";
import { generateManagerHierarchy } from "./managerHierarchy";
import ManagerSelector from "./ManagerSelector";
import { TeamStatsCard, HierarchyNode, EmployeeDetailPanel } from "./ManagerSubComponents";

/**
 * Main Manager View component
 */
export const ManagerView = memo(({ employees, _onNavigateToEmployee }: any) => {
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'hierarchy'

  // Generate manager hierarchy
  const managers = useMemo(() => generateManagerHierarchy(employees), [employees]);

  // Detect if hierarchy is likely fictitious (no real manager grades in data)
  const hierarchyWarning = useMemo(() => {
    const managerGrades = ["Partner", "Director", "Senior Manager", "Manager"];
    const hasRealManagers = employees.some((e: any) => managerGrades.includes(e.grade));
    const managerCount = Object.keys(managers).length;
    const totalCount = employees.length;
    if (!hasRealManagers && totalCount > 0) return "fictitious";
    if (managerCount === 0 && totalCount > 0) return "no_managers";
    return null;
  }, [employees, managers]);

  // Filter employees based on selected manager
  const filteredEmployees = useMemo(() => {
    if (!selectedManager) return employees;

    const manager = managers[selectedManager];
    if (!manager) return employees;

    // Include manager and all their reports
    const reportIds = new Set([selectedManager, ...manager.allReports]);
    return employees.filter((emp: any) => reportIds.has(emp.empId));
  }, [employees, selectedManager, managers]);

  // Calculate team stats
  const teamStats = useMemo(() => {
    const avgUtilization =
      filteredEmployees.reduce((sum: number, e: any) => sum + e.trueUtilizationRate, 0) / filteredEmployees.length || 0;
    const totalAvailable = filteredEmployees.reduce((sum: number, e: any) => sum + e.availableCapacityHours, 0);
    const overloaded = filteredEmployees.filter((e: any) => e.trueUtilizationRate > 100).length;
    const underutilized = filteredEmployees.filter((e: any) => e.trueUtilizationRate < 50).length;
    const totalChargeableHours = filteredEmployees.reduce((sum: number, e: any) => sum + e.chargeableHours, 0);

    return {
      count: filteredEmployees.length,
      avgUtilization,
      totalAvailable,
      overloaded,
      underutilized,
      totalChargeableHours,
    };
  }, [filteredEmployees]);

  // Get top-level managers for hierarchy view
  const topLevelManagers = useMemo(() => {
    const allReportIds = new Set();
    Object.values(managers).forEach((m: any) => {
      m.directReports.forEach((id: any) => allReportIds.add(id));
    });

    // Managers that are not reports of other managers
    return Object.values(managers)
      .filter((m) => !allReportIds.has(m.empId))
      .sort((a, b) => compareGrades(a.grade, b.grade));
  }, [managers]);

  const handleSelectEmployee = useCallback((employee: any) => {
    setSelectedEmployee(employee);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Hierarchy warning */}
      {hierarchyWarning && (
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            p: 2,
            borderRadius: 3,
            border: 1,
            ...(hierarchyWarning === "fictitious"
              ? { bgcolor: "#fffbeb", borderColor: "#fde68a" }
              : { bgcolor: "#eff6ff", borderColor: "#bfdbfe" }),
          }}
        >
          <WarningIcon
            sx={{
              fontSize: 20,
              flexShrink: 0,
              mt: 0.25,
              color: hierarchyWarning === "fictitious" ? "#f59e0b" : "#3b82f6",
            }}
          />
          <Box>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 500,
                ...(hierarchyWarning === "fictitious" ? { color: "#92400e" } : { color: "#1e40af" }),
              }}
            >
              {hierarchyWarning === "fictitious" ? "Simulated hierarchy" : "No manager identified"}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.75rem",
                mt: 0.5,
                ...(hierarchyWarning === "fictitious" ? { color: "#d97706" } : { color: "primary.main" }),
              }}
            >
              {hierarchyWarning === "fictitious"
                ? "Current grades do not contain standard management roles (Partner, Director, Senior Manager, Manager). The displayed hierarchy is an approximation based on grades and sub-teams."
                : "No employee has a recognized managerial grade. Import a skills file with actual grades to enable this view."}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <ApartmentIcon sx={{ fontSize: 24, color: "#4f46e5" }} />
            Manager View
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", mt: 0.5 }}>
            View and filter by management hierarchy
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* View mode toggle */}
          <Box sx={{ display: "flex", bgcolor: "#f3f4f6", borderRadius: 2, p: 0.5 }}>
            <Box
              component="button"
              onClick={() => setViewMode("list")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: `background-color 0.3s ${easing.elegant}, color 0.3s ${easing.elegant}, box-shadow 0.3s ${easing.elegant}`,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                ...(viewMode === "list"
                  ? { bgcolor: "#fff", color: "#4f46e5", boxShadow: 1 }
                  : { bgcolor: "transparent", color: "text.secondary", "&:hover": { color: "text.primary" } }),
              }}
            >
              <GroupIcon sx={{ fontSize: 16 }} />
              List
            </Box>
            <Box
              component="button"
              onClick={() => setViewMode("hierarchy")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: `background-color 0.3s ${easing.elegant}, color 0.3s ${easing.elegant}, box-shadow 0.3s ${easing.elegant}`,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                ...(viewMode === "hierarchy"
                  ? { bgcolor: "#fff", color: "#4f46e5", boxShadow: 1 }
                  : { bgcolor: "transparent", color: "text.secondary", "&:hover": { color: "text.primary" } }),
              }}
            >
              <BarChartIcon sx={{ fontSize: 16 }} />
              Org chart
            </Box>
          </Box>

          {/* Manager selector */}
          <ManagerSelector
            managers={managers}
            selectedManager={selectedManager}
            onSelect={setSelectedManager}
            employees={employees}
          />
        </Box>
      </Box>

      {/* Team Stats */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
          gap: 2,
        }}
      >
        <TeamStatsCard
          icon={GroupIcon}
          label="Headcount"
          value={teamStats.count}
          subvalue={selectedManager ? "in team" : "total"}
          color="blue"
        />
        <TeamStatsCard
          icon={TrendingUpIcon}
          label="Avg. utilization"
          value={`${teamStats.avgUtilization.toFixed(0)}%`}
          color={teamStats.avgUtilization >= 80 ? "green" : teamStats.avgUtilization >= 50 ? "blue" : "yellow"}
        />
        <TeamStatsCard
          icon={AccessTimeIcon}
          label="Available capacity"
          value={`${teamStats.totalAvailable.toFixed(0)}h`}
          subvalue="per day"
          color="green"
        />
        <TeamStatsCard
          icon={WarningIcon}
          label="Overloaded"
          value={teamStats.overloaded}
          subvalue="> 100%"
          color={teamStats.overloaded > 0 ? "red" : "green"}
        />
        <TeamStatsCard
          icon={AccessTimeIcon}
          label="Underutilized"
          value={teamStats.underutilized}
          subvalue="< 50%"
          color={teamStats.underutilized > 0 ? "yellow" : "green"}
        />
        <TeamStatsCard
          icon={BarChartIcon}
          label="Chargeable hrs"
          value={`${teamStats.totalChargeableHours.toFixed(0)}h`}
          color="purple"
        />
      </Box>

      {/* Main content */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
        {/* Employee list/hierarchy */}
        <Box
          sx={{
            gridColumn: { lg: "span 2" },
            bgcolor: "#fff",
            borderRadius: 3,
            border: 1,
            borderColor: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "#e5e7eb" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="h6" sx={{ fontWeight: 500, color: "text.primary", fontSize: "inherit" }}>
                {viewMode === "hierarchy" ? "Org chart" : "Team members"}
              </Typography>
              <Box component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                {filteredEmployees.length} people
              </Box>
            </Box>
          </Box>

          <Box sx={{ maxHeight: 600, overflowY: "auto" }}>
            {viewMode === "hierarchy" ? (
              <Box sx={{ p: 1 }}>
                {selectedManager ? (
                  <HierarchyNode
                    employee={employees.find((e: any) => e.empId === selectedManager)}
                    managers={managers}
                    level={0}
                    employees={employees}
                    onSelect={handleSelectEmployee}
                    selectedEmpId={selectedEmployee?.empId}
                  />
                ) : (
                  topLevelManagers.map((manager) => (
                    <HierarchyNode
                      key={manager.empId}
                      employee={manager}
                      managers={managers}
                      level={0}
                      employees={employees}
                      onSelect={handleSelectEmployee}
                      selectedEmpId={selectedEmployee?.empId}
                    />
                  ))
                )}
              </Box>
            ) : (
              <Box sx={{ "& > *:not(:last-child)": { borderBottom: 1, borderColor: "#f3f4f6" } }}>
                {filteredEmployees.map((emp: any) => {
                  const gradeColors = getGradeColor(emp.grade);
                  const isManager = managers[emp.empId];
                  const isSelected = selectedEmployee?.empId === emp.empId;

                  return (
                    <Box
                      key={emp.empId}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        cursor: "pointer",
                        transition: `background-color 0.3s ${easing.elegant}`,
                        ...(isSelected ? { bgcolor: "#eff6ff" } : { "&:hover": { bgcolor: "background.default" } }),
                      }}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          ...(isManager ? { bgcolor: "#dbeafe" } : { bgcolor: "#f3f4f6" }),
                        }}
                      >
                        {isManager ? (
                          <HowToRegIcon sx={{ fontSize: 20, color: "primary.main" }} />
                        ) : (
                          <PersonIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                        )}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            component="span"
                            sx={{
                              fontWeight: 500,
                              color: "text.primary",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {emp.name}
                          </Box>
                          {isManager && (
                            <Box component="span" sx={{ fontSize: "0.75rem", color: "primary.main" }}>
                              ({managers[emp.empId].directReports.length} reports)
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.75,
                              py: 0.25,
                              fontSize: "0.75rem",
                              borderRadius: 1,
                              bgcolor: gradeColors.bg,
                              color: gradeColors.text,
                            }}
                          >
                            {getGradeUILabel(emp.grade)}
                          </Box>
                          <Box component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                            {emp.subTeam}
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: "right" }}>
                        <Box
                          sx={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            ...(emp.trueUtilizationRate > 100
                              ? { color: "#ef4444" }
                              : emp.trueUtilizationRate >= 80
                                ? { color: "#16a34a" }
                                : { color: "primary.main" }),
                          }}
                        >
                          {emp.trueUtilizationRate.toFixed(0)}%
                        </Box>
                        <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                          {emp.availableCapacityHours.toFixed(1)}h avail.
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Detail panel */}
        <Box sx={{ gridColumn: { lg: "span 1" } }}>
          {selectedEmployee ? (
            <EmployeeDetailPanel employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
          ) : (
            <Box
              sx={{
                bgcolor: "background.default",
                borderRadius: 3,
                border: 1,
                borderColor: "#e5e7eb",
                p: 4,
                textAlign: "center",
              }}
            >
              <PersonIcon sx={{ fontSize: 48, display: "block", mx: "auto", color: "#d1d5db", mb: 1.5 }} />
              <Typography sx={{ color: "text.secondary" }}>
                Sélectionner un collaborateur pour voir les détails
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
});

ManagerView.displayName = "ManagerView";
