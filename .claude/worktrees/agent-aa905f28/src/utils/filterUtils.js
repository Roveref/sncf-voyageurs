/**
 * OPTIMIZED filter utilities
 * Ces fonctions doivent être utilisées avec useMemo pour éviter les recalculs inutiles
 */

import { getIncludedValues, getExcludedValues, normalizeFilterValue } from "./filterHelpers";

/**
 * Apply all filters to opportunity data
 * PHASE 2: Updated to handle both included and excluded arrays per filter
 * PERFORMANCE: Cette fonction est intensive - TOUJOURS l'envelopper dans useMemo !
 *
 * @param {Array} data - Array of opportunities
 * @param {Object} filters - Filter object with all filter criteria (new structure)
 * @param {string} filterMode - 'inclusive' or 'exclusive' (Phase 2: uses per-filter include/exclude)
 * @param {Object} serviceToOfferingMap - Map of service lines to offerings
 * @returns {Array} Filtered opportunities
 */
export function applyAllFilters(data, filters, filterMode, serviceToOfferingMap) {
  if (!data || data.length === 0) return [];

  let result = [...data];
  const safeFilters = filters || {};

  // PHASE 2: Extract both included and excluded values from new filter structure

  // Apply account filter (include + exclude)
  const accountsIncluded = getIncludedValues(safeFilters.accounts);
  const accountsExcluded = getExcludedValues(safeFilters.accounts);

  if (accountsIncluded.length > 0) {
    result = result.filter((item) => accountsIncluded.includes(item["Account"]));
  }
  if (accountsExcluded.length > 0) {
    result = result.filter((item) => !accountsExcluded.includes(item["Account"]));
  }

  // Apply segment code filter (include + exclude)
  const segmentCodesIncluded = getIncludedValues(safeFilters.subSegmentCodes);
  const segmentCodesExcluded = getExcludedValues(safeFilters.subSegmentCodes);

  if (segmentCodesIncluded.length > 0) {
    result = result.filter((item) => segmentCodesIncluded.includes(item["Sub Segment Code"]));
  }
  if (segmentCodesExcluded.length > 0) {
    result = result.filter((item) => !segmentCodesExcluded.includes(item["Sub Segment Code"]));
  }

  // Apply sub segments filter (include + exclude)
  const subSegmentsIncluded = getIncludedValues(safeFilters.subSegments);
  const subSegmentsExcluded = getExcludedValues(safeFilters.subSegments);

  if (subSegmentsIncluded.length > 0) {
    result = result.filter((item) => subSegmentsIncluded.includes(item["Sub Segment"]));
  }
  if (subSegmentsExcluded.length > 0) {
    result = result.filter((item) => !subSegmentsExcluded.includes(item["Sub Segment"]));
  }

  // Apply status filter (include + exclude)
  const statusIncluded = getIncludedValues(safeFilters.status);
  const statusExcluded = getExcludedValues(safeFilters.status);

  if (statusIncluded.length > 0) {
    result = result.filter((item) => statusIncluded.includes(item["Status"]));
  }
  if (statusExcluded.length > 0) {
    result = result.filter((item) => !statusExcluded.includes(item["Status"]));
  }

  // Apply people filter (unified: Manager, Partner, EM, EP)
  const peopleIncluded = getIncludedValues(safeFilters.people);
  const peopleExcluded = getExcludedValues(safeFilters.people);

  if (peopleIncluded.length > 0) {
    result = result.filter((item) => {
      // Normalize and get all people fields (Manager, Partner, EM, EP)
      const manager = item["Manager"] ? String(item["Manager"]).trim() : "";
      const partner = item["Partner"] ? String(item["Partner"]).trim() : "";
      const em = item["EM"] ? String(item["EM"]).trim() : "";
      const ep = item["EP"] ? String(item["EP"]).trim() : "";

      return peopleIncluded.some((selectedPerson) => {
        const normalizedPerson = String(selectedPerson).trim();
        return (
          manager === normalizedPerson ||
          partner === normalizedPerson ||
          em === normalizedPerson ||
          ep === normalizedPerson
        );
      });
    });
  }

  if (peopleExcluded.length > 0) {
    result = result.filter((item) => {
      // Normalize and get all people fields (Manager, Partner, EM, EP)
      const manager = item["Manager"] ? String(item["Manager"]).trim() : "";
      const partner = item["Partner"] ? String(item["Partner"]).trim() : "";
      const em = item["EM"] ? String(item["EM"]).trim() : "";
      const ep = item["EP"] ? String(item["EP"]).trim() : "";

      return !peopleExcluded.some((selectedPerson) => {
        const normalizedPerson = String(selectedPerson).trim();
        return (
          manager === normalizedPerson ||
          partner === normalizedPerson ||
          em === normalizedPerson ||
          ep === normalizedPerson
        );
      });
    });
  }

  // Apply technology partners filter (include + exclude)
  const technologyPartnersIncluded = getIncludedValues(safeFilters.technologyPartners);
  const technologyPartnersExcluded = getExcludedValues(safeFilters.technologyPartners);

  if (technologyPartnersIncluded.length > 0) {
    result = result.filter((item) => {
      const techPartner1 = item["Technology Partner 1"];
      const techPartner2 = item["Technology Partner 2"];
      const techPartner3 = item["Technology Partner 3"];

      return technologyPartnersIncluded.some((selectedPartner) => {
        return (
          (techPartner1 && techPartner1.includes(selectedPartner)) ||
          (techPartner2 && techPartner2.includes(selectedPartner)) ||
          (techPartner3 && techPartner3.includes(selectedPartner))
        );
      });
    });
  }

  if (technologyPartnersExcluded.length > 0) {
    result = result.filter((item) => {
      const techPartner1 = item["Technology Partner 1"];
      const techPartner2 = item["Technology Partner 2"];
      const techPartner3 = item["Technology Partner 3"];

      return !technologyPartnersExcluded.some((selectedPartner) => {
        return (
          (techPartner1 && techPartner1.includes(selectedPartner)) ||
          (techPartner2 && techPartner2.includes(selectedPartner)) ||
          (techPartner3 && techPartner3.includes(selectedPartner))
        );
      });
    });
  }

  // OPTIMIZED: Apply service line filtering and allocation in a single pass
  const serviceLineIncluded = getIncludedValues(safeFilters.serviceLine1);
  const serviceLineExcluded = getExcludedValues(safeFilters.serviceLine1);

  // Apply include filter first (if any)
  if (serviceLineIncluded.length > 0) {
    // Pre-calculate if all service lines are selected (only once)
    const allServiceLines = new Set();
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      if (item["Service Line 1"]) allServiceLines.add(item["Service Line 1"]);
      if (item["Service Line 2"]) allServiceLines.add(item["Service Line 2"]);
      if (item["Service Line 3"]) allServiceLines.add(item["Service Line 3"]);
    }

    const isAllServiceLinesSelected =
      serviceLineIncluded.length > 0 &&
      allServiceLines.size > 0 &&
      [...allServiceLines].every((line) => serviceLineIncluded.includes(line));

    // OPTIMIZED: Filter first, then add allocation properties (faster than reduce with spread)
    // Step 1: Filter matching opportunities (must have at least one included service line)
    result = result.filter(
      (item) =>
        (item["Service Line 1"] && serviceLineIncluded.includes(item["Service Line 1"])) ||
        (item["Service Line 2"] && serviceLineIncluded.includes(item["Service Line 2"])) ||
        (item["Service Line 3"] && serviceLineIncluded.includes(item["Service Line 3"]))
    );

    // Step 2: Add allocation properties (modify in place for maximum speed)
    if (isAllServiceLinesSelected) {
      // Fast path: all service lines selected
      for (let i = 0; i < result.length; i++) {
        result[i]["Allocated Gross Revenue"] = result[i]["Gross Revenue"];
        result[i]["Allocated Net Revenue"] = result[i]["Net Revenue"] || 0;
        result[i]["Is Allocated"] = false;
        result[i]["Allocation Percentage"] = 100;
        result[i]["Allocated Service Line"] = "All Service Lines";
      }
    } else {
      // Calculate allocation for each item
      for (let i = 0; i < result.length; i++) {
        const item = result[i];
        let allocation = 0;
        let allocatedServiceLine = "";
        let totalAllocation = 0;

        const hasMatchingSL1 = item["Service Line 1"] && serviceLineIncluded.includes(item["Service Line 1"]);
        const hasMatchingSL2 = item["Service Line 2"] && serviceLineIncluded.includes(item["Service Line 2"]);
        const hasMatchingSL3 = item["Service Line 3"] && serviceLineIncluded.includes(item["Service Line 3"]);

        // Count matching lines with percentages
        let matchCount = 0;
        const lines = [];

        if (hasMatchingSL1 && item["Service Offering 1 %"]) {
          const alloc = parseFloat(item["Service Offering 1 %"]) / 100;
          lines.push({ line: item["Service Line 1"], allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }
        if (hasMatchingSL2 && item["Service Offering 2 %"]) {
          const alloc = parseFloat(item["Service Offering 2 %"]) / 100;
          lines.push({ line: item["Service Line 2"], allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }
        if (hasMatchingSL3 && item["Service Offering 3 %"]) {
          const alloc = parseFloat(item["Service Offering 3 %"]) / 100;
          lines.push({ line: item["Service Line 3"], allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }

        // Determine allocation
        if (matchCount === 0) {
          allocation = 1;
          allocatedServiceLine = hasMatchingSL1
            ? item["Service Line 1"]
            : hasMatchingSL2
              ? item["Service Line 2"]
              : item["Service Line 3"];
        } else if (matchCount === 1) {
          allocation = lines[0].allocation;
          allocatedServiceLine = lines[0].line;
        } else {
          allocation = Math.min(totalAllocation, 1);
          allocatedServiceLine = lines.map((l) => l.line).join(", ");
          if (totalAllocation > 1) allocatedServiceLine += " (capped at 100%)";
        }

        // Add allocation properties (modify in place - no spread operator)
        item["Allocated Gross Revenue"] = item["Gross Revenue"] * allocation;
        item["Allocated Net Revenue"] = (item["Net Revenue"] || 0) * allocation;
        item["Is Allocated"] = allocation !== 1;
        item["Allocation Percentage"] = allocation * 100;
        item["Allocated Service Line"] = allocatedServiceLine;
      }
    }
  }

  // Apply exclude filter for service lines (if any)
  if (serviceLineExcluded.length > 0) {
    result = result.filter((item) => {
      // Exclude if ANY of the service lines match an excluded value
      return !(
        (item["Service Line 1"] && serviceLineExcluded.includes(item["Service Line 1"])) ||
        (item["Service Line 2"] && serviceLineExcluded.includes(item["Service Line 2"])) ||
        (item["Service Line 3"] && serviceLineExcluded.includes(item["Service Line 3"]))
      );
    });
  }

  // Reset allocation properties when no service line is included
  // Note: Exclusions don't create allocations, only inclusions do
  // So we clean up whenever there are no inclusions, regardless of exclusions
  if (serviceLineIncluded.length === 0) {
    // FIX: Reset allocation properties when no service lines are included
    // This ensures that revenue calculations use original values instead of stale allocated values
    for (let i = 0; i < result.length; i++) {
      delete result[i]["Allocated Gross Revenue"];
      delete result[i]["Allocated Net Revenue"];
      delete result[i]["Is Allocated"];
      delete result[i]["Allocation Percentage"];
      delete result[i]["Allocated Service Line"];
    }
  }

  // Apply service offering filter with allocation logic (include + exclude)
  // Service offerings now use composite keys: "ServiceLine::Offering"
  const serviceOfferingsIncluded = getIncludedValues(safeFilters.serviceOfferings);
  const serviceOfferingsExcluded = getExcludedValues(safeFilters.serviceOfferings);

  if (serviceOfferingsIncluded.length > 0) {
    // Step 1: Filter opportunities that have any of the included service offerings
    // Compare composite keys: "ServiceLine::Offering"
    result = result.filter((item) => {
      const compositeKey1 =
        item["Service Line 1"] && item["Service Offering 1"]
          ? `${item["Service Line 1"]}::${item["Service Offering 1"]}`
          : null;
      const compositeKey2 =
        item["Service Line 2"] && item["Service Offering 2"]
          ? `${item["Service Line 2"]}::${item["Service Offering 2"]}`
          : null;
      const compositeKey3 =
        item["Service Line 3"] && item["Service Offering 3"]
          ? `${item["Service Line 3"]}::${item["Service Offering 3"]}`
          : null;

      return (
        serviceOfferingsIncluded.includes(compositeKey1) ||
        serviceOfferingsIncluded.includes(compositeKey2) ||
        serviceOfferingsIncluded.includes(compositeKey3)
      );
    });

    // Step 2: Calculate allocation based on the percentage of the selected service offerings
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      let allocation = 0;
      let allocatedOfferings = [];
      let allocatedServiceLines = [];

      // Check each service offering position using composite keys
      const compositeKey1 =
        item["Service Line 1"] && item["Service Offering 1"]
          ? `${item["Service Line 1"]}::${item["Service Offering 1"]}`
          : null;
      const compositeKey2 =
        item["Service Line 2"] && item["Service Offering 2"]
          ? `${item["Service Line 2"]}::${item["Service Offering 2"]}`
          : null;
      const compositeKey3 =
        item["Service Line 3"] && item["Service Offering 3"]
          ? `${item["Service Line 3"]}::${item["Service Offering 3"]}`
          : null;

      if (compositeKey1 && serviceOfferingsIncluded.includes(compositeKey1) && item["Service Offering 1 %"]) {
        const alloc = parseFloat(item["Service Offering 1 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 1"]);
        if (item["Service Line 1"]) {
          allocatedServiceLines.push(item["Service Line 1"]);
        }
      }
      if (compositeKey2 && serviceOfferingsIncluded.includes(compositeKey2) && item["Service Offering 2 %"]) {
        const alloc = parseFloat(item["Service Offering 2 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 2"]);
        if (item["Service Line 2"]) {
          allocatedServiceLines.push(item["Service Line 2"]);
        }
      }
      if (compositeKey3 && serviceOfferingsIncluded.includes(compositeKey3) && item["Service Offering 3 %"]) {
        const alloc = parseFloat(item["Service Offering 3 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 3"]);
        if (item["Service Line 3"]) {
          allocatedServiceLines.push(item["Service Line 3"]);
        }
      }

      // If no percentage found, default to 100%
      if (allocation === 0) {
        allocation = 1;
      }

      // Add or update allocation properties
      item["Allocated Gross Revenue"] = item["Gross Revenue"] * allocation;
      item["Allocated Net Revenue"] = (item["Net Revenue"] || 0) * allocation;
      item["Is Allocated"] = allocation !== 1;
      item["Allocation Percentage"] = allocation * 100;
      item["Allocated Service Offering"] = allocatedOfferings.join(", ");
      item["Allocated Service Line"] = allocatedServiceLines.join(", ");
    }
  }

  // Apply exclude filter for service offerings (if any)
  // Compare composite keys: "ServiceLine::Offering"
  if (serviceOfferingsExcluded.length > 0) {
    result = result.filter((item) => {
      const compositeKey1 =
        item["Service Line 1"] && item["Service Offering 1"]
          ? `${item["Service Line 1"]}::${item["Service Offering 1"]}`
          : null;
      const compositeKey2 =
        item["Service Line 2"] && item["Service Offering 2"]
          ? `${item["Service Line 2"]}::${item["Service Offering 2"]}`
          : null;
      const compositeKey3 =
        item["Service Line 3"] && item["Service Offering 3"]
          ? `${item["Service Line 3"]}::${item["Service Offering 3"]}`
          : null;

      return !(
        serviceOfferingsExcluded.includes(compositeKey1) ||
        serviceOfferingsExcluded.includes(compositeKey2) ||
        serviceOfferingsExcluded.includes(compositeKey3)
      );
    });
  }

  // Reset allocation properties when no service offering is included
  // Note: Exclusions don't create allocations, only inclusions do
  // So we clean up whenever there are no inclusions, regardless of exclusions
  if (serviceOfferingsIncluded.length === 0) {
    // FIX: Reset allocation properties when no service offerings are included
    // This ensures that revenue calculations use original values instead of stale allocated values
    for (let i = 0; i < result.length; i++) {
      delete result[i]["Allocated Gross Revenue"];
      delete result[i]["Allocated Net Revenue"];
      delete result[i]["Is Allocated"];
      delete result[i]["Allocation Percentage"];
      delete result[i]["Allocated Service Offering"];
      delete result[i]["Allocated Service Line"];
    }
  }

  return result;
}

/**
 * Get unique values for a field across filtered data
 * Used for building filter options dynamically
 */
export function getUniqueValues(data, fieldName) {
  if (!data || data.length === 0) return [];

  const uniqueSet = new Set();
  data.forEach((item) => {
    const value = item[fieldName];
    if (value !== null && value !== undefined && value !== "") {
      uniqueSet.add(value);
    }
  });

  return Array.from(uniqueSet).sort();
}

/**
 * Get multiple unique values from multiple fields
 * Useful for allocated fields that have multiple columns
 */
export function getUniqueValuesFromMultipleFields(data, fieldNames) {
  if (!data || data.length === 0) return [];

  const uniqueSet = new Set();
  data.forEach((item) => {
    fieldNames.forEach((fieldName) => {
      const value = item[fieldName];
      if (value !== null && value !== undefined && value !== "") {
        uniqueSet.add(value);
      }
    });
  });

  return Array.from(uniqueSet).sort();
}
