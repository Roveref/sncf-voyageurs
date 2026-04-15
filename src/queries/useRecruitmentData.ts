/**
 * useRecruitmentData — Reads recruitment data from React Query cache directly.
 * Replaces useRecruitmentStore selectors for server-cached fields.
 */

import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useRecruitmentQuery } from "./useRecruitmentQuery";
import type { RecruitmentCandidate, RecruitmentAggregates } from "../types/recruitment";

const EMPTY_CANDIDATES: RecruitmentCandidate[] = [];
const EMPTY_AGGREGATES: RecruitmentAggregates | null = null;

export function useRecruitmentData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useRecruitmentQuery(isReady);
  const data = query.data;

  return {
    candidates: (data?.available ? data.candidates : EMPTY_CANDIDATES) as RecruitmentCandidate[],
    aggregates: (data?.available ? data.aggregates : EMPTY_AGGREGATES) as RecruitmentAggregates | null,
    hasRecruitmentData: !!data?.available,
    isLoading: query.isLoading,
  };
}
