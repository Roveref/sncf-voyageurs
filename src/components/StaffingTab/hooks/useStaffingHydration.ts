import { useEffect, useRef } from "react";
import { useStaffingData } from "../../../queries/useStaffingData";
import { useSapData } from "../../../queries/useSapData";
import { useSkillsData } from "../../../queries/useSkillsData";
import type { StaffingRecord } from "../types";

interface UseStaffingHydrationArgs {
  data: StaffingRecord[];
  sapData: any;
  skillsData: any;
  setData: (records: StaffingRecord[]) => void;
  setSapData: (data: any) => void;
  setSkillsData: (data: any) => void;
}

/**
 * Transfers backend-hydrated data from React Query cache into local state,
 * and maintains a snapshot of the base data before editor edits.
 *
 * Reads directly from facade hooks (useStaffingData, useSapData, useSkillsData)
 * instead of the old bridge pattern through useDataStore.
 */
export function useStaffingHydration({
  data,
  sapData,
  skillsData,
  setData,
  setSapData,
  setSkillsData,
}: UseStaffingHydrationArgs) {
  const baseDataRef = useRef<StaffingRecord[]>([]);

  // Read from React Query cache via facade hooks
  const { records: queryRecords } = useStaffingData();
  const { sapData: querySapData } = useSapData();
  const { skillsData: querySkillsData } = useSkillsData();

  // Track last-transferred data reference to detect new data from SSE invalidation
  const lastStaffingRef = useRef<StaffingRecord[] | null>(null);
  const lastSapRef = useRef<unknown>(null);
  const lastSkillsRef = useRef<unknown>(null);

  // Hydrate staffing records from React Query cache
  useEffect(() => {
    if (queryRecords.length > 0 && queryRecords !== lastStaffingRef.current) {
      // Only transfer if local state is empty OR data reference changed (SSE refetch)
      if (data.length === 0 || (lastStaffingRef.current !== null && queryRecords !== lastStaffingRef.current)) {
        if (baseDataRef.current.length === 0) {
          baseDataRef.current = [...queryRecords];
        }
        setData(queryRecords);
      }
      lastStaffingRef.current = queryRecords;
    }
  }, [queryRecords, data.length, setData]);

  // Hydrate SAP data from React Query cache
  useEffect(() => {
    if (querySapData && querySapData !== lastSapRef.current) {
      if (!sapData || (lastSapRef.current !== null && querySapData !== lastSapRef.current)) {
        setSapData(querySapData);
      }
      lastSapRef.current = querySapData;
    }
  }, [querySapData, sapData, setSapData]);

  // Hydrate skills data from React Query cache
  useEffect(() => {
    if (querySkillsData && querySkillsData !== lastSkillsRef.current) {
      if (!skillsData || (lastSkillsRef.current !== null && querySkillsData !== lastSkillsRef.current)) {
        setSkillsData(querySkillsData);
      }
      lastSkillsRef.current = querySkillsData;
    }
  }, [querySkillsData, skillsData, setSkillsData]);

  return { baseDataRef };
}
