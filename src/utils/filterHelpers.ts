/**
 * Filter helper utilities for include/exclude functionality
 * Provides backward compatibility during migration from array-based to object-based filters
 */

export interface FilterValue {
  included: string[];
  excluded: string[];
}

export interface Filters {
  subSegmentCodes: FilterValue;
  subSegments: FilterValue;
  serviceLine1: FilterValue;
  serviceOfferings: FilterValue;
  accounts: FilterValue;
  status: FilterValue;
  people: FilterValue;
  technologyPartners: FilterValue;
  macroGrades: FilterValue;
  macroCategories: FilterValue;
}

/**
 * Normalize filter value to new structure { included: [], excluded: [] }
 * Handles backward compatibility with old array-based structure
 */
export const normalizeFilterValue = (value: unknown): FilterValue => {
  if (!value) {
    return { included: [], excluded: [] };
  }

  // If already in new format, return as is
  if (typeof value === "object" && !Array.isArray(value) && "included" in (value as object)) {
    const obj = value as Partial<FilterValue>;
    return {
      included: Array.isArray(obj.included) ? obj.included : [],
      excluded: Array.isArray(obj.excluded) ? obj.excluded : [],
    };
  }

  // If old format (array), migrate to new format (all items as included)
  if (Array.isArray(value)) {
    return {
      included: value,
      excluded: [],
    };
  }

  // Fallback for unexpected formats
  return { included: [], excluded: [] };
};

/**
 * Initialize filter state with new structure
 * All filters start with empty included/excluded arrays
 */
export const initializeFilters = (): Filters => ({
  subSegmentCodes: { included: [], excluded: [] },
  subSegments: { included: [], excluded: [] },
  serviceLine1: { included: [], excluded: [] },
  serviceOfferings: { included: [], excluded: [] },
  accounts: { included: [], excluded: [] },
  status: { included: [], excluded: [] },
  people: { included: [], excluded: [] },
  technologyPartners: { included: [], excluded: [] },
  macroGrades: { included: [], excluded: [] },
  macroCategories: { included: [], excluded: [] },
});

/**
 * Migrate old filter structure to new structure
 * Converts array-based filters to object-based { included: [], excluded: [] }
 */
export const migrateFilters = (oldFilters: Record<string, unknown>): Record<string, FilterValue> => {
  const newFilters: Record<string, FilterValue> = {};

  Object.keys(oldFilters).forEach((key) => {
    newFilters[key] = normalizeFilterValue(oldFilters[key]);
  });

  return newFilters;
};

/**
 * Get all active filter values (included) as a flat array
 * Used for backward compatibility with components expecting arrays
 */
export const getIncludedValues = (filterValue: unknown): string[] => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.included;
};

/**
 * Get all excluded filter values as a flat array
 */
export const getExcludedValues = (filterValue: unknown): string[] => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.excluded;
};

/**
 * Get all filter values (both included and excluded) as a flat array
 */
export const getAllValues = (filterValue: unknown): string[] => {
  const normalized = normalizeFilterValue(filterValue);
  return [...normalized.included, ...normalized.excluded];
};

/**
 * Check if a value is included in the filter
 */
export const isIncluded = (filterValue: unknown, value: string): boolean => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.included.includes(value);
};

/**
 * Check if a value is excluded in the filter
 */
export const isExcluded = (filterValue: unknown, value: string): boolean => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.excluded.includes(value);
};

/**
 * Check if any filters are active (have included or excluded values)
 */
export const hasActiveFilters = (filters: Record<string, unknown>): boolean => {
  return Object.values(filters).some((filterValue) => {
    const normalized = normalizeFilterValue(filterValue);
    return normalized.included.length > 0 || normalized.excluded.length > 0;
  });
};

/**
 * Toggle a value in the filter
 * State transitions: not selected -> included -> excluded -> not selected
 */
export const toggleFilterValue = (filterValue: unknown, value: string): FilterValue => {
  const normalized = normalizeFilterValue(filterValue);
  const includedIndex = normalized.included.indexOf(value);
  const excludedIndex = normalized.excluded.indexOf(value);

  if (includedIndex !== -1) {
    // Currently included -> move to excluded
    return {
      included: normalized.included.filter((_, i) => i !== includedIndex),
      excluded: [...normalized.excluded, value],
    };
  } else if (excludedIndex !== -1) {
    // Currently excluded -> remove (not selected)
    return {
      included: [...normalized.included],
      excluded: normalized.excluded.filter((_, i) => i !== excludedIndex),
    };
  } else {
    // Not selected -> add to included
    return {
      included: [...normalized.included, value],
      excluded: [...normalized.excluded],
    };
  }
};

/**
 * Add a value to included array (removing from excluded if present)
 */
export const includeValue = (filterValue: unknown, value: string): FilterValue => {
  const normalized = normalizeFilterValue(filterValue);
  return {
    included: normalized.included.includes(value) ? [...normalized.included] : [...normalized.included, value],
    excluded: normalized.excluded.filter((v) => v !== value),
  };
};

/**
 * Add a value to excluded array (removing from included if present)
 */
export const excludeValue = (filterValue: unknown, value: string): FilterValue => {
  const normalized = normalizeFilterValue(filterValue);
  return {
    included: normalized.included.filter((v) => v !== value),
    excluded: normalized.excluded.includes(value) ? [...normalized.excluded] : [...normalized.excluded, value],
  };
};

/**
 * Remove a value from both included and excluded arrays
 */
export const removeValue = (filterValue: unknown, value: string): FilterValue => {
  const normalized = normalizeFilterValue(filterValue);
  return {
    included: normalized.included.filter((v) => v !== value),
    excluded: normalized.excluded.filter((v) => v !== value),
  };
};

/**
 * Clear all values from a filter
 */
export const clearFilter = (_filterValue?: unknown): FilterValue => {
  return { included: [], excluded: [] };
};

/**
 * Serialize current filters to a URL search params string.
 * Only serializes filters with at least one included value.
 * Excluded values are intentionally omitted (not shareable via URL).
 */
export const serializeFiltersToURL = (filters: Filters): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const normalized = normalizeFilterValue(value);
    if (normalized.included.length > 0) {
      params.set(key, normalized.included.join(","));
    }
  }
  return params.toString();
};

/**
 * Deserialize URL search params string back to a partial Filters object.
 * Returns null if no recognized filter params are found.
 * Unknown keys are ignored for forward-compatibility.
 */
export const deserializeFiltersFromURL = (search: string): Partial<Filters> | null => {
  const params = new URLSearchParams(search);
  if (params.size === 0) return null;
  const emptyFilters = initializeFilters();
  const filters: Record<string, FilterValue> = {};
  for (const [key, value] of params.entries()) {
    if (key in emptyFilters) {
      filters[key] = { included: value.split(",").filter(Boolean), excluded: [] };
    }
  }
  return Object.keys(filters).length > 0 ? (filters as Partial<Filters>) : null;
};
