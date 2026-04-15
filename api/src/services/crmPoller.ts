/**
 * CRM Delta Poller — Communicates with a persistent Python daemon
 * (refresh_crm.py --daemon) via stdin/stdout JSON protocol.
 *
 * Polling strategy:
 *   1. Probe (lightweight $count check) → if no changes, skip
 *   2. Delta sync → fetch + resolve + upsert changed records
 *   3. Adaptive interval: 15s base, ramps to 120s when idle, resets on change
 *
 * Set CRM_POLL_INTERVAL=0 to disable. Default: adaptive (15s-120s).
 */

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { log, warn, error } from "../utils/logger.js";
import { broadcast } from "../routes/events.js";
import { isDemoMode } from "../db/database.js";
import { mapNormalizedToFrontend } from "../routes/hydrate/utils.js";
import { createNotification } from "../routes/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFRESH_SCRIPT = path.resolve(__dirname, "../../../scripts/refresh_crm.py");
const DB_PATH = path.resolve(__dirname, "../../dashboard.db");

// Adaptive interval config — doubles on each no-change cycle, up to 1h
const MIN_INTERVAL = 15_000; // 15s
const MAX_INTERVAL = 3_600_000; // 1h

let daemon: ChildProcess | null = null;
let rl: readline.Interface | null = null;
let pendingResolve: ((data: any) => void) | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let running = false;
let spawnAttempts = 0;

// Adaptive state
let currentInterval = MIN_INTERVAL;
let pollCount = 0;
let changeCount = 0;
let lastHeartbeat = Date.now();
const HEARTBEAT_INTERVAL = 10 * 60 * 1000; // 10 min

interface DeltaResult {
  hasChanges: boolean;
  opportunities: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  log: string[];
}

// ── Daemon lifecycle ──

function spawnDaemon(): Promise<boolean> {
  return new Promise((resolve) => {
    daemon = spawn("python3", [REFRESH_SCRIPT, "--daemon", "--db", DB_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Stream stderr to logs (filter out noisy warnings)
    daemon.stderr?.on("data", (d) => {
      const lines = d
        .toString()
        .split("\n")
        .filter((l: string) => l.trim());
      for (const line of lines) {
        const clean = line.replace(/\r/g, "").trim();
        // Suppress known noisy warnings (urllib3/LibreSSL, deprecation notices)
        if (/NotOpenSSLWarning|urllib3|warnings\.warn/.test(clean)) continue;
        log("crm-daemon", clean);
      }
    });

    // Line-based stdout reader
    rl = readline.createInterface({ input: daemon.stdout!, crlfDelay: Infinity });
    rl.on("line", (line) => {
      try {
        const data = JSON.parse(line);
        if (data.ready) {
          log("crm-poller", "Daemon ready");
          spawnAttempts = 0;
          resolve(true);
          return;
        }
        if (pendingResolve) {
          const cb = pendingResolve;
          pendingResolve = null;
          cb(data);
        }
      } catch {
        warn("crm-poller", `Unexpected daemon output: ${line}`);
      }
    });

    daemon.on("close", (code) => {
      log("crm-poller", `Daemon exited (code ${code})`);
      daemon = null;
      rl = null;
      if (pendingResolve) {
        const cb = pendingResolve;
        pendingResolve = null;
        cb(null);
      }
    });

    daemon.on("error", (err) => {
      error("crm-poller", `Daemon spawn error: ${err.message}`);
      resolve(false);
    });

    // Timeout: if daemon doesn't send "ready" in 30s, give up
    setTimeout(() => resolve(false), 30_000);
  });
}

function killDaemon() {
  if (daemon) {
    try {
      sendRaw({ action: "shutdown" });
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (daemon) daemon.kill();
    }, 2000);
  }
}

function sendRaw(cmd: Record<string, unknown>) {
  if (!daemon?.stdin?.writable) throw new Error("Daemon not running");
  daemon.stdin.write(JSON.stringify(cmd) + "\n");
}

function sendCommand(cmd: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!daemon?.stdin?.writable) {
      reject(new Error("Daemon not running"));
      return;
    }
    pendingResolve = resolve;
    sendRaw(cmd);
    // Timeout: if no response in 60s, resolve null
    setTimeout(() => {
      if (pendingResolve === resolve) {
        pendingResolve = null;
        resolve(null);
      }
    }, 60_000);
  });
}

