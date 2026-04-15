import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches SAP actuals data. Region-independent.
 */
export function useSapQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.sap,
    queryFn: queryFns.sap,
    enabled: isReady,
  });
}
