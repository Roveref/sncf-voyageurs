import React, { memo, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WorkIcon from "@mui/icons-material/Work";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { alpha } from "@mui/material/styles";
import { EmployeeAvatar, StatusBadge, UtilizationBar } from "./UtilizationBadge";
import { getGradeColor, getGradeUILabel, SUB_TEAM_COLORS, compareGrades } from "../../constants";
import { fmtHD } from "../../constants/theme";
import { dividerBorder } from "../../../../styles/borders";

const GradeBadge = memo(({ grade }: any) => {
  if (!grade)
    return (
      <Typography component="span" sx={{ color: "text.disabled" }}>
        -
      </Typography>
    );
  const colors = getGradeColor(grade);
  return (
    <Box
      component="span"
      sx={{
        px: 1,
        py: 0.25,
        fontSize: "0.75rem",
        fontWeight: 500,
        borderRadius: 1,
        whiteSpace: "nowrap",
        bgcolor: colors.bg,
        color: colors.text,
      }}
    >
      {getGradeUILabel(grade)}
    </Box>
  );
});
GradeBadge.displayName = "GradeBadge";

const SubTeamBadge = memo(({ subTeam }: any) => {
  if (!subTeam)
    return (
      <Typography component="span" sx={{ color: "text.disabled" }}>
        -
      </Typography>
    );
  const colors = SUB_TEAM_COLORS[subTeam] || { bg: "action.hover", text: "text.primary" };
  return (
    <Box
      component="span"
      sx={{
        px: 1,
        py: 0.25,
        fontSize: "0.75rem",
        fontWeight: 500,
        borderRadius: 1,
        whiteSpace: "nowrap",
        bgcolor: colors.bg,
        color: colors.text,
      }}
    >
      {subTeam}
    </Box>
  );
});
SubTeamBadge.displayName = "SubTeamBadge";

const SortableHeader = memo(({ label, sortKey, currentSort, onSort, align = "left" }: any) => {
  const isActive = currentSort.key === sortKey;
  const isAsc = currentSort.order === "asc";

  return (
    <TableCell
      sx={{
        px: 2,
        py: 1.5,
        textAlign: align,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
        transition: "background-color 0.15s",
        userSelect: "none",
      }}
      onClick={() => onSort(sortKey)}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          ...(align === "right"
            ? { justifyContent: "flex-end" }
            : align === "center"
              ? { justifyContent: "center" }
              : {}),
        }}
      >
        <span>{label}</span>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <ArrowDropUpIcon
            sx={{ height: 14, width: 14, mb: "-4px", color: isActive && isAsc ? "primary.main" : "text.disabled" }}
          />
          <ArrowDropDownIcon
            sx={{ height: 14, width: 14, color: isActive && !isAsc ? "primary.main" : "text.disabled" }}
          />
        </Box>
      </Box>
    </TableCell>
  );
});
SortableHeader.displayName = "SortableHeader";