async function ensureDaemon(): Promise<boolean> {
  if (daemon?.stdin?.writable) return true;
  if (spawnAttempts >= 5) {
    warn("crm-poller", "Max spawn attempts reached, giving up");
    return false;
  }
  spawnAttempts++;
  log("crm-poller", `Spawning daemon (attempt ${spawnAttempts})...`);
  return spawnDaemon();
}

// ── Poll cycle ──

async function poll() {
  if (running || isDemoMode()) return;
  running = true;

  try {
    if (!(await ensureDaemon())) return;

    pollCount++;

    // Phase 1: Lightweight probe ($count only)
    const probeResult = await sendCommand({ action: "probe" });
    if (!probeResult || !probeResult.hasChanges) {
      // No changes — double the interval
      currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL);
      // Periodic heartbeat so we know it's alive
      if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        log(
          "crm-poller",
          `Idle (${pollCount} polls, ${changeCount} changes, next in ${Math.round(currentInterval / 1000)}s)`
        );
        lastHeartbeat = Date.now();
      }
      return;
    }

    // Phase 2: Full delta sync
    const deltaResult: DeltaResult | null = await sendCommand({ action: "delta" });
    if (!deltaResult) return;

    if (deltaResult.hasChanges) {
      changeCount++;
      const nOpps = deltaResult.opportunities.length;
      const nAcc = deltaResult.accounts.length;
      const nCt = deltaResult.contacts.length;
      const parts = [];
      if (nOpps) parts.push(`${nOpps} opp${nOpps > 1 ? "s" : ""}`);
      if (nAcc) parts.push(`${nAcc} compte${nAcc > 1 ? "s" : ""}`);
      if (nCt) parts.push(`${nCt} contact${nCt > 1 ? "s" : ""}`);
      const details = deltaResult.log
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" | ");
      log("crm-poller", `Δ ${parts.join(", ")}${details ? " — " + details : ""}`);

      // Send pre-mapped data so frontend doesn't need a duplicate mapper
      const mappedOpps = deltaResult.opportunities.map(mapNormalizedToFrontend);
      broadcast("crm-updated", {
        timestamp: new Date().toISOString(),
        opportunities: mappedOpps,
        accounts: deltaResult.accounts,
        contacts: deltaResult.contacts,
      });

      // Persist notification per changed opportunity
      for (const opp of mappedOpps) {
        const name = (opp as any).opportunity || (opp as any).opportunityId || "?";
        const account = (opp as any).account || "";
        const status = (opp as any).status || "";
        const title = `CRM update: ${name}`;
        const message = [account, status].filter(Boolean).join(" · ");
        createNotification("crm_update", title, message, (opp as any).opportunityId);
      }
      if (nAcc) {
        createNotification("crm_update", `${nAcc} account${nAcc > 1 ? "s" : ""} updated`);
      }
      if (nCt) {
        createNotification("crm_update", `${nCt} contact${nCt > 1 ? "s" : ""} updated`);
      }

      // Reset adaptive interval
      currentInterval = MIN_INTERVAL;
      lastHeartbeat = Date.now();
    }
  } catch (err) {
    warn("crm-poller", `Poll error: ${err}`);
  } finally {
    running = false;
    scheduleNext();
  }
}

function scheduleNext() {
  if (!timeoutId) return; // Stopped
  timeoutId = setTimeout(poll, currentInterval);
}

// ── Public API ──

export function startCrmPoller() {
  const envInterval = parseInt(process.env.CRM_POLL_INTERVAL || "", 10);
  if (envInterval === 0) {
    log("crm-poller", "Disabled (CRM_POLL_INTERVAL=0)");
    return;
  }

  if (timeoutId) return; // Already running

  currentInterval = MIN_INTERVAL;
  log("crm-poller", `Starting (adaptive ${MIN_INTERVAL / 1000}s → ${MAX_INTERVAL / 1000}s)`);

  // First poll after short delay
  timeoutId = setTimeout(poll, 5000);
}

export function stopCrmPoller() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  killDaemon();
  log("crm-poller", "Stopped");
}
