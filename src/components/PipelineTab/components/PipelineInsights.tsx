import React, { useState, useEffect } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid2";
import { alpha, useTheme } from "@mui/material/styles";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { animations, keyframes as animationKeyframes } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedCount } from "../../common/AnimatedNumbers";
import { usePiPCloseButton } from "../../shared";

/**
 * Component that analyzes pipeline data and generates insights
 * Customized to show specific status changes
 */

interface Opportunity extends Record<string, any> {
  status: number;
  netRevenue?: number;
  grossRevenue?: number;
  isAllocated?: boolean;
  allocatedNetRevenue?: number;
  allocatedGrossRevenue?: number;
}

interface PipelineInsightsProps {
  data: Opportunity[];
  onFilterChange: (filteredOpportunities: Opportunity[], filterType: string) => void;
  activeFilterType: string | null;
  showNetRevenue?: boolean;
  showIO?: boolean;
  isAllocated?: boolean;
}

const PipelineInsights = ({
  data,
  onFilterChange,
  activeFilterType,
  showNetRevenue = false,
  showIO = true,
  isAllocated = false,
}: PipelineInsightsProps) => {
  const theme = useTheme();
  const pipCloseBtn = usePiPCloseButton();
  interface InsightBucket {
    count: number;
    revenue: number;
    allocatedRevenue: number;
    calculatedRevenue: number;
    filteredData: Opportunity[];
  }
  const [insights, setInsights] = useState<{
    newOpportunities: InsightBucket;
    recentStatus6: InsightBucket;
    recentStatus11: InsightBucket;
    isLoading: boolean;
  }>({
    newOpportunities: {
      count: 0,
      revenue: 0,
      allocatedRevenue: 0,
      calculatedRevenue: 0,
      filteredData: [],
    },
    recentStatus6: {
      count: 0,
      revenue: 0,
      allocatedRevenue: 0,
      calculatedRevenue: 0,
      filteredData: [],
    },
    recentStatus11: {
      count: 0,
      revenue: 0,
      allocatedRevenue: 0,
      calculatedRevenue: 0,
      filteredData: [],
    },
    isLoading: true,
  });

  useEffect(() => {
    // If no data, reset insights to zero
    if (!data || data.length === 0) {
      setInsights({
        newOpportunities: {
          count: 0,
          revenue: 0,
          allocatedRevenue: 0,
          calculatedRevenue: 0,
          filteredData: [],
        },
        recentStatus6: {
          count: 0,
          revenue: 0,
          allocatedRevenue: 0,
          calculatedRevenue: 0,
          filteredData: [],
        },
        recentStatus11: {
          count: 0,
          revenue: 0,
          allocatedRevenue: 0,
          calculatedRevenue: 0,
          filteredData: [],
        },
        isLoading: false,
      });
      return;
    }

    // Calculate the insights based on the data
    calculateInsights(data);
  }, [data, showNetRevenue]);

  const calculateInsights = (opportunityData: Opportunity[]) => {
    try {
      // Filter opportunities with Status 1 (Lead Identified) or Status 4 (Go Approved)
      const allOpportunities = opportunityData.filter((opp: Opportunity) => opp.status === 1 || opp.status === 4);

      // Filter by Status 6 (Proposal Submitted)
      const status6Opportunities = opportunityData.filter((opp: Opportunity) => opp.status === 6);

      // Filter by Status 11 (Client Tells Us We Have Won)
      const status11Opportunities = opportunityData.filter((opp: Opportunity) => opp.status === 11);

      // Sum up the revenues (original, allocated, and calculated)
      const allOpportunitiesRevenue = allOpportunities.reduce(
        (sum: number, opp: Opportunity) => sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0),
        0
      );
      const allOpportunitiesAllocatedRevenue = allOpportunities.reduce(
        (sum: number, opp: Opportunity) =>
          sum +
          (opp.isAllocated
            ? showNetRevenue
              ? opp.allocatedNetRevenue || 0
              : opp.allocatedGrossRevenue || 0
            : showNetRevenue
              ? opp.netRevenue || 0
              : opp.grossRevenue || 0),
        0
      );
      const allOpportunitiesCalculatedRevenue = allOpportunities.reduce(
        (sum: number, opp: Opportunity) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      const status6Revenue = status6Opportunities.reduce(
        (sum: number, opp: Opportunity) => sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0),
        0
      );
      const status6AllocatedRevenue = status6Opportunities.reduce(
        (sum: number, opp: Opportunity) =>
          sum +
          (opp.isAllocated
            ? showNetRevenue
              ? opp.allocatedNetRevenue || 0
              : opp.allocatedGrossRevenue || 0
            : showNetRevenue
              ? opp.netRevenue || 0
              : opp.grossRevenue || 0),
        0
      );
      const status6CalculatedRevenue = status6Opportunities.reduce(
        (sum: number, opp: Opportunity) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      const status11Revenue = status11Opportunities.reduce(
        (sum: number, opp: Opportunity) => sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0),
        0
      );
      const status11AllocatedRevenue = status11Opportunities.reduce(
        (sum: number, opp: Opportunity) =>
          sum +
          (opp.isAllocated
            ? showNetRevenue
              ? opp.allocatedNetRevenue || 0
              : opp.allocatedGrossRevenue || 0
            : showNetRevenue
              ? opp.netRevenue || 0
              : opp.grossRevenue || 0),
        0
      );
      const status11CalculatedRevenue = status11Opportunities.reduce(
        (sum: number, opp: Opportunity) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Set insights state
      setInsights({
        newOpportunities: {
          count: allOpportunities.length,
          revenue: allOpportunitiesRevenue,
          allocatedRevenue: allOpportunitiesAllocatedRevenue,
          calculatedRevenue: allOpportunitiesCalculatedRevenue,
          filteredData: allOpportunities,
        },
        recentStatus6: {
          count: status6Opportunities.length,
          revenue: status6Revenue,
          allocatedRevenue: status6AllocatedRevenue,
          calculatedRevenue: status6CalculatedRevenue,
          filteredData: status6Opportunities,
        },
        recentStatus11: {
          count: status11Opportunities.length,
          revenue: status11Revenue,
          allocatedRevenue: status11AllocatedRevenue,
          calculatedRevenue: status11CalculatedRevenue,
          filteredData: status11Opportunities,
        },
        isLoading: false,
      });
    } catch {
      setInsights((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Handle clicks on the insights cards to filter opportunities
  const handleInsightClick = (filteredOpportunities: Opportunity[], filterType: string) => {
    if (onFilterChange && filteredOpportunities.length > 0) {
      // Call the parent component's filter function with the filtered data
      onFilterChange(filteredOpportunities, filterType);
    }
  };

  // Check if a filter is active for a specific insight
  const isActiveFilter = (filterType: string) => {
    return activeFilterType === filterType;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        overflow: "visible",
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
        ...animations.cardEntrance(0),
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          minHeight: 36,
        }}
      >
        <Typography variant="h6" gutterBottom fontWeight={700}>
          Pipeline Insights
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              px: 2,
              py: 0.5,
              borderRadius: 2,
            }}
          >
            <AnimatedCount value={data.length} variant="h6" color="primary.main" suffix=" opps" />
          </Box>
          {pipCloseBtn}
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3} sx={{ px: 2, py: 1, "& .MuiGrid-item": { overflow: "visible" } }}>
        {/* New Opportunities - This Month */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("New Opportunities")
                ? alpha(theme.palette.text.primary, 0.12)
                : alpha(theme.palette.text.primary, 0.04),
              height: "100%",
              cursor: "pointer",
              transition:
                "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                transform: "translateY(-4px)",
                boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
              },
              ...animations.cardEntrance(100),
            }}
            onClick={() => handleInsightClick(insights.newOpportunities.filteredData, "New Opportunities")}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Leads
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AnimatedCount value={insights.newOpportunities.count} color="primary.light" />
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <AnimatedCurrency
                value={insights.newOpportunities.revenue}
                variant="body2"
                fontWeight={400}
                color="text.secondary"
              />
              {isAllocated && insights.newOpportunities.allocatedRevenue !== insights.newOpportunities.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <AnimatedCurrency
                    value={insights.newOpportunities.allocatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="secondary.main"
                  />
                </>
              )}
              {showIO && (
                <Typography
                  variant="body2"
                  color="primary.main"
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                >
                  (I&O:{" "}
                  <AnimatedCurrency
                    value={insights.newOpportunities.calculatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="primary.main"
                  />
                  )
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Recent Status 6 - Proposal Submitted (This Month) */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("Proposals Submitted")
                ? alpha(theme.palette.text.primary, 0.12)
                : alpha(theme.palette.text.primary, 0.04),
              height: "100%",
              cursor: "pointer",
              transition:
                "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                transform: "translateY(-4px)",
                boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
              },
              ...animations.cardEntrance(200),
            }}
            onClick={() => handleInsightClick(insights.recentStatus6.filteredData, "Proposals Submitted")}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Proposals Submitted
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AnimatedCount value={insights.recentStatus6.count} color="primary.main" />
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <AnimatedCurrency
                value={insights.recentStatus6.revenue}
                variant="body2"
                fontWeight={400}
                color="text.secondary"
              />
              {isAllocated && insights.recentStatus6.allocatedRevenue !== insights.recentStatus6.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <AnimatedCurrency
                    value={insights.recentStatus6.allocatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="secondary.main"
                  />
                </>
              )}
              {showIO && (
                <Typography
                  variant="body2"
                  color="primary.main"
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                >
                  (I&O:{" "}
                  <AnimatedCurrency
                    value={insights.recentStatus6.calculatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="primary.main"
                  />
                  )
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Recent Status 11 - Client Tells Us We Have Won (This Month) */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("Booking Pending")
                ? alpha(theme.palette.text.primary, 0.12)
                : alpha(theme.palette.text.primary, 0.04),
              height: "100%",
              cursor: "pointer",
              transition:
                "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                transform: "translateY(-4px)",
                boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
              },
              ...animations.cardEntrance(300),
            }}
            onClick={() => handleInsightClick(insights.recentStatus11.filteredData, "Booking Pending")}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Booking Pending
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AnimatedCount value={insights.recentStatus11.count} color="primary.dark" />
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <AnimatedCurrency
                value={insights.recentStatus11.revenue}
                variant="body2"
                fontWeight={400}
                color="text.secondary"
              />
              {isAllocated && insights.recentStatus11.allocatedRevenue !== insights.recentStatus11.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <AnimatedCurrency
                    value={insights.recentStatus11.allocatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="secondary.main"
                  />
                </>
              )}
              {showIO && (
                <Typography
                  variant="body2"
                  color="primary.main"
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                >
                  (I&O:{" "}
                  <AnimatedCurrency
                    value={insights.recentStatus11.calculatedRevenue}
                    variant="body2"
                    fontWeight={400}
                    color="primary.main"
                  />
                  )
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default React.memo(PipelineInsights);
