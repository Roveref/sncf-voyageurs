import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { queryFns } from "./queryFns";

/**
 * Fetches recruitment candidates and aggregates. Non-blocking.
 */
export function useRecruitmentQuery(isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.recruitment,
    queryFn: queryFns.recruitment,
    enabled: isReady,
  });
}
