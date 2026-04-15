import { useMemo } from "react";

interface RevenueMetrics {
  filteredBookingsTotalRevenue: number;
  filteredLossesTotalRevenue: number;
}

interface AllocationMetrics {
  filteredBookingsAllocatedRevenue: number;
  filteredLossesAllocatedRevenue: number;
  averageBookingSizeTotal: number;
  averageBookingSizeAllocated: number;
  averageLossSizeTotal: number;
  averageLossSizeAllocated: number;
  hasAllocation: boolean;
}

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
export const useDateAnalysis = (
  data: Record<string, any>[] | null,
  dateRange: [Date | null, Date | null],
  showNetRevenue: boolean
): Record<string, any> => {
  // Memoized bookings filtered by date range
  const filteredBookings = useMemo<Record<string, any>[]>(() => {
    if (!data) return [];
    const startDate = dateRange[0] || new Date(new Date().getFullYear(), 0, 1);
    const endDate = dateRange[1] || new Date();

    return data.filter((item: Record<string, any>) => {
      if (item.status !== 14) return false;
      if (!item.bookingDate) return false;
      const statusDate = new Date(item.bookingDate);
      return statusDate >= startDate && statusDate <= endDate;
    });
  }, [data, dateRange]);

  // Memoized losses filtered by date range
  const filteredLosses = useMemo<Record<string, any>[]>(() => {
    if (!data) return [];
    const startDate = dateRange[0] || new Date(new Date().getFullYear(), 0, 1);
    const endDate = dateRange[1] || new Date();

    return data.filter((item: Record<string, any>) => {
      if (item.status !== 15) return false;
      if (!item.bookingDate) return false;
      const statusDate = new Date(item.bookingDate);
      return statusDate >= startDate && statusDate <= endDate;
    });
  }, [data, dateRange]);

  // Memoized revenue calculations
  const revenueMetrics = useMemo<RevenueMetrics>(() => {
    const bookingsTotal = filteredBookings.reduce(
      (sum: number, item: Record<string, any>) =>
        sum + (showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0),
      0
    );

    const lossesTotal = filteredLosses.reduce(
      (sum: number, item: Record<string, any>) =>
        sum + (showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0),
      0
    );

    return {
      filteredBookingsTotalRevenue: bookingsTotal,
      filteredLossesTotalRevenue: lossesTotal,
    };
  }, [filteredBookings, filteredLosses, showNetRevenue]);

  // Memoized ALLOCATED revenues and derived calculations
  const allocationMetrics = useMemo<AllocationMetrics>(() => {
    const bookingsAllocated = filteredBookings.reduce((sum: number, item: Record<string, any>) => {
      if (item.isAllocated) {
        return sum + (showNetRevenue ? item.allocatedNetRevenue || 0 : item.allocatedGrossRevenue || 0);
      } else {
        return sum + (showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0);
      }
    }, 0);

    const lossesAllocated = filteredLosses.reduce((sum: number, item: Record<string, any>) => {
      if (item.isAllocated) {
        return sum + (showNetRevenue ? item.allocatedNetRevenue || 0 : item.allocatedGrossRevenue || 0);
      } else {
        return sum + (showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0);
      }
    }, 0);

    const avgTotal: number =
      filteredBookings.length > 0 ? revenueMetrics.filteredBookingsTotalRevenue / filteredBookings.length : 0;

    const avgAllocated: number = filteredBookings.length > 0 ? bookingsAllocated / filteredBookings.length : 0;

    const avgLossTotal: number =
      filteredLosses.length > 0 ? revenueMetrics.filteredLossesTotalRevenue / filteredLosses.length : 0;

    const avgLossAllocated: number = filteredLosses.length > 0 ? lossesAllocated / filteredLosses.length : 0;

    const hasAlloc: boolean =
      filteredBookings.some((item: Record<string, any>) => item.isAllocated) ||
      filteredLosses.some((item: Record<string, any>) => item.isAllocated);

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
export const formatDateRange = (dateRange: [Date | null, Date | null]): string => {
  const startDate = dateRange[0];
  const endDate = dateRange[1];
  if (startDate && endDate) {
    return `${startDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} - ${endDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return "Selected period";
};
