import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches available regions once backend is available.
 */
export function useRegionsQuery(backendAvailable: boolean) {
  return useQuery({
    queryKey: queryKeys.regions,
    queryFn: queryFns.regions,
    enabled: backendAvailable,
  });
}
