import type { Employee, WaterfallStep } from "../types";
import { getGradeColor, compareGrades, CHARGEABLE_CATS, getHoursPerDay } from "../constants";
import { getGradeTarget } from "../constants/theme";
import { getSegmentColor } from "../../Sidebars/segmentConstants";

/**
 * Compute aggregate stats for a group of employees.
 * Mutates the group object in place.
 * @param {object} group - { employees: [...] }
 */
export const computeGroupStats = (group: Record<string, any>): void => {
  if (group.employees.length === 0) return;
  group.totalAvailable = group.employees.reduce((s: number, e: Employee) => s + e.availableCapacityHours, 0);
  let grpCh = 0,
    grpNet = 0,
    grpAdj = 0,
    grpTr = 0;
  let grpGross = 0,
    grpAbs = 0,
    grpChOnly = 0,
    grpGO = 0;
  let grpIoChH = 0,
    hasIo = false;
  group.employees.forEach((e: Employee) => {
    const net = e._displayNetH || e.totalNetHours || 0;
    const ch = e._displayChH || 0;
    const tr = e._displayTrH || 0;
    grpCh += ch;
    grpNet += net;
    grpTr += tr;
    grpGross += (e.totalWorkingDaysInPeriod || 0) * getHoursPerDay(e.grade);
    grpAbs += e.totalAbsenceHoursInPeriod || 0;
    const chAll = e.totalChargeableHoursInPeriod || 0;
    const chOnly = e.totalChargeableOnlyHoursInPeriod || 0;
    grpChOnly += chOnly;
    grpGO += Math.max(0, chAll - chOnly);
    const tgt = getGradeTarget(e.grade);
    const tu = net > 0 ? (ch / net) * 100 : 0;
    grpAdj += tu < tgt ? (tgt / 100) * net : ch;
    if (e._ioTU != null) {
      hasIo = true;
      grpIoChH += (e._ioTU / 100) * net;
    }
  });
  group.potentialDelta = grpNet > 0 ? ((grpAdj - grpCh) / grpNet) * 100 : 0;
  group.potentialGainH = grpAdj - grpCh;
  group.weightedTU = grpNet > 0 ? (grpCh / grpNet) * 100 : 0;
  group.weightedTO = grpNet > 0 ? ((grpCh + grpTr) / grpNet) * 100 : 0;
  // Sanitize NaN (can occur if upstream data has non-numeric values)
  if (isNaN(group.weightedTU)) group.weightedTU = 0;
  if (isNaN(group.weightedTO)) group.weightedTO = 0;
  if (isNaN(group.potentialDelta)) group.potentialDelta = 0;
  group.totalNetH = grpNet;
  group.totalChH = grpCh;
  group.totalTrainingH = grpTr;
  group.totalDispoH = Math.max(0, grpNet - grpCh - grpTr);
  group.totalGrossH = grpGross;
  group.totalAbsH = grpAbs;
  group.totalChOnlyH = grpChOnly;
  group.totalGOH = grpGO;
  group.ioTU = hasIo && grpNet > 0 ? (grpIoChH / grpNet) * 100 : null;
};

/**
 * Build waterfall chart steps from hour breakdowns.
 * @returns {Array} Steps for the waterfall chart
 */
export const buildWaterfallSteps = (
  grossH: number,
  absH: number,
  netH: number,
  chOnlyH: number,
  goH: number,
  trH: number
): WaterfallStep[] => {
  if (grossH <= 0) return [];
  const steps: WaterfallStep[] = [];
  let running = grossH;
  steps.push({ label: "Total", value: grossH, offset: 0, type: "result", color: "#d1d5db" });
  if (absH > 0) {
    running -= absH;
    steps.push({ label: "− Absences", value: absH, offset: running, type: "sub", color: "#fb7185", tc: "#fb7185" });
  }
  steps.push({ label: "= Net", value: running, offset: 0, type: "result", color: "#d1d5db" });
  if (chOnlyH > 0) {
    running -= chOnlyH;
    steps.push({
      label: "− Chargeable",
      value: chOnlyH,
      offset: running,
      type: "sub",
      color: "#60a5fa",
      tc: "#60a5fa",
    });
  }
  if (goH > 0) {
    running -= goH;
    steps.push({ label: "− Gen. Oppty", value: goH, offset: running, type: "sub", color: "#22d3ee", tc: "#22d3ee" });
  }
  if (trH > 0) {
    running -= trH;
    steps.push({ label: "− Training", value: trH, offset: running, type: "sub", color: "#34d399", tc: "#34d399" });
  }
  steps.push({
    label: "= Available",
    value: Math.max(0, running),
    offset: 0,
    type: "result",
    color: "#34d399",
    tc: "#34d399",
  });
  return steps;
};

