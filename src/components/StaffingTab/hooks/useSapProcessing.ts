import { useMemo } from "react";
import { CHARGEABLE_CATS, GO_CATS } from "../constants";
import type { SapLookup, IncludeExcludeFilter, PipelineJobcode } from "../types";

/**
 * Applies segment/service-line filtering to the SAP lookup.
 *
 * Returns both `sapLookup` (raw, unfiltered) and `filteredSapLookup` (segment/SL filtered).
 */
export function useSapProcessing(
  rawSapLookup: SapLookup | null,
  segmentFilter: IncludeExcludeFilter | null | undefined,
  segmentModes: Map<string, string>,
  serviceLineFilter: IncludeExcludeFilter | null | undefined,
  serviceLineModes: Map<string, string>,
  pipelineJobcodes: Map<string, PipelineJobcode> | null
) {
  const { sapLookup, filteredSapLookup } = useMemo(() => {
    if (!rawSapLookup) return { sapLookup: null, filteredSapLookup: null };

    // ── Build segment/service-line opp-mode sets ──
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

    const needsFiltering =
      pipelineJobcodes && (oppIncSegs.size > 0 || oppExcSegs.size > 0 || oppIncSLs.size > 0 || oppExcSLs.size > 0);

    // Fast path: no filtering → return raw as-is for both
    if (!needsFiltering) {
      return { sapLookup: rawSapLookup, filteredSapLookup: rawSapLookup };
    }

    // Build filtered version
    const filtered: Record<string, any> = {};
    for (const [empId, empData] of Object.entries(rawSapLookup as Record<string, any>)) {
      const filteredEmp: Record<string, any> = {};
      for (const [dateStr, day] of Object.entries(empData as Record<string, any>)) {
        if (!day?.records) {
          filteredEmp[dateStr] = day;
          continue;
        }
        const filteredRecords = day.records.filter((r: any) => {
          if (!CHARGEABLE_CATS.has(r.category) && !GO_CATS.has(r.category)) return true;
          const entry = pipelineJobcodes!.get(r.salesOrder);
          const seg = entry?.segment;
          const sls = [entry?.serviceLine, entry?.serviceLine2, entry?.serviceLine3].filter(Boolean);
          if (oppIncSegs.size > 0 && !(seg && oppIncSegs.has(seg))) return false;
          if (oppExcSegs.size > 0 && seg && oppExcSegs.has(seg)) return false;
          if (oppIncSLs.size > 0 && !sls.some((sl) => oppIncSLs.has(sl as string))) return false;
          if (oppExcSLs.size > 0 && sls.some((sl) => oppExcSLs.has(sl as string))) return false;
          return true;
        });
        filteredEmp[dateStr] = { ...day, records: filteredRecords };
      }
      filtered[empId] = filteredEmp;
    }
    return { sapLookup: rawSapLookup, filteredSapLookup: filtered };
  }, [rawSapLookup, segmentFilter, segmentModes, serviceLineFilter, serviceLineModes, pipelineJobcodes]);

  return { sapLookup, filteredSapLookup };
}
