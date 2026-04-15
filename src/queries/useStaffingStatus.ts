/**
 * useStaffingStatus — Derives staffing availability from React Query state.
 * Replaces useDataStore(s => s.hasStaffingData).
 */

import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useEmployeesQuery } from "./useEmployeesQuery";
import { useStaffingQuery } from "./useStaffingQuery";

export function useStaffingStatus() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const employeesQuery = useEmployeesQuery(isReady);
  const staffingQuery = useStaffingQuery(isReady);

  return {
    hasStaffingData: employeesQuery.isSuccess || staffingQuery.isSuccess,
  };
}
