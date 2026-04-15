import React, { useState, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { xPosToDate } from "./TUTrendData";

/**
 * SVG overlay rendered via Recharts <Customized> that draws drag handles
 * on the left/right edges of the highlight area.
 */
const HighlightHandles = ({
  xAxisMap,
  yAxisMap,
  offset,
  selStartXPos,
  selEndXPos,
  chartPoints,
  timelineStart,
  timelineEnd,
  onDateRangeChange,
}: any) => {
  const theme = useTheme();
  const [hovered, setHovered] = useState<"left" | "right" | null>(null);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const rafRef = useRef<number | null>(null);

  if (selStartXPos == null || selEndXPos == null || !onDateRangeChange) return null;

  const xAxis = xAxisMap && (Object.values(xAxisMap)[0] as any);
  const yAxis = yAxisMap && (Object.values(yAxisMap)[0] as any);
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const leftPx = xAxis.scale(selStartXPos);
  const rightPx = xAxis.scale(selEndXPos);
  const chartTop = offset?.top ?? 0;
  const chartHeight = yAxis.height ?? 200;

  if (typeof leftPx !== "number" || typeof rightPx !== "number" || isNaN(leftPx) || isNaN(rightPx)) return null;

  const handleW = 3;
  const hitW = 12;
  const gripW = 8;
  const gripH = 20;
  const handleColor = theme.palette.text.secondary;

  const startDrag = (edge: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = edge;

    const onMove = (me: MouseEvent) => {
      if (!draggingRef.current) return;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const svg = (me.target as Element)?.closest?.("svg");
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const mouseX = me.clientX - rect.left;
        const xVal = xAxis.scale.invert(mouseX);
        const dateStr = xPosToDate(xVal, chartPoints);
        if (!dateStr) return;

        const curStart =
          typeof timelineStart === "string"
            ? timelineStart
            : (() => {
                const d = new Date(timelineStart);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              })();
        const curEnd =
          typeof timelineEnd === "string"
            ? timelineEnd
            : (() => {
                const d = new Date(timelineEnd);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              })();

        if (draggingRef.current === "left" && dateStr < curEnd) {
          onDateRangeChange(dateStr, curEnd);
        } else if (draggingRef.current === "right" && dateStr > curStart) {
          onDateRangeChange(curStart, dateStr);
        }
      });
    };

    const onUp = () => {
      draggingRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const renderHandle = (px: number, edge: "left" | "right") => {
    const isHov = hovered === edge || draggingRef.current === edge;
    const hitX = px - hitW / 2;
    const handleX = px - handleW / 2;
    const gripX = px - gripW / 2;
    const gripY = chartTop + chartHeight / 2 - gripH / 2;

    return (
      <g key={edge}>
        {/* Invisible hit area */}
        <rect
          x={hitX}
          y={chartTop}
          width={hitW}
          height={chartHeight}
          fill="transparent"
          style={{ cursor: "col-resize" }}
          onMouseEnter={() => setHovered(edge)}
          onMouseLeave={() => {
            if (!draggingRef.current) setHovered(null);
          }}
          onMouseDown={startDrag(edge)}
        />
        {/* Visible handle line */}
        <rect
          x={handleX}
          y={chartTop}
          width={handleW}
          height={chartHeight}
          fill={handleColor}
          fillOpacity={isHov ? 0.5 : 0}
          rx={1.5}
          style={{ pointerEvents: "none", transition: "fill-opacity 0.15s" }}
        />
        {/* Grip indicator */}
        <rect
          x={gripX}
          y={gripY}
          width={gripW}
          height={gripH}
          fill={handleColor}
          fillOpacity={isHov ? 0.45 : 0}
          rx={3}
          style={{ pointerEvents: "none", transition: "fill-opacity 0.15s" }}
        />
        {/* Grip lines */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={gripX + 2}
            x2={gripX + gripW - 2}
            y1={gripY + 5 + i * 5}
            y2={gripY + 5 + i * 5}
            stroke={theme.palette.background.paper}
            strokeWidth={1}
            strokeOpacity={isHov ? 0.8 : 0}
            style={{ pointerEvents: "none", transition: "stroke-opacity 0.15s" }}
          />
        ))}
      </g>
    );
  };

  return (
    <g className="highlight-handles">
      {renderHandle(leftPx, "left")}
      {renderHandle(rightPx, "right")}
    </g>
  );
};

export { HighlightHandles };
