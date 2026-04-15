/**
 * useMergedEmployeeData — Composition hook that merges server metadata with user overrides.
 *
 * Server data comes from useEmployeeData (React Query cache).
 * User overrides come from useUserDataStore (Zustand).
 * Merge logic replicates the old restoreUserChanges merge (gradeHistory, arrival/departure).
 */

import { useMemo } from "react";
import { useEmployeeData } from "../queries/useEmployeeData";
import { useUserDataStore } from "../stores/useUserDataStore";
import type { EmployeeMetadata } from "../components/StaffingTab/types";

export function useMergedEmployeeData() {
  const { serverMetadata, holidays, isReady, isLoading } = useEmployeeData();
  const overrides = useUserDataStore((s) => s.employeeOverrides);
  const manualEmployees = useUserDataStore((s) => s.manualEmployees);

  const mergedMetadata = useMemo<Record<string, EmployeeMetadata>>(() => {
    // Fast path: no overrides at all
    if (Object.keys(overrides).length === 0) return serverMetadata;

    const allKeys = new Set([...Object.keys(serverMetadata), ...Object.keys(overrides)]);
    const merged: Record<string, EmployeeMetadata> = {};

    for (const empId of allKeys) {
      const base = serverMetadata[empId];
      const over = overrides[empId];

      if (!over) {
        // No override — use server data as-is
        merged[empId] = base;
        continue;
      }

      if (!base) {
        // No server data — override IS the full record
        merged[empId] = over as EmployeeMetadata;
        continue;
      }

      // Merge: spread base, then override, then special fields
      const result = { ...base, ...over } as EmployeeMetadata;

      // gradeHistory: user wins if they provided non-empty array, else keep server
      if ((over as any).gradeHistory?.length > 0) {
        result.gradeHistory = (over as any).gradeHistory;
      } else if (base.gradeHistory?.length > 0) {
        result.gradeHistory = base.gradeHistory;
      }

      // arrivalDate: user override wins only if manualArrival flag is set
      if ((over as any).manualArrival) {
        result.arrivalDate = (over as any).arrivalDate;
      } else {
        result.arrivalDate = base.arrivalDate || (over as any).arrivalDate;
      }

      // departureDate: user override wins only if manualDeparture flag is set
      if ((over as any).manualDeparture) {
        result.departureDate = (over as any).departureDate;
      } else {
        result.departureDate = base.departureDate || (over as any).departureDate;
      }

      merged[empId] = result;
    }

    return merged;
  }, [serverMetadata, overrides]);

  return {
    mergedMetadata,
    manualEmployees,
    holidays,
    isReady,
    isLoading,
  };
}
