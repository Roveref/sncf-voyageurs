/**
 * Query functions — thin wrappers around api.ts for React Query.
 * Each returns a Promise of the parsed JSON response.
 */

import {
  checkBackendHealth,
  hydrateCrm,
  hydrateStaffing,
  hydrateSap,
  hydrateMetadata,
  hydrateSkills,
  hydrateChanges,
  hydrateRecruitment,
  hydrateRegions,
  hydrateEmployees,
  hydrateGrid,
  fetchSkillsCatalog,
  apiFetch,
  API_BASE,
} from "../services/api";
import type { CrmFilter } from "./queryKeys";

export const queryFns = {
  health: () => checkBackendHealth(),

  ready: async () => {
    const res = await apiFetch(`${API_BASE}/hydrate/ready`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<{
      ready: boolean;
      opportunities: number;
      employees: number;
      assignments: number;
      sapRecords: number;
      skills: number;
      accounts: number;
    }>;
  },

  regions: () => hydrateRegions(),
  crm: async (filter: CrmFilter) => {
    // Fetch all pages — backend paginates at 5000
    const firstPage = await hydrateCrm(filter);
    if (!firstPage.available || !firstPage.hasMore) return firstPage;

    const allOpps = [...firstPage.opportunities];
    const allAccounts = [...(firstPage.crmAccounts || [])];
    let page = 2;
    let hasMore = firstPage.hasMore;

    while (hasMore) {
      const nextPage = await hydrateCrm({ ...filter, page: String(page), pageSize: "5000" } as any);
      if (nextPage.opportunities) allOpps.push(...nextPage.opportunities);
      if (nextPage.crmAccounts) allAccounts.push(...nextPage.crmAccounts);
      hasMore = nextPage.hasMore;
      page++;
    }

    return {
      ...firstPage,
      opportunities: allOpps,
      crmAccounts: allAccounts,
      hasMore: false,
      totalCount: allOpps.length,
    };
  },
  staffing: () => hydrateStaffing(),
  sap: () => hydrateSap(),
  metadata: () => hydrateMetadata(),
  skills: () => hydrateSkills(),
  changes: () => hydrateChanges(),
  recruitment: () => hydrateRecruitment(),
  skillsCatalog: () => fetchSkillsCatalog(),
  employees: () => hydrateEmployees(),
  grid: () => hydrateGrid(),
};
