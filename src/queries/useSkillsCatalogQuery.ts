import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches the skills catalog for autocomplete. Non-blocking.
 */
export function useSkillsCatalogQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.skillsCatalog,
    queryFn: queryFns.skillsCatalog,
    enabled: isReady,
  });
}
