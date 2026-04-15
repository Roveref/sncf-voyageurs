/**
 * PROFILED VERSION - Temporary performance testing
 */

const PERF_ENABLED = true;

class PerformanceProfiler {
  constructor(name) {
    this.name = name;
    this.timings = {};
    this.startTime = 0;
  }

  start() {
    if (!PERF_ENABLED) return;
    this.startTime = performance.now();
  }

  mark(label) {
    if (!PERF_ENABLED) return;
    const now = performance.now();
    this.timings[label] = now - this.startTime;
  }

  end() {
    if (!PERF_ENABLED) return;
    const total = performance.now() - this.startTime;

    console.group(`⚡ ${this.name} - Total: ${total.toFixed(2)}ms`);

    // Sort by time descending
    const sorted = Object.entries(this.timings).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([label, time]) => {
      const percentage = ((time / total) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(percentage / 5));
      console.log(`  ${label.padEnd(30)} ${time.toFixed(2)}ms ${bar} ${percentage}%`);
    });

    console.groupEnd();
  }
}

export function applyAllFilters(data, filters, filterMode, serviceToOfferingMap) {
  const profiler = new PerformanceProfiler("applyAllFilters");
  profiler.start();

  if (!data || data.length === 0) return [];

  let result = [...data];
  const safeFilters = filters || {};

  profiler.mark("Init & Copy");

  // Apply account filter
  if (safeFilters.accounts?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.accounts.includes(item["Account"]));
    } else {
      result = result.filter((item) => !safeFilters.accounts.includes(item["Account"]));
    }
    profiler.mark("Account Filter");
  }

  // Apply segment code filter
  if (safeFilters.subSegmentCodes?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.subSegmentCodes.includes(item["Sub Segment Code"]));
    } else {
      result = result.filter((item) => !safeFilters.subSegmentCodes.includes(item["Sub Segment Code"]));
    }
    profiler.mark("Segment Code Filter");
  }

  // Apply sub segments filter
  if (safeFilters.subSegments?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.subSegments.includes(item["Sub Segment"]));
    } else {
      result = result.filter((item) => !safeFilters.subSegments.includes(item["Sub Segment"]));
    }
    profiler.mark("Sub Segments Filter");
  }

  // Apply status filter
  if (safeFilters.status?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.status.includes(item["Status"]));
    } else {
      result = result.filter((item) => !safeFilters.status.includes(item["Status"]));
    }
    profiler.mark("Status Filter");
  }

  // Apply manager filter
  if (safeFilters.manager?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.manager.includes(item["Manager"]));
    } else {
      result = result.filter((item) => !safeFilters.manager.includes(item["Manager"]));
    }
    profiler.mark("Manager Filter");
  }

  // Apply partner filter
  if (safeFilters.partner?.length > 0) {
    if (filterMode === "inclusive") {
      result = result.filter((item) => safeFilters.partner.includes(item["Partner"]));
    } else {
      result = result.filter((item) => !safeFilters.partner.includes(item["Partner"]));
    }
    profiler.mark("Partner Filter");
  }

  // Apply technology partners filter
  if (safeFilters.technologyPartners?.length > 0) {
    const startTechPartner = performance.now();
    if (filterMode === "inclusive") {
      result = result.filter((item) => {
        const techPartner1 = item["Technology Partner 1"];
        const techPartner2 = item["Technology Partner 2"];
        const techPartner3 = item["Technology Partner 3"];

        return safeFilters.technologyPartners.some((selectedPartner) => {
          return (
            (techPartner1 && techPartner1.includes(selectedPartner)) ||
            (techPartner2 && techPartner2.includes(selectedPartner)) ||
            (techPartner3 && techPartner3.includes(selectedPartner))
          );
        });
      });
    } else {
      result = result.filter((item) => {
        const techPartner1 = item["Technology Partner 1"];
        const techPartner2 = item["Technology Partner 2"];
        const techPartner3 = item["Technology Partner 3"];

        return !safeFilters.technologyPartners.some((selectedPartner) => {
          return (
            (techPartner1 && techPartner1.includes(selectedPartner)) ||
            (techPartner2 && techPartner2.includes(selectedPartner)) ||
            (techPartner3 && techPartner3.includes(selectedPartner))
          );
        });
      });
    }
    profiler.mark("Tech Partners Filter");
  }

  // Service line filtering and allocation
  if (safeFilters.serviceLine1?.length > 0) {
    const slStart = performance.now();

    // Pre-calculate if all service lines are selected
    const allServiceLines = new Set();
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      if (item["Service Line 1"]) allServiceLines.add(item["Service Line 1"]);
      if (item["Service Line 2"]) allServiceLines.add(item["Service Line 2"]);
      if (item["Service Line 3"]) allServiceLines.add(item["Service Line 3"]);
    }
    profiler.mark("SL: Collect all lines");

    const isAllServiceLinesSelected =
      safeFilters.serviceLine1.length > 0 &&
      allServiceLines.size > 0 &&
      [...allServiceLines].every((line) => safeFilters.serviceLine1.includes(line));

    profiler.mark("SL: Check if all selected");

    // Filter matching opportunities
    result = result.filter(
      (item) =>
        (item["Service Line 1"] && safeFilters.serviceLine1.includes(item["Service Line 1"])) ||
        (item["Service Line 2"] && safeFilters.serviceLine1.includes(item["Service Line 2"])) ||
        (item["Service Line 3"] && safeFilters.serviceLine1.includes(item["Service Line 3"]))
    );
    profiler.mark("SL: Filter items");

    // Add allocation properties
    if (isAllServiceLinesSelected) {
      for (let i = 0; i < result.length; i++) {
        result[i]["Allocated Gross Revenue"] = result[i]["Gross Revenue"];
        result[i]["Allocated Net Revenue"] = result[i]["Net Revenue"] || 0;
        result[i]["Is Allocated"] = false;
        result[i]["Allocation Percentage"] = 100;
        result[i]["Allocated Service Line"] = "All Service Lines";
      }
      profiler.mark("SL: Fast allocation (all selected)");
    } else {
      for (let i = 0; i < result.length; i++) {
        const item = result[i];
        let allocation = 0;
        let allocatedServiceLine = "";
        let totalAllocation = 0;

        const hasMatchingSL1 = item["Service Line 1"] && safeFilters.serviceLine1.includes(item["Service Line 1"]);
        const hasMatchingSL2 = item["Service Line 2"] && safeFilters.serviceLine1.includes(item["Service Line 2"]);
        const hasMatchingSL3 = item["Service Line 3"] && safeFilters.serviceLine1.includes(item["Service Line 3"]);

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

        item["Allocated Gross Revenue"] = item["Gross Revenue"] * allocation;
        item["Allocated Net Revenue"] = (item["Net Revenue"] || 0) * allocation;
        item["Is Allocated"] = allocation !== 1;
        item["Allocation Percentage"] = allocation * 100;
        item["Allocated Service Line"] = allocatedServiceLine;
      }
      profiler.mark("SL: Calculate allocation");
    }
  } else {
    // FIX: Reset allocation properties when no service line filter is active
    // This ensures that revenue calculations use original values instead of stale allocated values
    for (let i = 0; i < result.length; i++) {
      delete result[i]["Allocated Gross Revenue"];
      delete result[i]["Allocated Net Revenue"];
      delete result[i]["Is Allocated"];
      delete result[i]["Allocation Percentage"];
      delete result[i]["Allocated Service Line"];
    }
    profiler.mark("SL: Reset allocation");
  }

  // Apply service offering filter with allocation logic
  if (safeFilters.serviceOfferings?.length > 0) {
    // Step 1: Filter opportunities that have any of the selected service offerings
    result = result.filter(
      (item) =>
        safeFilters.serviceOfferings.includes(item["Service Offering 1"]) ||
        safeFilters.serviceOfferings.includes(item["Service Offering 2"]) ||
        safeFilters.serviceOfferings.includes(item["Service Offering 3"])
    );
    profiler.mark("SO: Filter items");

    // Step 2: Calculate allocation based on the percentage of the selected service offerings
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      let allocation = 0;
      let allocatedOfferings = [];

      // Check each service offering position
      if (safeFilters.serviceOfferings.includes(item["Service Offering 1"]) && item["Service Offering 1 %"]) {
        const alloc = parseFloat(item["Service Offering 1 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 1"]);
      }
      if (safeFilters.serviceOfferings.includes(item["Service Offering 2"]) && item["Service Offering 2 %"]) {
        const alloc = parseFloat(item["Service Offering 2 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 2"]);
      }
      if (safeFilters.serviceOfferings.includes(item["Service Offering 3"]) && item["Service Offering 3 %"]) {
        const alloc = parseFloat(item["Service Offering 3 %"]) / 100;
        allocation += alloc;
        allocatedOfferings.push(item["Service Offering 3"]);
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
    }
    profiler.mark("SO: Calculate allocation");
  }

  profiler.end();

  return result;
}

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

export function getUniqueValuesMultipleFields(data, fieldNames) {
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
