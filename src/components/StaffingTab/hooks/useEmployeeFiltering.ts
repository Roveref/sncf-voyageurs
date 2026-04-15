import { useMemo, useCallback } from "react";
import { MAX_EMPLOYEES_DISPLAY, CHARGEABLE_CATS, GO_CATS } from "../constants";
import { CATEGORY_HIERARCHY } from "../constants";
import { M_PLUS_GRADES, M_MINUS_GRADES } from "../constants/theme";
import { applyFilters, sortEmployees, UTILIZATION_FILTERS } from "../utils/filterUtils";
import { recordGridStep } from "../utils/perf";
import { getRealEmpId, countUniqueReal } from "../utils/empIdUtils";
import { getToday } from "../../../utils/formatters";
import type { Employee, StaffingFilters, IncludeExcludeFilter, Manager, PipelineJobcode, DailyCell } from "../types";
import type { EmployeeDailyData } from "../types";

interface UseEmployeeFilteringParams {
  employeesWithRates: Employee[];
  allEmployeesForTrendBase: Employee[];
  filters: StaffingFilters;
  macroGradeFilter: IncludeExcludeFilter;
  macroCategoryFilter: IncludeExcludeFilter;
  segmentFilter: IncludeExcludeFilter;
  segmentModes: Map<string, string>;
  serviceLineFilter: IncludeExcludeFilter;
  serviceLineModes: Map<string, string>;
  managerFilter: string;
  managerList: Manager[];
  pipelineJobcodes: Map<string, PipelineJobcode> | null;
  showIO: string;
  groupingLevels: string[];
  heatmapMode: string;
  chargeableCombined: boolean;
  dailyGrid: Map<string, any>;
  timelineStart: Date;
  timelineEnd: Date;
  dataSourceDebug: string;
}

/**
 * Applies all active filters (search tags, grade, category, utilization, segment, manager, IO…),
 * sorts the result, and builds the grouped/DM-hierarchy display structure for the Gantt list.
 */
