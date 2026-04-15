import React, { useState, useEffect } from "react";
import { Paper, Typography, Box, Divider, alpha, useTheme, Grid } from "@mui/material";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { formatCurrency } from "../../../utils/formatters";
import { keyframes as animationKeyframes } from "../../../styles/animations";

/**
 * Component that analyzes pipeline data and generates insights
 * Customized to show specific status changes
 */
const PipelineInsights = ({
  data,
  onFilterChange,
  activeFilterType,
  showNetRevenue = false,
  showIO = true,
  isAllocated = false,
}) => {
  const theme = useTheme();
  const [insights, setInsights] = useState({
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
  }, [data]);

  const calculateInsights = (opportunityData) => {
    try {
      // Filter opportunities with Status 1 (Lead Identified) or Status 4 (Go Approved)
      const allOpportunities = opportunityData.filter((opp) => opp.Status === 1 || opp.Status === 4);

      // Filter by Status 6 (Proposal Submitted)
      const status6Opportunities = opportunityData.filter((opp) => opp.Status === 6);

      // Filter by Status 11 (Client Tells Us We Have Won)
      const status11Opportunities = opportunityData.filter((opp) => opp.Status === 11);

      // Sum up the revenues (original, allocated, and calculated)
      const allOpportunitiesRevenue = allOpportunities.reduce(
        (sum, opp) => sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0),
        0
      );
      const allOpportunitiesAllocatedRevenue = allOpportunities.reduce(
        (sum, opp) =>
          sum +
          (opp["Is Allocated"]
            ? showNetRevenue
              ? opp["Allocated Net Revenue"] || 0
              : opp["Allocated Gross Revenue"] || 0
            : showNetRevenue
              ? opp["Net Revenue"] || 0
              : opp["Gross Revenue"] || 0),
        0
      );
      const allOpportunitiesCalculatedRevenue = allOpportunities.reduce(
        (sum, opp) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      const status6Revenue = status6Opportunities.reduce(
        (sum, opp) => sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0),
        0
      );
      const status6AllocatedRevenue = status6Opportunities.reduce(
        (sum, opp) =>
          sum +
          (opp["Is Allocated"]
            ? showNetRevenue
              ? opp["Allocated Net Revenue"] || 0
              : opp["Allocated Gross Revenue"] || 0
            : showNetRevenue
              ? opp["Net Revenue"] || 0
              : opp["Gross Revenue"] || 0),
        0
      );
      const status6CalculatedRevenue = status6Opportunities.reduce(
        (sum, opp) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      const status11Revenue = status11Opportunities.reduce(
        (sum, opp) => sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0),
        0
      );
      const status11AllocatedRevenue = status11Opportunities.reduce(
        (sum, opp) =>
          sum +
          (opp["Is Allocated"]
            ? showNetRevenue
              ? opp["Allocated Net Revenue"] || 0
              : opp["Allocated Gross Revenue"] || 0
            : showNetRevenue
              ? opp["Net Revenue"] || 0
              : opp["Gross Revenue"] || 0),
        0
      );
      const status11CalculatedRevenue = status11Opportunities.reduce(
        (sum, opp) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
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
  const handleInsightClick = (filteredOpportunities, filterType) => {
    if (onFilterChange && filteredOpportunities.length > 0) {
      // Call the parent component's filter function with the filtered data
      onFilterChange(filteredOpportunities, filterType);
    }
  };

  // Check if a filter is active for a specific insight
  const isActiveFilter = (filterType) => {
    return activeFilterType === filterType;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        overflow: "visible",
        transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        },
        ...animationKeyframes.fadeInUp,
        animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms both",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6" gutterBottom fontWeight={700}>
          Pipeline Insights
        </Typography>
        <Box
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            px: 2,
            py: 0.5,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {data.length} opps
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3} sx={{ px: 2, py: 1, "& .MuiGrid-item": { overflow: "visible" } }}>
        {/* New Opportunities - This Month */}
        <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("New Opportunities")
                ? alpha(theme.palette.primary.light, 0.15)
                : alpha(theme.palette.primary.light, 0.08),
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.light, 0.12),
                transform: "translateY(-4px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              },
              ...animationKeyframes.fadeInUp,
              animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 100ms both",
              border: isActiveFilter("New Opportunities") ? `1px solid ${theme.palette.primary.light}` : "none",
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
              <Typography variant="h4" fontWeight={700} color="primary.light">
                {insights.newOpportunities.count}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(insights.newOpportunities.revenue)}
              </Typography>
              {isAllocated && insights.newOpportunities.allocatedRevenue !== insights.newOpportunities.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <Typography variant="body2" color="secondary.main">
                    {formatCurrency(insights.newOpportunities.allocatedRevenue)}
                  </Typography>
                </>
              )}
              {showIO && (
                <Typography variant="body2" color="primary.main">
                  (I&O: {formatCurrency(insights.newOpportunities.calculatedRevenue)})
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Recent Status 6 - Proposal Submitted (This Month) */}
        <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("Proposals Submitted")
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.primary.main, 0.08),
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                transform: "translateY(-4px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              },
              ...animationKeyframes.fadeInUp,
              animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both",
              border: isActiveFilter("Proposals Submitted") ? `1px solid ${theme.palette.primary.main}` : "none",
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
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {insights.recentStatus6.count}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(insights.recentStatus6.revenue)}
              </Typography>
              {isAllocated && insights.recentStatus6.allocatedRevenue !== insights.recentStatus6.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <Typography variant="body2" color="secondary.main">
                    {formatCurrency(insights.recentStatus6.allocatedRevenue)}
                  </Typography>
                </>
              )}
              {showIO && (
                <Typography variant="body2" color="primary.main">
                  (I&O: {formatCurrency(insights.recentStatus6.calculatedRevenue)})
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Recent Status 11 - Client Tells Us We Have Won (This Month) */}
        <Grid item xs={12} sm={6} md={4} sx={{ overflow: "visible" }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isActiveFilter("Booking Pending")
                ? alpha(theme.palette.primary.dark, 0.15)
                : alpha(theme.palette.primary.dark, 0.08),
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.dark, 0.12),
                transform: "translateY(-4px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              },
              ...animationKeyframes.fadeInUp,
              animation: "fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both",
              border: isActiveFilter("Booking Pending") ? `1px solid ${theme.palette.primary.dark}` : "none",
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
              <Typography variant="h4" fontWeight={700} color="primary.dark">
                {insights.recentStatus11.count}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(insights.recentStatus11.revenue)}
              </Typography>
              {isAllocated && insights.recentStatus11.allocatedRevenue !== insights.recentStatus11.revenue && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <Typography variant="body2" color="secondary.main">
                    {formatCurrency(insights.recentStatus11.allocatedRevenue)}
                  </Typography>
                </>
              )}
              {showIO && (
                <Typography variant="body2" color="primary.main">
                  (I&O: {formatCurrency(insights.recentStatus11.calculatedRevenue)})
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
