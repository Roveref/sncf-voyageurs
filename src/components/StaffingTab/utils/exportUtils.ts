import { CATEGORY_LABELS } from "../constants";
import { getGradeTarget, fmtHD } from "../constants/theme";
import { formatLocalDate } from "./dateUtils";
import type { Employee, Assignment } from "../types";

// ─── Local shapes for export functions ────────────────────────────────────────

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

export interface ExportProject {
  jobNo: string;
  jobName: string;
  category: string;
  employees: ProjectEmployee[];
  totalHours: number;
  totalUtilization: number;
  earliestStart: string;
  latestEnd: string;
  hasProvisional: boolean;
  employeeCount: number;
  avgUtilization: number;
}

export interface ExportAlert {
  type: string;
  severity: string;
  employee: { empId: string; name: string };
  message: string;
  value: number;
  assignment?: { jobName?: string; endDate?: string };
  [key: string]: unknown;
}

interface TeamTuStatsSummary {
  currentTU?: number;
  potentialTU?: number;
  theoreticalTU?: number;
  delta?: number;
  gainHours?: number;
}

/**
 * Export employees to Excel
 * @param {Array} employees - Employee data
 * @param {string} filename - Output filename
 */
export const exportEmployeesToExcel = async (
  employees: Employee[],
  filename: string = "staffing_export.xlsx"
): Promise<void> => {
  const XLSX = await import("xlsx");
  // Prepare employee summary data
  const summaryData = employees.map((emp) => ({
    "Employee ID": emp.empId,
    Name: emp.name,
    Projects: emp.projectCount,
    "Utilization Rate (%)": emp.trueUtilizationRate.toFixed(1),
    "Billable Hours": emp.chargeableHours.toFixed(1),
    "Billable Days": (emp.chargeableHours / 8).toFixed(1),
    "Absence Hours": (emp.absenceHours ?? 0).toFixed(1),
    "Absence Days": ((emp.absenceHours ?? 0) / 8).toFixed(1),
    "Available Hours/Day": emp.availableCapacityHours.toFixed(1),
    "Net Available Hours": (emp.netAvailableHours ?? 0).toFixed(1),
    "Net Available Days": ((emp.netAvailableHours ?? 0) / 8).toFixed(1),
  }));

  // Prepare detailed assignments data
  const assignmentsData: Record<string, unknown>[] = [];
  employees.forEach((emp) => {
    emp.assignments.forEach((assignment: Assignment) => {
      assignmentsData.push({
        "Employee ID": emp.empId,
        "Employee Name": emp.name,
        jobCode: assignment.jobNo,
        "Job Name": assignment.jobName,
        Category: CATEGORY_LABELS[assignment.category] || assignment.category,
        "Start Date": assignment.startDate,
        "End Date": assignment.endDate,
        "Utilization (%)": assignment.utilization,
        "Hours/Day": assignment.hoursPerDay.toFixed(1),
        "Working Days": assignment.workingDays,
        "Total Hours": assignment.totalHours?.toFixed(1) || "",
        Status: assignment.status,
      });
    });
  });

  // Create workbook with multiple sheets
  const workbook = XLSX.utils.book_new();

  // Add summary sheet
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Employee Summary");

  // Add assignments sheet
  const assignmentsSheet = XLSX.utils.json_to_sheet(assignmentsData);
  XLSX.utils.book_append_sheet(workbook, assignmentsSheet, "Assignments");

  // Download file
  XLSX.writeFile(workbook, filename);
};

/**
 * Export projects to Excel
 * @param {Array} projects - Project data
 * @param {string} filename - Output filename
 */
