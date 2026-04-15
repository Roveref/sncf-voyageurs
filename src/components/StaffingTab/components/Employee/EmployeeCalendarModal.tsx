import React, { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { EmployeeAvatar, StatusBadge } from "./UtilizationBadge";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../constants";
import { easing } from "../../../../styles/animations";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  CalendarDay,
  DayDetailPopup,
  LegendItem,
  WeeklyUtilizationHeader,
} from "./CalendarComponents";

/**
 * Employee Calendar Modal - monthly calendar view of assignments
 */
export const EmployeeCalendarModal = memo(({ isOpen, onClose, employee }: any) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<any[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate calendar grid - must be before early return to respect Rules of Hooks
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: any[] = [];

    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.getTime() === today.getTime();
      days.push({ date, isCurrentMonth: true, isToday });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Group calendar days into weeks
  const weeks = useMemo(() => {
    const result: any[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Early return AFTER all hooks
  if (!isOpen || !employee) return null;

  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date, assignments: any[]) => {
    if (assignments.length > 0) {
      setSelectedDay(date);
      setSelectedAssignments(assignments);
    }
  };

  const closeDayDetail = () => {
    setSelectedDay(null);
    setSelectedAssignments([]);
  };

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
          bgcolor: "white",
          borderRadius: 3,
          boxShadow: 24,
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
            p: 2,
            borderBottom: "1px solid",
            borderColor: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <EmployeeAvatar name={employee.name} empId={employee.empId} size="md" />
            <Box>
              <Typography
                variant="h6"
                component="h2"
                sx={{ fontSize: "1.125rem", fontWeight: 600, color: "text.primary" }}
              >
                {employee.name}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <StatusBadge rate={employee.trueUtilizationRate} size="sm" />
              </Box>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              p: 1,
              "&:hover": { bgcolor: "#f3f4f6" },
              borderRadius: 2,
              transition: `background-color 0.3s ${easing.elegant}`,
            }}
          >
            <CloseIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          </IconButton>
        </Box>

        {/* Calendar controls */}
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid",
            borderColor: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              onClick={handlePrevMonth}
              sx={{
                p: 1,
                "&:hover": { bgcolor: "#f3f4f6" },
                borderRadius: 2,
                transition: `background-color 0.3s ${easing.elegant}`,
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            </IconButton>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "text.primary",
                textTransform: "capitalize",
                minWidth: 180,
                textAlign: "center",
              }}
            >
              {monthName}
            </Typography>
            <IconButton
              onClick={handleNextMonth}
              sx={{
                p: 1,
                "&:hover": { bgcolor: "#f3f4f6" },
                borderRadius: 2,
                transition: `background-color 0.3s ${easing.elegant}`,
              }}
            >
              <ChevronRightIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            </IconButton>
          </Box>
          <Button
            onClick={handleToday}
            sx={{
              px: 1.5,
              py: 0.75,
              fontSize: "0.875rem",
              bgcolor: "#dbeafe",
              color: "#1d4ed8",
              borderRadius: 2,
              textTransform: "none",
              "&:hover": { bgcolor: "#bfdbfe" },
              transition: `background-color 0.3s ${easing.elegant}`,
            }}
          >
            Today
          </Button>
        </Box>

        {/* Legend */}
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
            <LegendItem key={key} color={color} label={CATEGORY_LABELS[key] || key} />
          ))}
        </Box>

        {/* Calendar grid */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2 }}>
          {/* Week day headers */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              position: "sticky",
              top: 0,
              bgcolor: "white",
              zIndex: 10,
            }}
          >
            {weekDayLabels.map((day, idx) => (
              <Box
                key={day}
                sx={{
                  p: 1,
                  textAlign: "center",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderBottom: "1px solid",
                  borderColor: "#e5e7eb",
                  color: idx >= 5 ? "text.disabled" : "text.secondary",
                }}
              >
                {day}
              </Box>
            ))}
          </Box>

          {/* Calendar weeks with utilization headers */}
          {weeks.map((week, weekIdx) => (
            <Box key={weekIdx}>
              {/* Weekly utilization header */}
              <WeeklyUtilizationHeader weekDays={week} assignments={employee.assignments} />
              {/* Week days */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {week.map((dayInfo, dayIdx) => (
                  <CalendarDay
                    key={`${weekIdx}-${dayIdx}`}
                    date={dayInfo.date}
                    assignments={employee.assignments}
                    isCurrentMonth={dayInfo.isCurrentMonth}
                    isToday={dayInfo.isToday}
                    onClick={handleDayClick}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "#e5e7eb",
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            <CalendarTodayIcon sx={{ fontSize: 16, display: "inline", mr: 1 }} />
            {employee.assignments.length} assignment{employee.assignments.length !== 1 ? "s" : ""} total
          </Typography>
          <Button
            onClick={onClose}
            sx={{
              px: 2,
              py: 1,
              bgcolor: "#e5e7eb",
              color: "text.secondary",
              borderRadius: 2,
              textTransform: "none",
              "&:hover": { bgcolor: "#d1d5db" },
              transition: `background-color 0.3s ${easing.elegant}`,
            }}
          >
            Close
          </Button>
        </Box>
      </Box>

      {/* Day detail popup */}
      {selectedDay && <DayDetailPopup date={selectedDay} assignments={selectedAssignments} onClose={closeDayDetail} />}
    </Box>
  );
});

EmployeeCalendarModal.displayName = "EmployeeCalendarModal";
