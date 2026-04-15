import React, { useMemo } from "react";
/**
 * OpportunitySizeCard Component
 * Displays average and median opportunity sizes
 * Performance-optimized with React.memo and useMemo
 */

import { Card, CardContent, Typography, Box, Divider, alpha, useTheme } from "@mui/material";
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
  }) => {
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
      const oppsWithIO = filteredOpportunities.filter((opp) => {
        const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const specialSegmentCodes = ["AUTO", "CLR", "IEM"];
        const isSpecialSegmentCode = specialSegmentCodes.includes(opp["Sub Segment Code"]);

        if (isSpecialSegmentCode) return revenue > 0;

        // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
        const serviceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || opp["Allocation 1"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || opp["Allocation 2"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || opp["Allocation 3"] || 0 },
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
        .map((opp) => {
          const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
          const specialSegmentCodes = ["AUTO", "CLR", "IEM"];
          const isSpecialSegmentCode = specialSegmentCodes.includes(opp["Sub Segment Code"]);

          if (isSpecialSegmentCode) return revenue;

          // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
          const serviceLines = [
            { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || opp["Allocation 1"] || 0 },
            { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || opp["Allocation 2"] || 0 },
            { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || opp["Allocation 3"] || 0 },
          ];

          const operationsAllocation = serviceLines.reduce((total, service) => {
            if (service.line === "Operations") {
              return total + revenue * (service.percentage / 100);
            }
            return total;
          }, 0);

          return operationsAllocation;
        })
        .filter((value) => value > 0);

      if (revenueValues.length === 0) return 0;

      const squaredDifferences = revenueValues.map((value) => Math.pow(value - averageSizeIO, 2));
      const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / revenueValues.length;

      return Math.sqrt(variance);
    }, [filteredOpportunities, showNetRevenue, averageSizeIO]);

    return (
      <Card
        sx={{
          height: "100%",
          transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "translateY(-8px)",
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
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
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
                <Typography variant="h5" component="div" fontWeight={700} color="text.primary">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(averageSize)}
                </Typography>
                {isAllocated && !isCompleteUnitSelected && Math.abs(filteredAverageSize - averageSize) > 0.01 && (
                  <>
                    <Typography variant="h5" color="text.secondary">
                      →
                    </Typography>
                    <Typography variant="h5" color="secondary.main" fontWeight={700}>
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(filteredAverageSize)}
                    </Typography>
                  </>
                )}
                {showIO && (
                  <Typography variant="caption" color="primary.main">
                    (I&O:{" "}
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(averageSizeIO)}
                    )
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
                <Typography variant="h5" component="div" fontWeight={700} color={theme.palette.info.main}>
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(medianSize)}
                </Typography>
                {isAllocated && !isCompleteUnitSelected && Math.abs(filteredMedianSize - medianSize) > 0.01 && (
                  <>
                    <Typography variant="h5" color="text.secondary">
                      →
                    </Typography>
                    <Typography variant="h5" color={theme.palette.info.dark} fontWeight={700}>
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(filteredMedianSize)}
                    </Typography>
                  </>
                )}
                {showIO && (
                  <Typography variant="caption" color="primary.main">
                    (I&O:{" "}
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(medianSizeIO)}
                    )
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
              <Typography variant="body2" fontWeight={600} color="warning.dark">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(standardDeviation)}
                {showIO && (
                  <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1 }}>
                    (I&O:{" "}
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(standardDeviationIO)}
                    )
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {((standardDeviation / averageSize) * 100).toFixed(1)}% of average
                {showIO && averageSizeIO > 0 && (
                  <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1 }}>
                    (I&O: {((standardDeviationIO / averageSizeIO) * 100).toFixed(1)}%)
                  </Typography>
                )}
              </Typography>
            </Box>

            {/* Pareto Analysis */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                p: 2,
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                },
              }}
              onClick={() => {
                if (onParetoFilter) {
                  // Filter to show only top 20% opportunities
                  const sortedOpps = [...filteredOpportunities].sort((a, b) => {
                    const revenueA = showNetRevenue ? a["Net Revenue"] || 0 : a["Gross Revenue"] || 0;
                    const revenueB = showNetRevenue ? b["Net Revenue"] || 0 : b["Gross Revenue"] || 0;
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
                    <Box component="span" sx={{ fontWeight: 700, color: "primary.main", fontSize: "1.1rem" }}>
                      {paretoAnalysis.top20Count}
                    </Box>{" "}
                    opportunities
                    {showIO && paretoAnalysisIO.top20Count > 0 && (
                      <Box component="span" sx={{ ml: 0.5, color: "primary.main", fontSize: "0.75rem" }}>
                        (I&O: {paretoAnalysisIO.top20Count} opps)
                      </Box>
                    )}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="h4" fontWeight={700} color="primary.main">
                    {paretoAnalysis.top20Percentage.toFixed(0)}%
                    {showIO && paretoAnalysisIO.top20Percentage > 0 && (
                      <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1 }}>
                        (I&O: {paretoAnalysisIO.top20Percentage.toFixed(0)}%)
                      </Typography>
                    )}
                  </Typography>
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
