import React, { memo, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import { getCategoryBarColor, getCategoryLabel, isChargeableCategory } from "../../utils/categoryUtils";
import { calculateBarPosition } from "../../utils/timelineUtils";
import { MS_PER_DAY } from "../../constants";
import { formatLocalDate } from "../../utils/dateUtils";
import { easing } from "../../../../styles/animations";

/**
 * Shared drag-and-drop logic (extracted to avoid duplication).
 */
const useDrag = ({
  draggable,
  left,
  width,
  timelineStart,
  timelineEnd,
  period,
  empId,
  jobNo,
  jobName,
  onDragEnd,
  barRef,
}: any) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const initialLeft = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable || !barRef.current) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      initialLeft.current = left;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!barRef.current?.parentElement) return;
        const parentWidth = barRef.current.parentElement.offsetWidth;
        const deltaX = moveEvent.clientX - dragStartX.current;
        const deltaPercent = (deltaX / parentWidth) * 100;
        const newLeft = Math.max(0, Math.min(100 - width, initialLeft.current + deltaPercent));
        barRef.current.style.left = `calc(${newLeft}% - 4px)`;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        if (barRef.current?.parentElement && onDragEnd) {
          const parentWidth = barRef.current.parentElement.offsetWidth;
          const deltaX = upEvent.clientX - dragStartX.current;
          const deltaPercent = (deltaX / parentWidth) * 100;
          const totalDays = Math.round((timelineEnd - timelineStart) / MS_PER_DAY);
          const daysMoved = Math.round((deltaPercent / 100) * totalDays);
          if (daysMoved !== 0) {
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            startDate.setDate(startDate.getDate() + daysMoved);
            endDate.setDate(endDate.getDate() + daysMoved);
            onDragEnd({
              empId,
              jobNo,
              jobName,
              oldStartDate: period.startDate,
              newStartDate: formatLocalDate(startDate),
              newEndDate: formatLocalDate(endDate),
            });
          }
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [draggable, left, width, timelineStart, timelineEnd, period, empId, jobNo, jobName, onDragEnd, barRef]
  );

  return { isDragging, handleMouseDown };
};

/**
 * Single assignment bar – expanded view.
 * Min visual width 4px so short periods remain visible.
 * Shows job name on wider bars, % on medium bars, tooltip on all.
 */
export const AssignmentBar = memo(
  ({
    period,
    category,
    jobName,
    jobNo,
    empId,
    timelineStart,
    timelineEnd,
    showUtilization,
    zIndex = 1,
    onEdit,
    onDragEnd,
    draggable = false,
  }: any) => {
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
    const isHovered = hoverPos !== null;
    const barRef = useRef(null);

    const { left, width } = calculateBarPosition(period.startDate, period.endDate, timelineStart, timelineEnd);
    const barColor = getCategoryBarColor(category, period.utilization);
    const isProvisional = period.status === "P";

    const { isDragging, handleMouseDown } = useDrag({
      draggable,
      left,
      width,
      timelineStart,
      timelineEnd,
      period,
      empId,
      jobNo,
      jobName,
      onDragEnd,
      barRef,
    });

    const handleClick = useCallback(() => {
      if (isDragging) return;
      if (onEdit) {
        onEdit({
          empId,
          jobNo,
          jobName,
          startDate: period.startDate instanceof Date ? formatLocalDate(period.startDate) : period.startDate,
          endDate: period.endDate instanceof Date ? formatLocalDate(period.endDate) : period.endDate,
          utilization: period.utilization,
          status: period.status,
          category,
        });
      }
    }, [isDragging, onEdit, empId, jobNo, jobName, period, category]);

    return (
      <Box
        ref={barRef}
        sx={{
          position: "absolute",
          height: 32,
          borderRadius: 1,
          fontSize: "0.75rem",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          cursor: draggable ? "move" : onEdit ? "pointer" : "default",
          boxShadow: isDragging ? 3 : "none",
          outline: isDragging ? "2px solid #60a5fa" : "none",
          transition: `box-shadow 0.3s ${easing.elegant}`,
          left: `calc(${left}% - 4px)`,
          width: `calc(${width}% - 1px)`,
          minWidth: "4px",
          opacity: isProvisional ? 0.7 : 0.9,
          zIndex: isDragging ? 100 : zIndex,
          backgroundColor: barColor,
        }}
        onMouseDown={draggable ? handleMouseDown : undefined}
        onClick={handleClick}
        onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoverPos(null)}
      >
        {draggable && <DragIndicatorIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.5, flexShrink: 0 }} />}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {width > 12 && showUtilization && (
            <Typography
              component="span"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 0.5, fontSize: "0.75rem" }}
            >
              {jobName}
            </Typography>
          )}
          {width > 6 && width <= 12 && showUtilization && (
            <Typography
              component="span"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 0.25, fontSize: "0.75rem" }}
            >
              {period.utilization.toFixed(0)}%
            </Typography>
          )}
        </Box>
        {onEdit && isHovered && width > 5 && <EditIcon sx={{ fontSize: 12, mr: 0.5, opacity: 0.7, flexShrink: 0 }} />}
      </Box>
    );
  }
);

