import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import WorkIcon from "@mui/icons-material/Work";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import WarningIcon from "@mui/icons-material/Warning";
import { EmployeeAvatar, StatusBadge, UtilizationBar } from "./UtilizationBadge";
import { JOB_CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, MS_PER_DAY } from "../../constants";
import { fmtHD } from "../../constants/theme";
import { easing } from "../../../../styles/animations";

/**
 * Assignment card in the planning view
 */
const AssignmentCard = memo(({ assignment }: any) => {
  const categoryColor = CATEGORY_COLORS[assignment.category] || CATEGORY_COLORS.OTHER;
  const startDate = new Date(assignment.startDate);
  const endDate = new Date(assignment.endDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const daysRemaining = Math.ceil((endDate.getTime() - new Date().getTime()) / MS_PER_DAY);
  const isEnding = daysRemaining > 0 && daysRemaining <= 14;
  const isEnded = daysRemaining < 0;

  return (
    <Box
      sx={{
        borderLeft: "4px solid",
        borderLeftColor: categoryColor.border,
        bgcolor: "#fff",
        borderRadius: 2,
        boxShadow: 1,
        p: 2,
        "&:hover": { boxShadow: 3 },
        transition: `box-shadow 0.3s ${easing.elegant}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontWeight: 500, color: "text.primary" }}>{assignment.jobName}</Typography>
            {assignment.status === "P" && (
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: "0.75rem",
                  bgcolor: "#ffedd5",
                  color: "#c2410c",
                  borderRadius: 1,
                }}
              >
                Provisional
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", mt: 0.5 }}>
            Job: {assignment.jobNo}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: "0.75rem",
            fontWeight: 500,
            bgcolor: categoryColor.bg,
            color: categoryColor.text,
          }}
        >
          {CATEGORY_LABELS[assignment.category] || "Other"}
        </Box>
      </Box>

      <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2, fontSize: "0.875rem" }}>
        <Box>
          <Box component="span" sx={{ color: "text.secondary" }}>
            Period
          </Box>
          <Typography sx={{ fontWeight: 500, color: "text.primary" }}>
            {formatDate(startDate)} - {formatDate(endDate)}
          </Typography>
        </Box>
        <Box>
          <Box component="span" sx={{ color: "text.secondary" }}>
            Utilization
          </Box>
          <Typography sx={{ fontWeight: 500, color: "text.primary" }}>{assignment.utilization}%</Typography>
        </Box>
      </Box>

      {isEnding && !isEnded && (
        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "#d97706",
            bgcolor: "#fffbeb",
            px: 1.5,
            py: 1,
            borderRadius: 1,
          }}
        >
          <WarningIcon sx={{ fontSize: 16 }} />
          <Box component="span" sx={{ fontSize: "0.875rem" }}>
            Ends in {daysRemaining} day{daysRemaining > 1 ? "s" : ""}
          </Box>
        </Box>
      )}
      {isEnded && (
        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "text.secondary",
            bgcolor: "background.default",
            px: 1.5,
            py: 1,
            borderRadius: 1,
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 16 }} />
          <Box component="span" sx={{ fontSize: "0.875rem" }}>
            Ended
          </Box>
        </Box>
      )}
    </Box>
  );
});

AssignmentCard.displayName = "AssignmentCard";

/**
 * Stats card
 */
const StatCard = memo(({ icon: Icon, label, value, subValue, colorClass }: any) => (
  <Box sx={{ bgcolor: "background.default", borderRadius: 2, p: 2 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: colorClass, mb: 0.5 }}>
      <Icon sx={{ fontSize: 16 }} />
      <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
        {label}
      </Box>
    </Box>
    <Box sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}>{value}</Box>
    {subValue && <Box sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.5 }}>{subValue}</Box>}
  </Box>
));

StatCard.displayName = "StatCard";

/**
 * Employee Planning Modal - detailed view of an employee's assignments
 */
export const EmployeePlanningModal = memo(({ isOpen, onClose, employee }: any) => {
  const assignments = useMemo(() => employee?.assignments || [], [employee?.assignments]);

  const groupedAssignments = useMemo(() => {
    if (assignments.length === 0) return { active: [], upcoming: [], past: [] };
    const now = new Date();
    const groups: { active: any[]; upcoming: any[]; past: any[] } = {
      active: [],
      upcoming: [],
      past: [],
    };

    assignments.forEach((assignment: any) => {
      const start = new Date(assignment.startDate);
      const end = new Date(assignment.endDate);

      if (end < now) {
        groups.past.push(assignment);
      } else if (start > now) {
        groups.upcoming.push(assignment);
      } else {
        groups.active.push(assignment);
      }
    });

    // Sort each group
    groups.active.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    groups.upcoming.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    groups.past.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    return groups;
  }, [assignments]);

  const stats = useMemo(() => {
    const chargeableAssignments = assignments.filter((a: any) => a.category === JOB_CATEGORIES.CHARGEABLE);
    const activeChargeable = groupedAssignments.active.filter((a) => a.category === JOB_CATEGORIES.CHARGEABLE);

    return {
      totalAssignments: assignments.length,
      activeAssignments: groupedAssignments.active.length,
      chargeableProjects: chargeableAssignments.length,
      activeChargeableProjects: activeChargeable.length,
    };
  }, [assignments, groupedAssignments]);

  if (!isOpen || !employee) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 1, sm: 2 },
      }}
    >
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: 3,
          boxShadow: 6,
          maxWidth: "56rem",
          width: "100%",
          maxHeight: "95vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: 1,
            borderColor: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(to right, #eff6ff, #eef2ff)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <EmployeeAvatar name={employee.name} empId={employee.empId} size="lg" />
            <Box>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 600, color: "text.primary" }}>
                {employee.name}
              </Typography>
              <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>ID: {employee.empId}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
                <StatusBadge rate={employee.trueUtilizationRate} size="sm" />
                <Box component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {employee.availableCapacityHours.toFixed(1)}h ({(employee.availableCapacityHours / 8).toFixed(2)}d)
                  available/day
                </Box>
              </Box>
            </Box>
          </Box>
          <Button
            onClick={onClose}
            sx={{
              p: 1,
              minWidth: "auto",
              "&:hover": { bgcolor: "rgba(255,255,255,0.5)" },
              borderRadius: 2,
              transition: `background-color 0.3s ${easing.elegant}`,
            }}
          >
            <CloseIcon sx={{ fontSize: 24, color: "text.secondary" }} />
          </Button>
        </Box>

        {/* Stats */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: "#f3f4f6" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <StatCard
              icon={TrendingUpIcon}
              label="Utilization"
              value={`${employee.trueUtilizationRate.toFixed(0)}%`}
              colorClass="primary.main"
            />
            <StatCard
              icon={WorkIcon}
              label="Active assignments"
              value={stats.activeAssignments}
              subValue={`${stats.activeChargeableProjects} billable`}
              colorClass="#16a34a"
            />
            <StatCard
              icon={CalendarTodayIcon}
              label="Total assignments"
              value={stats.totalAssignments}
              subValue={`${stats.chargeableProjects} billable`}
              colorClass="#9333ea"
            />
            <StatCard
              icon={AccessTimeIcon}
              label="Chargeable hours"
              value={fmtHD(employee.chargeableHours)}
              colorClass="#4f46e5"
            />
          </Box>
        </Box>

        {/* Utilization bar */}
        <Box sx={{ px: 3, py: 2, bgcolor: "background.default" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary", width: 96 }}>
              Utilization
            </Box>
            <Box sx={{ flex: 1 }}>
              <UtilizationBar rate={employee.trueUtilizationRate} height="h-3" />
            </Box>
            <Box
              component="span"
              sx={{ fontSize: "0.875rem", fontWeight: 700, color: "text.secondary", width: 64, textAlign: "right" }}
            >
              {employee.trueUtilizationRate.toFixed(0)}%
            </Box>
          </Box>
        </Box>

        {/* Assignments list */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3 }}>
          {/* Active assignments */}
          {groupedAssignments.active.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component="span" sx={{ width: 8, height: 8, bgcolor: "#10b981", borderRadius: "50%" }} />
                Active ({groupedAssignments.active.length})
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {groupedAssignments.active.map((assignment, idx) => (
                  <AssignmentCard key={`active-${idx}`} assignment={assignment} />
                ))}
              </Box>
            </Box>
          )}

          {/* Upcoming assignments */}
          {groupedAssignments.upcoming.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component="span" sx={{ width: 8, height: 8, bgcolor: "#3b82f6", borderRadius: "50%" }} />
                Upcoming ({groupedAssignments.upcoming.length})
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {groupedAssignments.upcoming.map((assignment, idx) => (
                  <AssignmentCard key={`upcoming-${idx}`} assignment={assignment} />
                ))}
              </Box>
            </Box>
          )}

          {/* Past assignments */}
          {groupedAssignments.past.length > 0 && (
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component="span" sx={{ width: 8, height: 8, bgcolor: "text.disabled", borderRadius: "50%" }} />
                Completed ({groupedAssignments.past.length})
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, opacity: 0.75 }}>
                {groupedAssignments.past.slice(0, 5).map((assignment, idx) => (
                  <AssignmentCard key={`past-${idx}`} assignment={assignment} />
                ))}
                {groupedAssignments.past.length > 5 && (
                  <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", textAlign: "center", py: 1 }}>
                    + {groupedAssignments.past.length - 5} more completed assignments
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {employee.assignments.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <CalendarTodayIcon sx={{ fontSize: 48, display: "block", mx: "auto", mb: 1.5, color: "#d1d5db" }} />
              <Typography>No assignments for this employee</Typography>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: "#e5e7eb",
            bgcolor: "background.default",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              px: 2,
              py: 1,
              bgcolor: "#e5e7eb",
              color: "text.secondary",
              borderRadius: 2,
              "&:hover": { bgcolor: "#d1d5db" },
              transition: `background-color 0.3s ${easing.elegant}`,
              textTransform: "none",
            }}
          >
            Close
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

EmployeePlanningModal.displayName = "EmployeePlanningModal";
