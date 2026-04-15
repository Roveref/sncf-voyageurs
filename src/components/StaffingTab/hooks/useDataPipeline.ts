import { useMemo } from "react";
import { buildEmployeeStructures, buildSapOnlyEmployees } from "../utils/dataProcessing";
import { recordGridStep } from "../utils/perf";
import { splitByGradeTransitions } from "../utils/gradeSplitUtils";
import { buildManagerList } from "../utils/managerUtils";
import { UNKNOWN_GRADE } from "../constants";
import { getEffectiveGrade } from "../types";
import type { Employee, EmployeeMetadata, SapLookup, SapEnrichment, SkillsData, StaffingRecord } from "../types";
import { getToday } from "../../../utils/formatters";
import type { RecruitmentCandidate } from "../../../types/recruitment";
import type { ManualEmployee } from "../../../stores/useUserDataStore";

/**
 * Detect the next upcoming grade transition from a grade history.
 * Returns a _gradeTransition object if a future transition exists, or undefined.
 */
function detectGradeTransition(
  gradeHistory: { since: string; grade: string }[],
  currentGrade: string,
  today: string
): { from: string; to: string; since: string } | undefined {
  const sorted = [...gradeHistory].filter((t) => t.since && t.grade).sort((a, b) => a.since.localeCompare(b.since));
  const nextTransition = sorted.find((t) => t.since > today);
  if (nextTransition && nextTransition.grade !== currentGrade) {
    return { from: currentGrade, to: nextTransition.grade, since: nextTransition.since };
  }
  return undefined;
}

/**
 * Data pipeline: raw records → employeeStructures → allEnrichedEmployees → enrichedGanttData.
 * Pure useMemos with no side effects.
 */
