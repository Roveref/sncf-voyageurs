import {
  calculateRevenueWithSegmentLogic,
  getMonthlyYearlyTotals,
  formatYearOverYearData,
} from "../../../utils/dataUtils";

/**
 * Classify an opportunity by its source
 * @param {Object} opp - Opportunity object
 * @returns {string} 'crmOriginal' | 'manual' | 'crmModified'
 */
const getOpportunitySource = (opp: Record<string, any>): string => {
  if (opp.isManual) return "manual";
  if (opp._originalStatus !== undefined) return "crmModified";
  return "crmOriginal";
};

/**
 * Calculate source breakdown for a list of opportunities
 * @param {Array} opps - List of opportunities
 * @param {boolean} showNetRevenue - Whether to use net revenue
 * @returns {Object} { crmOriginal, manual, crmModified } with value, count, io, and allocated
 */
const calculateSourceBreakdown = (
  opps: Record<string, any>[],
  showNetRevenue: boolean
): Record<string, { value: number; count: number; io: number; allocated: number }> => {
  const breakdown = {
    crmOriginal: { value: 0, count: 0, io: 0, allocated: 0 },
    manual: { value: 0, count: 0, io: 0, allocated: 0 },
    crmModified: { value: 0, count: 0, io: 0, allocated: 0 },
  };

  opps.forEach((opp) => {
    const source = getOpportunitySource(opp);
    const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;

    // Calculate I&O revenue
    const ioRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

    // Calculate allocated revenue
    const allocatedRevenue =
      opp.isAllocated && opp.allocatedGrossRevenue
        ? showNetRevenue
          ? opp.allocatedNetRevenue || 0
          : opp.allocatedGrossRevenue
        : revenue;

    (breakdown as Record<string, { value: number; count: number; io: number; allocated: number }>)[source].value +=
      revenue;
    (breakdown as Record<string, { value: number; count: number; io: number; allocated: number }>)[source].count += 1;
    (breakdown as Record<string, { value: number; count: number; io: number; allocated: number }>)[source].io +=
      ioRevenue;
    (breakdown as Record<string, { value: number; count: number; io: number; allocated: number }>)[source].allocated +=
      allocatedRevenue;
  });

  return breakdown;
};

/**
 * Calculate cumulative data for years
 * This is a PURE function that can be memoized
 * PERFORMANCE: This function is heavy (250+ lines), it MUST be memoized with useMemo
 */
