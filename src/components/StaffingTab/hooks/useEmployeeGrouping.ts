import { useMemo } from "react";
import {
  groupByCriterion,
  sortGroups,
  groupByDMHierarchy,
  groupByTeamHierarchy,
  computeGroupStats,
} from "../utils/groupingUtils";

/**
 * Extracts employee grouping logic from StaffingTab.
 * Builds a recursive group tree based on groupingLevels (grade, dm, team, project).
 */
export function useEmployeeGrouping(displayedEmployees: any[], groupingLevels: string[]) {
  return useMemo(() => {
    if (groupingLevels.length === 0) return null;
    const buildNested = (employees: any[], depth: number): any[] | null => {
      if (depth >= groupingLevels.length) return null;
      const criterion = groupingLevels[depth];
      // DM criterion builds the full hierarchy tree automatically
      if (criterion === "dm") {
        const dmTree = groupByDMHierarchy(employees);
        if (depth + 1 < groupingLevels.length) {
          const applySubLevels = (groups: any[]) => {
            groups.forEach((group: any) => {
              if (group._renderFlat) return;
              if (group.subGroups) {
                // Recurse into DM sub-managers first
                applySubLevels(group.subGroups);
                // Build grade groups from leaf employees (excluding manager — shown as DM header)
                const mgrId = group._managerEmp?.empId;
                const leafForGrade = group._leafEmployees
                  ? mgrId
                    ? group._leafEmployees.filter((e: any) => e.empId !== mgrId)
                    : group._leafEmployees
                  : [];
                const gradeGroups = leafForGrade.length > 0 ? buildNested(leafForGrade, depth + 1) : [];
                if ((gradeGroups && gradeGroups.length > 0) || group.subGroups.length > 0) {
                  const unified = gradeGroups || [];
                  // Distribute DM sub-manager groups into the matching grade groups
                  const dmSubGroups = group.subGroups;
                  for (const dmSg of dmSubGroups) {
                    const mgrGrade = dmSg._managerEmp?.grade || "Unassigned";
                    let target = unified.find((gg: any) => gg.name === mgrGrade);
                    if (!target) {
                      target = {
                        name: mgrGrade,
                        employees: [],
                        totalAvailable: 0,
                        weightedTU: 0,
                        weightedTO: 0,
                        totalNetH: 0,
                        totalChH: 0,
                        totalTrainingH: 0,
                        totalDispoH: 0,
                        totalGrossH: 0,
                        totalAbsH: 0,
                        totalChOnlyH: 0,
                        totalGOH: 0,
                        potentialDelta: 0,
                        potentialGainH: 0,
                        ioTU: null,
                      };
                      unified.push(target);
                    }
                    if (!target._dmSubGroups) target._dmSubGroups = [];
                    target._dmSubGroups.push(dmSg);
                    // Add the sub-manager employee to the grade group for correct count/stats
                    if (dmSg._managerEmp) target.employees.push(dmSg._managerEmp);
                  }
                  // Recompute stats for grade groups that received sub-managers
                  unified.forEach((gg: any) => {
                    if (gg._dmSubGroups) computeGroupStats(gg);
                  });
                  if (unified.length > 0) group.subGroups = unified;
                }
              } else {
                const emps = group._leafEmployees || group.employees;
                const mgrId = group._managerEmp?.empId;
                const forNesting = mgrId ? emps.filter((e: any) => e.empId !== mgrId) : emps;
                group.subGroups = buildNested(forNesting, depth + 1);
              }
            });
          };
          applySubLevels(dmTree);
        }
        return dmTree;
      }
      // Team criterion: flat segments + service lines
      if (criterion === "team") {
        const teamGroups = groupByTeamHierarchy(employees);
        if (depth + 1 < groupingLevels.length) {
          teamGroups.forEach((group) => {
            group.subGroups = buildNested(group.employees, depth + 1);
          });
        }
        return teamGroups;
      }
      const groups = groupByCriterion(employees, criterion);
      const sorted = sortGroups(groups, criterion);
      if (depth + 1 < groupingLevels.length) {
        sorted.forEach((group) => {
          group.subGroups = buildNested(group.employees, depth + 1);
        });
      }
      return sorted;
    };
    return buildNested(displayedEmployees, 0);
  }, [displayedEmployees, groupingLevels]);
}
