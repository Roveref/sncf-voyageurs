import { useMemo } from "react";
import {
  sumBy,
  getMonthlyYearlyTotals,
  formatYearOverYearData,
  calculateRevenueWithSegmentLogic,
} from "../../../utils/dataUtils";
import { calculateCumulativeTotals } from "../utils/bookingsCalculations";

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
export const useBookingsData = (data, loading, showNetRevenue, includeStatus11) => {
  // Filter booked opportunities (Status 14)
  const bookedData = useMemo(() => {
    if (!data || loading) return [];
    return data.filter((item) => item["Status"] === 14);
  }, [data, loading]);

  // Filter lost opportunities (Status 15)
  const lostData = useMemo(() => {
    if (!data || loading) return [];
    return data.filter((item) => item["Status"] === 15);
  }, [data, loading]);

  // Filter Status 11 opportunities
  const status11Data = useMemo(() => {
    if (!data || loading) return [];
    return data.filter((item) => item["Status"] === 11);
  }, [data, loading]);

  // Calculate total bookings
  const totalBookings = useMemo(() => {
    if (!data || loading) return 0;
    return sumBy(data, showNetRevenue ? "Net Revenue" : "Gross Revenue");
  }, [data, loading, showNetRevenue]);

  // Calculate monthly totals for bookings
  const monthlyTotals = useMemo(() => {
    if (!bookedData || bookedData.length === 0) return [];
    return getMonthlyYearlyTotals(bookedData, "Booking/Lost Date", showNetRevenue ? "Net Revenue" : "Gross Revenue");
  }, [bookedData, showNetRevenue]);

  // Calculate monthly totals for losses
  const monthlyLossTotals = useMemo(() => {
    if (!lostData || lostData.length === 0) return [];
    return getMonthlyYearlyTotals(lostData, "Booking/Lost Date", showNetRevenue ? "Net Revenue" : "Gross Revenue");
  }, [lostData, showNetRevenue]);

  // Extract unique years from bookings data - always include current year
  const years = useMemo(() => {
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
  const lossYears = useMemo(() => {
    if (!monthlyLossTotals || monthlyLossTotals.length === 0) return [];
    return [...new Set(monthlyLossTotals.map((item) => item.year))].sort();
  }, [monthlyLossTotals]);

  // Format year-over-year data for bookings - ensure current year exists
  const yoyBookings = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let result = monthlyTotals && monthlyTotals.length > 0 ? formatYearOverYearData(monthlyTotals) : [];

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
  const yoyLosses = useMemo(() => {
    if (!monthlyLossTotals || monthlyLossTotals.length === 0) return [];
    return formatYearOverYearData(monthlyLossTotals);
  }, [monthlyLossTotals]);

  // Calculate cumulative data for bookings (expensive operation - memoized)
  const cumulativeData = useMemo(() => {
    if (!yoyBookings || yoyBookings.length === 0 || years.length === 0) return [];
    return calculateCumulativeTotals(yoyBookings, status11Data, includeStatus11, years, showNetRevenue);
  }, [yoyBookings, status11Data, includeStatus11, years, showNetRevenue]);

  // Calculate cumulative data for losses (expensive operation - memoized)
  const cumulativeLossData = useMemo(() => {
    if (!yoyLosses || yoyLosses.length === 0 || lossYears.length === 0) return [];
    return calculateCumulativeTotals(
      yoyLosses,
      [], // No status 11 equivalent for losses
      false,
      lossYears,
      showNetRevenue
    );
  }, [yoyLosses, lossYears, showNetRevenue]);

  // Group bookings by service line for pie chart
  const bookingsByServiceLine = useMemo(() => {
    if (!bookedData || bookedData.length === 0) return [];

    const byServiceLine = [];
    const serviceLinesMap = {};

    bookedData.forEach((opp) => {
      const serviceLine = opp["Service Line 1"];
      if (!serviceLine) return;

      const revenue =
        opp["Is Allocated"] && opp["Allocated Gross Revenue"]
          ? opp["Allocated Gross Revenue"]
          : opp["Gross Revenue"] || 0;

      if (!serviceLinesMap[serviceLine]) {
        serviceLinesMap[serviceLine] = {
          name: serviceLine,
          value: 0,
          count: 0,
        };
        byServiceLine.push(serviceLinesMap[serviceLine]);
      }

      serviceLinesMap[serviceLine].value += revenue;
      serviceLinesMap[serviceLine].count += 1;
    });

    // Sort by value descending
    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [bookedData]);

  // Group losses by service line for pie chart
  const lossesByServiceLine = useMemo(() => {
    if (!lostData || lostData.length === 0) return [];

    const byServiceLine = [];
    const serviceLinesMap = {};

    lostData.forEach((opp) => {
      const serviceLine = opp["Service Line 1"];
      if (!serviceLine) return;

      const revenue =
        opp["Is Allocated"] && opp["Allocated Gross Revenue"]
          ? opp["Allocated Gross Revenue"]
          : opp["Gross Revenue"] || 0;

      if (!serviceLinesMap[serviceLine]) {
        serviceLinesMap[serviceLine] = {
          name: serviceLine,
          value: 0,
          count: 0,
        };
        byServiceLine.push(serviceLinesMap[serviceLine]);
      }

      serviceLinesMap[serviceLine].value += revenue;
      serviceLinesMap[serviceLine].count += 1;
    });

    // Sort by value descending
    byServiceLine.sort((a, b) => b.value - a.value);
    return byServiceLine;
  }, [lostData]);

  // Group bookings by segment (Sub Segment Code)
  const bookingsBySegment = useMemo(() => {
    if (!bookedData || bookedData.length === 0) return [];

    const bySegment = [];
    const segmentsMap = {};

    bookedData.forEach((opp) => {
      const segment = opp["Sub Segment Code"];
      if (!segment) return;

      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          count: 0,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += revenue;
      segmentsMap[segment].count += 1;
    });

    // Sort by value descending
    bySegment.sort((a, b) => b.value - a.value);
    return bySegment;
  }, [bookedData, showNetRevenue]);

  // Group losses by segment (Sub Segment Code)
  const lossesBySegment = useMemo(() => {
    if (!lostData || lostData.length === 0) return [];

    const bySegment = [];
    const segmentsMap = {};

    lostData.forEach((opp) => {
      const segment = opp["Sub Segment Code"];
      if (!segment) return;

      const revenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;

      if (!segmentsMap[segment]) {
        segmentsMap[segment] = {
          name: segment,
          value: 0,
          count: 0,
        };
        bySegment.push(segmentsMap[segment]);
      }

      segmentsMap[segment].value += revenue;
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
