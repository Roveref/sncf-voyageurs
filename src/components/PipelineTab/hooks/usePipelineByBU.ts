/**
 * Hook for calculating pipeline data grouped by Business Unit (TN / TER / IC).
 * Resolves the BU from the account via the crmAccounts lookup (parentAccount column),
 * with a fallback on the site's accountId prefix.
 */

import { useMemo } from "react";
import { STATUS_CATEGORIES } from "../utils/constants";
import { calculateRevenueWithSegmentLogic } from "../utils/revenueCalculations";
import type { CrmAccount, Opportunity } from "../../../types";

export const BU_LABEL: Record<string, string> = {
  TN: "Transilien",
  TER: "TER",
  IC: "Intercités",
};

export const BU_CODE_FROM_LABEL: Record<string, string> = {
  Transilien: "TN",
  TER: "TER",
  Intercités: "IC",
};

const BU_ORDER = ["TN", "TER", "IC"];

export const resolveBU = (
  opp: Opportunity,
  accountByName: Map<string, string>,
  accountById: Map<string, string>
): string => {
  if (opp.accountId) {
    const byId = accountById.get(String(opp.accountId));
    if (byId) return byId;
    // Fallback: parse the SITE-<BU>-XXX pattern
    const match = String(opp.accountId).match(/^SITE-([A-Z]+)-/);
    if (match && BU_ORDER.includes(match[1])) return match[1];
  }
  if (opp.account) {
    const byName = accountByName.get(String(opp.account));
    if (byName) return byName;
  }
  return "";
};

const createGroup = (name: string) => ({
  name,
  early: 0,
  earlyAllocated: 0,
  earlyNonAllocated: 0,
  mid: 0,
  midAllocated: 0,
  midNonAllocated: 0,
  late: 0,
  lateAllocated: 0,
  lateNonAllocated: 0,
  total: 0,
  calculatedEarly: 0,
  calculatedMid: 0,
  calculatedLate: 0,
  calculatedTotal: 0,
  count: 0,
});

const accumulate = (group: any, opp: Opportunity, showNetRevenue: boolean) => {
  const baseRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
  const calculatedRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

  if (STATUS_CATEGORIES.early.includes(opp.status)) {
    group.early += baseRevenue;
    group.earlyAllocated += baseRevenue;
    group.calculatedEarly += calculatedRevenue;
  } else if (STATUS_CATEGORIES.mid.includes(opp.status)) {
    group.mid += baseRevenue;
    group.midAllocated += baseRevenue;
    group.calculatedMid += calculatedRevenue;
  } else {
    group.late += baseRevenue;
    group.lateAllocated += baseRevenue;
    group.calculatedLate += calculatedRevenue;
  }
  group.total += baseRevenue;
  group.calculatedTotal += calculatedRevenue;
  group.count += 1;
};

const buildAccountMaps = (crmAccounts: CrmAccount[]) => {
  const accountByName = new Map<string, string>();
  const accountById = new Map<string, string>();
  crmAccounts.forEach((a) => {
    if (a.parentAccount && a.account) accountByName.set(a.account, a.parentAccount);
    if (a.parentAccount && a.accountId) accountById.set(a.accountId, a.parentAccount);
  });
  return { accountByName, accountById };
};

export const usePipelineByBU = (
  filteredOpportunities: Opportunity[],
  crmAccounts: CrmAccount[],
  showNetRevenue: boolean
) => {
  return useMemo(() => {
    const { accountByName, accountById } = buildAccountMaps(crmAccounts);

    const buGroups: Record<string, any> = {};
    BU_ORDER.forEach((bu) => {
      buGroups[bu] = createGroup(BU_LABEL[bu]);
    });

    filteredOpportunities.forEach((opp) => {
      const bu = resolveBU(opp, accountByName, accountById);
      if (!bu || !buGroups[bu]) return;
      accumulate(buGroups[bu], opp, showNetRevenue);
    });

    return BU_ORDER.map((bu) => buGroups[bu]).sort((a: any, b: any) => b.total - a.total);
  }, [filteredOpportunities, crmAccounts, showNetRevenue]);
};

/**
 * Drill-down: assets aggregated by site (account name), filtered to a single BU.
 * Returns the same shape as usePipelineByBU so the StatusChart can consume it.
 */
export const usePipelineBySiteInBU = (
  filteredOpportunities: Opportunity[],
  crmAccounts: CrmAccount[],
  showNetRevenue: boolean,
  buCode: string | null
) => {
  return useMemo(() => {
    if (!buCode) return [];
    const { accountByName, accountById } = buildAccountMaps(crmAccounts);

    const siteGroups: Record<string, any> = {};
    filteredOpportunities.forEach((opp) => {
      const bu = resolveBU(opp, accountByName, accountById);
      if (bu !== buCode) return;
      const siteName = String(opp.account || "Non rattaché");
      if (!siteGroups[siteName]) siteGroups[siteName] = createGroup(siteName);
      accumulate(siteGroups[siteName], opp, showNetRevenue);
    });

    return Object.values(siteGroups).sort((a: any, b: any) => b.total - a.total);
  }, [filteredOpportunities, crmAccounts, showNetRevenue, buCode]);
};
