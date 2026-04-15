/**
 * managerHierarchy — Generate pseudo-manager hierarchy from employees.
 * In production, this would come from HR data.
 */

import { compareGrades, isMoreSenior } from "../../constants";

export const generateManagerHierarchy = (employees: any) => {
  const managers: Record<string, any> = {};
  const managerGrades = ["Partner", "Director", "Senior Manager", "Manager"];

  // First, identify all potential managers
  employees.forEach((emp: any) => {
    if (managerGrades.includes(emp.grade)) {
      managers[emp.empId] = {
        ...emp,
        directReports: [],
        allReports: [],
        isManager: true,
      };
    }
  });

  // Assign direct reports based on sub-team and grade hierarchy
  const managerIds = Object.keys(managers);

  employees.forEach((emp: any) => {
    if (managers[emp.empId]) return;

    const suitableManagers = managerIds.filter((mId) => {
      const manager = managers[mId];
      return manager.subTeam === emp.subTeam && isMoreSenior(manager.grade, emp.grade);
    });

    if (suitableManagers.length > 0) {
      const sortedManagers = suitableManagers.sort((a, b) => compareGrades(managers[b].grade, managers[a].grade));
      const managerId = sortedManagers[0];
      managers[managerId].directReports.push(emp.empId);
      managers[managerId].allReports.push(emp.empId);
    }
  });

  // Build hierarchy (managers reporting to higher managers)
  const managersList = Object.values(managers);
  managersList.forEach((manager) => {
    const higherManagers = managersList.filter(
      (m) => m.empId !== manager.empId && m.subTeam === manager.subTeam && isMoreSenior(m.grade, manager.grade)
    );

    if (higherManagers.length > 0) {
      const sortedHigher = higherManagers.sort((a, b) => compareGrades(b.grade, a.grade));
      const reportsTo = sortedHigher[0];
      reportsTo.directReports.push(manager.empId);
      reportsTo.allReports.push(manager.empId, ...manager.allReports);
    }
  });

  return managers;
};
