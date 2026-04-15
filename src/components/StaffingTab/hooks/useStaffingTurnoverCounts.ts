import { useMemo } from "react";
import { countArrivalDepartures, countGradeTransitionsByDate } from "../utils/turnoverUtils";
import type { Employee } from "../types";

interface UseStaffingTurnoverCountsArgs {
  displayedEmployees: Employee[];
  timelineStart: Date | null;
}

/**
 * Computes grade transition counts and arrival/departure counts per date,
 * used by MonthHeaderBar badges in the sticky timeline header.
 */
export function useStaffingTurnoverCounts({ displayedEmployees, timelineStart }: UseStaffingTurnoverCountsArgs) {
  const gradeTransitionCounts = useMemo(() => {
    const tlStartStr = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : undefined;
    return countGradeTransitionsByDate(displayedEmployees, tlStartStr);
  }, [displayedEmployees, timelineStart]);

  const { arrivalCounts, departureCounts } = useMemo(
    () => countArrivalDepartures(displayedEmployees),
    [displayedEmployees]
  );

  return { gradeTransitionCounts, arrivalCounts, departureCounts };
}
