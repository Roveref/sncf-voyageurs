/**
 * Routes: GET /crm, GET /contacts
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { groupToMap } from "../../utils/groupBy.js";
import { error } from "../../utils/logger.js";
import {
  computeETag,
  handleConditionalRequest,
  mapNormalizedToFrontend,
  buildCrmAccounts,
  buildFilterOptions,
  buildSegmentMap,
  buildServiceMap,
} from "./utils.js";

const router = Router();

// ── GET /api/hydrate/crm ──

router.get("/crm", (req: Request, res: Response) => {
  try {
    const regionFilter = req.query.region ? String(req.query.region) : null;
    const countryFilter = req.query.country ? String(req.query.country) : null;
    const sinceFilter = req.query.since ? String(req.query.since) : null;
    // Pagination params — defaults keep backward compatibility (page=1, pageSize=5000 = effectively no pagination)
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? "5000"), 10) || 5000);
    const offset = (page - 1) * pageSize;
    console.log(
      `[hydrate/crm] region=${regionFilter} country=${countryFilter} since=${sinceFilter} page=${page} pageSize=${pageSize}`
    );

    // Build dynamic WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (countryFilter) {
      conditions.push("country = ?");
      params.push(countryFilter);
    } else if (regionFilter) {
      conditions.push("region = ?");
      params.push(regionFilter);
    }
    if (sinceFilter) {
      conditions.push("creationDate >= ?");
      params.push(sinceFilter);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    // Fast ETag check: DB fingerprint (count + max updatedAt) avoids full payload build on 304
    const fpRow = db.prepare(`SELECT COUNT(*) as cnt, MAX(updatedAt) as maxu FROM assets${where}`).get(...params) as {
      cnt: number;
      maxu: string | null;
    };
    const userFpRow = db
      .prepare("SELECT COUNT(*) as cnt, MAX(modifiedAt) as maxu FROM user_overrides WHERE entityType = 'opportunity'")
      .get() as { cnt: number; maxu: string | null };
    const fingerprint = computeETag(
      `crm-${fpRow.cnt}-${fpRow.maxu}-${userFpRow.cnt}-${userFpRow.maxu}-p${page}-ps${pageSize}`
    );
    if (handleConditionalRequest(req, res, fingerprint)) return;

    const totalCount = fpRow.cnt;

    const rows = db
      .prepare(
        `SELECT opportunityId, crmGuid, opportunity, accountId, account, status,
              grossRevenue, netRevenue, winPct, cm1Pct, jobCode,
              engagementType, weightedBooking, creationDate, bookingDate,
              estimatedBookingDate, lastStatusChangeDate,
              manager, partner, em, ep,
              managerId, partnerId, emId, epId,
              country, region,
              segmentCode, subSegmentCode, subSegment,
              serviceLine1, serviceLine2, serviceLine3,
              serviceOffering1, serviceOffering2, serviceOffering3,
              serviceOffering1Pct, serviceOffering2Pct, serviceOffering3Pct,
              technologyPartner1, technologyPartner2, technologyPartner3,
              lostComment, primaryContactId, primaryContact,
              utilizationPct, incidents12m, consoEau, consoElec, consoGaz,
              surfaceM2, mtbf, mttr, etatAbe
       FROM assets${where}
       LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset) as Record<string, unknown>[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    // Reconstruire les objets Opportunity dans le format frontend
    const opportunities = rows.map((row) => mapNormalizedToFrontend(row));

    // CRM Accounts — full referential (needed for opp creation and filters)
    const crmAccountRows = db
      .prepare(
        "SELECT accountId, account, segmentCode, subSegmentCode, subSegment, country, region, parentAccount FROM sites"
      )
      .all() as Record<string, unknown>[];
    const crmAccounts =
      crmAccountRows.length > 0
        ? crmAccountRows.map((r) => ({
            accountId: String(r.accountId || ""),
            account: String(r.account || ""),
            segmentCode: String(r.segmentCode || ""),
            subSegmentCode: String(r.subSegmentCode || ""),
            subSegment: String(r.subSegment || ""),
            country: String(r.country || ""),
            region: String(r.region || ""),
            parentAccount: String(r.parentAccount || ""),
          }))
        : buildCrmAccounts(opportunities); // Fallback if table not populated yet

    // CRM Contacts: no longer bulk-loaded here (332K+ rows).
    // Fetched on-demand per account via GET /api/hydrate/contacts?accountId=xxx

    const filterOptions = buildFilterOptions(opportunities, crmAccounts);
    const segmentToSubSegmentMap = buildSegmentMap(opportunities, crmAccounts);
    const serviceToOfferingMap = buildServiceMap(opportunities);

    // OptionSet mappings (status labels etc.) from var_optionsets
    const optionsetRows = db.prepare("SELECT attribute, value, label FROM var_optionsets").all() as {
      attribute: string;
      value: number;
      label: string;
    }[];
    const optionsets = groupToMap(
      optionsetRows,
      (r) => r.attribute,
      (r) => String(r.value),
      (r) => r.label
    );

    // Externalized config (MAGR mapping, SAP categories, grade targets)
    const configRows = db.prepare("SELECT category, key, value FROM var_config").all() as {
      category: string;
      key: string;
      value: string;
    }[];
    const config = groupToMap(
      configRows,
      (r) => r.category,
      (r) => r.key,
      (r) => r.value
    );

    const payload = {
      available: true,
      opportunities,
      crmAccounts,
      filterOptions,
      segmentToSubSegmentMap,
      serviceToOfferingMap,
      optionsets,
      config,
      totalCount,
      page,
      pageSize,
      hasMore: offset + rows.length < totalCount,
    };

    res.json(payload);
  } catch (err) {
    error("hydrate/crm", "Error:", err);
    res.status(500).json({ error: "Error loading CRM data." });
  }
});

// ── GET /api/hydrate/contacts?accountId=xxx — on-demand per-account contacts ──

router.get("/contacts", (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : null;
    const accountName = req.query.account ? String(req.query.account) : null;
    if (!accountId && !accountName) {
      res.json({ contacts: [] });
      return;
    }

    const condition = accountId ? "accountId = ?" : "account = ?";
    const param = accountId || accountName;
    const contactRows = db
      .prepare(
        `SELECT contactId, fullName, firstName, lastName, email, phone, mobile, jobTitle, department, city, country, accountId, account, owner, createdOn FROM crm_contacts WHERE ${condition}`
      )
      .all(param) as Record<string, unknown>[];

    const contacts = contactRows.map((r) => ({
      contactId: String(r.contactId || ""),
      fullName: String(r.fullName || ""),
      firstName: String(r.firstName || ""),
      lastName: String(r.lastName || ""),
      email: String(r.email || ""),
      phone: String(r.phone || ""),
      mobile: String(r.mobile || ""),
      jobTitle: String(r.jobTitle || ""),
      department: String(r.department || ""),
      city: String(r.city || ""),
      country: String(r.country || ""),
      accountId: String(r.accountId || ""),
      account: String(r.account || ""),
      owner: String(r.owner || ""),
      createdOn: String(r.createdOn || ""),
    }));

    res.json({ contacts });
  } catch (err) {
    error("hydrate/contacts", "Error:", err);
    res.status(500).json({ error: "Error loading contacts." });
  }
});

export default router;
