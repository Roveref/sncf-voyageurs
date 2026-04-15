import React, { useMemo } from "react";
/**
 * PipelineOverviewCard Component
 * Displays pipeline overview with total value and size breakdown
 * Performance-optimized with React.memo and useMemo
 */

import { Card, CardContent, Typography, Box, Divider, alpha, useTheme } from "@mui/material";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { calculateSizeDistribution } from "../utils/sizeCalculations";
import { keyframes } from "../../../styles/animations";

/**
 * Pipeline overview card component
 * Memoized to prevent unnecessary re-renders
 *
 * @param {boolean} isAllocated - Whether allocation is active
 * @param {number} totalRevenue - Total pipeline revenue
 * @param {number} calculatedTotalRevenue - Calculated I&O revenue
 * @param {number} allocatedRevenue - Allocated revenue
 * @param {number} allocationPercentage - Allocation percentage
 * @param {number} dataLength - Number of opportunities
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {boolean} showIO - Whether to show I&O values
 * @param {boolean} isCompleteUnitSelected - Whether complete unit is selected
 */
const PipelineOverviewCard = React.memo(
  ({
    isAllocated,
    totalRevenue,
    calculatedTotalRevenue,
    allocatedRevenue,
    allocationPercentage,
    dataLength,
    filteredOpportunities,
    showNetRevenue,
    showIO,
    isCompleteUnitSelected,
  }) => {
    const theme = useTheme();

    // Memoized size distribution calculation
    const sizeDistribution = useMemo(() => {
      return calculateSizeDistribution(filteredOpportunities, showNetRevenue, theme);
    }, [filteredOpportunities, showNetRevenue, theme]);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "translateY(-8px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
            "& .MuiSvgIcon-root": {
              transform: "scale(1.1)",
            },
          },
          position: "relative",
          overflow: "visible",
          borderRadius: 3,
          animation: "fadeInUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) 0ms both",
          ...keyframes.fadeInUp,
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          {/* Card Title */}
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {isAllocated ? "Filtered Pipeline" : "Pipeline Overview"}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Total Pipeline */}
          <Box sx={{ mt: 3, mb: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "relative",
              }}
            >
              {/* Total Pipeline */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Pipeline Value
                </Typography>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="h4" component="div" fontWeight={700} color="text.primary">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(totalRevenue)}
                  </Typography>
                  {showIO && (
                    <Typography variant="body2" color="primary.main">
                      (I&O:{" "}
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(calculatedTotalRevenue)}
                      )
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Center arrow with percentage */}
              {isAllocated && !isCompleteUnitSelected && allocatedRevenue > 0 && allocatedRevenue !== totalRevenue && (
                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    px: 1,
                    py: 0.5,
                    borderRadius: 4,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    zIndex: 1,
                  }}
                >
                  <Typography variant="caption" color="secondary.main" fontWeight={600} sx={{ mb: 0.5 }}>
                    {allocationPercentage === 100 ? "100%" : `${allocationPercentage.toFixed(0)}%`}
                  </Typography>
                  <ArrowRightAltIcon
                    color="secondary"
                    fontSize="small"
                    sx={{
                      transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                    }}
                  />
                </Box>
              )}

              {/* Allocation Section */}
              {isAllocated && !isCompleteUnitSelected && allocatedRevenue > 0 && allocatedRevenue !== totalRevenue && (
                <Box sx={{ flex: 1, textAlign: "right" }}>
                  <Typography variant="body2" color="secondary.main" gutterBottom>
                    Filtered Pipeline Value
                  </Typography>
                  <Typography variant="h4" component="div" color="secondary.main" fontWeight={700}>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(allocatedRevenue)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Pipeline Size Breakdown */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} color="text.primary" gutterBottom>
              Pipeline Size Breakdown
            </Typography>

            {sizeDistribution.map((range) => (
              <Box key={range.name} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 0.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: range.color,
                        mr: 1,
                      }}
                    />
                    <Typography variant="body2" fontWeight={500}>
                      {range.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {range.count} opps
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: alpha(range.color, 0.15),
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          width: `${range.percentage}%`,
                          bgcolor: range.color,
                          borderRadius: 4,
                        }}
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 40, textAlign: "right" }}>
                    {range.percentage.toFixed(0)}%
                  </Typography>
                </Box>

                {/* Revenue value with allocated and I&O values */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(range.value)}
                  </Typography>
                  {isAllocated && !isCompleteUnitSelected && range.allocatedValue !== range.value && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        →
                      </Typography>
                      <Typography variant="body2" color="secondary.main" sx={{ mt: 0.5 }}>
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(range.allocatedValue || 0)}
                      </Typography>
                    </>
                  )}
                  {showIO && (
                    <Typography variant="body2" color="primary.main" sx={{ mt: 0.5, fontSize: "0.75rem" }}>
                      (I&O:{" "}
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(range.calculatedValue)}
                      )
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }
);

PipelineOverviewCard.displayName = "PipelineOverviewCard";

export default React.memo(PipelineOverviewCard);
