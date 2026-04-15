/**
 * Server-side employee enrichment — replaces the client-side useDataPipeline.
 *
 * Reads raw data from SQLite, builds enriched Employee objects with:
 * - Consolidated assignments + normalized periods
 * - Metadata merge (grade history, arrival/departure)
 * - SAP grade detection (MAGR → grade)
 * - Skills enrichment
 * - Manager hierarchy
 * - Search index
 *
 * Returns pre-built data ready for the StaffingTab to display.
 */

import db from "../../db/database.js";
import {
  loadEmployees,
  loadAssignments,
  loadSkills,
  indexByEmpId,
  getEffectiveGrade,
  hpd,
  eachWorkday,
  type EmployeeRow,
  type AssignmentRow,
  type SkillRow,
  type GradeTransition,
} from "./shared.js";
import {
  MAGR_TO_GRADE,
  GRADE_ORDER,
  UNKNOWN_GRADE,
  ABSENCE_CATS,
  CHARGEABLE_CATS,
  GO_CATS,
  TRAINING_CATS,
} from "../../../../shared/staffingConstants.js";

// ── Types (match frontend Employee shape for JSON serialization) ──

interface EnrichedEmployee {
  empId: string;
  name: string;
  grade: string;
  subTeam: string;
  serviceLine: string;
  directManager: string;
  assignments: EnrichedAssignment[];
  projects: string[]; // Set serialized as Array
  projectCount: number;
  chargeableHours: number;
  trueUtilizationRate: number;
  availableCapacityHours: number;
  _consolidated: ConsolidatedAssignment[];
  _periods: NormalizedPeriod[];
  _searchIndex: string;
  _arrivalDate?: string | null;
  _departureDate?: string | null;
  _gradeHistory?: GradeTransition[];
  _gradeTransition?: { from: string; to: string; since: string };
  _isRecruit?: boolean;
  _sapProjects?: { name: string; code: string; minDate: string; maxDate: string }[];
  skills?: any[];
  skillsByCategory?: Record<string, any[]>;
  topSkills?: any[];
  skillCount?: number;
  avgSkillLevel?: number;
}

interface EnrichedAssignment {
  jobNo: string;
  jobName: string;
  category: string;
  startDate: string;
  endDate: string;
  utilization: number;
  hoursPerDay: number;
}

interface ConsolidatedAssignment {
  jobNo: string;
  jobName: string;
  category: string;
  startDate: string;
  endDate: string;
  utilization: number;
  hoursPerDay: number;
}

interface NormalizedPeriod {
  start: number; // timestamp
  end: number;
  util: number;
  category: string;
  jobNo: string;
  jobName: string;
  hoursPerDay: number;
}

interface ManagerInfo {
  name: string;
  empId: string;
  reportIds: string[];
}

export interface EnrichmentResult {
  employees: EnrichedEmployee[];
  managerList: ManagerInfo[];
  stats: {
    totalEmployees: number;
    withSap: number;
    enrichmentMs: number;
  };
}

// ── Helpers ──

function consolidateAssignments(assignments: EnrichedAssignment[]): ConsolidatedAssignment[] {
  if (assignments.length === 0) return [];
  const sorted = [...assignments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const result: ConsolidatedAssignment[] = [];
  let current = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (
      next.jobNo === current.jobNo &&
      next.category === current.category &&
      Math.abs(next.utilization - current.utilization) < 0.01 &&
      next.startDate <= current.endDate
    ) {
      if (next.endDate > current.endDate) current.endDate = next.endDate;
    } else {
      result.push(current);
      current = { ...next };
    }
  }
  result.push(current);
  return result;
}

function normalizePeriods(consolidated: ConsolidatedAssignment[]): NormalizedPeriod[] {
  return consolidated.map((c) => ({
    start: new Date(c.startDate + "T00:00:00").getTime(),
    end: new Date(c.endDate + "T23:59:59").getTime(),
    util: c.utilization,
    category: c.category,
    jobNo: c.jobNo,
    jobName: c.jobName,
    hoursPerDay: c.hoursPerDay,
  }));
}

function stripCivility(name: string): string {
  return name.replace(/^(M\.|Mme|Mlle|Mr|Mrs|Ms|Dr)\s+/i, "").trim();
}

