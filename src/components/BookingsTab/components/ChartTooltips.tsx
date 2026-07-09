import React from "react";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { glassmorphism } from "../../../styles/animations";
import { formatCurrency } from "../../../utils/formatters";

/**
 * Custom tooltip for revenue charts in BookingsTab
 * Shows revenue with allocated/other breakdown and optional I&O calculated value
 */
export const RevenueChartTooltip = ({ active, payload, label, showIO = true }: any) => {
  const theme = useTheme();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const totalValue = data.originalValue || data.value || 0;
    const allocatedValue = data.allocatedValue;
    const calculatedValue = data.calculatedValue;
    const count = data.count;

    // Check if there's an allocation difference
    const hasAllocation = allocatedValue !== undefined && allocatedValue !== totalValue;
    const nonAllocatedValue = hasAllocation ? totalValue - allocatedValue : 0;

    return (
      <Card
        sx={{
          ...glassmorphism(10, 0.9, theme.palette.mode === "dark"),
          p: 2,
          borderRadius: 2,
          minWidth: 280,
          maxWidth: 380,
          boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25), 0 0 1px rgba(255, 255, 255, 0.5)",
          animation: "tooltipEntrance 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@keyframes tooltipEntrance": {
            from: {
              opacity: 0,
              transform: "scale(0.9)",
            },
            to: {
              opacity: 1,
              transform: "scale(1)",
            },
          },
          transition:
            "opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
          {data.name || label}
        </Typography>
        <Divider sx={{ my: 1 }} />

        {/* Total revenue */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Valeur ({count || 0} actif{count !== 1 ? "s" : ""}) :
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {formatCurrency(totalValue)}
          </Typography>
        </Box>

        {/* Allocated/Other breakdown if there's an allocation */}
        {hasAllocation && (
          <Box sx={{ ml: 2, mt: 0.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                • Allocated:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                {formatCurrency(allocatedValue)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "text.secondary", opacity: 0.7 }}>
                • Other:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.7 }}>
                {formatCurrency(nonAllocatedValue)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* I&O calculated value (only when showIO is enabled) */}
        {showIO && calculatedValue !== undefined && calculatedValue > 0 && (
          <Typography
            variant="caption"
            color="primary.main"
            sx={{ mt: 0.5, display: "flex", justifyContent: "flex-end" }}
          >
            (I&O: {formatCurrency(calculatedValue)})
          </Typography>
        )}
      </Card>
    );
  }
  return null;
};
