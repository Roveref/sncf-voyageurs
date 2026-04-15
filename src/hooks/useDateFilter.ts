/**
 * Shared hook for date range filtering.
 * Parameterized by the date field name and optional default range.
 */

import { useState, useMemo, useCallback } from "react";

const normalizeStart = (date: Date | string): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const normalizeEnd = (date: Date | string): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

function filterByDateRange(
  inputData: Record<string, any>[],
  dateField: string,
  dateRange: [Date | null, Date | null]
): Record<string, any>[] {
  if (!dateRange[0] && !dateRange[1]) return inputData;

  return inputData.filter((opp) => {
    const value = new Date(opp[dateField]);
    if (!dateRange[0] && dateRange[1]) return value <= normalizeEnd(dateRange[1]);
    if (dateRange[0] && !dateRange[1]) return value >= normalizeStart(dateRange[0]);
    return value >= normalizeStart(dateRange[0]!) && value <= normalizeEnd(dateRange[1]!);
  });
}

export const useDateFilter = (
  data: Record<string, any>[],
  dateField: string,
  defaultRange: [Date | null, Date | null] = [null, null]
) => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(defaultRange);

  const getDateFilteredData = useCallback(
    (inputData: Record<string, any>[]) => filterByDateRange(inputData, dateField, dateRange),
    [dateField, dateRange]
  );

  const handleDateChange = useCallback((index: number, date: Date | null): void => {
    setDateRange((prev) => {
      const next: [Date | null, Date | null] = [...prev];
      next[index] = date;
      return next;
    });
  }, []);

  const handleResetDateFilter = useCallback((): void => {
    setDateRange([null, null]);
  }, []);

  const dateFilteredData = useMemo(() => filterByDateRange(data, dateField, dateRange), [data, dateField, dateRange]);

  return {
    dateRange,
    setDateRange,
    handleDateChange,
    handleResetDateFilter,
    getDateFilteredData,
    dateFilteredData,
  };
};
