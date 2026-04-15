/**
 * Custom hook for pipeline calculations
 * Performance-optimized with memoization for all calculations
 */

import { useMemo, useCallback } from "react";
import { groupDataBy } from "../../../utils/dataUtils";
import { ALL_STATUSES, STATUS_CATEGORIES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic, getRevenueValue } from "../utils/revenueCalculations";

/**
 * Hook for calculating pipeline metrics and data groupings
 * All calculations are memoized for optimal performance
 *
 * @param {Array} filteredOpportunities - Filtered opportunities array
 * @param {boolean} showNetRevenue - Whether to show net or gross revenue
 * @param {boolean} isAllocated - Whether allocation is active
 * @returns {Object} Calculated pipeline data
 */
export const usePipelineCalculations = (filteredOpportunities, showNetRevenue, isAllocated) => {
  /**
   * Calculate pipeline data grouped by status
   * OPTIMIZED: Single pass instead of 15 filter() + 30 reduce()
   */
  const pipelineByStatus = useMemo(() => {
    const startTime = performance.now();

    // Initialize results for all statuses
    const statusMap = new Map();
    ALL_STATUSES.forEach((statusInfo) => {
      statusMap.set(statusInfo.statusNumber, {
        status: statusInfo.status,
        originalValue: 0,
        allocatedValue: 0,
        calculatedValue: 0,
        count: 0,
        statusNumber: statusInfo.statusNumber,
      });
    });

    // Single pass through all data
    filteredOpportunities.forEach((item) => {
      const statusData = statusMap.get(item["Status"]);
      if (statusData) {
        // Always use the base revenue (total amount before allocation)
        const revenue = showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
        const allocatedRevenue = item["Is Allocated"]
          ? showNetRevenue
            ? item["Allocated Net Revenue"] || 0
            : item["Allocated Gross Revenue"] || 0
          : revenue;

        statusData.originalValue += revenue;
        statusData.allocatedValue += allocatedRevenue;
        statusData.calculatedValue += calculateRevenueWithSegmentLogic(item, showNetRevenue);
        statusData.count++;
      }
    });

    const result = Array.from(statusMap.values());
    console.log(`[PERF] pipelineByStatus: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Calculate pipeline data grouped by service line
   * OPTIMIZED: Single pass with Map instead of groupBy + map + reduce
   * FIX: Distribute revenue across ALL service lines (1, 2, 3) with their allocations
   */
  const pipelineByServiceLine = useMemo(() => {
    const startTime = performance.now();

    const serviceLineMap = new Map();

    // Single pass through data
    filteredOpportunities.forEach((item) => {
      // If filtered data with allocation, use allocated values
      if (item["Allocated Service Line"] && item["Is Allocated"]) {
        const serviceLine = item["Allocated Service Line"];

        if (!serviceLineMap.has(serviceLine)) {
          serviceLineMap.set(serviceLine, {
            name: serviceLine,
            originalValue: 0,
            calculatedValue: 0,
            count: 0,
          });
        }

        const data = serviceLineMap.get(serviceLine);
        data.originalValue += getRevenueValue(item, showNetRevenue);
        data.calculatedValue += calculateRevenueWithSegmentLogic(item, showNetRevenue);
        data.count++;
      } else {
        // Distribute across all service lines with their percentages
        const baseRevenue = showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(item, showNetRevenue);

        // Split combined service line names (e.g., "Finance & Regulatory, Technology" -> ["Finance & Regulatory", "Technology"])
        const rawServiceLines = [
          { line: item["Service Line 1"], percentage: item["Service Offering 1 %"] || 0 },
          { line: item["Service Line 2"], percentage: item["Service Offering 2 %"] || 0 },
          { line: item["Service Line 3"], percentage: item["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            // Split the percentage equally among all parts
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        // Calculate total percentage to determine if we need to normalize
        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        if (serviceLines.length === 0) {
          // No service lines, categorize as Uncategorized
          if (!serviceLineMap.has("Uncategorized")) {
            serviceLineMap.set("Uncategorized", {
              name: "Uncategorized",
              originalValue: 0,
              calculatedValue: 0,
              count: 0,
            });
          }
          const data = serviceLineMap.get("Uncategorized");
          data.originalValue += baseRevenue;
          data.calculatedValue += calculatedRevenue;
          data.count++;
        } else if (totalPercentage === 0) {
          // Service lines exist but no percentages, distribute equally
          const equalShare = 1 / serviceLines.length;
          serviceLines.forEach((sl) => {
            if (!serviceLineMap.has(sl.line)) {
              serviceLineMap.set(sl.line, {
                name: sl.line,
                originalValue: 0,
                calculatedValue: 0,
                count: 0,
              });
            }
            const data = serviceLineMap.get(sl.line);
            data.originalValue += baseRevenue * equalShare;
            data.calculatedValue += calculatedRevenue * equalShare;
            data.count += equalShare;
          });
        } else {
          // Distribute according to percentages
          serviceLines.forEach((sl) => {
            if (!serviceLineMap.has(sl.line)) {
              serviceLineMap.set(sl.line, {
                name: sl.line,
                originalValue: 0,
                calculatedValue: 0,
                count: 0,
              });
            }
            const allocation = parseFloat(sl.percentage) / 100;
            const data = serviceLineMap.get(sl.line);
            data.originalValue += baseRevenue * allocation;
            data.calculatedValue += calculatedRevenue * allocation;
            data.count += allocation;
          });
        }
      }
    });

    // Convert to array
    let result = Array.from(serviceLineMap.values());

    // FIX: Consolidate entries with duplicate or combined service line names
    // e.g., merge "People & Strategy" and "People & Strategy, People & Strategy" into one
    const consolidated = new Map();
    result.forEach((item) => {
      // Extract base service line name (first part before comma, or whole name if no comma)
      let baseName = item.name;

      // Check if this is a combined name with duplicates (e.g., "X, X" or "X, X, Y")
      const parts = item.name.split(", ").map((p) => p.trim());
      const uniqueParts = [...new Set(parts)];

      // If all parts are the same (e.g., "People & Strategy, People & Strategy"),
      // use just the single name
      if (uniqueParts.length === 1) {
        baseName = uniqueParts[0];
      }

      // Consolidate under the base name
      if (consolidated.has(baseName)) {
        const existing = consolidated.get(baseName);
        existing.originalValue += item.originalValue;
        existing.calculatedValue += item.calculatedValue;
        existing.count += item.count;
      } else {
        consolidated.set(baseName, {
          ...item,
          name: baseName, // Use the cleaned up name
        });
      }
    });
    result = Array.from(consolidated.values());

    // Sort by originalValue
    result.sort((a, b) => b.originalValue - a.originalValue);

    console.log(`[PERF] pipelineByServiceLine: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Prepare stacked service line data for chart
   * OPTIMIZED: Added profiling to track performance
   * FIX: Distribute revenue across ALL service lines (1, 2, 3) with their allocations
   * FIX: Track allocated vs non-allocated portions for color distinction
   */
  const stackedServiceLineData = useMemo(() => {
    const startTime = performance.now();

    const serviceLineGroups = new Map();

    filteredOpportunities.forEach((opp) => {
      // If filtered data with allocation, calculate allocated and non-allocated portions
      if (opp["Allocated Service Line"] && opp["Is Allocated"]) {
        // Split allocated service line if it contains multiple names (e.g., "Finance & Regulatory, Technology")
        const allocatedServiceLines = opp["Allocated Service Line"]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== "" && name !== "-");

        const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        // Split combined service line names from the opportunity
        const rawServiceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            // Split the percentage equally among all parts
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        // Process each allocated service line separately
        allocatedServiceLines.forEach((allocatedServiceLine) => {
          if (!serviceLineGroups.has(allocatedServiceLine)) {
            serviceLineGroups.set(allocatedServiceLine, {
              name: allocatedServiceLine,
              early: 0,
              earlyAllocated: 0,
              earlyNonAllocated: 0,
              earlyCount: 0,
              mid: 0,
              midAllocated: 0,
              midNonAllocated: 0,
              midCount: 0,
              late: 0,
              lateAllocated: 0,
              lateNonAllocated: 0,
              lateCount: 0,
              total: 0,
              calculatedEarly: 0,
              calculatedMid: 0,
              calculatedLate: 0,
              calculatedTotal: 0,
              count: 0,
            });
          }

          const group = serviceLineGroups.get(allocatedServiceLine);

          // Divide revenue equally among all allocated service lines
          const sharePerAllocated = 1 / allocatedServiceLines.length;
          const sharedBaseRevenue = baseRevenue * sharePerAllocated;
          const sharedCalculatedRevenue = calculatedRevenue * sharePerAllocated;

          let allocatedPortion = 0;
          let nonAllocatedPortion = 0;

          if (serviceLines.length === 0) {
            // No service lines, all goes to allocated
            allocatedPortion = sharedBaseRevenue;
          } else if (totalPercentage === 0) {
            // Equal distribution
            const equalShare = 1 / serviceLines.length;
            const matchingLines = serviceLines.filter((sl) => sl.line === allocatedServiceLine);
            allocatedPortion = sharedBaseRevenue * equalShare * matchingLines.length;
            nonAllocatedPortion = sharedBaseRevenue * equalShare * (serviceLines.length - matchingLines.length);
          } else {
            // Distribute according to percentages
            serviceLines.forEach((sl) => {
              const allocation = parseFloat(sl.percentage) / 100;
              if (sl.line === allocatedServiceLine) {
                allocatedPortion += sharedBaseRevenue * allocation;
              } else {
                nonAllocatedPortion += sharedBaseRevenue * allocation;
              }
            });
          }

          // Use STATUS_CATEGORIES to correctly categorize opportunities
          const status = opp.Status;
          if (STATUS_CATEGORIES.early.includes(status)) {
            group.early += sharedBaseRevenue;
            group.earlyAllocated += allocatedPortion;
            group.earlyNonAllocated += nonAllocatedPortion;
            group.calculatedEarly += sharedCalculatedRevenue;
            group.earlyCount++;
          } else if (STATUS_CATEGORIES.mid.includes(status)) {
            group.mid += sharedBaseRevenue;
            group.midAllocated += allocatedPortion;
            group.midNonAllocated += nonAllocatedPortion;
            group.calculatedMid += sharedCalculatedRevenue;
            group.midCount++;
          } else if (STATUS_CATEGORIES.late.includes(status)) {
            group.late += sharedBaseRevenue;
            group.lateAllocated += allocatedPortion;
            group.lateNonAllocated += nonAllocatedPortion;
            group.calculatedLate += sharedCalculatedRevenue;
            group.lateCount++;
          }

          group.total += sharedBaseRevenue;
          group.calculatedTotal += sharedCalculatedRevenue;
          group.count++;
        });
      } else {
        // Distribute across all service lines with their percentages
        // When no filter is active, show full values (allocated = total, non-allocated = 0)
        const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        // Split combined service line names (e.g., "Finance & Regulatory, Technology" -> ["Finance & Regulatory", "Technology"])
        const rawServiceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            // Split the percentage equally among all parts
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        // Calculate total percentage
        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        if (serviceLines.length === 0) {
          // No service lines, categorize as Uncategorized
          const serviceLine = "Uncategorized";
          if (!serviceLineGroups.has(serviceLine)) {
            serviceLineGroups.set(serviceLine, {
              name: serviceLine,
              early: 0,
              earlyAllocated: 0,
              earlyNonAllocated: 0,
              earlyCount: 0,
              mid: 0,
              midAllocated: 0,
              midNonAllocated: 0,
              midCount: 0,
              late: 0,
              lateAllocated: 0,
              lateNonAllocated: 0,
              lateCount: 0,
              total: 0,
              calculatedEarly: 0,
              calculatedMid: 0,
              calculatedLate: 0,
              calculatedTotal: 0,
              count: 0,
            });
          }

          const group = serviceLineGroups.get(serviceLine);
          const status = opp.Status;
          if (STATUS_CATEGORIES.early.includes(status)) {
            group.early += baseRevenue;
            group.earlyAllocated += baseRevenue;
            group.calculatedEarly += calculatedRevenue;
            group.earlyCount++;
          } else if (STATUS_CATEGORIES.mid.includes(status)) {
            group.mid += baseRevenue;
            group.midAllocated += baseRevenue;
            group.calculatedMid += calculatedRevenue;
            group.midCount++;
          } else if (STATUS_CATEGORIES.late.includes(status)) {
            group.late += baseRevenue;
            group.lateAllocated += baseRevenue;
            group.calculatedLate += calculatedRevenue;
            group.lateCount++;
          }
          group.total += baseRevenue;
          group.calculatedTotal += calculatedRevenue;
          group.count++;
        } else if (totalPercentage === 0) {
          // Service lines exist but no percentages, distribute equally
          const equalShare = 1 / serviceLines.length;
          serviceLines.forEach((sl) => {
            if (!serviceLineGroups.has(sl.line)) {
              serviceLineGroups.set(sl.line, {
                name: sl.line,
                early: 0,
                earlyAllocated: 0,
                earlyNonAllocated: 0,
                earlyCount: 0,
                mid: 0,
                midAllocated: 0,
                midNonAllocated: 0,
                midCount: 0,
                late: 0,
                lateAllocated: 0,
                lateNonAllocated: 0,
                lateCount: 0,
                total: 0,
                calculatedEarly: 0,
                calculatedMid: 0,
                calculatedLate: 0,
                calculatedTotal: 0,
                count: 0,
              });
            }

            const group = serviceLineGroups.get(sl.line);
            const allocatedRevenue = baseRevenue * equalShare;
            const status = opp.Status;
            if (STATUS_CATEGORIES.early.includes(status)) {
              group.early += allocatedRevenue;
              group.earlyAllocated += allocatedRevenue;
              group.calculatedEarly += calculatedRevenue * equalShare;
              group.earlyCount++;
            } else if (STATUS_CATEGORIES.mid.includes(status)) {
              group.mid += allocatedRevenue;
              group.midAllocated += allocatedRevenue;
              group.calculatedMid += calculatedRevenue * equalShare;
              group.midCount++;
            } else if (STATUS_CATEGORIES.late.includes(status)) {
              group.late += allocatedRevenue;
              group.lateAllocated += allocatedRevenue;
              group.calculatedLate += calculatedRevenue * equalShare;
              group.lateCount++;
            }
            group.total += allocatedRevenue;
            group.calculatedTotal += calculatedRevenue * equalShare;
            group.count++;
          });
        } else {
          // Distribute according to percentages
          serviceLines.forEach((sl) => {
            if (!serviceLineGroups.has(sl.line)) {
              serviceLineGroups.set(sl.line, {
                name: sl.line,
                early: 0,
                earlyAllocated: 0,
                earlyNonAllocated: 0,
                earlyCount: 0,
                mid: 0,
                midAllocated: 0,
                midNonAllocated: 0,
                midCount: 0,
                late: 0,
                lateAllocated: 0,
                lateNonAllocated: 0,
                lateCount: 0,
                total: 0,
                calculatedEarly: 0,
                calculatedMid: 0,
                calculatedLate: 0,
                calculatedTotal: 0,
                count: 0,
              });
            }

            const allocation = parseFloat(sl.percentage) / 100;
            const allocatedRevenue = baseRevenue * allocation;
            const group = serviceLineGroups.get(sl.line);
            const status = opp.Status;
            if (STATUS_CATEGORIES.early.includes(status)) {
              group.early += allocatedRevenue;
              group.earlyAllocated += allocatedRevenue;
              group.calculatedEarly += calculatedRevenue * allocation;
              group.earlyCount++;
            } else if (STATUS_CATEGORIES.mid.includes(status)) {
              group.mid += allocatedRevenue;
              group.midAllocated += allocatedRevenue;
              group.calculatedMid += calculatedRevenue * allocation;
              group.midCount++;
            } else if (STATUS_CATEGORIES.late.includes(status)) {
              group.late += allocatedRevenue;
              group.lateAllocated += allocatedRevenue;
              group.calculatedLate += calculatedRevenue * allocation;
              group.lateCount++;
            }
            group.total += allocatedRevenue;
            group.calculatedTotal += calculatedRevenue * allocation;
            group.count++;
          });
        }
      }
    });

    // Convert to array and sort by total
    const result = Array.from(serviceLineGroups.values());
    result.sort((a, b) => b.total - a.total);

    console.log(`[PERF] stackedServiceLineData: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Prepare stacked account data for chart
   * Groups by account and status category
   * FIX: Track allocated vs non-allocated portions for color distinction
   * Memoized for optimal performance
   */
  const pipelineByAccount = useMemo(() => {
    // Group by account first
    const accountGroups = {};

    filteredOpportunities.forEach((opp) => {
      const account = opp["Account"] || "Uncategorized";
      if (!accountGroups[account]) {
        accountGroups[account] = {
          name: account,
          early: 0,
          earlyAllocated: 0,
          earlyNonAllocated: 0,
          mid: 0,
          midAllocated: 0,
          midNonAllocated: 0,
          late: 0,
          lateAllocated: 0,
          lateNonAllocated: 0,
          total: 0,
          calculatedEarly: 0,
          calculatedMid: 0,
          calculatedLate: 0,
          calculatedTotal: 0,
          count: 0,
        };
      }

      // Calculate the revenue using the original and calculated methods
      const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

      // If filtered with allocation, calculate allocated and non-allocated portions
      let allocatedPortion = baseRevenue;
      let nonAllocatedPortion = 0;

      if (opp["Allocated Service Line"] && opp["Is Allocated"]) {
        // Split allocated service line names
        const allocatedServiceLines = opp["Allocated Service Line"]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== "" && name !== "-");

        // Split combined service line names from the opportunity
        const rawServiceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        // Calculate portions
        allocatedPortion = 0;
        nonAllocatedPortion = 0;

        if (serviceLines.length === 0) {
          allocatedPortion = baseRevenue;
        } else if (totalPercentage === 0) {
          const equalShare = 1 / serviceLines.length;
          const matchingLines = serviceLines.filter((sl) => allocatedServiceLines.includes(sl.line));
          allocatedPortion = baseRevenue * equalShare * matchingLines.length;
          nonAllocatedPortion = baseRevenue * equalShare * (serviceLines.length - matchingLines.length);
        } else {
          serviceLines.forEach((sl) => {
            const allocation = parseFloat(sl.percentage) / 100;
            if (allocatedServiceLines.includes(sl.line)) {
              allocatedPortion += baseRevenue * allocation;
            } else {
              nonAllocatedPortion += baseRevenue * allocation;
            }
          });
        }
      }

      // Add to the right status category
      if (STATUS_CATEGORIES.early.includes(opp.Status)) {
        accountGroups[account].early += baseRevenue;
        accountGroups[account].earlyAllocated += allocatedPortion;
        accountGroups[account].earlyNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedEarly += calculatedRevenue;
      } else if (STATUS_CATEGORIES.mid.includes(opp.Status)) {
        accountGroups[account].mid += baseRevenue;
        accountGroups[account].midAllocated += allocatedPortion;
        accountGroups[account].midNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedMid += calculatedRevenue;
      } else if (STATUS_CATEGORIES.late.includes(opp.Status)) {
        accountGroups[account].late += baseRevenue;
        accountGroups[account].lateAllocated += allocatedPortion;
        accountGroups[account].lateNonAllocated += nonAllocatedPortion;
        accountGroups[account].calculatedLate += calculatedRevenue;
      }

      // Add to total
      accountGroups[account].total += baseRevenue;
      accountGroups[account].calculatedTotal += calculatedRevenue;
      accountGroups[account].count += 1;
    });

    // Convert to array, sort by total, and limit to top 9
    return Object.values(accountGroups)
      .sort((a, b) => b.total - a.total)
      .slice(0, 9);
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Calculate pipeline data grouped by offerings for a specific service line
   * Used for drill-down functionality
   * FIX: Track allocated vs non-allocated portions for color distinction
   * Allocated = portion of the service line, Non-allocated = portion of OTHER service lines
   */
  const getOfferingsByServiceLine = useCallback(
    (serviceLine) => {
      if (!serviceLine) return [];

      const startTime = performance.now();
      const offeringGroups = new Map();

      filteredOpportunities.forEach((opp) => {
        // Find offerings that belong to the selected service line
        const offeringData = [];

        if (opp["Service Line 1"] === serviceLine && opp["Service Offering 1"]) {
          offeringData.push({
            offering: opp["Service Offering 1"],
            percentage: opp["Service Offering 1 %"] || 0,
          });
        }
        if (opp["Service Line 2"] === serviceLine && opp["Service Offering 2"]) {
          offeringData.push({
            offering: opp["Service Offering 2"],
            percentage: opp["Service Offering 2 %"] || 0,
          });
        }
        if (opp["Service Line 3"] === serviceLine && opp["Service Offering 3"]) {
          offeringData.push({
            offering: opp["Service Offering 3"],
            percentage: opp["Service Offering 3 %"] || 0,
          });
        }

        // Skip if no offerings found for this service line
        if (offeringData.length === 0) return;

        const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        // Calculate total percentage for THIS service line (all offerings combined)
        const totalServiceLinePercentage = offeringData.reduce(
          (sum, { percentage }) => sum + parseFloat(percentage),
          0
        );
        // Calculate total percentage for OTHER service lines
        const otherServiceLinesPercentage = 100 - totalServiceLinePercentage;

        // Divide by number of offerings to avoid counting the same opportunity multiple times
        const numOfferings = offeringData.length;
        const sharePerOffering = 1 / numOfferings;
        const sharedBaseRevenue = baseRevenue * sharePerOffering;
        const sharedCalculatedRevenue = calculatedRevenue * sharePerOffering;

        offeringData.forEach(({ offering, percentage }) => {
          if (!offeringGroups.has(offering)) {
            offeringGroups.set(offering, {
              name: offering,
              early: 0,
              earlyAllocated: 0,
              earlyNonAllocated: 0,
              earlyCount: 0,
              mid: 0,
              midAllocated: 0,
              midNonAllocated: 0,
              midCount: 0,
              late: 0,
              lateAllocated: 0,
              lateNonAllocated: 0,
              lateCount: 0,
              total: 0,
              calculatedEarly: 0,
              calculatedMid: 0,
              calculatedLate: 0,
              calculatedTotal: 0,
              count: 0,
              isOffering: true, // Flag to identify this as an offering
            });
          }

          const group = offeringGroups.get(offering);

          // Calculate allocated and non-allocated portions
          // Allocated = portion from THIS service line (Technology 60%)
          // Non-allocated = portion from OTHER service lines (Finance 40%)
          const allocatedRevenue = sharedBaseRevenue * (totalServiceLinePercentage / 100);
          const nonAllocatedRevenue = sharedBaseRevenue * (otherServiceLinesPercentage / 100);
          const allocatedCalculated = sharedCalculatedRevenue * (totalServiceLinePercentage / 100);

          const status = opp.Status;
          if (STATUS_CATEGORIES.early.includes(status)) {
            group.early += sharedBaseRevenue; // Share of opportunity revenue
            group.earlyAllocated += allocatedRevenue; // Service line portion
            group.earlyNonAllocated += nonAllocatedRevenue; // Other service lines portion
            group.calculatedEarly += allocatedCalculated;
            group.earlyCount++;
          } else if (STATUS_CATEGORIES.mid.includes(status)) {
            group.mid += sharedBaseRevenue;
            group.midAllocated += allocatedRevenue;
            group.midNonAllocated += nonAllocatedRevenue;
            group.calculatedMid += allocatedCalculated;
            group.midCount++;
          } else if (STATUS_CATEGORIES.late.includes(status)) {
            group.late += sharedBaseRevenue;
            group.lateAllocated += allocatedRevenue;
            group.lateNonAllocated += nonAllocatedRevenue;
            group.calculatedLate += allocatedCalculated;
            group.lateCount++;
          }

          group.total += sharedBaseRevenue;
          group.calculatedTotal += allocatedCalculated;
          group.count++;
        });
      });

      const result = Array.from(offeringGroups.values());
      result.sort((a, b) => b.total - a.total);

      console.log(`[PERF] getOfferingsByServiceLine: ${(performance.now() - startTime).toFixed(2)}ms`);
      return result;
    },
    [filteredOpportunities, showNetRevenue]
  );

  /**
   * Calculate pipeline data grouped by segment (Sub Segment Code)
   * Similar to service line grouping with stacked bar visualization
   * FIX: Track allocated vs non-allocated portions for color distinction
   */
  const stackedSegmentData = useMemo(() => {
    const startTime = performance.now();
    const segmentGroups = new Map();

    filteredOpportunities.forEach((opp) => {
      const segment = opp["Sub Segment Code"] || "Uncategorized";

      if (!segmentGroups.has(segment)) {
        segmentGroups.set(segment, {
          name: segment,
          early: 0,
          earlyAllocated: 0,
          earlyNonAllocated: 0,
          earlyCount: 0,
          mid: 0,
          midAllocated: 0,
          midNonAllocated: 0,
          midCount: 0,
          late: 0,
          lateAllocated: 0,
          lateNonAllocated: 0,
          lateCount: 0,
          total: 0,
          calculatedEarly: 0,
          calculatedMid: 0,
          calculatedLate: 0,
          calculatedTotal: 0,
          count: 0,
        });
      }

      const group = segmentGroups.get(segment);
      const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
      const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

      // Calculate allocated and non-allocated portions based on service line allocation
      let allocatedPortion = baseRevenue;
      let nonAllocatedPortion = 0;

      if (opp["Allocated Service Line"] && opp["Is Allocated"]) {
        // Split allocated service line names
        const allocatedServiceLines = opp["Allocated Service Line"]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== "" && name !== "-");

        // Split combined service line names from the opportunity
        const rawServiceLines = [
          { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
          { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
          { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
        ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

        // Expand combined names into separate entries
        const serviceLines = [];
        rawServiceLines.forEach((sl) => {
          const parts = sl.line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (parts.length > 1) {
            const splitPercentage = parseFloat(sl.percentage) / parts.length;
            parts.forEach((part) => {
              serviceLines.push({ line: part, percentage: splitPercentage });
            });
          } else {
            serviceLines.push(sl);
          }
        });

        const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

        // Calculate portions
        allocatedPortion = 0;
        nonAllocatedPortion = 0;

        if (serviceLines.length === 0) {
          allocatedPortion = baseRevenue;
        } else if (totalPercentage === 0) {
          const equalShare = 1 / serviceLines.length;
          const matchingLines = serviceLines.filter((sl) => allocatedServiceLines.includes(sl.line));
          allocatedPortion = baseRevenue * equalShare * matchingLines.length;
          nonAllocatedPortion = baseRevenue * equalShare * (serviceLines.length - matchingLines.length);
        } else {
          serviceLines.forEach((sl) => {
            const allocation = parseFloat(sl.percentage) / 100;
            if (allocatedServiceLines.includes(sl.line)) {
              allocatedPortion += baseRevenue * allocation;
            } else {
              nonAllocatedPortion += baseRevenue * allocation;
            }
          });
        }
      }

      const status = opp.Status;
      if (STATUS_CATEGORIES.early.includes(status)) {
        group.early += baseRevenue;
        group.earlyAllocated += allocatedPortion;
        group.earlyNonAllocated += nonAllocatedPortion;
        group.calculatedEarly += calculatedRevenue;
        group.earlyCount++;
      } else if (STATUS_CATEGORIES.mid.includes(status)) {
        group.mid += baseRevenue;
        group.midAllocated += allocatedPortion;
        group.midNonAllocated += nonAllocatedPortion;
        group.calculatedMid += calculatedRevenue;
        group.midCount++;
      } else if (STATUS_CATEGORIES.late.includes(status)) {
        group.late += baseRevenue;
        group.lateAllocated += allocatedPortion;
        group.lateNonAllocated += nonAllocatedPortion;
        group.calculatedLate += calculatedRevenue;
        group.lateCount++;
      }
      group.total += baseRevenue;
      group.calculatedTotal += calculatedRevenue;
      group.count++;
    });

    const result = Array.from(segmentGroups.values());
    result.sort((a, b) => b.total - a.total);

    console.log(`[PERF] stackedSegmentData: ${(performance.now() - startTime).toFixed(2)}ms`);
    return result;
  }, [filteredOpportunities, showNetRevenue]);

  /**
   * Calculate sub-segments for a specific segment (for drill-down)
   * FIX: Track allocated vs non-allocated portions for color distinction
   * @param {string} segmentCode - The segment code to drill into
   */
  const getSubSegmentsBySegment = useCallback(
    (segmentCode) => {
      if (!segmentCode) return [];

      const startTime = performance.now();
      const subSegmentGroups = new Map();

      filteredOpportunities.forEach((opp) => {
        if (opp["Sub Segment Code"] !== segmentCode) return;

        const subSegment = opp["Sub Segment"] || "Uncategorized";

        if (!subSegmentGroups.has(subSegment)) {
          subSegmentGroups.set(subSegment, {
            name: subSegment,
            early: 0,
            earlyAllocated: 0,
            earlyNonAllocated: 0,
            earlyCount: 0,
            mid: 0,
            midAllocated: 0,
            midNonAllocated: 0,
            midCount: 0,
            late: 0,
            lateAllocated: 0,
            lateNonAllocated: 0,
            lateCount: 0,
            total: 0,
            calculatedEarly: 0,
            calculatedMid: 0,
            calculatedLate: 0,
            calculatedTotal: 0,
            count: 0,
            isSubSegment: true, // Flag to identify this as a sub-segment
          });
        }

        const group = subSegmentGroups.get(subSegment);
        const baseRevenue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;
        const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

        // Calculate allocated and non-allocated portions based on service line allocation
        let allocatedPortion = baseRevenue;
        let nonAllocatedPortion = 0;

        if (opp["Allocated Service Line"] && opp["Is Allocated"]) {
          // Split allocated service line names
          const allocatedServiceLines = opp["Allocated Service Line"]
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && name !== "-");

          // Split combined service line names from the opportunity
          const rawServiceLines = [
            { line: opp["Service Line 1"], percentage: opp["Service Offering 1 %"] || 0 },
            { line: opp["Service Line 2"], percentage: opp["Service Offering 2 %"] || 0 },
            { line: opp["Service Line 3"], percentage: opp["Service Offering 3 %"] || 0 },
          ].filter((sl) => sl.line && sl.line.trim() !== "" && sl.line.trim() !== "-");

          // Expand combined names into separate entries
          const serviceLines = [];
          rawServiceLines.forEach((sl) => {
            const parts = sl.line
              .split(",")
              .map((p) => p.trim())
              .filter((p) => p !== "");
            if (parts.length > 1) {
              const splitPercentage = parseFloat(sl.percentage) / parts.length;
              parts.forEach((part) => {
                serviceLines.push({ line: part, percentage: splitPercentage });
              });
            } else {
              serviceLines.push(sl);
            }
          });

          const totalPercentage = serviceLines.reduce((sum, sl) => sum + parseFloat(sl.percentage), 0);

          // Calculate portions
          allocatedPortion = 0;
          nonAllocatedPortion = 0;

          if (serviceLines.length === 0) {
            allocatedPortion = baseRevenue;
          } else if (totalPercentage === 0) {
            const equalShare = 1 / serviceLines.length;
            const matchingLines = serviceLines.filter((sl) => allocatedServiceLines.includes(sl.line));
            allocatedPortion = baseRevenue * equalShare * matchingLines.length;
            nonAllocatedPortion = baseRevenue * equalShare * (serviceLines.length - matchingLines.length);
          } else {
            serviceLines.forEach((sl) => {
              const allocation = parseFloat(sl.percentage) / 100;
              if (allocatedServiceLines.includes(sl.line)) {
                allocatedPortion += baseRevenue * allocation;
              } else {
                nonAllocatedPortion += baseRevenue * allocation;
              }
            });
          }
        }

        const status = opp.Status;
        if (STATUS_CATEGORIES.early.includes(status)) {
          group.early += baseRevenue;
          group.earlyAllocated += allocatedPortion;
          group.earlyNonAllocated += nonAllocatedPortion;
          group.calculatedEarly += calculatedRevenue;
          group.earlyCount++;
        } else if (STATUS_CATEGORIES.mid.includes(status)) {
          group.mid += baseRevenue;
          group.midAllocated += allocatedPortion;
          group.midNonAllocated += nonAllocatedPortion;
          group.calculatedMid += calculatedRevenue;
          group.midCount++;
        } else if (STATUS_CATEGORIES.late.includes(status)) {
          group.late += baseRevenue;
          group.lateAllocated += allocatedPortion;
          group.lateNonAllocated += nonAllocatedPortion;
          group.calculatedLate += calculatedRevenue;
          group.lateCount++;
        }
        group.total += baseRevenue;
        group.calculatedTotal += calculatedRevenue;
        group.count++;
      });

      const result = Array.from(subSegmentGroups.values());
      result.sort((a, b) => b.total - a.total);

      console.log(`[PERF] getSubSegmentsBySegment: ${(performance.now() - startTime).toFixed(2)}ms`);
      return result;
    },
    [filteredOpportunities, showNetRevenue]
  );

  return {
    pipelineByStatus,
    pipelineByServiceLine,
    stackedServiceLineData,
    pipelineByAccount,
    getOfferingsByServiceLine,
    stackedSegmentData,
    getSubSegmentsBySegment,
  };
};
