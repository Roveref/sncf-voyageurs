import { SPECIAL_SEGMENT_CODES, OPERATIONS_SERVICE_LINE } from "./constants";

/**
 * Gets unique values from a specified column in the data
 * @param {Array} data - The data array
 * @param {string} column - The column name to extract unique values from
 * @returns {Array} Array of unique values
 */
export const getUniqueValues = (data: Record<string, any>[], column: string): any[] => {
  const values = data
    .map((item) => item[column])
    .filter((value) => value !== undefined && value !== null && value !== "");
  return [...new Set(values)];
};

/**
 * Groups data by a specified column
 * @param {Array} data - The data array
 * @param {string} groupByColumn - The column to group by
 * @returns {Object} Object with groups as keys and arrays as values
 */
export const groupDataBy = (
  data: Record<string, any>[],
  groupByColumn: string
): Record<string, Record<string, any>[]> => {
  return data.reduce((acc, item) => {
    const key = item[groupByColumn];
    if (!key) return acc;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

/**
 * Calculates sum of a numeric column in data
 * @param {Array} data - The data array
 * @param {string} column - The column to sum
 * @returns {number} Sum of the column values
 */
export const sumBy = (data: Record<string, any>[], column: string): number => {
  return data.reduce((sum, item) => {
    const value = item[column];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
};

/**
 * Calculates revenue with segment and service line logic
 * @param {Object} item - The opportunity item
 * @param {boolean} useNetRevenue - Whether to use net revenue instead of gross
 * @returns {number} Calculated revenue
 */
export const calculateRevenueWithSegmentLogic = (
  item: Record<string, any>,
  showNetRevenue: boolean = false
): number => {
  // Check if segment code is AUTO, CLR, or IEM
  const isSpecialSegmentCode = SPECIAL_SEGMENT_CODES.includes(item.subSegmentCode);

  // If special segment code, return full revenue based on toggle
  if (isSpecialSegmentCode) {
    return showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0;
  }

  // Check each service line (1, 2, and 3)
  // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
  const serviceLines = [
    {
      line: item.serviceLine1,
      percentage: item.serviceOffering1Pct || item.allocation1 || 0,
    },
    {
      line: item.serviceLine2,
      percentage: item.serviceOffering2Pct || item.allocation2 || 0,
    },
    {
      line: item.serviceLine3,
      percentage: item.serviceOffering3Pct || item.allocation3 || 0,
    },
  ];

  // Get the base revenue value based on toggle
  const baseRevenue = showNetRevenue ? item.netRevenue || 0 : item.grossRevenue || 0;

  // Calculate total allocated revenue for Operations
  const operationsAllocation = serviceLines.reduce((total, service) => {
    if (service.line === OPERATIONS_SERVICE_LINE) {
      return total + baseRevenue * (service.percentage / 100);
    }
    return total;
  }, 0);

  // If any Operations allocation is found, return that
  if (operationsAllocation > 0) {
    return operationsAllocation;
  }

  // If no specific Operations allocation, return full revenue
  return 0;
};

/**
 * Groups data by month and year and calculates sum for a specified column
 * @param {Array} data - The data array
 * @param {string} dateColumn - The column containing dates
 * @param {string} valueColumn - The column to sum
 * @returns {Array} Array of { month, year, value } objects
 */
export const getMonthlyYearlyTotals = (
  data: Record<string, any>[],
  dateColumn: string,
  valueColumn: string
): Record<string, any>[] => {
  const monthlyYearlyData: Record<string, any> = {};
  const useNetRevenue = valueColumn === "netRevenue";

  data.forEach((item) => {
    if (!item[dateColumn]) return;

    const date = new Date(item[dateColumn]);
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthYear = `${month}-${year}`;

    if (!monthlyYearlyData[monthYear]) {
      monthlyYearlyData[monthYear] = {
        month,
        year,
        monthName: new Date(year, month, 1).toLocaleString("default", {
          month: "short",
        }),
        total: 0,
        count: 0,
        opportunities: [],
      };
    }

    // Determine the actual value based on valueColumn
    let actualValue;
    if (valueColumn === "Calculated I&O") {
      // Use the revenue calculation method with appropriate parameter
      actualValue = calculateRevenueWithSegmentLogic(item, useNetRevenue);
    } else {
      // Use the direct column value
      actualValue = item[valueColumn] || 0;
    }

    monthlyYearlyData[monthYear].total += actualValue;
    monthlyYearlyData[monthYear].count += 1;
    monthlyYearlyData[monthYear].opportunities.push(item);
  });

  // Convert to array
  return Object.values(monthlyYearlyData);
};
/**
 * Formats monthly yearly data for year-over-year comparison charts
 * @param {Array} monthlyYearlyData - Data from getMonthlyYearlyTotals
 * @returns {Array} Formatted data for YoY chart
 */
export const formatYearOverYearData = (monthlyYearlyData: Record<string, any>[]): Record<string, any>[] => {
  // Define all months of the year (0-11 since JavaScript starts at 0)
  const allMonths: Array<{ month: number; monthName: string }> = [];
  for (let i = 0; i < 12; i++) {
    allMonths.push({
      month: i,
      monthName: new Date(2024, i, 1).toLocaleString("default", { month: "short" }),
    });
  }

  // Get all unique years from the data
  const years = [...new Set(monthlyYearlyData.map((item) => item.year))].sort();

  // Create the base structure with all months
  const result = allMonths.map((monthInfo) => {
    const monthData: Record<string, any> = {
      month: monthInfo.month,
      monthName: monthInfo.monthName,
    };

    // For each year, initialize values to 0
    years.forEach((year) => {
      monthData[`${year}`] = 0;
      monthData[`${year}Count`] = 0;
      monthData[`${year}Opps`] = [];
    });

    return monthData;
  });

  // Fill with existing data
  monthlyYearlyData.forEach((item) => {
    const monthIndex = item.month; // item.month is already 0-11

    if (monthIndex >= 0 && monthIndex < 12) {
      const monthData = result[monthIndex];
      monthData[`${item.year}`] = item.total;
      monthData[`${item.year}Count`] = item.count;
      monthData[`${item.year}Opps`] = item.opportunities || [];
    }
  });

  return result;
};

/**
 * Finds new opportunities based on creation date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewOpportunities = (
  data: Record<string, any>[],
  startDate: Date,
  endDate: Date
): Record<string, any>[] => {
  return data.filter((item) => {
    if (!item.creationDate) return false;

    const creationDate = new Date(item.creationDate);
    return creationDate >= startDate && creationDate <= endDate;
  });
};

/**
 * Finds new wins based on winning date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewWins = (data: Record<string, any>[], startDate: Date, endDate: Date): Record<string, any>[] => {
  return data.filter((item) => {
    if (!item.lastStatusChangeDate || item.lastStatusChangeDate === "-") return false;

    const winDate = new Date(item.lastStatusChangeDate);
    return winDate >= startDate && winDate <= endDate;
  });
};

/**
 * Finds new losses based on lost date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewLosses = (data: Record<string, any>[], startDate: Date, endDate: Date): Record<string, any>[] => {
  const lostOpportunities = data.filter((item) => {
    // Check if the opportunity is lost (status 15)
    if (item.status !== 15) {
      return false;
    }

    // bookingDate is used for both bookings (status 14) and losses (status 15)
    const lostDateStr = item.bookingDate;
    if (!lostDateStr || lostDateStr === "-") {
      return false;
    }

    const lostDate = new Date(lostDateStr);

    // Check if lost date is within the specified range
    return lostDate >= startDate && lostDate <= endDate;
  });

  return lostOpportunities;
};
