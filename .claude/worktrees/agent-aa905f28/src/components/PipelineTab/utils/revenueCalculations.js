/**
 * Revenue calculation utilities for PipelineTab
 * Performance-optimized revenue calculation functions
 */

/**
 * Calculate revenue with segment logic
 * Handles special segment codes and service line allocations
 *
 * @param {Object} item - Opportunity item
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Calculated revenue value
 */
export const calculateRevenueWithSegmentLogic = (item, showNetRevenue = false) => {
  // Check if segment code is AUTO, CLR, IEM, or LSC
  const specialSegmentCodes = ["AUTO", "CLR", "IEM", "LSC"];
  const isSpecialSegmentCode = specialSegmentCodes.includes(item["Sub Segment Code"]);

  // If special segment code, return full revenue based on toggle
  if (isSpecialSegmentCode) {
    return showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
  }

  // Check each service line (1, 2, and 3)
  // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
  const serviceLines = [
    { line: item["Service Line 1"], percentage: item["Service Offering 1 %"] || item["Allocation 1"] || 0 },
    { line: item["Service Line 2"], percentage: item["Service Offering 2 %"] || item["Allocation 2"] || 0 },
    { line: item["Service Line 3"], percentage: item["Service Offering 3 %"] || item["Allocation 3"] || 0 },
  ];

  // Get the base revenue value based on toggle
  const baseRevenue = showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;

  // Calculate total allocated revenue for Operations
  const operationsAllocation = serviceLines.reduce((total, service) => {
    if (service.line === "Operations") {
      return total + baseRevenue * (service.percentage / 100);
    }
    return total;
  }, 0);

  // If any Operations allocation is found, return that
  if (operationsAllocation > 0) {
    return operationsAllocation;
  }

  // If no specific Operations allocation, return full revenue
  return 0;
};

/**
 * Get revenue value based on allocation status
 * Performance-optimized with early returns
 *
 * @param {Object} item - Opportunity item
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Revenue value
 */
export const getRevenueValue = (item, showNetRevenue) => {
  if (item["Is Allocated"]) {
    return showNetRevenue ? item["Allocated Net Revenue"] || 0 : item["Allocated Gross Revenue"] || 0;
  }
  return showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
};

/**
 * Calculate base total revenue (non-allocated) from opportunities array
 * Always uses the base revenue, never the allocated revenue
 * Used for showing the total pipeline value before allocation
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Total base revenue
 */
export const calculateBaseTotalRevenue = (opportunities, showNetRevenue) => {
  return opportunities.reduce((sum, item) => {
    return sum + (showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0);
  }, 0);
};

/**
 * Calculate total revenue from opportunities array
 * Uses reduce for optimal performance
 * Uses allocated revenue if available, otherwise base revenue
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Total revenue
 */
export const calculateTotalRevenue = (opportunities, showNetRevenue) => {
  return opportunities.reduce((sum, item) => {
    return sum + getRevenueValue(item, showNetRevenue);
  }, 0);
};

/**
 * Calculate total revenue using segment logic
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Total calculated revenue
 */
export const calculateTotalRevenueWithSegmentLogic = (opportunities, showNetRevenue) => {
  return opportunities.reduce((sum, item) => sum + calculateRevenueWithSegmentLogic(item, showNetRevenue), 0);
};

/**
 * Calculate allocated revenue
 *
 * @param {Array} opportunities - Array of opportunity items
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @returns {number} Total allocated revenue
 */
export const calculateAllocatedRevenue = (opportunities, showNetRevenue) => {
  return opportunities.reduce((sum, item) => {
    const allocatedRevenue = showNetRevenue
      ? typeof item["Allocated Net Revenue"] === "number"
        ? item["Allocated Net Revenue"]
        : 0
      : typeof item["Allocated Gross Revenue"] === "number"
        ? item["Allocated Gross Revenue"]
        : 0;
    return sum + allocatedRevenue;
  }, 0);
};