export function useEmployeeFiltering({
  employeesWithRates,
  allEmployeesForTrendBase,
  filters,
  macroGradeFilter,
  macroCategoryFilter,
  segmentFilter,
  segmentModes,
  serviceLineFilter,
  serviceLineModes,
  managerFilter,
  managerList,
  pipelineJobcodes,
  showIO,
  groupingLevels,
  heatmapMode,
  chargeableCombined,
  dailyGrid,
  timelineStart,
  timelineEnd,
  dataSourceDebug,
}: UseEmployeeFilteringParams) {
  // ── Sidebar filters (shared between filteredEmployees and stable trend list) ─
  const applySidebarFilters = useCallback(
    (emps: Employee[]) => {
      let result = emps;

      // ── Macro grade filter (M+ / M- / individual grades) from sidebar ─
      if (macroGradeFilter) {
        const inc = macroGradeFilter.included || [];
        const exc = macroGradeFilter.excluded || [];
        if (inc.length > 0) {
          const allowed = new Set();
          inc.forEach((k: string) => {
            if (k === "M+") M_PLUS_GRADES.forEach((g) => allowed.add(g));
            else if (k === "M-") M_MINUS_GRADES.forEach((g) => allowed.add(g));
            else allowed.add(k);
          });
          result = result.filter((e) => allowed.has(e.grade));
        }
        if (exc.length > 0) {
          const blocked = new Set();
          exc.forEach((k: string) => {
            if (k === "M+") M_PLUS_GRADES.forEach((g) => blocked.add(g));
            else if (k === "M-") M_MINUS_GRADES.forEach((g) => blocked.add(g));
            else blocked.add(k);
          });
          result = result.filter((e) => !blocked.has(e.grade));
        }
      }

      // ── Macro category filter (Chargeable / Non Chargeable / Absence / individual sub-cats) ─
      if (macroCategoryFilter) {
        const inc = macroCategoryFilter.included || [];
        const exc = macroCategoryFilter.excluded || [];
        const macroKeys: Set<string> = new Set(Object.values(CATEGORY_HIERARCHY));
        const buildCatSet = (keys: string[]) => {
          const s = new Set<string>();
          keys.forEach((k: string) => {
            if (macroKeys.has(k)) {
              Object.entries(CATEGORY_HIERARCHY).forEach(([sub, main]) => {
                if (main === k) s.add(sub);
              });
            } else {
              s.add(k);
            }
          });
          return s;
        };
        const tlStartStr = timelineStart.toISOString().slice(0, 10);
        const tlEndStr = timelineEnd.toISOString().slice(0, 10);
        const overlapsTimeline = (a: { startDate: string; endDate: string }) =>
          a.startDate <= tlEndStr && a.endDate >= tlStartStr;
        const checkMds = dataSourceDebug !== "sap";
        const checkSap = dataSourceDebug !== "mds";
        // Check if employee has any SAP segment with a category in the given set within the timeline
        const hasSapCat = (e: any, catSet: Set<unknown>) => {
          if (!checkSap) return false;
          const empGrid = dailyGrid.get(e.empId);
          if (!empGrid?.cells) return false;
          return empGrid.cells.some(
            (c: any) => c && c.isSap && c.segments?.some((seg: any) => catSet.has(seg.category))
          );
        };
        if (inc.length > 0) {
          const allowed = buildCatSet(inc);
          result = result.filter(
            (e) =>
              (checkMds && e.assignments.some((a: any) => allowed.has(a.category) && overlapsTimeline(a))) ||
              hasSapCat(e, allowed)
          );
        }
        if (exc.length > 0) {
          const blocked = buildCatSet(exc);
          // Check if employee has any SAP segment NOT in the blocked set
          const hasSapNonBlocked = (e: Employee) => {
            if (!checkSap) return true;
            const empGrid = dailyGrid.get(e.empId);
            if (!empGrid?.cells) return true;
            return empGrid.cells.some(
              (c: any) => c && c.isSap && c.segments?.some((seg: any) => !blocked.has(seg.category))
            );
          };
          result = result.filter((e) => {
            const mdsOk =
              !checkMds ||
              !e.assignments.filter((a: any) => overlapsTimeline(a)).every((a: any) => blocked.has(a.category));
            return mdsOk && hasSapNonBlocked(e);
          });
        }
      }

      // ── Segment filter (Sub Segment Code from sidebar) ──────────────
      const showAll = filters.showAllEmployees;
      if (segmentFilter) {
        const inc = segmentFilter.included || [];
        const exc = segmentFilter.excluded || [];
        if (inc.length > 0 && !showAll) {
          const teamSegs: string[] = [];
          const bothSegs: string[] = [];
          let hasOppOnly = false;
          inc.forEach((s: string) => {
            const mode = segmentModes.get(s);
            if (mode === "both") bothSegs.push(s);
            else if (mode === "team") teamSegs.push(s);
            else hasOppOnly = true;
          });
          const currentMonthStartMs = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
          const startMs = timelineStart.getTime();
          const dayMs = 86400000;
          const incSegSet = new Set(inc);

          const hasChargeableInTimeline = (e: Employee) => {
            const grid = dailyGrid.get(e.empId);
            if (!grid?.cells) return false;

            for (let i = 0; i < grid.cells.length; i++) {
              const cell = grid.cells[i];
              if (!cell.segments || cell.segments.length === 0) continue;

              const useSap =
                dataSourceDebug === "sap" || (dataSourceDebug === "all" && startMs + i * dayMs < currentMonthStartMs);

              for (const seg of cell.segments) {
                if (!CHARGEABLE_CATS.has(seg.category) && !(chargeableCombined && GO_CATS.has(seg.category))) continue;
                if (useSap) {
                  // SAP: explicitly check jobNo maps to an included segment
                  const entry = pipelineJobcodes?.get(seg.jobNo);
                  if (entry && incSegSet.has(entry.segment)) return true;
                } else {
                  // MDS: assignments already filtered by segment, any chargeable/GO is valid
                  return true;
                }
              }
            }
            return false;
          };

          // Collect realEmpIds that pass the filter, then include all grade splits
          const passesFilter = (e: Employee) => {
            if (teamSegs.length > 0 || bothSegs.length > 0) {
              const teamMatch = (seg: string) => e.subTeam === seg || e.serviceLine === seg;
              if (bothSegs.some((s) => teamMatch(s))) return true;
              if (teamSegs.some((s) => teamMatch(s))) return true;
            }
            if (hasOppOnly && hasChargeableInTimeline(e)) return true;
            return false;
          };

          const passingRealIds = new Set<string>();
          result.forEach((e) => {
            if (passesFilter(e)) passingRealIds.add(getRealEmpId(e));
          });
          result = result.filter((e) => passingRealIds.has(getRealEmpId(e)));
        }
        if (exc.length > 0) {
          const teamExcSegs: string[] = [];
          const bothExcSegs: string[] = [];
          exc.forEach((s: string) => {
            const mode = segmentModes.get(s);
            if (mode === "team") teamExcSegs.push(s);
            else if (mode === "both") bothExcSegs.push(s);
          });
          if (teamExcSegs.length > 0) {
            const segSet = new Set(teamExcSegs);
            result = result.filter((e) => !segSet.has(e.subTeam || "") && !segSet.has(e.serviceLine || ""));
          }
          if (bothExcSegs.length > 0 && pipelineJobcodes) {
            result = result.filter((e) => {
              const teamMatch = (seg: string) => e.subTeam === seg || e.serviceLine === seg;
              const oppMatch = (seg: string) =>
                e.assignments.some(
                  (a: any) => CHARGEABLE_CATS.has(a.category) && pipelineJobcodes.get(a.jobNo)?.segment === seg
                );
              return !bothExcSegs.some((s) => teamMatch(s) && oppMatch(s));
            });
          }
        }
      }

      // ── Service Line filter (from RightSidebar) ──────────────
      if (serviceLineFilter) {
        const slInc = serviceLineFilter.included || [];
        const slExc = serviceLineFilter.excluded || [];
        if (slInc.length > 0 && !showAll) {
          const teamSLs: string[] = [];
          const bothSLs: string[] = [];
          let hasSlOppOnly = false;
          slInc.forEach((s: string) => {
            const mode = serviceLineModes.get(s);
            if (mode === "both") bothSLs.push(s);
            else if (mode === "team") teamSLs.push(s);
            else hasSlOppOnly = true;
          });

          const slCurrentMonthStartMs = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
          const slStartMs = timelineStart.getTime();
          const slDayMs = 86400000;
          const incSLSet = new Set(slInc);

          const hasSLChargeableInTimeline = (e: Employee) => {
            const grid = dailyGrid.get(e.empId);
            if (!grid?.cells) return false;
            for (let i = 0; i < grid.cells.length; i++) {
              const cell = grid.cells[i];
              if (!cell.segments || cell.segments.length === 0) continue;
              const useSap =
                dataSourceDebug === "sap" ||
                (dataSourceDebug === "all" && slStartMs + i * slDayMs < slCurrentMonthStartMs);
              for (const seg of cell.segments) {
                if (!CHARGEABLE_CATS.has(seg.category) && !(chargeableCombined && GO_CATS.has(seg.category))) continue;
                if (useSap) {
                  const entry = pipelineJobcodes?.get(seg.jobNo);
                  if (
                    entry &&
                    [entry.serviceLine, entry.serviceLine2, entry.serviceLine3].some((sl) => sl && incSLSet.has(sl))
                  )
                    return true;
                } else {
                  return true;
                }
              }
            }
            return false;
          };

          const slPassesFilter = (e: Employee) => {
            if (teamSLs.length > 0 || bothSLs.length > 0) {
              const empSL = e.serviceLine || "";
              if (bothSLs.includes(empSL)) return true;
              if (teamSLs.includes(empSL)) return true;
            }
            if (hasSlOppOnly && hasSLChargeableInTimeline(e)) return true;
            return false;
          };

          const slPassingRealIds = new Set<string>();
          result.forEach((e) => {
            if (slPassesFilter(e)) slPassingRealIds.add(getRealEmpId(e));
          });
          result = result.filter((e) => slPassingRealIds.has(getRealEmpId(e)));
        }
        if (slExc.length > 0) {
          const teamExcSLs: string[] = [];
          const bothExcSLs: string[] = [];
          slExc.forEach((s: string) => {
            const mode = serviceLineModes.get(s);
            if (mode === "team") teamExcSLs.push(s);
            else if (mode === "both") bothExcSLs.push(s);
          });
          if (teamExcSLs.length > 0) {
            const slSet = new Set(teamExcSLs);
            result = result.filter((e) => !slSet.has(e.serviceLine || ""));
          }
          if (bothExcSLs.length > 0 && pipelineJobcodes) {
            result = result.filter((e) => {
              const empSL = e.serviceLine || "";
              const slTeamMatch = (sl: string) => empSL === sl;
              const slOppMatch = (sl: string) =>
                e.assignments.some(
                  (a: any) => CHARGEABLE_CATS.has(a.category) && pipelineJobcodes.get(a.jobNo)?.serviceLine === sl
                );
              return !bothExcSLs.some((s) => slTeamMatch(s) && slOppMatch(s));
            });
          }
        }
      }

      if (managerFilter !== "all") {
        const mgr = managerList.find((m) => m.empId === managerFilter);
        if (mgr) {
          const allowedIds = new Set([mgr.empId, ...mgr.reportIds]);
          result = result.filter((e) => allowedIds.has(e.empId));
        }
        // If manager was deleted from data, filter is silently bypassed (shows all — safe fallback)
      }

      // ── I&O team filter: keep only employees from I&O sub-teams ──
      if (showIO === "ioTeam") {
        const IO_SET = new Set(["IEM", "AUTO", "Operations", "LSC"]);
        result = result.filter((e) => IO_SET.has(e.subTeam));
      }

      return result;
    },
    [
      macroGradeFilter,
      macroCategoryFilter,
      segmentFilter,
      segmentModes,
      serviceLineFilter,
      serviceLineModes,
      managerFilter,
      managerList,
      pipelineJobcodes,
      showIO,
      dailyGrid,
      timelineStart,
      timelineEnd,
      dataSourceDebug,
      filters.showAllEmployees,
      chargeableCombined,
    ]
  );

  // When DM hierarchy is active and search is filtering, expand to include subordinates
  const expandWithSubordinates = useCallback(
    (filtered: Employee[], allEmps: Employee[]) => {
      if (
        !groupingLevels.includes("dm") ||
        (!filters.search && (!filters.searchTags || filters.searchTags.length === 0)) ||
        filtered.length >= allEmps.length
      )
        return filtered;
      const result = [...filtered];
      const matchedNames = new Set(result.map((e) => e.name));
      const resultIds = new Set(result.map((e) => e.empId));
      const visitedManagers = new Set<string>();
      const addSubordinates = (managerName: string) => {
        if (visitedManagers.has(managerName)) return; // Cycle protection
        visitedManagers.add(managerName);
        allEmps.forEach((emp) => {
          if (emp.directManager === managerName && !resultIds.has(emp.empId)) {
            resultIds.add(emp.empId);
            result.push(emp);
            addSubordinates(emp.name);
          }
        });
      };
      matchedNames.forEach((name) => addSubordinates(name));
      return result;
    },
    [groupingLevels, filters.search, filters.searchTags]
  );

  // ── Filtered employees (cheap filtering only, no heavy computation) ─────────
  const filteredEmployees = useMemo(() => {
    try {
      let result = applyFilters(employeesWithRates, filters, {
        heatmapMode,
        chargeableCombined,
        timelineStart,
        timelineEnd,
        pipelineJobcodes,
      });
      result = applySidebarFilters(result);
      result = expandWithSubordinates(result, employeesWithRates);
      recordGridStep("applyFilters", 0, `${result.length} / ${employeesWithRates.length} employees displayed`);
      return result;
    } catch (err) {
      console.error("[StaffingTab] filteredEmployees error:", err);
      console.warn(
        "[StaffingTab] filteredEmployees: returning empty array due to filtering error — check filters, sidebar filters, or subordinate expansion logic"
      );
      return [];
    }
  }, [
    employeesWithRates,
    filters,
    heatmapMode,
    chargeableCombined,
    applySidebarFilters,
    expandWithSubordinates,
    timelineStart,
    timelineEnd,
    pipelineJobcodes,
  ]);

  // TU Trend: stable employee list — sidebar filters applied on stable base data.
  // Utilization filter uses empIds from filteredEmployees (which has _displayTU) to stay in sync.
  const hasUtilFilter = filters.utilization && filters.utilization !== UTILIZATION_FILTERS.ALL;
  const utilFilteredIds = useMemo(() => {
    if (!hasUtilFilter) return null;
    const ids = new Set<string>();
    filteredEmployees.forEach((e: Employee) => ids.add(getRealEmpId(e)));
    return ids;
  }, [hasUtilFilter, filteredEmployees]);

  const allEmployeesForTrend = useMemo(() => {
    let result = applyFilters(allEmployeesForTrendBase, filters, {
      heatmapMode,
      chargeableCombined,
      skipUtilization: true,
    });
    result = applySidebarFilters(result);
    result = expandWithSubordinates(result, allEmployeesForTrendBase);
    if (utilFilteredIds) {
      result = result.filter((e: Employee) => utilFilteredIds.has(getRealEmpId(e)));
    }
    return result;
  }, [
    allEmployeesForTrendBase,
    filters,
    heatmapMode,
    chargeableCombined,
    applySidebarFilters,
    expandWithSubordinates,
    utilFilteredIds,
  ]);

  // Stable ETP count: from allEmployeesForTrend (not timeline-dependent), counting present employees
  const stableEmpCount = useMemo(() => {
    const today = getToday();
    const activeRealIds = new Set<string>();
    allEmployeesForTrend.forEach((emp) => {
      const arr = emp._arrivalDate;
      const dep = emp._departureDate;
      if ((!arr || today >= arr) && (!dep || today <= dep)) {
        activeRealIds.add(getRealEmpId(emp));
      }
    });
    return activeRealIds.size || countUniqueReal(allEmployeesForTrend);
  }, [allEmployeesForTrend]);

  // When mergeGradeRows is active, collapse grade-split rows into single display rows.
  // In DM hierarchy mode, managers with subordinates are always merged regardless of toggle.
  const { mergedDisplayEmployees, mergedDailyGrid } = useMemo(() => {
    // Limit by unique real employees (not by rows) so grade splits don't push out other people
    let list: Employee[];
    if (filteredEmployees.length <= MAX_EMPLOYEES_DISPLAY) {
      list = filteredEmployees;
    } else {
      const seenReal = new Set<string>();
      list = [];
      for (const emp of filteredEmployees) {
        const realId = getRealEmpId(emp);
        if (seenReal.has(realId)) {
          // Always include all splits of an already-included employee
          list.push(emp);
        } else if (seenReal.size < MAX_EMPLOYEES_DISPLAY) {
          seenReal.add(realId);
          list.push(emp);
        }
        // else: skip — unique limit reached
      }
    }
    const dmActive = groupingLevels.includes("dm");

    // Identify managers (employees who are someone's directManager) for forced merge in DM mode
    const managerNames = dmActive ? new Set(list.map((e) => e.directManager).filter(Boolean)) : null;
    const shouldMerge = (emp: Employee) => {
      if (filters.mergeGradeRows) return true; // merge all when toggle is on
      if (dmActive && managerNames?.has(emp.name)) return true; // always merge managers in DM mode
      return false;
    };

    // Check if any split employee needs merging
    const hasSplitsToMerge = list.some((emp) => emp._isGradeSplit && shouldMerge(emp));
    if (!hasSplitsToMerge) return { mergedDisplayEmployees: list, mergedDailyGrid: null };

    // Group split rows by realEmpId
    const splitsByReal = new Map<string, any[]>();
    list.forEach((emp) => {
      if (!emp._isGradeSplit) return;
      const realId = getRealEmpId(emp);
      if (!splitsByReal.has(realId)) splitsByReal.set(realId, []);
      splitsByReal.get(realId)!.push(emp);
    });

    // Build merged dailyGrid entries
    const gridOverlay = new Map<string, any>();
    const seenReal = new Set<string>();
    const merged = list
      .filter((emp) => {
        if (!emp._isGradeSplit) return true;
        if (!shouldMerge(emp)) return true; // keep split rows that don't need merging
        const realId = getRealEmpId(emp);
        if (seenReal.has(realId)) return false; // skip duplicate split rows
        seenReal.add(realId);
        return true;
      })
      .map((emp) => {
        if (!emp._isGradeSplit || !shouldMerge(emp)) return emp;
        const realId = getRealEmpId(emp);
        const splits = splitsByReal.get(realId);
        if (!splits || splits.length <= 1) return emp;
        // Sort by grade index to ensure chronological order (last = most recent grade)
        splits.sort((a, b) => (a._gradeIndex || 0) - (b._gradeIndex || 0));

        // Merge dailyGrid cells: overlay active cells from each split
        const grids = splits.map((s) => dailyGrid?.get(s.empId)?.cells).filter(Boolean);
        if (grids.length > 0 && grids[0]) {
          // Use the longest grid to avoid truncating cells from later splits
          const maxLen = Math.max(...grids.map((g) => g?.length || 0));
          const mergedCells = Array.from({ length: maxLen }, (_, idx) => {
            // Find the split that has active data for this day
            for (let g = grids.length - 1; g >= 0; g--) {
              if (grids[g]?.[idx]?.hasStaffing) return grids[g][idx];
            }
            return grids[0]?.[idx] || grids.find((g) => g?.[idx])?.[idx]; // fallback
          });
          gridOverlay.set(realId, { cells: mergedCells });
        }

        // Build merged employee: use last split's grade, full date range, sum hours across splits
        const last = splits[splits.length - 1];
        const first = splits[0];
        const sumNetH = splits.reduce((s, e) => s + (e._displayNetH || 0), 0);
        const sumChH = splits.reduce((s, e) => s + (e._displayChH || 0), 0);
        const sumTrH = splits.reduce((s, e) => s + (e._displayTrH || 0), 0);
        const sumAbsH = splits.reduce((s, e) => s + (e._displayAbsH || 0), 0);
        const mergedTU = sumNetH > 0 ? (sumChH / sumNetH) * 100 : 0;
        const mergedTO = sumNetH > 0 ? ((sumChH + sumTrH) / sumNetH) * 100 : 0;
        return {
          ...last,
          empId: realId,
          _isGradeSplit: false,
          _arrivalDate: first._arrivalDate,
          _departureDate: last._departureDate,
          _displayNetH: sumNetH,
          _displayChH: sumChH,
          _displayTrH: sumTrH,
          _displayAbsH: sumAbsH,
          _displayTU: mergedTU,
          _displayTO: mergedTO,
          totalNetHours: splits.reduce((s, e) => s + (e.totalNetHours || 0), 0),
        };
      });

    // Re-sort after merge so the combined TU/TO is used for ordering
    const sortedMerged = filters.sortBy
      ? sortEmployees(merged, filters.sortBy, filters.sortOrder || "asc", { heatmapMode })
      : merged;

    return { mergedDisplayEmployees: sortedMerged, mergedDailyGrid: gridOverlay };
  }, [
    filteredEmployees,
    filters.mergeGradeRows,
    filters.sortBy,
    filters.sortOrder,
    heatmapMode,
    dailyGrid,
    groupingLevels,
  ]);

  const displayedEmployees = mergedDisplayEmployees;

  // Effective dailyGrid: overlay merged entries on top of original grid for display
  const effectiveDailyGrid = useMemo(() => {
    if (!mergedDailyGrid || mergedDailyGrid.size === 0) return dailyGrid;
    const merged = new Map(dailyGrid);
    mergedDailyGrid.forEach((v, k) => merged.set(k, v));
    return merged;
  }, [dailyGrid, mergedDailyGrid]);

  const teamNetHours = useMemo(
    () => displayedEmployees.reduce((s, e) => s + (e._displayNetH || e.totalNetHours || 0), 0),
    [displayedEmployees]
  );

  // Project count for TUOverview
  const uniqueProjectCount = useMemo(() => {
    const projects = new Set();
    filteredEmployees.forEach((emp) => {
      (emp.assignments || []).forEach((a) => {
        if (a.jobName && a.category !== "vacation" && a.category !== "rtt" && a.category !== "holiday") {
          projects.add(a.jobName);
        }
      });
    });
    return projects.size;
  }, [filteredEmployees]);

  return {
    filteredEmployees,
    allEmployeesForTrend,
    stableEmpCount,
    displayedEmployees,
    effectiveDailyGrid,
    teamNetHours,
    uniqueProjectCount,
  };
}
