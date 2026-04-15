/**
 * GapStrip — Horizontal mini heatmap showing demand-supply gap per month.
 * Red = shortage (demand > supply), Green = surplus, Grey = balanced.
 * Same visual pattern as AggregateHeatmapStrip.
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { functional } from "../../../../config/brandConfig";
import type { DemandSupplyRow } from "../../utils/demandCalc";

interface GapStripProps {
  rows: DemandSupplyRow[];
  selectedMonth?: string | null;
  onMonthClick?: (monthKey: string) => void;
}

const GapStrip = memo(({ rows, selectedMonth, onMonthClick }: GapStripProps) => {
  const theme = useTheme();

  // Compute max absolute gap for color intensity scaling
  const maxGap = useMemo(() => {
    let max = 0;
    for (const row of rows) max = Math.max(max, Math.abs(row.gapTotal));
    return max || 1;
  }, [rows]);

  return (
    <Box sx={{ display: "flex", gap: "1px", px: 1, py: 0.25 }}>
      {rows.map((row) => {
        const intensity = Math.min(1, Math.abs(row.gapTotal) / maxGap);
        const isShortage = row.gapTotal > 0;
        const isSurplus = row.gapTotal < 0;
        const isSelected = selectedMonth === row.monthKey;

        let bgColor: string;
        if (Math.abs(row.gapTotal) < 0.1) {
          bgColor = alpha(theme.palette.text.disabled, 0.1);
        } else if (isShortage) {
          bgColor = alpha(functional.warning, 0.15 + intensity * 0.55);
        } else {
          bgColor = alpha(functional.success, 0.15 + intensity * 0.45);
        }

        return (
          <Tooltip
            key={row.monthKey}
            title={
              <Box>
                <Typography variant="caption" fontWeight={700}>
                  {row.monthLabel}
                </Typography>
                <Typography variant="caption" display="block" sx={{ fontSize: "0.65rem" }}>
                  Demand: {row.demandTotal.toFixed(1)} FTE
                </Typography>
                <Typography variant="caption" display="block" sx={{ fontSize: "0.65rem" }}>
                  Supply: {row.supplyTotal.toFixed(1)} FTE
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  fontWeight={700}
                  sx={{
                    fontSize: "0.65rem",
                    color: isShortage ? functional.warning : isSurplus ? functional.success : "inherit",
                  }}
                >
                  Gap: {row.gapTotal > 0 ? "+" : ""}
                  {row.gapTotal.toFixed(1)} FTE
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <Box
              onClick={() => onMonthClick?.(row.monthKey)}
              sx={{
                flex: 1,
                height: 20,
                borderRadius: 0.5,
                bgcolor: bgColor,
                cursor: "pointer",
                border: isSelected ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&:hover": { filter: "brightness(0.92)", transform: "scaleY(1.15)" },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  color: Math.abs(row.gapTotal) < 0.1 ? "text.disabled" : isShortage ? "error.dark" : "success.dark",
                  lineHeight: 1,
                }}
              >
                {Math.abs(row.gapTotal) >= 0.1
                  ? row.gapTotal > 0
                    ? `+${row.gapTotal.toFixed(1)}`
                    : row.gapTotal.toFixed(1)
                  : "·"}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
});
GapStrip.displayName = "GapStrip";

export default GapStrip;
