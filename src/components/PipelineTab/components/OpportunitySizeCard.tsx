import React, { useMemo } from "react";
/**
 * OpportunitySizeCard Component
 * Displays average and median opportunity sizes
 * Performance-optimized with React.memo and useMemo
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import {
  calculateMedianOpportunitySize,
  calculateFilteredMedianOpportunitySize,
  calculateMinMaxOpportunitySize,
  calculateStandardDeviation,
  calculateParetoConcentration,
  calculateMinMaxOpportunitySizeIO,
  calculateMedianOpportunitySizeIO,
  calculateParetoConcentrationIO,
} from "../utils/sizeCalculations";
import { calculateTotalRevenueWithSegmentLogic } from "../utils/revenueCalculations";
import { keyframes } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedPercent, AnimatedCount } from "../../common/AnimatedNumbers";

/**
 * Opportunity size analysis card component
 * Memoized to prevent unnecessary re-renders
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {number} totalRevenue - Total revenue
 * @param {number} allocatedRevenue - Allocated revenue
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {boolean} isAllocated - Whether allocation is active
 * @param {boolean} isCompleteUnitSelected - Whether complete unit is selected
 * @param {boolean} showIO - Whether to show I&O values
 * @param {Function} onParetoFilter - Callback for Pareto filter
 */
