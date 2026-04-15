import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches employee skills + catalog.
 */
export function useSkillsQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.skills,
    queryFn: queryFns.skills,
    enabled: isReady,
  });
}
