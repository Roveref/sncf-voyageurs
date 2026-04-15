/**
 * useOpportunityStaffing — Reads staffing records from React Query cache
 * and classifies them into past/current/upcoming for the selected opportunity.
 */

import { useMemo } from "react";
import { useStaffingData } from "../../../../queries/useStaffingData";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { formatLocalDate } from "../../../StaffingTab/utils/dateUtils";
import { classifyByDate } from "../../staffingNeedUtils";
import type { TimelineAssignment } from "../types";
import type { StaffingNeedItem } from "../../../../types/actions";

const CHARGEABLE_CATS = new Set(["chargeable", "generalOppty", "pending", "overtime", "travel"]);

export function useOpportunityStaffing(opportunityId: string | undefined, jobCode: string | undefined) {
  const { records, isLoading } = useStaffingData();
  const allStaffingNeeds = useUserDataStore((s) => s.staffingNeeds);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Filter staffing records to those matching the opportunity's jobCode
  const assignments = useMemo<TimelineAssignment[]>(() => {
    if (!jobCode || !records.length) return [];
    return records
      .filter((r) => r.jobNo === jobCode && CHARGEABLE_CATS.has(r.category))
      .map((r) => ({
        empId: r.empId,
        empName: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.empId,
        grade: r.grade || "",
        jobNo: r.jobNo,
        jobName: r.jobName,
        startDate: r.startDate,
        endDate: r.endDate,
        utilization: r.utilization,
        category: r.category,
      }));
  }, [records, jobCode]);

  // Classify into past/current/upcoming
  const classified = useMemo(() => classifyByDate(assignments, todayStr), [assignments, todayStr]);

  // Existing staffing needs for this opportunity
  const existingNeeds = useMemo<StaffingNeedItem[]>(() => {
    if (!opportunityId) return [];
    return allStaffingNeeds[opportunityId] || [];
  }, [opportunityId, allStaffingNeeds]);

  return {
    past: classified.past,
    current: classified.current,
    upcoming: classified.upcoming,
    existingNeeds,
    isLoading,
    todayStr,
  };
}
