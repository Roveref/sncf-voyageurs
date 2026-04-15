import type { Employee } from "../types";
import { CHARGEABLE_CATS, MS_PER_DAY } from "../constants";
import { getGradeTarget } from "../constants/theme";

/**
 * Alert thresholds configuration
 */
export const ALERT_THRESHOLDS = {
  OVERLOAD: 100, // > 100% utilization
  UNDERUTILIZATION: 50, // < 50% utilization (fallback, now grade-aware)
  END_MISSION_DAYS: [7, 14, 30], // Days before mission ends
};

/**
 * Alert types
 */
export const ALERT_TYPES = {
  OVERLOAD: "overload",
  UNDERUTILIZATION: "underutilization",
  END_MISSION_SOON: "end_mission_soon",
  NO_ASSIGNMENT: "no_assignment",
  HIGH_AVAILABILITY: "high_availability",
};

/**
 * Alert severity levels
 */
export const ALERT_SEVERITY = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
};

/**
 * Generate alerts for employees
 * @param {Array} employees - Enhanced Gantt data
 * @param {Date} referenceDate - Reference date for calculations (default: today)
 * @returns {Array} - Array of alert objects
 */
export const generateAlerts = (employees: Employee[], referenceDate: Date = new Date()): Record<string, any>[] => {
  const alerts: Record<string, any>[] = [];
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  employees.forEach((employee) => {
    // Check for overload (> 100%)
    if (employee.trueUtilizationRate > ALERT_THRESHOLDS.OVERLOAD) {
      alerts.push({
        type: ALERT_TYPES.OVERLOAD,
        severity: ALERT_SEVERITY.CRITICAL,
        employee: {
          empId: employee.empId,
          name: employee.name,
        },
        message: `${employee.name} is overloaded at ${employee.trueUtilizationRate.toFixed(1)}%`,
        value: employee.trueUtilizationRate,
      });
    }

    // Check for underutilization (grade-aware: below grade target)
    const gradeTarget = getGradeTarget(employee.grade);
    if (employee.trueUtilizationRate < gradeTarget && employee.trueUtilizationRate > 0) {
      const gap = gradeTarget - employee.trueUtilizationRate;
      const severity = gap > 30 ? ALERT_SEVERITY.WARNING : ALERT_SEVERITY.INFO;
      alerts.push({
        type: ALERT_TYPES.UNDERUTILIZATION,
        severity,
        employee: {
          empId: employee.empId,
          name: employee.name,
        },
        message: `${employee.name} is underutilized at ${employee.trueUtilizationRate.toFixed(1)}% (target ${gradeTarget}% for ${employee.grade || "this grade"})`,
        value: employee.trueUtilizationRate,
        gradeTarget,
      });
    }

    // Check for high availability (> 4h/day available)
    if (employee.availableCapacityHours > 4) {
      alerts.push({
        type: ALERT_TYPES.HIGH_AVAILABILITY,
        severity: ALERT_SEVERITY.INFO,
        employee: {
          empId: employee.empId,
          name: employee.name,
        },
        message: `${employee.name} has ${employee.availableCapacityHours.toFixed(1)}h (${(employee.availableCapacityHours / 8).toFixed(2)}d) available per day`,
        value: employee.availableCapacityHours,
      });
    }

    // Check for no chargeable assignments
    const hasChargeableAssignment = employee.assignments.some((a) => CHARGEABLE_CATS.has(a.category));
    if (!hasChargeableAssignment && employee.assignments.length > 0) {
      alerts.push({
        type: ALERT_TYPES.NO_ASSIGNMENT,
        severity: ALERT_SEVERITY.WARNING,
        employee: {
          empId: employee.empId,
          name: employee.name,
        },
        message: `${employee.name} has no billable assignment`,
        value: 0,
      });
    }

    // Check for ending missions - group by job to only alert on final end date
    const chargeableAssignments = employee.assignments.filter((a) => CHARGEABLE_CATS.has(a.category));

    // Group by jobNo to find latest end date per mission
    const missionsByJob: Record<string, any> = {};
    chargeableAssignments.forEach((assignment) => {
      const jobKey = assignment.jobNo || assignment.jobName;
      if (!missionsByJob[jobKey]) {
        missionsByJob[jobKey] = {
          jobName: assignment.jobName,
          jobNo: assignment.jobNo,
          latestEndDate: new Date(assignment.endDate),
        };
      } else {
        const currentEnd = new Date(assignment.endDate);
        if (currentEnd > missionsByJob[jobKey].latestEndDate) {
          missionsByJob[jobKey].latestEndDate = currentEnd;
        }
      }
    });

    // Generate alerts for each mission's final end date
    Object.values(missionsByJob).forEach((mission) => {
      const endDate = new Date(mission.latestEndDate);
      endDate.setHours(0, 0, 0, 0);
      const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / MS_PER_DAY);

      if (daysUntilEnd >= 0 && daysUntilEnd <= 30) {
        let severity = ALERT_SEVERITY.INFO;
        if (daysUntilEnd <= 7) severity = ALERT_SEVERITY.CRITICAL;
        else if (daysUntilEnd <= 14) severity = ALERT_SEVERITY.WARNING;

        const endDateStr = endDate.toLocaleDateString("fr-FR");
        alerts.push({
          type: ALERT_TYPES.END_MISSION_SOON,
          severity,
          employee: {
            empId: employee.empId,
            name: employee.name,
          },
          assignment: {
            jobName: mission.jobName,
            jobNo: mission.jobNo,
            endDate: endDateStr,
          },
          message: `Assignment "${mission.jobName}" for ${employee.name} ends in ${daysUntilEnd} day${daysUntilEnd > 1 ? "s" : ""}`,
          value: daysUntilEnd,
        });
      }
    });
  });

  // Sort alerts by severity (critical first, then warning, then info)
  const severityOrder = { [ALERT_SEVERITY.CRITICAL]: 0, [ALERT_SEVERITY.WARNING]: 1, [ALERT_SEVERITY.INFO]: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
};

