/**
 * Shared helpers for hydrate routes.
 */

import { Request, Response } from "express";
import crypto from "crypto";

/** Categorize job by number: special codes from var_config, 6-digit=generalOppty, 7-digit=chargeable. */
export function categorizeJob(jobNo: string): string {
  if (!jobNo) return "unknown";
  const j = jobNo.trim();
  if (j.length === 6 && /^\d{6}$/.test(j)) return "generalOppty";
  if (j.length === 7 && /^\d{7}$/.test(j)) return "chargeable";
  return "unknown";
}

/**
 * Compute a lightweight ETag from a precomputed fingerprint string or JSON payload.
 */
export function computeETag(data: unknown): string {
  if (typeof data === "string") {
    // Pre-computed fingerprint — hash it directly
    return `"${crypto.createHash("md5").update(data).digest("hex")}"`;
  }
  const json = JSON.stringify(data);
  return `"${crypto.createHash("md5").update(json).digest("hex")}"`;
}

/**
 * Check If-None-Match header and send 304 if ETag matches.
 * Accepts either a pre-computed ETag string (fast path) or a data payload (legacy path).
 * Returns true if 304 was sent (caller should return early).
 */
export function handleConditionalRequest(req: Request, res: Response, etagOrData: string | unknown): boolean {
  const etag = typeof etagOrData === "string" && etagOrData.startsWith('"') ? etagOrData : computeETag(etagOrData);
  res.setHeader("ETag", etag);

  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return true;
  }
  return false;
}

/**
 * Fallback : mapper les colonnes normalisees vers les noms attendus par le frontend.
 * Mappe les colonnes DB (snake_case) vers les noms frontend.
 */
export function mapNormalizedToFrontend(row: Record<string, unknown>): Record<string, unknown> {
  const opp: Record<string, unknown> = {
    opportunityId: row.opportunityId,
    crmGuid: row.crmGuid || "",
    opportunity: row.opportunity,
    accountId: row.accountId || "",
    account: row.account,
    status: Number(row.status) || 0,
    grossRevenue: row.grossRevenue,
    netRevenue: row.netRevenue,
    winPct: row.winPct,
    cm1Pct: row.cm1Pct,
    jobCode: row.jobCode,
    engagementType: row.engagementType,
    weightedBooking: row.weightedBooking,
    segmentCode: row.segmentCode,
    subSegmentCode: row.subSegmentCode,
    subSegment: row.subSegment,
    manager: row.manager,
    partner: row.partner,
    em: row.em,
    ep: row.ep,
    managerId: row.managerId || "",
    partnerId: row.partnerId || "",
    emId: row.emId || "",
    epId: row.epId || "",
    country: row.country,
    region: row.region,
    creationDate: row.creationDate,
    bookingDate: row.bookingDate,
    estimatedBookingDate: row.estimatedBookingDate,
    lastStatusChangeDate: row.lastStatusChangeDate,
    lostComment: row.lostComment,
    serviceLine1: row.serviceLine1,
    serviceLine2: row.serviceLine2,
    serviceLine3: row.serviceLine3,
    serviceOffering1: row.serviceOffering1,
    serviceOffering2: row.serviceOffering2,
    serviceOffering3: row.serviceOffering3,
    serviceOffering1Pct: row.serviceOffering1Pct,
    serviceOffering2Pct: row.serviceOffering2Pct,
    serviceOffering3Pct: row.serviceOffering3Pct,
    techPartner1: row.technologyPartner1,
    techPartner2: row.technologyPartner2,
    techPartner3: row.technologyPartner3,
    primaryContactId: row.primaryContactId || "",
    primaryContact: row.primaryContact || "",
  };

  if (row.isManual) opp.isManual = true;
  return opp;
}

/**
 * Extraire les comptes uniques depuis les opportunites.
 */
export function buildCrmAccounts(opps: Record<string, unknown>[]): Record<string, unknown>[] {
  const accountMap = new Map<string, Record<string, unknown>>();

  for (const opp of opps) {
    const account = String(opp.account || "");
    if (!account || account === "-") continue;

    if (!accountMap.has(account)) {
      accountMap.set(account, {
        account: account,
        segmentCode: opp.segmentCode || "",
        subSegmentCode: opp.subSegmentCode || "",
        subSegment: opp.subSegment || "",
      });
    }
  }

  return Array.from(accountMap.values());
}

/**
 * Construire les options de filtrage.
 */
export function buildFilterOptions(opps: Record<string, unknown>[], crmAccounts?: Record<string, unknown>[]) {
  const subSegmentCodes = new Set<string>();
  const subSegments = new Set<string>();
  const serviceLine1 = new Set<string>();
  const serviceOfferings = new Set<string>();
  const accounts = new Set<string>();

  for (const opp of opps) {
    const ssc = String(opp.subSegmentCode || "");
    const ss = String(opp.subSegment || "");
    const sl1 = String(opp.serviceLine1 || opp["Service Line 1"] || "");
    const so1 = String(opp.serviceOffering1 || opp["Service Offering 1"] || "");
    const acc = String(opp.account || "");

    if (ssc && ssc !== "-") subSegmentCodes.add(ssc);
    if (ss && ss !== "-") subSegments.add(ss);
    if (sl1 && sl1 !== "-") serviceLine1.add(sl1);
    if (so1 && so1 !== "-") serviceOfferings.add(so1);
    if (acc && acc !== "-") accounts.add(acc);
  }

  // Merge CRM account names into accounts (same as excelWorker.js)
  if (crmAccounts) {
    for (const a of crmAccounts) {
      const acc = String(a.account || "");
      if (acc && acc !== "-") accounts.add(acc);
    }
  }

  return {
    subSegmentCodes: Array.from(subSegmentCodes).sort(),
    subSegments: Array.from(subSegments).sort(),
    serviceLine1: Array.from(serviceLine1).sort(),
    serviceOfferings: Array.from(serviceOfferings).sort(),
    accounts: Array.from(accounts).sort(),
  };
}

/**
 * Construire le mapping segment -> sub-segments.
 */
export function buildSegmentMap(
  opps: Record<string, unknown>[],
  crmAccounts?: Record<string, unknown>[]
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};

  for (const opp of opps) {
    const segment = String(opp.subSegmentCode || "");
    const subSegment = String(opp.subSegment || "");
    if (!segment) continue;

    if (!map[segment]) map[segment] = new Set();
    if (subSegment) map[segment].add(subSegment);
  }

  // Enrich with CRM accounts data
  if (crmAccounts) {
    for (const a of crmAccounts) {
      const segment = String(a.subSegmentCode || "");
      const subSegment = String(a.subSegment || "");
      if (!segment) continue;

      if (!map[segment]) map[segment] = new Set();
      if (subSegment) map[segment].add(subSegment);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) {
    result[k] = Array.from(v).sort();
  }
  return result;
}

/**
 * Construire le mapping service line -> offerings.
 */
export function buildServiceMap(opps: Record<string, unknown>[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};

  for (const opp of opps) {
    for (let i = 1; i <= 3; i++) {
      const line = String(opp[`serviceLine${i}`] || "");
      const offering = String(opp[`serviceOffering${i}`] || "");
      if (!line) continue;

      if (!map[line]) map[line] = new Set();
      if (offering) map[line].add(offering);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) {
    result[k] = Array.from(v).sort();
  }
  return result;
}