export function calculateCumulativeTotals(
  bookingsData: any[],
  status11Data: any[] = [],
  includeStatus11: boolean = false,
  yearsParam: number[] | null = null,
  showNetRevenue: boolean = false
): Record<string, any>[] {
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
        (sum: number, opp: Record<string, any>) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Calculate allocated revenue for this month
      const monthlyAllocatedRevenue = monthlyOpps.reduce((sum: number, opp: Record<string, any>) => {
        if (opp.isAllocated && opp.allocatedGrossRevenue) {
          return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue);
        }
        return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
      }, 0);

      // Calculate total revenue for this month
      const monthlyTotalRevenue = monthData[year] || 0;

      // Calculate complement (total - I&O)
      const monthlyComplement = Math.max(0, monthlyTotalRevenue - monthlyIORevenue);

      // Calculate non-allocated portion (total - allocated)
      const monthlyNonAllocated = Math.max(0, monthlyTotalRevenue - monthlyAllocatedRevenue);

      // Add monthly breakdown
      cumulativeMonth[`${year}_io`] = monthlyIORevenue;
      cumulativeMonth[`${year}_complement`] = monthlyComplement;
      cumulativeMonth[`${year}_allocated`] = monthlyAllocatedRevenue;
      cumulativeMonth[`${year}_nonAllocated`] = monthlyNonAllocated;

      // === SOURCE BREAKDOWN (monthly) ===
      const monthlySourceBreakdown = calculateSourceBreakdown(monthlyOpps, showNetRevenue);
      cumulativeMonth[`${year}_src_crmOriginal`] = monthlySourceBreakdown.crmOriginal.value;
      cumulativeMonth[`${year}_src_manual`] = monthlySourceBreakdown.manual.value;
      cumulativeMonth[`${year}_src_crmModified`] = monthlySourceBreakdown.crmModified.value;
      cumulativeMonth[`${year}_src_crmOriginal_count`] = monthlySourceBreakdown.crmOriginal.count;
      cumulativeMonth[`${year}_src_manual_count`] = monthlySourceBreakdown.manual.count;
      cumulativeMonth[`${year}_src_crmModified_count`] = monthlySourceBreakdown.crmModified.count;
      // I&O per source
      cumulativeMonth[`${year}_src_crmOriginal_io`] = monthlySourceBreakdown.crmOriginal.io;
      cumulativeMonth[`${year}_src_manual_io`] = monthlySourceBreakdown.manual.io;
      cumulativeMonth[`${year}_src_crmModified_io`] = monthlySourceBreakdown.crmModified.io;
      // Allocated per source
      cumulativeMonth[`${year}_src_crmOriginal_allocated`] = monthlySourceBreakdown.crmOriginal.allocated;
      cumulativeMonth[`${year}_src_manual_allocated`] = monthlySourceBreakdown.manual.allocated;
      cumulativeMonth[`${year}_src_crmModified_allocated`] = monthlySourceBreakdown.crmModified.allocated;

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

  // Calculate cumulative I&O and allocated data for each year
  yearsParam.forEach((year) => {
    result.forEach((monthData, index) => {
      // Get all opportunities up to this month for this year
      const cumulativeOpps = bookingsData.slice(0, index + 1).flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);

      // Calculate cumulative I&O revenue
      const cumulativeIO = cumulativeOpps.reduce(
        (sum: number, opp: Record<string, any>) => sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue),
        0
      );

      // Calculate cumulative allocated revenue
      const cumulativeAllocated = cumulativeOpps.reduce((sum: number, opp: Record<string, any>) => {
        if (opp.isAllocated && opp.allocatedGrossRevenue) {
          return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue);
        }
        return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
      }, 0);

      const cumulativeTotal = monthData[`${year}_cumulative`] || 0;

      // Add cumulative values to the month data
      monthData[`${year}_io_cumulative`] = cumulativeIO;
      monthData[`${year}_allocated_cumulative`] = cumulativeAllocated;
      monthData[`${year}_nonAllocated_cumulative`] = Math.max(0, cumulativeTotal - cumulativeAllocated);

      // === SOURCE BREAKDOWN (cumulative) ===
      const cumulativeSourceBreakdown = calculateSourceBreakdown(cumulativeOpps, showNetRevenue);
      monthData[`${year}_src_crmOriginal_cumulative`] = cumulativeSourceBreakdown.crmOriginal.value;
      monthData[`${year}_src_manual_cumulative`] = cumulativeSourceBreakdown.manual.value;
      monthData[`${year}_src_crmModified_cumulative`] = cumulativeSourceBreakdown.crmModified.value;
      monthData[`${year}_src_crmOriginal_count_cumulative`] = cumulativeSourceBreakdown.crmOriginal.count;
      monthData[`${year}_src_manual_count_cumulative`] = cumulativeSourceBreakdown.manual.count;
      monthData[`${year}_src_crmModified_count_cumulative`] = cumulativeSourceBreakdown.crmModified.count;
      // I&O per source (cumulative)
      monthData[`${year}_src_crmOriginal_io_cumulative`] = cumulativeSourceBreakdown.crmOriginal.io;
      monthData[`${year}_src_manual_io_cumulative`] = cumulativeSourceBreakdown.manual.io;
      monthData[`${year}_src_crmModified_io_cumulative`] = cumulativeSourceBreakdown.crmModified.io;
      // Allocated per source (cumulative)
      monthData[`${year}_src_crmOriginal_allocated_cumulative`] = cumulativeSourceBreakdown.crmOriginal.allocated;
      monthData[`${year}_src_manual_allocated_cumulative`] = cumulativeSourceBreakdown.manual.allocated;
      monthData[`${year}_src_crmModified_allocated_cumulative`] = cumulativeSourceBreakdown.crmModified.allocated;
    });
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

            // Combined source breakdown values (Status 11 goes to CRM Original)
            monthData[`${year}_src_crmOriginal_combined`] =
              (monthData[`${year}_src_crmOriginal`] || 0) + monthlyStatus11Total;
            monthData[`${year}_src_crmOriginal_combined_cumulative`] =
              (monthData[`${year}_src_crmOriginal_cumulative`] || 0) + cumulativeStatus11Total;

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

            // Combined source breakdown values (no Status 11 to add)
            monthData[`${year}_src_crmOriginal_combined`] = monthData[`${year}_src_crmOriginal`] || 0;
            monthData[`${year}_src_crmOriginal_combined_cumulative`] =
              monthData[`${year}_src_crmOriginal_cumulative`] || 0;

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
  } else {
    // No Status 11 data - initialize combined values to base values
    yearsParam.forEach((year) => {
      result.forEach((monthData) => {
        const monthlyIO = monthData[`${year}_io`] || 0;
        const monthlyComplement = monthData[`${year}_complement`] || 0;
        const monthlyTotal = monthlyIO + monthlyComplement;

        // Set combined values to base values (no Status 11 to add)
        monthData[`${year}_combined_io`] = monthlyIO;
        monthData[`${year}_combined_total`] = monthlyTotal;
        monthData[`${year}_combined_complement`] = monthlyComplement;
        monthData[`${year}_combined_cumulative`] = monthData[`${year}_cumulative`] || 0;
        monthData[`${year}_combined_io_cumulative`] = monthData[`${year}_io_cumulative`] || 0;

        // Combined source breakdown values (no Status 11 to add)
        monthData[`${year}_src_crmOriginal_combined`] = monthData[`${year}_src_crmOriginal`] || 0;
        monthData[`${year}_src_crmOriginal_combined_cumulative`] = monthData[`${year}_src_crmOriginal_cumulative`] || 0;
      });
    });
  }

  // Calculate filtered data
  yearsParam.forEach((year) => {
    result.forEach((monthData, index) => {
      if (!monthData || !bookingsData[index]) return;

      const monthlyOpps = monthData[`${year}Opps`] || [];
      const cumulativeOpps = bookingsData.slice(0, index + 1).flatMap((prevMonth) => prevMonth[`${year}Opps`] || []);

      const filteredCumulativeRevenue = cumulativeOpps.reduce((sum: number, opp: Record<string, any>) => {
        if (opp.isAllocated) {
          return sum + (showNetRevenue ? opp.allocatedNetRevenue || 0 : opp.allocatedGrossRevenue || 0);
        } else {
          return sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0);
        }
      }, 0);

      const filteredCumulativeIO = cumulativeOpps.reduce((sum: number, opp: Record<string, any>) => {
        return sum + calculateRevenueWithSegmentLogic(opp, showNetRevenue);
      }, 0);

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

      monthData[`${year}_filtered_monthly`] = filteredMonthlyRevenue;
      monthData[`${year}_filtered_cumulative`] = filteredCumulativeRevenue;
      monthData[`${year}_filtered_io_cumulative`] = filteredCumulativeIO;

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
  const calculateIOTargetCurve = (cumulativeData: Record<string, any>[], years: number[]): number[] => {
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