export const exportProjectsToExcel = async (
  projects: ExportProject[],
  filename: string = "projects_export.xlsx"
): Promise<void> => {
  const XLSX = await import("xlsx");
  // Prepare project summary data
  const summaryData = projects.map((project) => ({
    jobCode: project.jobNo,
    "Project Name": project.jobName,
    Category: CATEGORY_LABELS[project.category] || project.category,
    "Employee Count": project.employeeCount,
    "Total Hours": project.totalHours.toFixed(1),
    "Total Days": (project.totalHours / 8).toFixed(1),
    "Start Date": project.earliestStart,
    "End Date": project.latestEnd,
    Provisional: project.hasProvisional ? "Yes" : "No",
  }));

  // Prepare detailed employee assignments per project
  const detailData: Record<string, unknown>[] = [];
  projects.forEach((project) => {
    project.employees.forEach((emp: ProjectEmployee) => {
      emp.periods.forEach((period: ProjectPeriod) => {
        detailData.push({
          jobCode: project.jobNo,
          "Project Name": project.jobName,
          "Employee ID": emp.empId,
          "Employee Name": emp.name,
          "Start Date": period.startDate,
          "End Date": period.endDate,
          "Utilization (%)": period.utilization,
          "Hours/Day": period.hoursPerDay.toFixed(1),
          Status: period.status,
        });
      });
    });
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add summary sheet
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Project Summary");

  // Add detail sheet
  const detailSheet = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Assignment Details");

  // Download file
  XLSX.writeFile(workbook, filename);
};

/**
 * Export alerts to Excel
 * @param {Array} alerts - Alerts data
 * @param {string} filename - Output filename
 */
export const exportAlertsToExcel = async (
  alerts: ExportAlert[],
  filename: string = "alerts_export.xlsx"
): Promise<void> => {
  const XLSX = await import("xlsx");
  const alertsData = alerts.map((alert) => ({
    Type: alert.type,
    Severity: alert.severity,
    "Employee ID": alert.employee.empId,
    "Employee Name": alert.employee.name,
    Message: alert.message,
    Value: alert.value,
    "Job (if applicable)": alert.assignment?.jobName || "",
    "End Date (if applicable)": alert.assignment?.endDate || "",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(alertsData);
  XLSX.utils.book_append_sheet(workbook, sheet, "Alerts");

  XLSX.writeFile(workbook, filename);
};

/**
 * Export KPI summary report to Excel
 * @param {Array} employees - Employee data
 * @param {object} teamTuStats - Team TU statistics { currentTU, potentialTU, theoreticalTU, delta, gainHours }
 * @param {Array} alerts - Alerts data
 * @param {string} filename - Output filename
 */
export const exportKPISummaryToExcel = async (
  employees: Employee[],
  teamTuStats: TeamTuStatsSummary = {},
  alerts: ExportAlert[] = [],
  filename: string = "kpi_summary.xlsx"
): Promise<void> => {
  const XLSX = await import("xlsx");
  // getGradeTarget imported from constants/theme

  // KPI Summary sheet
  const totalEmployees = employees.length;
  const avgUtilization =
    totalEmployees > 0 ? employees.reduce((s, e) => s + e.trueUtilizationRate, 0) / totalEmployees : 0;
  const totalAvailableHours = employees.reduce((s, e) => s + e.availableCapacityHours, 0);
  const benchCount = employees.filter((e) => e.trueUtilizationRate === 0).length;
  const overloadedCount = employees.filter((e) => e.trueUtilizationRate > 100).length;
  const underutilizedCount = employees.filter((e) => e.trueUtilizationRate < getGradeTarget(e.grade)).length;
  const totalChargeableHours = employees.reduce((s, e) => s + e.chargeableHours, 0);
  const totalNetAvailableHours = employees.reduce((s, e) => s + (e.netAvailableHours || 0), 0);

  const kpiData = [
    { Indicator: "Total Employees", Value: totalEmployees },
    { Indicator: "Average Utilization", Value: `${avgUtilization.toFixed(1)}%` },
    { Indicator: "Team TU", Value: `${(teamTuStats.currentTU || 0).toFixed(1)}%` },
    { Indicator: "Potential TU", Value: `${(teamTuStats.potentialTU || 0).toFixed(1)}%` },
    { Indicator: "Theoretical Utilization", Value: `${(teamTuStats.theoreticalTU || 0).toFixed(1)}%` },
    { Indicator: "Utilization Delta (to gain)", Value: `+${(teamTuStats.delta || 0).toFixed(1)} pts` },
    { Indicator: "Hours to gain", Value: fmtHD(teamTuStats.gainHours || 0) },
    { Indicator: "Total Billable Hours", Value: fmtHD(totalChargeableHours) },
    { Indicator: "Total Net Available Hours", Value: fmtHD(totalNetAvailableHours) },
    { Indicator: "Available Capacity/Day", Value: `${totalAvailableHours.toFixed(0)}h` },
    { Indicator: "On the Bench (0%)", Value: benchCount },
    { Indicator: "Overloaded (>100%)", Value: overloadedCount },
    { Indicator: "Underutilized (< grade target)", Value: underutilizedCount },
    { Indicator: "Critical Alerts", Value: alerts.filter((a) => a.severity === "critical").length },
    { Indicator: "Warning Alerts", Value: alerts.filter((a) => a.severity === "warning").length },
  ];

  // Distribution buckets
  const buckets = {
    "Available (0%)": 0,
    "Underutilized (<50%)": 0,
    "Partial (50-80%)": 0,
    "Full (80-100%)": 0,
    "Overloaded (>100%)": 0,
  };
  employees.forEach((e) => {
    const r = e.trueUtilizationRate;
    if (r === 0) buckets["Available (0%)"]++;
    else if (r < 50) buckets["Underutilized (<50%)"]++;
    else if (r < 80) buckets["Partial (50-80%)"]++;
    else if (r <= 100) buckets["Full (80-100%)"]++;
    else buckets["Overloaded (>100%)"]++;
  });
  const distributionData = Object.entries(buckets).map(([bucket, count]) => ({
    Bucket: bucket,
    Count: count,
    Percentage: `${totalEmployees > 0 ? ((count / totalEmployees) * 100).toFixed(1) : 0}%`,
  }));

  // Grade breakdown
  const gradeGroups: Record<string, { total: number; count: number; target: number }> = {};
  employees.forEach((e) => {
    const g = e.grade || "Unassigned";
    if (!gradeGroups[g]) gradeGroups[g] = { total: 0, count: 0, target: getGradeTarget(g) };
    gradeGroups[g].total += e.trueUtilizationRate;
    gradeGroups[g].count++;
  });
  const gradeData = Object.entries(gradeGroups).map(([grade, data]) => ({
    Grade: grade,
    Headcount: data.count,
    "Avg TU (%)": (data.total / data.count).toFixed(1),
    "Target (%)": data.target,
    Gap: `${(data.total / data.count - data.target).toFixed(1)} pts`,
  }));

  // Sub-team breakdown
  const teamGroups: Record<string, { total: number; count: number; avail: number; chargeable: number }> = {};
  employees.forEach((e) => {
    const t = e.subTeam || "Unassigned";
    if (!teamGroups[t]) teamGroups[t] = { total: 0, count: 0, avail: 0, chargeable: 0 };
    teamGroups[t].total += e.trueUtilizationRate;
    teamGroups[t].count++;
    teamGroups[t].avail += e.availableCapacityHours;
    teamGroups[t].chargeable += e.chargeableHours;
  });
  const teamData = Object.entries(teamGroups).map(([team, data]) => ({
    Team: team,
    Headcount: data.count,
    "Avg TU (%)": (data.total / data.count).toFixed(1),
    "Available Capacity (h/d)": data.avail.toFixed(1),
    "Billable Hours": data.chargeable.toFixed(0),
    "Billable Days": (data.chargeable / 8).toFixed(1),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(kpiData), "KPIs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(distributionData), "Distribution");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(gradeData), "By Grade");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamData), "By Team");

  XLSX.writeFile(workbook, filename);
};

/**
 * Generate filename with date
 * @param {string} prefix - Filename prefix
 * @returns {string} - Filename with date
 */
export const generateFilename = (prefix: string): string => {
  const date = formatLocalDate(new Date());
  return `${prefix}_${date}.xlsx`;
};
