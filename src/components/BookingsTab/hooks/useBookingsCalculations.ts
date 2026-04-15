import { useMemo } from "react";
import {
  calculateRevenueWithSegmentLogic,
  getMonthlyYearlyTotals,
  formatYearOverYearData,
} from "../../../utils/dataUtils";

/**
 * Hook optimisé pour les calculs lourds de bookings
 * Memoizes calculateCumulativeTotals to avoid unnecessary recalculations
 */
export const useBookingsCalculations = (
  bookingsData: any[],
  status11Data: any[],
  includeStatus11: boolean,
  years: number[],
  showNetRevenue: boolean
) => {
  // Memoize calculateCumulativeTotals - critical function that was called on every render
  const cumulativeTotals = useMemo((): any[] => {
    return calculateCumulativeTotals(bookingsData, status11Data, includeStatus11, years, showNetRevenue);
  }, [bookingsData, status11Data, includeStatus11, years, showNetRevenue]);

  return {
    cumulativeTotals,
  };
};

/**
 * Calculate cumulative data for years
 * OPTIMISÉ : Cette fonction est maintenant mémoïsée via useMemo dans le hook
 */
function calculateCumulativeTotals(
  bookingsData: any[],
  status11Data: any[] = [],
  includeStatus11: boolean = false,
  yearsParam: number[] | null = null,
  showNetRevenue: boolean = false
): any[] {
  if (!bookingsData || !Array.isArray(bookingsData) || bookingsData.length === 0) {
    return [];
  }

  if (!yearsParam || yearsParam.length === 0) {
    return bookingsData;
  }

  // Running accumulators per year (O(n) instead of O(n²) slice+reduce)
  const runningValue: Record<number, number> = {};
  const runningOpps: Record<number, any[]> = {};
  const runningIO: Record<number, number> = {};
  yearsParam.forEach((year) => {
    runningValue[year] = 0;
    runningOpps[year] = [];
    runningIO[year] = 0;
  });

  const result = bookingsData.map((monthData, _index) => {
    const cumulativeMonth = { ...monthData };

    yearsParam.forEach((year) => {
      if (!monthData) return;

      const monthlyOpps = monthData[`${year}Opps`] || [];

      // Calculate I&O revenue for this month
      const monthlyIORevenue = monthlyOpps.reduce(
        (sum: number, opp: Record<string, any>) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Calculate total revenue for this month
      const monthlyTotalRevenue = monthData[year] || 0;

      // Calculate complement (total - I&O)
      const monthlyComplement = Math.max(0, monthlyTotalRevenue - monthlyIORevenue);

      // Add monthly breakdown
      cumulativeMonth[`${year}_io`] = monthlyIORevenue;
      cumulativeMonth[`${year}_complement`] = monthlyComplement;

      // Incremental cumulative value
      runningValue[year] += monthlyTotalRevenue;
      cumulativeMonth[`${year}_cumulative`] = runningValue[year];

      // Incremental cumulative opportunities list
      runningOpps[year] = [...runningOpps[year], ...monthlyOpps];
      cumulativeMonth[`${year}Opps_cumulative`] = runningOpps[year];

      // Incremental cumulative I&O revenue
      runningIO[year] += monthlyIORevenue;
      cumulativeMonth[`${year}_io_cumulative`] = runningIO[year];
    });

    return cumulativeMonth;
  });

  // Process Status 11 data
  if (status11Data && status11Data.length > 0) {
    const monthlyStatus11 = getMonthlyYearlyTotals(
      status11Data,
      "estimatedBookingDate",
      showNetRevenue ? "netRevenue" : "grossRevenue"
    );

    const yoyStatus11Data = formatYearOverYearData(monthlyStatus11);

    yearsParam.forEach((year) => {
      result.forEach((monthData, index) => {
        const correspondingStatus11Month = yoyStatus11Data.find(
          (s11Month) => s11Month.month === monthData.month && s11Month.monthName === monthData.monthName
        );

        if (correspondingStatus11Month) {
          const monthlyStatus11Opps = correspondingStatus11Month[`${year}Opps`] || [];
          const monthlyStatus11Total = correspondingStatus11Month[year] || 0;

          const cumulativeStatus11Opps = yoyStatus11Data
            .filter((s11Month) => s11Month.month <= monthData.month)
            .flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);

          const cumulativeStatus11Total = yoyStatus11Data
            .filter((s11Month) => s11Month.month <= monthData.month)
            .reduce((sum, prevMonth) => sum + (prevMonth[year] || 0), 0);

          const monthlyStatus11IO = monthlyStatus11Opps.reduce((sum: number, opp: Record<string, any>) => {
            return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
          }, 0);

          const cumulativeStatus11IO = cumulativeStatus11Opps.reduce((sum: number, opp: Record<string, any>) => {
            return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
          }, 0);

          const monthlyStatus11Filtered = monthlyStatus11Opps.reduce((sum: number, opp: Record<string, any>) => {
            if (opp.isAllocated) {
              return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0);
            } else {
              return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
            }
          }, 0);

          const cumulativeStatus11Filtered = cumulativeStatus11Opps.reduce((sum: number, opp: Record<string, any>) => {
            if (opp.isAllocated) {
              return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0);
            } else {
              return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
            }
          }, 0);

          const monthlyStatus11Complement = Math.max(0, monthlyStatus11Total - monthlyStatus11IO);
          const cumulativeStatus11Complement = Math.max(0, cumulativeStatus11Total - cumulativeStatus11IO);

          const monthlyStatus11IOComplementFromFiltered = Math.max(0, monthlyStatus11IO - monthlyStatus11Filtered);
          const monthlyStatus11TotalComplementFromIO = Math.max(0, monthlyStatus11Total - monthlyStatus11IO);
          const monthlyStatus11TotalComplementFromFiltered = Math.max(
            0,
            monthlyStatus11Total - monthlyStatus11Filtered
          );

          // Assign all values
          monthData[`${year}Status11Opps`] = monthlyStatus11Opps;
          monthData[`${year}Status11Opps_cumulative`] = cumulativeStatus11Opps;
          monthData[`${year}_status11`] = monthlyStatus11Total;
          monthData[`${year}_status11_cumulative`] = cumulativeStatus11Total;
          monthData[`${year}_status11_io`] = monthlyStatus11IO;
          monthData[`${year}_status11_io_cumulative`] = cumulativeStatus11IO;
          monthData[`${year}_status11_complement`] = monthlyStatus11Complement;
          monthData[`${year}_status11_complement_cumulative`] = cumulativeStatus11Complement;
          monthData[`${year}_status11_filtered_monthly`] = monthlyStatus11Filtered;
          monthData[`${year}_status11_filtered_cumulative`] = cumulativeStatus11Filtered;
          monthData[`${year}_status11_io_complement_from_filtered`] = monthlyStatus11IOComplementFromFiltered;
          monthData[`${year}_status11_total_complement_from_io`] = monthlyStatus11TotalComplementFromIO;
          monthData[`${year}_status11_total_complement_from_filtered`] = monthlyStatus11TotalComplementFromFiltered;
          monthData[`${year}_status11_total_monthly`] = monthlyStatus11IO + monthlyStatus11Complement;

          // Add combined values (bookings + status 11) if toggle is active
          if (includeStatus11) {
            const currentMonthlyIO = monthData[`${year}_io`] || 0;
            const currentMonthlyComplement = monthData[`${year}_complement`] || 0;
            const currentMonthlyTotal = currentMonthlyIO + currentMonthlyComplement;
            const currentFilteredMonthly = monthData[`${year}_filtered_monthly`] || 0;

            // Combined monthly values
            monthData[`${year}_combined_io`] = currentMonthlyIO + monthlyStatus11IO;
            monthData[`${year}_combined_total`] = currentMonthlyTotal + monthlyStatus11Total;
            monthData[`${year}_combined_complement`] =
              monthData[`${year}_combined_total`] - monthData[`${year}_combined_io`];

            // Combined cumulative values
            monthData[`${year}_combined_cumulative`] = (monthData[`${year}_cumulative`] || 0) + cumulativeStatus11Total;
            monthData[`${year}_combined_io_cumulative`] =
              (monthData[`${year}_io_cumulative`] || 0) + cumulativeStatus11IO;

            // Calculate complements correctly for stacking
            monthData[`${year}_combined_io_complement_from_filtered`] = Math.max(
              0,
              monthData[`${year}_combined_io`] - monthData[`${year}_combined_filtered`]
            );
            monthData[`${year}_combined_total_complement_from_io`] = Math.max(
              0,
              monthData[`${year}_combined_total`] - monthData[`${year}_combined_io`]
            );
            monthData[`${year}_combined_total_complement_from_filtered`] = Math.max(
              0,
              monthData[`${year}_combined_total`] -
                monthData[`${year}_combined_io`] -
                Math.max(0, monthData[`${year}_combined_filtered`] - monthData[`${year}_combined_io`])
            );
          }
        } else {
          // Initialize to zero
          monthData[`${year}Status11Opps`] = [];
          monthData[`${year}Status11Opps_cumulative`] = [];
          monthData[`${year}_status11`] = 0;
          monthData[`${year}_status11_cumulative`] = 0;
          monthData[`${year}_status11_io`] = 0;
          monthData[`${year}_status11_io_cumulative`] = 0;
          monthData[`${year}_status11_complement`] = 0;
          monthData[`${year}_status11_complement_cumulative`] = 0;
          monthData[`${year}_status11_filtered_monthly`] = 0;
          monthData[`${year}_status11_filtered_cumulative`] = 0;
          monthData[`${year}_status11_io_complement_from_filtered`] = 0;
          monthData[`${year}_status11_total_complement_from_io`] = 0;
          monthData[`${year}_status11_total_complement_from_filtered`] = 0;
          monthData[`${year}_status11_total_monthly`] = 0;

          // Combined values to zero if no Status 11
          if (includeStatus11) {
            const currentMonthlyIO = monthData[`${year}_io`] || 0;
            const currentMonthlyComplement = monthData[`${year}_complement`] || 0;
            const currentMonthlyTotal = currentMonthlyIO + currentMonthlyComplement;
            const currentFilteredMonthly = monthData[`${year}_filtered_monthly`] || 0;

            // Copy normal values into combined values
            monthData[`${year}_combined_io`] = currentMonthlyIO;
            monthData[`${year}_combined_total`] = currentMonthlyTotal;
            monthData[`${year}_combined_complement`] = currentMonthlyComplement;
            monthData[`${year}_combined_filtered`] = currentFilteredMonthly;
            monthData[`${year}_combined_cumulative`] = monthData[`${year}_cumulative`] || 0;
            monthData[`${year}_combined_io_cumulative`] = monthData[`${year}_io_cumulative`] || 0;
            monthData[`${year}_combined_filtered_cumulative`] = monthData[`${year}_filtered_cumulative`] || 0;

            // Calculate complements correctly for stacking
            monthData[`${year}_combined_io_complement_from_filtered`] = Math.max(
              0,
              currentMonthlyIO - currentFilteredMonthly
            );
            monthData[`${year}_combined_total_complement_from_io`] = Math.max(
              0,
              currentMonthlyTotal - currentMonthlyIO
            );
            monthData[`${year}_combined_total_complement_from_filtered`] = Math.max(
              0,
              currentMonthlyTotal - currentMonthlyIO - Math.max(0, currentFilteredMonthly - currentMonthlyIO)
            );
          }
        }
      });
    });
  }

  // Calculate filtered data — incremental accumulators
  const runningFilteredRevenue: Record<number, number> = {};
  const runningFilteredIO: Record<number, number> = {};
  yearsParam.forEach((year) => {
    runningFilteredRevenue[year] = 0;
    runningFilteredIO[year] = 0;
  });

  yearsParam.forEach((year) => {
    runningFilteredRevenue[year] = 0;
    runningFilteredIO[year] = 0;

    result.forEach((monthData, index) => {
      if (!monthData || !bookingsData[index]) return;

      const monthlyOpps = monthData[`${year}Opps`] || [];

      const filteredMonthlyRevenue = monthlyOpps.reduce((sum: number, opp: Record<string, any>) => {
        if (opp.isAllocated) {
          return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0);
        } else {
          return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
        }
      }, 0);

      const filteredMonthlyIO = monthlyOpps.reduce((sum: number, opp: Record<string, any>) => {
        return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
      }, 0);

      // Incremental cumulative filtered values
      runningFilteredRevenue[year] += filteredMonthlyRevenue;
      runningFilteredIO[year] += filteredMonthlyIO;

      monthData[`${year}_filtered_cumulative`] = runningFilteredRevenue[year];
      monthData[`${year}_filtered_io_cumulative`] = runningFilteredIO[year];
      monthData[`${year}_filtered_monthly`] = filteredMonthlyRevenue;
      monthData[`${year}_filtered_io_monthly`] = filteredMonthlyIO;

      const filteredIOComplementFromFiltered = Math.max(0, filteredMonthlyIO - filteredMonthlyRevenue);
      const filteredTotalComplementFromIO = Math.max(0, (monthData[year] || 0) - filteredMonthlyIO);
      const filteredTotalComplementFromFiltered = Math.max(
        0,
        (monthData[year] || 0) - filteredMonthlyIO - Math.max(0, filteredMonthlyRevenue - filteredMonthlyIO)
      );

      const monthlyIORevenue = monthData[`${year}_io`] || 0;
      const monthlyComplement = monthData[`${year}_complement`] || 0;

      const totalMonthlyRevenue = monthlyIORevenue + monthlyComplement;
      monthData[`${year}_total_monthly`] = totalMonthlyRevenue;

      monthData[`${year}_io_complement_from_filtered`] = Math.max(0, monthlyIORevenue - filteredMonthlyRevenue);
      monthData[`${year}_total_complement_from_io`] = Math.max(0, totalMonthlyRevenue - monthlyIORevenue);
      monthData[`${year}_total_complement_from_filtered`] = Math.max(
        0,
        monthlyComplement - Math.max(0, filteredMonthlyRevenue - monthlyIORevenue)
      );
    });
  });

  // Calculate IO Target Curve
  const calculateIOTargetCurve = (cumulativeData: any[], _years: number[]) => {
    const TARGET_IO_ANNUAL = 55000000;

    const data2024 = cumulativeData.map((month) => month["2024_cumulative"] || 0);
    const max2024 = Math.max(...data2024.filter((val) => val > 0));

    if (max2024 === 0) {
      return cumulativeData.map((month, index) => {
        const progressRatio = (index + 1) / 12;
        return TARGET_IO_ANNUAL * progressRatio;
      });
    }

    return cumulativeData.map((month) => {
      const ref2024 = month["2024_cumulative"] || 0;
      if (ref2024 === 0) return 0;

      return (ref2024 / max2024) * TARGET_IO_ANNUAL;
    });
  };

  const ioTargetCurve = calculateIOTargetCurve(result, yearsParam);

  result.forEach((month, index) => {
    month.ioTarget = ioTargetCurve[index];
  });

  if (includeStatus11) {
    yearsParam.forEach((year) => {
      result.forEach((monthData, index) => {
        // Recalculate combined filtered values after having Status 11 data
        const bookingsFilteredMonthly = monthData[`${year}_filtered_monthly`] || 0;
        const bookingsFilteredCumulative = monthData[`${year}_filtered_cumulative`] || 0;
        const status11FilteredMonthly = monthData[`${year}_status11_filtered_monthly`] || 0;
        const status11FilteredCumulative = monthData[`${year}_status11_filtered_cumulative`] || 0;

        // Correct combined values
        monthData[`${year}_combined_filtered`] = bookingsFilteredMonthly + status11FilteredMonthly;
        monthData[`${year}_combined_filtered_cumulative`] = bookingsFilteredCumulative + status11FilteredCumulative;

        // Recalculate complements with new filtered values
        const combinedIO = monthData[`${year}_combined_io`] || 0;
        const combinedTotal = monthData[`${year}_combined_total`] || 0;
        const combinedFiltered = monthData[`${year}_combined_filtered`];

        monthData[`${year}_combined_io_complement_from_filtered`] = Math.max(0, combinedIO - combinedFiltered);
        monthData[`${year}_combined_total_complement_from_filtered`] = Math.max(
          0,
          combinedTotal - combinedIO - Math.max(0, combinedFiltered - combinedIO)
        );
      });
    });
  }

  return result;
}
