import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches pre-enriched Employee[] from the server.
 * Replaces the client-side useDataPipeline computation.
 */
export function useEmployeesQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: queryFns.employees,
    enabled: isReady,
  });
}
