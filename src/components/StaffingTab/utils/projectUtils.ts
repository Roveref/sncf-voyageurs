import type { Employee } from "../types";
import { CHARGEABLE_CATS, MS_PER_DAY } from "../constants";

// ─── Local shapes ────────────────────────────────────────────────────────────

interface ProjectPeriod {
  startDate: string;
  endDate: string;
  utilization: number;
  hoursPerDay: number;
  status: string;
}

interface ProjectEmployee {
  empId: string;
  name: string;
  periods: ProjectPeriod[];
  totalHours: number;
}

interface ProjectRecord {
  jobNo: string;
  jobName: string;
  category: string;
  employees: ProjectEmployee[];
  totalHours: number;
  totalUtilization: number;
  earliestStart: string;
  latestEnd: string;
  hasProvisional: boolean;
  employeeCount?: number;
  avgUtilization?: number;
  daysUntilEnd?: number;
}

/** Looser shape accepted by stats/filter utilities — only the fields they actually access. */
interface ProjectLike {
  jobNo?: string;
  jobName?: string;
  category?: string;
  employees?: { empId: string }[];
  totalHours?: number;
  employeeCount?: number;
  latestEnd?: string;
  daysUntilEnd?: number;
  [key: string]: unknown;
}

/**
 * Extract projects from employee data
 * @param {Array} employees - Enhanced Gantt data
 * @returns {Array} - Array of project objects with assigned employees
 */
export const extractProjects = (employees: Employee[]): ProjectRecord[] => {
  const projects: Record<string, ProjectRecord> = {};

  employees.forEach((employee) => {
    employee.assignments.forEach((assignment) => {
      const projectKey = assignment.jobNo || assignment.jobName;

      if (!projects[projectKey]) {
        projects[projectKey] = {
          jobNo: assignment.jobNo,
          jobName: assignment.jobName,
          category: assignment.category,
          employees: [],
          totalHours: 0,
          totalUtilization: 0,
          earliestStart: assignment.startDate,
          latestEnd: assignment.endDate,
          hasProvisional: false,
        };
      }

      // Add employee to project
      const existingEmployee = projects[projectKey].employees.find((e: ProjectEmployee) => e.empId === employee.empId);

      if (existingEmployee) {
        existingEmployee.periods.push({
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          utilization: assignment.utilization,
          hoursPerDay: assignment.hoursPerDay,
          status: assignment.status,
        });
        existingEmployee.totalHours += assignment.totalHours || 0;
      } else {
        projects[projectKey].employees.push({
          empId: employee.empId,
          name: employee.name,
          periods: [
            {
              startDate: assignment.startDate,
              endDate: assignment.endDate,
              utilization: assignment.utilization,
              hoursPerDay: assignment.hoursPerDay,
              status: assignment.status,
            },
          ],
          totalHours: assignment.totalHours || 0,
        });
      }

      // Update project metrics
      projects[projectKey].totalHours += assignment.totalHours || 0;
      projects[projectKey].totalUtilization += assignment.utilization || 0;

      // Update date ranges
      if (new Date(assignment.startDate).getTime() < new Date(projects[projectKey].earliestStart).getTime()) {
        projects[projectKey].earliestStart = assignment.startDate;
      }
      if (new Date(assignment.endDate).getTime() > new Date(projects[projectKey].latestEnd).getTime()) {
        projects[projectKey].latestEnd = assignment.endDate;
      }

      if (assignment.status === "P") {
        projects[projectKey].hasProvisional = true;
      }
    });
  });

  // Convert to array and calculate averages
  return Object.values(projects)
    .map((project: ProjectRecord) => ({
      ...project,
      employeeCount: project.employees.length,
      avgUtilization: project.employees.length > 0 ? project.totalUtilization / project.employees.length : 0,
    }))
    .sort((a, b) => {
      // Sort by category (chargeable first), then by employee count
      if (CHARGEABLE_CATS.has(a.category) && !CHARGEABLE_CATS.has(b.category)) return -1;
      if (!CHARGEABLE_CATS.has(a.category) && CHARGEABLE_CATS.has(b.category)) return 1;
      return b.employeeCount - a.employeeCount;
    });
};

/**
 * Get project statistics
 * @param {Array} projects - Array of projects
 * @returns {object} - Project statistics
 */
export const getProjectStats = (projects: ProjectLike[]): Record<string, number> => {
  const chargeableProjects = projects.filter((p) => p.category && CHARGEABLE_CATS.has(p.category));

  return {
    totalProjects: projects.length,
    chargeableProjects: chargeableProjects.length,
    totalEmployeesAssigned: new Set(projects.flatMap((p) => (p.employees ?? []).map((e) => e.empId))).size,
    totalHours: projects.reduce((sum, p) => sum + (p.totalHours ?? 0), 0),
    avgEmployeesPerProject:
      projects.length > 0 ? projects.reduce((sum, p) => sum + (p.employeeCount ?? 0), 0) / projects.length : 0,
  };
};

/**
 * Get projects ending soon
 * @param {Array} projects - Array of projects
 * @param {number} daysThreshold - Days threshold (default: 30)
 * @returns {Array} - Projects ending within threshold
 */
export const getProjectsEndingSoon = (projects: ProjectLike[], daysThreshold: number = 30): ProjectLike[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return projects
    .filter((project) => {
      if (!project.latestEnd) return false;
      const endDate = new Date(project.latestEnd);
      const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / MS_PER_DAY);
      return daysUntilEnd >= 0 && daysUntilEnd <= daysThreshold;
    })
    .map((project) => {
      const endDate = new Date(project.latestEnd!);
      const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / MS_PER_DAY);
      return { ...project, daysUntilEnd };
    })
    .sort((a, b) => (a.daysUntilEnd ?? 0) - (b.daysUntilEnd ?? 0));
};

/**
 * Search projects by name or job number
 * @param {Array} projects - Array of projects
 * @param {string} query - Search query
 * @returns {Array} - Filtered projects
 */
export const searchProjects = (projects: ProjectLike[], query: string): ProjectLike[] => {
  if (!query || query.trim() === "") return projects;

  const lowerQuery = query.toLowerCase().trim();
  return projects.filter(
    (project) =>
      (project.jobName?.toLowerCase() ?? "").includes(lowerQuery) ||
      (project.jobNo && project.jobNo.toLowerCase().includes(lowerQuery))
  );
};
