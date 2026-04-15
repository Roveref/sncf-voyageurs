import { memo } from "react";
import Dialog from "@mui/material/Dialog";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Slide from "@mui/material/Slide";
import CloseIcon from "@mui/icons-material/Close";
import { alpha } from "@mui/material/styles";
import React from "react";
import { TransitionProps } from "@mui/material/transitions";
import { getGradeColor, getGradeAbbr } from "../../constants";
import MobileHeatmapStrip from "./MobileHeatmapStrip";
import type { Employee } from "../../types";

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface EmployeeDetailSheetProps {
  employee: Employee;
  dailyGrid: Map<string, { cells: any[] }>;
  timelineStart: Date;
  timelineEnd: Date;
  enabledHolidayDates: Set<string>;
  heatmapMode: string;
  onClose: () => void;
  onPeriodClick?: (empId: string, startDate: string, endDate: string) => void;
}

const EmployeeDetailSheet = memo(
  ({
    employee,
    dailyGrid,
    timelineStart,
    timelineEnd,
    enabledHolidayDates,
    heatmapMode,
    onClose,
    onPeriodClick,
  }: EmployeeDetailSheetProps) => {
    const gradeColor = String(getGradeColor(employee.grade));
    const gradeAbbr = getGradeAbbr(employee.grade);
    const grid = dailyGrid.get(employee.empId);
    const cells = grid?.cells ?? [];

    // Compute employee TU
    let totalNet = 0;
    let totalCh = 0;
    for (const cell of cells) {
      if (cell.isInactive || cell.isWeekend || cell.isHoliday) continue;
      for (const seg of cell.segments || []) {
        totalNet += seg.utilization ?? 0;
        if (seg.isChargeable) totalCh += seg.utilization ?? 0;
      }
    }
    const tuRate = totalNet > 0 ? (totalCh / totalNet) * 100 : null;
    const tuColor = tuRate == null ? "#999" : tuRate >= 85 ? "#10B981" : tuRate >= 65 ? "#F59E0B" : "#EF4444";

    // Build assignments list from employee data
    const assignments = employee.assignments ?? [];

    return (
      <Dialog fullScreen open onClose={onClose} TransitionComponent={SlideUp}>
        {/* Header */}
        <AppBar position="sticky" elevation={1} sx={{ backgroundColor: "#330000", pt: "var(--safe-area-top)" }}>
          <Toolbar sx={{ height: 48, minHeight: "48px !important", gap: 1 }}>
            <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                bgcolor: alpha(gradeColor, 0.25),
                color: gradeColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.6rem",
                flexShrink: 0,
              }}
            >
              {gradeAbbr}
            </Box>
            <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700, color: "white" }} noWrap>
              {employee.name}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tuColor, fontSize: "1rem" }}>
              {tuRate != null ? `${Math.round(tuRate)}%` : "-"}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* Employee info */}
          <Box sx={{ px: 2, py: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {employee.grade && (
              <Chip
                label={employee.grade}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: alpha(gradeColor, 0.12),
                  color: gradeColor,
                  border: `1px solid ${alpha(gradeColor, 0.3)}`,
                }}
              />
            )}
            {employee.subTeam && (
              <Chip label={employee.subTeam} size="small" variant="outlined" sx={{ height: 24, fontSize: "0.7rem" }} />
            )}
            {employee.directManager && (
              <Chip
                label={`DM: ${employee.directManager}`}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: "0.7rem" }}
              />
            )}
          </Box>

          <Divider />

          {/* Heatmap */}
          <Box sx={{ px: 0.5, py: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1.5, mb: 0.5, display: "block", fontWeight: 600 }}
            >
              Timeline
            </Typography>
            <MobileHeatmapStrip
              cells={cells}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              empId={employee.empId}
              onCellClick={onPeriodClick ? (dateStr) => onPeriodClick(employee.empId, dateStr, dateStr) : undefined}
            />
          </Box>

          <Divider />

          {/* Assignments */}
          <Box sx={{ px: 1.5, py: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block", fontWeight: 600 }}>
              Assignments ({assignments.length})
            </Typography>
            {assignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                No assignments in this period
              </Typography>
            ) : (
              assignments.map((asg: any, i: number) => {
                const catColor =
                  asg.isChargeable || asg.category === "Chargeable"
                    ? "#3B82F6"
                    : asg.category === "Training"
                      ? "#10B981"
                      : asg.category === "Absence"
                        ? "#EF4444"
                        : "#9CA3AF";

                return (
                  <Box
                    key={`${asg.jobNo}-${asg.startDate}-${i}`}
                    sx={{
                      mb: 1,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: `3px solid ${catColor}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, mr: 1 }} noWrap>
                        {asg.jobName || asg.jobNo || "Unknown"}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} sx={{ color: catColor, flexShrink: 0 }}>
                        {Math.round(asg.utilization ?? 100)}%
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {asg.startDate} — {asg.endDate}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Dialog>
    );
  }
);
EmployeeDetailSheet.displayName = "EmployeeDetailSheet";

export default EmployeeDetailSheet;
