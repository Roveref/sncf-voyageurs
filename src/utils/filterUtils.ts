/**
 * OPTIMIZED filter utilities
 * Uses Set for O(1) lookups and single-pass filtering where possible.
 * Ces fonctions doivent être utilisées avec useMemo pour éviter les recalculs inutiles
 */

import { getIncludedValues, getExcludedValues, normalizeFilterValue } from "./filterHelpers";
import type { RevenueTeamMember } from "../types";

// Helper: convert array to Set (returns null if empty, to skip checks)
function toSet(arr: string[]): Set<string> | null {
  return arr.length > 0 ? new Set(arr) : null;
}

/**
 * Apply all filters to opportunity data
 * PERFORMANCE: Uses Set.has() (O(1)) instead of Array.includes() (O(n)) for all lookups.
 * Simple filters (accounts, segments, status) are combined into a single-pass filter.
 * Service line and offering filters are applied separately because they mutate items (allocation).
 *
 * @param {Array} data - Array of opportunities
 * @param {Object} filters - Filter object with all filter criteria (new structure)
 * @param {string} filterMode - 'inclusive' or 'exclusive' (Phase 2: uses per-filter include/exclude)
 * @param {Object} serviceToOfferingMap - Map of service lines to offerings
 * @returns {Array} Filtered opportunities
 */
