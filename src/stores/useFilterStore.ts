/**
 * useFilterStore — Central Zustand store for all filter state.
 *
 * Replaces prop-drilling of useFilterManagement return values through
 * App.tsx → Sidebars → MobileFilterModal. Components read directly
 * from this store instead of receiving 14-28 filter props.
 *
 * Bidirectional synchronization logic (segment↔sub-segment, service line↔offerings)
 * is preserved from the original useFilterManagement hook.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { startTransition } from "react";
import {
  initializeFilters,
  normalizeFilterValue,
  getIncludedValues,
  toggleFilterValue,
  type FilterValue,
  type Filters,
} from "../utils/filterHelpers";
import { useCrmData } from "../queries/useCrmData";

export interface FilterState {
  filters: Filters;
  segmentModes: Map<string, "team" | "both">;
  serviceLineModes: Map<string, "team" | "both">;

  // Actions
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
  handleFilterChange: (
    newFilters: Record<string, unknown>,
    segmentToSubSegmentMap?: Record<string, string[]>,
    serviceToOfferingMap?: Record<string, string[]>
  ) => void;
  handleToggleFilter: (
    type: string,
    value: string,
    segmentToSubSegmentMap?: Record<string, string[]>,
    serviceToOfferingMap?: Record<string, string[]>
  ) => void;
  handleClearAllFilters: () => void;
  handleClearFilterType: (type: string) => void;
  handleAccountChange: (event: unknown, newValue: unknown) => void;
  setSegmentModes: (
    updater: Map<string, "team" | "both"> | ((prev: Map<string, "team" | "both">) => Map<string, "team" | "both">)
  ) => void;
  setServiceLineModes: (
    updater: Map<string, "team" | "both"> | ((prev: Map<string, "team" | "both">) => Map<string, "team" | "both">)
  ) => void;
}

// ── Bidirectional sync logic (pure function) ────────────────────────────────

function applyBidirectionalSync(
  prevFilters: Filters,
  rawUpdated: Record<string, FilterValue>,
  segmentToSubSegmentMap: Record<string, string[]>,
  serviceToOfferingMap: Record<string, string[]>
): Filters {
  const updatedFilters = { ...rawUpdated };

  // --- Service Line ↔ Service Offerings synchronization ---
  const prevServiceLines = new Set(getIncludedValues(prevFilters.serviceLine1));
  const newServiceLines = new Set(getIncludedValues(updatedFilters.serviceLine1));
  const prevOfferings = new Set(getIncludedValues(prevFilters.serviceOfferings));
  const newOfferings = new Set(getIncludedValues(updatedFilters.serviceOfferings));

  const addedServiceLines = [...newServiceLines].filter((sl) => !prevServiceLines.has(sl));
  const removedServiceLines = [...prevServiceLines].filter((sl) => !newServiceLines.has(sl));
  const addedOfferings = [...newOfferings].filter((off) => !prevOfferings.has(off));
  const removedOfferings = [...prevOfferings].filter((off) => !newOfferings.has(off));

  addedServiceLines.forEach((serviceLine) => {
    (serviceToOfferingMap[serviceLine] || []).forEach((off) => newOfferings.add(off));
  });
  removedServiceLines.forEach((serviceLine) => {
    (serviceToOfferingMap[serviceLine] || []).forEach((off) => {
      const inOther = [...newServiceLines].some((sl) => serviceToOfferingMap[sl]?.includes(off));
      if (!inOther) newOfferings.delete(off);
    });
  });
  addedOfferings.forEach((offering) => {
    const [serviceLine] = offering.split("::");
    if (serviceLine && serviceToOfferingMap[serviceLine]) newServiceLines.add(serviceLine);
  });
  removedOfferings.forEach((offering) => {
    const [serviceLine] = offering.split("::");
    if (serviceLine && serviceToOfferingMap[serviceLine]) {
      const hasOther = (serviceToOfferingMap[serviceLine] || []).some(
        (off) => off !== offering && newOfferings.has(off)
      );
      if (!hasOther) newServiceLines.delete(serviceLine);
    }
  });

  // --- Segment Code ↔ Sub-Segment synchronization ---
  const prevSegmentCodes = new Set(getIncludedValues(prevFilters.subSegmentCodes));
  const newSegmentCodes = new Set(getIncludedValues(updatedFilters.subSegmentCodes));
  const prevSubSegments = new Set(getIncludedValues(prevFilters.subSegments));
  const newSubSegments = new Set(getIncludedValues(updatedFilters.subSegments));

  const addedSegmentCodes = [...newSegmentCodes].filter((c) => !prevSegmentCodes.has(c));
  const removedSegmentCodes = [...prevSegmentCodes].filter((c) => !newSegmentCodes.has(c));
  const removedSubSegments = [...prevSubSegments].filter((s) => !newSubSegments.has(s));

  addedSegmentCodes.forEach((code) => {
    (segmentToSubSegmentMap[code] || []).forEach((sub) => newSubSegments.add(sub));
  });
  removedSegmentCodes.forEach((code) => {
    (segmentToSubSegmentMap[code] || []).forEach((sub) => {
      const inOther = [...newSegmentCodes].some((c) => segmentToSubSegmentMap[c]?.includes(sub));
      if (!inOther) newSubSegments.delete(sub);
    });
  });
  removedSubSegments.forEach((subSegment) => {
    Object.keys(segmentToSubSegmentMap).forEach((code) => {
      if (segmentToSubSegmentMap[code]?.includes(subSegment)) {
        const hasOther = (segmentToSubSegmentMap[code] || []).some((s) => s !== subSegment && newSubSegments.has(s));
        if (!hasOther) newSegmentCodes.delete(code);
      }
    });
  });

  // Apply synchronized values (preserve excluded arrays)
  updatedFilters.serviceLine1 = {
    included: [...newServiceLines],
    excluded: normalizeFilterValue(updatedFilters.serviceLine1).excluded,
  };
  updatedFilters.serviceOfferings = {
    included: [...newOfferings],
    excluded: normalizeFilterValue(updatedFilters.serviceOfferings).excluded,
  };
  updatedFilters.subSegmentCodes = {
    included: [...newSegmentCodes],
    excluded: normalizeFilterValue(updatedFilters.subSegmentCodes).excluded,
  };
  updatedFilters.subSegments = {
    included: [...newSubSegments],
    excluded: normalizeFilterValue(updatedFilters.subSegments).excluded,
  };

  return updatedFilters as unknown as Filters;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useFilterStore = create<FilterState>()(
  devtools(
    (set, get) => ({
      filters: initializeFilters(),
      segmentModes: new Map(),
      serviceLineModes: new Map(),

      setFilters: (updater) =>
        set((s) => ({
          filters: typeof updater === "function" ? updater(s.filters) : updater,
        })),

      handleFilterChange: (newFilters, segmentToSubSegmentMap = {}, serviceToOfferingMap = {}) => {
        if (!newFilters || typeof newFilters !== "object") return;

        startTransition(() => {
          set((s) => {
            const normalized = { ...(s.filters as unknown as Record<string, FilterValue>) };
            Object.keys(newFilters).forEach((key) => {
              normalized[key] = normalizeFilterValue(newFilters[key]);
            });
            return {
              filters: applyBidirectionalSync(s.filters, normalized, segmentToSubSegmentMap, serviceToOfferingMap),
            };
          });
        });
      },

      handleToggleFilter: (type, value, segmentToSubSegmentMap = {}, serviceToOfferingMap = {}) => {
        const { filters } = get();
        if (!type || !(type in filters)) return;
        const filterValue = filters[type as keyof Filters];
        const updated = toggleFilterValue(filterValue, value);
        get().handleFilterChange({ ...filters, [type]: updated }, segmentToSubSegmentMap, serviceToOfferingMap);
      },

      handleClearAllFilters: () => set({ filters: initializeFilters() }),

      handleClearFilterType: (type) => {
        const { filters } = get();
        if (!type || !(type in filters)) return;
        get().handleFilterChange({ ...filters, [type]: [] });
      },

      handleAccountChange: (_event, newValue) => {
        set((s) => ({
          filters: { ...s.filters, accounts: normalizeFilterValue(newValue || []) },
        }));
      },

      setSegmentModes: (updater) =>
        set((s) => ({
          segmentModes: typeof updater === "function" ? updater(s.segmentModes) : updater,
        })),

      setServiceLineModes: (updater) =>
        set((s) => ({
          serviceLineModes: typeof updater === "function" ? updater(s.serviceLineModes) : updater,
        })),
    }),
    { name: "FilterStore" }
  )
);

// ── Derived selectors ────────────────────────────────────────────────────────

/** Count of all active filters (included + excluded) across all types. */
export function useActiveFilterCount(): number {
  const filters = useFilterStore((s) => s.filters);
  return Object.values(filters).reduce((count: number, fv) => {
    const n = normalizeFilterValue(fv);
    return count + n.included.length + n.excluded.length;
  }, 0);
}

/** Sub-segments available based on selected segment codes. */
export function useFilteredSubSegments(): string[] {
  const subSegmentCodes = useFilterStore((s) => s.filters.subSegmentCodes);
  const { segmentToSubSegmentMap } = useCrmData();
  const codes = getIncludedValues(subSegmentCodes);
  const result: string[] = [];
  codes.forEach((code) => {
    if (segmentToSubSegmentMap[code]) result.push(...segmentToSubSegmentMap[code]);
  });
  return [...new Set(result)];
}

/** Service offerings available based on selected service lines. */
export function useFilteredServiceOfferings(): string[] {
  const serviceLine1 = useFilterStore((s) => s.filters.serviceLine1);
  const { serviceToOfferingMap } = useCrmData();
  const lines = getIncludedValues(serviceLine1);
  if (lines.length === 0) return [];
  const result: string[] = [];
  lines.forEach((line) => {
    if (serviceToOfferingMap[line]) result.push(...serviceToOfferingMap[line]);
  });
  return [...new Set(result)];
}
