import { compareGrades, isMoreSenior } from "../constants";
import type { Employee, Manager } from "../types";

/**
 * Build a hierarchical list of managers from employees.
 * Managers are employees with grade Partner, Director, Senior Manager, or Manager.
 * Non-managers are assigned to the most senior manager in their sub-team.
 */
export const buildManagerList = (employees: Employee[]): Manager[] => {
  const managerGrades = ["Partner", "Director", "Senior Manager", "Manager"];
  const managers: Record<string, Manager> = {};

  employees.forEach((emp) => {
    if (managerGrades.includes(emp.grade)) {
      managers[emp.empId] = {
        empId: emp.empId,
        name: emp.name,
        grade: emp.grade,
        subTeam: emp.subTeam,
        reportIds: new Set(),
      };
    }
  });

  const managerIds = Object.keys(managers);
  employees.forEach((emp) => {
    if (managers[emp.empId]) return;
    const suitable = managerIds.filter((mId) => {
      const mgr = managers[mId];
      return mgr.subTeam === emp.subTeam && isMoreSenior(mgr.grade, emp.grade);
    });
    if (suitable.length > 0) {
      const sorted = suitable.sort((a, b) => compareGrades(managers[b].grade, managers[a].grade));
      managers[sorted[0]].reportIds.add(emp.empId);
    }
  });

  // Managers reporting to higher managers
  const mgrList = Object.values(managers);
  mgrList.forEach((mgr) => {
    const higher = mgrList.filter(
      (m) => m.empId !== mgr.empId && m.subTeam === mgr.subTeam && isMoreSenior(m.grade, mgr.grade)
    );
    if (higher.length > 0) {
      const sorted = higher.sort((a, b) => compareGrades(b.grade, a.grade));
      sorted[0].reportIds.add(mgr.empId);
      mgr.reportIds.forEach((id) => sorted[0].reportIds.add(id));
    }
  });

  return Object.values(managers).sort((a, b) => {
    const gc = compareGrades(a.grade, b.grade);
    return gc !== 0 ? gc : a.name.localeCompare(b.name);
  });
};
