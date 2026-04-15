/**
 * Size calculation utilities for PipelineTab
 * Performance-optimized median and distribution calculations
 */

import { alpha } from "@mui/material";
import { SIZE_RANGES } from "./constants";
import { getRevenueValue, calculateRevenueWithSegmentLogic } from "./revenueCalculations";

/**
 * Calculate median opportunity size
 * Performance-optimized sorting and calculation
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Median opportunity size
 */
export const calculateMedianOpportunitySize = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) return 0;

  // Get revenue values, filter out zeros, and sort them
  const revenueValues = opportunities
    .map((opp) => getRevenueValue(opp, showNetRevenue))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const len = revenueValues.length;

  // If no valid values, return 0
  if (len === 0) return 0;

  // Calculate median
  if (len % 2 === 0) {
    // Even number of items
    return (revenueValues[len / 2 - 1] + revenueValues[len / 2]) / 2;
  } else {
    // Odd number of items
    return revenueValues[Math.floor(len / 2)];
  }
};

/**
 * Calculate filtered median opportunity size (using allocated revenue)
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Filtered median opportunity size
 */
export const calculateFilteredMedianOpportunitySize = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) return 0;

  // Get allocated revenue values, filter out zeros, and sort them
  const revenueValues = opportunities
    .map((opp) => {
      // Use allocated revenue values for the filtered median
      return showNetRevenue ? opp["Allocated Net Revenue"] || 0 : opp["Allocated Gross Revenue"] || 0;
    })
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const len = revenueValues.length;

  // If no valid values, return 0
  if (len === 0) return 0;

  // Calculate median
  if (len % 2 === 0) {
    // Even number of items
    return (revenueValues[len / 2 - 1] + revenueValues[len / 2]) / 2;
  } else {
    // Odd number of items
    return revenueValues[Math.floor(len / 2)];
  }
};

/**
 * Calculate size distribution for opportunities
 * Performance-optimized with single pass through data
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {Object} theme - MUI theme object for colors
 * @returns {Array} Size distribution data
 */
export const calculateSizeDistribution = (opportunities, showNetRevenue, theme) => {
  // Define size ranges with theme colors
  const ranges = [
    {
      name: SIZE_RANGES.small.name,
      min: SIZE_RANGES.small.min,
      max: SIZE_RANGES.small.max,
      count: 0,
      value: 0,
      allocatedValue: 0,
      calculatedValue: 0,
      color: theme.palette.primary.light,
    },
    {
      name: SIZE_RANGES.medium.name,
      min: SIZE_RANGES.medium.min,
      max: SIZE_RANGES.medium.max,
      count: 0,
      value: 0,
      allocatedValue: 0,
      calculatedValue: 0,
      color: theme.palette.primary.main,
    },
    {
      name: SIZE_RANGES.large.name,
      min: SIZE_RANGES.large.min,
      max: SIZE_RANGES.large.max,
      count: 0,
      value: 0,
      allocatedValue: 0,
      calculatedValue: 0,
      color: theme.palette.primary.dark,
    },
  ];

  // Calculate counts and values for each range (single pass)
  opportunities.forEach((opp) => {
    // Always use the base revenue (total amount before allocation)
    const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
    const allocatedRevenue = opp["Is Allocated"]
      ? showNetRevenue
        ? opp["Allocated Net Revenue"] || 0
        : opp["Allocated Gross Revenue"] || 0
      : revenue;
    const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

    for (const range of ranges) {
      if (revenue >= range.min && revenue < range.max) {
        range.count++;
        range.value += revenue;
        range.allocatedValue += allocatedRevenue;
        range.calculatedValue += calculatedRevenue;
        break;
      }
    }
  });

  // Calculate percentages
  const totalValue = ranges.reduce((sum, range) => sum + range.value, 0);
  ranges.forEach((range) => {
    range.percentage = totalValue > 0 ? (range.value / totalValue) * 100 : 0;
  });

  return ranges;
};

/**
 * Calculate min and max opportunity sizes
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Object} Object with min and max values
 */
export const calculateMinMaxOpportunitySize = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) {
    return { min: 0, max: 0 };
  }

  const revenueValues = opportunities.map((opp) => getRevenueValue(opp, showNetRevenue)).filter((value) => value > 0);

  if (revenueValues.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...revenueValues),
    max: Math.max(...revenueValues),
  };
};

