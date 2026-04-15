import { useMemo } from "react";

/**
 * Hook for date range filtering and opportunity analysis
 *
 * Filters opportunities by date range and calculates:
 * - New bookings (wins) within date range
 * - New losses within date range
 * - Revenue totals for filtered data
 * - Average booking sizes
 * - Allocation status
 *
 * PERFORMANCE: All filtering and calculations are memoized
 */
export const useDateAnalysis = (data, dateRange, showNetRevenue) => {
  // Memoized bookings filtered by date range
  const filteredBookings = useMemo(() => {
    if (!data) return [];
    const startDate = dateRange[0] || new Date(new Date().getFullYear(), 0, 1);
    const endDate = dateRange[1] || new Date();

    return data.filter((item) => {
      if (item["Status"] !== 14) return false;
      if (!item["Booking/Lost Date"]) return false;
      const statusDate = new Date(item["Booking/Lost Date"]);
      return statusDate >= startDate && statusDate <= endDate;
    });
  }, [data, dateRange]);

  // Memoized losses filtered by date range
  const filteredLosses = useMemo(() => {
    if (!data) return [];
    const startDate = dateRange[0] || new Date(new Date().getFullYear(), 0, 1);
    const endDate = dateRange[1] || new Date();

    return data.filter((item) => {
      if (item["Status"] !== 15) return false;
      if (!item["Booking/Lost Date"]) return false;
      const statusDate = new Date(item["Booking/Lost Date"]);
      return statusDate >= startDate && statusDate <= endDate;
    });
  }, [data, dateRange]);

  // Memoized revenue calculations
  const revenueMetrics = useMemo(() => {
    const bookingsTotal = filteredBookings.reduce(
      (sum, item) => sum + (showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0),
      0
    );

    const lossesTotal = filteredLosses.reduce(
      (sum, item) => sum + (showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0),
      0
    );

    return {
      filteredBookingsTotalRevenue: bookingsTotal,
      filteredLossesTotalRevenue: lossesTotal,
    };
  }, [filteredBookings, filteredLosses, showNetRevenue]);

  // Memoized ALLOCATED revenues and derived calculations
  const allocationMetrics = useMemo(() => {
    const bookingsAllocated = filteredBookings.reduce((sum, item) => {
      if (item["Is Allocated"]) {
        return sum + (showNetRevenue ? item["Allocated Net Revenue"] || 0 : item["Allocated Gross Revenue"] || 0);
      } else {
        return sum + (showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0);
      }
    }, 0);

    const lossesAllocated = filteredLosses.reduce((sum, item) => {
      if (item["Is Allocated"]) {
        return sum + (showNetRevenue ? item["Allocated Net Revenue"] || 0 : item["Allocated Gross Revenue"] || 0);
      } else {
        return sum + (showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0);
      }
    }, 0);

    const avgTotal =
      filteredBookings.length > 0 ? revenueMetrics.filteredBookingsTotalRevenue / filteredBookings.length : 0;

    const avgAllocated = filteredBookings.length > 0 ? bookingsAllocated / filteredBookings.length : 0;

    const avgLossTotal =
      filteredLosses.length > 0 ? revenueMetrics.filteredLossesTotalRevenue / filteredLosses.length : 0;

    const avgLossAllocated = filteredLosses.length > 0 ? lossesAllocated / filteredLosses.length : 0;

    const hasAlloc =
      filteredBookings.some((item) => item["Is Allocated"]) || filteredLosses.some((item) => item["Is Allocated"]);

    return {
      filteredBookingsAllocatedRevenue: bookingsAllocated,
      filteredLossesAllocatedRevenue: lossesAllocated,
      averageBookingSizeTotal: avgTotal,
      averageBookingSizeAllocated: avgAllocated,
      averageLossSizeTotal: avgLossTotal,
      averageLossSizeAllocated: avgLossAllocated,
      hasAllocation: hasAlloc,
    };
  }, [filteredBookings, filteredLosses, showNetRevenue, revenueMetrics.filteredBookingsTotalRevenue]);

  return {
    filteredBookings,
    filteredLosses,
    ...revenueMetrics,
    ...allocationMetrics,
  };
};

/**
 * Format date range for display
 */
export const formatDateRange = (dateRange) => {
  const startDate = dateRange[0];
  const endDate = dateRange[1];
  if (startDate && endDate) {
    return `${startDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} - ${endDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return "Période sélectionnée";
};
