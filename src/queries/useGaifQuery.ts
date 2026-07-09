import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches the GAIF bundle (contracts, projects, comites, risks, audits,
 * doctrinaire docs, VR schedule). Non-blocking — waits until backend is ready.
 */
export function useGaifQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.gaif,
    queryFn: queryFns.gaif,
    enabled: isReady,
  });
}
