import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Opportunity, CrmAccount, CrmContact } from "../types";

// ── Status option types (shared across pipeline/bookings/staffing) ──
export interface StatusOption {
  status: number;
  label: string;
  shortLabel: string;
}

/** Default status options — overridden at hydration time by CRM OptionSet labels. */
const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { status: 1, label: "Lead Identified", shortLabel: "Lead" },
  { status: 4, label: "Go Approved", shortLabel: "Go" },
  { status: 6, label: "Proposal Submitted", shortLabel: "Proposal" },
  { status: 11, label: "Client Won", shortLabel: "Won" },
  { status: 13, label: "AEL", shortLabel: "AEL" },
  { status: 14, label: "Booked", shortLabel: "Booked" },
  { status: 15, label: "Lost", shortLabel: "Lost" },
];

/**
 * @deprecated Use `useCrmStore(s => s.statusOptions)` or `useCrmStore.getState().statusOptions` instead.
 * Kept as a getter for backward compatibility — returns the current store state.
 */
export const STATUS_OPTIONS: StatusOption[] = DEFAULT_STATUS_OPTIONS;

/**
 * @deprecated Use `useCrmStore.getState().updateStatusLabels(optionset)` instead.
 * Kept for backward compatibility — delegates to the store action.
 */
export function updateStatusOptionsFromOptionSet(optionset: Record<number, string>): void {
  useCrmStore.getState().updateStatusLabels(optionset);
}

// ── Types ──
export interface FilterOptions {
  subSegmentCodes: string[];
  subSegments: string[];
  serviceLine1: string[];
  serviceOfferings: string[];
  accounts: string[];
}

export interface CrmState {
  // Core CRM data
  opportunityData: Opportunity[];
  crmAccounts: CrmAccount[];
  crmContacts: CrmContact[];
  filterOptions: FilterOptions;
  segmentToSubSegmentMap: Record<string, string[]>;
  serviceToOfferingMap: Record<string, string[]>;

  // Status options (reactive — labels updated from CRM OptionSets at hydration)
  statusOptions: StatusOption[];
  updateStatusLabels: (optionset: Record<number, string>) => void;

  // Setters
  setOpportunityData: (data: Opportunity[]) => void;
  setCrmAccounts: (data: CrmAccount[]) => void;
  setCrmContacts: (data: CrmContact[]) => void;
  setFilterOptions: (options: FilterOptions) => void;
  setSegmentToSubSegmentMap: (map: Record<string, string[]>) => void;
  setServiceToOfferingMap: (map: Record<string, string[]>) => void;
}

export const useCrmStore = create<CrmState>()(
  devtools(
    (set) => ({
      // ── Core CRM data ──
      opportunityData: [],
      crmAccounts: [],
      crmContacts: [],
      filterOptions: {
        subSegmentCodes: [],
        subSegments: [],
        serviceLine1: [],
        serviceOfferings: [],
        accounts: [],
      },
      segmentToSubSegmentMap: {},
      serviceToOfferingMap: {},

      // ── Status options ──
      statusOptions: DEFAULT_STATUS_OPTIONS,
      updateStatusLabels: (optionset) =>
        set((s) => ({
          statusOptions: s.statusOptions.map((opt) => {
            const label = optionset[opt.status];
            return label ? { ...opt, label } : opt;
          }),
        })),

      // ── Setters ──
      setOpportunityData: (data) => set({ opportunityData: data }),
      setCrmAccounts: (data) => set({ crmAccounts: data }),
      setCrmContacts: (data) => set({ crmContacts: data }),
      setFilterOptions: (options) => set({ filterOptions: options }),
      setSegmentToSubSegmentMap: (map) => set({ segmentToSubSegmentMap: map }),
      setServiceToOfferingMap: (map) => set({ serviceToOfferingMap: map }),
    }),
    { name: "CrmStore" }
  )
);