/**
 * Group employees by a given criterion (grade, subTeam, or project).
 * @param {Array} employees
 * @param {string} criterion - 'grade' | 'subTeam' | 'project'
 * @returns {object} Groups keyed by criterion value
 */
export const groupByCriterion = (employees: Employee[], criterion: string): Record<string, any> => {
  const groups: Record<string, any> = {};
  if (criterion === "project") {
    employees.forEach((emp) => {
      const empProjects = emp.assignments
        ? [...new Set(emp.assignments.filter((a) => CHARGEABLE_CATS.has(a.category)).map((a) => a.jobName))]
        : [];
      if (empProjects.length === 0) {
        const key = "No billable project";
        if (!groups[key]) groups[key] = { name: key, employees: [] };
        groups[key].employees.push(emp);
      } else {
        empProjects.forEach((proj) => {
          if (!groups[proj]) groups[proj] = { name: proj, employees: [] };
          groups[proj].employees.push(emp);
        });
      }
    });
  } else {
    employees.forEach((emp) => {
      const key =
        criterion === "grade"
          ? emp.grade
          : criterion === "dm"
            ? emp.directManager || "No Manager"
            : criterion === "segment"
              ? emp.subTeam || "Unassigned"
              : criterion === "serviceLine"
                ? emp.serviceLine || "Unassigned"
                : emp.subTeam;
      if (!groups[key]) groups[key] = { name: key || "Unassigned", employees: [] };
      groups[key].employees.push(emp);
    });
  }
  (Object.values(groups) as Record<string, any>[]).forEach(computeGroupStats);
  return groups;
};

/**
 * Sort groups based on criterion.
 * @param {object} groups
 * @param {string} criterion
 * @returns {Array} Sorted array of group objects
 */
export const sortGroups = (groups: Record<string, any>, criterion: string): Record<string, any>[] => {
  if (criterion === "project") {
    return Object.values(groups).sort(
      (a, b) => b.employees.length - a.employees.length || a.name.localeCompare(b.name)
    );
  }
  if (criterion === "grade") {
    return Object.keys(groups)
      .sort(compareGrades)
      .map((k) => groups[k]);
  }
  return Object.keys(groups)
    .sort()
    .map((k) => groups[k]);
};

/**
 * Build a recursive DM hierarchy tree.
 * Each manager becomes a group. Direct reports who are managers become subGroups.
 * Direct reports who are NOT managers (leaf employees) are stored in `employees`.
 * The manager themselves is also included in `employees`.
 * Stats (`weightedTU`, etc.) are computed from ALL descendants.
 * @param {Array} employees - All employees to include in the tree
 * @returns {Array} Sorted array of root-level group objects with recursive subGroups
 */
export const groupByDMHierarchy = (employees: Employee[]): Record<string, any>[] => {
  const byName = new Map<string, Employee>();
  employees.forEach((emp) => {
    if (!byName.has(emp.name)) byName.set(emp.name, emp);
  });

  // Build manager→direct reports map
  const reportsByManager = new Map<string, Employee[]>();
  const hasManagerInList = new Set<string>(); // empIds whose DM is in the list
  employees.forEach((emp) => {
    if (!emp.directManager || !byName.has(emp.directManager)) return;
    if (!reportsByManager.has(emp.directManager)) reportsByManager.set(emp.directManager, []);
    reportsByManager.get(emp.directManager)!.push(emp);
    hasManagerInList.add(emp.empId);
  });

  // Collect ALL descendants (for stats computation)
  const collectAllDescendants = (managerName: string, seen: Set<string>): Employee[] => {
    const reports = reportsByManager.get(managerName) || [];
    const all: Employee[] = [];
    reports.forEach((r) => {
      if (seen.has(r.empId)) return;
      seen.add(r.empId);
      all.push(r);
      all.push(...collectAllDescendants(r.name, seen));
    });
    return all;
  };

  // Build recursive group for a manager (with cycle + depth protection)
  const buildGroupVisited = new Set<string>();
  const buildGroup = (managerName: string, depth = 0): Record<string, any> | null => {
    if (buildGroupVisited.has(managerName) || depth > 20) return null; // Cycle or depth limit
    buildGroupVisited.add(managerName);
    const directReports = reportsByManager.get(managerName) || [];
    if (directReports.length === 0) {
      buildGroupVisited.delete(managerName);
      return null;
    }

    const managerEmp = byName.get(managerName);
    const allDescendants = collectAllDescendants(managerName, new Set());
    // Stats employees = manager + all descendants
    const statsEmployees = managerEmp ? [managerEmp, ...allDescendants] : [...allDescendants];

    // Separate direct reports into sub-managers and leaf employees
    const subManagerGroups: Record<string, any>[] = [];
    const leafEmployees: Employee[] = [];
    const seenSubManagers = new Set<string>();

    directReports.forEach((report) => {
      const childGroup = buildGroup(report.name, depth + 1);
      if (childGroup) {
        // Deduplicate sub-managers (grade-split employees share the same name)
        if (!seenSubManagers.has(report.name)) {
          seenSubManagers.add(report.name);
          subManagerGroups.push(childGroup);
        }
      } else {
        leafEmployees.push(report);
      }
    });

    // Group employees = manager + leaf employees (shown as EmployeeRows)
    const displayEmployees = managerEmp ? [managerEmp, ...leafEmployees] : [...leafEmployees];

    const group: Record<string, any> = {
      name: managerName,
      employees: statsEmployees, // all descendants for stats
      _dmHierarchy: true,
      _leafEmployees: displayEmployees, // manager + leaf reports for display
      _managerEmp: managerEmp || null, // manager employee for grade lookup
    };
    computeGroupStats(group);

    if (subManagerGroups.length > 0) {
      group.subGroups = subManagerGroups;
    }

    return group;
  };

  // Root managers: employees not managed by anyone in the list, who have reports
  const roots = employees.filter((emp) => !hasManagerInList.has(emp.empId) && reportsByManager.has(emp.name));

  // Orphans: employees with no DM in the list and not a manager
  const orphans = employees.filter((emp) => !hasManagerInList.has(emp.empId) && !reportsByManager.has(emp.name));

  const result: Record<string, any>[] = [];
  const seenRoots = new Set<string>();

  roots.forEach((root) => {
    if (seenRoots.has(root.name)) return;
    seenRoots.add(root.name);
    const group = buildGroup(root.name);
    if (group) result.push(group);
  });

  if (orphans.length > 0) {
    const orphanGroup: Record<string, any> = { name: "No Manager", employees: orphans, _renderFlat: true };
    computeGroupStats(orphanGroup);
    result.push(orphanGroup);
  }

  return result;
};

