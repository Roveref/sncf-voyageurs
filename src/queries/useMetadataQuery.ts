import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches employee metadata (grades, arrivals/departures, holidays).
 */
export function useMetadataQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.metadata,
    queryFn: queryFns.metadata,
    enabled: isReady,
  });
}