const ActionMenu = memo(({ employee, onView, onAssign }: any) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Box sx={{ position: "relative" }}>
      <IconButton onClick={() => setIsOpen(!isOpen)} size="small" sx={{ "&:hover": { bgcolor: "action.hover" } }}>
        <MoreHorizIcon sx={{ height: 16, width: 16, color: "text.secondary" }} />
      </IconButton>

      {isOpen && (
        <>
          <Box sx={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setIsOpen(false)} />
          <Box
            sx={{
              position: "absolute",
              right: 0,
              mt: 0.5,
              width: 192,
              bgcolor: "background.paper",
              borderRadius: 2,
              boxShadow: 3,
              border: (theme) => dividerBorder(theme, "default"),
              py: 0.5,
              zIndex: 20,
            }}
          >
            <Box
              component="button"
              onClick={() => {
                onView(employee);
                setIsOpen(false);
              }}
              sx={{
                width: "100%",
                px: 2,
                py: 1,
                textAlign: "left",
                fontSize: "0.875rem",
                color: "text.secondary",
                "&:hover": { bgcolor: "background.default" },
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <VisibilityIcon sx={{ height: 16, width: 16 }} />
              Voir details
            </Box>
            <Box
              component="button"
              onClick={() => {
                onAssign(employee);
                setIsOpen(false);
              }}
              sx={{
                width: "100%",
                px: 2,
                py: 1,
                textAlign: "left",
                fontSize: "0.875rem",
                color: "text.secondary",
                "&:hover": { bgcolor: "background.default" },
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <AddIcon sx={{ height: 16, width: 16 }} />
              New assignment
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
});
ActionMenu.displayName = "ActionMenu";

const EmployeeTableRow = memo(({ employee, onView, onAssign, isSelected, onSelect }: any) => {
  const chargeableProjects = employee.assignments.filter((a: any) => a.category === "CHARGEABLE").length;

  return (
    <TableRow
      sx={{
        borderBottom: (theme) => dividerBorder(theme, "subtle"),
        "&:hover": { bgcolor: "background.default" },
        transition: "background-color 0.15s",
        ...(isSelected && { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }),
      }}
    >
      <TableCell sx={{ px: 2, py: 1.5 }}>
        <Checkbox
          checked={isSelected}
          onChange={() => onSelect(employee.empId)}
          size="small"
          sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }}
        />
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <EmployeeAvatar name={employee.name} empId={employee.empId} size="sm" />
          <Box>
            <Typography sx={{ fontWeight: 500, color: "text.primary" }}>{employee.name}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              ID: {employee.empId}
            </Typography>
          </Box>
        </Box>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5 }}>
        <GradeBadge grade={employee.grade} />
      </TableCell>
      <TableCell sx={{ px: 2, py: 1.5 }}>
        <SubTeamBadge subTeam={employee.subTeam} />
      </TableCell>
      <TableCell sx={{ px: 2, py: 1.5 }}>
        <StatusBadge rate={employee.trueUtilizationRate} size="sm" />
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <UtilizationBar rate={employee.trueUtilizationRate} height="h-2" sx={{ width: 80 }} />
          <Typography
            component="span"
            sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", minWidth: "3rem" }}
          >
            {employee.trueUtilizationRate.toFixed(0)}%
          </Typography>
        </Box>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5, textAlign: "right" }}>
        <Typography
          component="span"
          sx={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color:
              employee.availableCapacityHours > 4
                ? "success.main"
                : employee.availableCapacityHours > 0
                  ? "warning.dark"
                  : "text.disabled",
          }}
        >
          {employee.availableCapacityHours.toFixed(1)}h/d ({(employee.availableCapacityHours / 8).toFixed(1)}d)
        </Typography>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5, textAlign: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
          <WorkIcon sx={{ height: 16, width: 16, color: "text.disabled" }} />
          <Typography component="span" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}>
            {chargeableProjects}
          </Typography>
        </Box>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5, textAlign: "center" }}>
        <Typography component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
          {employee.assignments.length}
        </Typography>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5, textAlign: "right" }}>
        <Typography component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
          {fmtHD(employee.chargeableHours)}
        </Typography>
      </TableCell>

      <TableCell sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
          <IconButton
            onClick={() => onView(employee)}
            size="small"
            title="View details"
            sx={{ "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12) }, color: "primary.main" }}
          >
            <VisibilityIcon sx={{ height: 16, width: 16 }} />
          </IconButton>
          <IconButton
            onClick={() => onAssign(employee)}
            size="small"
            title="New assignment"
            sx={{ "&:hover": { bgcolor: (theme) => alpha(theme.palette.success.main, 0.12) }, color: "success.main" }}
          >
            <AddIcon sx={{ height: 16, width: 16 }} />
          </IconButton>
          <ActionMenu employee={employee} onView={onView} onAssign={onAssign} />
        </Box>
      </TableCell>
    </TableRow>
  );
});
EmployeeTableRow.displayName = "EmployeeTableRow";

