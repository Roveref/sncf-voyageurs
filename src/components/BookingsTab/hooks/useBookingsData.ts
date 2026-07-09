import { useMemo } from "react";
import {
  sumBy,
  getMonthlyYearlyTotals,
  formatYearOverYearData,
  calculateRevenueWithSegmentLogic,
} from "../../../utils/dataUtils";
import { calculateCumulativeTotals } from "../utils/bookingsCalculations";

/** CRM opportunity record used across bookings/pipeline */
export interface OpportunityRecord {
  opportunity?: string;
  opportunityId?: string;
  account?: string;
  status?: number;
  grossRevenue?: number;
  netRevenue?: number;
  allocatedGrossRevenue?: number;
  allocatedNetRevenue?: number;
  isAllocated?: boolean;
  bookingDate?: string;
  serviceLine1?: string;
  subSegmentCode?: string;
  manager?: string;
  em?: string;
  [key: string]: unknown;
}

/** Monthly total entry */
interface MonthlyTotal {
  year: number;
  month: number;
  total: number;
  [key: string]: unknown;
}

/** Year-over-year data point */
interface YoYDataPoint {
  month: number;
  monthName: string;
  [key: string]: unknown;
}

/** Service line / segment grouping */
interface GroupedEntry {
  name: string;
  value: number;
  count: number;
}

/**
 * Hook for processing and calculating booking data
 *
 * Handles:
 * - Filtering booked and Status 11 opportunities
 * - Monthly and yearly aggregations
 * - Cumulative calculations
 * - Service line grouping
 *
 * PERFORMANCE: All calculations are memoized to prevent unnecessary recomputation
 */
