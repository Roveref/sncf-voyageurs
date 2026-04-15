/**
 * useStaffingData — Facade hook that reads staffing records from React Query cache directly.
 * Replaces the bridge pattern: useStaffingQuery → useHydration bridge → useDataStore.hydratedStaffingRecords.
 */

import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useStaffingQuery } from "./useStaffingQuery";
import type { StaffingRecord } from "../components/StaffingTab/types";

const EMPTY_RECORDS: StaffingRecord[] = [];

export function useStaffingData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useStaffingQuery(isReady);
  const data = query.data;

  const records = useMemo(() => (data?.available ? (data.records as StaffingRecord[]) : EMPTY_RECORDS), [data]);

  return {
    records,
    hasData: !!data?.available && records.length > 0,
    isReady: query.isSuccess,
    isLoading: query.isLoading,
  };
}