/**
 * Calculate standard deviation of opportunity sizes
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {number} average - Pre-calculated average (for performance)
 * @returns {number} Standard deviation
 */
export const calculateStandardDeviation = (opportunities, showNetRevenue, average) => {
  if (!opportunities || opportunities.length === 0) return 0;

  const revenueValues = opportunities.map((opp) => getRevenueValue(opp, showNetRevenue)).filter((value) => value > 0);

  if (revenueValues.length === 0) return 0;

  const squaredDifferences = revenueValues.map((value) => Math.pow(value - average, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / revenueValues.length;

  return Math.sqrt(variance);
};

/**
 * Calculate Pareto analysis (Top 20% concentration)
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Object} Object with top20Count, top20Revenue, and top20Percentage
 */
export const calculateParetoConcentration = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) {
    return { top20Count: 0, top20Revenue: 0, top20Percentage: 0 };
  }

  // Sort opportunities by revenue (descending)
  const sortedOpportunities = [...opportunities]
    .map((opp) => ({
      opp,
      revenue: getRevenueValue(opp, showNetRevenue),
    }))
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (sortedOpportunities.length === 0) {
    return { top20Count: 0, top20Revenue: 0, top20Percentage: 0 };
  }

  // Calculate total revenue
  const totalRevenue = sortedOpportunities.reduce((sum, item) => sum + item.revenue, 0);

  // Get top 20% of opportunities
  const top20Count = Math.ceil(sortedOpportunities.length * 0.2);
  const top20Opportunities = sortedOpportunities.slice(0, top20Count);

  // Calculate top 20% revenue
  const top20Revenue = top20Opportunities.reduce((sum, item) => sum + item.revenue, 0);
  const top20Percentage = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;

  return {
    top20Count,
    top20Revenue,
    top20Percentage,
  };
};

/**
 * Calculate min and max opportunity sizes using I&O logic
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Object} Object with min and max values
 */
export const calculateMinMaxOpportunitySizeIO = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) {
    return { min: 0, max: 0 };
  }

  const revenueValues = opportunities
    .map((opp) => calculateRevenueWithSegmentLogic(opp, showNetRevenue))
    .filter((value) => value > 0);

  if (revenueValues.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...revenueValues),
    max: Math.max(...revenueValues),
  };
};

/**
 * Calculate median opportunity size using I&O logic
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Median opportunity size
 */
export const calculateMedianOpportunitySizeIO = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) return 0;

  const revenueValues = opportunities
    .map((opp) => calculateRevenueWithSegmentLogic(opp, showNetRevenue))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const len = revenueValues.length;

  if (len === 0) return 0;

  if (len % 2 === 0) {
    return (revenueValues[len / 2 - 1] + revenueValues[len / 2]) / 2;
  } else {
    return revenueValues[Math.floor(len / 2)];
  }
};

/**
 * Calculate Pareto analysis for I&O opportunities (Top 20% concentration)
 * Only considers opportunities with I&O > 0
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {Object} Object with top20Count, top20Revenue, and top20Percentage
 */
export const calculateParetoConcentrationIO = (opportunities, showNetRevenue) => {
  if (!opportunities || opportunities.length === 0) {
    return { top20Count: 0, top20Revenue: 0, top20Percentage: 0 };
  }

  // Sort opportunities by I&O revenue (descending), only including those with I&O > 0
  const sortedOpportunities = [...opportunities]
    .map((opp) => ({
      opp,
      revenue: calculateRevenueWithSegmentLogic(opp, showNetRevenue),
    }))
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (sortedOpportunities.length === 0) {
    return { top20Count: 0, top20Revenue: 0, top20Percentage: 0 };
  }

  // Calculate total I&O revenue
  const totalRevenue = sortedOpportunities.reduce((sum, item) => sum + item.revenue, 0);

  // Get top 20% of I&O opportunities
  const top20Count = Math.ceil(sortedOpportunities.length * 0.2);
  const top20Opportunities = sortedOpportunities.slice(0, top20Count);

  // Calculate top 20% I&O revenue
  const top20Revenue = top20Opportunities.reduce((sum, item) => sum + item.revenue, 0);
  const top20Percentage = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;

  return {
    top20Count,
    top20Revenue,
    top20Percentage,
  };
};
