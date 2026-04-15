/**
 * Revenue calculation utilities for PipelineTab
 * Performance-optimized revenue calculation functions
 */

// Single source of truth for calculateRevenueWithSegmentLogic — re-export from dataUtils
import { calculateRevenueWithSegmentLogic as _calcRevenue } from "../../../utils/dataUtils";
export const calculateRevenueWithSegmentLogic = _calcRevenue;

export interface OpportunityItem {
  grossRevenue?: number;
  netRevenue?: number;
  isAllocated?: boolean;
  allocatedGrossRevenue?: number;
  allocatedNetRevenue?: number;
  subSegmentCode?: string;
  serviceLine1?: string;
  serviceLine2?: string;
  serviceLine3?: string;
  serviceOffering1Pct?: number;
  serviceOffering2Pct?: number;
  serviceOffering3Pct?: number;
  allocation1?: number;
  allocation2?: number;
  allocation3?: number;
  [key: string]: unknown;
}

/**
 * Get revenue value based on allocation status
 * Performance-optimized with early returns
 */
export const getRevenueValue = (item: OpportunityItem, showNetRevenue: boolean): number => {
  if (item.isAllocated) {
    return showNetRevenue ? item.allocatedNetRevenue || 0 : item.allocatedGrossRevenue || 0;
  }
  return showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0;
};

/**
 * Calculate base total revenue (non-allocated) from opportunities array
 * Always uses the base revenue, never the allocated revenue
 */
export const calculateBaseTotalRevenue = (opportunities: OpportunityItem[], showNetRevenue: boolean): number => {
  return opportunities.reduce((sum, item) => {
    return sum + (showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0);
  }, 0);
};

/**
 * Calculate total revenue from opportunities array
 * Uses allocated revenue if available, otherwise base revenue
 */
export const calculateTotalRevenue = (opportunities: OpportunityItem[], showNetRevenue: boolean): number => {
  return opportunities.reduce((sum, item) => {
    return sum + getRevenueValue(item, showNetRevenue);
  }, 0);
};

/**
 * Calculate total revenue using segment logic
 */
export const calculateTotalRevenueWithSegmentLogic = (
  opportunities: OpportunityItem[],
  showNetRevenue: boolean
): number => {
  return opportunities.reduce((sum, item) => sum + calculateRevenueWithSegmentLogic(item, showNetRevenue), 0);
};

/**
 * Calculate allocated revenue
 */
export const calculateAllocatedRevenue = (opportunities: OpportunityItem[], showNetRevenue: boolean): number => {
  return opportunities.reduce((sum, item) => {
    const allocatedRevenue = showNetRevenue
      ? typeof item.allocatedNetRevenue === "number"
        ? item.allocatedNetRevenue
        : 0
      : typeof item.allocatedGrossRevenue === "number"
        ? item.allocatedGrossRevenue
        : 0;
    return sum + allocatedRevenue;
  }, 0);
};
