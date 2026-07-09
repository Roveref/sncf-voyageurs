import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Opportunity, CrmAccount, CrmContact } from "../types";

// ── Status option types (shared across pipeline/bookings/staffing) ──
export interface StatusOption {
  status: number;
  label: string;
  shortLabel: string;
}

/** Phases cycle de vie GAIF — surchargé au runtime par les labels var_optionsets. */
const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { status: 1, label: "Émergence", shortLabel: "Émergence" },
  { status: 4, label: "Investissement / CEB", shortLabel: "Invest." },
  { status: 6, label: "Étude / Stratégie", shortLabel: "Étude" },
  { status: 11, label: "Maintenance lourde", shortLabel: "Maint." },
  { status: 13, label: "Conventionné", shortLabel: "Conv." },
  { status: 14, label: "En exploitation", shortLabel: "Exploit." },
  { status: 15, label: "Déclassé", shortLabel: "Déclassé" },
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
