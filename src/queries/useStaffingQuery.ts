import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches MDS staffing records. Region-independent — fires as soon as backend is ready.
 */
export function useStaffingQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.staffing,
    queryFn: queryFns.staffing,
    enabled: isReady,
  });
}
