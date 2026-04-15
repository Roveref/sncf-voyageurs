import { useState } from "react";
import { UTILIZATION_FILTERS } from "../utils/filterUtils";
import type { CascadeFilter, SearchTag, StaffingFilters } from "../types";

/**
 * Holds all UI filter, granularity, heatmap mode, and display-toggle state for the StaffingTab.
 * Returns state values and their setters; no derived data is computed here.
 */
export function useStaffingFilters() {
  const [filters, setFilters] = useState<StaffingFilters>({
    search: "",
    utilization: UTILIZATION_FILTERS.ALL,
    project: "all",
    categories: [] as string[],
    minAvailability: 0,
    grades: "all",
    subTeams: "all",
    serviceLine: "all",
    sortBy: "utilization",
    sortOrder: "desc",
    autoSort: true,
    cascadeFilters: [] as CascadeFilter[],
    skillSearch: "",
    skillMinLevel: 0,
    hideTu100: false,
    hideTuAboveTarget: false,
    gradeTransitionOnly: false,
    mergeGradeRows: true,
    sapAnomalyOnly: false,
    showAllEmployees: false,
    sapFilter: "all",
    churnFilter: "",
    dispoMin: 0,
    dispoMax: 100,
    searchTags: [] as SearchTag[],
    searchScope: "",
    showBadges: false,
    showDetails: false,
  });
  const [granularity, setGranularity] = useState("halfmonth");
  const [heatmapMode, setHeatmapMode] = useState("utilization");
  const [chargeableCombined, setChargeableCombined] = useState(true);
  const [dataSourceDebug, setDataSourceDebug] = useState<"all" | "sap" | "mds">("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [hideTeamTU, setHideTeamTU] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return {
    filters,
    setFilters,
    granularity,
    setGranularity,
    heatmapMode,
    setHeatmapMode,
    chargeableCombined,
    setChargeableCombined,
    dataSourceDebug,
    setDataSourceDebug,
    managerFilter,
    setManagerFilter,
    hideTeamTU,
    setHideTeamTU,
    showAdvanced,
    setShowAdvanced,
  };
}