/**
 * Build flat team grouping: Segment groups first, then Service Line groups.
 * An employee belongs to either a segment OR a service line (mutually exclusive).
 * Employees with neither go into "Non défini".
 */
export const groupByTeamHierarchy = (employees: Employee[]): Record<string, any>[] => {
  const segmentGroups: Record<string, Employee[]> = {};
  const slGroups: Record<string, Employee[]> = {};
  const unassigned: Employee[] = [];

  employees.forEach((emp) => {
    const seg = emp.subTeam || "";
    const sl = emp.serviceLine || "";
    if (seg) {
      if (!segmentGroups[seg]) segmentGroups[seg] = [];
      segmentGroups[seg].push(emp);
    } else if (sl) {
      if (!slGroups[sl]) slGroups[sl] = [];
      slGroups[sl].push(emp);
    } else {
      unassigned.push(emp);
    }
  });

  const result: Record<string, any>[] = [];

  // Segment groups first
  Object.keys(segmentGroups)
    .sort()
    .forEach((seg) => {
      const group: Record<string, any> = { name: seg, employees: segmentGroups[seg], _teamType: "segment" };
      computeGroupStats(group);
      result.push(group);
    });

  // Then service line groups
  Object.keys(slGroups)
    .sort()
    .forEach((sl) => {
      const group: Record<string, any> = { name: sl, employees: slGroups[sl], _teamType: "serviceLine" };
      computeGroupStats(group);
      result.push(group);
    });

  // Unassigned at the end
  if (unassigned.length > 0) {
    const group: Record<string, any> = { name: "Unassigned", employees: unassigned };
    computeGroupStats(group);
    result.push(group);
  }

  return result;
};

/**
 * Get hex color values for a group based on criterion.
 * @param {string} name - Group name
 * @param {string} criterion - 'grade' | 'subTeam' | 'project'
 * @returns {{ bg: string, text: string }}
 */
export const getGroupColors = (
  name: string,
  criterion: string,
  group?: Record<string, any>
): { bg: string; text: string } => {
  if (criterion === "grade") return getGradeColor(name);
  if (criterion === "project") return { bg: "#f2edeb", text: "#5C4A3F" };
  if (criterion === "dm") return { bg: "#eef2ff", text: "#3730a3" };
  if (criterion === "team") {
    if (group?._teamType === "serviceLine") return { bg: "#f0fdf4", text: "#166534" };
    const hex = getSegmentColor(name);
    return { bg: hex + "1A", text: hex };
  }
  if (criterion === "segment") {
    const hex = getSegmentColor(name);
    return { bg: hex + "1A", text: hex };
  }
  if (criterion === "serviceLine") return { bg: "#f0fdf4", text: "#166534" };
  return { bg: "#f3f4f6", text: "#374151" };
};
