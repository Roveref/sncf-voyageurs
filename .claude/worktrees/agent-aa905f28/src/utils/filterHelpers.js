/**
 * Filter helper utilities for include/exclude functionality
 * Provides backward compatibility during migration from array-based to object-based filters
 */

/**
 * Normalize filter value to new structure { included: [], excluded: [] }
 * Handles backward compatibility with old array-based structure
 *
 * @param {Array|Object} value - Filter value (array or object with included/excluded)
 * @returns {Object} Normalized filter object with included and excluded arrays
 */
export const normalizeFilterValue = (value) => {
  if (!value) {
    return { included: [], excluded: [] };
  }

  // If already in new format, return as is
  if (typeof value === "object" && !Array.isArray(value) && "included" in value) {
    return {
      included: Array.isArray(value.included) ? value.included : [],
      excluded: Array.isArray(value.excluded) ? value.excluded : [],
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
 *
 * @returns {Object} Initial filter state
 */
export const initializeFilters = () => ({
  subSegmentCodes: { included: [], excluded: [] },
  subSegments: { included: [], excluded: [] },
  serviceLine1: { included: [], excluded: [] },
  serviceOfferings: { included: [], excluded: [] },
  accounts: { included: [], excluded: [] },
  status: { included: [], excluded: [] },
  people: { included: [], excluded: [] }, // Unified: Manager, Partner, EM (Engagement Manager), EP (Engagement Partner)
  technologyPartners: { included: [], excluded: [] },
});

/**
 * Migrate old filter structure to new structure
 * Converts array-based filters to object-based { included: [], excluded: [] }
 *
 * @param {Object} oldFilters - Old filter structure with arrays
 * @returns {Object} New filter structure with included/excluded
 */
export const migrateFilters = (oldFilters) => {
  const newFilters = {};

  Object.keys(oldFilters).forEach((key) => {
    newFilters[key] = normalizeFilterValue(oldFilters[key]);
  });

  return newFilters;
};

/**
 * Get all active filter values (included) as a flat array
 * Used for backward compatibility with components expecting arrays
 *
 * @param {Object} filterValue - Filter value with included/excluded
 * @returns {Array} Array of included values
 */
export const getIncludedValues = (filterValue) => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.included;
};

/**
 * Get all excluded filter values as a flat array
 *
 * @param {Object} filterValue - Filter value with included/excluded
 * @returns {Array} Array of excluded values
 */
export const getExcludedValues = (filterValue) => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.excluded;
};

/**
 * Get all filter values (both included and excluded) as a flat array
 *
 * @param {Object} filterValue - Filter value with included/excluded
 * @returns {Array} Array of all values
 */
export const getAllValues = (filterValue) => {
  const normalized = normalizeFilterValue(filterValue);
  return [...normalized.included, ...normalized.excluded];
};

/**
 * Check if a value is included in the filter
 *
 * @param {Object} filterValue - Filter value with included/excluded
 * @param {*} value - Value to check
 * @returns {boolean} True if value is in included array
 */
export const isIncluded = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.included.includes(value);
};

/**
 * Check if a value is excluded in the filter
 *
 * @param {Object} filterValue - Filter value with included/excluded
 * @param {*} value - Value to check
 * @returns {boolean} True if value is in excluded array
 */
export const isExcluded = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  return normalized.excluded.includes(value);
};

/**
 * Check if any filters are active (have included or excluded values)
 *
 * @param {Object} filters - All filters
 * @returns {boolean} True if any filter has values
 */
export const hasActiveFilters = (filters) => {
  return Object.values(filters).some((filterValue) => {
    const normalized = normalizeFilterValue(filterValue);
    return normalized.included.length > 0 || normalized.excluded.length > 0;
  });
};

/**
 * Toggle a value in the filter
 * State transitions: not selected → included → excluded → not selected
 *
 * @param {Object} filterValue - Current filter value
 * @param {*} value - Value to toggle
 * @returns {Object} Updated filter value
 */
export const toggleFilterValue = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  const includedIndex = normalized.included.indexOf(value);
  const excludedIndex = normalized.excluded.indexOf(value);

  if (includedIndex !== -1) {
    // Currently included → move to excluded
    normalized.included.splice(includedIndex, 1);
    normalized.excluded.push(value);
  } else if (excludedIndex !== -1) {
    // Currently excluded → remove (not selected)
    normalized.excluded.splice(excludedIndex, 1);
  } else {
    // Not selected → add to included
    normalized.included.push(value);
  }

  return normalized;
};

/**
 * Add a value to included array (removing from excluded if present)
 *
 * @param {Object} filterValue - Current filter value
 * @param {*} value - Value to include
 * @returns {Object} Updated filter value
 */
export const includeValue = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  const excludedIndex = normalized.excluded.indexOf(value);

  // Remove from excluded if present
  if (excludedIndex !== -1) {
    normalized.excluded.splice(excludedIndex, 1);
  }

  // Add to included if not already present
  if (!normalized.included.includes(value)) {
    normalized.included.push(value);
  }

  return normalized;
};

/**
 * Add a value to excluded array (removing from included if present)
 *
 * @param {Object} filterValue - Current filter value
 * @param {*} value - Value to exclude
 * @returns {Object} Updated filter value
 */
export const excludeValue = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  const includedIndex = normalized.included.indexOf(value);

  // Remove from included if present
  if (includedIndex !== -1) {
    normalized.included.splice(includedIndex, 1);
  }

  // Add to excluded if not already present
  if (!normalized.excluded.includes(value)) {
    normalized.excluded.push(value);
  }

  return normalized;
};

/**
 * Remove a value from both included and excluded arrays
 *
 * @param {Object} filterValue - Current filter value
 * @param {*} value - Value to remove
 * @returns {Object} Updated filter value
 */
export const removeValue = (filterValue, value) => {
  const normalized = normalizeFilterValue(filterValue);
  const includedIndex = normalized.included.indexOf(value);
  const excludedIndex = normalized.excluded.indexOf(value);

  if (includedIndex !== -1) {
    normalized.included.splice(includedIndex, 1);
  }

  if (excludedIndex !== -1) {
    normalized.excluded.splice(excludedIndex, 1);
  }

  return normalized;
};

/**
 * Clear all values from a filter
 *
 * @param {Object} filterValue - Current filter value
 * @returns {Object} Empty filter value
 */
export const clearFilter = (filterValue) => {
  return { included: [], excluded: [] };
};
