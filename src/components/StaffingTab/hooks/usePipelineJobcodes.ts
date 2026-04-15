import { useMemo } from "react";
import { useComputedStore } from "../../../stores/useComputedStore";
import { useAppStore } from "../../../stores/useAppStore";

const IO_TEAMS = ["IEM", "AUTO", "Operations", "LSC"];

/**
 * Cross-module enrichment: maps CRM pipeline data to jobcodes.
 * Returns pipelineJobcodes, jobcodeOppsList, ioJobcodes, ioLeadJobcodes.
 */
export function usePipelineJobcodes(sharedData: any[]) {
  const staffingEmployees = useComputedStore((s) => s.staffingEmployees);
  const showIO = useAppStore((s) => s.showIO);

  // Derive ioTeamNames from staffing employees
  const ioTeamNames = useMemo(() => {
    const names = new Set<string>();
    staffingEmployees.forEach((emp: any) => {
      if (emp.name && IO_TEAMS.includes(emp.subTeam)) {
        names.add(emp.name.trim().toLowerCase());
      }
    });
    return names;
  }, [staffingEmployees]);

  const pipelineJobcodes = useMemo(() => {
    if (!sharedData || sharedData.length === 0) return null;
    const map = new Map();
    sharedData.forEach((opp) => {
      const jc = opp.jobCode;
      const opportunityId = opp.opportunityId;
      const entry = {
        opportunityName: opp.opportunity || "",
        opportunityId: opportunityId || "",
        status: opp.status || "",
        account: opp.account || "",
        revenue: opp.netRevenue || 0,
        em: opp.em || opp.manager || "",
        winPct: opp.winPct != null ? Math.round(opp.winPct * 100) : null,
        segment: opp.subSegmentCode || "",
        serviceLine: opp.serviceLine1 && opp.serviceLine1 !== "-" ? opp.serviceLine1 : "",
        serviceLine2: opp.serviceLine2 && opp.serviceLine2 !== "-" ? opp.serviceLine2 : "",
        serviceLine3: opp.serviceLine3 && opp.serviceLine3 !== "-" ? opp.serviceLine3 : "",
        techPartner1: opp.techPartner1 || "",
        techPartner2: opp.techPartner2 || "",
        techPartner3: opp.techPartner3 || "",
        creationDate: opp.creationDate || "",
      };
      // Prefer entries with more service lines populated (avoid overwriting with "-" placeholders)
      const setIfBetter = (key: string) => {
        const existing = map.get(key);
        if (!existing) {
          map.set(key, entry);
          return;
        }
        const existingSLCount = [existing.serviceLine, existing.serviceLine2, existing.serviceLine3].filter(
          Boolean
        ).length;
        const newSLCount = [entry.serviceLine, entry.serviceLine2, entry.serviceLine3].filter(Boolean).length;
        if (newSLCount >= existingSLCount) map.set(key, entry);
      };
      if (jc) setIfBetter(String(jc).trim());
      if (opportunityId) setIfBetter(String(opportunityId).trim());
    });
    return map.size > 0 ? map : null;
  }, [sharedData]);

  // Multi-opp map per jobcode (for period-aware name resolution)
  const jobcodeOppsList = useMemo(() => {
    if (!sharedData || sharedData.length === 0) return null;
    const map = new Map<string, { oppName: string; account: string; creationDate: string; endDate: string }[]>();
    sharedData.forEach((opp) => {
      const jc = opp.jobCode;
      if (!jc) return;
      const key = String(jc).trim();
      const entry = {
        oppName: opp.opportunity || "",
        account: opp.account || "",
        creationDate: opp.creationDate || "",
        endDate: opp.bookingDate || "",
      };
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });
    return map.size > 0 ? map : null;
  }, [sharedData]);

  // I&O jobcode set: identifies which projects are I&O
  const ioJobcodes = useMemo(() => {
    if (!sharedData || sharedData.length === 0) return null;
    const ioSet = new Set<string>();
    const SPECIAL_SEGMENTS = ["AUTO", "CLR", "IEM", "LSC"];
    sharedData.forEach((opp) => {
      const jc = opp.jobCode;
      const opportunityId = opp.opportunityId;
      let isIO = false;
      if (SPECIAL_SEGMENTS.includes(opp.subSegmentCode)) {
        isIO = true;
      } else {
        const lines = [opp.serviceLine1, opp.serviceLine2, opp.serviceLine3];
        const pcts = [
          opp.serviceOffering1Pct || opp.allocation1 || 0,
          opp.serviceOffering2Pct || opp.allocation2 || 0,
          opp.serviceOffering3Pct || opp.allocation3 || 0,
        ];
        for (let i = 0; i < 3; i++) {
          if (lines[i] === "Operations" && pcts[i] > 0) {
            isIO = true;
            break;
          }
        }
      }
      if (isIO) {
        if (jc) ioSet.add(String(jc).trim());
        if (opportunityId) ioSet.add(String(opportunityId).trim());
      }
    });
    return ioSet.size > 0 ? ioSet : null;
  }, [sharedData]);

  // I&O lead jobcode set: projects whose lead is I&O
  const ioLeadJobcodes = useMemo(() => {
    if (!sharedData || sharedData.length === 0 || !ioTeamNames || ioTeamNames.size === 0) return null;
    const set = new Set<string>();
    sharedData.forEach((opp) => {
      const persons = [opp.manager, opp.partner, opp.em, opp.ep];
      if (!persons.some((n) => n && ioTeamNames.has(String(n).trim().toLowerCase()))) return;
      const jc = opp.jobCode;
      if (jc) set.add(String(jc).trim());
      const opportunityId = opp.opportunityId;
      if (opportunityId) set.add(String(opportunityId).trim());
    });
    return set.size > 0 ? set : null;
  }, [sharedData, ioTeamNames]);

  // Effective I&O jobcodes for team stats (null when in ioOnly/ioLead mode)
  const effectiveIoJobcodes = showIO === "ioOnly" || showIO === "ioLead" ? null : ioJobcodes;

  return { pipelineJobcodes, jobcodeOppsList, ioJobcodes, ioLeadJobcodes, effectiveIoJobcodes, showIO };
}
