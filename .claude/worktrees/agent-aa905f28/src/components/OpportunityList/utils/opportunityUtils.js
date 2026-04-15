/**
 * Utility functions for OpportunityList component
 * Performance optimized - pure functions with no side effects
 */

import { EXCLUDED_PARTNER_VALUES } from "../../../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";

/**
 * Get technology partner tags from the partner columns
 * Filters out excluded values and returns unique partners
 * @param {Object} opportunity - The opportunity object
 * @returns {Array<string>} Array of unique technology partner names
 */
export const getTechnologyPartnerTags = (opportunity) => {
  const partners = [
    opportunity["Technology Partner"],
    opportunity["Technology Partner 1"],
    opportunity["Technology Partner 2"],
    opportunity["Technology Partner 3"],
  ].filter((partner) => {
    if (!partner) return false;
    const cleanPartner = String(partner).trim();
    return !EXCLUDED_PARTNER_VALUES.includes(cleanPartner);
  });

  // Remove duplicates and return unique partners
  return [...new Set(partners)];
};

/**
 * Check if opportunity has a specific technology partner
 * Case-insensitive partial match
 * @param {Object} opportunity - The opportunity object
 * @param {string} partnerName - Partner name to search for
 * @returns {boolean} True if partner is found
 */
export const hasTechnologyPartner = (opportunity, partnerName) => {
  const partners = getTechnologyPartnerTags(opportunity);
  return partners.some((partner) => partner && partner.toLowerCase().includes(partnerName.toLowerCase()));
};

/**
 * Get revenue value for sorting based on current mode and settings
 * Supports three modes: total, io (I&O segment), and filtered (allocated)
 * @param {Object} item - The opportunity object
 * @param {boolean} showNetRevenue - Whether to use Net Revenue vs Gross Revenue
 * @param {string} revenueSortMode - Sort mode: 'total', 'io', or 'filtered'
 * @returns {number} Revenue value for sorting
 */
export const getRevenueForSorting = (item, showNetRevenue, revenueSortMode) => {
  const revenueField = showNetRevenue ? "Net Revenue" : "Gross Revenue";
  const allocatedRevenueField = showNetRevenue ? "Allocated Net Revenue" : "Allocated Gross Revenue";

  switch (revenueSortMode) {
    case "total":
      return item[revenueField] || 0;
    case "io":
      return calculateRevenueWithSegmentLogic(item, showNetRevenue);
    case "filtered":
      // If the item has been allocated (filtered), use allocated revenue, otherwise use total
      return item["Is Allocated"] ? item[allocatedRevenueField] || 0 : item[revenueField] || 0;
    default:
      return item[revenueField] || 0;
  }
};

/**
 * Get display label for revenue sort mode
 * @param {string} revenueSortMode - Current sort mode
 * @param {boolean} showNetRevenue - Whether showing Net or Gross revenue
 * @returns {string} Human-readable label
 */
export const getRevenueSortModeLabel = (revenueSortMode, showNetRevenue) => {
  const revenueType = showNetRevenue ? "Net" : "Gross";
  switch (revenueSortMode) {
    case "total":
      return `Total ${revenueType}`;
    case "io":
      return `I&O ${revenueType}`;
    case "filtered":
      return `Filtre ${revenueType}`;
    default:
      return `Total ${revenueType}`;
  }
};