/**
 * Count alerts by type
 * @param {Array} alerts - Array of alerts
 * @returns {object} - Counts by type
 */
export const countAlertsByType = (alerts: Record<string, any>[]): Record<string, number> => {
  const counts = {
    [ALERT_TYPES.OVERLOAD]: 0,
    [ALERT_TYPES.UNDERUTILIZATION]: 0,
    [ALERT_TYPES.END_MISSION_SOON]: 0,
    [ALERT_TYPES.NO_ASSIGNMENT]: 0,
    [ALERT_TYPES.HIGH_AVAILABILITY]: 0,
  };

  alerts.forEach((alert) => {
    counts[alert.type]++;
  });

  return counts;
};

/**
 * Count alerts by severity
 * @param {Array} alerts - Array of alerts
 * @returns {object} - Counts by severity
 */
export const countAlertsBySeverity = (alerts: Record<string, any>[]): Record<string, number> => {
  const counts = {
    [ALERT_SEVERITY.CRITICAL]: 0,
    [ALERT_SEVERITY.WARNING]: 0,
    [ALERT_SEVERITY.INFO]: 0,
  };

  alerts.forEach((alert) => {
    counts[alert.severity]++;
  });

  return counts;
};

/**
 * Filter alerts by type
 * @param {Array} alerts - Array of alerts
 * @param {string} type - Alert type to filter
 * @returns {Array} - Filtered alerts
 */
export const filterAlertsByType = (alerts: Record<string, any>[], type: string): Record<string, any>[] => {
  return alerts.filter((alert) => alert.type === type);
};

/**
 * Filter alerts by severity
 * @param {Array} alerts - Array of alerts
 * @param {string} severity - Severity level to filter
 * @returns {Array} - Filtered alerts
 */
export const filterAlertsBySeverity = (alerts: Record<string, any>[], severity: string): Record<string, any>[] => {
  return alerts.filter((alert) => alert.severity === severity);
};
