/**
 * Routes: GET /changes, POST /changes
 */

import { Router, Request, Response } from "express";
import db, { isDemoMode } from "../../db/database.js";
import { groupByKey } from "../../utils/groupBy.js";
import { log, error } from "../../utils/logger.js";
import { mapNormalizedToFrontend } from "./utils.js";
import { broadcast } from "../events.js";
import { logAudit } from "../../utils/audit.js";
import { createNotification, type NotificationType } from "../notifications.js";

const router = Router();

// ── GET /api/hydrate/changes ──
// Lit les modifications utilisateur depuis les tables dédiées

router.get("/changes", (_req: Request, res: Response) => {
  try {
    // Status overrides — read latest value per (entityId, field) from EAV table
    const statusOverrides: Record<string, any> = {};
    const soRows = db
      .prepare(
        `WITH latest AS (
         SELECT entityId, field, oldValue, newValue,
                ROW_NUMBER() OVER (PARTITION BY entityId, field ORDER BY id DESC) as rn
         FROM user_overrides
         WHERE entityType = 'opportunity'
       )
       SELECT entityId, field, oldValue, newValue FROM latest WHERE rn = 1`
      )
      .all() as any[];
    for (const r of soRows) {
      if (!statusOverrides[r.entityId]) statusOverrides[r.entityId] = {};
      const so = statusOverrides[r.entityId];
      if (r.field === "status") {
        so.originalStatus = Number(r.oldValue);
        so.newStatus = Number(r.newValue);
      } else if (r.field === "overrideComment") so.comment = r.newValue;
      else if (r.field === "bookingDate") so.bookingDate = r.newValue;
    }

    // Manual opportunities — from dedicated table (clean, no overrides mixed in)
    const manualOpportunities = (
      db
        .prepare(
          `SELECT opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue,
              winPct, cm1Pct, jobCode, engagementType, weightedBooking,
              creationDate, bookingDate, estimatedBookingDate,
              lastStatusChangeDate, manager, partner, em, ep,
              managerId, partnerId, emId, epId,
              country, region, segmentCode, subSegmentCode, subSegment,
              serviceLine1, serviceLine2, serviceLine3,
              serviceOffering1, serviceOffering2, serviceOffering3,
              serviceOffering1Pct, serviceOffering2Pct, serviceOffering3Pct,
              technologyPartner1, technologyPartner2, technologyPartner3,
              lostComment, primaryContactId, primaryContact,
              1 as isManual
       FROM user_opportunities`
        )
        .all() as Record<string, unknown>[]
    ).map((r) => ({ ...mapNormalizedToFrontend(r), isManual: true }));

    // Manual accounts
    const manualAccounts = db
      .prepare(
        "SELECT accountId, account, segmentCode, subSegmentCode, subSegment, country, region, parentAccount, accountLeader, createdAt FROM user_accounts"
      )
      .all()
      .map((r: any) => ({
        accountId: r.accountId,
        account: r.account,
        segmentCode: r.segmentCode,
        subSegmentCode: r.subSegmentCode,
        subSegment: r.subSegment,
        country: r.country,
        region: r.region,
        parentAccount: r.parentAccount,
        accountLeader: r.accountLeader,
        isManual: true,
        createdAt: r.createdAt,
      }));

    // Actions, comments, staffing needs (grouped by opportunityId)
    const actRows = db
      .prepare(
        "SELECT id, opportunityId, description, owner, dueDate, priority, status, createdAt FROM user_actions ORDER BY createdAt DESC"
      )
      .all() as any[];
    const opportunityActions = groupByKey(
      actRows,
      (r: any) => r.opportunityId,
      (r: any) => ({
        id: r.id,
        description: r.description,
        owner: r.owner,
        dueDate: r.dueDate,
        priority: r.priority,
        status: r.status,
        createdAt: r.createdAt,
        opportunityId: r.opportunityId,
      })
    );

    const staffingNeeds: Record<string, any[]> = {};
    const snRows = db
      .prepare(
        "SELECT id, opportunityId, grade, quantity, utilization, startDate, endDate, skills, probability, status, description, assignedTo, createdAt, modifiedAt FROM user_staffing_needs"
      )
      .all() as any[];
    for (const r of snRows) {
      if (!staffingNeeds[r.opportunityId]) staffingNeeds[r.opportunityId] = [];
      staffingNeeds[r.opportunityId].push({
        id: r.id,
        opportunityId: r.opportunityId,
        grade: r.grade,
        quantity: r.quantity || 1,
        startDate: r.startDate || "",
        endDate: r.endDate || "",
        utilization: r.utilization ?? 100,
        probability: r.probability ?? 1,
        skills: r.skills ? JSON.parse(r.skills) : [],
        description: r.description || null,
        assignedTo: r.assignedTo || null,
        createdAt: r.createdAt || null,
        modifiedAt: r.modifiedAt || null,
        status: r.status || "open",
      });
    }

    // Staffing assignments — kept as empty array for backward compatibility
    // (assignments are now managed in user_assignments by the frontend)
    const staffingAssignments: any[] = [];

    // Revenue team allocations
    const revenueTeam: Record<string, any[]> = {};
    const rtRows = db
      .prepare("SELECT id, opportunityId, name, gradeBucket, percentage FROM user_revenue_team")
      .all() as any[];
    for (const r of rtRows) {
      if (!revenueTeam[r.opportunityId]) revenueTeam[r.opportunityId] = [];
      revenueTeam[r.opportunityId].push({
        id: r.id,
        name: r.name,
        gradeBucket: r.gradeBucket,
        percentage: r.percentage,
      });
    }

    // Scenarios
    const scenarios = db
      .prepare("SELECT id, name, baseId, overrides, empOverrides, createdAt FROM user_scenarios")
      .all()
      .map((r: any) => ({
        ...r,
        overrides: r.overrides ? JSON.parse(r.overrides) : {},
        empOverrides: r.empOverrides ? JSON.parse(r.empOverrides) : {},
      }));

    // Employee metadata overrides — read latest value per (entityId, field) from EAV table
    const employeeMetadata: Record<string, any> = {};
    const empRows = db
      .prepare(
        `WITH latest AS (
         SELECT entityId, field, newValue,
                ROW_NUMBER() OVER (PARTITION BY entityId, field ORDER BY id DESC) as rn
         FROM user_overrides
         WHERE entityType = 'employee'
       )
       SELECT entityId, field, newValue FROM latest WHERE rn = 1`
      )
      .all() as any[];
    for (const r of empRows) {
      if (!employeeMetadata[r.entityId]) {
        employeeMetadata[r.entityId] = {
          gradeHistory: [],
          _manualArrival: false,
          _manualDeparture: false,
          _rejected: false,
        };
      }
      const meta = employeeMetadata[r.entityId];
      switch (r.field) {
        case "dm":
          meta.dm = r.newValue;
          break;
        case "role":
          meta.role = r.newValue;
          break;
        case "segment":
          meta.segment = r.newValue;
          break;
        case "serviceLine":
          meta.serviceLine = r.newValue;
          break;
        case "arrivalDate":
          meta.arrivalDate = r.newValue;
          break;
        case "departureDate":
          meta.departureDate = r.newValue;
          break;
        case "manualArrival":
          meta.manualArrival = r.newValue === "true";
          break;
        case "manualDeparture":
          meta.manualDeparture = r.newValue === "true";
          break;
        case "gradeHistory":
          try {
            meta.gradeHistory = JSON.parse(r.newValue);
          } catch {
            /* skip */
          }
          break;
        case "etpAdjustments":
          try {
            meta.etpAdjustments = JSON.parse(r.newValue);
          } catch {
            /* skip */
          }
          break;
        case "rejected":
          meta.rejected = r.newValue === "true";
          break;
        case "name":
          meta.name = r.newValue;
          break;
      }
    }

    // Manual employees — from dedicated table (full data)
    const manualEmployees = db
      .prepare(
        "SELECT empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate FROM user_employees"
      )
      .all()
      .map((r: any) => ({
        empId: r.empId,
        name: r.name,
        grade: r.grade,
        subTeam: r.subTeam,
        serviceLine: r.serviceLine,
        managerId: r.managerId,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
      }));

    res.json({
      statusOverrides,
      manualOpportunities,
      manualAccounts,
      opportunityActions,
      staffingNeeds,
      staffingAssignments,
      revenueTeam,
      sapCategoryOverrides: {},
      editorStates: (() => {
        const rows = db.prepare("SELECT empId, state FROM user_assignments").all() as {
          empId: string;
          state: string;
        }[];
        const result: Record<string, any> = {};
        for (const r of rows) {
          try {
            result[r.empId] = JSON.parse(r.state);
          } catch {
            /* skip */
          }
        }
        return result;
      })(),
      scenarios,
      employeeMetadata,
      manualEmployees,
    });
  } catch (err) {
    error("hydrate/changes", "Error:", err);
    res.status(500).json({ error: "Error reading user modifications." });
  }
});

