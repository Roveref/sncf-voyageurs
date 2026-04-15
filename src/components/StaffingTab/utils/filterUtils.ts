import { compareGrades } from "../constants";
import { getGradeTarget } from "../constants/theme";
import type { Employee, CascadeFilter, Assignment, SapProject, PipelineJobcode } from "../types";

/**
 * Filter options configuration
 */
export const UTILIZATION_FILTERS = {
  ALL: "all",
  BENCH: "bench", // 0% (bench)
  CRITICAL: "critical", // < 50% of target
  LOW: "low", // 50-80% of target
  PARTIAL: "partial", // 80-100% of target
  ON_TARGET: "on_target", // ≥ target
};

export const UTILIZATION_FILTER_LABELS = {
  [UTILIZATION_FILTERS.ALL]: "All",
  [UTILIZATION_FILTERS.BENCH]: "Bench (0%)",
  [UTILIZATION_FILTERS.CRITICAL]: "< 50% of target",
  [UTILIZATION_FILTERS.LOW]: "50-80% of target",
  [UTILIZATION_FILTERS.PARTIAL]: "80-100% of target",
  [UTILIZATION_FILTERS.ON_TARGET]: "≥ target",
};

/**
 * Get unique grades from employees
 * @param {Array} employees - Array of employees
 * @returns {Array} - Unique grades in hierarchy order
 */
export const getUniqueGrades = (employees: Employee[]): string[] => {
  const grades = new Set<string>();
  employees.forEach((employee) => {
    if (employee.grade) grades.add(employee.grade);
  });
  return [...grades].sort(compareGrades);
};

/**
 * Get unique sub-teams from employees
 * @param {Array} employees - Array of employees
 * @returns {Array} - Unique sub-teams sorted alphabetically
 */
/**
 * Get unique service lines from employees
 */
export const getUniqueServiceLines = (employees: Employee[]): string[] => {
  const sls = new Set<string>();
  employees.forEach((employee) => {
    if (employee.serviceLine) sls.add(employee.serviceLine);
  });
  return Array.from(sls).sort();
};

export const getUniqueSubTeams = (employees: Employee[]): string[] => {
  const subTeams = new Set<string>();
  employees.forEach((employee) => {
    if (employee.subTeam) subTeams.add(employee.subTeam);
  });
  return Array.from(subTeams).sort();
};

/**
 * Sort employees by various criteria
 * @param {Array} employees - Array of employees
 * @param {string} sortBy - Sort criteria
 * @param {string} sortOrder - 'asc' or 'desc'
 * @returns {Array} - Sorted employees
 */
export const sortEmployees = (
  employees: Employee[],
  sortBy: string = "name",
  sortOrder: string = "asc",
  options: Record<string, unknown> = {}
): Employee[] => {
  const { heatmapMode = "utilization" } = options;
  const sorted = [...employees];
  const multiplier = sortOrder === "asc" ? 1 : -1;

  // Use _displayTU/_displayTO computed by computeDisplayTuTo (same as EmployeeRow display)
  const getRate = (emp: Employee) => {
    if (heatmapMode === "to") return emp._displayTO ?? emp.trueOccupationRate ?? 0;
    if (heatmapMode === "availability") return -(emp._displayTU ?? emp.trueUtilizationRate ?? 0);
    return emp._displayTU ?? emp.trueUtilizationRate ?? 0;
  };

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "name": {
        // Sort by last name (last word in name)
        const aLast = a.name.trim().split(/\s+/).pop() || a.name;
        const bLast = b.name.trim().split(/\s+/).pop() || b.name;
        return multiplier * aLast.localeCompare(bLast);
      }
      case "grade": {
        const gDiff = compareGrades(a.grade || "", b.grade || "");
        if (gDiff !== 0) return multiplier * gDiff;
        return a.name.localeCompare(b.name);
      }
      case "utilization": {
        const diff = multiplier * (getRate(a) - getRate(b));
        if (diff !== 0) return diff;
        return -(a.availableCapacityHours - b.availableCapacityHours);
      }
      case "availability":
        return multiplier * (a.availableCapacityHours - b.availableCapacityHours);
      case "projects":
        return multiplier * (a.projectCount - b.projectCount);
      case "fragmentation": {
        const aF = a.fragScore || 0;
        const bF = b.fragScore || 0;
        if (aF === 0 && bF > 0) return 1;
        if (bF === 0 && aF > 0) return -1;
        return multiplier * (aF - bF);
      }
      case "skillLevel": {
        const aL = a.avgSkillLevel || 0;
        const bL = b.avgSkillLevel || 0;
        return multiplier * (aL - bL);
      }
      case "variance_hours": {
        const aV = a._varianceHours;
        const bV = b._varianceHours;
        if (aV == null && bV == null) return 0;
        if (aV == null) return 1;
        if (bV == null) return -1;
        return multiplier * (aV - bV);
      }
      case "variance_hours_pct": {
        const aV = a._varianceRate;
        const bV = b._varianceRate;
        if (aV == null && bV == null) return 0;
        if (aV == null) return 1;
        if (bV == null) return -1;
        return multiplier * (aV - bV);
      }
      case "hours": {
        const aCh = a._displayChH || 0;
        const bCh = b._displayChH || 0;
        return multiplier * (aCh - bCh);
      }
      default:
        return 0;
    }
  });

  return sorted;
};

