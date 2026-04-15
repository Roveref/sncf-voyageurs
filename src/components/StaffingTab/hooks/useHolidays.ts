import { useState, useCallback, useMemo } from "react";
import { FRENCH_PUBLIC_HOLIDAYS, Holiday } from "../constants";

/**
 * Custom hook for managing public holidays selection (dynamic, multi-year)
 * Holidays use YYYY-MM-DD format for year-aware matching.
 * @returns {object} - Holiday state and handlers
 */
interface CustomHoliday extends Holiday {
  isCustom: boolean;
}

export const useHolidays = () => {
  // Custom holidays added by the user: [{ id, date, label, year, isCustom }]
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);

  // All holidays = generated + custom
  const allHolidays = useMemo((): (Holiday | CustomHoliday)[] => {
    return [...FRENCH_PUBLIC_HOLIDAYS, ...customHolidays];
  }, [customHolidays]);

  // By default, all holidays are enabled (by id)
  const [enabledHolidays, setEnabledHolidays] = useState<Set<string>>(
    () => new Set(FRENCH_PUBLIC_HOLIDAYS.map((h) => h.id))
  );

  // Toggle a specific holiday
  const toggleHoliday = useCallback((holidayId: string): void => {
    setEnabledHolidays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(holidayId)) {
        newSet.delete(holidayId);
      } else {
        newSet.add(holidayId);
      }
      return newSet;
    });
  }, []);

  // Enable all holidays
  const enableAllHolidays = useCallback((): void => {
    setEnabledHolidays(new Set(allHolidays.map((h) => h.id)));
  }, [allHolidays]);

  // Disable all holidays
  const disableAllHolidays = useCallback((): void => {
    setEnabledHolidays(new Set());
  }, []);

  // Add a custom holiday
  const addCustomHoliday = useCallback((dateStr: string, label: string): void => {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const id = `custom-${dateStr}`;
    setCustomHolidays((prev) => {
      if (prev.some((h) => h.id === id)) return prev;
      return [...prev, { id, date: dateStr, label, year, isCustom: true }];
    });
    // Auto-enable the new holiday
    setEnabledHolidays((prev) => new Set([...prev, id]));
  }, []);

  // Remove a custom holiday
  const removeCustomHoliday = useCallback((holidayId: string): void => {
    setCustomHolidays((prev) => prev.filter((h) => h.id !== holidayId));
    setEnabledHolidays((prev) => {
      const newSet = new Set(prev);
      newSet.delete(holidayId);
      return newSet;
    });
  }, []);

  // Get Set of enabled holiday dates (YYYY-MM-DD format) for O(1) lookup
  const enabledHolidayDates = useMemo((): Set<string> => {
    const dates = new Set<string>();
    for (const h of allHolidays) {
      if (enabledHolidays.has(h.id)) dates.add(h.date);
    }
    return dates;
  }, [enabledHolidays, allHolidays]);

  // Check if a date is an enabled holiday
  const isEnabledHoliday = useCallback(
    (dateStr: string): boolean => {
      return enabledHolidayDates.has(dateStr);
    },
    [enabledHolidayDates]
  );

  return {
    holidays: allHolidays,
    enabledHolidays,
    enabledHolidayDates,
    toggleHoliday,
    enableAllHolidays,
    disableAllHolidays,
    isEnabledHoliday,
    addCustomHoliday,
    removeCustomHoliday,
  };
};