// ── Status label mapping (matches frontend STATUS_TEXT) ──
const STATUS_LABEL: Record<number, string> = {
  1: "Lead Identified",
  4: "Go Approved",
  6: "Proposal Submitted",
  11: "Client Tells Us We Have Won",
  13: "Authorized Engagement Letter",
  14: "Booked",
  15: "Lost",
};
function statusLabel(s: number): string {
  return STATUS_LABEL[s] || `Status ${s}`;
}

interface NotificationItem {
  type: NotificationType;
  title: string;
  message?: string;
  opportunityId?: string;
}

interface ChangeSummary {
  descriptions: string[];
  affectedOppIds: string[];
  revenueDelta: number;
  notificationItems: NotificationItem[];
}

/** Compare incoming data with current DB state to produce human-readable change descriptions. */
function buildChangeSummary(data: Record<string, any>, database: typeof db): ChangeSummary {
  const descriptions: string[] = [];
  const affectedOppIds: string[] = [];
  const notificationItems: NotificationItem[] = [];
  let revenueDelta = 0;

  // ── Status overrides diff ──
  if (data.statusOverrides && typeof data.statusOverrides === "object") {
    // Read current overrides from DB
    const currentOverrides: Record<string, { oldValue: string; newValue: string }> = {};
    const rows = database
      .prepare(
        `SELECT entityId, oldValue, newValue FROM user_overrides
         WHERE entityType = 'opportunity' AND field = 'status'`
      )
      .all() as { entityId: string; oldValue: string; newValue: string }[];
    for (const r of rows) currentOverrides[r.entityId] = r;

    // Look up opportunity names
    const oppNameCache: Record<string, string> = {};
    const lookupName = (id: string) => {
      if (oppNameCache[id]) return oppNameCache[id];
      const row = database
        .prepare("SELECT opportunity FROM crm_opportunities WHERE opportunityId = ? LIMIT 1")
        .get(id) as { opportunity: string } | undefined;
      const name = row?.opportunity || id.slice(0, 12);
      oppNameCache[id] = name;
      return name;
    };

    for (const [oppId, so] of Object.entries(data.statusOverrides) as [string, any][]) {
      if (so._reverted) {
        if (currentOverrides[oppId]) {
          const desc = `${lookupName(oppId)}: status override removed`;
          descriptions.push(desc);
          affectedOppIds.push(oppId);
          notificationItems.push({ type: "status_change", title: desc, opportunityId: oppId });
        }
        continue;
      }
      const prev = currentOverrides[oppId];
      if (!prev) {
        const desc = `${lookupName(oppId)}: ${statusLabel(so.originalStatus)} → ${statusLabel(so.newStatus)}`;
        descriptions.push(desc);
        affectedOppIds.push(oppId);
        notificationItems.push({ type: "status_change", title: desc, opportunityId: oppId });
      } else if (prev.newValue !== String(so.newStatus)) {
        const desc = `${lookupName(oppId)}: ${statusLabel(Number(prev.newValue))} → ${statusLabel(so.newStatus)}`;
        descriptions.push(desc);
        affectedOppIds.push(oppId);
        notificationItems.push({ type: "status_change", title: desc, opportunityId: oppId });
      }
    }
    for (const oppId of Object.keys(currentOverrides)) {
      if (!(oppId in data.statusOverrides)) {
        const desc = `${lookupName(oppId)}: status override removed`;
        descriptions.push(desc);
        affectedOppIds.push(oppId);
        notificationItems.push({ type: "status_change", title: desc, opportunityId: oppId });
      }
    }
  }

  // ── Manual opportunities diff ──
  if (Array.isArray(data.manualOpportunities)) {
    const currentOpps: Record<string, number> = {};
    const dbRows = database.prepare("SELECT opportunityId, grossRevenue FROM user_opportunities").all() as {
      opportunityId: string;
      grossRevenue: number;
    }[];
    for (const r of dbRows) currentOpps[r.opportunityId] = r.grossRevenue || 0;

    for (const opp of data.manualOpportunities) {
      const id = opp.opportunityId || opp.id;
      const newRev = Number(opp.grossRevenue) || 0;
      const oldRev = currentOpps[id] ?? 0;
      affectedOppIds.push(id);

      if (!(id in currentOpps)) {
        const oppName = opp.opportunity || opp.name || id;
        descriptions.push(`New opportunity: ${oppName}`);
        revenueDelta += newRev;
        notificationItems.push({
          type: "opportunity",
          title: `New opportunity: ${oppName}`,
          message: opp.account || undefined,
          opportunityId: id,
        });
      } else if (newRev !== oldRev) {
        revenueDelta += newRev - oldRev;
      }
    }
    for (const id of Object.keys(currentOpps)) {
      if (!data.manualOpportunities.some((o: any) => (o.opportunityId || o.id) === id)) {
        descriptions.push(`Opportunity removed: ${id.slice(0, 12)}`);
        affectedOppIds.push(id);
        revenueDelta -= currentOpps[id];
        notificationItems.push({
          type: "opportunity",
          title: `Opportunity removed: ${id.slice(0, 12)}`,
          opportunityId: id,
        });
      }
    }
  }

  // ── Staffing needs diff ──
  if (data.staffingNeeds && typeof data.staffingNeeds === "object") {
    const currentIds = new Set(
      (database.prepare("SELECT id FROM user_staffing_needs").all() as { id: string }[]).map((r) => r.id)
    );
    const incomingIds = new Set<string>();
    let added = 0;
    for (const [oppId, needs] of Object.entries(data.staffingNeeds) as [string, any[]][]) {
      for (const n of needs) {
        const id = n.id || "";
        incomingIds.add(id);
        if (id && !currentIds.has(id)) {
          added++;
          affectedOppIds.push(oppId);
          notificationItems.push({
            type: "staffing_need",
            title: `Staffing need created: ${n.quantity ?? 1}x ${n.grade || "?"}`,
            message: `${n.startDate || ""} → ${n.endDate || ""}`,
            opportunityId: oppId,
          });
        }
      }
    }
    let removed = 0;
    for (const id of currentIds) {
      if (!incomingIds.has(id)) removed++;
    }
    if (added > 0) descriptions.push(`${added} staffing need${added > 1 ? "s" : ""} added`);
    if (removed > 0) descriptions.push(`${removed} staffing need${removed > 1 ? "s" : ""} removed`);
  }

  // ── Actions diff ──
  if (data.opportunityActions && typeof data.opportunityActions === "object") {
    const currentActions = new Map<string, any>();
    const dbActions = database.prepare("SELECT id, opportunityId, description, owner FROM user_actions").all() as any[];
    for (const a of dbActions) currentActions.set(a.id, a);

    for (const [oppId, actions] of Object.entries(data.opportunityActions) as [string, any[]][]) {
      for (const a of actions) {
        if (a.id && !currentActions.has(a.id)) {
          notificationItems.push({
            type: "action",
            title: `Action: ${a.description || "?"}`,
            message: a.owner ? `Assigned to ${a.owner}` : undefined,
            opportunityId: oppId,
          });
        }
      }
    }
    const incomingCount = Object.values(data.opportunityActions as Record<string, any[]>).reduce(
      (s, a) => s + a.length,
      0
    );
    const diff = incomingCount - currentActions.size;
    if (diff > 0) descriptions.push(`${diff} action${diff > 1 ? "s" : ""} added`);
    if (diff < 0) descriptions.push(`${-diff} action${-diff > 1 ? "s" : ""} removed`);
  }

  // ── Editor states (assignment edits) ──
  if (data.editorStates && typeof data.editorStates === "object") {
    const currentIds = new Set(
      (database.prepare("SELECT empId FROM user_assignments").all() as { empId: string }[]).map((r) => r.empId)
    );
    const incomingIds = new Set(Object.keys(data.editorStates).filter((k) => data.editorStates[k] != null));
    const newlyEdited: string[] = [];
    for (const id of incomingIds) {
      if (!currentIds.has(id)) newlyEdited.push(id);
    }
    if (newlyEdited.length > 0) {
      descriptions.push(`Assignments edited for ${newlyEdited.length} employee${newlyEdited.length > 1 ? "s" : ""}`);
      // Look up employee names for notification
      const nameStmt = database.prepare("SELECT name FROM employees WHERE empId = ? LIMIT 1");
      for (const empId of newlyEdited) {
        const row = nameStmt.get(empId) as { name: string } | undefined;
        notificationItems.push({
          type: "crm_update",
          title: `Assignment edited: ${row?.name || empId}`,
        });
      }
    }
  }

  // ── Revenue team diff ──
  if (data.revenueTeam && typeof data.revenueTeam === "object") {
    const currentCount =
      (database.prepare("SELECT COUNT(*) as c FROM user_revenue_team").get() as { c: number })?.c || 0;
    let incomingCount = 0;
    for (const members of Object.values(data.revenueTeam) as any[][]) {
      incomingCount += members.length;
    }
    const diff = incomingCount - currentCount;
    if (diff > 0) {
      descriptions.push(`${diff} revenue team member${diff > 1 ? "s" : ""} added`);
      // Identify new members per opp
      const currentIds = new Set(
        (database.prepare("SELECT id FROM user_revenue_team").all() as { id: string }[]).map((r) => r.id)
      );
      for (const [oppId, members] of Object.entries(data.revenueTeam) as [string, any[]][]) {
        for (const m of members) {
          if (m.id && !currentIds.has(m.id)) {
            notificationItems.push({
              type: "crm_update",
              title: `Revenue team: ${m.name || "?"} added`,
              message: `${m.gradeBucket || ""} · ${m.percentage ?? 100}%`,
              opportunityId: oppId,
            });
          }
        }
      }
    }
    if (diff < 0) descriptions.push(`${-diff} revenue team member${-diff > 1 ? "s" : ""} removed`);
  }

  // ── Scenarios diff ──
  if (Array.isArray(data.scenarios)) {
    const currentScenarios = new Map<string, string>();
    const dbScenarios = database.prepare("SELECT id, name FROM user_scenarios").all() as { id: string; name: string }[];
    for (const s of dbScenarios) currentScenarios.set(s.id, s.name);
    const incomingIds = new Set<string>();
    for (const s of data.scenarios) {
      incomingIds.add(s.id);
      if (!currentScenarios.has(s.id)) {
        notificationItems.push({ type: "crm_update", title: `Scenario created: ${s.name || s.id}` });
      }
    }
    for (const [id, name] of currentScenarios) {
      if (!incomingIds.has(id)) {
        notificationItems.push({ type: "crm_update", title: `Scenario deleted: ${name || id}` });
      }
    }
    const diff = data.scenarios.length - currentScenarios.size;
    if (diff > 0) descriptions.push(`${diff} scenario${diff > 1 ? "s" : ""} added`);
    if (diff < 0) descriptions.push(`${-diff} scenario${-diff > 1 ? "s" : ""} removed`);
  }

  // ── Manual accounts diff ──
  if (Array.isArray(data.manualAccounts)) {
    const currentCount = (database.prepare("SELECT COUNT(*) as c FROM user_accounts").get() as { c: number })?.c || 0;
    const diff = data.manualAccounts.length - currentCount;
    if (diff > 0) {
      descriptions.push(`${diff} manual account${diff > 1 ? "s" : ""} added`);
      const currentIds = new Set(
        (database.prepare("SELECT accountId FROM user_accounts").all() as { accountId: string }[]).map(
          (r) => r.accountId
        )
      );
      for (const acc of data.manualAccounts) {
        const accId = acc.accountId || "";
        if (accId && !currentIds.has(accId)) {
          notificationItems.push({ type: "crm_update", title: `Account created: ${acc.account || accId}` });
        }
      }
    }
    if (diff < 0) descriptions.push(`${-diff} manual account${-diff > 1 ? "s" : ""} removed`);
  }

  // ── Employee metadata diff ──
  if (data.employeeMetadata && typeof data.employeeMetadata === "object") {
    const currentEmpIds = new Set(
      (
        database.prepare("SELECT DISTINCT entityId FROM user_overrides WHERE entityType = 'employee'").all() as {
          entityId: string;
        }[]
      ).map((r) => r.entityId)
    );
    const nameStmt = database.prepare("SELECT name FROM employees WHERE empId = ? LIMIT 1");
    let newOverrides = 0;
    for (const [empId, meta] of Object.entries(data.employeeMetadata) as [string, any][]) {
      const hasData = meta.dm || meta.role || meta.manualArrival || meta.manualDeparture || meta.rejected;
      if (hasData && !currentEmpIds.has(empId)) {
        newOverrides++;
        const row = nameStmt.get(empId) as { name: string } | undefined;
        notificationItems.push({ type: "crm_update", title: `Employee metadata updated: ${row?.name || empId}` });
      }
    }
    if (newOverrides > 0)
      descriptions.push(`Metadata updated for ${newOverrides} employee${newOverrides > 1 ? "s" : ""}`);
  }

  // ── Manual employees diff ──
  if (Array.isArray(data.manualEmployees)) {
    const currentCount = (database.prepare("SELECT COUNT(*) as c FROM user_employees").get() as { c: number })?.c || 0;
    const diff = data.manualEmployees.length - currentCount;
    if (diff > 0) {
      descriptions.push(`${diff} manual employee${diff > 1 ? "s" : ""} added`);
      const currentIds = new Set(
        (database.prepare("SELECT empId FROM user_employees").all() as { empId: string }[]).map((r) => r.empId)
      );
      for (const emp of data.manualEmployees) {
        if (emp.empId && !currentIds.has(emp.empId)) {
          notificationItems.push({ type: "crm_update", title: `Employee added: ${emp.name || emp.empId}` });
        }
      }
    }
    if (diff < 0) descriptions.push(`${-diff} manual employee${-diff > 1 ? "s" : ""} removed`);
  }

  return { descriptions, affectedOppIds: [...new Set(affectedOppIds)], revenueDelta, notificationItems };
}