const OpportunitySizeCard = React.memo(
  ({
    filteredOpportunities,
    totalRevenue,
    allocatedRevenue,
    showNetRevenue,
    isAllocated,
    isCompleteUnitSelected,
    showIO = true,
    onParetoFilter,
  }: any) => {
    const theme = useTheme();

    // Memoized calculations for performance
    const averageSize = useMemo(() => {
      return filteredOpportunities.length > 0 ? totalRevenue / filteredOpportunities.length : 0;
    }, [totalRevenue, filteredOpportunities.length]);

    const filteredAverageSize = useMemo(() => {
      return filteredOpportunities.length > 0 ? allocatedRevenue / filteredOpportunities.length : 0;
    }, [allocatedRevenue, filteredOpportunities.length]);

    const medianSize = useMemo(() => {
      return calculateMedianOpportunitySize(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const filteredMedianSize = useMemo(() => {
      return calculateFilteredMedianOpportunitySize(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    // Calculate new metrics
    const { min: minSize, max: maxSize } = useMemo(() => {
      return calculateMinMaxOpportunitySize(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const standardDeviation = useMemo(() => {
      return calculateStandardDeviation(filteredOpportunities, showNetRevenue, averageSize);
    }, [filteredOpportunities, showNetRevenue, averageSize]);

    const paretoAnalysis = useMemo(() => {
      return calculateParetoConcentration(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const paretoAnalysisIO = useMemo(() => {
      return calculateParetoConcentrationIO(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    // Calculate I&O metrics
    const calculatedTotalRevenue = useMemo(() => {
      return calculateTotalRevenueWithSegmentLogic(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const averageSizeIO = useMemo(() => {
      // Count only opportunities with I&O > 0
      const oppsWithIO = filteredOpportunities.filter((opp: any) => {
        const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const specialSegmentCodes = ["AUTO", "CLR", "IEM"];
        const isSpecialSegmentCode = specialSegmentCodes.includes(opp.subSegmentCode);

        if (isSpecialSegmentCode) return revenue > 0;

        // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
        const serviceLines = [
          { line: opp.serviceLine1, percentage: opp.serviceOffering1Pct || opp.allocation1 || 0 },
          { line: opp.serviceLine2, percentage: opp.serviceOffering2Pct || opp.allocation2 || 0 },
          { line: opp.serviceLine3, percentage: opp.serviceOffering3Pct || opp.allocation3 || 0 },
        ];

        const operationsAllocation = serviceLines.reduce((total, service) => {
          if (service.line === "Operations") {
            return total + revenue * (service.percentage / 100);
          }
          return total;
        }, 0);

        return operationsAllocation > 0;
      }).length;

      return oppsWithIO > 0 ? calculatedTotalRevenue / oppsWithIO : 0;
    }, [calculatedTotalRevenue, filteredOpportunities, showNetRevenue]);

    const medianSizeIO = useMemo(() => {
      return calculateMedianOpportunitySizeIO(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const { min: minSizeIO, max: maxSizeIO } = useMemo(() => {
      return calculateMinMaxOpportunitySizeIO(filteredOpportunities, showNetRevenue);
    }, [filteredOpportunities, showNetRevenue]);

    const standardDeviationIO = useMemo(() => {
      if (!filteredOpportunities || filteredOpportunities.length === 0) return 0;

      const revenueValues = filteredOpportunities
        .map((opp: any) => {
          const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
          const specialSegmentCodes = ["AUTO", "CLR", "IEM"];
          const isSpecialSegmentCode = specialSegmentCodes.includes(opp.subSegmentCode);

          if (isSpecialSegmentCode) return revenue;

          // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
          const serviceLines = [
            { line: opp.serviceLine1, percentage: opp.serviceOffering1Pct || opp.allocation1 || 0 },
            { line: opp.serviceLine2, percentage: opp.serviceOffering2Pct || opp.allocation2 || 0 },
            { line: opp.serviceLine3, percentage: opp.serviceOffering3Pct || opp.allocation3 || 0 },
          ];

          const operationsAllocation = serviceLines.reduce((total, service) => {
            if (service.line === "Operations") {
              return total + revenue * (service.percentage / 100);
            }
            return total;
          }, 0);

          return operationsAllocation;
        })
        .filter((value: any) => value > 0);

      if (revenueValues.length === 0) return 0;

      const squaredDifferences = revenueValues.map((value: any) => Math.pow(value - averageSizeIO, 2));
      const variance = squaredDifferences.reduce((sum: number, val: any) => sum + val, 0) / revenueValues.length;

      return Math.sqrt(variance);
    }, [filteredOpportunities, showNetRevenue, averageSizeIO]);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
          position: "relative",
          overflow: "visible",
          borderRadius: 3,
          animation: "fadeInUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) 100ms both",
          ...keyframes.fadeInUp,
        }}
      >
        <CardContent sx={{ p: 3, height: "100%" }}>
          {/* Card Title */}
          <Typography variant="h6" fontWeight={700}>
            Pipeline Size Analysis
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Main metrics section */}
          <Box sx={{ mb: 3 }}>
            {/* Average Size */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                p: 2,
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Average Size
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                <AnimatedCurrency value={averageSize} variant="h5" color="text.primary" />
                {isAllocated && !isCompleteUnitSelected && Math.abs(filteredAverageSize - averageSize) > 0.01 && (
                  <>
                    <Typography variant="h5" color="text.secondary">
                      →
                    </Typography>
                    <AnimatedCurrency value={filteredAverageSize} variant="h5" color="secondary.main" />
                  </>
                )}
                {showIO && (
                  <Typography
                    variant="caption"
                    color="primary.main"
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                  >
                    (I&O:{" "}
                    <AnimatedCurrency value={averageSizeIO} variant="caption" fontWeight={400} color="primary.main" />)
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Median Size */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.08),
                p: 2,
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Median Size
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                <AnimatedCurrency value={medianSize} variant="h5" color={theme.palette.info.main} />
                {isAllocated && !isCompleteUnitSelected && Math.abs(filteredMedianSize - medianSize) > 0.01 && (
                  <>
                    <Typography variant="h5" color="text.secondary">
                      →
                    </Typography>
                    <AnimatedCurrency value={filteredMedianSize} variant="h5" color={theme.palette.info.dark} />
                  </>
                )}
                {showIO && (
                  <Typography
                    variant="caption"
                    color="primary.main"
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                  >
                    (I&O:{" "}
                    <AnimatedCurrency value={medianSizeIO} variant="caption" fontWeight={400} color="primary.main" />)
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Standard Deviation */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                p: 2,
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Std Deviation
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap" }}>
                <AnimatedCurrency value={standardDeviation} variant="body2" fontWeight={600} color="warning.dark" />
                {showIO && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="primary.main"
                    sx={{ ml: 1, display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                  >
                    (I&O:{" "}
                    <AnimatedCurrency
                      value={standardDeviationIO}
                      variant="caption"
                      fontWeight={400}
                      color="primary.main"
                    />
                    )
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                <AnimatedPercent
                  value={averageSize > 0 ? (standardDeviation / averageSize) * 100 : 0}
                  variant="caption"
                  fontWeight={400}
                  color="text.secondary"
                  decimals={1}
                />
                <Typography variant="caption" color="text.secondary">
                  {" "}
                  of average
                </Typography>
                {showIO && averageSizeIO > 0 && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="primary.main"
                    sx={{ ml: 1, display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                  >
                    (I&O:{" "}
                    <AnimatedPercent
                      value={(standardDeviationIO / averageSizeIO) * 100}
                      variant="caption"
                      fontWeight={400}
                      color="primary.main"
                      decimals={1}
                    />
                    )
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Pareto Analysis */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                p: 2,
                borderRadius: 2,
                cursor: "pointer",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  transform: "translateY(-2px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
              }}
              onClick={() => {
                if (onParetoFilter) {
                  // Filter to show only top 20% opportunities
                  const sortedOpps = [...filteredOpportunities].sort((a, b) => {
                    const revenueA = showNetRevenue ? a.netRevenue || 0 : a.grossRevenue || 0;
                    const revenueB = showNetRevenue ? b.netRevenue || 0 : b.grossRevenue || 0;
                    return revenueB - revenueA;
                  });
                  const top20Count = Math.ceil(sortedOpps.length * 0.2);
                  const top20Opps = sortedOpps.slice(0, top20Count);
                  onParetoFilter(top20Opps);
                }
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Pareto Analysis (Top 20%)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <AnimatedCount
                      value={paretoAnalysis.top20Count}
                      variant="body2"
                      color="primary.main"
                      sx={{ fontWeight: 700, fontSize: "1.1rem" }}
                    />{" "}
                    opportunities
                    {showIO && paretoAnalysisIO.top20Count > 0 && (
                      <Box component="span" sx={{ ml: 0.5, color: "primary.main", fontSize: "0.75rem" }}>
                        (I&O: {paretoAnalysisIO.top20Count} opps)
                      </Box>
                    )}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 0.5,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <AnimatedPercent value={paretoAnalysis.top20Percentage} variant="h4" color="primary.main" />
                    {showIO && paretoAnalysisIO.top20Percentage > 0 && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="primary.main"
                        sx={{ ml: 1, display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                      >
                        (I&O:{" "}
                        <AnimatedPercent
                          value={paretoAnalysisIO.top20Percentage}
                          variant="caption"
                          fontWeight={400}
                          color="primary.main"
                        />
                        )
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    of total revenue
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }
);

OpportunitySizeCard.displayName = "OpportunitySizeCard";

export default React.memo(OpportunitySizeCard);
