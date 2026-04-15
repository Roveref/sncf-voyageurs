/**
 * ChartExportCorner — Page-curl hover effect on top-right corner of chart cards.
 * Wrap any chart container with this component. On hover near the corner, a page-peel
 * animation reveals a download icon. Click to export the chart SVG.
 */

import { memo, useCallback, useRef, useState } from "react";
import { Box, Tooltip } from "@mui/material";
import { exportSvgElement } from "../../utils/exportUtils";

interface ChartExportCornerProps {
  children: React.ReactNode;
  /** File name for the exported SVG (without extension) */
  fileName?: string;
  /** Size of the hover zone & curl effect in px */
  size?: number;
}

const ChartExportCorner = memo(({ children, fileName = "chart", size = 44 }: ChartExportCornerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector<SVGSVGElement>(".recharts-wrapper > svg, svg.recharts-surface");
    if (!svg) {
      // Try any SVG inside
      const fallback = containerRef.current.querySelector<SVGSVGElement>("svg");
      if (fallback) {
        exportSvgElement(fallback, `${fileName}.svg`);
        return;
      }
      console.warn("ChartExportCorner: no SVG found");
      return;
    }
    exportSvgElement(svg, `${fileName}.svg`);
  }, [fileName]);

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      {children}

      {/* Hover zone — top-right corner */}
      <Tooltip title="Export chart as SVG" placement="left" arrow>
        <Box
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleExport}
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            width: size * 1.5,
            height: size * 1.5,
            cursor: "pointer",
            zIndex: 10,
          }}
        />
      </Tooltip>

      {/* Page curl effect */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: size,
          height: size,
          pointerEvents: "none",
          transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          // Folded corner triangle
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            right: 0,
            width: hovered ? size : 0,
            height: hovered ? size : 0,
            background: (theme) =>
              `linear-gradient(225deg, ${theme.palette.mode === "dark" ? "#2a2a3e" : "#f5f5f5"} 45%, ${theme.palette.mode === "dark" ? "#1a1a2e" : "#e0e0e0"} 50%, transparent 50%)`,
            borderRadius: "0 0 0 4px",
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: hovered ? "-2px 2px 4px rgba(0,0,0,0.15)" : "none",
          },
          // Shadow under the curl
          "&::after": {
            content: '""',
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderStyle: "solid",
            borderWidth: hovered ? `0 ${size}px ${size}px 0` : "0 0 0 0",
            borderColor: (theme) =>
              `transparent ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} transparent transparent`,
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          },
          // Download icon
          "& .export-icon": {
            position: "absolute",
            top: hovered ? size * 0.18 : -10,
            right: hovered ? size * 0.18 : -10,
            opacity: hovered ? 1 : 0,
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            fontSize: size * 0.36,
            color: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)"),
          },
        }}
      >
        <svg className="export-icon" viewBox="0 0 24 24" width={size * 0.36} height={size * 0.36} fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
      </Box>
    </Box>
  );
});

ChartExportCorner.displayName = "ChartExportCorner";
export default ChartExportCorner;
