/**
 * usePersonJobcodeIndex — index of every jobcode each person is involved
 * in, regardless of role.
 *
 * Output: Map&lt;personName, Set&lt;jobcodeUpper&gt;&gt; — jobcodes are stored in
 * normalized upper-case form so the cascading filter can compare them
 * against the same normalization on the jobcode side.
 *
 * Sources (union, one pass each):
 *   1. assets.{manager, partner, em, ep} → opp.jobCode
 *   2. user_staffing_needs.assignedTo → opp.jobCode  (lookup via opportunityId)
 *   3. user_asset_team.name            → opp.jobCode  (lookup via opportunityId)
 *   4. mds_assignments → jobNo (== jobCode after normalization)
 *
 * Memoized on the four source arrays. At ~5k opps + 2k MDS records the
 * full build runs well under 10ms.
 */
import { useMemo } from "react";
import { useCrmData } from "../../../queries/useCrmData";
import { useStaffingData } from "../../../queries/useStaffingData";
import { useUserDataStore } from "../../../stores/useUserDataStore";

const normalizeJobcode = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.toUpperCase() : null;
};

const normalizeName = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
};

export interface PersonJobcodeIndex {
  /** Set of normalized jobcodes (UPPERCASE) for a person, or undefined. */
  get(person: string): Set<string> | undefined;
  /** True if the person has at least one jobcode. */
  has(person: string): boolean;
}

export function usePersonJobcodeIndex(): PersonJobcodeIndex {
  const { opportunityData } = useCrmData();
  const { records: staffingRecords } = useStaffingData();
  const staffingNeeds = useUserDataStore((s) => s.staffingNeeds);
  const revenueTeam = useUserDataStore((s) => s.revenueTeam);

  return useMemo(() => {
    const index = new Map<string, Set<string>>();
    const add = (rawName: unknown, rawJobcode: unknown) => {
      const name = normalizeName(rawName);
      const jc = normalizeJobcode(rawJobcode);
      if (!name || !jc) return;
      let set = index.get(name);
      if (!set) {
        set = new Set<string>();
        index.set(name, set);
      }
      set.add(jc);
    };

    // Build a quick lookup: opportunityId → jobCode
    const oppIdToJobcode = new Map<string, string>();
    for (const opp of opportunityData) {
      const jc = normalizeJobcode(opp.jobCode);
      if (jc && opp.opportunityId) oppIdToJobcode.set(opp.opportunityId, jc);
      // 1. CRM roles
      add(opp.manager, jc);
      add(opp.partner, jc);
      add(opp.em, jc);
      add(opp.ep, jc);
    }

    // 2. Staffing needs assignees
    for (const [oppId, needs] of Object.entries(staffingNeeds)) {
      const jc = oppIdToJobcode.get(oppId);
      if (!jc) continue;
      for (const need of needs) add(need.assignedTo, jc);
    }

    // 3. Revenue team members
    for (const [oppId, team] of Object.entries(revenueTeam)) {
      const jc = oppIdToJobcode.get(oppId);
      if (!jc) continue;
      for (const member of team) add(member.name, jc);
    }

    // 4. MDS assignments — direct jobNo bridge (no opportunityId needed)
    for (const rec of staffingRecords) {
      const first = (rec.firstName || "").trim();
      const last = (rec.lastName || "").trim();
      const fullName = `${first} ${last}`.trim();
      add(fullName, rec.jobNo);
    }

    return {
      get: (person: string) => index.get(person),
      has: (person: string) => index.has(person),
    };
  }, [opportunityData, staffingRecords, staffingNeeds, revenueTeam]);
}
