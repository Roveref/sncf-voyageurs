/**
 * useSapData — Facade hook that reads SAP data from React Query cache directly.
 * Replaces the bridge pattern: useSapQuery → useHydration bridge → useDataStore.hydratedSapData.
 *
 * Performs the same transformation as the old bridge: converts employeeIds from array to Set.
 */

import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useSapQuery } from "./useSapQuery";
import type { SapUploadResult } from "../components/StaffingTab/types";

/** SAP data with employeeIds converted to Set (as the old bridge did) */
export interface HydratedSapResult extends Omit<SapUploadResult, "employeeIds"> {
  employeeIds: Set<string>;
}

export function useSapData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useSapQuery(isReady);
  const data = query.data;

  const sapData = useMemo<HydratedSapResult | null>(() => {
    if (!data?.available) return null;
    const raw = data.sapData;
    return {
      ...raw,
      employeeIds: new Set(raw.employeeIds),
    } as HydratedSapResult;
  }, [data]);

  return {
    sapData,
    isReady: query.isSuccess,
    isLoading: query.isLoading,
  };
}
