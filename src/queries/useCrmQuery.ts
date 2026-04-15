import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";
import type { CrmFilter } from "./queryKeys";

/**
 * Fetches CRM data (opportunities, accounts, filterOptions, config).
 * Key includes the filter so changing region/country auto-refetches.
 * Only enabled once the backend is ready AND a filter has been provided.
 */
export function useCrmQuery(filter: CrmFilter | null, isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.crm(filter ?? {}),
    queryFn: () => queryFns.crm(filter ?? {}),
    enabled: isReady && filter !== null,
  });
}