AssignmentBar.displayName = "AssignmentBar";

/**
 * Collapsed view assignment bar (shows job name).
 * Uses the same shared drag logic and rich tooltip.
 */
export const CollapsedAssignmentBar = memo(
  ({
    period,
    category,
    jobName,
    jobNo,
    empId,
    timelineStart,
    timelineEnd,
    zIndex = 1,
    onEdit,
    onDragEnd,
    draggable = false,
  }: any) => {
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
    const isHovered = hoverPos !== null;
    const barRef = useRef(null);

    const { left, width } = calculateBarPosition(period.startDate, period.endDate, timelineStart, timelineEnd);
    const barColor = getCategoryBarColor(category, period.utilization);
    const isProvisional = period.status === "P";

    const { isDragging, handleMouseDown } = useDrag({
      draggable,
      left,
      width,
      timelineStart,
      timelineEnd,
      period,
      empId,
      jobNo,
      jobName,
      onDragEnd,
      barRef,
    });

    const handleClick = useCallback(() => {
      if (isDragging) return;
      if (onEdit) {
        onEdit({
          empId,
          jobNo,
          jobName,
          startDate: period.startDate instanceof Date ? formatLocalDate(period.startDate) : period.startDate,
          endDate: period.endDate instanceof Date ? formatLocalDate(period.endDate) : period.endDate,
          utilization: period.utilization,
          status: period.status,
          category,
        });
      }
    }, [isDragging, onEdit, empId, jobNo, jobName, period, category]);

    return (
      <Box
        ref={barRef}
        sx={{
          position: "absolute",
          height: 32,
          borderRadius: 1,
          fontSize: "0.75rem",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          cursor: draggable ? "move" : onEdit ? "pointer" : "default",
          boxShadow: isDragging ? 3 : "none",
          outline: isDragging ? "2px solid #60a5fa" : "none",
          left: `calc(${left}% - 4px)`,
          width: `calc(${width}% - 1px)`,
          minWidth: "4px",
          opacity: isProvisional ? 0.7 : 0.9,
          zIndex: isDragging ? 100 : zIndex,
          backgroundColor: barColor,
        }}
        onMouseDown={draggable ? handleMouseDown : undefined}
        onClick={handleClick}
        onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoverPos(null)}
      >
        {draggable && <DragIndicatorIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.5, flexShrink: 0 }} />}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {width > 8 && (
            <Typography
              component="span"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 0.5 }}
            >
              {jobName}
            </Typography>
          )}
        </Box>
        {onEdit && isHovered && width > 5 && <EditIcon sx={{ fontSize: 12, mr: 0.5, opacity: 0.7, flexShrink: 0 }} />}
      </Box>
    );
  }
);

CollapsedAssignmentBar.displayName = "CollapsedAssignmentBar";

/**
 * Render multiple assignment bars for a consolidated job
 */
export const JobAssignmentBars = memo(
  ({
    consolidatedJob,
    empId,
    timelineStart,
    timelineEnd,
    showUtilization,
    baseZIndex = 4,
    onEdit,
    onDragEnd,
    draggable = false,
  }: any) => (
    <>
      {consolidatedJob.periods.map((period: any, periodIdx: number) => (
        <AssignmentBar
          key={periodIdx}
          period={period}
          category={consolidatedJob.category}
          jobName={consolidatedJob.jobName}
          jobNo={consolidatedJob.jobNo}
          empId={empId}
          timelineStart={timelineStart}
          timelineEnd={timelineEnd}
          showUtilization={showUtilization}
          zIndex={baseZIndex + periodIdx}
          onEdit={onEdit}
          onDragEnd={onDragEnd}
          draggable={draggable}
        />
      ))}
    </>
  )
);

JobAssignmentBars.displayName = "JobAssignmentBars";
