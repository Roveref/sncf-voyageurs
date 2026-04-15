/**
 * useJobcodeFilterState — local filter state + filtering primitives for
 * the JobcodeTimelineTab top filter bar.
 *
 * Filters: free text, account, jobcode, person. State is held locally
 * (NOT in the global useFilterStore — jobcode filters should not leak
 * across tabs).
 */
import { useCallback, useMemo, useState } from "react";
import type { PersonJobcodeIndex } from "./usePersonJobcodeIndex";

export interface JobcodeLike {
  jobcode: string;
  account: string;
  totalRevenue: number;
  opportunities: Record<string, unknown>[];
}

export interface JobcodeFilters {
  searchText: string;
  accountFilter: string | null;
  jobcodeFilter: string | null;
  personFilter: string | null;
  /** If true, opportunities are displayed grouped under collapsible jobcode headers. */
  groupByJobcode: boolean;
}

const EMPTY_FILTERS: JobcodeFilters = {
  searchText: "",
  accountFilter: null,
  jobcodeFilter: null,
  personFilter: null,
  groupByJobcode: false,
};

const matchesText = (jobcode: JobcodeLike, search: string): boolean => {
  if (!search) return true;
  const needle = search.toLowerCase();
  if (jobcode.jobcode.toLowerCase().includes(needle)) return true;
  if (jobcode.account?.toLowerCase().includes(needle)) return true;
  for (const opp of jobcode.opportunities) {
    const oppName = (opp as { opportunity?: string }).opportunity;
    if (typeof oppName === "string" && oppName.toLowerCase().includes(needle)) return true;
  }
  return false;
};

export interface UseJobcodeFilterStateResult {
  filters: JobcodeFilters;
  setSearchText: (v: string) => void;
  setAccountFilter: (v: string | null) => void;
  setJobcodeFilter: (v: string | null) => void;
  setPersonFilter: (v: string | null) => void;
  setGroupByJobcode: (v: boolean) => void;
  clearAll: () => void;
  /** True if at least one filter is narrowing the view (search/account/jobcode/person). */
  hasActiveFilter: boolean;
  /** Apply current filters to a jobcode list. Pass the live index for person filtering. */
  filterJobcodes: <T extends JobcodeLike>(jobcodes: T[], personIndex: PersonJobcodeIndex) => T[];
  /**
   * Like filterJobcodes but ignores the jobcodeFilter — used by the
   * autocomplete dropdown so it shows the full available set instead of
   * just the currently selected entry.
   */
  jobcodeOptions: <T extends JobcodeLike>(jobcodes: T[], personIndex: PersonJobcodeIndex) => T[];
}

export function useJobcodeFilterState(): UseJobcodeFilterStateResult {
  const [filters, setFilters] = useState<JobcodeFilters>(EMPTY_FILTERS);

  const setSearchText = useCallback((v: string) => setFilters((f) => ({ ...f, searchText: v })), []);
  const setAccountFilter = useCallback(
    (v: string | null) =>
      setFilters((f) => {
        // If the new account doesn't contain the current jobcode, clear it.
        if (v != null && f.jobcodeFilter && f.accountFilter !== v) {
          return { ...f, accountFilter: v, jobcodeFilter: null };
        }
        return { ...f, accountFilter: v };
      }),
    []
  );
  const setJobcodeFilter = useCallback((v: string | null) => setFilters((f) => ({ ...f, jobcodeFilter: v })), []);
  const setPersonFilter = useCallback(
    (v: string | null) =>
      setFilters((f) => {
        // Clear jobcode selection when person changes — the cascade will
        // re-evaluate validity at render time.
        if (v !== f.personFilter) return { ...f, personFilter: v, jobcodeFilter: null };
        return f;
      }),
    []
  );
  const setGroupByJobcode = useCallback((v: boolean) => setFilters((f) => ({ ...f, groupByJobcode: v })), []);
  const clearAll = useCallback(() => setFilters((f) => ({ ...EMPTY_FILTERS, groupByJobcode: f.groupByJobcode })), []);
  const hasActiveFilter =
    !!filters.searchText.trim() ||
    filters.accountFilter != null ||
    filters.jobcodeFilter != null ||
    filters.personFilter != null;

  const filterJobcodes = useCallback(
    <T extends JobcodeLike>(jobcodes: T[], personIndex: PersonJobcodeIndex): T[] => {
      const { searchText, accountFilter, jobcodeFilter, personFilter } = filters;
      const personSet = personFilter ? personIndex.get(personFilter) : undefined;
      return jobcodes.filter((jc) => {
        if (accountFilter && jc.account !== accountFilter) return false;
        if (jobcodeFilter && jc.jobcode !== jobcodeFilter) return false;
        if (personSet && !personSet.has(jc.jobcode.toUpperCase())) return false;
        if (!matchesText(jc, searchText)) return false;
        return true;
      });
    },
    [filters]
  );

  const jobcodeOptions = useCallback(
    <T extends JobcodeLike>(jobcodes: T[], personIndex: PersonJobcodeIndex): T[] => {
      const { searchText, accountFilter, personFilter } = filters;
      const personSet = personFilter ? personIndex.get(personFilter) : undefined;
      return jobcodes.filter((jc) => {
        if (accountFilter && jc.account !== accountFilter) return false;
        if (personSet && !personSet.has(jc.jobcode.toUpperCase())) return false;
        if (!matchesText(jc, searchText)) return false;
        return true;
      });
    },
    [filters]
  );

  return useMemo(
    () => ({
      filters,
      setSearchText,
      setAccountFilter,
      setJobcodeFilter,
      setPersonFilter,
      setGroupByJobcode,
      clearAll,
      hasActiveFilter,
      filterJobcodes,
      jobcodeOptions,
    }),
    [
      filters,
      setSearchText,
      setAccountFilter,
      setJobcodeFilter,
      setPersonFilter,
      setGroupByJobcode,
      clearAll,
      hasActiveFilter,
      filterJobcodes,
      jobcodeOptions,
    ]
  );
}
