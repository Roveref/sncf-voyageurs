import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Polls /api/health every 5s until the backend is reachable, then stops.
 */
export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: queryFns.health,
    refetchInterval: (query) => (query.state.data === true ? false : 5000),
    staleTime: 0,
  });
}