/**
 * Apply multiple filters to employees
 * @param {Array} employees - Array of employees
 * @param {object} filters - Filter options { search, utilization, project, category, minAvailability, grades, subTeams }
 * @returns {Array} - Filtered employees
 */
export const applyFilters = (
  employees: Employee[],
  filters: Record<string, any>,
  options: Record<string, unknown> = {}
): Employee[] => {
  // Collect all predicates, then run a single .filter() pass to avoid
  // creating intermediate arrays for each filter step.
  const predicates: Array<(e: Employee) => boolean> = [];

  // Timeline bounds for project/account overlap checks
  const tlStart = options.timelineStart
    ? new Date(options.timelineStart as string | number | Date).toISOString().slice(0, 10)
    : "";
  const tlEnd = options.timelineEnd
    ? new Date(options.timelineEnd as string | number | Date).toISOString().slice(0, 10)
    : "";
  const assignmentInRange = (a: Assignment) => (!tlStart || a.endDate >= tlStart) && (!tlEnd || a.startDate <= tlEnd);
  const sapProjectInRange = (sp: SapProject) => (!tlStart || sp.maxDate >= tlStart) && (!tlEnd || sp.minDate <= tlEnd);
  const pipelineJobcodes = options.pipelineJobcodes as Map<string, PipelineJobcode> | null | undefined;

  // Build account→jobcodes lookup for account filtering
  const accountJobcodes = (() => {
    if (!pipelineJobcodes) return null;
    const map = new Map<string, Set<string>>();
    for (const [jc, entry] of pipelineJobcodes) {
      const acct = entry.account?.toLowerCase();
      if (!acct) continue;
      if (!map.has(acct)) map.set(acct, new Set());
      map.get(acct)!.add(jc);
    }
    return map;
  })();

  const employeeMatchesAccount = (e: Employee, accountName: string): boolean => {
    if (!accountJobcodes) return false;
    const jcs = accountJobcodes.get(accountName.toLowerCase());
    if (!jcs) return false;
    return (
      e.assignments.some((a) => a.jobNo && jcs.has(a.jobNo.trim()) && assignmentInRange(a)) ||
      (e._sapProjects || []).some((sp) => jcs.has(sp.code) && sapProjectInRange(sp))
    );
  };

  // Search (with optional scope)
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    const scope = filters.searchScope || "";
    predicates.push((e) => {
      if (scope === "person") {
        return e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q);
      }
      if (scope === "project") {
        return (
          e.assignments.some(
            (a) =>
              assignmentInRange(a) &&
              (a.jobName.toLowerCase().includes(q) || (a.jobNo && a.jobNo.toLowerCase().includes(q)))
          ) ||
          (e._sapProjects || []).some(
            (sp) =>
              sapProjectInRange(sp) &&
              (sp.name.toLowerCase().includes(q) || (sp.code && sp.code.toLowerCase().includes(q)))
          )
        );
      }
      if (scope === "account") {
        return employeeMatchesAccount(e, q);
      }
      if (scope === "skill") {
        return !!(
          e.skills &&
          e.skills.some((s) => s.skillShort.toLowerCase().includes(q) || s.skillFull.toLowerCase().includes(q))
        );
      }
      // No scope → search everything via _searchIndex (includes SAP projects)
      if (e._searchIndex) return e._searchIndex.includes(q);
      if (e.name.toLowerCase().includes(q)) return true;
      if (e.empId.toLowerCase().includes(q)) return true;
      if (e.assignments.some((a) => a.jobName.toLowerCase().includes(q))) return true;
      if (e.assignments.some((a) => a.jobNo && a.jobNo.toLowerCase().includes(q))) return true;
      if (
        e.skills &&
        e.skills.some((s) => s.skillShort.toLowerCase().includes(q) || s.skillFull.toLowerCase().includes(q))
      )
        return true;
      return false;
    });
  }

  // Search tags (multi-select): OR within same type, AND across types
  if (filters.searchTags && filters.searchTags.length > 0) {
    const byType: Record<string, Array<{ type: string; text: string; minLevel?: number }>> = {};
    for (const tag of filters.searchTags) {
      if (!byType[tag.type]) byType[tag.type] = [];
      byType[tag.type].push(tag);
    }
    predicates.push((e) => {
      for (const [type, tags] of Object.entries(byType)) {
        const matchesAny = tags.some((tag) => {
          const v = tag.text.toLowerCase();
          if (type === "person") return e.name.toLowerCase().includes(v) || e.empId.toLowerCase().includes(v);
          if (type === "project")
            return (
              e.assignments.some(
                (a) =>
                  assignmentInRange(a) &&
                  (a.jobName.toLowerCase().includes(v) || (a.jobNo && a.jobNo.toLowerCase().includes(v)))
              ) ||
              (e._sapProjects || []).some(
                (sp) =>
                  sapProjectInRange(sp) &&
                  (sp.name.toLowerCase().includes(v) || (sp.code && sp.code.toLowerCase().includes(v)))
              )
            );
          if (type === "account") return employeeMatchesAccount(e, v);
          if (type === "skill") {
            const minLvl = tag.minLevel || 0;
            return (
              e.skills &&
              e.skills.some(
                (s) =>
                  (s.skillShort.toLowerCase().includes(v) || s.skillFull.toLowerCase().includes(v)) && s.level >= minLvl
              )
            );
          }
          return false;
        });
        if (!matchesAny) return false; // AND across types
      }
      return true;
    });
  }

  // Utilization bucket (skipUtilization: caller handles it externally, e.g. TU Trend via empId set)
  if (!options.skipUtilization && filters.utilization && filters.utilization !== UTILIZATION_FILTERS.ALL) {
    const f = filters.utilization;
    predicates.push((e) => {
      const rate = e._displayTU ?? e.trueUtilizationRate ?? 0;
      const target = getGradeTarget(e.grade) ?? 80;
      switch (f) {
        case UTILIZATION_FILTERS.BENCH:
          return rate === 0;
        case UTILIZATION_FILTERS.CRITICAL: {
          const rel = target > 0 ? (rate / target) * 100 : 0;
          return rate > 0 && rel < 50;
        }
        case UTILIZATION_FILTERS.LOW: {
          const rel = target > 0 ? (rate / target) * 100 : 0;
          return rel >= 50 && rel < 80;
        }
        case UTILIZATION_FILTERS.PARTIAL: {
          const rel = target > 0 ? (rate / target) * 100 : 0;
          return rel >= 80 && rate < target;
        }
        case UTILIZATION_FILTERS.ON_TARGET:
          return rate >= target;
        default:
          return true;
      }
    });
  }

  // Project
  if (filters.project && filters.project !== "all") {
    const pn = filters.project;
    predicates.push((e) => e.assignments.some((a) => a.jobName === pn || a.jobNo === pn));
  }

  // Category
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    const catSet = new Set(filters.categories);
    predicates.push((e) => e.assignments.some((a) => catSet.has(a.category)));
  }

  // Min availability
  if (filters.minAvailability && filters.minAvailability > 0) {
    const min = filters.minAvailability;
    predicates.push((e) => e.availableCapacityHours >= min);
  }

  // Dispo % range — uses _displayTU (computed over the displayed timeline period)
  const hasDispoMin = filters.dispoMin && filters.dispoMin > 0;
  const hasDispoMax = filters.dispoMax && filters.dispoMax < 100;
  if (hasDispoMin || hasDispoMax) {
    const dMin = filters.dispoMin || 0,
      dMax = filters.dispoMax || 100;
    predicates.push((e) => {
      const tu = e._displayTU ?? e.trueUtilizationRate ?? 0;
      const dispo = Math.max(0, 100 - tu);
      return dispo >= dMin && dispo <= dMax;
    });
  }

  // Grade
  if (filters.grades && filters.grades !== "all" && (!Array.isArray(filters.grades) || filters.grades.length > 0)) {
    const gradeArray = Array.isArray(filters.grades) ? filters.grades : [filters.grades];
    const gradeSet = new Set(gradeArray);
    predicates.push((e) => gradeSet.has(e.grade));
  }

  // Sub-team
  if (
    filters.subTeams &&
    filters.subTeams !== "all" &&
    (!Array.isArray(filters.subTeams) || filters.subTeams.length > 0)
  ) {
    const subTeamArray = Array.isArray(filters.subTeams) ? filters.subTeams : [filters.subTeams];
    const stSet = new Set(subTeamArray);
    predicates.push((e) => stSet.has(e.subTeam));
  }

  // Service line (employee-level)
  if (filters.serviceLine && filters.serviceLine !== "all") {
    predicates.push((e) => e.serviceLine === filters.serviceLine);
  }

  // Skill filter
  if (filters.skillSearch && filters.skillSearch.trim() !== "") {
    const lq = filters.skillSearch.toLowerCase().trim();
    const minLevel = filters.skillMinLevel || 0;
    predicates.push((e) => {
      if (!e.skills || e.skills.length === 0) return false;
      return e.skills.some(
        (s) =>
          (s.skillShort.toLowerCase().includes(lq) || s.skillFull.toLowerCase().includes(lq)) && s.level >= minLevel
      );
    });
  }

  // Cascade filters (inline predicates to avoid per-employee array allocation)
  if (filters.cascadeFilters && filters.cascadeFilters.length > 0) {
    filters.cascadeFilters.forEach((cf: CascadeFilter) => {
      if (cf.criterion && cf.value !== undefined && cf.value !== null && cf.value !== "") {
        const { criterion, value } = cf;
        predicates.push((e) => {
          switch (criterion) {
            case "grade":
              return e.grade === value;
            case "subTeam":
              return e.subTeam === value;
            case "dm":
              return e.directManager === value;
            case "project":
              return e.assignments.some((a) => a.jobName === value || a.jobNo === value);
            case "category":
              return e.assignments.some((a) => a.category === value);
            case "tuRange": {
              const rv = typeof value === "object" ? value : {};
              return e.trueUtilizationRate >= (rv.min || 0) && e.trueUtilizationRate <= (rv.max ?? 200);
            }
            case "dispoRange": {
              const rv = typeof value === "object" ? value : {};
              const d = Math.max(0, 100 - e.trueUtilizationRate);
              return d >= (rv.min || 0) && d <= (rv.max ?? 100);
            }
            case "fragRange": {
              const rv = typeof value === "object" ? value : {};
              const f = e.fragScore || 0;
              return f >= (rv.min || 0) && f <= (rv.max ?? 100);
            }
            case "projectCount": {
              const rv = typeof value === "object" ? value : {};
              return (e.projectCount || 0) >= (rv.min || 0) && (e.projectCount || 0) <= (rv.max ?? 99);
            }
            case "sapCompletion": {
              const rv = typeof value === "object" ? value : {};
              return (e._sapPct || 0) >= (rv.min || 0) && (e._sapPct || 0) <= (rv.max ?? 100);
            }
            default:
              return true;
          }
        });
      }
    });
  }

  // Hide TU=100%
  if (filters.hideTu100) {
    predicates.push((e) => Math.round(e._displayTU ?? e.trueUtilizationRate ?? 0) !== 100);
  }

  // Hide TU >= grade target
  if (filters.hideTuAboveTarget) {
    predicates.push((e) => {
      const tu = e._displayTU ?? e.trueUtilizationRate ?? 0;
      return tu < getGradeTarget(e.grade);
    });
  }

  // Grade transition only
  if (filters.gradeTransitionOnly) {
    predicates.push((e) => !!e._isGradeSplit || !!e._gradeTransition || (e._gradeHistory?.length ?? 0) > 1);
  }

  // Churn filter: arrivals / departures / grade transitions in a specific month
  if (filters.churnFilter) {
    const [type, monthStr] = filters.churnFilter.split("::");
    if (type && monthStr) {
      const mStart = monthStr; // e.g. '2025-03'
      const [y, m] = mStart.split("-").map(Number);
      const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const endStr = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      if (type === "arr") {
        predicates.push((e) => {
          // For grade splits, only g0 has the real arrival
          if (e._isGradeSplit && e._gradeIndex !== 0) return false;
          const arr = e._arrivalDate;
          return !!arr && arr >= startStr && arr < endStr;
        });
      } else if (type === "dep") {
        predicates.push((e) => {
          // For grade splits, only the last split has the real departure
          if (e._isGradeSplit && e._gradeIndex !== (e._gradeSplitCount || 1) - 1) return false;
          const dep = e._departureDate;
          return !!dep && dep >= startStr && dep < endStr;
        });
      } else if (type === "gt") {
        predicates.push((e) => {
          const history = e._gradeHistory;
          if (!history || history.length <= 1) return false;
          return history.some((gh, i) => i > 0 && gh.since && gh.since >= startStr && gh.since < endStr);
        });
      }
    }
  }

  // SAP anomaly only (overcharge or missing SAP hours)
  if (filters.sapAnomalyOnly) {
    predicates.push((e) => !!e._hasSapAnomaly);
  }

  // SAP completion
  if (filters.sapFilter && filters.sapFilter !== "all") {
    const sf = filters.sapFilter;
    predicates.push((e) => {
      const p = e._sapPct || 0;
      switch (sf) {
        case "complete":
          return p >= 100;
        case "partial":
          return p > 0 && p < 100;
        case "empty":
          return p === 0;
        case "incomplete":
          return p < 100;
        default:
          return true;
      }
    });
  }

  // Single-pass filter (no intermediate arrays)
  let result =
    predicates.length > 0
      ? employees.filter((e) => {
          for (const p of predicates) {
            if (!p(e)) return false;
          }
          return true;
        })
      : [...employees];

  if (filters.sortBy) {
    result = sortEmployees(result, filters.sortBy, filters.sortOrder || "asc", options);
  }

  return result;
};

