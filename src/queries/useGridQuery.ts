import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches the pre-computed daily grid (breakdown in hours) from the server.
 * The frontend caches this and applies filters locally.
 */
export function useGridQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.grid,
    queryFn: queryFns.grid,
    enabled: isReady,
  });
}
