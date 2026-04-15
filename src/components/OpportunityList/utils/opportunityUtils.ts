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
export const getTechnologyPartnerTags = (opportunity: Record<string, unknown>): string[] => {
  const partners = [opportunity.techPartner1, opportunity.techPartner2, opportunity.techPartner3].filter((partner) => {
    if (!partner) return false;
    const cleanPartner = String(partner).trim();
    return !EXCLUDED_PARTNER_VALUES.includes(cleanPartner);
  });

  // Remove duplicates and return unique partners
  return [...new Set(partners)] as string[];
};

/**
 * Check if opportunity has a specific technology partner
 * Case-insensitive partial match
 * @param {Object} opportunity - The opportunity object
 * @param {string} partnerName - Partner name to search for
 * @returns {boolean} True if partner is found
 */
export const hasTechnologyPartner = (opportunity: Record<string, unknown>, partnerName: string): boolean => {
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
export const getRevenueForSorting = (
  item: Record<string, unknown>,
  showNetRevenue: boolean,
  revenueSortMode: string
): number => {
  const revenueField = showNetRevenue ? "netRevenue" : "grossRevenue";
  const allocatedRevenueField = showNetRevenue ? "allocatedNetRevenue" : "allocatedGrossRevenue";

  switch (revenueSortMode) {
    case "total":
      return (item[revenueField] as number) || 0;
    case "io":
      return calculateRevenueWithSegmentLogic(item, showNetRevenue);
    case "filtered":
      // If the item has been allocated (filtered), use allocated revenue, otherwise use total
      return item.isAllocated ? (item[allocatedRevenueField] as number) || 0 : (item[revenueField] as number) || 0;
    default:
      return (item[revenueField] as number) || 0;
  }
};

/**
 * Get display label for revenue sort mode
 * @param {string} revenueSortMode - Current sort mode
 * @param {boolean} showNetRevenue - Whether showing Net or Gross revenue
 * @returns {string} Human-readable label
 */
export const getRevenueSortModeLabel = (revenueSortMode: string, showNetRevenue: boolean): string => {
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
