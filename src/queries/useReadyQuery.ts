import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Polls /api/hydrate/ready every ~1.2s until backend reports data is ready.
 * Only enabled when the backend health check has passed.
 */
export function useReadyQuery(backendAvailable: boolean) {
  return useQuery({
    queryKey: queryKeys.ready,
    queryFn: queryFns.ready,
    enabled: backendAvailable,
    refetchInterval: (query) => (query.state.data?.ready ? false : 1200),
    staleTime: 0,
    gcTime: 0,
  });
}
