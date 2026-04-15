import React, { useCallback, useMemo } from "react";
import { CATEGORY_LABELS, CATEGORY_TREE } from "../constants";
import { UTILIZATION_FILTERS, getFilterSummary, getUniqueGrades, getUniqueSubTeams } from "../utils/filterUtils";
import { PYRAMID_TIERS, BUCKET_TO_FILTER } from "../components/Dashboard";
import type { Employee, StaffingFilters, CascadeFilter } from "../types";

/** Default / reset value for each filter key — used by removeActiveFilter & clearAllFilters. */
const FILTER_DEFAULTS: Partial<StaffingFilters> = {
  search: "",
  utilization: UTILIZATION_FILTERS.ALL,
  project: "all",
  grades: "all",
  subTeams: "all",
  categories: [],
  minAvailability: 0,
  cascadeFilters: [],
  skillSearch: "",
  skillMinLevel: 0,
  hideTu100: false,
  hideTuAboveTarget: false,
  gradeTransitionOnly: false,
  mergeGradeRows: false,
  churnFilter: "",
  searchScope: "",
  searchTags: [],
  sapFilter: "all",
  dispoMin: 0,
  dispoMax: 100,
};

interface UseStaffingFilterHandlersParams {
  setFilters: React.Dispatch<React.SetStateAction<StaffingFilters>>;
  setManagerFilter: (val: string) => void;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  setGroupingLevels: React.Dispatch<React.SetStateAction<string[]>>;
  groupingLevels: string[];
  filters: StaffingFilters;
  managerFilter: string;
  enrichedGanttData: Employee[];
  filteredEmployees: Employee[];
  uniqueProjects: string[];
}