export function applyAllFilters(
  data: any[],
  filters: Record<string, any>,
  filterMode: string,
  serviceToOfferingMap: Record<string, string[]>,
  segmentModes?: Map<string, "team" | "both">,
  serviceLineModes?: Map<string, "team" | "both">,
  personToSegmentMap?: Map<string, { segment: string; serviceLine?: string }>,
  revenueTeamMap?: Record<string, RevenueTeamMember[]>
): Record<string, any>[] {
  if (!data || data.length === 0) return [];

  const safeFilters = filters || {};

  // Pre-compute all Sets upfront (O(1) lookups vs O(n) includes)
  const accountsInc = toSet(getIncludedValues(safeFilters.accounts));
  const accountsExc = toSet(getExcludedValues(safeFilters.accounts));
  const segCodesIncArr = getIncludedValues(safeFilters.subSegmentCodes);
  const segCodesExcArr = getExcludedValues(safeFilters.subSegmentCodes);
  const subSegsInc = toSet(getIncludedValues(safeFilters.subSegments));
  const subSegsExc = toSet(getExcludedValues(safeFilters.subSegments));
  const statusInc = toSet(getIncludedValues(safeFilters.status));
  const statusExc = toSet(getExcludedValues(safeFilters.status));
  const peopleInc = getIncludedValues(safeFilters.people);
  const peopleExc = getExcludedValues(safeFilters.people);
  const techInc = getIncludedValues(safeFilters.technologyPartners);
  const techExc = getExcludedValues(safeFilters.technologyPartners);

  // Pre-compute people Sets for O(1) lookups (case-insensitive)
  const peopleIncSet = peopleInc.length > 0 ? new Set(peopleInc.map((p) => String(p).trim().toLowerCase())) : null;
  const peopleExcSet = peopleExc.length > 0 ? new Set(peopleExc.map((p) => String(p).trim().toLowerCase())) : null;

  // Split segment codes by mode (opp / team / both)
  const segOppInc = new Set<string>();
  const segTeamInc = new Set<string>();
  const segBothInc = new Set<string>();
  segCodesIncArr.forEach((seg) => {
    const mode = segmentModes?.get(seg);
    if (mode === "team") segTeamInc.add(seg);
    else if (mode === "both") segBothInc.add(seg);
    else segOppInc.add(seg);
  });
  const segOppExc = new Set<string>();
  const segTeamExc = new Set<string>();
  const segBothExc = new Set<string>();
  segCodesExcArr.forEach((seg) => {
    const mode = segmentModes?.get(seg);
    if (mode === "team") segTeamExc.add(seg);
    else if (mode === "both") segBothExc.add(seg);
    else segOppExc.add(seg);
  });
  const hasSegInc = segCodesIncArr.length > 0;
  const hasSegExc = segCodesExcArr.length > 0;

  // Helper: get person segments from an opportunity's people fields
  const getPersonSegments = (item: any): Set<string> => {
    if (!personToSegmentMap || personToSegmentMap.size === 0) return new Set();
    const names = [item.manager, item.partner, item.em, item.ep]
      .filter(Boolean)
      .map((n: string) => String(n).trim().toLowerCase());
    const segs = new Set<string>();
    names.forEach((n) => {
      const entry = personToSegmentMap.get(n);
      if (entry?.segment) segs.add(entry.segment);
    });
    return segs;
  };

  // Helper: get person service lines from an opportunity's people fields
  const getPersonServiceLines = (item: any): Set<string> => {
    if (!personToSegmentMap || personToSegmentMap.size === 0) return new Set();
    const names = [item.manager, item.partner, item.em, item.ep]
      .filter(Boolean)
      .map((n: string) => String(n).trim().toLowerCase());
    const sls = new Set<string>();
    names.forEach((n) => {
      const entry = personToSegmentMap.get(n);
      if (entry?.serviceLine) sls.add(entry.serviceLine);
    });
    return sls;
  };

  // Track whether items have been cloned (to avoid mutating original store objects)
  let cloned = false;
  const ensureCloned = () => {
    if (!cloned) {
      result = result.map((item) => ({ ...item }));
      cloned = true;
    }
  };

  // Single-pass filter for all simple include/exclude filters
  let result = data.filter((item) => {
    // Account filter
    if (accountsInc && !accountsInc.has((item.account || "").trim())) return false;
    if (accountsExc && accountsExc.has((item.account || "").trim())) return false;

    // Segment code filter (mode-aware)
    if (hasSegInc) {
      const oppCode = (item.subSegmentCode || "").trim();
      let matchesAny = false;
      // Opp mode: match by opportunity's Sub Segment Code
      if (segOppInc.size > 0 && oppCode && segOppInc.has(oppCode)) matchesAny = true;
      // Team mode: match by people→segment mapping
      if (!matchesAny && segTeamInc.size > 0) {
        const personSegs = getPersonSegments(item);
        for (const seg of segTeamInc) {
          if (personSegs.has(seg)) {
            matchesAny = true;
            break;
          }
        }
      }
      // Both mode: match by opportunity code AND people mapping
      if (!matchesAny && segBothInc.size > 0) {
        const personSegs = getPersonSegments(item);
        for (const seg of segBothInc) {
          if (oppCode === seg && personSegs.has(seg)) {
            matchesAny = true;
            break;
          }
        }
      }
      if (!matchesAny) return false;
    }
    if (hasSegExc) {
      const oppCode = (item.subSegmentCode || "").trim();
      // Opp mode exclusion: exclude by opportunity code
      if (segOppExc.size > 0 && oppCode && segOppExc.has(oppCode)) return false;
      // Team mode exclusion: exclude by people→segment
      if (segTeamExc.size > 0) {
        const personSegs = getPersonSegments(item);
        for (const seg of segTeamExc) {
          if (personSegs.has(seg)) return false;
        }
      }
      // Both mode exclusion: exclude if BOTH match
      if (segBothExc.size > 0) {
        const personSegs = getPersonSegments(item);
        for (const seg of segBothExc) {
          if (oppCode === seg && personSegs.has(seg)) return false;
        }
      }
    }

    // Sub segments filter
    if (subSegsInc && !subSegsInc.has(item.subSegment)) return false;
    if (subSegsExc && subSegsExc.has(item.subSegment)) return false;

    // Status filter
    if (statusInc && !statusInc.has(String(item.status))) return false;
    if (statusExc && statusExc.has(String(item.status))) return false;

    // People filter (Manager, Partner, EM, EP + Revenue Team members)
    if (peopleIncSet) {
      const fields = [
        item.manager ? String(item.manager).trim() : "",
        item.partner ? String(item.partner).trim() : "",
        item.em ? String(item.em).trim() : "",
        item.ep ? String(item.ep).trim() : "",
      ];
      // Also check revenue team members for this opportunity
      const team = revenueTeamMap?.[item.opportunityId];
      if (team) {
        for (const m of team) {
          if (m.name) fields.push(String(m.name).trim());
        }
      }
      if (!fields.some((f) => f && peopleIncSet.has(f.toLowerCase()))) return false;
    }
    if (peopleExcSet) {
      const fields = [
        item.manager ? String(item.manager).trim() : "",
        item.partner ? String(item.partner).trim() : "",
        item.em ? String(item.em).trim() : "",
        item.ep ? String(item.ep).trim() : "",
      ];
      if (fields.some((f) => f && peopleExcSet.has(f.toLowerCase()))) return false;
    }

    // Technology partners filter
    if (techInc.length > 0) {
      const tp1 = item.techPartner1;
      const tp2 = item.techPartner2;
      const tp3 = item.techPartner3;
      const matches = techInc.some(
        (sp) => (tp1 && tp1.includes(sp)) || (tp2 && tp2.includes(sp)) || (tp3 && tp3.includes(sp))
      );
      if (!matches) return false;
    }
    if (techExc.length > 0) {
      const tp1 = item.techPartner1;
      const tp2 = item.techPartner2;
      const tp3 = item.techPartner3;
      const matches = techExc.some(
        (sp) => (tp1 && tp1.includes(sp)) || (tp2 && tp2.includes(sp)) || (tp3 && tp3.includes(sp))
      );
      if (matches) return false;
    }

    return true;
  });

  // Service line filtering + allocation (must be separate because it mutates items)
  const serviceLineIncluded = getIncludedValues(safeFilters.serviceLine1);
  const serviceLineExcluded = getExcludedValues(safeFilters.serviceLine1);

  // Split service lines by mode
  const slOppInc = new Set<string>();
  const slTeamInc = new Set<string>();
  const slBothInc = new Set<string>();
  serviceLineIncluded.forEach((sl) => {
    const mode = serviceLineModes?.get(sl);
    if (mode === "team") slTeamInc.add(sl);
    else if (mode === "both") slBothInc.add(sl);
    else slOppInc.add(sl);
  });
  const slOppExc = new Set<string>();
  const slTeamExc = new Set<string>();
  const slBothExc = new Set<string>();
  serviceLineExcluded.forEach((sl) => {
    const mode = serviceLineModes?.get(sl);
    if (mode === "team") slTeamExc.add(sl);
    else if (mode === "both") slBothExc.add(sl);
    else slOppExc.add(sl);
  });

  const slIncSet = toSet(serviceLineIncluded);
  const slExcSet = toSet(serviceLineExcluded);

  // Helper: check if item matches service line by opportunity data (opp mode)
  const itemMatchesSLOpp = (item: any, slSet: Set<string>): boolean => {
    return (
      (item.serviceLine1 && slSet.has(item.serviceLine1)) ||
      (item.serviceLine2 && slSet.has(item.serviceLine2)) ||
      (item.serviceLine3 && slSet.has(item.serviceLine3))
    );
  };

  // Helper: check if item matches service line by people (team mode)
  const itemMatchesSLTeam = (item: any, slSet: Set<string>): boolean => {
    const personSLs = getPersonServiceLines(item);
    for (const sl of slSet) {
      if (personSLs.has(sl)) return true;
    }
    return false;
  };

  if (slIncSet) {
    // Pre-calculate if all service lines are selected
    const allServiceLines = new Set();
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      if (item.serviceLine1) allServiceLines.add(item.serviceLine1);
      if (item.serviceLine2) allServiceLines.add(item.serviceLine2);
      if (item.serviceLine3) allServiceLines.add(item.serviceLine3);
    }

    let allSelected = true;
    for (const line of allServiceLines) {
      if (!slIncSet.has(line as string)) {
        allSelected = false;
        break;
      }
    }

    // Filter matching opportunities (mode-aware)
    const hasTeamOrBothSL = slTeamInc.size > 0 || slBothInc.size > 0;
    result = result.filter((item) => {
      // Opp mode: match by Service Line 1/2/3
      if (slOppInc.size > 0 && itemMatchesSLOpp(item, slOppInc)) return true;
      // Team mode: match by people→serviceLine
      if (slTeamInc.size > 0 && itemMatchesSLTeam(item, slTeamInc)) return true;
      // Both mode: both conditions must match
      if (slBothInc.size > 0) {
        if (itemMatchesSLOpp(item, slBothInc) && itemMatchesSLTeam(item, slBothInc)) return true;
      }
      // If no team/both modes, fall back to pure opp check for all included
      if (!hasTeamOrBothSL) return itemMatchesSLOpp(item, slIncSet);
      return false;
    });

    // Add allocation properties — clone items to avoid mutating frozen store objects
    result = result.map((item) => ({ ...item }));
    if (allSelected) {
      for (let i = 0; i < result.length; i++) {
        result[i].allocatedGrossRevenue = result[i].grossRevenue;
        result[i].allocatedNetRevenue = result[i].netRevenue || 0;
        result[i].isAllocated = false;
        result[i].allocationPercentage = 100;
        result[i].allocatedServiceLine = "All Service Lines";
      }
    } else {
      for (let i = 0; i < result.length; i++) {
        const item = result[i];
        let allocation = 0;
        let allocatedServiceLine = "";
        let totalAllocation = 0;

        const hasMatchingSL1 = item.serviceLine1 && slIncSet.has(item.serviceLine1);
        const hasMatchingSL2 = item.serviceLine2 && slIncSet.has(item.serviceLine2);
        const hasMatchingSL3 = item.serviceLine3 && slIncSet.has(item.serviceLine3);

        let matchCount = 0;
        const lines: { line: string; allocation: number }[] = [];

        if (hasMatchingSL1 && item.serviceOffering1Pct) {
          const alloc = (parseFloat(item.serviceOffering1Pct) || 0) / 100;
          lines.push({ line: item.serviceLine1, allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }
        if (hasMatchingSL2 && item.serviceOffering2Pct) {
          const alloc = (parseFloat(item.serviceOffering2Pct) || 0) / 100;
          lines.push({ line: item.serviceLine2, allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }
        if (hasMatchingSL3 && item.serviceOffering3Pct) {
          const alloc = (parseFloat(item.serviceOffering3Pct) || 0) / 100;
          lines.push({ line: item.serviceLine3, allocation: alloc });
          totalAllocation += alloc;
          matchCount++;
        }

        if (matchCount === 0) {
          allocation = 1;
          allocatedServiceLine = hasMatchingSL1
            ? item.serviceLine1
            : hasMatchingSL2
              ? item.serviceLine2
              : item.serviceLine3;
        } else if (matchCount === 1) {
          allocation = lines[0].allocation;
          allocatedServiceLine = lines[0].line;
        } else {
          allocation = Math.min(totalAllocation, 1);
          allocatedServiceLine = lines.map((l) => l.line).join(", ");
          if (totalAllocation > 1) allocatedServiceLine += " (capped at 100%)";
        }

        item.allocatedGrossRevenue = item.grossRevenue * allocation;
        item.allocatedNetRevenue = (item.netRevenue || 0) * allocation;
        item.isAllocated = allocation !== 1;
        item.allocationPercentage = allocation * 100;
        item.allocatedServiceLine = allocatedServiceLine;
      }
    }
  }

  // Apply exclude filter for service lines (mode-aware)
  if (slExcSet) {
    result = result.filter((item) => {
      // Opp mode exclusion
      if (slOppExc.size > 0 && itemMatchesSLOpp(item, slOppExc)) return false;
      // Team mode exclusion
      if (slTeamExc.size > 0 && itemMatchesSLTeam(item, slTeamExc)) return false;
      // Both mode exclusion: exclude only if BOTH match
      if (slBothExc.size > 0 && itemMatchesSLOpp(item, slBothExc) && itemMatchesSLTeam(item, slBothExc)) return false;
      return true;
    });
  }

  // Reset allocation properties when no service line is included
  if (serviceLineIncluded.length === 0) {
    ensureCloned();
    for (let i = 0; i < result.length; i++) {
      delete result[i].allocatedGrossRevenue;
      delete result[i].allocatedNetRevenue;
      delete result[i].isAllocated;
      delete result[i].allocationPercentage;
      delete result[i].allocatedServiceLine;
    }
  }

  // Service offering filter + allocation
  const serviceOfferingsIncluded = getIncludedValues(safeFilters.serviceOfferings);
  const serviceOfferingsExcluded = getExcludedValues(safeFilters.serviceOfferings);
  const soIncSet = toSet(serviceOfferingsIncluded);
  const soExcSet = toSet(serviceOfferingsExcluded);

  // Skip offering include-filter when all offerings come from service line
  // bidirectional sync (the user selected whole service lines, not specific offerings).
  const offeringsCameFromSLSync =
    soIncSet &&
    serviceLineIncluded.length > 0 &&
    serviceOfferingsIncluded.every((o) =>
      serviceLineIncluded.some((sl) => (serviceToOfferingMap[sl] || []).includes(o))
    );

  if (soIncSet && !offeringsCameFromSLSync) {
    result = result.filter((item) => {
      const ck1 = item.serviceLine1 && item.serviceOffering1 ? `${item.serviceLine1}::${item.serviceOffering1}` : null;
      const ck2 = item.serviceLine2 && item.serviceOffering2 ? `${item.serviceLine2}::${item.serviceOffering2}` : null;
      const ck3 = item.serviceLine3 && item.serviceOffering3 ? `${item.serviceLine3}::${item.serviceOffering3}` : null;
      return (
        (ck1 !== null && soIncSet.has(ck1)) ||
        (ck2 !== null && soIncSet.has(ck2)) ||
        (ck3 !== null && soIncSet.has(ck3))
      );
    });

    // Calculate allocation for each item
    ensureCloned();
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      let allocation = 0;
      let allocatedOfferings: string[] = [];
      let allocatedServiceLines: string[] = [];

      const ck1 = item.serviceLine1 && item.serviceOffering1 ? `${item.serviceLine1}::${item.serviceOffering1}` : null;
      const ck2 = item.serviceLine2 && item.serviceOffering2 ? `${item.serviceLine2}::${item.serviceOffering2}` : null;
      const ck3 = item.serviceLine3 && item.serviceOffering3 ? `${item.serviceLine3}::${item.serviceOffering3}` : null;

      if (ck1 && soIncSet.has(ck1) && item.serviceOffering1Pct) {
        allocation += (parseFloat(item.serviceOffering1Pct) || 0) / 100;
        allocatedOfferings.push(item.serviceOffering1);
        if (item.serviceLine1) allocatedServiceLines.push(item.serviceLine1);
      }
      if (ck2 && soIncSet.has(ck2) && item.serviceOffering2Pct) {
        allocation += (parseFloat(item.serviceOffering2Pct) || 0) / 100;
        allocatedOfferings.push(item.serviceOffering2);
        if (item.serviceLine2) allocatedServiceLines.push(item.serviceLine2);
      }
      if (ck3 && soIncSet.has(ck3) && item.serviceOffering3Pct) {
        allocation += (parseFloat(item.serviceOffering3Pct) || 0) / 100;
        allocatedOfferings.push(item.serviceOffering3);
        if (item.serviceLine3) allocatedServiceLines.push(item.serviceLine3);
      }

      if (allocation === 0) allocation = 1;

      item.allocatedGrossRevenue = item.grossRevenue * allocation;
      item.allocatedNetRevenue = (item.netRevenue || 0) * allocation;
      item.isAllocated = allocation !== 1;
      item.allocationPercentage = allocation * 100;
      item.allocatedServiceOffering = allocatedOfferings.join(", ");
      item.allocatedServiceLine = allocatedServiceLines.join(", ");
    }
  }

  if (soExcSet) {
    result = result.filter((item) => {
      const ck1 = item.serviceLine1 && item.serviceOffering1 ? `${item.serviceLine1}::${item.serviceOffering1}` : null;
      const ck2 = item.serviceLine2 && item.serviceOffering2 ? `${item.serviceLine2}::${item.serviceOffering2}` : null;
      const ck3 = item.serviceLine3 && item.serviceOffering3 ? `${item.serviceLine3}::${item.serviceOffering3}` : null;
      return !(
        (ck1 !== null && soExcSet.has(ck1)) ||
        (ck2 !== null && soExcSet.has(ck2)) ||
        (ck3 !== null && soExcSet.has(ck3))
      );
    });
  }

  // Only reset allocation properties if neither service lines nor service offerings are included
  // (service line filter sets these too, so don't wipe when only offerings are empty)
  if (serviceOfferingsIncluded.length === 0 && serviceLineIncluded.length === 0) {
    ensureCloned();
    for (let i = 0; i < result.length; i++) {
      delete result[i].allocatedGrossRevenue;
      delete result[i].allocatedNetRevenue;
      delete result[i].isAllocated;
      delete result[i].allocationPercentage;
      delete result[i].allocatedServiceOffering;
      delete result[i].allocatedServiceLine;
    }
  }

  // ── Person-based revenue allocation ──
  // When people filter is active AND revenueTeamMap has data, compute per-person allocation.
  // Each grade bucket claims 100% of the opportunity revenue.
  // Within a bucket, members split by percentage.
  if (peopleIncSet && revenueTeamMap) {
    const hasAnyTeamData = Object.keys(revenueTeamMap).length > 0;
    if (hasAnyTeamData) {
      ensureCloned();

      for (let i = 0; i < result.length; i++) {
        const item = result[i];
        const opportunityId = item.opportunityId;
        const team = revenueTeamMap[opportunityId];

        if (team && team.length > 0) {
          // Find members whose name matches the people filter
          const matchingMembers = team.filter(
            (m: RevenueTeamMember) => m.name && peopleIncSet.has(m.name.trim().toLowerCase())
          );

          if (matchingMembers.length > 0) {
            // Sum percentages across buckets (each bucket independently claims 100%)
            let totalFraction = 0;
            const buckets = new Map<string, number>();
            for (const member of matchingMembers) {
              const existing = buckets.get(member.gradeBucket) || 0;
              buckets.set(member.gradeBucket, existing + member.percentage);
            }
            for (const pct of buckets.values()) {
              totalFraction += pct / 100;
            }
            totalFraction = Math.min(totalFraction, 1); // Cap at 100%

            // Build allocation label
            const label = matchingMembers.map((m: RevenueTeamMember) => `${m.name} (${m.gradeBucket})`).join(", ");

            // If SL allocation was already applied, compound on top of it
            const baseGross =
              item.allocatedGrossRevenue !== undefined ? item.allocatedGrossRevenue : item.grossRevenue || 0;
            const baseNet = item.allocatedNetRevenue !== undefined ? item.allocatedNetRevenue : item.netRevenue || 0;

            item.allocatedGrossRevenue = baseGross * totalFraction;
            item.allocatedNetRevenue = baseNet * totalFraction;
            item.isAllocated = totalFraction !== 1 || item.isAllocated;
            item.allocationPercentage = totalFraction * 100;
            item.allocatedServiceLine = label;
          }
          // If no matching members in revenue team, keep existing allocation or full revenue
        }
      }
    }
  }

  return result;
}

/**
 * Get unique values for a field across filtered data
 */
export function getUniqueValues(data: any[], fieldName: string): string[] {
  if (!data || data.length === 0) return [];

  const uniqueSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const value = data[i][fieldName];
    if (value !== null && value !== undefined && value !== "") {
      uniqueSet.add(value);
    }
  }

  return Array.from(uniqueSet).sort();
}

/**
 * Get multiple unique values from multiple fields
 */
export function getUniqueValuesFromMultipleFields(data: any[], fieldNames: string[]): string[] {
  if (!data || data.length === 0) return [];

  const uniqueSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    for (let j = 0; j < fieldNames.length; j++) {
      const value = item[fieldNames[j]];
      if (value !== null && value !== undefined && value !== "") {
        uniqueSet.add(value);
      }
    }
  }

  return Array.from(uniqueSet).sort();
}