function detectGradeTransition(
  gradeHistory: GradeTransition[],
  currentGrade: string,
  today: string
): { from: string; to: string; since: string } | undefined {
  const sorted = [...gradeHistory].filter((t) => t.since && t.grade).sort((a, b) => a.since.localeCompare(b.since));
  const next = sorted.find((t) => t.since > today);
  if (next && next.grade !== currentGrade) return { from: currentGrade, to: next.grade, since: next.since };
  return undefined;
}

// ── Main enrichment function ──

export function buildEnrichedEmployees(): EnrichmentResult {
  const t0 = Date.now();

  const empRows = loadEmployees();
  const assRows = loadAssignments();
  const skillRows = loadSkills();

  const assByEmp = indexByEmpId(assRows);
  const skillsByEmp = indexByEmpId(skillRows);

  // Load SAP data for grade detection
  const sapGrades = new Map<string, { grade: string; gradeHistory: GradeTransition[] }>();
  try {
    const sapRows = db
      .prepare(
        "SELECT DISTINCT empId, activityType, date FROM sap_records WHERE activityType IS NOT NULL ORDER BY empId, date"
      )
      .all() as { empId: string; activityType: string; date: string }[];

    const byEmp = new Map<string, { type: string; date: string }[]>();
    for (const r of sapRows) {
      const arr = byEmp.get(r.empId) || [];
      arr.push({ type: r.activityType, date: r.date });
      byEmp.set(r.empId, arr);
    }

    for (const [empId, records] of byEmp) {
      const history: GradeTransition[] = [];
      let lastGrade = "";
      for (const r of records) {
        const grade = MAGR_TO_GRADE[r.type];
        if (grade && grade !== lastGrade) {
          history.push({ grade, since: r.date });
          lastGrade = grade;
        }
      }
      if (history.length > 0) {
        sapGrades.set(empId, { grade: history[history.length - 1].grade, gradeHistory: history });
      }
    }
  } catch {
    /* SAP data optional */
  }

  // Load SAP project info for search enrichment
  const sapProjectsByEmp = new Map<string, { name: string; code: string; minDate: string; maxDate: string }[]>();
  try {
    const projRows = db
      .prepare(
        "SELECT empId, salesOrder, text, MIN(date) as minDate, MAX(date) as maxDate FROM sap_records WHERE salesOrder IS NOT NULL AND salesOrder != '' GROUP BY empId, salesOrder"
      )
      .all() as { empId: string; salesOrder: string; text: string; minDate: string; maxDate: string }[];

    for (const r of projRows) {
      const arr = sapProjectsByEmp.get(r.empId) || [];
      arr.push({ name: r.text || r.salesOrder, code: r.salesOrder, minDate: r.minDate, maxDate: r.maxDate });
      sapProjectsByEmp.set(r.empId, arr);
    }
  } catch {
    /* optional */
  }

  const today = new Date().toISOString().slice(0, 10);
  const employees: EnrichedEmployee[] = [];

  for (const emp of empRows) {
    const rawAssignments = assByEmp.get(emp.empId) || [];
    const assignments: EnrichedAssignment[] = rawAssignments.map((a) => ({
      jobNo: a.jobNo,
      jobName: a.jobName,
      category: a.category,
      startDate: a.startDate,
      endDate: a.endDate,
      utilization: a.utilization,
      hoursPerDay: a.hoursPerDay || hpd(emp.grade),
    }));

    const consolidated = consolidateAssignments(assignments);
    const periods = normalizePeriods(consolidated);
    const projects = new Set<string>();
    for (const a of assignments) {
      if (CHARGEABLE_CATS.has(a.category) || GO_CATS.has(a.category)) {
        projects.add(a.jobName || a.jobNo);
      }
    }

    // Grade resolution: manual gradeHistory > SAP-detected > employees table
    let grade = emp.grade || UNKNOWN_GRADE;
    let gradeHistory = emp.gradeHistory;
    let gradeTransition: { from: string; to: string; since: string } | undefined;

    if (gradeHistory && gradeHistory.length > 0) {
      const effective = getEffectiveGrade(gradeHistory, today);
      if (effective) grade = effective;
      gradeTransition = detectGradeTransition(gradeHistory, grade, today);
    } else {
      const sapG = sapGrades.get(emp.empId);
      if (sapG) {
        const effective = getEffectiveGrade(sapG.gradeHistory, today);
        grade = effective || sapG.grade;
        gradeHistory = sapG.gradeHistory;
        if (sapG.gradeHistory.length > 1) {
          gradeTransition = detectGradeTransition(sapG.gradeHistory, grade, today);
        }
      }
    }

    // Skills
    const empSkills = skillsByEmp.get(emp.empId);
    let skills: any[] | undefined;
    let skillsByCategory: Record<string, any[]> | undefined;
    let skillCount: number | undefined;
    let avgSkillLevel: number | undefined;
    if (empSkills && empSkills.length > 0) {
      skills = empSkills.map((s) => ({
        skillShort: s.name,
        skillFull: s.name,
        category: s.category,
        level: s.level,
        active: true,
      }));
      skillsByCategory = {};
      for (const s of skills) {
        (skillsByCategory[s.category] ||= []).push(s);
      }
      skillCount = skills.length;
      avgSkillLevel = skills.reduce((sum, s) => sum + s.level, 0) / skills.length;
    }

    // Search index
    const cleanName = stripCivility(emp.name);
    let searchIndex = `${cleanName}\t${emp.empId}\t${grade}\t${emp.subTeam}\t${emp.serviceLine}`.toLowerCase();
    for (const a of assignments) {
      searchIndex += `\t${a.jobName}\t${a.jobNo}`.toLowerCase();
    }
    if (skills) {
      searchIndex +=
        "\t" +
        skills
          .map((s) => `${s.skillShort}\t${s.skillFull}`)
          .join("\t")
          .toLowerCase();
    }
    const sapProjects = sapProjectsByEmp.get(emp.empId);
    if (sapProjects) {
      searchIndex +=
        "\t" +
        sapProjects
          .map((p) => `${p.name}\t${p.code}`)
          .join("\t")
          .toLowerCase();
    }

    employees.push({
      empId: emp.empId,
      name: cleanName,
      grade,
      subTeam: emp.subTeam || "",
      serviceLine: emp.serviceLine || "",
      directManager: "",
      assignments,
      projects: Array.from(projects),
      projectCount: projects.size,
      chargeableHours: 0,
      trueUtilizationRate: 0,
      availableCapacityHours: 0,
      _consolidated: consolidated,
      _periods: periods,
      _searchIndex: searchIndex,
      _arrivalDate: emp.arrival || null,
      _departureDate: emp.departure || null,
      _gradeHistory: gradeHistory,
      _gradeTransition: gradeTransition,
      _sapProjects: sapProjects,
      skills,
      skillsByCategory,
      skillCount,
      avgSkillLevel,
    });
  }

  // Build manager hierarchy
  const managerList: ManagerInfo[] = [];
  const empByName = new Map<string, EnrichedEmployee>();
  for (const e of employees) empByName.set(e.name, e);

  // Manager = employee referenced by other employees' managerId in DB
  const mgrQuery = db
    .prepare(
      "SELECT DISTINCT e2.empId, e2.name FROM employees e1 JOIN employees e2 ON e1.managerId = e2.empId WHERE e1.managerId IS NOT NULL"
    )
    .all() as { empId: string; name: string }[];

  for (const mgr of mgrQuery) {
    const reports = db.prepare("SELECT empId FROM employees WHERE managerId = ?").all(mgr.empId) as { empId: string }[];
    const reportIds = reports.map((r) => r.empId);
    managerList.push({ name: mgr.name, empId: mgr.empId, reportIds });

    // Set directManager on subordinates
    for (const rid of reportIds) {
      const emp = employees.find((e) => e.empId === rid);
      if (emp && !emp.directManager) emp.directManager = mgr.name;
    }
  }

  const enrichmentMs = Date.now() - t0;
  const sapCount = sapGrades.size;

  return {
    employees,
    managerList,
    stats: {
      totalEmployees: employees.length,
      withSap: sapCount,
      enrichmentMs,
    },
  };
}
