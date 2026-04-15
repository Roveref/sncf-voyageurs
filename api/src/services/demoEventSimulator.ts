/**
 * Demo SSE Event Simulator — Broadcasts realistic live events in demo mode.
 *
 * Reads existing demo opportunities from the DB, periodically mutates a few
 * (revenue, status, winPct), persists the changes, and broadcasts:
 *   - crm-updated  (opportunity deltas)
 *   - notification  (CRM update notifications)
 *
 * Starts when demo mode activates, stops when it deactivates.
 */

import { getDemoDb } from "../db/database.js";
import { broadcast } from "../routes/events.js";
import { mapNormalizedToFrontend } from "../routes/hydrate/utils.js";
import { createNotification } from "../routes/notifications.js";
import { log } from "../utils/logger.js";

// ── Config ──

const MIN_INTERVAL = 25_000; // 25s
const MAX_INTERVAL = 60_000; // 60s
const MAX_OPPS_PER_EVENT = 3; // mutate 1-3 opps per tick

// ── State ──

let timerId: ReturnType<typeof setTimeout> | null = null;

// ── Helpers ──

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Status transitions: from → possible next statuses (realistic flow)
const STATUS_TRANSITIONS: Record<number, number[]> = {
  1: [1, 2], // Open → Open, Qualified
  2: [2, 3, 8], // Qualified → Qualified, Proposed, Lost
  3: [3, 4, 8], // Proposed → Proposed, Negotiation, Lost
  4: [4, 5, 8], // Negotiation → Negotiation, Won, Lost
  5: [5], // Won → Won (terminal)
  8: [8], // Lost → Lost (terminal)
};

interface DemoOpp {
  opportunityId: string;
  opportunity: string;
  account: string;
  status: number;
  grossRevenue: number;
  netRevenue: number;
  winPct: number;
}

function loadMutableOpps(): DemoOpp[] {
  const db = getDemoDb();
  return db
    .prepare(
      `SELECT opportunityId, opportunity, account, status, grossRevenue, netRevenue, winPct
       FROM crm_opportunities
       WHERE status NOT IN (5, 8)
       ORDER BY RANDOM()
       LIMIT 20`
    )
    .all() as DemoOpp[];
}

function mutateOpp(opp: DemoOpp): Record<string, unknown> | null {
  const db = getDemoDb();

  // Pick what changes
  const actions: string[] = [];

  // Revenue tweak (±5-15%)
  if (Math.random() < 0.6) {
    const factor = 1 + (Math.random() * 0.2 - 0.1); // 0.9 .. 1.1
    opp.grossRevenue = Math.round(opp.grossRevenue * factor);
    opp.netRevenue = Math.round(opp.netRevenue * factor);
    actions.push("revenue");
  }

  // Win% tweak
  if (Math.random() < 0.4) {
    opp.winPct = Math.min(100, Math.max(5, opp.winPct + randomBetween(-10, 15)));
    actions.push("winPct");
  }

  // Status advancement
  if (Math.random() < 0.25) {
    const nextOptions = STATUS_TRANSITIONS[opp.status] || [opp.status];
    const newStatus = randomFrom(nextOptions);
    if (newStatus !== opp.status) {
      opp.status = newStatus;
      actions.push("status");
    }
  }

  if (actions.length === 0) return null;

  // Persist to demo DB
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crm_opportunities
     SET grossRevenue = ?, netRevenue = ?, winPct = ?, status = ?, lastStatusChangeDate = ?, updatedAt = ?
     WHERE opportunityId = ?`
  ).run(opp.grossRevenue, opp.netRevenue, opp.winPct, opp.status, now, now, opp.opportunityId);

  // Read back full row for broadcast
  const full = db.prepare("SELECT * FROM crm_opportunities WHERE opportunityId = ?").get(opp.opportunityId) as Record<
    string,
    unknown
  >;

  return full ? mapNormalizedToFrontend(full) : null;
}

// ── Tick ──

function tick() {
  try {
    const pool = loadMutableOpps();
    if (pool.length === 0) {
      scheduleNext();
      return;
    }

    const count = Math.min(randomBetween(1, MAX_OPPS_PER_EVENT), pool.length);
    const picked = pool.slice(0, count);
    const mutated: Record<string, unknown>[] = [];

    for (const opp of picked) {
      const result = mutateOpp(opp);
      if (result) mutated.push(result);
    }

    if (mutated.length > 0) {
      broadcast("crm-updated", {
        timestamp: new Date().toISOString(),
        opportunities: mutated,
        accounts: [],
        contacts: [],
      });

      // Create notifications for each mutated opp
      for (const opp of mutated) {
        const name = String(opp.opportunity || opp.opportunityId || "?");
        const account = String(opp.account || "");
        createNotification("crm_update", `CRM update: ${name}`, account, String(opp.opportunityId || ""));
      }

      log("demo-sim", `Broadcast ${mutated.length} opp update(s)`);
    }
  } catch (err) {
    log("demo-sim", `Tick error: ${err}`);
  }

  scheduleNext();
}

function scheduleNext() {
  if (!timerId) return; // stopped
  timerId = setTimeout(tick, randomBetween(MIN_INTERVAL, MAX_INTERVAL));
}

// ── Public API ──

export function startDemoSimulator() {
  if (timerId) return;
  log("demo-sim", `Starting (${MIN_INTERVAL / 1000}s–${MAX_INTERVAL / 1000}s interval)`);
  // Use a non-null sentinel so scheduleNext knows we're running
  timerId = setTimeout(tick, randomBetween(8_000, 15_000)); // first event after 8-15s
}

export function stopDemoSimulator() {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
    log("demo-sim", "Stopped");
  }
}