export function useStaffingFilterHandlers({
  setFilters,
  setManagerFilter,
  setCollapsedGroups,
  setGroupingLevels,
  groupingLevels,
  filters,
  managerFilter,
  enrichedGanttData,
  filteredEmployees,
  uniqueProjects,
}: UseStaffingFilterHandlersParams) {
  // ── Computed lists for cascade options ────────────────────────────────────
  const availableGrades = useMemo(() => getUniqueGrades(enrichedGanttData), [enrichedGanttData]);
  const availableSubTeams = useMemo(() => getUniqueSubTeams(enrichedGanttData), [enrichedGanttData]);
  const availableDMs = useMemo(() => {
    const dms = new Set<string>();
    enrichedGanttData.forEach((e) => {
      if (e.directManager) dms.add(e.directManager);
    });
    return Array.from(dms).sort();
  }, [enrichedGanttData]);

  // ── Timeline header filter helpers ───────────────────────────────────────
  const updateFilter = useCallback(
    (patch: Partial<StaffingFilters>) => setFilters((prev) => ({ ...prev, ...patch })),
    []
  );

  // ── Click-to-filter from distribution bar and grade pyramid ──────────────
  const handleUtilizationBucketClick = useCallback((bucketKey: string) => {
    setFilters((prev) => {
      const filterValue = BUCKET_TO_FILTER[bucketKey as keyof typeof BUCKET_TO_FILTER];
      return { ...prev, utilization: prev.utilization === filterValue ? UTILIZATION_FILTERS.ALL : filterValue };
    });
  }, []);

  const handleGradeTierClick = useCallback((tierDisplay: string) => {
    setFilters((prev) => {
      const tier = PYRAMID_TIERS.find((t) => t.display === tierDisplay);
      const tierGrades = tier ? tier.grades : [tierDisplay];
      const currentGrades = prev.grades;
      const isAlreadyActive =
        Array.isArray(currentGrades) &&
        currentGrades.length === tierGrades.length &&
        tierGrades.every((g) => currentGrades.includes(g));
      return { ...prev, grades: isAlreadyActive ? "all" : tierGrades } as StaffingFilters;
    });
  }, []);

  const activeUtilizationBucket = useMemo(() => {
    if (filters.utilization === UTILIZATION_FILTERS.ALL) return null;
    return Object.entries(BUCKET_TO_FILTER).find(([, v]) => v === filters.utilization)?.[0] || null;
  }, [filters.utilization]);

  const activeGradeTier = useMemo(() => {
    if (!Array.isArray(filters.grades)) return null;
    const tier = PYRAMID_TIERS.find(
      (t) => t.grades.length === filters.grades.length && t.grades.every((g) => filters.grades.includes(g))
    );
    return tier ? tier.display : null;
  }, [filters.grades]);

  const cascadeCategoryOpts = useMemo(
    () =>
      CATEGORY_TREE.flatMap((g) => g.subs.map((s) => ({ value: s, label: `${g.label} > ${CATEGORY_LABELS[s] || s}` }))),
    []
  );

  const cascadeOptions = useMemo(
    () => ({
      grade: availableGrades.map((g) => ({ value: g, label: g })),
      subTeam: availableSubTeams.map((s) => ({ value: s, label: s })),
      dm: availableDMs.map((d) => ({ value: d, label: d })),
      project: uniqueProjects.map((p) => ({ value: p, label: p })),
      category: cascadeCategoryOpts,
    }),
    [availableGrades, availableSubTeams, availableDMs, uniqueProjects, cascadeCategoryOpts]
  );

  const handleCascadeChange = useCallback(
    (idx: number, newFilter: CascadeFilter) => {
      const next = [...(filters.cascadeFilters || [])];
      next[idx] = newFilter;
      updateFilter({ cascadeFilters: next });
    },
    [filters.cascadeFilters, updateFilter]
  );

  const handleCascadeRemove = useCallback(
    (idx: number) => {
      updateFilter({ cascadeFilters: (filters.cascadeFilters || []).filter((_, i) => i !== idx) });
    },
    [filters.cascadeFilters, updateFilter]
  );

  const addCascadeFilter = useCallback(() => {
    if ((filters.cascadeFilters || []).length >= 3) return;
    updateFilter({ cascadeFilters: [...(filters.cascadeFilters || []), { criterion: "", value: "" }] });
  }, [filters.cascadeFilters, updateFilter]);

  // ── Grouping handlers ────────────────────────────────────────────────────
  const handleGroupingChange = useCallback((levels: string[]) => {
    setGroupingLevels(levels);
    setCollapsedGroups(new Set());
  }, []);

  const handleSortOrderToggle = useCallback(() => {
    setFilters((prev) => ({ ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }));
  }, []);

  const handleDmGroupingToggle = useCallback(() => {
    setGroupingLevels((prev: string[]) => {
      if (prev.includes("dm")) return prev.filter((l: string) => l !== "dm");
      return ["dm", ...prev.filter((l: string) => l !== "dm")];
    });
    setCollapsedGroups(new Set());
  }, []);

  const handleDispoRangeChange = useCallback((value: number[]) => {
    setFilters((prev) => ({ ...prev, dispoMin: value[0], dispoMax: value[1] }));
  }, []);

  // ── Filter summary & active filter management ───────────────────────────
  const filterSummary = getFilterSummary(filters, enrichedGanttData.length, filteredEmployees.length);

  const removeActiveFilter = useCallback(
    (key: string) => {
      // Cascade filters use indexed keys: cascade_0, cascade_1, ...
      if (key.startsWith("cascade_")) {
        const idx = parseInt(key.split("_")[1], 10);
        updateFilter({ cascadeFilters: (filters.cascadeFilters || []).filter((_, i) => i !== idx) });
        return;
      }
      // Compound resets: "dispo" and "skill" clear multiple filter keys at once
      if (key === "dispo") {
        updateFilter({
          dispoMin: FILTER_DEFAULTS.dispoMin,
          dispoMax: FILTER_DEFAULTS.dispoMax,
        } as Partial<StaffingFilters>);
        return;
      }
      if (key === "skill") {
        updateFilter({
          skillSearch: FILTER_DEFAULTS.skillSearch,
          skillMinLevel: FILTER_DEFAULTS.skillMinLevel,
        } as Partial<StaffingFilters>);
        return;
      }
      // Simple 1:1 resets via lookup table
      if (key in FILTER_DEFAULTS) {
        updateFilter({ [key]: FILTER_DEFAULTS[key as keyof StaffingFilters] } as Partial<StaffingFilters>);
      }
    },
    [updateFilter, filters.cascadeFilters]
  );

  const clearAllFilters = useCallback(() => {
    updateFilter({ ...FILTER_DEFAULTS } as Partial<StaffingFilters>);
    setManagerFilter("all");
  }, [updateFilter]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== "" ||
      (filters.searchTags && filters.searchTags.length > 0) ||
      (filters.utilization && filters.utilization !== UTILIZATION_FILTERS.ALL) ||
      (filters.project && filters.project !== "all") ||
      (Array.isArray(filters.grades) && filters.grades.length > 0) ||
      (filters.categories && filters.categories.length > 0) ||
      (filters.minAvailability && filters.minAvailability > 0) ||
      (filters.cascadeFilters && filters.cascadeFilters.length > 0) ||
      filters.skillSearch !== "" ||
      filters.hideTu100 ||
      filters.hideTuAboveTarget ||
      filters.gradeTransitionOnly ||
      !!filters.churnFilter ||
      (filters.sapFilter && filters.sapFilter !== "all") ||
      filters.dispoMin > 0 ||
      (filters.dispoMax != null && filters.dispoMax < 100) ||
      managerFilter !== "all"
    );
  }, [filters, managerFilter]);

  return {
    updateFilter,
    cascadeOptions,
    handleUtilizationBucketClick,
    activeUtilizationBucket,
    activeGradeTier,
    handleGradeTierClick,
    handleCascadeChange,
    handleCascadeRemove,
    addCascadeFilter,
    handleGroupingChange,
    handleSortOrderToggle,
    handleDmGroupingToggle,
    handleDispoRangeChange,
    filterSummary,
    removeActiveFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}
