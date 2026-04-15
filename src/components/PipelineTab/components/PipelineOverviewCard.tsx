import React, { useMemo } from "react";
/**
 * PipelineOverviewCard Component
 * Displays pipeline overview with total value and size breakdown
 * Performance-optimized with React.memo and useMemo
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { calculateSizeDistribution } from "../utils/sizeCalculations";
import { animations, keyframes } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedPercent } from "../../common/AnimatedNumbers";

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
  }: any) => {
    const theme = useTheme();

    // Memoized size distribution calculation
    const sizeDistribution = useMemo(() => {
      return calculateSizeDistribution(filteredOpportunities, showNetRevenue, theme);
    }, [filteredOpportunities, showNetRevenue, theme]);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
            "& .MuiSvgIcon-root": {
              transform: "scale(1.1)",
            },
          },
          position: "relative",
          overflow: "visible",
          borderRadius: 3,
          ...animations.cardEntrance(0),
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          {/* Card Title */}
          <Typography variant="h6" fontWeight={700}>
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
                  <AnimatedCurrency value={totalRevenue} variant="h4" color="text.primary" />
                  {showIO && (
                    <Typography
                      variant="body2"
                      color="primary.main"
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                    >
                      (I&O:{" "}
                      <AnimatedCurrency
                        value={calculatedTotalRevenue}
                        variant="body2"
                        fontWeight={400}
                        color="primary.main"
                      />
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
                  <AnimatedPercent
                    value={allocationPercentage}
                    variant="caption"
                    fontWeight={600}
                    color="secondary.main"
                    sx={{ mb: 0.5 }}
                  />
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
                  <AnimatedCurrency value={allocatedRevenue} variant="h4" color="secondary.main" />
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
                          transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
                        }}
                      />
                    </Box>
                  </Box>
                  <AnimatedPercent
                    value={range.percentage ?? 0}
                    variant="body2"
                    fontWeight={600}
                    sx={{ minWidth: 40, textAlign: "right" }}
                  />
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
                  <AnimatedCurrency
                    value={range.value}
                    variant="body2"
                    fontWeight={400}
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  />
                  {isAllocated && !isCompleteUnitSelected && range.allocatedValue !== range.value && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        →
                      </Typography>
                      <AnimatedCurrency
                        value={range.allocatedValue || 0}
                        variant="body2"
                        fontWeight={400}
                        color="secondary.main"
                        sx={{ mt: 0.5 }}
                      />
                    </>
                  )}
                  {showIO && (
                    <Typography
                      variant="body2"
                      color="primary.main"
                      component="span"
                      sx={{ mt: 0.5, fontSize: "0.75rem", display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                    >
                      (I&O:{" "}
                      <AnimatedCurrency
                        value={range.calculatedValue}
                        variant="body2"
                        fontWeight={400}
                        color="primary.main"
                        sx={{ fontSize: "0.75rem" }}
                      />
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