export const useBookingsData = (
  data: OpportunityRecord[],
  loading: boolean,
  showNetRevenue: boolean,
  includeStatus11: boolean
) => {
  // Interventions réalisées (données manuelles = user_assets)
  const bookedData = useMemo((): OpportunityRecord[] => {
    if (!data || loading) return [];
    return data.filter((item) => item.isManual === true && item.status !== 15);
  }, [data, loading]);

  // Interventions annulées
  const lostData = useMemo((): OpportunityRecord[] => {
    if (!data || loading) return [];
    return data.filter((item) => item.isManual === true && item.status === 15);
  }, [data, loading]);

  // Interventions en préparation (status 11)
  const status11Data = useMemo((): OpportunityRecord[] => {
    if (!data || loading) return [];
    return data.filter((item) => item.isManual === true && item.status === 11);
  }, [data, loading]);

  // Calculate total bookings
  const totalBookings = useMemo((): number => {
    if (!data || loading) return 0;
    return sumBy(data, showNetRevenue ? "netRevenue" : "grossRevenue");
  }, [data, loading, showNetRevenue]);

  // Calculate monthly totals for bookings
  const monthlyTotals = useMemo((): MonthlyTotal[] => {
    if (!bookedData || bookedData.length === 0) return [];
    return getMonthlyYearlyTotals(
      bookedData,
      "bookingDate",
      showNetRevenue ? "netRevenue" : "grossRevenue"
    ) as MonthlyTotal[];
  }, [bookedData, showNetRevenue]);

  // Calculate monthly totals for losses
  const monthlyLossTotals = useMemo((): MonthlyTotal[] => {
    if (!lostData || lostData.length === 0) return [];
    return getMonthlyYearlyTotals(
      lostData,
      "bookingDate",
      showNetRevenue ? "netRevenue" : "grossRevenue"
    ) as MonthlyTotal[];
  }, [lostData, showNetRevenue]);

  // Extract unique years from bookings data - always include current year
  const years = useMemo((): number[] => {
    const currentYear = new Date().getFullYear();
    const dataYears =
      monthlyTotals && monthlyTotals.length > 0 ? [...new Set(monthlyTotals.map((item) => item.year))] : [];
    // Always include current year even if no data
    if (!dataYears.includes(currentYear)) {
      dataYears.push(currentYear);
    }
    return dataYears.sort();
  }, [monthlyTotals]);

  // Extract unique years from losses data
  const lossYears = useMemo((): number[] => {
    if (!monthlyLossTotals || monthlyLossTotals.length === 0) return [];
    return [...new Set(monthlyLossTotals.map((item) => item.year))].sort();
  }, [monthlyLossTotals]);

  // Format year-over-year data for bookings - ensure current year exists
  const yoyBookings = useMemo((): YoYDataPoint[] => {
    const currentYear = new Date().getFullYear();
    let result: YoYDataPoint[] =
      monthlyTotals && monthlyTotals.length > 0 ? (formatYearOverYearData(monthlyTotals) as YoYDataPoint[]) : [];

    // If no data at all, create empty month structure with current year
    if (result.length === 0) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      result = months.map((monthName, index) => ({
        month: index + 1,
        monthName,
        [currentYear]: 0,
        [`${currentYear}Opps`]: [],
      }));
    } else {
      // Ensure current year keys exist in all months
      result = result.map((monthData) => {
        if (monthData[currentYear] === undefined) {
          return {
            ...monthData,
            [currentYear]: 0,
            [`${currentYear}Opps`]: [],
          };
        }
        return monthData;
      });
    }

    return result;
  }, [monthlyTotals]);

  // Format year-over-year data for losses
  const yoyLosses = useMemo((): YoYDataPoint[] => {
    if (!monthlyLossTotals || monthlyLossTotals.length === 0) return [];
    return formatYearOverYearData(monthlyLossTotals) as YoYDataPoint[];
  }, [monthlyLossTotals]);

  // Calculate cumulative data for bookings (expensive operation - memoized)
  const cumulativeData = useMemo((): YoYDataPoint[] => {
    if (!yoyBookings || yoyBookings.length === 0 || years.length === 0) return [];
    return calculateCumulativeTotals(
      yoyBookings,
      status11Data,
      includeStatus11,
      years,
      showNetRevenue
    ) as YoYDataPoint[];
  }, [yoyBookings, status11Data, includeStatus11, years, showNetRevenue]);

  // Calculate cumulative data for losses (expensive operation - memoized)
  const cumulativeLossData = useMemo((): YoYDataPoint[] => {
    if (!yoyLosses || yoyLosses.length === 0 || lossYears.length === 0) return [];
    return calculateCumulativeTotals(
      yoyLosses,
      [], // No status 11 equivalent for losses
      false,
      lossYears,
      showNetRevenue
    ) as YoYDataPoint[];
  }, [yoyLosses, lossYears, showNetRevenue]);

  // Group bookings by service line for pie chart
  const bookingsByServiceLine = useMemo((): GroupedEntry[] => {
    if (!bookedData || bookedData.length === 0) return [];

    const byServiceLine: GroupedEntry[] = [];
    const serviceLinesMap: Record<string, GroupedEntry> = {};

    bookedData.forEach((opp) => {
      const serviceLine = opp.serviceLine1 as string;
      if (!serviceLine) return;

      const revenue = opp.isAllocated
        ? showNetRevenue
          ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue || 0
          : opp.allocatedGrossRevenue || 0
        : showNetRevenue
          ? opp.netRevenue || 0
          : opp.grossRevenue || 0;

      if (!serviceLinesMap[serviceLine]) {
        serviceLinesMap[serviceLine] = {
          name: serviceLine,
          value: 0,
          count: 0,
        };
        byServiceLine.push(serviceLinesMap[serviceLine]);
      }

      serviceLinesMap[serviceLine].value += Number(revenue || 0);
      serviceLinesMap[serviceLine].count += 1;
    });

    // Sort by value descending
    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [bookedData, showNetRevenue]);

  // Group losses by service line for pie chart
  const lossesByServiceLine = useMemo((): GroupedEntry[] => {
    if (!lostData || lostData.length === 0) return [];

    const byServiceLine: GroupedEntry[] = [];
    const serviceLinesMap: Record<string, GroupedEntry> = {};

    lostData.forEach((opp) => {
      const serviceLine = opp.serviceLine1 as string;
      if (!serviceLine) return;

      const revenue = opp.isAllocated
        ? showNetRevenue
          ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue || 0
          : opp.allocatedGrossRevenue || 0
        : showNetRevenue
          ? opp.netRevenue || 0
          : opp.grossRevenue || 0;

      if (!serviceLinesMap[serviceLine]) {
        serviceLinesMap[serviceLine] = {
          name: serviceLine,
          value: 0,
          count: 0,
        };
        byServiceLine.push(serviceLinesMap[serviceLine]);
      }

      serviceLinesMap[serviceLine].value += Number(revenue || 0);
      serviceLinesMap[serviceLine].count += 1;
    });

    // Sort by value descending
    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [lostData, showNetRevenue]);

  // Group bookings by segment (Sub Segment Code)
  const bookingsBySegment = useMemo((): GroupedEntry[] => {
    if (!bookedData || bookedData.length === 0) return [];

    const bySegment: GroupedEntry[] = [];
    const segmentsMap: Record<string, GroupedEntry> = {};

    bookedData.forEach((opp) => {
      const segment = opp.subSegmentCode as string;
      if (!segment) return;

      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          count: 0,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += Number(revenue || 0);
      segmentsMap[segment].count += 1;
    });

    // Sort by value descending
    bySegment.sort((a, b) => b.value - a.value);
    return bySegment;
  }, [bookedData, showNetRevenue]);

  // Group losses by segment (Sub Segment Code)
  const lossesBySegment = useMemo((): GroupedEntry[] => {
    if (!lostData || lostData.length === 0) return [];

    const bySegment: GroupedEntry[] = [];
    const segmentsMap: Record<string, GroupedEntry> = {};

    lostData.forEach((opp) => {
      const segment = opp.subSegmentCode as string;
      if (!segment) return;

      const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          count: 0,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += Number(revenue || 0);
      segmentsMap[segment].count += 1;
    });

    // Sort by value descending
    bySegment.sort((a, b) => b.value - a.value);
    return bySegment;
  }, [lostData, showNetRevenue]);

  return {
    bookedData,
    lostData,
    status11Data,
    totalBookings,
    monthlyTotals,
    monthlyLossTotals,
    years,
    lossYears,
    yoyBookings,
    yoyLosses,
    cumulativeData,
    cumulativeLossData,
    bookingsByServiceLine,
    lossesByServiceLine,
    bookingsBySegment,
    lossesBySegment,
  };
};