// ── POST /api/hydrate/changes ──
// Écrit les modifications utilisateur dans les tables dédiées

router.post("/changes", (req: Request, res: Response) => {
  try {
    const { _tabId, ...data } = req.body || {};
    if (!data || typeof data !== "object") {
      res.status(400).json({ error: "JSON body required." });
      return;
    }

    const modifiedBy = (req as any).user?.username || "anonymous";

    // Log what's being synced
    const keys = Object.keys(data);
    const summary = keys.map((k) => {
      const v = data[k];
      if (Array.isArray(v)) return `${k}: ${v.length} items`;
      if (v && typeof v === "object") return `${k}: ${Object.keys(v).length} keys`;
      return `${k}: ${typeof v}`;
    });
    log("sync", `Received: ${summary.join(", ")}`);

    // Log employee metadata details
    if (data.employeeMetadata) {
      const metaKeys = Object.keys(data.employeeMetadata);
      const withDm = metaKeys.filter((k) => data.employeeMetadata[k]?.dm);
      const withManualArr = metaKeys.filter((k) => data.employeeMetadata[k]?._manualArrival);
      const withGH = metaKeys.filter((k) => data.employeeMetadata[k]?.gradeHistory?.length > 0);
      log(
        "sync",
        `employeeMetadata: ${metaKeys.length} total, ${withDm.length} with DM, ${withManualArr.length} manual arrival, ${withGH.length} with gradeHistory`
      );
      if (withDm.length > 0) {
        withDm
          .slice(0, 3)
          .forEach((k) =>
            log("sync", `  ${k}: dm=${data.employeeMetadata[k].dm}, segment=${data.employeeMetadata[k].segment}`)
          );
      }
    }

    const now = new Date().toISOString();

    // ── Build human-readable change summary for SSE broadcast ──
    const changeSummary = buildChangeSummary(data, db);

    const syncAll = db.transaction(() => {
      // Status overrides → EAV table (user_overrides)
      if (data.statusOverrides && typeof data.statusOverrides === "object") {
        db.prepare("DELETE FROM user_overrides WHERE entityType = 'opportunity'").run();
        const insert = db.prepare(
          "INSERT INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt) VALUES ('opportunity', ?, ?, ?, ?, ?)"
        );
        for (const [opportunityId, so] of Object.entries(data.statusOverrides) as [string, any][]) {
          if (so._reverted) continue;
          insert.run(
            opportunityId,
            "status",
            String(so.originalStatus ?? ""),
            String(so.newStatus),
            so.modifiedAt || now
          );
          if (so.comment) insert.run(opportunityId, "overrideComment", null, so.comment, so.modifiedAt || now);
          if (so.bookingDate) insert.run(opportunityId, "bookingDate", null, so.bookingDate, so.modifiedAt || now);
        }
      }

      // Manual accounts (same schema as crm_accounts)
      if (Array.isArray(data.manualAccounts)) {
        db.prepare("DELETE FROM user_accounts").run();
        const insert = db.prepare(
          `INSERT INTO user_accounts (accountId, account, segmentCode, subSegmentCode, subSegment, country, region, parentAccount, accountLeader, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
        );
        for (const acc of data.manualAccounts) {
          insert.run(
            acc.accountId || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            acc.account,
            acc.segmentCode || null,
            acc.subSegmentCode || null,
            acc.subSegment || null,
            acc.country || null,
            acc.region || null,
            acc.parentAccount || null,
            acc.accountLeader || null,
            acc.createdAt || now,
            now
          );
        }
      }

      // Manual opportunities → dedicated table (user_opportunities)
      if (Array.isArray(data.manualOpportunities)) {
        db.prepare("DELETE FROM user_opportunities").run();
        const insertOpp = db.prepare(
          `INSERT INTO user_opportunities (opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue, winPct, cm1Pct,
            jobCode, engagementType, weightedBooking, creationDate, bookingDate, estimatedBookingDate,
            lastStatusChangeDate, manager, partner, em, ep,
            managerId, partnerId, emId, epId,
            country, region, segmentCode, subSegmentCode, subSegment,
            serviceLine1, serviceLine2, serviceLine3, serviceOffering1, serviceOffering2, serviceOffering3,
            serviceOffering1Pct, serviceOffering2Pct, serviceOffering3Pct,
            technologyPartner1, technologyPartner2, technologyPartner3,
            lostComment, primaryContactId, primaryContact, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const opp of data.manualOpportunities) {
          insertOpp.run(
            opp.opportunityId || opp.id,
            opp.opportunity || opp.name,
            opp.accountId || null,
            opp.account || null,
            opp.status ?? null,
            opp.grossRevenue ?? null,
            opp.netRevenue ?? null,
            opp.winPct ?? null,
            opp.cm1Pct ?? null,
            opp.jobCode ?? null,
            opp.engagementType ?? null,
            opp.weightedBooking ?? null,
            opp.creationDate ?? null,
            opp.bookingDate ?? null,
            opp.estimatedBookingDate ?? null,
            opp.lastStatusChangeDate ?? null,
            opp.manager ?? null,
            opp.partner ?? null,
            opp.em ?? null,
            opp.ep ?? null,
            opp.managerId ?? null,
            opp.partnerId ?? null,
            opp.emId ?? null,
            opp.epId ?? null,
            opp.country ?? null,
            opp.region ?? null,
            opp.segmentCode ?? null,
            opp.subSegmentCode ?? null,
            opp.subSegment ?? null,
            opp.serviceLine1 ?? null,
            opp.serviceLine2 ?? null,
            opp.serviceLine3 ?? null,
            opp.serviceOffering1 ?? null,
            opp.serviceOffering2 ?? null,
            opp.serviceOffering3 ?? null,
            opp.serviceOffering1Pct ?? null,
            opp.serviceOffering2Pct ?? null,
            opp.serviceOffering3Pct ?? null,
            opp.techPartner1 ?? null,
            opp.techPartner2 ?? null,
            opp.techPartner3 ?? null,
            opp.lostComment ?? null,
            opp.primaryContactId ?? null,
            opp.primaryContact ?? null,
            opp.createdAt ?? now,
            now
          );
        }
      }

      // Editor states — single source of truth for MDS edits per employee
      // Contains baseline + actionLog + redoStack + current
      if (data.editorStates && typeof data.editorStates === "object") {
        db.prepare("DELETE FROM user_assignments").run();
        const insert = db.prepare(
          "INSERT INTO user_assignments (empId, state, updatedAt, modifiedBy) VALUES (?, ?, ?, ?)"
        );
        const now2 = new Date().toISOString();
        for (const [empId, state] of Object.entries(data.editorStates)) {
          if (state) insert.run(empId, JSON.stringify(state), now2, modifiedBy);
        }
      }

      // Actions (per opportunity)
      if (data.opportunityActions && typeof data.opportunityActions === "object") {
        db.prepare("DELETE FROM user_actions").run();
        const insert = db.prepare(
          "INSERT INTO user_actions (id, opportunityId, description, owner, dueDate, priority, status, createdAt, modifiedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const [opportunityId, actions] of Object.entries(data.opportunityActions) as [string, any[]][]) {
          for (const a of actions) {
            insert.run(
              a.id || `${opportunityId}_${Date.now()}`,
              opportunityId,
              a.description,
              a.owner ?? null,
              a.dueDate ?? a.dueDate ?? null,
              a.priority ?? null,
              a.status ?? "open",
              a.createdAt ?? a.createdAt ?? now,
              modifiedBy
            );
          }
        }
      }

      // Staffing needs (per opportunity) — UPSERT strategy
      if (data.staffingNeeds && typeof data.staffingNeeds === "object") {
        const existingIds = new Set(
          (db.prepare("SELECT id FROM user_staffing_needs").all() as { id: string }[]).map((r) => r.id)
        );
        const incomingIds = new Set<string>();
        const upsert = db.prepare(
          `INSERT OR REPLACE INTO user_staffing_needs (id, opportunityId, grade, quantity, startDate, endDate, skills, probability, utilization, description, assignedTo, status, createdAt, modifiedAt, modifiedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const [opportunityId, needs] of Object.entries(data.staffingNeeds) as [string, any[]][]) {
          for (const n of needs) {
            const nid = n.id || `${opportunityId}_${Date.now()}`;
            incomingIds.add(nid);
            upsert.run(
              nid,
              opportunityId,
              n.grade ?? null,
              n.quantity ?? 1,
              n.startDate ?? n.startDate ?? null,
              n.endDate ?? n.endDate ?? null,
              JSON.stringify(n.skills || []),
              n.probability ?? null,
              n.utilization ?? null,
              n.description ?? null,
              n.assignedTo ?? null,
              n.status ?? "open",
              n.createdAt ?? n.createdAt ?? now,
              now,
              modifiedBy
            );
          }
        }
        // Delete needs that were removed on the frontend
        const deleteStmt = db.prepare("DELETE FROM user_staffing_needs WHERE id = ?");
        for (const oldId of existingIds) {
          if (!incomingIds.has(oldId)) deleteStmt.run(oldId);
        }
      }

      // Revenue team allocations (per opportunity)
      if (data.revenueTeam && typeof data.revenueTeam === "object") {
        db.prepare("DELETE FROM user_revenue_team").run();
        const insert = db.prepare(
          "INSERT INTO user_revenue_team (id, opportunityId, name, gradeBucket, percentage, modifiedBy) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const [opportunityId, members] of Object.entries(data.revenueTeam) as [string, any[]][]) {
          for (const m of members) {
            insert.run(
              m.id || `${opportunityId}_${Date.now()}`,
              opportunityId,
              m.name,
              m.gradeBucket ?? m.gradeBucket,
              m.percentage ?? 100,
              modifiedBy
            );
          }
        }
      }

      // Scenarios
      if (Array.isArray(data.scenarios)) {
        db.prepare("DELETE FROM user_scenarios").run();
        const insert = db.prepare(
          "INSERT INTO user_scenarios (id, name, baseId, overrides, empOverrides, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const s of data.scenarios) {
          insert.run(
            s.id,
            s.name,
            s.baseScenarioId ?? s.baseId ?? null,
            JSON.stringify(s.assignmentOverrides ?? s.overrides ?? {}),
            JSON.stringify(s.employeeOverrides ?? s.empOverrides ?? {}),
            s.createdAt ?? s.createdAt ?? now
          );
        }
      }

      // Employee metadata overrides → EAV table (user_overrides)
      if (data.employeeMetadata && typeof data.employeeMetadata === "object") {
        db.prepare("DELETE FROM user_overrides WHERE entityType = 'employee'").run();
        const insert = db.prepare(
          "INSERT INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt) VALUES ('employee', ?, ?, ?, ?, ?)"
        );
        let insertCount = 0;
        let skipCount = 0;
        for (const [empId, meta] of Object.entries(data.employeeMetadata) as [string, any][]) {
          const hasManualData = meta.dm || meta.role || meta.manualArrival || meta.manualDeparture || meta.rejected;
          if (!hasManualData) {
            skipCount++;
            continue;
          }
          // Insert one row per non-null field
          if (meta.dm) insert.run(empId, "dm", null, meta.dm, now);
          if (meta.role) insert.run(empId, "role", null, meta.role, now);
          if (meta.segment || meta.team) insert.run(empId, "segment", null, meta.segment ?? meta.team, now);
          if (meta.serviceLine) insert.run(empId, "serviceLine", null, meta.serviceLine, now);
          if (meta.arrivalDate) insert.run(empId, "arrivalDate", null, meta.arrivalDate, now);
          if (meta.departureDate) insert.run(empId, "departureDate", null, meta.departureDate, now);
          if (meta.manualArrival) insert.run(empId, "manualArrival", null, "true", now);
          if (meta.manualDeparture) insert.run(empId, "manualDeparture", null, "true", now);
          if (meta.gradeHistory?.length > 0)
            insert.run(empId, "gradeHistory", null, JSON.stringify(meta.gradeHistory), now);
          if (meta.etpAdjustments?.length > 0)
            insert.run(empId, "etpAdjustments", null, JSON.stringify(meta.etpAdjustments), now);
          if (meta.rejected) insert.run(empId, "rejected", null, "true", now);
          if (meta.name) insert.run(empId, "name", null, meta.name, now);
          insertCount++;
        }
        log("sync", `employee_overrides: ${insertCount} employees, ${skipCount} skipped`);
      }

      // Manual employees → dedicated table (user_employees, same schema as employees)
      if (Array.isArray(data.manualEmployees) && !isDemoMode()) {
        db.prepare("DELETE FROM user_employees").run();
        const insert = db.prepare(
          `INSERT INTO user_employees (empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
        );
        for (const emp of data.manualEmployees) {
          insert.run(
            emp.empId || emp.empId,
            emp.name,
            emp.grade ?? null,
            emp.subTeam ?? emp.subTeam ?? null,
            emp.serviceLine ?? emp.serviceLine ?? null,
            emp.managerId ?? emp.managerId ?? null,
            emp.arrivalDate ?? emp.arrivalDate ?? null,
            emp.departureDate ?? emp.departureDate ?? null,
            now,
            now
          );
        }
      }
    });

    syncAll();

    // Create notifications for detected changes
    for (const item of changeSummary.notificationItems) {
      createNotification(
        item.type,
        item.title,
        item.message ? `${item.message} — by ${modifiedBy}` : `by ${modifiedBy}`,
        item.opportunityId
      );
    }

    // Audit trail
    logAudit(modifiedBy, "sync", undefined, undefined, `Synced: ${summary.join(", ")}`);

    // Trigger backup after user data changes (debounced)
    import("../../services/backup.js")
      .then(({ backupUserData }) => {
        setTimeout(() => backupUserData(), 2000);
      })
      .catch(() => {});

    // Cross-tab sync: broadcast with tabId so the sender can filter out its own echo.
    // Other tabs/users receive the event → refetch → restoreUserChanges.
    broadcast("user-data-saved", {
      timestamp: now,
      tabId: _tabId || null,
      user: modifiedBy,
      changes: changeSummary.descriptions,
      affectedOppIds: changeSummary.affectedOppIds,
      revenueDelta: changeSummary.revenueDelta,
    });

    res.json({ success: true, updatedAt: now });
  } catch (err) {
    error("hydrate/changes", "Error:", err);
    res.status(500).json({ error: "Error saving user modifications." });
  }
});

export default router;
