import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches user modifications (overrides, manual opps, scenarios, editor states).
 * Only fires after all data queries have succeeded so restoreUserChanges() can merge
 * with already-loaded metadata.
 */
export function useChangesQuery(allDataReady: boolean) {
  return useQuery({
    queryKey: queryKeys.changes,
    queryFn: queryFns.changes,
    enabled: allDataReady,
  });
}
