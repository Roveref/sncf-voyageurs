import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { UtilizationBar, getUtilizationLevel } from "./UtilizationBadge";
import { CATEGORY_COLORS, CATEGORY_LABELS, MS_PER_DAY } from "../../constants";
import { easing } from "../../../../styles/animations";

/**
 * Get days in a month
 */
export const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Get first day of month (0 = Monday, 6 = Sunday)
 */
export const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

/**
 * Check if a date is a weekend
 */
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Get ISO week number
 */
const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
};

/**
 * Calculate daily utilization for a date
 */
const calculateDayUtilization = (date: Date, assignments: any[]) => {
  if (!date || !assignments) return 0;

  const dayAssignments = assignments.filter((a: any) => {
    const start = new Date(a.startDate);
    const end = new Date(a.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  return dayAssignments.reduce((sum: number, a: any) => sum + a.utilization, 0);
};

/**
 * Calendar day cell
 */
export const CalendarDay = memo(({ date, assignments, isCurrentMonth, isToday, onClick }: any) => {
  const dayAssignments = useMemo(() => {
    if (!date || !assignments) return [];

    return assignments.filter((a: any) => {
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  }, [date, assignments]);

  const totalUtilization = dayAssignments.reduce((sum: number, a: any) => sum + a.utilization, 0);
  const { barColor } = getUtilizationLevel(totalUtilization);

  const isWeekendDay = date && isWeekend(date);

  return (
    <Box
      onClick={() => onClick?.(date, dayAssignments)}
      sx={{
        minHeight: 80,
        p: 0.5,
        borderBottom: "1px solid",
        borderRight: "1px solid",
        borderColor: "#f3f4f6",
        cursor: "pointer",
        transition: `background-color 0.3s ${easing.elegant}`,
        "&:hover": { bgcolor: "background.default" },
        ...(!isCurrentMonth ? { bgcolor: "rgba(249,250,251,0.5)" } : {}),
        ...(isWeekendDay ? { bgcolor: "background.default" } : {}),
        ...(isToday ? { outline: "2px solid #3b82f6", outlineOffset: "-2px" } : {}),
      }}
    >
      {date && (
        <>
          <Typography
            component="span"
            sx={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 500,
              mb: 0.5,
              color: !isCurrentMonth
                ? "text.disabled"
                : isToday
                  ? "primary.main"
                  : isWeekendDay
                    ? "text.disabled"
                    : "text.secondary",
            }}
          >
            {date.getDate()}
          </Typography>

          {dayAssignments.length > 0 && isCurrentMonth && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              {dayAssignments.slice(0, 3).map((assignment: any, idx: number) => {
                const color = CATEGORY_COLORS[assignment.category] || CATEGORY_COLORS.OTHER;
                return (
                  <Box
                    key={idx}
                    sx={{
                      fontSize: "0.75rem",
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      bgcolor: color.bg,
                      color: color.text,
                    }}
                    title={`${assignment.jobName} (${assignment.utilization}%)`}
                  >
                    {assignment.jobName}
                  </Box>
                );
              })}
              {dayAssignments.length > 3 && (
                <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary", px: 0.5 }}>
                  +{dayAssignments.length - 3} others
                </Typography>
              )}
            </Box>
          )}

          {/* Utilization indicator */}
          {dayAssignments.length > 0 && isCurrentMonth && (
            <Box
              sx={{
                mt: 0.5,
                height: 4,
                borderRadius: 1,
              }}
              style={{ backgroundColor: barColor, width: `${Math.min(totalUtilization, 100)}%` }}
            />
          )}
        </>
      )}
    </Box>
  );
});

CalendarDay.displayName = "CalendarDay";

/**
 * Day detail popup
 */
export const DayDetailPopup = memo(({ date, assignments, onClose }: any) => {
  if (!date || assignments.length === 0) return null;

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const totalUtilization = assignments.reduce((sum: number, a: any) => sum + a.utilization, 0);

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.2)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
      onClick={onClose}
    >
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 2,
          boxShadow: 24,
          maxWidth: "28rem",
          width: "100%",
          p: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography
            variant="h6"
            component="h4"
            sx={{ fontWeight: 600, color: "text.primary", textTransform: "capitalize" }}
          >
            {formatDate(date)}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ p: 0.5, "&:hover": { bgcolor: "#f3f4f6" } }}>
            <CloseIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          </IconButton>
        </Box>

        <Box sx={{ mb: 2, p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
              Total utilization
            </Typography>
            <Typography
              component="span"
              sx={{
                fontWeight: 700,
                color: totalUtilization > 100 ? "#ef4444" : "#111827",
              }}
            >
              {totalUtilization}%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {assignments.map((assignment: any, idx: number) => {
            const color = CATEGORY_COLORS[assignment.category] || CATEGORY_COLORS.OTHER;
            return (
              <Box
                key={idx}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderLeft: "4px solid",
                  borderLeftColor: color.border,
                  bgcolor: "background.default",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
                    {assignment.jobName}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}>
                    {assignment.utilization}%
                  </Typography>
                </Box>
                <Typography
                  component="span"
                  sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.5, display: "block" }}
                >
                  {CATEGORY_LABELS[assignment.category]} - Job: {assignment.jobNo}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
});

DayDetailPopup.displayName = "DayDetailPopup";

/**
 * Legend item
 */
export const LegendItem = memo(({ color, label }: any) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: color.bg }} />
    <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
      {label}
    </Typography>
  </Box>
));

LegendItem.displayName = "LegendItem";

/**
 * Weekly utilization header
 */
export const WeeklyUtilizationHeader = memo(({ weekDays, assignments }: any) => {
  const weeklyStats = useMemo(() => {
    const workingDays = weekDays.filter((dayInfo: any) => {
      if (!dayInfo.date) return false;
      const dayOfWeek = dayInfo.date.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

    if (workingDays.length === 0) return { avg: 0, total: 0, days: 0 };

    const utilizations = workingDays.map((dayInfo: any) => calculateDayUtilization(dayInfo.date, assignments));

    const total = utilizations.reduce((sum: number, u: number) => sum + u, 0);
    const avg = total / workingDays.length;

    return { avg, total, days: workingDays.length };
  }, [weekDays, assignments]);

  const { textColor } = getUtilizationLevel(weeklyStats.avg);

  const firstDay = weekDays.find((d: any) => d.date);
  const weekNum = firstDay ? getWeekNumber(firstDay.date) : "";

  return (
    <Box
      sx={{
        bgcolor: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        px: 1.5,
        py: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: "primary.main", width: 48 }}>
          S{weekNum}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <UtilizationBar rate={weeklyStats.avg} height="h-2" style={{ width: 80 }} />
          <Typography
            component="span"
            sx={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: textColor,
              minWidth: "3rem",
            }}
          >
            {weeklyStats.avg.toFixed(0)}%
          </Typography>
        </Box>
      </Box>
      <Typography component="span" sx={{ fontSize: "0.75rem", color: "#3b82f6" }}>
        {weeklyStats.days} working day{weeklyStats.days > 1 ? "s" : ""}
      </Typography>
    </Box>
  );
});

WeeklyUtilizationHeader.displayName = "WeeklyUtilizationHeader";
