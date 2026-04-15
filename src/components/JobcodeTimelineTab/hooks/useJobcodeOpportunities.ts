/**
 * useJobcodeOpportunities — derive the visible opportunities from the
 * current filter state.
 *
 * Two outputs, driven by `groupByJobcode`:
 *   - `flatOpportunities`: a single chronologically-sorted list of opps
 *     matching all active filters (used when grouping is OFF).
 *   - `groupedOpportunities`: a list of jobcode groups, each containing
 *     its matching opportunities (used when grouping is ON).
 *
 * "Matching" means: the opportunity belongs to a jobcode that survives
 * the filter state's jobcodeOptions filter (account + person + search).
 * The jobcodeFilter field, if set, narrows to a single jobcode.
 */
import { useMemo } from "react";
import type { Jobcode } from "./useJobcodeData";
import type { UseJobcodeFilterStateResult } from "./useJobcodeFilterState";
import type { PersonJobcodeIndex } from "./usePersonJobcodeIndex";

export interface JobcodeGroup {
  jobcode: Jobcode;
  opportunities: Record<string, unknown>[];
}

export interface UseJobcodeOpportunitiesResult {
  flatOpportunities: Record<string, unknown>[];
  groupedOpportunities: JobcodeGroup[];
  totalOpportunities: number;
}

export function useJobcodeOpportunities(
  jobcodes: Jobcode[],
  filterState: UseJobcodeFilterStateResult,
  personIndex: PersonJobcodeIndex
): UseJobcodeOpportunitiesResult {
  return useMemo(() => {
    // Apply all filters (including jobcodeFilter) to get the visible jobcodes.
    const visibleJobcodes = filterState.filterJobcodes(jobcodes, personIndex);

    const groupedOpportunities: JobcodeGroup[] = visibleJobcodes.map((jc) => ({
      jobcode: jc,
      opportunities: [...jc.opportunities].sort((a, b) => {
        const da = new Date((a as { creationDate?: string }).creationDate || 0).getTime();
        const db = new Date((b as { creationDate?: string }).creationDate || 0).getTime();
        return da - db;
      }),
    }));

    const flatOpportunities = groupedOpportunities
      .flatMap((g) => g.opportunities)
      .sort((a, b) => {
        const da = new Date((a as { creationDate?: string }).creationDate || 0).getTime();
        const db = new Date((b as { creationDate?: string }).creationDate || 0).getTime();
        return da - db;
      });

    return {
      flatOpportunities,
      groupedOpportunities,
      totalOpportunities: flatOpportunities.length,
    };
  }, [jobcodes, filterState, personIndex]);
}