export const EmployeeTableView = memo(({ employees, onViewEmployee, onAssignEmployee }: any) => {
  const [sort, setSort] = useState({ key: "utilization", order: "desc" });
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  const handleSort = (key: string) => {
    setSort((prev) => ({ key, order: prev.key === key && prev.order === "desc" ? "asc" : "desc" }));
  };

  const handleSelectAll = () => {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map((e: any) => e.empId)));
    }
  };

  const handleSelect = (empId: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      let aVal, bVal;
      switch (sort.key) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "grade":
          return sort.order === "asc" ? compareGrades(a.grade, b.grade) : compareGrades(b.grade, a.grade);
        case "subTeam":
          aVal = (a.subTeam || "").toLowerCase();
          bVal = (b.subTeam || "").toLowerCase();
          break;
        case "utilization":
          aVal = a.trueUtilizationRate;
          bVal = b.trueUtilizationRate;
          break;
        case "available":
          aVal = a.availableCapacityHours;
          bVal = b.availableCapacityHours;
          break;
        case "projects":
          aVal = a.projectCount;
          bVal = b.projectCount;
          break;
        case "assignments":
          aVal = a.assignments.length;
          bVal = b.assignments.length;
          break;
        case "hours":
          aVal = a.chargeableHours;
          bVal = b.chargeableHours;
          break;
        default:
          aVal = a.trueUtilizationRate;
          bVal = b.trueUtilizationRate;
      }
      if (typeof aVal === "string") return sort.order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sort.order === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [employees, sort]);

  const stats = useMemo(() => {
    const avgUtilization =
      employees.reduce((sum: number, e: any) => sum + e.trueUtilizationRate, 0) / employees.length || 0;
    const totalAvailable = employees.reduce((sum: number, e: any) => sum + e.availableCapacityHours, 0);
    const fullyBooked = employees.filter((e: any) => e.trueUtilizationRate >= 100).length;
    const underutilized = employees.filter((e: any) => e.trueUtilizationRate < 50).length;
    return { avgUtilization, totalAvailable, fullyBooked, underutilized };
  }, [employees]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Summary Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <Box sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "primary.main", mb: 0.5 }}>
            <TrendingUpIcon sx={{ height: 16, width: 16 }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>Average utilization</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "primary.dark" }}>
            {stats.avgUtilization.toFixed(0)}%
          </Typography>
        </Box>
        <Box sx={{ bgcolor: (theme) => alpha(theme.palette.success.main, 0.08), borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "success.main", mb: 0.5 }}>
            <AccessTimeIcon sx={{ height: 16, width: 16 }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>Available capacity</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "success.dark" }}>
            {fmtHD(stats.totalAvailable)}/j
          </Typography>
        </Box>
        <Box sx={{ bgcolor: (theme) => alpha(theme.palette.success.main, 0.06), borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "success.main", mb: 0.5 }}>
            <WorkIcon sx={{ height: 16, width: 16 }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>Fully booked (100%+)</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "success.dark" }}>
            {stats.fullyBooked}
          </Typography>
        </Box>
        <Box sx={{ bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08), borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "warning.dark", mb: 0.5 }}>
            <AccessTimeIcon sx={{ height: 16, width: 16 }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>Underutilized (&lt;50%)</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "warning.dark" }}>
            {stats.underutilized}
          </Typography>
        </Box>
      </Box>

      {/* Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: "background.default",
                  borderBottom: (theme) => dividerBorder(theme, "default"),
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <TableCell sx={{ px: 2, py: 1.5, width: 40 }}>
                  <Checkbox
                    checked={selectedEmployees.size === employees.length && employees.length > 0}
                    onChange={handleSelectAll}
                    size="small"
                    sx={{ "& .MuiSvgIcon-root": { fontSize: 16 } }}
                  />
                </TableCell>
                <SortableHeader label="Collaborateur" sortKey="name" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Rôle" sortKey="grade" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Pôle" sortKey="subTeam" currentSort={sort} onSort={handleSort} />
                <TableCell
                  sx={{
                    px: 2,
                    py: 1.5,
                    textAlign: "left",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Status
                </TableCell>
                <SortableHeader label="Utilization" sortKey="utilization" currentSort={sort} onSort={handleSort} />
                <SortableHeader
                  label="Available"
                  sortKey="available"
                  currentSort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Projects"
                  sortKey="projects"
                  currentSort={sort}
                  onSort={handleSort}
                  align="center"
                />
                <SortableHeader
                  label="Assignments"
                  sortKey="assignments"
                  currentSort={sort}
                  onSort={handleSort}
                  align="center"
                />
                <SortableHeader
                  label="Chargeable hrs"
                  sortKey="hours"
                  currentSort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <TableCell
                  sx={{
                    px: 2,
                    py: 1.5,
                    textAlign: "right",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedEmployees.map((employee) => (
                <EmployeeTableRow
                  key={employee.empId}
                  employee={employee}
                  onView={onViewEmployee}
                  onAssign={onAssignEmployee}
                  isSelected={selectedEmployees.has(employee.empId)}
                  onSelect={handleSelect}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {selectedEmployees.size > 0 && (
          <Box
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              px: 2,
              py: 1.5,
              borderTop: (theme) => dividerBorder(theme, "default"),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontSize: "0.875rem", color: "primary.dark" }}>
              {selectedEmployees.size} employee(s) selected
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button variant="outlined" size="small" sx={{ textTransform: "none" }}>
                Export
              </Button>
              <Button variant="contained" size="small" sx={{ textTransform: "none" }}>
                Bulk assign
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
});

EmployeeTableView.displayName = "EmployeeTableView";
