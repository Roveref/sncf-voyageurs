import React from "react";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import { glassmorphism } from "../../../styles/animations";
import { formatCurrency } from "../../../utils/formatters";

/**
 * Custom tooltip for pipeline status/service line stacked charts
 * Shows pipeline stages with allocated/non-allocated distinction and calculated (I&O) values
 */
export const StatusChartTooltip = ({ active, payload, showIO = true }: any) => {
  const theme = useTheme();

  if (active && payload && payload.length) {
    const serviceLine = payload[0].payload.name;
    const chartTotalRevenue = payload[0].payload.total || 0;
    const chartCalculatedTotal = payload[0].payload.calculatedTotal || 0;

    // Extract pipeline stage data with allocated/non-allocated values
    const pipelineStages: {
      name: string;
      allocated: number;
      nonAllocated: number;
      total: number;
      calculatedValue: number;
      count: number;
      color: string;
    }[] = [];

    // Check each of the standard data keys we expect
    const earlyAllocated = payload[0].payload.earlyAllocated || 0;
    const earlyNonAllocated = payload[0].payload.earlyNonAllocated || 0;
    const earlyTotal = earlyAllocated + earlyNonAllocated;
    const calculatedEarlyValue = payload[0].payload.calculatedEarly || 0;
    const earlyCount = payload[0].payload.earlyCount || 0;

    if (earlyTotal > 0) {
      pipelineStages.push({
        name: "Lead Identified → Go Approved",
        allocated: earlyAllocated,
        nonAllocated: earlyNonAllocated,
        total: earlyTotal,
        calculatedValue: calculatedEarlyValue,
        count: earlyCount,
        color: theme.palette.primary.light,
      });
    }

    const midAllocated = payload[0].payload.midAllocated || 0;
    const midNonAllocated = payload[0].payload.midNonAllocated || 0;
    const midTotal = midAllocated + midNonAllocated;
    const calculatedMidValue = payload[0].payload.calculatedMid || 0;
    const midCount = payload[0].payload.midCount || 0;

    if (midTotal > 0) {
      pipelineStages.push({
        name: "Proposal Submitted",
        allocated: midAllocated,
        nonAllocated: midNonAllocated,
        total: midTotal,
        calculatedValue: calculatedMidValue,
        count: midCount,
        color: theme.palette.primary.main,
      });
    }

    const lateAllocated = payload[0].payload.lateAllocated || 0;
    const lateNonAllocated = payload[0].payload.lateNonAllocated || 0;
    const lateTotal = lateAllocated + lateNonAllocated;
    const calculatedLateValue = payload[0].payload.calculatedLate || 0;
    const lateCount = payload[0].payload.lateCount || 0;

    if (lateTotal > 0) {
      pipelineStages.push({
        name: "Client Won → AEL",
        allocated: lateAllocated,
        nonAllocated: lateNonAllocated,
        total: lateTotal,
        calculatedValue: calculatedLateValue,
        count: lateCount,
        color: theme.palette.primary.dark,
      });
    }

    return (
      <Card
        sx={{
          ...glassmorphism(10, 0.9, theme.palette.mode === "dark"),
          p: 2,
          borderRadius: 2,
          minWidth: 340,
          maxWidth: 420,
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
        {/* Service Line Name */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          {serviceLine}
        </Typography>

        {/* Each Pipeline Stage */}
        {pipelineStages.map((stage) => (
          <Box key={stage.name} sx={{ mb: 1.5 }}>
            {/* Stage name and total */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Typography variant="body2" fontWeight={500} color={stage.color} sx={{ flex: 1, lineHeight: 1.4 }}>
                {stage.name} ({stage.count} opp{stage.count !== 1 ? "s" : ""}):
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>
                {formatCurrency(stage.total)}
              </Typography>
            </Box>

            {/* Show allocated/non-allocated breakdown if there's a non-allocated portion */}
            {stage.nonAllocated > 0 && (
              <Box sx={{ ml: 2, mt: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    color: "text.secondary",
                  }}
                >
                  <span>• Allocated:</span>
                  <span style={{ fontWeight: 600, marginLeft: "8px" }}>{formatCurrency(stage.allocated)}</span>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    color: "text.secondary",
                    opacity: 0.7,
                  }}
                >
                  <span>• Other:</span>
                  <span style={{ fontWeight: 600, marginLeft: "8px" }}>{formatCurrency(stage.nonAllocated)}</span>
                </Typography>
              </Box>
            )}

            {/* Always show calculated value */}
            {showIO && (
              <Typography
                variant="body2"
                color="primary.main"
                sx={{
                  fontSize: "0.75rem",
                  ml: 0,
                  mt: 0.5,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                I&O: {formatCurrency(stage.calculatedValue)}
              </Typography>
            )}
          </Box>
        ))}

        <Divider sx={{ my: 1.5 }} />

        {/* Total Section */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" fontWeight={700}>
            Total ({pipelineStages.reduce((sum, stage) => sum + stage.count, 0)} opp
            {pipelineStages.reduce((sum, stage) => sum + stage.count, 0) !== 1 ? "s" : ""}):
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {formatCurrency(chartTotalRevenue)}
          </Typography>
        </Box>

        {/* Total Allocated */}
        {pipelineStages.some((stage) => stage.nonAllocated > 0) && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 0.5 }}>
            <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.85rem" }}>
              Total Allocated:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.85rem" }}>
              {formatCurrency(pipelineStages.reduce((sum, stage) => sum + stage.allocated, 0))}
            </Typography>
          </Box>
        )}

        {showIO && (
          <Typography
            variant="body2"
            color="primary.main"
            sx={{
              fontSize: "0.75rem",
              mt: 0.5,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            I&O: {formatCurrency(chartCalculatedTotal)}
          </Typography>
        )}
      </Card>
    );
  }
  return null;
};

/**
 * Custom tooltip for general revenue charts
 * Shows revenue with optional I&O calculated value and count
 */
export const RevenueChartTooltip = ({ active, payload, label, showIO = true }: any) => {
  const theme = useTheme();

  if (active && payload && payload.length) {
    return (
      <Card
        sx={{
          ...glassmorphism(10, 0.9, theme.palette.mode === "dark"),
          p: 2,
          borderRadius: 2,
          minWidth: 250,
          maxWidth: 350,
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
          {`${label || payload[0].name}`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {`Revenue: ${formatCurrency(payload[0].value)}`}
        </Typography>
        {/* Add calculated value in parentheses if available */}
        {showIO && payload[0].payload.calculatedValue && (
          <Typography variant="body2" color="primary.main">
            {`(I&O: ${formatCurrency(payload[0].payload.calculatedValue)})`}
          </Typography>
        )}
        {payload[0].payload.count && (
          <Typography variant="body2" color="text.secondary">
            {`Count: ${payload[0].payload.count} opportunities`}
          </Typography>
        )}
      </Card>
    );
  }
  return null;
};

/**
 * Simple chart tooltip for basic value display
 */
export const SimpleChartTooltip = ({ active, payload, label, valueLabel = "Value" }: any) => {
  const theme = useTheme();

  if (active && payload && payload.length) {
    return (
      <Card
        sx={{
          ...glassmorphism(10, 0.9, theme.palette.mode === "dark"),
          p: 1.5,
          borderRadius: 2,
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
        <Typography variant="subtitle2" fontWeight={600}>
          {label || payload[0].name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {`${valueLabel}: ${formatCurrency(payload[0].value)}`}
        </Typography>
      </Card>
    );
  }
  return null;
};
