/**
 * useAllPeople — sorted, deduplicated list of every person who appears
 * in any role on any opportunity / jobcode in the system.
 *
 * Sources (union):
 *   1. crm_opportunities.{manager, partner, em, ep}
 *   2. user_staffing_needs.assignedTo  (per-opportunity)
 *   3. user_revenue_team.name          (per-opportunity)
 *   4. mds_assignments → "${firstName} ${lastName}" (consultants tracked
 *      in MDS even when they're not in any user-authored need)
 *
 * The result feeds the person-picker autocomplete in the JobcodeTimelineTab
 * top filter bar.
 */
import { useMemo } from "react";
import { useCrmData } from "../../../queries/useCrmData";
import { useStaffingData } from "../../../queries/useStaffingData";
import { useUserDataStore } from "../../../stores/useUserDataStore";

export function useAllPeople(): string[] {
  const { opportunityData } = useCrmData();
  const { records: staffingRecords } = useStaffingData();
  const staffingNeeds = useUserDataStore((s) => s.staffingNeeds);
  const revenueTeam = useUserDataStore((s) => s.revenueTeam);

  return useMemo(() => {
    const set = new Set<string>();
    const add = (v: unknown) => {
      if (typeof v !== "string") return;
      const trimmed = v.trim();
      if (trimmed) set.add(trimmed);
    };

    // 1. CRM opportunity roles
    for (const opp of opportunityData) {
      add(opp.manager);
      add(opp.partner);
      add(opp.em);
      add(opp.ep);
    }

    // 2. Staffing needs assignees
    for (const needs of Object.values(staffingNeeds)) {
      for (const need of needs) add(need.assignedTo);
    }

    // 3. Revenue team members
    for (const team of Object.values(revenueTeam)) {
      for (const member of team) add(member.name);
    }

    // 4. MDS assignments — build "First Last" from staffing records
    for (const rec of staffingRecords) {
      const first = (rec.firstName || "").trim();
      const last = (rec.lastName || "").trim();
      if (first || last) add(`${first} ${last}`.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [opportunityData, staffingRecords, staffingNeeds, revenueTeam]);
}