/**
 * Get unique project names from employees
 * @param {Array} employees - Array of employees
 * @returns {Array} - Unique project names
 */
export const getUniqueProjects = (employees: Employee[]): string[] => {
  const projects = new Set<string>();
  employees.forEach((employee) => {
    employee.assignments.forEach((assignment) => {
      if (assignment.jobName) {
        projects.add(assignment.jobName);
      }
    });
  });
  return Array.from(projects).sort();
};

/**
 * Get filter summary text
 * @param {object} filters - Active filters
 * @param {number} totalCount - Total employees count
 * @param {number} filteredCount - Filtered employees count
 * @returns {string} - Summary text
 */
export const getFilterSummary = (filters: Record<string, any>, totalCount: number, filteredCount: number): string => {
  const activeFilters: string[] = [];

  if (filters.search) {
    activeFilters.push(`search: "${filters.search}"`);
  }
  if (filters.utilization && filters.utilization !== UTILIZATION_FILTERS.ALL) {
    activeFilters.push(UTILIZATION_FILTER_LABELS[filters.utilization]);
  }
  if (filters.project && filters.project !== "all") {
    activeFilters.push(`project: ${filters.project}`);
  }
  if (filters.minAvailability && filters.minAvailability > 0) {
    activeFilters.push(`≥ ${filters.minAvailability}h available`);
  }

  if (activeFilters.length === 0) {
    return `${totalCount} employees`;
  }

  return `${filteredCount} / ${totalCount} employees (${activeFilters.join(", ")})`;
};

/**
 * Escape special regex characters in a string.
 * Use this before passing user input to `new RegExp()`.
 * @param {string} str
 * @returns {string}
 */
export const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
