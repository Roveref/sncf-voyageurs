import { memo, useRef } from "react";
import Box from "@mui/material/Box";
interface MobileHeatmapStripProps {
  cells: any[];
  timelineStart: Date;
  timelineEnd: Date;
  empId: string;
  onCellClick?: (dateStr: string) => void;
}

/** Map a cell to its dominant category colour */
const getCellColor = (cell: any): string => {
  if (cell.isInactive) return "#E5E7EB"; // grey
  if (cell.isWeekend || cell.isHoliday) return "#F3F4F6"; // light grey

  const segments = cell.segments || [];
  if (segments.length === 0) return "#F3F4F6";

  // Find dominant segment
  let maxU = 0;
  let dominant: any = null;
  for (const seg of segments) {
    const u = seg.utilization ?? 0;
    if (u > maxU) {
      maxU = u;
      dominant = seg;
    }
  }

  if (!dominant) return "#F3F4F6";
  if (dominant.isChargeable || dominant.category === "Chargeable") return "#3B82F6"; // blue
  if (dominant.category === "Training") return "#10B981"; // green
  if (dominant.category === "Absence") return "#EF4444"; // red
  if (dominant.category === "GO" || dominant.category === "General Overhead") return "#9CA3AF"; // grey
  return "#60A5FA"; // fallback blue
};

/** Opacity based on utilization intensity */
const getCellOpacity = (cell: any): number => {
  if (cell.isInactive || cell.isWeekend || cell.isHoliday) return 1;
  const segments = cell.segments || [];
  let total = 0;
  for (const seg of segments) total += seg.utilization ?? 0;
  if (total >= 1) return 1;
  if (total >= 0.5) return 0.7;
  if (total > 0) return 0.4;
  return 0.15;
};

const CELL_SIZE = 36; // min touch target

const MobileHeatmapStrip = memo(
  ({ cells, timelineStart, timelineEnd, empId, onCellClick }: MobileHeatmapStripProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
      <Box
        ref={scrollRef}
        sx={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          px: 0.5,
          pb: 0.5,
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(0,0,0,0.15)", borderRadius: 2 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: "2px",
            minWidth: cells.length * (CELL_SIZE + 2),
          }}
        >
          {cells.map((cell, i) => {
            const color = getCellColor(cell);
            const opacity = getCellOpacity(cell);
            const dateStr = cell.dateStr ?? "";
            const isMonday = new Date(dateStr).getDay() === 1;

            return (
              <Box
                key={i}
                onClick={onCellClick ? () => onCellClick(dateStr) : undefined}
                sx={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 0.75,
                  bgcolor: color,
                  opacity,
                  flexShrink: 0,
                  cursor: onCellClick ? "pointer" : "default",
                  borderLeft: isMonday ? "2px solid" : "none",
                  borderLeftColor: "rgba(0,0,0,0.1)",
                  "&:active": onCellClick ? { transform: "scale(0.9)" } : undefined,
                }}
              />
            );
          })}
        </Box>
      </Box>
    );
  }
);
MobileHeatmapStrip.displayName = "MobileHeatmapStrip";

export default MobileHeatmapStrip;