export function useDataPipeline(
  scenarioData: StaffingRecord[],
  enabledHolidayDates: Set<string>,
  sapLookup: SapLookup | null,
  sapEnrichment: SapEnrichment | null,
  scenarioMetadata: Record<string, EmployeeMetadata>,
  manualEmployeesFromStore: ManualEmployee[],
  hiredCandidates: RecruitmentCandidate[],
  skillsData: SkillsData | null,
  effectiveMetadata: Record<string, EmployeeMetadata>,
  timelineStart: Date,
  timelineEnd: Date
) {
  const employeeStructures = useMemo(() => {
    try {
      const t0 = performance.now();
      const staffingEmps =
        scenarioData.length > 0 ? buildEmployeeStructures(scenarioData, [...enabledHolidayDates]) : [];
      recordGridStep("buildEmployeeStructures", performance.now() - t0, `${staffingEmps.length} employees`);

      let allEmps = staffingEmps;
      if (sapLookup) {
        const existingIds = new Set(staffingEmps.map((e) => e.empId));
        const sapOnlyEmps = buildSapOnlyEmployees(sapLookup, existingIds);
        if (sapOnlyEmps.length > 0) allEmps = [...staffingEmps, ...sapOnlyEmps];
      }

      // Add manual employees (user-created) + hired recruitment candidates
      {
        const existingIds = new Set(allEmps.map((e) => e.empId));
        const addVirtualEmployee = (empId: string, name: string) => {
          if (existingIds.has(empId)) return;
          existingIds.add(empId);
          allEmps.push({
            empId,
            name,
            grade: UNKNOWN_GRADE,
            subTeam: "",
            assignments: [],
            projects: new Set(),
            projectCount: 0,
            trueUtilizationRate: 0,
            availableCapacityHours: 0,
            chargeableHours: 0,
            _consolidated: [],
            _periods: [],
            _searchIndex: name.toLowerCase(),
          } as Employee);
        };

        // User-created manual employees
        manualEmployeesFromStore.forEach((m) => addVirtualEmployee(m.empId, m.name));

        // Hired recruitment candidates — passed as reactive parameter from store
        const GRADE_BUCKET_TO_GRADE: Record<string, string> = {
          Intern: "Intern",
          Analyst: "Analyst",
          "Consultant+": "Consultant",
        };
        for (const c of hiredCandidates) {
          if (c.status !== "hired") continue;
          if (c.matchedEmpId && existingIds.has(c.matchedEmpId)) continue;
          const recruitEmpId = `recruit_${c.id}`;
          // Skip rejected candidates (user marked _rejected in metadata)
          if (scenarioMetadata[recruitEmpId]?.rejected) continue;
          const empId = `recruit_${c.id}`;
          const name = `${c.firstName} ${c.lastName}`.trim();
          addVirtualEmployee(empId, name);
          // Enrich directly — find the employee we just added
          const emp = allEmps.find((e) => e.empId === empId);
          if (emp) {
            const grade = c.gradeBucket || GRADE_BUCKET_TO_GRADE[c.grade] || "Analyst";
            emp.grade = grade;
            // Derive arrival date from latest recruiter GO date
            const dates = [c.recruiter1Date, c.recruiter2Date, c.recruiter3Date, c.hrInterviewDate]
              .filter((d) => d && d.length >= 10)
              .map((d) => d.slice(0, 10))
              .sort();
            emp._arrivalDate = dates.length > 0 ? dates[dates.length - 1] : c.lastActivity?.slice(0, 10) || "";
            // Set team from first application segment
            const firstSeg = c.applications?.find((a) => a.segment)?.segment;
            if (firstSeg) emp.subTeam = firstSeg;
            // Tag as recruited for badge display
            emp._isRecruit = true;
          }
        }
      }

      // Apply employee metadata overrides (grade, team, upcoming transition)
      if (Object.keys(scenarioMetadata).length > 0) {
        const today = getToday();
        allEmps.forEach((emp) => {
          const meta = scenarioMetadata[emp.empId];
          if (!meta) return;
          if (meta.segment) emp.subTeam = meta.segment;
          else if (meta.team) emp.subTeam = meta.team; // rétro-compat
          if (meta.serviceLine) emp.serviceLine = meta.serviceLine;
          if (meta.gradeHistory && meta.gradeHistory.length > 0) {
            const effective = getEffectiveGrade(meta.gradeHistory, today);
            if (effective) emp.grade = effective;

            // Detect upcoming grade transition (next transition with since > today)
            const transition = detectGradeTransition(meta.gradeHistory, effective ?? "", today);
            if (transition) emp._gradeTransition = transition;
          }
        });
      }

      // Apply SAP-detected grades (only if no manual gradeHistory in metadata)
      if (sapEnrichment) {
        const today = getToday();
        allEmps.forEach((emp) => {
          const hasManualGrade = scenarioMetadata[emp.empId]?.gradeHistory?.length > 0;
          if (hasManualGrade) return; // manual metadata takes priority
          const sapGrade = sapEnrichment.gradeResults[emp.empId];
          if (!sapGrade) return;
          const effective = getEffectiveGrade(sapGrade.gradeHistory, today);
          if (effective) emp.grade = effective;
          else emp.grade = sapGrade.grade; // fallback to latest
          // Detect upcoming grade transition from SAP history
          if (sapGrade.gradeHistory.length > 1) {
            const transition = detectGradeTransition(sapGrade.gradeHistory, effective || sapGrade.grade, today);
            if (transition) emp._gradeTransition = transition;
          }
        });
      }

      // Intern→Analyst: force grade back to Intern for intern empIds.
      if (sapEnrichment?.internToAnalyst) {
        for (const internId of Object.keys(sapEnrichment.internToAnalyst)) {
          const emp = allEmps.find((e) => e.empId === internId);
          if (emp) emp.grade = "Intern";
        }
      }

      // Auto-assign directManager from buildManagerList, then apply metadata DM override
      const mgrs = buildManagerList(allEmps as Employee[]);
      const empById = new Map(allEmps.map((e) => [e.empId, e]));
      mgrs.forEach((mgr) => {
        mgr.reportIds.forEach((reportId) => {
          const emp = empById.get(reportId);
          if (emp && !emp.directManager) emp.directManager = mgr.name;
        });
      });
      // Metadata DM override takes precedence (check both empId and _realEmpId for split employees)
      allEmps.forEach((emp) => {
        const meta = scenarioMetadata[emp.empId] || (emp._realEmpId && scenarioMetadata[emp._realEmpId]);
        if (meta?.dm) emp.directManager = meta.dm;
      });

      // Enrich all employees with SAP project info (for search/filter)
      if (sapLookup) {
        const sapProjectsByEmp = new Map<string, { name: string; code: string; minDate: string; maxDate: string }[]>();
        for (const [empId, dates] of Object.entries(sapLookup as Record<string, Record<string, { records: any[] }>>)) {
          const projectDates = new Map<string, { name: string; min: string; max: string }>();
          for (const [dateStr, day] of Object.entries(dates as Record<string, { records: any[] }>)) {
            for (const r of day.records) {
              if (!r.salesOrder) continue;
              const existing = projectDates.get(r.salesOrder);
              if (existing) {
                if (dateStr < existing.min) existing.min = dateStr;
                if (dateStr > existing.max) existing.max = dateStr;
              } else {
                projectDates.set(r.salesOrder, { name: r.text || r.salesOrder, min: dateStr, max: dateStr });
              }
            }
          }
          const projects: { name: string; code: string; minDate: string; maxDate: string }[] = [];
          for (const [code, info] of projectDates) {
            projects.push({ name: info.name, code, minDate: info.min, maxDate: info.max });
          }
          if (projects.length) sapProjectsByEmp.set(empId, projects);
        }
        allEmps.forEach((emp) => {
          const realId = emp._realEmpId || emp.empId;
          const sapProjects = sapProjectsByEmp.get(realId);
          if (sapProjects) {
            emp._sapProjects = sapProjects;
            const sapStr = sapProjects
              .map((p) => `${p.name}\t${p.code}`)
              .join("\t")
              .toLowerCase();
            emp._searchIndex = emp._searchIndex ? `${emp._searchIndex}\t${sapStr}` : sapStr;
          }
        });
      }

      return allEmps;
    } catch (err) {
      console.error("[StaffingTab] buildEmployeeStructures error:", err);
      return [];
    }
  }, [
    scenarioData,
    enabledHolidayDates,
    sapLookup,
    scenarioMetadata,
    manualEmployeesFromStore,
    hiredCandidates,
    sapEnrichment,
  ]);

  const allEnrichedEmployees = useMemo(() => {
    const attachPresenceDates = (emps: any[]) =>
      emps.map((emp) => {
        const meta = effectiveMetadata[emp.empId];
        if (!meta?.arrivalDate && !meta?.departureDate && !meta?.etpAdjustments?.length) return emp;
        return {
          ...emp,
          _arrivalDate: meta?.arrivalDate || null,
          _departureDate: meta?.departureDate || null,
          manualArrival: meta?.manualArrival ?? true,
          manualDeparture: meta?.manualDeparture ?? true,
          _etpAdjustments: meta?.etpAdjustments || undefined,
        };
      });

    // Enrich with skills (if available)
    let enriched = employeeStructures;
    if (skillsData) {
      const normalize = (id: any) => (id || "").toString().trim().replace(/^0+/, "") || "0";
      enriched = employeeStructures.map((emp) => {
        const normalizedId = normalize(emp.empId);
        const empSkills = skillsData.skills.get(normalizedId);
        if (!empSkills) return emp;
        const skillsStr = empSkills.skills
          ? empSkills.skills
              .map((s: any) => `${s.skillShort}\t${s.skillFull}`)
              .join("\t")
              .toLowerCase()
          : "";
        return {
          ...emp,
          skills: empSkills.skills,
          skillsByCategory: empSkills.skillsByCategory,
          topSkills: empSkills.topSkills,
          skillCount: empSkills.skillCount,
          avgSkillLevel: empSkills.avgLevel,
          certifications: empSkills.certifications,
          _searchIndex: skillsStr ? `${emp._searchIndex}\t${skillsStr}` : emp._searchIndex,
        };
      });
    }

    const withPresence = attachPresenceDates(enriched);

    // Split employees with grade transitions into virtual rows (one per grade period)
    const internMapping = sapEnrichment?.internToAnalyst;
    return withPresence.flatMap((emp) => {
      // Skip intern→analyst mapped employees (already handled as separate rows)
      if (internMapping && internMapping[emp.empId]) return [emp];
      // Resolve grade history: manual metadata takes priority over SAP-detected
      const meta = effectiveMetadata[emp.empId];
      const sapGrade = sapEnrichment?.gradeResults?.[emp.empId];
      const history =
        meta?.gradeHistory?.length > 1
          ? meta.gradeHistory
          : (sapGrade?.gradeHistory?.length ?? 0) > 1
            ? sapGrade!.gradeHistory
            : null;
      if (!history || history.length <= 1) return [emp];
      // Skip intern transitions — handled by detectInternToAnalyst mechanism
      if (history.some((t: any) => t.grade === "Intern")) return [emp];
      const splits = splitByGradeTransitions(emp, history);
      return splits.map((s) => ({ ...s, _gradeHistory: history }));
    });
  }, [employeeStructures, skillsData, effectiveMetadata, sapEnrichment]);

  const enrichedGanttData = useMemo(() => {
    if (!timelineStart || !timelineEnd) return allEnrichedEmployees;
    const tlStart =
      typeof timelineStart === "string" ? timelineStart : new Date(timelineStart).toISOString().slice(0, 10);
    const tlEnd = typeof timelineEnd === "string" ? timelineEnd : new Date(timelineEnd).toISOString().slice(0, 10);
    return allEnrichedEmployees.filter((emp) => {
      if (emp._departureDate && emp._departureDate < tlStart) return false;
      if (emp._arrivalDate && emp._arrivalDate > tlEnd) return false;
      return true;
    });
  }, [allEnrichedEmployees, timelineStart, timelineEnd]);

  return { employeeStructures, allEnrichedEmployees, enrichedGanttData };
}
