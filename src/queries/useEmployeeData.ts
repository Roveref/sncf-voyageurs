/**
 * useEmployeeData — Facade hook that reads employee metadata from React Query cache directly.
 * Replaces the bridge pattern: useMetadataQuery → useHydration bridge → useEmployeeMetadataStore.
 *
 * Returns server-only metadata (no user overrides). For merged data, use useMergedEmployeeData().
 */

import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useMetadataQuery } from "./useMetadataQuery";
import type { EmployeeMetadata } from "../components/StaffingTab/types";
import type { Holiday } from "../components/StaffingTab/constants";

export function useEmployeeData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useMetadataQuery(isReady);
  const data = query.data;

  const serverMetadata = useMemo<Record<string, EmployeeMetadata>>(() => {
    if (!data?.available) return {};
    return data.employeeMetadata ?? {};
  }, [data]);

  const holidays = useMemo<Holiday[]>(() => {
    if (!data?.available) return [];
    return data.holidays ?? [];
  }, [data]);

  return {
    serverMetadata,
    holidays,
    isReady: query.isSuccess,
    isLoading: query.isLoading,
  };
}
