import { useMemo, useCallback } from "react";
import { CHARGEABLE_CATS, GO_CATS } from "../constants";
import { consolidateAssignments, normalizePeriods } from "../utils/dataProcessing";
import type { Employee, IncludeExcludeFilter, PipelineJobcode } from "../types";

/**
 * Assignment-level filtering for Opp-mode segments & service lines.
 * Filters chargeable assignments BEFORE metrics computation so TU/hours
 * are recalculated as if excluded opportunities don't exist.
 */
export function useAssignmentFiltering(
  enrichedGanttData: Employee[],
  allEnrichedEmployees: Employee[],
  segmentFilter: IncludeExcludeFilter,
  segmentModes: Map<string, string>,
  serviceLineFilter: IncludeExcludeFilter,
  serviceLineModes: Map<string, string>,
  pipelineJobcodes: Map<string, PipelineJobcode> | null,
  showIO: string,
  ioJobcodes: Set<string> | null,
  ioLeadJobcodes: Set<string> | null,
  chargeableCombined: boolean
) {
  // Segment/service-line/I&O assignment filter sets (shared between timeline & trend)
  const assignmentFilterSets = useMemo(() => {
    if (!pipelineJobcodes) return null;

    const segInc = segmentFilter?.included || [];
    const segExc = segmentFilter?.excluded || [];
    const oppIncSegs = new Set<string>();
    segInc.forEach((s: string) => {
      const mode = segmentModes.get(s);
      if (!mode || mode === "both") oppIncSegs.add(s);
    });
    const oppExcSegs = new Set<string>();
    segExc.forEach((s: string) => {
      const mode = segmentModes.get(s);
      if (!mode) oppExcSegs.add(s);
    });

    const slInc = serviceLineFilter?.included || [];
    const slExc = serviceLineFilter?.excluded || [];
    const oppIncSLs = new Set<string>();
    slInc.forEach((s: string) => {
      const mode = serviceLineModes.get(s);
      if (!mode || mode === "both") oppIncSLs.add(s);
    });
    const oppExcSLs = new Set<string>();
    slExc.forEach((s: string) => {
      const mode = serviceLineModes.get(s);
      if (!mode) oppExcSLs.add(s);
    });

    const ioOnly = showIO === "ioOnly" && ioJobcodes;
    const ioLead = showIO === "ioLead" && ioLeadJobcodes;

    if (
      oppIncSegs.size === 0 &&
      oppExcSegs.size === 0 &&
      oppIncSLs.size === 0 &&
      oppExcSLs.size === 0 &&
      !ioOnly &&
      !ioLead
    )
      return null;

    return { oppIncSegs, oppExcSegs, oppIncSLs, oppExcSLs, ioOnly, ioLead, pipelineJobcodes };
  }, [
    segmentFilter,
    segmentModes,
    serviceLineFilter,
    serviceLineModes,
    pipelineJobcodes,
    showIO,
    ioJobcodes,
    ioLeadJobcodes,
  ]);

  // Apply assignment-level filters to an employee list
  const applyAssignmentFilters = useCallback(
    (emps: any[]) => {
      if (!assignmentFilterSets) return emps;
      const {
        oppIncSegs,
        oppExcSegs,
        oppIncSLs,
        oppExcSLs,
        ioOnly,
        ioLead,
        pipelineJobcodes: pjc,
      } = assignmentFilterSets;

      return emps.map((emp) => {
        const origAssignments = emp.assignments || [];
        const filtered = origAssignments.filter((a: any) => {
          const isFilterable = CHARGEABLE_CATS.has(a.category) || (chargeableCombined && GO_CATS.has(a.category));
          if (!isFilterable) return true;

          if (ioOnly && !ioJobcodes!.has(a.jobNo)) return false;
          if (ioLead && !ioLeadJobcodes!.has(a.jobNo)) return false;

          // GO cats: only apply segment/SL check when chargeableCombined is active
          if (!CHARGEABLE_CATS.has(a.category) && !chargeableCombined) return true;

          const entry = pjc?.get(a.jobNo);
          const seg = entry?.segment;
          const sls = [entry?.serviceLine, entry?.serviceLine2, entry?.serviceLine3].filter(Boolean);

          if (oppIncSegs.size > 0 && !(seg && oppIncSegs.has(seg))) return false;
          if (oppExcSegs.size > 0 && seg && oppExcSegs.has(seg)) return false;
          if (oppIncSLs.size > 0 && !sls.some((sl) => oppIncSLs.has(sl as string))) return false;
          if (oppExcSLs.size > 0 && sls.some((sl) => oppExcSLs.has(sl as string))) return false;

          return true;
        });

        if (filtered.length === origAssignments.length) return emp;
        const consolidated = consolidateAssignments(filtered);
        const periods = normalizePeriods(consolidated);
        return { ...emp, assignments: filtered, _consolidated: consolidated, _periods: periods };
      });
    },
    [assignmentFilterSets, chargeableCombined, ioJobcodes, ioLeadJobcodes]
  );

  const assignmentFilteredData = useMemo(
    () => applyAssignmentFilters(enrichedGanttData),
    [enrichedGanttData, applyAssignmentFilters]
  );

  // All employees with assignment filters but WITHOUT timeline presence filtering.
  // Used by TU Trend so per-bucket values are stable regardless of timeline selection.
  const allEmployeesForTrendBase = useMemo(
    () => applyAssignmentFilters(allEnrichedEmployees),
    [allEnrichedEmployees, applyAssignmentFilters]
  );

  return { assignmentFilteredData, allEmployeesForTrendBase };
}
