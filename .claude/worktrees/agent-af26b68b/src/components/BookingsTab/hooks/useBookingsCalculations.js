import { useMemo } from "react";
import {
  calculateRevenueWithSegmentLogic,
  getMonthlyYearlyTotals,
  formatYearOverYearData,
} from "../../../utils/dataUtils";

/**
 * Hook optimisé pour les calculs lourds de bookings
 * Mémoïse calculateCumulativeTotals pour éviter les recalculs inutiles
 */
export const useBookingsCalculations = (bookingsData, status11Data, includeStatus11, years, showNetRevenue) => {
  // Mémoïser calculateCumulativeTotals - fonction critique qui était appelée à chaque rendu
  const cumulativeTotals = useMemo(() => {
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
  bookingsData,
  status11Data = [],
  includeStatus11 = false,
  yearsParam = null,
  showNetRevenue = false
) {
  if (!bookingsData || !Array.isArray(bookingsData) || bookingsData.length === 0) {
    return [];
  }

  if (!yearsParam || yearsParam.length === 0) {
    return bookingsData;
  }

  const result = bookingsData.map((monthData, index) => {
    const cumulativeMonth = { ...monthData };

    // Calculate cumulative totals for each year
    yearsParam.forEach((year) => {
      if (!monthData) return;

      const monthlyOpps = monthData[`${year}Opps`] || [];

      // Calculate I&O revenue for this month
      const monthlyIORevenue = monthlyOpps.reduce(
        (sum, opp) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Calculate total revenue for this month
      const monthlyTotalRevenue = monthData[year] || 0;

      // Calculate complement (total - I&O)
      const monthlyComplement = Math.max(0, monthlyTotalRevenue - monthlyIORevenue);

      // Add monthly breakdown
      cumulativeMonth[`${year}_io`] = monthlyIORevenue;
      cumulativeMonth[`${year}_complement`] = monthlyComplement;

      // Sum all previous months' values for this year (cumulative)
      const cumulativeValue = bookingsData.slice(0, index + 1).reduce((sum, prevMonth) => {
        return sum + (prevMonth[year] || 0);
      }, 0);

      // Add cumulative value for this year
      cumulativeMonth[`${year}_cumulative`] = cumulativeValue;

      // Create cumulative opportunities list for this year
      cumulativeMonth[`${year}Opps_cumulative`] = bookingsData
        .slice(0, index + 1)
        .flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);
    });

    return cumulativeMonth;
  });

  // Calculate cumulative I&O data for each year
  yearsParam.forEach((year) => {
    let cumulativeIO = 0;

    result.forEach((monthData, index) => {
      // Get all opportunities up to this month for this year
      const cumulativeOpps = bookingsData.slice(0, index + 1).flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);

      // Calculate cumulative I&O revenue
      cumulativeIO = cumulativeOpps.reduce(
        (sum, opp) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Add cumulative I&O to the month data
      monthData[`${year}_io_cumulative`] = cumulativeIO;
    });
  });

  // Process Status 11 data
  if (status11Data && status11Data.length > 0) {
    const monthlyStatus11 = getMonthlyYearlyTotals(
      status11Data,
      "Estimated Booking Date",
      showNetRevenue ? "Net Revenue" : "Gross Revenue"
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

          const monthlyStatus11IO = monthlyStatus11Opps.reduce((sum, opp) => {
            return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
          }, 0);

          const cumulativeStatus11IO = cumulativeStatus11Opps.reduce((sum, opp) => {
            return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
          }, 0);

          const monthlyStatus11Filtered = monthlyStatus11Opps.reduce((sum, opp) => {
            if (opp["Is Allocated"]) {
              return sum + (showNetRevenue ? opp["Allocated Net Revenue"] || 0 : opp["Allocated Gross Revenue"] || 0);
            } else {
              return sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0);
            }
          }, 0);

          const cumulativeStatus11Filtered = cumulativeStatus11Opps.reduce((sum, opp) => {
            if (opp["Is Allocated"]) {
              return sum + (showNetRevenue ? opp["Allocated Net Revenue"] || 0 : opp["Allocated Gross Revenue"] || 0);
            } else {
              return sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0);
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

  // Calculate filtered data
  yearsParam.forEach((year) => {
    result.forEach((monthData, index) => {
      if (!monthData || !bookingsData[index]) return;

      const monthlyOpps = monthData[`${year}Opps`] || [];
      const cumulativeOpps = bookingsData.slice(0, index + 1).flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);

      const filteredCumulativeRevenue = cumulativeOpps.reduce((sum, opp) => {
        if (opp["Is Allocated"]) {
          return sum + (showNetRevenue ? opp["Allocated Net Revenue"] || 0 : opp["Allocated Gross Revenue"] || 0);
        } else {
          return sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0);
        }
      }, 0);

      const filteredCumulativeIO = cumulativeOpps.reduce((sum, opp) => {
        return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
      }, 0);

      const filteredMonthlyRevenue = monthlyOpps.reduce((sum, opp) => {
        if (opp["Is Allocated"]) {
          return sum + (showNetRevenue ? opp["Allocated Net Revenue"] || 0 : opp["Allocated Gross Revenue"] || 0);
        } else {
          return sum + (showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0);
        }
      }, 0);

      const filteredMonthlyIO = monthlyOpps.reduce((sum, opp) => {
        return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
      }, 0);

      monthData[`${year}_filtered_cumulative`] = filteredCumulativeRevenue;
      monthData[`${year}_filtered_io_cumulative`] = filteredCumulativeIO;
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
  const calculateIOTargetCurve = (cumulativeData, years) => {
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
