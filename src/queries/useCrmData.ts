/**
 * useCrmData — Facade hook that reads CRM data from React Query cache directly.
 * Replaces `useCrmStore(s => s.opportunityData)` etc. for consumers.
 *
 * Reads the hydration filter from useAppStore and constructs the query key.
 * Returns empty defaults while data is loading.
 */

import { useAppStore } from "../stores/useAppStore";
import { useCrmQuery } from "./useCrmQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useHealthQuery } from "./useHealthQuery";
import { STATUS_OPTIONS } from "../utils/statusOptions";
import type { Opportunity, CrmAccount, CrmContact } from "../types";
import type { StatusOption } from "../utils/statusOptions";

export interface FilterOptions {
  subSegmentCodes: string[];
  subSegments: string[];
  serviceLine1: string[];
  serviceOfferings: string[];
  accounts: string[];
}

const EMPTY_OPPS: Opportunity[] = [];
const EMPTY_ACCOUNTS: CrmAccount[] = [];
const EMPTY_CONTACTS: CrmContact[] = [];
const EMPTY_FILTER_OPTIONS: FilterOptions = {
  subSegmentCodes: [],
  subSegments: [],
  serviceLine1: [],
  serviceOfferings: [],
  accounts: [],
};
const EMPTY_MAP: Record<string, string[]> = {};

export function useCrmData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true;

  const crmQuery = useCrmQuery(hydrationFilter, isReady);
  const data = crmQuery.data;

  return {
    opportunityData: (data?.available ? data.opportunities : EMPTY_OPPS) as Opportunity[],
    crmAccounts: (data?.available ? data.crmAccounts : EMPTY_ACCOUNTS) as CrmAccount[],
    crmContacts: (data?.available ? data.crmContacts : EMPTY_CONTACTS) as CrmContact[],
    filterOptions: (data?.available ? data.filterOptions : EMPTY_FILTER_OPTIONS) as FilterOptions,
    segmentToSubSegmentMap: (data?.available ? data.segmentToSubSegmentMap : EMPTY_MAP) as Record<string, string[]>,
    serviceToOfferingMap: (data?.available ? data.serviceToOfferingMap : EMPTY_MAP) as Record<string, string[]>,
    statusOptions: STATUS_OPTIONS as StatusOption[],
    isLoading: crmQuery.isLoading,
    isSuccess: crmQuery.isSuccess,
  };
}
