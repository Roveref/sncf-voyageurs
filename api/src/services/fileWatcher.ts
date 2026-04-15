/**
 * File Watcher — Surveille le dossier data/ pour les fichiers Excel.
 *
 * Quand un fichier .xlsx ou .xls apparaît ou est modifié,
 * il est importé via scripts/import_files.py (single source of truth).
 */

import { watch, type FSWatcher } from "chokidar";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { log, debug, warn, error } from "../utils/logger.js";
import { broadcast } from "../routes/events.js";
import { isDemoMode } from "../db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || "../data";
const IMPORT_SCRIPT = path.resolve(__dirname, "../../../scripts/import_files.py");
const DB_PATH = path.resolve(__dirname, "../../dashboard.db");

let watcher: FSWatcher | null = null;

export function startFileWatcher() {
  if (watcher) return; // Already running

  const resolvedDir = path.resolve(DATA_DIR);
  const shortDir = resolvedDir.replace(process.env.HOME || "", "~");
  log("watcher", `Monitoring ${shortDir}`);

  watcher = watch(resolvedDir, {
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
    ignored: [/(^|[/\\])\./, /~\$/],
  });

  watcher.on("add", (filePath) => handleFile(filePath, "new"));
  watcher.on("change", (filePath) => handleFile(filePath, "modified"));
  watcher.on("error", (err) => {
    error("watcher", "File watcher error:", err);
  });
}

export function stopFileWatcher() {
  if (!watcher) return;
  watcher.close();
  watcher = null;
  log("watcher", "Stopped");
}

const queue: { filePath: string; event: "new" | "modified" }[] = [];
let processing = false;

/** Check if an import is currently in progress (used to prevent demo mode switch mid-import). */
export function isImporting(): boolean {
  return processing || queue.length > 0;
}

/** Wait for current import queue to drain. Resolves immediately if idle. */
export function waitForImportIdle(timeoutMs = 30000): Promise<void> {
  if (!processing && queue.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (!processing && queue.length === 0) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Import still in progress after timeout"));
      setTimeout(check, 500);
    };
    check();
  });
}

async function handleFile(filePath: string, event: "new" | "modified") {
  if (isDemoMode()) return;
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".xlsx" && ext !== ".xls") return;

  queue.push({ filePath, event });
  if (!processing) processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { filePath, event } = queue.shift()!;
    const fileName = path.basename(filePath);
    debug("watcher", `${event === "new" ? "New" : "Modified"} file: ${fileName} (${queue.length} queued)`);

    try {
      await runImport(filePath);
    } catch (err) {
      error("watcher", `Failed to import ${fileName}:`, err);
    }
  }

  processing = false;
}

function runImport(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [IMPORT_SCRIPT, "--db", DB_PATH, filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const lines = stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const skipped = lines.some((l) => /unchanged, skipped/.test(l));
        if (skipped) {
          // File hasn't changed since last import — silent skip
          resolve();
          return;
        }
        const summary = lines.find((l) => /\d+ rows/.test(l));
        if (summary)
          log(
            "watcher",
            `Imported ${path.basename(filePath)}: ${summary.replace(path.basename(filePath) + ":", "").trim()}`
          );
        else log("watcher", `Imported ${path.basename(filePath)}`);
        broadcast("files-imported", { timestamp: new Date().toISOString(), file: path.basename(filePath) });
        resolve();
      } else {
        reject(new Error(`import_files.py exited with code ${code}: ${stderr.trim()}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn import_files.py: ${err.message}`));
    });
  });
}
