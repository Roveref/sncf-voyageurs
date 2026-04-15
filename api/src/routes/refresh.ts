/**
 * Routes /api/refresh/* — Trigger CRM data refresh via Python script
 *
 * POST /api/refresh/crm    → Spawn refresh_crm.py as a detached child process
 * GET  /api/refresh/status  → Return current refresh state
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { log, warn, error as logError } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

// ── Module-level refresh state ──

interface RefreshState {
  running: boolean;
  lastRun: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

const refreshState: RefreshState = {
  running: false,
  lastRun: null,
  lastStatus: null,
  lastError: null,
};

// ── Resolve script path (relative to project root) ──

function getScriptPath(): string {
  // API runs from api/ directory, so project root is one level up
  return path.resolve(__dirname, "..", "..", "..", "scripts", "refresh_crm.py");
}

// ── POST /api/refresh/crm ──

router.post("/crm", (_req: Request, res: Response) => {
  try {
    // Prevent concurrent runs
    if (refreshState.running) {
      res.status(409).json({
        status: "already_running",
        message: "A CRM refresh is already in progress",
      });
      return;
    }

    const scriptPath = getScriptPath();

    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      logError("refresh", `Script not found: ${scriptPath}`);
      res.status(500).json({
        status: "error",
        message: `Script not found: ${scriptPath}`,
      });
      return;
    }

    // Mark as running
    refreshState.running = true;
    refreshState.lastError = null;

    log("refresh", `Starting CRM refresh: python3 ${scriptPath} --all --push`);

    const child = spawn("python3", [scriptPath, "--all", "--push"], {
      cwd: path.resolve(__dirname, "..", "..", ".."),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      refreshState.running = false;
      refreshState.lastRun = new Date().toISOString();

      if (code === 0) {
        refreshState.lastStatus = "success";
        refreshState.lastError = null;
        log("refresh", "CRM refresh completed successfully");
        if (stdout.trim()) {
          log("refresh", `stdout: ${stdout.trim().slice(0, 500)}`);
        }
      } else {
        refreshState.lastStatus = "error";
        refreshState.lastError = stderr.trim() || `Process exited with code ${code}`;
        logError("refresh", `CRM refresh failed (code ${code})`);
        if (stderr.trim()) {
          logError("refresh", `stderr: ${stderr.trim().slice(0, 500)}`);
        }
      }
    });

    child.on("error", (err: Error) => {
      refreshState.running = false;
      refreshState.lastRun = new Date().toISOString();
      refreshState.lastStatus = "error";
      refreshState.lastError = err.message;
      logError("refresh", `CRM refresh spawn error: ${err.message}`);
    });

    // Unref so the parent process can exit independently if needed
    child.unref();

    res.json({
      status: "started",
      message: "CRM refresh started",
    });
  } catch (err) {
    refreshState.running = false;
    logError("refresh", "Failed to start CRM refresh:", err);
    res.status(500).json({
      status: "error",
      message: `Failed to start refresh: ${String(err)}`,
    });
  }
});

// ── GET /api/refresh/status ──

router.get("/status", (_req: Request, res: Response) => {
  res.json(refreshState);
});

// ── Auto-refresh cron (optional, enabled via CRM_REFRESH_CRON=1) ──

function scheduleAutoRefresh() {
  if (process.env.CRM_REFRESH_CRON !== "1") return;

  const TARGET_HOUR = 6; // 6:00 AM local time
  const CHECK_INTERVAL_MS = 60_000; // Check every minute

  let lastAutoRefreshDate: string | null = null;

  log("refresh", `Auto-refresh enabled — will run daily at ${TARGET_HOUR}:00`);

  setInterval(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Already ran today?
    if (lastAutoRefreshDate === todayStr) return;

    // Is it the target hour?
    if (now.getHours() !== TARGET_HOUR || now.getMinutes() !== 0) return;

    // Don't trigger if a refresh is already running
    if (refreshState.running) {
      warn("refresh", "Auto-refresh skipped — a refresh is already running");
      return;
    }

    lastAutoRefreshDate = todayStr;
    log("refresh", "Auto-refresh triggered (daily cron)");

    const scriptPath = getScriptPath();

    if (!fs.existsSync(scriptPath)) {
      logError("refresh", `Auto-refresh: script not found: ${scriptPath}`);
      return;
    }

    refreshState.running = true;
    refreshState.lastError = null;

    const child = spawn("python3", [scriptPath, "--all", "--push"], {
      cwd: path.resolve(__dirname, "..", "..", ".."),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    let stderr = "";

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      refreshState.running = false;
      refreshState.lastRun = new Date().toISOString();

      if (code === 0) {
        refreshState.lastStatus = "success";
        refreshState.lastError = null;
        log("refresh", "Auto-refresh completed successfully");
      } else {
        refreshState.lastStatus = "error";
        refreshState.lastError = stderr.trim() || `Process exited with code ${code}`;
        logError("refresh", `Auto-refresh failed (code ${code})`);
      }
    });

    child.on("error", (err: Error) => {
      refreshState.running = false;
      refreshState.lastRun = new Date().toISOString();
      refreshState.lastStatus = "error";
      refreshState.lastError = err.message;
      logError("refresh", `Auto-refresh spawn error: ${err.message}`);
    });

    child.unref();
  }, CHECK_INTERVAL_MS);
}

// Start the auto-refresh scheduler on module load
scheduleAutoRefresh();

export default router;
